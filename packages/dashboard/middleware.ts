import { NextRequest, NextResponse } from "next/server";
import { getUserByDashboardCreds, USER_HEADER } from "@/lib/auth-shared";

const REALM = "Recall Dashboard";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${REALM}"` },
  });
}

export async function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth) return unauthorized();

  const [scheme, encoded] = auth.split(" ");
  if (scheme !== "Basic" || !encoded) return unauthorized();

  const [user, pass] = Buffer.from(encoded, "base64").toString("utf-8").split(":");

  let resolved;
  try {
    resolved = await getUserByDashboardCreds(user, pass);
  } catch {
    return new NextResponse("Internal error", { status: 500 });
  }
  if (!resolved) return unauthorized();

  // Propagate the resolved user to Server Components / route handlers.
  const headers = new Headers(req.headers);
  headers.set(USER_HEADER, String(resolved.id));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    // Protege todas las páginas pero no el endpoint MCP ni assets internos
    "/((?!api/mcp|api/oauth|authorize|.well-known|_next/static|_next/image|favicon.ico).*)",
  ],
};
