export const dynamic = "force-dynamic";

import crypto from "crypto";

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateCode(payload: object): string {
  const data = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(
    crypto.createHmac("sha256", process.env.MCP_API_KEY!).update(data).digest(),
  );
  return `${data}.${sig}`;
}

export async function POST(request: Request) {
  const body = new URLSearchParams(await request.text());

  const password = body.get("password") ?? "";
  const redirectUri = body.get("redirect_uri") ?? "";
  const codeChallenge = body.get("code_challenge") ?? "";
  const codeChallengeMethod = body.get("code_challenge_method") ?? "S256";
  const clientId = body.get("client_id") ?? "";
  const state = body.get("state");
  const responseType = body.get("response_type");

  // Reconstruct authorize URL to redirect back on error
  const authorizeParams = new URLSearchParams({
    response_type: responseType ?? "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    error: "access_denied",
    ...(state ? { state } : {}),
  });

  if (!process.env.DASHBOARD_PASS || password !== process.env.DASHBOARD_PASS) {
    return Response.redirect(
      new URL(`/authorize?${authorizeParams}`, request.url),
      302,
    );
  }

  if (responseType !== "code" || !redirectUri || !codeChallenge) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const code = generateCode({
    cc: codeChallenge,
    ccm: codeChallengeMethod,
    ru: redirectUri,
    ci: clientId,
    exp: Date.now() + 5 * 60 * 1000,
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return Response.redirect(callbackUrl.toString(), 302);
}
