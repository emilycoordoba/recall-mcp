import { headers } from "next/headers";
import { supabase } from "./supabase";

// Header set by middleware once Basic auth resolves to a user. Server Components
// and route handlers read the current user from here — never trust the client.
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

// Current user id for the request. Throws if the middleware did not set it,
// which should be impossible for any matched (auth-protected) route.
export async function currentUserId(): Promise<number> {
  const h = await headers();
  const raw = h.get(USER_HEADER);
  const id = raw ? Number(raw) : NaN;
  if (!Number.isInteger(id)) {
    throw new Error("No authenticated user on request");
  }
  return id;
}
