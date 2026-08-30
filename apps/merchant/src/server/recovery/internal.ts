import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { EmailProviderError } from "../email/channel";
import { emailChannelFromEnv } from "../email/provider";

/** Typed failure the API routes map straight onto a status code (mirrors `OtpError`). */
export class MerchantRecoveryError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "MerchantRecoveryError";
  }
}

/**
 * Single generic failure for every "we will not tell you why" case: unknown email,
 * wrong OTP, expired OTP, disabled staff. Callers must never branch the wording —
 * that is what makes the endpoint enumeration-resistant.
 */
export const genericResetError = () =>
  new MerchantRecoveryError(
    400,
    "invalid_or_expired",
    "El código es incorrecto o venció. Pedí uno nuevo.",
  );

export const RATE_LIMITS = {
  emailPerHour: 3,
  emailPerDay: 5,
  ipPerHour: 10,
} as const;

/**
 * The feature is dark unless explicitly switched on AND the email provider resolves.
 * An enabled gate with missing credentials is a misconfigured deploy, not a user
 * error: it answers 503 (logged) rather than pretending the code was sent.
 */
export function assertRecoveryAvailable(env: NodeJS.ProcessEnv = process.env) {
  if (env.PASSWORD_RECOVERY_ENABLED !== "true")
    throw new MerchantRecoveryError(
      503,
      "recovery_disabled",
      "La recuperación de contraseña no está disponible.",
    );
  try {
    emailChannelFromEnv(env);
  } catch (error) {
    if (error instanceof EmailProviderError) {
      // Provider name only — never the key itself.
      console.error("merchant_recovery_misconfigured", {
        provider: error.provider,
        reason: error.reason,
      });
      throw new MerchantRecoveryError(
        503,
        "recovery_unavailable",
        "La recuperación de contraseña no está disponible.",
      );
    }
    throw error;
  }
}

export function recoveryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.PASSWORD_RECOVERY_ENABLED !== "true") return false;
  try {
    emailChannelFromEnv(env);
    return true;
  } catch {
    return false;
  }
}

/** Lowercased + trimmed; rejects malformed input (format validity leaks nothing). */
export function normalizeEmail(raw: unknown): string {
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new MerchantRecoveryError(
      400,
      "invalid_email",
      "Ingresá un email válido.",
    );
  return email;
}

/** Six digits, exactly — anything else is the generic failure, not a hint. */
export function normalizeOtp(raw: unknown): string {
  const otp = typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{6}$/.test(otp)) throw genericResetError();
  return otp;
}

export function normalizePassword(raw: unknown): string {
  const password = typeof raw === "string" ? raw : "";
  // Mirrors `minPasswordLength: 8` in `getMerchantAuth()`. Not a generic error: the
  // user is choosing this value, so telling them the rule is not an oracle.
  if (password.length < 8)
    throw new MerchantRecoveryError(
      400,
      "password_too_short",
      "La contraseña nueva debe tener al menos 8 caracteres.",
    );
  return password;
}

/** SHA-256 of the first forwarded hop; null when no hop exposed an address. */
export function hashClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "";
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export type AttemptKind = "request" | "reset_ok" | "reset_fail";

export async function recordAttempt(
  db: DbTransaction,
  input: { email: string; ipHash: string | null; kind: AttemptKind },
) {
  await db.execute(
    sql`INSERT INTO merchant_auth.password_reset_attempt (email, ip_hash, kind)
        VALUES (${input.email}, ${input.ipHash}, ${input.kind})`,
  );
}

/**
 * Counts prior `request` rows in the DB — not in memory — so the limits hold across
 * restarts and across serverless instances. Throws a generic 429 when exceeded.
 */
export async function assertWithinRateLimits(
  db: DbTransaction,
  input: { email: string; ipHash: string | null },
) {
  const counts = await db.execute<{
    email_hour: string;
    email_day: string;
    ip_hour: string;
  }>(
    sql`SELECT
          count(*) FILTER (
            WHERE email = ${input.email} AND created_at > now() - interval '1 hour'
          ) AS email_hour,
          count(*) FILTER (
            WHERE email = ${input.email} AND created_at > now() - interval '1 day'
          ) AS email_day,
          count(*) FILTER (
            WHERE ip_hash IS NOT NULL AND ip_hash = ${input.ipHash}
              AND created_at > now() - interval '1 hour'
          ) AS ip_hour
        FROM merchant_auth.password_reset_attempt
        WHERE kind = 'request' AND created_at > now() - interval '1 day'`,
  );
  const row = counts.rows[0];
  const emailHour = Number(row?.email_hour ?? 0);
  const emailDay = Number(row?.email_day ?? 0);
  const ipHour = Number(row?.ip_hour ?? 0);
  if (
    emailHour >= RATE_LIMITS.emailPerHour ||
    emailDay >= RATE_LIMITS.emailPerDay ||
    ipHour >= RATE_LIMITS.ipPerHour
  )
    throw new MerchantRecoveryError(
      429,
      "too_many_requests",
      "Demasiados intentos. Probá de nuevo más tarde.",
    );
}

/**
 * A merchant user may recover when it exists, has a password account, and is not a
 * fully disabled staff member. A user with no membership yet (owner mid-onboarding)
 * still recovers. Returns false for every other case — the caller answers generically.
 */
export async function isRecoverable(
  db: DbTransaction,
  email: string,
): Promise<boolean> {
  const found = await db.execute<{ id: string }>(
    sql`SELECT u.id
        FROM merchant_auth."user" u
        WHERE lower(u.email) = ${email}
          AND EXISTS (
            SELECT 1 FROM merchant_auth.account a
            WHERE a.user_id = u.id AND a.provider_id = 'credential'
          )
          AND (
            NOT EXISTS (
              SELECT 1 FROM core.business_membership m WHERE m.user_id = u.id
            )
            OR EXISTS (
              SELECT 1 FROM core.business_membership m
              WHERE m.user_id = u.id AND m.status = 'active'
            )
          )
        LIMIT 1`,
  );
  return Boolean(found.rows[0]);
}
