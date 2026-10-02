import { NextResponse, type NextRequest } from "next/server";
import {
  ConsumerError,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  pgErrorCode,
} from "@mi-pasaporte/domain/server/consumer/core";
import { enrollAccount } from "@mi-pasaporte/domain/server/consumer/enrollment";
import { findOrCreateAccountByIdentity } from "@mi-pasaporte/domain/server/consumer/identity";
import { issueSession } from "@mi-pasaporte/domain/server/consumer/session";
import {
  appleConfigFromEnv,
  exchangeAppleCode,
  parseAppleUser,
} from "@mi-pasaporte/domain/server/consumer/oauth/apple";
import {
  exchangeGoogleCode,
  googleConfigFromEnv,
} from "@mi-pasaporte/domain/server/consumer/oauth/google";
import {
  OAUTH_COOKIE,
  OAUTH_COOKIE_OPTIONS,
  type OAuthProvider,
  type OAuthState,
  decodeOAuthState,
} from "@mi-pasaporte/domain/server/consumer/oauth/state-cookie";
import {
  APPLE_ISSUER,
  GOOGLE_ISSUERS,
  type IdTokenKeys,
  OAuthFailure,
  type VerifiedIdToken,
  providerJwks,
  verifyIdToken,
} from "@mi-pasaporte/domain/server/consumer/oauth/tokens";
import { issueWelcomeGiftsSafely } from "@mi-pasaporte/domain/server/marketing/welcome-issue";
import { consumerOriginOr } from "@mi-pasaporte/domain/server/hosts";

/**
 * EL CALLBACK COMUN del ingreso con Google o Apple (spec 0119 / ADR 0111). Las dos rutas solo
 * parsean (Google por query, Apple por `form_post`) y llaman aca. Responde SIEMPRE un 303.
 *
 * 1. La cookie transitoria se lee y se BORRA. Falta, vencio, es de otro proveedor o el `state`
 *    no coincide → `destino?error=auth`, sin sesion y sin filas: el `state` es la proteccion
 *    CSRF del callback (la cookie es `SameSite=None` porque Apple vuelve cross-site).
 * 2. El usuario cancelo → `destino` sin error.
 * 3. Canje del codigo + `verifyIdToken` (`nonce` = el de la cookie, `aud` = el client id).
 * 4. La cuenta de esa identidad (nunca por email). 5. Si venia un programa, el alta
 *    (`already_member` no es error). 6. Sesion. 7. 303 a la confirmacion o a `/wallet`.
 *
 * Los logs llevan proveedor y motivo; NUNCA el `code`, el `id_token`, el `sub` ni el email.
 */

export type CallbackFields = {
  code: string | null;
  state: string | null;
  error: string | null;
  /** Apple: el campo `user` del `form_post` (JSON, solo en la primera autorizacion). */
  user?: string | null;
};

export type CallbackDeps = {
  fetchImpl?: typeof fetch;
  jwks?: (provider: OAuthProvider) => IdTokenKeys;
  env?: Record<string, string | undefined>;
  now?: Date;
};

/** Apple manda `user_cancelled_authorize`; Google, `access_denied`. */
const CANCELLED = new Set(["access_denied", "user_cancelled_authorize"]);

/** La URL del callback de un proveedor, la misma en el `start` y en el canje. */
export function callbackUri(
  origin: string,
  provider: OAuthProvider,
  env: Record<string, string | undefined> = process.env,
): string {
  return `${consumerOriginOr(origin, env)}/api/public/auth/${provider}/callback`;
}

/** A donde se vuelve: la landing del programa del que se partio, o la billetera. */
export function destinationOf(programId: string | null | undefined): string {
  return programId ? `/enroll/${encodeURIComponent(programId)}` : "/wallet";
}

