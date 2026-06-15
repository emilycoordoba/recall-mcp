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
    // pero NO en el endpoint MCP, OAuth ni assets internos.
    "/((?!api/mcp|api/oauth|authorize|.well-known|_next/static|_next/image|favicon.ico).*)",
  ],
};
