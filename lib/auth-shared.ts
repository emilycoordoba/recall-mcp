import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin as supabase } from "./supabase-admin";

// Credenciales de Claude Desktop (OAuth) → usuario. Valida contra Supabase Auth
// (email + contraseña), igual que el login del dashboard; ya no usa
// `dashboard_pass`. Usa service-role para leer `users` (sin sesión → bajo RLS el
// anon no vería nada). NO importa next/headers para seguir siendo usable desde
// el Edge runtime.
export interface DashboardUser {
  id: number;
  name: string;
}

// Verifica email+contraseña contra Supabase Auth y devuelve el usuario de perfil
// (`users.id`/`name`). Usa un cliente anon efímero (sin persistir sesión) solo
// para validar; el users.id sale de app_metadata.app_user_id del JWT (misma
// fuente que confía el middleware), con fallback a una lectura por auth_id.
export async function getUserByAuthCreds(
  email: string,
  password: string,
): Promise<DashboardUser | null> {
  const probe = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await probe.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data?.user) return null;

  const authUser = data.user;
  const fromJwt = authUser.app_metadata?.app_user_id;
  const name = (authUser.user_metadata?.name as string | undefined) ?? authUser.email ?? "Usuario";
  if (typeof fromJwt === "number") return { id: fromJwt, name };

  // Fallback: resolver users.id por el puente auth_id.
  const { data: profile, error: pErr } = await supabase
    .from("users")
    .select("id, name")
    .eq("auth_id", authUser.id)
    .maybeSingle();
  if (pErr) throw pErr;
  return profile ?? null;
}

// Returns the MCP bearer token for a user id. Used by the OAuth token endpoint
// to hand each user *their own* token instead of a shared one.
export async function getMcpTokenByUserId(id: number): Promise<string | null> {
  const { data, error } = await supabase
    .from("users")
    .select("mcp_token")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.mcp_token ?? null;
}
