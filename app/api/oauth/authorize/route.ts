export const dynamic = "force-dynamic";

import crypto from "crypto";
import { getUserByAuthCreds, isAllowedRedirectUri } from "@/lib/auth-shared";

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

  const email = body.get("email") ?? "";
  const password = body.get("password") ?? "";
  const redirectUri = body.get("redirect_uri") ?? "";
  const codeChallenge = body.get("code_challenge") ?? "";
  const codeChallengeMethod = body.get("code_challenge_method") ?? "S256";
  const clientId = body.get("client_id") ?? "";
  const state = body.get("state");
  const responseType = body.get("response_type");

  // Validar redirect_uri ANTES de autenticar o redirigir: si no está en la
  // allowlist, error directo (nunca redirigir a un destino no confiable). Cierra
  // el open redirect que permitiría robar el authorization code de la víctima.
  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    return Response.json(
      { error: "invalid_request", error_description: "redirect_uri not allowed" },
      { status: 400 },
    );
  }

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

  const user = await getUserByAuthCreds(email, password);
  if (!user) {
    return Response.redirect(
      new URL(`/authorize?${authorizeParams}`, request.url),
      302,
    );
  }

  if (responseType !== "code" || !redirectUri || !codeChallenge) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // Embed the resolved user so the token endpoint can hand back *their* token.
  const code = generateCode({
    cc: codeChallenge,
    ccm: codeChallengeMethod,
    ru: redirectUri,
    ci: clientId,
    uid: user.id,
    exp: Date.now() + 5 * 60 * 1000,
  });

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return Response.redirect(callbackUrl.toString(), 302);
}
