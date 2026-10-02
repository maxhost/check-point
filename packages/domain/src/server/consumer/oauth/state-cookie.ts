import { generateOpaqueToken } from "../core";

/**
 * La cookie transitoria del ingreso con proveedor (spec 0119 / ADR 0111 §10). Guarda lo que el
 * callback necesita para reconocer SU intento: `state` (CSRF), `nonce` (ata el id_token), el
 * verificador PKCE (Google), el proveedor y a donde volver (`programId`, `loc`). JSON en
 * base64url, 10 minutos.
 *
 * `SameSite=None; Secure` porque Apple vuelve por un POST CROSS-SITE (`form_post`): una cookie
 * `Lax` no viaja en ese POST y el callback veria «sin cookie». La proteccion CSRF es el `state`,
 * no el SameSite. `__Host-` (sin `Domain`, `Path=/`, `Secure`) impide que otro subdominio de
 * `checkpass.club` la plante.
 */

export const OAUTH_COOKIE = "__Host-cp_oauth";
export const OAUTH_COOKIE_MAX_AGE = 600;

export const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
  maxAge: OAUTH_COOKIE_MAX_AGE,
} as const;

export type OAuthProvider = "google" | "apple";

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "apple";
}

export type OAuthState = {
  provider: OAuthProvider;
  state: string;
  nonce: string;
  verifier?: string;
  programId?: string;
  loc?: string;
  /** Vencimiento, en ms epoch. */
  exp: number;
};

/** Un intento nuevo: `state`, `nonce` y (Google) el verificador PKCE, opacos e impredecibles. */
export function newOAuthState(input: {
  provider: OAuthProvider;
  programId?: string | null;
  loc?: string | null;
  now?: Date;
}): OAuthState {
  const now = input.now ?? new Date();
  return {
    provider: input.provider,
    state: generateOpaqueToken(),
    nonce: generateOpaqueToken(),
    ...(input.provider === "google" ? { verifier: generateOpaqueToken() } : {}),
    ...(input.programId ? { programId: input.programId } : {}),
    ...(input.loc ? { loc: input.loc } : {}),
    exp: now.getTime() + OAUTH_COOKIE_MAX_AGE * 1000,
  };
}

export function encodeOAuthState(value: OAuthState): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

const optional = (value: unknown) =>
  typeof value === "string" && value ? value : undefined;

/** La cookie leida, o `null` si falta, esta rota o vencio. Nunca lanza. */
export function decodeOAuthState(
  raw: string | undefined,
  now: Date = new Date(),
): OAuthState | null {
  if (!raw) return null;
  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    parsed = value as Record<string, unknown>;
  } catch {
    return null;
  }
  const { provider, state, nonce, exp } = parsed;
  if (typeof provider !== "string" || !isOAuthProvider(provider)) return null;
  if (typeof state !== "string" || !state) return null;
  if (typeof nonce !== "string" || !nonce) return null;
  if (typeof exp !== "number" || exp <= now.getTime()) return null;
  const result: OAuthState = { provider, state, nonce, exp };
  const verifier = optional(parsed.verifier);
  const programId = optional(parsed.programId);
  const loc = optional(parsed.loc);
  if (verifier) result.verifier = verifier;
  if (programId) result.programId = programId;
  if (loc) result.loc = loc;
  return result;
}
