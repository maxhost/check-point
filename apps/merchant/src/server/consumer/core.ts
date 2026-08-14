import { createHash, randomBytes } from "node:crypto";

/** Name of the opaque consumer session cookie (independent of the merchant session). */
export const SESSION_COOKIE = "consumer_session";
/** Session lifetime, in days (spec 0028). */
export const SESSION_TTL_DAYS = 30;

/** Typed domain error: HTTP status + a stable machine `code` + a user message. */
export class ConsumerError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type EnrollInput = {
  firstName: string;
  lastName: string;
  phoneE164: string;
  countryIso: string;
};

/** Opaque, PII-free, unguessable token: 32 random bytes (256 bits) as base64url. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/** One-way hash for at-rest storage of a bearer token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Walks the `.cause` chain (drizzle wraps the pg error) and returns its SQLSTATE code. */
export function pgErrorCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const code = (current as { code?: string }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

export type ConsumerAccountRow = {
  id: string;
  phoneE164: string;
  phoneVerifiedAt: Date | null;
  firstName: string;
  lastName: string;
  countryIso: string | null;
  qrToken: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MembershipRow = {
  id: string;
  programId: string;
  businessId: string;
  enrolledAt: Date;
};

/**
 * Client-facing shape of a consumer account. Built by explicit allow-list so it
 * can NEVER serialize the raw `qrToken` (nor any future column). Exposes only the
 * consumer's own profile plus a derived `phoneVerified` boolean.
 */
export function consumerAccountResponse(account: ConsumerAccountRow) {
  return {
    id: account.id,
    firstName: account.firstName,
    lastName: account.lastName,
    phoneE164: account.phoneE164,
    countryIso: account.countryIso,
    phoneVerified: account.phoneVerifiedAt !== null,
  };
}

/** Client-facing shape of a membership (no secrets; explicit allow-list). */
export function membershipResponse(membership: MembershipRow) {
  return {
    id: membership.id,
    programId: membership.programId,
    businessId: membership.businessId,
    enrolledAt: membership.enrolledAt,
  };
}
