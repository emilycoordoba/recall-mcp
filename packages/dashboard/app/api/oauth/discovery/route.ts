export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
      grant_types_supported: ["authorization_code", "client_credentials"],
      response_types_supported: ["code"],
      code_challenge_methods_supported: ["S256"],
    },
    { headers: CORS },
  );
}
