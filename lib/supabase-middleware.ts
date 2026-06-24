import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { USER_HEADER } from "./auth-constants";

// Rutas (ya SIN prefijo de locale) que NO requieren sesión de dashboard. El
// MCP/OAuth tienen su propia auth por token; login/signup son las páginas de
// entrada; "/" es el landing público.
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth"];

// `pathname` acá ya viene sin el prefijo de locale (ver splitLocale).
function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Separa el prefijo de locale del resto del path. `/es/app` → { locale:"es",
// bare:"/app" }. Si el primer segmento no es un locale soportado (p.ej. `/api/...`),
// usa el default y deja el path intacto.
function splitLocale(pathname: string): { locale: string; bare: string } {
  const segments = pathname.split("/"); // "/es/app" → ["", "es", "app"]
  const maybeLocale = segments[1];
  if (hasLocale(routing.locales, maybeLocale)) {
    const rest = "/" + segments.slice(2).join("/");
    return { locale: maybeLocale, bare: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/" };
  }
  return { locale: routing.defaultLocale, bare: pathname };
}

// Refresca la sesión de Supabase Auth y resuelve el usuario, ahora locale-aware.
// `baseResponse` es la response que dejó el middleware de i18n (con su rewrite
// interno y la cookie NEXT_LOCALE); la conservamos para no perder el ruteo de
// idioma. Para /api y /auth se llama sin baseResponse (no se localizan).
export async function updateSession(
  req: NextRequest,
  baseResponse?: NextResponse,
): Promise<NextResponse> {
  let res = baseResponse ?? NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          // Sin base de i18n recreamos la response; con base, escribimos las
          // cookies de refresco sobre ella para no descartar su rewrite.
          if (!baseResponse) res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() revalida el token contra el auth server (no confiar en getSession()).
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = req.nextUrl;
  const { locale, bare } = splitLocale(pathname);

  if (!user) {
    if (isPublic(bare)) return res;
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Ya autenticado entrando al landing o a las páginas de entrada → al dashboard,
  // conservando el idioma actual.
  if (bare === "/" || bare === "/login" || bare === "/signup") {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/app`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const appUserId = user.app_metadata?.app_user_id;
  if (appUserId != null) {
    const headers = new Headers(req.headers);
    headers.set(USER_HEADER, String(appUserId));

    // Inyectar el header SIN descartar el rewrite interno de next-intl: si la
    // response base trae x-middleware-rewrite, lo re-emitimos con los headers del
    // request modificados; si no (rama /api), un next() normal.
    const rewrite = res.headers.get("x-middleware-rewrite");
    const passthrough = rewrite
      ? NextResponse.rewrite(new URL(rewrite), { request: { headers } })
      : NextResponse.next({ request: { headers } });

    // Conservar cookies de refresco + headers que puso next-intl (NEXT_LOCALE,
    // Link de alternates, Vary). El rewrite ya lo aplicó NextResponse.rewrite.
    res.cookies.getAll().forEach((c) => passthrough.cookies.set(c));
    res.headers.forEach((value, key) => {
      if (key === "x-middleware-rewrite" || key === "x-middleware-next") return;
      if (key === "set-cookie") return; // ya copiadas vía cookies
      passthrough.headers.set(key, value);
    });
    return passthrough;
  }

  return res;
}
