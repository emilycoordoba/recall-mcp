import { supabase } from "./supabase";

// Header set by middleware once Basic auth resolves to a user. Server Components
// and route handlers read the current user from here — never trust the client.
// This module must NOT import next/headers so it stays usable from middleware
// (Edge runtime), where next/headers is unavailable.
export const USER_HEADER = "x-recall-user-id";

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
