export const dynamic = "force-dynamic";

import crypto from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  // RFC 7591 DCR. Public client + PKCE (no client_secret needed — PKCE is what
  // actually secures the authorization_code flow for a public client).
  return Response.json(
    {
      client_id: crypto.randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris ?? [],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      code_challenge_methods_supported: ["S256"],
    },
    { status: 201, headers: CORS },
  );
}
