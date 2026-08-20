import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import {
  completeRecoveryProfile,
  requestRecovery,
  resendRecovery,
  verifyRecovery,
} from "./consumer/recovery";
import { generateOpaqueToken, hashToken } from "./consumer/core";
import { getDb } from "./db";
import { FakeOtpChannel } from "./otp/fake";
import { OtpProviderError } from "./otp/core";
import {
  consumerAccounts,
  consumerSessions,
  otpChallenges,
  otpDeliveries,
  programMemberships,
  walletPasses,
  walletPushDevices,
  walletPushQueue,
  webPushSubscriptions,
} from "./schema";

const phones = [
  "+59395",
  "+59396",
  "+59397",
  "+59394",
  "+59393",
  "+59392",
  "+59391",
  "+59390",
  "+59389",
  "+59388",
].map(
  (prefix) => `${prefix}${Math.floor(1_000_000 + Math.random() * 8_000_000)}`,
);
const accountIds: string[] = [];

describe.skipIf(!enabled)("consumer recovery against Neon (spec 0032)", () => {
  beforeAll(() => {
    process.env.RECOVERY_ENABLED = "true";
    process.env.OTP_HMAC_SECRET = "integration-hmac-secret-at-least-32-bytes";
    process.env.OTP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  });

  afterAll(async () => {
    const db = getDb();
    if (accountIds.length) {
      await db
        .delete(walletPushQueue)
        .where(inArray(walletPushQueue.consumerId, accountIds));
      await db
        .delete(consumerAccounts)
        .where(inArray(consumerAccounts.id, accountIds));
    }
    await db
      .delete(otpChallenges)
      .where(inArray(otpChallenges.phoneE164, phones));
  }, 30_000);

  it("existing account: same-code resend, concurrent single consume, revocation and rotation are atomic", async () => {
    const [account] = await getDb()
      .insert(consumerAccounts)
      .values({
        phoneE164: phones[0]!,
        firstName: "Ana",
        lastName: "Prueba",
        countryIso: "EC",
        qrToken: generateOpaqueToken(),
        webViewToken: generateOpaqueToken(),
      })
      .returning();
    accountIds.push(account!.id);
    const oldSession = generateOpaqueToken();
    await getDb()
      .insert(consumerSessions)
      .values({
        consumerId: account!.id,
        tokenHash: hashToken(oldSession),
        expiresAt: new Date(Date.now() + 86_400_000),
      });
    const [pass] = await getDb()
      .insert(walletPasses)
      .values({
        consumerId: account!.id,
        provider: "apple",
        serialNumber: `recover-${account!.id}`,
        authToken: generateOpaqueToken(),
      })
      .returning();
    await getDb().insert(walletPushDevices).values({
      walletPassId: pass!.id,
      deviceLibraryId: "old-device",
      pushToken: "old-push",
    });
    await getDb()
      .insert(webPushSubscriptions)
      .values({
        consumerId: account!.id,
        endpoint: `https://push.invalid/${account!.id}`,
        p256dhKey: "old-p256dh",
        authKey: "old-auth",
      });

    const fake = new FakeOtpChannel();
    const requested = await requestRecovery(
      { phoneE164: phones[0], countryIso: "EC" },
      fake,
    );
    const firstCode = fake.deliveries[0]!.code;
    await resendRecovery(
      { challengeId: requested.challengeId },
      fake,
      new Date(Date.now() + 61_000),
    );
    expect(fake.deliveries[1]!.code).toBe(firstCode);

    const settled = await Promise.allSettled([
      verifyRecovery({ challengeId: requested.challengeId, code: firstCode }),
      verifyRecovery({ challengeId: requested.challengeId, code: firstCode }),
    ]);
    expect(
      settled.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const [after] = await getDb()
      .select()
      .from(consumerAccounts)
      .where(eq(consumerAccounts.id, account!.id));
    expect(after!.phoneVerifiedAt).not.toBeNull();
    expect(after!.qrToken).not.toBe(account!.qrToken);
    expect(after!.webViewToken).not.toBe(account!.webViewToken);
    expect(
      await getDb()
        .select()
        .from(walletPushDevices)
        .where(eq(walletPushDevices.walletPassId, pass!.id)),
    ).toHaveLength(0);
    expect(
      await getDb()
        .select()
        .from(webPushSubscriptions)
        .where(eq(webPushSubscriptions.consumerId, account!.id)),
    ).toHaveLength(0);
    expect(
      await getDb()
        .select()
        .from(walletPushQueue)
        .where(eq(walletPushQueue.consumerId, account!.id)),
    ).toHaveLength(1);
    const sessions = await getDb()
      .select()
      .from(consumerSessions)
      .where(eq(consumerSessions.consumerId, account!.id));
    expect(
      sessions.filter((session) => session.revokedAt === null),
    ).toHaveLength(1);
  }, 30_000);

  it("unknown number verifies, consumes one-time onboarding and creates no membership", async () => {
    const fake = new FakeOtpChannel();
    const requested = await requestRecovery(
      { phoneE164: phones[1], countryIso: "EC" },
      fake,
    );
    const verified = await verifyRecovery({
      challengeId: requested.challengeId,
      code: fake.deliveries[0]!.code,
    });
    expect(verified.next).toBe("profile");
    if (verified.next !== "profile") throw new Error("profile expected");
    await completeRecoveryProfile(
      { firstName: "Nuevo", lastName: "Cliente", countryIso: "EC" },
      verified.onboardingToken,
    );
    const [account] = await getDb()
      .select()
      .from(consumerAccounts)
      .where(eq(consumerAccounts.phoneE164, phones[1]!));
    accountIds.push(account!.id);
    expect(account!.phoneVerifiedAt).not.toBeNull();
    expect(
      await getDb()
        .select()
        .from(programMemberships)
        .where(eq(programMemberships.consumerId, account!.id)),
    ).toHaveLength(0);
    await expect(
      completeRecoveryProfile(
        { firstName: "Otro", lastName: "Nombre", countryIso: "EC" },
        verified.onboardingToken,
      ),
    ).rejects.toMatchObject({ code: "invalid_onboarding" });
  }, 30_000);

  it("serializes concurrent resend and persistent delivery quota", async () => {
    const fake = new FakeOtpChannel();
    const requested = await requestRecovery(
      { phoneE164: phones[2], countryIso: "EC" },
      fake,
    );
    const results = await Promise.allSettled([
      resendRecovery(
        { challengeId: requested.challengeId },
        fake,
        new Date(Date.now() + 61_000),
      ),
      resendRecovery(
        { challengeId: requested.challengeId },
        fake,
        new Date(Date.now() + 61_000),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(fake.deliveries).toHaveLength(2);
    const deliveries = await getDb()
      .select()
      .from(otpDeliveries)
      .where(eq(otpDeliveries.phoneE164, phones[2]!));
    expect(deliveries).toHaveLength(2);

    const retryPhone = phones[3]!;
    const clientRequestId = `retry_${crypto.randomUUID()}`;
    const retryFake = new FakeOtpChannel();
    const firstResponse = await requestRecovery(
      { phoneE164: retryPhone, countryIso: "EC", clientRequestId },
      retryFake,
    );
    const retryResponse = await requestRecovery(
      { phoneE164: retryPhone, countryIso: "EC", clientRequestId },
      retryFake,
    );
    expect(retryResponse.challengeId).toBe(firstResponse.challengeId);
    expect(retryFake.deliveries).toHaveLength(1);
  }, 30_000);

  it("invalid OTP locks on the second attempt and expiration is indistinguishable", async () => {
    const fake = new FakeOtpChannel();
    const requested = await requestRecovery(
      { phoneE164: phones[3], countryIso: "EC" },
      fake,
    );
    for (let attempt = 0; attempt < 2; attempt += 1)
      await expect(
        verifyRecovery({ challengeId: requested.challengeId, code: "000000" }),
      ).rejects.toMatchObject({ code: "invalid_or_expired_otp" });
    const [locked] = await getDb()
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, requested.challengeId));
    expect(locked).toMatchObject({ status: "locked", verificationAttempts: 2 });
    await expect(
      verifyRecovery({
        challengeId: requested.challengeId,
        code: fake.deliveries[0]!.code,
      }),
    ).rejects.toMatchObject({ code: "invalid_or_expired_otp" });

    const expired = await requestRecovery(
      { phoneE164: phones[4], countryIso: "EC" },
      fake,
    );
    await expect(
      verifyRecovery(
        {
          challengeId: expired.challengeId,
          code: fake.deliveries.at(-1)!.code,
        },
        new Date(Date.now() + 301_000),
      ),
    ).rejects.toMatchObject({ code: "invalid_or_expired_otp" });
  }, 30_000);

  it("new/concurrent requests leave one usable challenge; resend enforces timing and max two deliveries", async () => {
    const fake = new FakeOtpChannel();
    const first = await requestRecovery(
      { phoneE164: phones[5], countryIso: "EC" },
      fake,
    );
    await expect(
      resendRecovery({ challengeId: first.challengeId }, fake),
    ).rejects.toMatchObject({
      code: "otp_resend_too_soon",
    });
    const second = await requestRecovery(
      { phoneE164: phones[5], countryIso: "EC" },
      fake,
    );
    await expect(
      verifyRecovery({
        challengeId: first.challengeId,
        code: fake.deliveries[0]!.code,
      }),
    ).rejects.toMatchObject({ code: "invalid_or_expired_otp" });
    await resendRecovery(
      { challengeId: second.challengeId },
      fake,
      new Date(Date.now() + 61_000),
    );
    await expect(
      resendRecovery(
        { challengeId: second.challengeId },
        fake,
        new Date(Date.now() + 62_000),
      ),
    ).rejects.toMatchObject({ code: "otp_resend_exhausted" });

    const concurrent = await Promise.allSettled([
      requestRecovery({ phoneE164: phones[6], countryIso: "EC" }, fake),
      requestRecovery({ phoneE164: phones[6], countryIso: "EC" }, fake),
    ]);
    expect(
      concurrent.filter((item) => item.status === "fulfilled"),
    ).toHaveLength(2);
    const pending = await getDb()
      .select()
      .from(otpChallenges)
      .where(
        and(
          eq(otpChallenges.phoneE164, phones[6]!),
          eq(otpChallenges.status, "pending"),
        ),
      );
    expect(pending).toHaveLength(1);
  }, 30_000);

  it("enforces 3/hour persistently and records definitive/uncertain provider outcomes", async () => {
    const fake = new FakeOtpChannel();
    for (let count = 0; count < 3; count += 1)
      await requestRecovery({ phoneE164: phones[7], countryIso: "EC" }, fake);
    await expect(
      requestRecovery({ phoneE164: phones[7], countryIso: "EC" }, fake),
    ).rejects.toMatchObject({ code: "otp_rate_limited" });

    const failing = {
      deliverOtp: async () => {
        throw new Error("provider unavailable with secret=must-not-leak");
      },
    };
    await expect(
      requestRecovery({ phoneE164: phones[4], countryIso: "EC" }, failing),
    ).rejects.toMatchObject({ code: "otp_delivery_unavailable" });
    expect(
      await getDb()
        .select()
        .from(otpChallenges)
        .where(
          and(
            eq(otpChallenges.phoneE164, phones[4]!),
            eq(otpChallenges.status, "pending"),
          ),
        ),
    ).toHaveLength(0);
    const failedRows = await getDb()
      .select()
      .from(otpDeliveries)
      .where(eq(otpDeliveries.phoneE164, phones[4]!));
    expect(failedRows.at(-1)?.status).toBe("failed");

    const uncertainPhone = phones[9]!;
    await expect(
      requestRecovery(
        { phoneE164: uncertainPhone, countryIso: "EC" },
        {
          deliverOtp: async () => {
            throw new OtpProviderError("clicksend", "timeout");
          },
        },
      ),
    ).rejects.toMatchObject({ code: "otp_delivery_unavailable" });
    const uncertainRows = await getDb()
      .select()
      .from(otpDeliveries)
      .where(eq(otpDeliveries.phoneE164, uncertainPhone));
    expect(uncertainRows.at(-1)?.status).toBe("unknown");
  }, 30_000);

  it("enforces five accepted deliveries in a rolling 24 hours independently of the hourly window", async () => {
    const fake = new FakeOtpChannel();
    for (let count = 0; count < 5; count += 1) {
      const requested = await requestRecovery(
        { phoneE164: phones[8], countryIso: "EC" },
        fake,
      );
      // Spread the deliveries across the 24h window by backdating `reserved_at` — the
      // column the quota counts. (Backdating only `accepted_at` left all five in the
      // same hour and tripped the 3/hour limit inside the loop.)
      const backdated = new Date(Date.now() - (count + 2) * 3_600_000);
      await getDb()
        .update(otpDeliveries)
        .set({ reservedAt: backdated, acceptedAt: backdated })
        .where(eq(otpDeliveries.challengeId, requested.challengeId));
    }
    await expect(
      requestRecovery({ phoneE164: phones[8], countryIso: "EC" }, fake),
    ).rejects.toMatchObject({ code: "otp_rate_limited" });
  }, 30_000);

  it("onboarding collision recovers the account that appeared without overwriting its profile", async () => {
    const fake = new FakeOtpChannel();
    const requested = await requestRecovery(
      { phoneE164: phones[9], countryIso: "EC" },
      fake,
    );
    const verified = await verifyRecovery({
      challengeId: requested.challengeId,
      code: fake.deliveries[0]!.code,
    });
    expect(verified.next).toBe("profile");
    if (verified.next !== "profile") throw new Error("profile expected");
    const [racingAccount] = await getDb()
      .insert(consumerAccounts)
      .values({
        phoneE164: phones[9]!,
        firstName: "Perfil",
        lastName: "Existente",
        countryIso: "EC",
        qrToken: generateOpaqueToken(),
        webViewToken: generateOpaqueToken(),
      })
      .returning();
    accountIds.push(racingAccount!.id);
    await completeRecoveryProfile(
      { firstName: "No", lastName: "Sobrescribir", countryIso: "US" },
      verified.onboardingToken,
    );
    const [after] = await getDb()
      .select()
      .from(consumerAccounts)
      .where(eq(consumerAccounts.id, racingAccount!.id));
    expect(after).toMatchObject({
      firstName: "Perfil",
      lastName: "Existente",
      countryIso: "EC",
    });
    expect(after!.phoneVerifiedAt).not.toBeNull();
  }, 30_000);
});
