import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase-middleware";

// Middleware de routing de next-intl (detección/normalización del prefijo de
// locale). Se crea una vez a nivel módulo.
const handleI18nRouting = createMiddleware(routing);

// Encadena i18n routing + auth de Supabase. Ver lib/supabase-middleware.ts.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas NO localizadas (contratos de máquina / handlers): sólo refrescan la
  // sesión, sin pasar por el ruteo de idioma (que les agregaría un /es y rompería
  // el fetch del dashboard o el POST de logout).
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return updateSession(req);
  }

  // 1) i18n primero: si normaliza el prefijo (p.ej. /app → /es/app, o / → /es)
  //    emite un redirect; lo devolvemos y la auth corre en el request siguiente,
  //    ya con el locale en la URL.
  const i18nResponse = handleI18nRouting(req);
  if (i18nResponse.headers.has("location")) return i18nResponse;

  // 2) Auth locale-aware sobre la response de i18n (preserva su rewrite/cookie).
  return updateSession(req, i18nResponse);
}

export const config = {
  matcher: [
    // Corre en páginas (incluye / y las rutas con prefijo de locale) y en las
    // APIs del dashboard (que necesitan el header de usuario), pero NO en el
    // endpoint MCP, OAuth, /authorize (contrato OAuth, fuera del prefijo de
    // locale), assets internos, ni los archivos públicos de SEO/PWA.
    "/((?!api/mcp|api/oauth|authorize|.well-known|robots.txt|sitemap.xml|opengraph-image|twitter-image|manifest.webmanifest|icon.svg|apple-icon.png|_next/static|_next/image|favicon.ico).*)",
  ],
};
