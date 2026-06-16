export const dynamic = "force-dynamic";

import crypto from "crypto";
import { getMcpTokenByUserId } from "@/lib/auth-shared";
import { getUserByToken } from "@/lib/db-mcp";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function verifyCode(code: string): Record<string, string> | null {
  const dot = code.lastIndexOf(".");
  if (dot === -1) return null;
  const data = code.slice(0, dot);
  const sig = code.slice(dot + 1);
  const expected = b64url(
    crypto.createHmac("sha256", process.env.MCP_API_KEY!).update(data).digest(),
  );
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function extractCredentials(request: Request, body: URLSearchParams) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const [clientId, clientSecret] = decoded.split(":");
    return { clientId, clientSecret };
  }
  return {
    clientId: body.get("client_id") ?? "",
    clientSecret: body.get("client_secret") ?? "",
  };
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const body = new URLSearchParams(await request.text());
  const grantType = body.get("grant_type");

  if (grantType === "authorization_code") {
    const code = body.get("code") ?? "";
    const codeVerifier = body.get("code_verifier") ?? "";

    const payload = verifyCode(code);
    if (!payload) {
      return Response.json({ error: "invalid_grant" }, { status: 400, headers: CORS });
    }

    if (Date.now() > Number(payload.exp)) {
      return Response.json(
        { error: "invalid_grant", error_description: "code expired" },
        { status: 400, headers: CORS },
      );
    }

    const hash = crypto.createHash("sha256").update(codeVerifier).digest();
    const challenge = b64url(hash);
    if (challenge !== payload.cc) {
      return Response.json(
        { error: "invalid_grant", error_description: "pkce mismatch" },
        { status: 400, headers: CORS },
      );
    }

    // Defensa en profundidad (RFC 6749 §4.1.3): el code está ligado al
    // redirect_uri y client_id con que se emitió. Si el cliente los manda, deben
    // coincidir. Lenient si los omite (cliente público) para no romper el login.
    const reqRedirect = body.get("redirect_uri");
    const reqClient = body.get("client_id");
    if (
      (reqRedirect !== null && reqRedirect !== payload.ru) ||
      (reqClient !== null && reqClient !== payload.ci)
    ) {
      return Response.json(
        { error: "invalid_grant", error_description: "redirect_uri/client_id mismatch" },
        { status: 400, headers: CORS },
      );
    }

    // Hand back the resolved user's own MCP token (per-user isolation).
    const uid = Number(payload.uid);
    const userToken = Number.isInteger(uid) ? await getMcpTokenByUserId(uid) : null;
    if (!userToken) {
      return Response.json(
        { error: "invalid_grant", error_description: "unknown user" },
        { status: 400, headers: CORS },
      );
    }
    return Response.json(
      { access_token: userToken, token_type: "Bearer", expires_in: 86400 },
      { headers: CORS },
    );
  }

  if (grantType === "client_credentials") {
    // The client secret must itself be a valid user MCP token; echo it back so
    // the caller stays scoped to that user.
    const { clientSecret } = extractCredentials(request, body);
    const user = clientSecret ? await getUserByToken(clientSecret) : null;
    if (!user) {
      return Response.json({ error: "invalid_client" }, { status: 401, headers: CORS });
    }
    return Response.json(
      { access_token: clientSecret, token_type: "Bearer", expires_in: 86400 },
      { headers: CORS },
    );
  }

  return Response.json({ error: "unsupported_grant_type" }, { status: 400, headers: CORS });
}
