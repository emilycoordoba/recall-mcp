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
      resource: `${base}/api/mcp`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      resource_documentation: `${base}/api/mcp`,
    },
    { headers: CORS },
  );
}
