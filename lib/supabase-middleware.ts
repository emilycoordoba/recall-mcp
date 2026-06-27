import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

// Rutas (ya SIN prefijo de locale) que NO requieren sesión de dashboard. El
// MCP/OAuth tienen su propia auth por token; login/signup son las páginas de
// entrada; "/" es el landing público; "/ayuda" es la FAQ pública (indexable).
const PUBLIC_PREFIXES = ["/login", "/signup", "/auth", "/ayuda"];

// `pathname` acá ya viene sin el prefijo de locale (ver splitLocale).
export function isPublic(pathname: string) {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Separa el prefijo de locale del resto del path. `/es/app` → { locale:"es",
// bare:"/app" }. Si el primer segmento no es un locale soportado (p.ej. `/api/...`),
// usa el default y deja el path intacto.
export function splitLocale(pathname: string): { locale: string; bare: string } {
  const segments = pathname.split("/"); // "/es/app" → ["", "es", "app"]
  const maybeLocale = segments[1];
  if (hasLocale(routing.locales, maybeLocale)) {
    const rest = "/" + segments.slice(2).join("/");
    return { locale: maybeLocale, bare: rest === "/" ? "/" : rest.replace(/\/$/, "") || "/" };
  }
  return { locale: routing.defaultLocale, bare: pathname };
}

// Crea el cliente Supabase para el middleware y captura las cookies de refresco de
// sesión. `applyCookies(res)` las escribe en la response final (la de i18n routing
// o un redirect) para que el refresh persista en el navegador. El render aguas
// abajo recibe las cookies actualizadas vía el request reenviado (req.cookies.set).
export function middlewareSupabase(req: NextRequest) {
  const cookieUpdates: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            cookieUpdates.push({ name, value, options: options as Record<string, unknown> });
          });
        },
      },
    },
  );

  function applyCookies<T extends NextResponse>(res: T): T {
    for (const { name, value, options } of cookieUpdates) {
      res.cookies.set(name, value, options);
    }
    return res;
  }

  return { supabase, applyCookies };
}
