import { and, eq, gt, sql } from "drizzle-orm";
import { withDbTransaction } from "../../db";
import { otpChallenges, otpDeliveries } from "../../schema";
import {
  decryptOtp,
  encryptOtp,
  generateOtpCode,
  otpHash,
  otpContext,
  OtpError,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  validateRecoveryPhone,
  type OtpChannel,
} from "../../otp/core";
import { otpChannelFromEnv } from "../../otp/provider";
import {
  assertDeliveryQuota,
  assertEnabled,
  DELIVERY_UNAVAILABLE,
  deliverReservation,
  INVALID,
  observe,
  otpProviderName,
  parseClientRequestId,
  secrets,
  type Reservation,
} from "./internal";

const STALE_SENDING_MS = 120_000;

export async function requestRecovery(
  raw: unknown,
  channel?: OtpChannel,
  now = new Date(),
) {
  assertEnabled();
  const deliveryChannel = channel ?? otpChannelFromEnv();
  const body =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const input = validateRecoveryPhone(body.phoneE164, body.countryIso);
  const requestId = parseClientRequestId(
    body.clientRequestId ?? crypto.randomUUID(),
  );
  const code = generateOtpCode();
  const { hmac, encryption } = secrets();
  const result: Reservation = await withDbTransaction(async (db) => {
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.phoneE164}, 0))`,
    );
    await db.execute(
      sql`UPDATE consumer.otp_delivery SET status='unknown',last_error='stale_sending',updated_at=${now} WHERE phone_e164=${input.phoneE164} AND status='sending' AND reserved_at < ${new Date(now.getTime() - STALE_SENDING_MS)}`,
    );
    // Idempotent replay ONLY when the prior request's challenge is still usable. A key
    // whose challenge died (failed send / expiry) is treated as a fresh request; the
    // partial unique index has already released it so the new insert cannot collide.
    const retry = await db.execute<{
      delivery_id: string;
      challenge_id: string;
      expires_at: Date;
    }>(
      sql`SELECT d.id delivery_id,d.challenge_id,c.expires_at FROM consumer.otp_delivery d JOIN consumer.otp_challenge c ON c.id=d.challenge_id WHERE d.phone_e164=${input.phoneE164} AND d.client_request_id=${requestId} AND c.status='pending' AND c.expires_at > ${now} LIMIT 1`,
    );
    if (retry.rows[0])
      return {
        deliveryId: retry.rows[0].delivery_id,
        challengeId: retry.rows[0].challenge_id,
        phoneE164: input.phoneE164,
        countryIso: input.countryIso,
        locale: input.locale,
        code: "",
        expiresAt: retry.rows[0].expires_at,
        kind: "initial",
        idempotent: true,
      };
    try {
      await assertDeliveryQuota(db, input.phoneE164, now);
    } catch (error) {
      observe("request_rate_limited");
      throw error;
    }
    await db
      .update(otpChallenges)
      .set({
        status: "invalidated",
        codeHash: null,
        codeCiphertext: null,
        updatedAt: now,
      })
      .where(
        and(
          eq(otpChallenges.phoneE164, input.phoneE164),
          eq(otpChallenges.status, "pending"),
        ),
      );
    const challengeId = crypto.randomUUID();
    const [active] = await db
      .insert(otpChallenges)
      .values({
        id: challengeId,
        phoneE164: input.phoneE164,
        countryIso: input.countryIso,
        codeHash: otpHash(
          code,
          hmac,
          otpContext({
            challengeId,
            phoneE164: input.phoneE164,
            purpose: "recover_account",
          }),
        ),
        codeCiphertext: encryptOtp(code, encryption),
        resendAvailableAt: new Date(now.getTime() + OTP_RESEND_SECONDS * 1000),
        expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!active) throw DELIVERY_UNAVAILABLE();
    const [delivery] = await db
      .insert(otpDeliveries)
      .values({
        challengeId: active.id,
        phoneE164: input.phoneE164,
        clientRequestId: requestId,
        kind: "initial",
        status: "sending",
        provider: otpProviderName(),
        locale: input.locale,
        reservedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!delivery) throw DELIVERY_UNAVAILABLE();
    return {
      deliveryId: delivery.id,
      challengeId: active.id,
      phoneE164: input.phoneE164,
      countryIso: input.countryIso,
      locale: input.locale,
      code,
      expiresAt: active.expiresAt,
      kind: "initial",
    };
  });
  if (!result.idempotent) await deliverReservation(result, deliveryChannel);
  return {
    challengeId: result.challengeId,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_RESEND_SECONDS,
  };
}

export async function resendRecovery(
  raw: unknown,
  channel?: OtpChannel,
  now = new Date(),
) {
  assertEnabled();
  const deliveryChannel = channel ?? otpChannelFromEnv();
  const body =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const requestId = parseClientRequestId(
    body.clientRequestId ?? crypto.randomUUID(),
  );
  const challengeId =
    typeof body.challengeId === "string" ? body.challengeId : "";
  const result: Reservation = await withDbTransaction(async (db) => {
    const [first] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId))
      .limit(1);
    if (!first) throw INVALID();
    await db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${first.phoneE164}, 0))`,
    );
    await db.execute(
      sql`UPDATE consumer.otp_delivery SET status='unknown',last_error='stale_sending',updated_at=${now} WHERE phone_e164=${first.phoneE164} AND status='sending' AND reserved_at < ${new Date(now.getTime() - STALE_SENDING_MS)}`,
    );
    // Replay only against a live challenge (same rule as requestRecovery).
    const retry = await db.execute<{ delivery_id: string; expires_at: Date }>(
      sql`SELECT d.id delivery_id,c.expires_at FROM consumer.otp_delivery d JOIN consumer.otp_challenge c ON c.id=d.challenge_id WHERE d.phone_e164=${first.phoneE164} AND d.client_request_id=${requestId} AND c.status='pending' AND c.expires_at > ${now} LIMIT 1`,
    );
    if (retry.rows[0])
      return {
        deliveryId: retry.rows[0].delivery_id,
        challengeId,
        phoneE164: first.phoneE164,
        countryIso: first.countryIso,
        locale: validateRecoveryPhone(first.phoneE164, first.countryIso).locale,
        code: "",
        expiresAt: retry.rows[0].expires_at,
        kind: "resend",
        idempotent: true,
      };
    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.id, challengeId),
          eq(otpChallenges.status, "pending"),
          gt(otpChallenges.expiresAt, now),
        ),
      )
      .limit(1);
    if (!challenge) throw INVALID();
    if (challenge.deliveryCount >= 2)
      throw new OtpError(
        409,
        "otp_resend_exhausted",
        "Ya reenviamos el código. Contacta con soporte si no llegó.",
      );
    if (challenge.resendAvailableAt > now)
      throw new OtpError(
        429,
        "otp_resend_too_soon",
        "Esperá antes de reenviar el código.",
      );
    await assertDeliveryQuota(db, challenge.phoneE164, now);
    if (!challenge.codeCiphertext) throw INVALID();
    const code = decryptOtp(challenge.codeCiphertext, secrets().encryption);
    const locale = validateRecoveryPhone(
      challenge.phoneE164,
      challenge.countryIso,
    ).locale;
    const [delivery] = await db
      .insert(otpDeliveries)
      .values({
        challengeId,
        phoneE164: challenge.phoneE164,
        clientRequestId: requestId,
        kind: "resend",
        status: "sending",
        provider: otpProviderName(),
        locale,
        reservedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!delivery) throw DELIVERY_UNAVAILABLE();
    return {
      deliveryId: delivery.id,
      challengeId,
      phoneE164: challenge.phoneE164,
      countryIso: challenge.countryIso,
      locale,
      code,
      expiresAt: challenge.expiresAt,
      kind: "resend",
    };
  });
  if (!result.idempotent) await deliverReservation(result, deliveryChannel);
  return {
    expiresInSeconds: Math.max(
      0,
      Math.ceil((result.expiresAt.getTime() - now.getTime()) / 1000),
    ),
  };
}
