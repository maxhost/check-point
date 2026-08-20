import { eq, sql } from "drizzle-orm";
import { withDbTransaction } from "../../db";
import { generateOpaqueToken, hashToken } from "../core";
import { consumerAccounts, otpChallenges } from "../../schema";
import {
  decideOtpVerification,
  otpContext,
  verifyOtpHash,
  ONBOARDING_TTL_SECONDS,
  OtpError,
} from "../../otp/core";
import {
  assertEnabled,
  establishRecoveredSession,
  INVALID,
  insertConsumerSession,
  observe,
  secrets,
} from "./internal";

export type VerifyRecoveryResult =
  | { next: "wallet"; sessionToken: string }
  | { next: "profile"; onboardingToken: string };

export async function verifyRecovery(
  raw: unknown,
  now = new Date(),
): Promise<VerifyRecoveryResult> {
  assertEnabled();
  const challengeId =
    typeof (raw as { challengeId?: unknown } | null)?.challengeId === "string"
      ? (raw as { challengeId: string }).challengeId
      : "";
  const code =
    typeof (raw as { code?: unknown } | null)?.code === "string"
      ? (raw as { code: string }).code.trim()
      : "";
  if (!/^\d{6}$/.test(code)) throw INVALID();
  const outcome = await withDbTransaction(async (db) => {
    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, challengeId))
      .limit(1)
      .for("update");
    if (!challenge) return { kind: "invalid" as const };
    const context = otpContext({
      challengeId: challenge.id,
      phoneE164: challenge.phoneE164,
      purpose: "recover_account",
    });
    const matches =
      Boolean(challenge.codeHash) &&
      verifyOtpHash(code, challenge.codeHash!, secrets().hmac, context);
    const decision = decideOtpVerification({
      status: challenge.status as Parameters<
        typeof decideOtpVerification
      >[0]["status"],
      attempts: challenge.verificationAttempts,
      expiresAt: challenge.expiresAt,
      now,
      codeMatches: matches,
    });
    if (decision.kind === "reject") {
      if (challenge.status === "pending")
        await db
          .update(otpChallenges)
          .set({
            status: decision.status,
            verificationAttempts: decision.attempts,
            ...(decision.purge ? { codeHash: null, codeCiphertext: null } : {}),
            updatedAt: now,
          })
          .where(eq(otpChallenges.id, challenge.id));
      observe("verify_failed", {
        challengeId: challenge.id,
        reason: decision.status,
      });
      return { kind: "invalid" as const };
    }
    const [account] = await db
      .select({ id: consumerAccounts.id })
      .from(consumerAccounts)
      .where(eq(consumerAccounts.phoneE164, challenge.phoneE164))
      .limit(1)
      .for("update");
    if (!account) {
      const onboardingToken = generateOpaqueToken();
      const expires = new Date(now.getTime() + ONBOARDING_TTL_SECONDS * 1000);
      await db
        .update(otpChallenges)
        .set({
          status: "verified",
          codeHash: null,
          codeCiphertext: null,
          verifiedAt: now,
          onboardingTokenHash: hashToken(onboardingToken),
          onboardingExpiresAt: expires,
          updatedAt: now,
        })
        .where(eq(otpChallenges.id, challenge.id));
      observe("verify_needs_profile");
      return { kind: "profile" as const, onboardingToken };
    }
    const sessionToken = generateOpaqueToken();
    await db
      .update(otpChallenges)
      .set({
        status: "consumed",
        codeHash: null,
        codeCiphertext: null,
        verifiedAt: now,
        consumedAt: now,
        updatedAt: now,
      })
      .where(eq(otpChallenges.id, challenge.id));
    await establishRecoveredSession(db, account.id, sessionToken, now);
    observe("verify_recovered");
    return { kind: "wallet" as const, sessionToken };
  });
  if (outcome.kind === "invalid") throw INVALID();
  if (outcome.kind === "profile")
    return { next: "profile", onboardingToken: outcome.onboardingToken };
  return { next: "wallet", sessionToken: outcome.sessionToken };
}

function profileName(value: unknown): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 120)
    throw new OtpError(
      400,
      "invalid_profile",
      "Completá tu nombre y apellido.",
    );
  return name;
}

export async function completeRecoveryProfile(
  raw: unknown,
  onboardingToken: string | undefined,
  now = new Date(),
) {
  assertEnabled();
  if (!onboardingToken)
    throw new OtpError(
      401,
      "invalid_onboarding",
      "Volvé a verificar tu teléfono.",
    );
  const body =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const firstName = profileName(body.firstName);
  const lastName = profileName(body.lastName);
  const sessionToken = generateOpaqueToken();
  const qrToken = generateOpaqueToken();
  const webViewToken = generateOpaqueToken();
  const consumerId = await withDbTransaction(async (db) => {
    // Consume the one-time onboarding ticket. The phone AND its verified country come
    // from the challenge — never trusted from the client body.
    const ticket = await db.execute<{
      phone_e164: string;
      country_iso: string;
    }>(
      sql`UPDATE consumer.otp_challenge SET status='consumed', consumed_at=${now}, updated_at=${now}
          WHERE onboarding_token_hash=${hashToken(onboardingToken)} AND status='verified' AND onboarding_expires_at > ${now}
          RETURNING phone_e164, country_iso`,
    );
    const row = ticket.rows[0];
    if (!row)
      throw new OtpError(
        401,
        "invalid_onboarding",
        "Volvé a verificar tu teléfono.",
      );
    // Create the account, or recover the single unique account that appeared
    // concurrently (idempotent alta race) WITHOUT overwriting its existing profile.
    const inserted = await db.execute<{ id: string }>(
      sql`INSERT INTO consumer.consumer_account (phone_e164,phone_verified_at,first_name,last_name,country_iso,qr_token,web_view_token,created_at,updated_at)
          VALUES (${row.phone_e164},${now},${firstName},${lastName},${row.country_iso},${qrToken},${webViewToken},${now},${now})
          ON CONFLICT (phone_e164) DO NOTHING RETURNING id`,
    );
    const freshId = inserted.rows[0]?.id;
    let id = freshId;
    if (!id) {
      const existing = await db.execute<{ id: string }>(
        sql`SELECT id FROM consumer.consumer_account WHERE phone_e164=${row.phone_e164} LIMIT 1`,
      );
      id = existing.rows[0]?.id;
    }
    if (!id)
      throw new OtpError(
        401,
        "invalid_onboarding",
        "Volvé a verificar tu teléfono.",
      );
    // A brand-new account already has its tokens + verified phone from the INSERT and
    // no old sessions/devices/subs — just mint the session. An account that appeared
    // concurrently (alta race) is a real recovery: revoke + rotate + session.
    if (freshId) await insertConsumerSession(db, id, sessionToken, now);
    else await establishRecoveredSession(db, id, sessionToken, now);
    return id;
  });
  observe("profile_completed", { consumerId });
  return { sessionToken };
}
