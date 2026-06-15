import { supabaseAdmin as supabase } from "./supabase-admin";

// Credenciales de Claude Desktop (OAuth) → usuario. Sigue validando contra
// `users.dashboard_user`/`dashboard_pass`; el MCP no usa Supabase Auth. Usa el
// cliente service-role porque lee la tabla `users` SIN sesión (no hay auth.uid()),
// así que bajo RLS el anon no vería nada. NO importa next/headers para seguir
// siendo usable desde el Edge runtime.
export interface DashboardUser {
  id: number;
  name: string;
}

// Resolves dashboard Basic-auth credentials to a user. Returns null on mismatch.
// NOTE: dashboard_pass is stored in plaintext (parity with the previous
// env-based single password). Tracked as debt — see docs/multiuser.md.
export async function getUserByDashboardCreds(
  user: string,
  pass: string,
): Promise<DashboardUser | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name")
    .eq("dashboard_user", user)
    .eq("dashboard_pass", pass)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
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
