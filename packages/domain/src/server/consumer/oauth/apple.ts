import { SignJWT, importPKCS8 } from "jose";
import { APPLE_ISSUER, OAuthFailure } from "./tokens";

/**
 * Sign in with Apple, resuelto en el servidor (spec 0119 / ADR 0111 §2). Apple vuelve por
 * `form_post` (obligatorio al pedir `name email`) y el `client_secret` del canje es un JWT ES256
 * firmado en cada canje con la clave `.p8`, de 5 minutos.
 */

const AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const CLIENT_SECRET_TTL_SECONDS = 5 * 60;

export type AppleConfig = {
  serviceId: string;
  keyId: string;
  teamId: string;
  privateKey: string;
};

/**
 * La configuracion desde el env, o `null` si falta algo. La clave `.p8` se acepta con saltos de
 * linea reales o con `\n` LITERALES: un valor multilinea sin comillas en un `.env` llega cortado
 * en el primer salto, asi que la forma segura de cargarla es en una linea con `\n`.
 */
export function appleConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): AppleConfig | null {
  const serviceId = env.APPLE_SIGNIN_SERVICE_ID?.trim();
  const keyId = env.APPLE_SIGNIN_KEY_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const privateKey = env.APPLE_SIGNIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!serviceId || !keyId || !teamId || !privateKey) return null;
  return { serviceId, keyId, teamId, privateKey };
}

export function appleAuthorizeUrl(input: {
  serviceId: string;
  redirectUri: string;
  state: string;
  nonce: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: input.serviceId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state: input.state,
    nonce: input.nonce,
  }).toString();
  return url.toString();
}

/** El `client_secret` del canje: JWT ES256 (`iss`=team, `sub`=service id, `kid`=key id). */
export async function appleClientSecret(
  config: AppleConfig,
  now: Date = new Date(),
): Promise<string> {
  const key = await importPKCS8(config.privateKey, "ES256");
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setSubject(config.serviceId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + CLIENT_SECRET_TTL_SECONDS)
    .sign(key);
}

/** Canjea el codigo por el `id_token`. Cualquier respuesta sin `id_token` es una falla. */
export async function exchangeAppleCode(
  input: {
    code: string;
    redirectUri: string;
    config: AppleConfig;
    now?: Date;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let clientSecret: string;
  try {
    clientSecret = await appleClientSecret(input.config, input.now);
  } catch {
    throw new OAuthFailure("apple_private_key");
  }
  let response: Response;
  try {
    response = await fetchImpl(APPLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: input.config.serviceId,
        client_secret: clientSecret,
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

/**
 * El nombre del campo `user` del `form_post` (JSON), que Apple manda SOLO en la primera
 * autorizacion. Ausente, roto o sin nombre → `null`; nunca lanza.
 */
export function parseAppleUser(
  raw: unknown,
): { firstName: string | null; lastName: string | null } | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const value = JSON.parse(raw) as { name?: unknown } | null;
    const name = value && typeof value === "object" ? value.name : null;
    if (!name || typeof name !== "object") return null;
    const pick = (field: unknown) =>
      typeof field === "string" && field.trim() ? field.trim() : null;
    const { firstName, lastName } = name as Record<string, unknown>;
    const result = { firstName: pick(firstName), lastName: pick(lastName) };
    return result.firstName || result.lastName ? result : null;
  } catch {
    return null;
  }
}
