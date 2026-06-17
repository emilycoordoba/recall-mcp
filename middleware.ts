import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

// Auth del dashboard via Supabase Auth (sesión en cookies). Reemplaza el Basic
// auth previo. El endpoint MCP y OAuth quedan fuera (tienen su propia auth por
// token) — ver el matcher.
export async function middleware(req: NextRequest) {
  return updateSession(req);
}

export const config = {
  matcher: [
    // Corre en todas las páginas (incluye /login para redirigir si ya hay sesión),
    // pero NO en el endpoint MCP, OAuth, assets internos, ni los archivos públicos
    // de SEO/PWA (robots, sitemap, imágenes OG/iconos): un crawler sin sesión no
    // debe ser redirigido a /login al pedirlos.
    "/((?!api/mcp|api/oauth|authorize|.well-known|robots.txt|sitemap.xml|opengraph-image|twitter-image|manifest.webmanifest|icon.svg|apple-icon.png|_next/static|_next/image|favicon.ico).*)",
  ],
};