async function verifiedToken(
  provider: OAuthProvider,
  code: string,
  cookie: OAuthState,
  redirectUri: string,
  deps: CallbackDeps,
): Promise<VerifiedIdToken> {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const jwks = (deps.jwks ?? providerJwks)(provider);
  if (provider === "google") {
    const config = googleConfigFromEnv(env);
    if (!config) throw new OAuthFailure("google_not_configured");
    if (!cookie.verifier) throw new OAuthFailure("cookie_without_verifier");
    const token = await exchangeGoogleCode(
      { code, verifier: cookie.verifier, redirectUri, config },
      fetchImpl,
    );
    return verifyIdToken({
      token,
      jwks,
      issuer: GOOGLE_ISSUERS,
      audience: config.clientId,
      nonce: cookie.nonce,
    });
  }
  const config = appleConfigFromEnv(env);
  if (!config) throw new OAuthFailure("apple_not_configured");
  const token = await exchangeAppleCode(
    { code, redirectUri, config, now: deps.now },
    fetchImpl,
  );
  return verifyIdToken({
    token,
    jwks,
    issuer: APPLE_ISSUER,
    audience: config.serviceId,
    nonce: cookie.nonce,
  });
}

/** El alta del programa de la cookie: `new` si la membresia nacio en este ingreso. */
async function enrollFromCookie(
  cookie: OAuthState,
  accountId: string,
): Promise<"new" | "member" | "unavailable"> {
  if (!cookie.programId) return "member";
  try {
    await enrollAccount(cookie.programId, accountId, cookie.loc ?? null);
    return "new";
  } catch (error) {
    if (error instanceof ConsumerError && error.code === "already_member")
      return "member";
    // Programa no disponible o negocio que no admite altas: el ingreso igual vale y la
    // landing explica por que no hubo alta.
    if (error instanceof ConsumerError) return "unavailable";
    throw error;
  }
}

export async function handleOAuthCallback(
  request: NextRequest,
  provider: OAuthProvider,
  fields: CallbackFields,
  deps: CallbackDeps = {},
): Promise<NextResponse> {
  const env = deps.env ?? process.env;
  const base = consumerOriginOr(request.nextUrl.origin, env);
  const cookie = decodeOAuthState(
    request.cookies.get(OAUTH_COOKIE)?.value,
    deps.now,
  );
  const destination = destinationOf(cookie?.programId);
  const answer = (path: string) => {
    const response = NextResponse.redirect(new URL(path, base), 303);
    response.cookies.set(OAUTH_COOKIE, "", {
      ...OAUTH_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return response;
  };
  const fail = (reason: string) => {
    console.warn(`[oauth] ${provider}: ${reason}`);
    return answer(`${destination}?error=auth`);
  };

  if (!cookie) return fail("cookie_missing_or_expired");
  if (cookie.provider !== provider) return fail("cookie_other_provider");
  if (!fields.state || fields.state !== cookie.state)
    return fail("state_mismatch");
  if (fields.error && CANCELLED.has(fields.error)) return answer(destination);
  if (fields.error) return fail("provider_error");
  if (!fields.code) return fail("code_missing");

  let claims: VerifiedIdToken;
  try {
    claims = await verifiedToken(
      provider,
      fields.code,
      cookie,
      callbackUri(request.nextUrl.origin, provider, env),
      deps,
    );
  } catch (error) {
    return fail(error instanceof OAuthFailure ? error.reason : "verify_failed");
  }

  const appleName = provider === "apple" ? parseAppleUser(fields.user) : null;
  let target: string;
  let token: string;
  try {
    const account = await findOrCreateAccountByIdentity({
      provider,
      subject: claims.sub,
      // Google: un email no verificado no se guarda.
      email:
        provider === "google" && !claims.emailVerified ? null : claims.email,
      firstName: appleName ? appleName.firstName : claims.givenName,
      lastName: appleName ? appleName.lastName : claims.familyName,
    });
    const enrolled = await enrollFromCookie(cookie, account.id);
    if (cookie.programId) await issueWelcomeGiftsSafely(account.id);
    target =
      enrolled === "new"
        ? `/enroll/${encodeURIComponent(cookie.programId!)}/ready`
        : enrolled === "unavailable"
          ? destination
          : "/wallet";
    token = await issueSession(account.id);
  } catch (error) {
    // El SQLSTATE (p. ej. `42501` de un GRANT faltante) es diagnostico y no es PII.
    return fail(
      `account_enroll_or_session_failed:${pgErrorCode(error) ?? "unknown"}`,
    );
  }

  const response = answer(target);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
  return response;
}
