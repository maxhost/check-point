import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Independent from the base recovery integration file to stay within the file-size
// budget (same "divide, don't extend" pattern as the enrollment-attribution split).
const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled && url) process.env.DATABASE_URL = url;

import { requestRecovery, resendRecovery, verifyRecovery } from "./consumer/recovery";
import { getDb } from "./db";
import { FakeOtpChannel } from "./otp/fake";
import { OtpProviderError } from "./otp/core";
import { consumerAccounts, otpChallenges } from "./schema";

const phones = ["+59377", "+59376"].map(
  (prefix) => `${prefix}${Math.floor(1_000_000 + Math.random() * 8_000_000)}`,
);

describe.skipIf(!enabled)(
  "consumer recovery failure paths against Neon (spec 0032)",
  () => {
    beforeAll(() => {
      process.env.RECOVERY_ENABLED = "true";
      process.env.OTP_HMAC_SECRET = "integration-hmac-secret-at-least-32-bytes";
      process.env.OTP_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    });

    afterAll(async () => {
      await getDb()
        .delete(otpChallenges)
        .where(inArray(otpChallenges.phoneE164, phones));
      await getDb()
        .delete(consumerAccounts)
        .where(inArray(consumerAccounts.phoneE164, phones));
    }, 30_000);

    // Fix #1: a failed INITIAL send invalidates the challenge; the idempotency key is
    // released (partial unique index) so an explicit retry with the SAME clientRequestId
    // does NOT replay the dead challenge — it sends anew and yields a verifiable one.
    it("failed initial send frees the idempotency key so a same-key retry issues a fresh, verifiable challenge", async () => {
      const phone = phones[0]!;
      const clientRequestId = `retry_${crypto.randomUUID()}`;
      await expect(
        requestRecovery(
          { phoneE164: phone, countryIso: "EC", clientRequestId },
          {
            deliverOtp: async () => {
              throw new OtpProviderError("clicksend", "rejected");
            },
          },
        ),
      ).rejects.toMatchObject({ code: "otp_delivery_unavailable" });
      expect(
        await getDb()
          .select()
          .from(otpChallenges)
          .where(
            and(
              eq(otpChallenges.phoneE164, phone),
              eq(otpChallenges.status, "pending"),
            ),
          ),
      ).toHaveLength(0);

      const fake = new FakeOtpChannel();
      const retried = await requestRecovery(
        { phoneE164: phone, countryIso: "EC", clientRequestId },
        fake,
      );
      expect(fake.deliveries).toHaveLength(1);
      const verified = await verifyRecovery({
        challengeId: retried.challengeId,
        code: fake.deliveries[0]!.code,
      });
      expect(verified.next).toBe("profile");
    }, 30_000);

    // Fix #2: a failed RESEND must NOT invalidate the challenge — the initial code the
    // consumer may already hold stays valid and still verifies.
    it("a failed resend keeps the still-valid initial code usable", async () => {
      const phone = phones[1]!;
      const fake = new FakeOtpChannel();
      const requested = await requestRecovery(
        { phoneE164: phone, countryIso: "EC" },
        fake,
      );
      const initialCode = fake.deliveries[0]!.code;
      await expect(
        resendRecovery(
          { challengeId: requested.challengeId },
          {
            deliverOtp: async () => {
              throw new OtpProviderError("twilio", "rejected");
            },
          },
          new Date(Date.now() + 61_000),
        ),
      ).rejects.toMatchObject({ code: "otp_delivery_unavailable" });
      const [challenge] = await getDb()
        .select()
        .from(otpChallenges)
        .where(eq(otpChallenges.id, requested.challengeId));
      expect(challenge!.status).toBe("pending");
      const verified = await verifyRecovery({
        challengeId: requested.challengeId,
        code: initialCode,
      });
      expect(verified.next).toBe("profile");
    }, 30_000);
  },
);
