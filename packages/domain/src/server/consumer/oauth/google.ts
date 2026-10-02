import { createHash } from "node:crypto";
import { OAuthFailure } from "./tokens";

/**
 * Google con codigo de autorizacion + PKCE S256, resuelto en el servidor (spec 0119 / ADR 0111
 * §2). El `id_token` que vuelve del canje lo verifica `verifyIdToken`.
 */

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type GoogleConfig = { clientId: string; clientSecret: string };

/** `null` si falta alguna de las dos variables (el boton responde con `?error=auth`). */
export function googleConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): GoogleConfig | null {
  const clientId = env.CONSUMER_GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.CONSUMER_GOOGLE_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** El `code_challenge` S256 del verificador PKCE. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function googleAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  verifier: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    nonce: input.nonce,
    code_challenge: pkceChallenge(input.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** Canjea el codigo por el `id_token`. Cualquier respuesta sin `id_token` es una falla. */
export async function exchangeGoogleCode(
  input: {
    code: string;
    verifier: string;
    redirectUri: string;
    config: GoogleConfig;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        code_verifier: input.verifier,
        redirect_uri: input.redirectUri,
        client_id: input.config.clientId,
        client_secret: input.config.clientSecret,
      }),
    });
  } catch {
    throw new OAuthFailure("token_network");
  }
  if (!response.ok) throw new OAuthFailure(`token_http_${response.status}`);
  const body = (await response.json().catch(() => null)) as {
    id_token?: unknown;
  } | null;
  if (typeof body?.id_token !== "string" || !body.id_token)
    throw new OAuthFailure("token_without_id_token");
  return body.id_token;
}
