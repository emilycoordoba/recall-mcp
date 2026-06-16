import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase-server";

// Cierra la sesión de Supabase Auth (borra las cookies) y manda a /login.
// Es un route handler POST (no GET) para que no se dispare por prefetch ni por
// navegación accidental.
export async function POST(req: NextRequest) {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
