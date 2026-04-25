import { NextRequest, NextResponse } from "next/server";

const REALM = "Recall Dashboard";

export function middleware(req: NextRequest) {
  const auth = req.headers.get("authorization");

  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [user, pass] = decoded.split(":");
      if (
        user === process.env.DASHBOARD_USER &&
        pass === process.env.DASHBOARD_PASS
      ) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}"`,
    },
  });
}

export const config = {
  matcher: [
    // Protege todas las páginas pero no el endpoint MCP ni assets internos
    "/((?!api/mcp|api/oauth|authorize|.well-known|_next/static|_next/image|favicon.ico).*)",
  ],
};
