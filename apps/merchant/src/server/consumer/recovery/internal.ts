import { sql } from "drizzle-orm";
import { withDbTransaction, type DbTransaction } from "../../db";
import { hashToken, SESSION_TTL_DAYS } from "../core";
import { OtpError, OtpProviderError, type OtpChannel } from "../../otp/core";
import { rotatePassCredentials } from "../../wallet/rotate";

export const INVALID = () =>
  new OtpError(
    400,
    "invalid_or_expired_otp",
    "El código no es válido o venció.",
  );
export const DELIVERY_UNAVAILABLE = () =>
  new OtpError(
    503,
    "otp_delivery_unavailable",
    "No pudimos enviar el código. Intentá nuevamente.",
  );
export const RATE_LIMITED = () =>
  new OtpError(
    429,
    "otp_rate_limited",
    "Alcanzaste el límite de envíos. Contacta con soporte.",
  );

export type RecoveryEvent =
  | "request_accepted"
  | "request_failed"
  | "request_rate_limited"
  | "resend_accepted"
  | "resend_failed"
  | "verify_failed"
  | "verify_recovered"
  | "verify_needs_profile"
  | "profile_completed"
  | "profile_failed";

/** Structured operational event. Deliberately excludes phone, code, tokens and secrets. */
export function observe(
  event: RecoveryEvent,
  fields: Record<string, unknown> = {},
) {
  console.info("consumer_recovery", { event, ...fields });
}

export function secrets() {
  const hmac = process.env.OTP_HMAC_SECRET ?? "";
  const encryption = process.env.OTP_ENCRYPTION_KEY ?? "";
  if (Buffer.byteLength(hmac, "utf8") < 32 || !encryption)
    throw new Error("Los secretos OTP no están configurados.");
  return { hmac, encryption };
}

export function assertEnabled() {
  if (process.env.RECOVERY_ENABLED !== "true")
    throw new OtpError(
      503,
      "recovery_disabled",
      "La recuperación no está disponible.",
    );
}

export function parseClientRequestId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(value))
    throw new OtpError(
      400,
      "invalid_recovery_input",
      "La solicitud no es válida.",
    );
  return value;
}

export type RecoveryExecutor = DbTransaction;

export function otpProviderName(): "clicksend" | "twilio" {
  return process.env.OTP_PROVIDER === "twilio" ? "twilio" : "clicksend";
}

export async function assertDeliveryQuota(
  db: RecoveryExecutor,
  phoneE164: string,
  now: Date,
) {
  const hour = new Date(now.getTime() - 60 * 60 * 1000);
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rows = await db.execute<{
    hour_count: number;
    day_count: number;
  }>(sql`
    SELECT count(*) FILTER (WHERE reserved_at >= ${hour})::int AS hour_count,
           count(*) FILTER (WHERE reserved_at >= ${day})::int AS day_count
    FROM consumer.otp_delivery WHERE phone_e164 = ${phoneE164}
      AND status in ('sending','accepted','unknown')`);
  const count = rows.rows[0];
  if ((count?.hour_count ?? 0) >= 3 || (count?.day_count ?? 0) >= 5)
    throw RATE_LIMITED();
}

export type Reservation = {
  deliveryId: string;
  challengeId: string;
  phoneE164: string;
  countryIso: string;
  locale: "es" | "pt" | "en";
  code: string;
  expiresAt: Date;
  kind: "initial" | "resend";
  idempotent?: boolean;
};

/**
 * Sends the SMS OUTSIDE the reserving transaction (never send before persisting the
 * hashed+encrypted code). On success, finalizes the delivery and bumps delivery_count.
 * On failure, marks the delivery `failed`/`unknown`; and ONLY when this is the INITIAL
 * send does it invalidate the challenge — a failed RESEND must not destroy the still-valid
 * initial code the consumer may already hold (spec 0032: one resend of the SAME code).
 */
export async function deliverReservation(
  reservation: Reservation,
  channel: OtpChannel,
) {
  const started = Date.now();
  try {
    const receipt = await channel.deliverOtp({
      phoneE164: reservation.phoneE164,
      countryIso: reservation.countryIso,
      code: reservation.code,
      locale: reservation.locale,
      purpose: "recover_account",
    });
    await withDbTransaction(async (db) => {
      await db.execute(sql`WITH finalized AS (
        UPDATE consumer.otp_delivery SET status='accepted', provider_message_id=${receipt.providerMessageId}, accepted_at=${receipt.acceptedAt}, updated_at=${receipt.acceptedAt}
        WHERE id=${reservation.deliveryId} AND status='sending' RETURNING challenge_id
      ) UPDATE consumer.otp_challenge SET delivery_count=delivery_count+1, updated_at=${receipt.acceptedAt}
        WHERE id IN (SELECT challenge_id FROM finalized) AND status='pending'`);
    });
    observe(reservation.kind === "resend" ? "resend_accepted" : "request_accepted", {
      challengeId: reservation.challengeId,
      provider: receipt.provider,
      latencyMs: Date.now() - started,
      countryIso: reservation.countryIso,
      locale: reservation.locale,
    });
  } catch (error) {
    const status =
      error instanceof OtpProviderError && error.reason === "timeout"
        ? "unknown"
        : "failed";
    const finished = new Date();
    await withDbTransaction(async (db) => {
      await db.execute(
        sql`UPDATE consumer.otp_delivery SET status=${status}, failed_at=${finished}, last_error=${error instanceof OtpProviderError ? error.reason : "provider_error"}, updated_at=${finished} WHERE id=${reservation.deliveryId} AND status='sending'`,
      );
      // A failed INITIAL send leaves no usable code, so retire the challenge. A failed
      // RESEND leaves the initial code intact — keep the challenge pending.
      if (reservation.kind === "initial")
        await db.execute(
          sql`UPDATE consumer.otp_challenge SET status='invalidated', code_hash=NULL, code_ciphertext=NULL, updated_at=${finished} WHERE id=${reservation.challengeId} AND status='pending'`,
        );
    });
    observe(reservation.kind === "resend" ? "resend_failed" : "request_failed", {
      challengeId: reservation.challengeId,
      providerResult: status,
      latencyMs: Date.now() - started,
    });
    throw DELIVERY_UNAVAILABLE();
  }
}

/**
 * Shared tail of every successful recovery into an EXISTING (or just-created) account:
 * mark the phone verified, revoke all live sessions, rotate the pass credentials
 * (`rotatePassCredentials` also wipes push devices + Web Push subs and enqueues a
 * re-emission — a single source of truth, spec 0032/0037), then mint the new session.
 * Runs inside the caller's interactive transaction so it is atomic with the challenge
 * state change.
 */
export async function establishRecoveredSession(
  db: RecoveryExecutor,
  consumerId: string,
  sessionToken: string,
  now: Date,
) {
  const expires = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);
  await db.execute(
    sql`UPDATE consumer.consumer_account SET phone_verified_at=coalesce(phone_verified_at,${now}), updated_at=${now} WHERE id=${consumerId}`,
  );
  await db.execute(
    sql`UPDATE consumer.consumer_session SET revoked_at=${now} WHERE consumer_id=${consumerId} AND revoked_at IS NULL`,
  );
  await rotatePassCredentials(consumerId, db);
  await db.execute(
    sql`INSERT INTO consumer.consumer_session (consumer_id,token_hash,expires_at,created_at) VALUES (${consumerId},${hashToken(sessionToken)},${expires},${now})`,
  );
}
