import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  consumerAccounts,
  consumerSessions,
  enrollAttempts,
  loyaltyPrograms,
  programMemberships,
  users,
} from "./schema";
import { enroll } from "./consumer/enrollment";

/**
 * The re-enroll refreshes the account name (ADR 0050 / spec 0053). This is an effect on
 * the DATABASE — a unit test with mocks cannot prove the UPDATE lands — so it runs
 * against a real Neon branch. It also pins what must NOT move: `phone_e164`,
 * `country_iso`, `qr_token` and `web_view_token` are compared row-by-row before/after,
 * and an enroll rejected with 409 `already_member` leaves the WHOLE row untouched — the
 * refresh only runs once the membership insert succeeded.
 *
 * Isolated fixtures (own owner, two businesses, one operational program each — the
 * partial unique index allows a single operational program per business) so it can run
 * alongside the base enrollment suite without sharing state.
 */
describe.skipIf(!enabled)(
  "re-enroll refreshes the account name on Neon",
  () => {
    const userId = `name-${randomUUID()}`;
    const businessA = randomUUID();
    const businessB = randomUUID();
    const programA = randomUUID();
    const programB = randomUUID();
    // Distinct phones: one exercises the re-enroll, the other the untouched first alta.
    const phoneExisting =
      "+59392" + Math.floor(1000000 + Math.random() * 8999999);
    const phoneFresh = "+59391" + Math.floor(1000000 + Math.random() * 8999999);
    const phones = [phoneExisting, phoneFresh];

    function baseProgram(id: string, businessId: string) {
      return {
        id,
        businessId,
        kind: "points" as const,
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        termsMarkdown: "Términos.",
        termsHash: "hash",
        status: "active" as const,
        createdBy: userId,
      };
    }

    async function readAccount(phone: string) {
      const [row] = await getDb()
        .select()
        .from(consumerAccounts)
        .where(eq(consumerAccounts.phoneE164, phone));
      return row;
    }

    beforeAll(async () => {
      const db = getDb();
      await db.insert(users).values({
        id: userId,
        name: "Owner Name Refresh QA",
        email: `${userId}@example.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await db.insert(businesses).values([
        {
          id: businessA,
          name: "Marca Nombre A",
          countryCode: "EC",
          timezone: "America/Guayaquil",
        },
        {
          id: businessB,
          name: "Marca Nombre B",
          countryCode: "EC",
          timezone: "America/Guayaquil",
        },
      ]);
      await db.insert(loyaltyPrograms).values([
        {
          ...baseProgram(programA, businessA),
          createdAt: new Date(Date.now() - 10_000),
        },
        {
          ...baseProgram(programB, businessB),
          createdAt: new Date(Date.now() - 20_000),
        },
      ]);
    }, 30_000);

    afterAll(async () => {
      const db = getDb();
      const accs = await db
        .select({ id: consumerAccounts.id })
        .from(consumerAccounts)
        .where(inArray(consumerAccounts.phoneE164, phones));
      const accIds = accs.map((a) => a.id);
      if (accIds.length) {
        await db
          .delete(consumerSessions)
          .where(inArray(consumerSessions.consumerId, accIds));
        await db
          .delete(programMemberships)
          .where(inArray(programMemberships.consumerId, accIds));
      }
      await db
        .delete(enrollAttempts)
        .where(inArray(enrollAttempts.phoneE164, phones));
      await db
        .delete(consumerAccounts)
        .where(inArray(consumerAccounts.phoneE164, phones));
      await db
        .delete(loyaltyPrograms)
        .where(inArray(loyaltyPrograms.id, [programA, programB]));
      await db
        .delete(businesses)
        .where(inArray(businesses.id, [businessA, businessB]));
      await db.delete(users).where(eq(users.id, userId));
    }, 30_000);

    it("first alta persists the typed name (the baseline the re-enroll will move)", async () => {
      const { account } = await enroll(programA, {
        firstName: "Cliente iOS 4",
        lastName: "QA",
        phoneE164: phoneExisting,
        countryIso: "EC",
      });
      const stored = await readAccount(phoneExisting);
      expect(stored.firstName).toBe("Cliente iOS 4");
      expect(stored.lastName).toBe("QA");
      expect(stored.id).toBe(account.id);
    });

    it("re-enroll with an existing phone and a different name → the DB keeps the NEW name", async () => {
      const before = await readAccount(phoneExisting);

      const { account } = await enroll(programB, {
        firstName: "Logan",
        lastName: "Wolf",
        // Same phone, so `accountByPhone` resolves the account created above.
        phoneE164: phoneExisting,
        // A different country on purpose: it must NOT be adopted (out of ADR 0050).
        countryIso: "AR",
      });

      // The value handed back is the UPDATED row — the 201, the Wallet pass and the
      // portal read the name off here, so a stale row would resurface the old name.
      expect(account.firstName).toBe("Logan");
      expect(account.lastName).toBe("Wolf");

      const after = await readAccount(phoneExisting);
      expect(after.firstName).toBe("Logan");
      expect(after.lastName).toBe("Wolf");

      // Identity and credentials are byte-identical before/after (spec 0053).
      expect(after.id).toBe(before.id);
      expect(after.phoneE164).toBe(before.phoneE164);
      expect(after.countryIso).toBe(before.countryIso);
      expect(after.countryIso).toBe("EC");
      expect(after.qrToken).toBe(before.qrToken);
      expect(after.webViewToken).toBe(before.webViewToken);
      // Phone verification state is not touched either (tarea 41, out of scope).
      expect(after.phoneVerifiedAt).toBe(before.phoneVerifiedAt);

      // Still one account, now with two memberships.
      const accounts = await getDb()
        .select()
        .from(consumerAccounts)
        .where(eq(consumerAccounts.phoneE164, phoneExisting));
      expect(accounts).toHaveLength(1);
      const memberships = await getDb()
        .select()
        .from(programMemberships)
        .where(eq(programMemberships.consumerId, account.id));
      expect(memberships).toHaveLength(2);
    });

    it("409 already_member: the account row is NOT modified — not the name, not anything", async () => {
      // The criterion born from the owner's correction (ADR 0050 / spec 0053): a
      // rejected operation leaves no effects. The first implementation updated the name
      // and only then hit the duplicate — this test is red against that order.
      const before = await readAccount(phoneExisting);

      await expect(
        enroll(programA, {
          firstName: "Tercer",
          lastName: "Nombre",
          phoneE164: phoneExisting,
          countryIso: "EC",
        }),
      ).rejects.toMatchObject({ status: 409, code: "already_member" });

      const after = await readAccount(phoneExisting);
      // Whole row compared, not just the name: no column moved, `updated_at` included.
      expect(after).toEqual(before);
      expect(after.firstName).toBe("Logan");
      expect(after.lastName).toBe("Wolf");

      // No extra membership was created by the rejected attempt.
      const memberships = await getDb()
        .select()
        .from(programMemberships)
        .where(eq(programMemberships.consumerId, after.id));
      expect(memberships).toHaveLength(2);
    });

    it("a brand-new phone still creates the account exactly as before", async () => {
      const { account, membership } = await enroll(programA, {
        firstName: "Ana",
        lastName: "Gómez",
        phoneE164: phoneFresh,
        countryIso: "EC",
      });
      const stored = await readAccount(phoneFresh);
      expect(stored.firstName).toBe("Ana");
      expect(stored.lastName).toBe("Gómez");
      expect(stored.countryIso).toBe("EC");
      expect(stored.phoneVerifiedAt).toBeNull();
      expect(stored.qrToken).toBeTruthy();
      expect(stored.webViewToken).toBeTruthy();
      expect(stored.qrToken).not.toBe(stored.webViewToken);
      expect(membership.programId).toBe(programA);
      expect(membership.businessId).toBe(businessA);
      expect(account.id).toBe(stored.id);
    });
  },
);
