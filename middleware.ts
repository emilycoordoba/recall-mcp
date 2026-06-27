import createMiddleware from "next-intl/middleware";
import { NextResponse, NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { middlewareSupabase, isPublic, splitLocale } from "@/lib/supabase-middleware";
import { USER_HEADER } from "@/lib/auth-constants";

// Middleware de routing de next-intl (detección/normalización del prefijo de
// locale). Se crea una vez a nivel módulo.
const handleI18nRouting = createMiddleware(routing);

// Compone auth de Supabase + i18n routing. El orden importa: resolvemos la sesión
// PRIMERO, inyectamos el USER_HEADER en el request, y recién entonces dejamos que
// next-intl haga su rewrite interno (que clona `request.headers` y los reenvía al
// destino). Así el header llega al Server Component sin tener que tocar a mano los
// headers `x-middleware-*` que arma next-intl. Ver lib/supabase-middleware.ts.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const { supabase, applyCookies } = middlewareSupabase(req);

  // getUser() revalida el token contra el auth server (no confiar en getSession()).
  // El cliente captura las cookies de refresco vía setAll → applyCookies las vuelca
  // en la response final para que el navegador persista la sesión renovada.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Headers del request con el id de usuario (cuando hay sesión). El render aguas
  // abajo lo lee con currentUserId() (lib/auth.ts).
  const withUserHeader = () => {
    const headers = new Headers(req.headers);
    const appUserId = user?.app_metadata?.app_user_id;
    if (appUserId != null) headers.set(USER_HEADER, String(appUserId));
    return headers;
  };

  // Rutas NO localizadas (contratos de máquina / handlers): sólo auth + header,
  // sin pasar por el ruteo de idioma (que les agregaría un /es y rompería el fetch
  // del dashboard o el POST de logout).
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return applyCookies(NextResponse.next({ request: { headers: withUserHeader() } }));
  }

  const { locale, bare } = splitLocale(pathname);

  // Sin sesión: las páginas públicas pasan (sólo se localizan); el resto va al
  // login del locale actual, recordando a dónde quería ir.
  if (!user) {
    if (isPublic(bare)) return applyCookies(handleI18nRouting(req));
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.searchParams.set("next", pathname);
    return applyCookies(NextResponse.redirect(url));
  }

  // Ya autenticado entrando al landing o a las páginas de entrada → al dashboard,
  // conservando el idioma actual.
  if (bare === "/" || bare === "/login" || bare === "/signup") {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/app`;
    url.search = "";
    return applyCookies(NextResponse.redirect(url));
  }

  // Autenticado en una ruta protegida: inyectamos el USER_HEADER en el request
  // ANTES del ruteo i18n para que next-intl lo reenvíe en su rewrite interno.
  const i18nReq = new NextRequest(req, { headers: withUserHeader() });
  return applyCookies(handleI18nRouting(i18nReq));
}

export const config = {
  matcher: [
    // Corre en páginas (incluye / y las rutas con prefijo de locale) y en las
    // APIs del dashboard (que necesitan el header de usuario), pero NO en el
    // endpoint MCP, OAuth, /authorize (contrato OAuth, fuera del prefijo de
    // locale), assets internos, ni los archivos públicos de SEO/PWA.
    "/((?!api/mcp|api/oauth|authorize|.well-known|robots.txt|sitemap.xml|opengraph-image|twitter-image|manifest.webmanifest|icon.svg|icon-192.png|icon-512.png|icon-maskable-512.png|apple-icon.png|_next/static|_next/image|favicon.ico).*)",
  ],
};
