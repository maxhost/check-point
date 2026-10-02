import {
  type JWTVerifyGetKey,
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
} from "jose";

/**
 * Verificacion del `id_token` de Google y de Apple (spec 0119 / ADR 0111 §2). Sin SDK de
 * proveedor: firma contra el JWKS del proveedor, `iss`, `aud`, `exp` (lo hace `jwtVerify`) y el
 * `nonce` de la cookie transitoria (lo compara esta funcion). El JWKS es inyectable: en
 * produccion `createRemoteJWKSet`, en los tests `createLocalJWKSet` con una clave generada.
 */

export const GOOGLE_ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
];
export const APPLE_ISSUER = "https://appleid.apple.com";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

/** Falla del ingreso con proveedor. `reason` es lo unico que se loguea (nunca el token). */
export class OAuthFailure extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

/** La fuente de claves con que se verifica un id_token (el JWKS del proveedor). */
export type IdTokenKeys = JWTVerifyGetKey;

export type VerifiedIdToken = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  givenName: string | null;
  familyName: string | null;
};

let googleJwks: JWTVerifyGetKey | null = null;
let appleJwks: JWTVerifyGetKey | null = null;

/** El JWKS remoto de cada proveedor (jose lo cachea y lo refresca ante un `kid` nuevo). */
export function providerJwks(provider: "google" | "apple"): JWTVerifyGetKey {
  if (provider === "google") {
    googleJwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
    return googleJwks;
  }
  appleJwks ??= createRemoteJWKSet(new URL(APPLE_JWKS_URL));
  return appleJwks;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Verifica un `id_token` y devuelve sus claims de identidad. Cualquier problema —firma de otra
 * clave, `iss`/`aud` ajenos, vencido, `nonce` distinto o ausente, sin `sub`— es una
 * {@link OAuthFailure}. Apple manda `email_verified` como string (`"true"`); Google como boolean.
 */
export async function verifyIdToken(input: {
  token: string;
  jwks: JWTVerifyGetKey;
  issuer: string | string[];
  audience: string;
  nonce: string;
}): Promise<VerifiedIdToken> {
  let payload: Record<string, unknown>;
  try {
    ({ payload } = await jwtVerify(input.token, input.jwks, {
      issuer: input.issuer,
      audience: input.audience,
      algorithms: ["RS256"],
    }));
  } catch (error) {
    if (error instanceof joseErrors.JOSEError)
      throw new OAuthFailure(`id_token_${error.code}`);
    throw new OAuthFailure("id_token_invalid");
  }
  // El `nonce` ata el token a ESTE intento (la cookie del navegador que lo empezo): un
  // id_token valido robado de otro ingreso no sirve aca.
  if (typeof payload.nonce !== "string" || payload.nonce !== input.nonce)
    throw new OAuthFailure("id_token_nonce");
  const sub = optionalString(payload.sub);
  if (!sub) throw new OAuthFailure("id_token_sub");
  return {
    sub,
    email: optionalString(payload.email),
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
    givenName: optionalString(payload.given_name),
    familyName: optionalString(payload.family_name),
  };
}
