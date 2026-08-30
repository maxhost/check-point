import { sql } from "drizzle-orm";
import { getMerchantAuth } from "../auth";
import { withDbTransaction } from "../db";
import {
  assertRecoveryAvailable,
  assertWithinRateLimits,
  genericResetError,
  hashClientIp,
  isRecoverable,
  MerchantRecoveryError,
  normalizeEmail,
  normalizeOtp,
  normalizePassword,
  recordAttempt,
  type AttemptKind,
} from "./internal";

export { MerchantRecoveryError, recoveryEnabled } from "./internal";

type RequestContext = { headers: Headers };

/** better-auth throws `APIError` with `body.code`; read it without binding to the class. */
function apiErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object") return null;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

async function audit(
  email: string,
  ipHash: string | null,
  kind: AttemptKind,
): Promise<void> {
  await withDbTransaction((db) => recordAttempt(db, { email, ipHash, kind }));
}

/**
 * Step 1 — ask for a code (spec 0046).
 *
 * Always resolves to the same body: the caller cannot tell an existing account from
 * an unknown one, nor an active owner from a disabled staff member. The only
 * observable differences are the gate (503) and the rate limit (429), neither of
 * which depends on whether the email exists.
 */
export async function requestReset(
  body: unknown,
  ctx: RequestContext,
): Promise<{ ok: true }> {
  assertRecoveryAvailable();
  const input = body && typeof body === "object" ? body : {};
  const email = normalizeEmail((input as { email?: unknown }).email);
  const ipHash = hashClientIp(ctx.headers);

  const recoverable = await withDbTransaction(async (db) => {
    // Serialize bursts for this email so concurrent requests cannot each read a
    // stale count and slip past the limit (same pattern as the consumer flow).
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${email}, 0))`,
    );
    await assertWithinRateLimits(db, { email, ipHash });
    await recordAttempt(db, { email, ipHash, kind: "request" });
    return isRecoverable(db, email);
  });

  if (recoverable) {
    try {
      // better-auth owns the OTP lifecycle (generation, storage in `verification`,
      // expiry, attempts) and invokes our `sendVerificationOTP` callback, which
      // resolves the EmailChannel. We never see or store the code.
      await getMerchantAuth().api.requestPasswordResetEmailOTP({
        body: { email },
      });
    } catch (error) {
      // A provider outage must not become an enumeration oracle: if this threw only
      // for real accounts, the error itself would confirm the email exists.
      console.error("merchant_recovery_send_failed", {
        reason: error instanceof Error ? error.name : "unknown",
      });
    }
  }
  return { ok: true };
}

/**
 * Step 2 — redeem the code and set the new password (spec 0046).
 *
 * better-auth validates the OTP atomically, hashes the password and — because
 * `revokeSessionsOnPasswordReset` is on — drops every existing session.
 */
export async function resetPassword(
  body: unknown,
  ctx: RequestContext,
): Promise<{ ok: true }> {
  assertRecoveryAvailable();
  const input = body && typeof body === "object" ? body : {};
  // A malformed email here is indistinguishable from a wrong one: same generic error.
  let email: string;
  try {
    email = normalizeEmail((input as { email?: unknown }).email);
  } catch {
    throw genericResetError();
  }
  const ipHash = hashClientIp(ctx.headers);
  const otp = normalizeOtp((input as { otp?: unknown }).otp);
  // Checked before the OTP is consumed so a weak password never burns a valid code.
  const password = normalizePassword(
    (input as { password?: unknown }).password,
  );

  const recoverable = await withDbTransaction((db) => isRecoverable(db, email));
  if (!recoverable) {
    await audit(email, ipHash, "reset_fail");
    throw genericResetError();
  }

  try {
    await getMerchantAuth().api.resetPasswordEmailOTP({
      body: { email, otp, password },
    });
  } catch (error) {
    await audit(email, ipHash, "reset_fail");
    const code = apiErrorCode(error);
    if (code === "TOO_MANY_ATTEMPTS")
      throw new MerchantRecoveryError(
        400,
        "otp_blocked",
        "El código quedó bloqueado por demasiados intentos. Pedí uno nuevo.",
      );
    if (code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG")
      throw new MerchantRecoveryError(
        400,
        "password_invalid",
        "La contraseña nueva no cumple los requisitos.",
      );
    // INVALID_OTP, OTP_EXPIRED, USER_NOT_FOUND and anything unexpected collapse into
    // one indistinguishable answer.
    throw genericResetError();
  }

  // The password is already changed and the sessions are already gone. A failure to
  // write the audit row must not surface as an error: the user would retry with an
  // OTP that no longer exists and be locked out of a reset that actually succeeded.
  try {
    await audit(email, ipHash, "reset_ok");
  } catch (error) {
    console.error("merchant_recovery_audit_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
  }
  return { ok: true };
}
