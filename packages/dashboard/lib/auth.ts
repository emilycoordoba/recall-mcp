import { headers } from "next/headers";
import { USER_HEADER } from "./auth-shared";

export { USER_HEADER, getUserByDashboardCreds, type DashboardUser } from "./auth-shared";

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
