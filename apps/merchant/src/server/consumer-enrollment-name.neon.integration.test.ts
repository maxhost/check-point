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
 * The re-enroll leaves the account row untouched (ADR 0051 / spec 0054 — the exact
 * inverse of the spec 0053 criterion these tests asserted before; the inversion is
 * authorized by the ADR 0051, which supersedes the 0050). This is an effect on the
 * DATABASE — a unit test with mocks cannot prove no UPDATE lands — so it runs against
 * a real Neon branch: the whole row (all 13 columns, `updated_at` included) is
 * compared byte for byte before/after a successful re-enroll into a second program,
 * and an enroll rejected with 409 `already_member` leaves it untouched too.
 *
 * Isolated fixtures (own owner, two businesses, one operational program each — the
 * partial unique index allows a single operational program per business) so it can run
 * alongside the base enrollment suite without sharing state.
 */
describe.skipIf(!enabled)(
  "re-enroll leaves the account untouched on Neon",
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

    it("first alta persists the typed name and is not flagged as existing", async () => {
      const { account, existingAccount } = await enroll(programA, {
        firstName: "Cliente iOS 4",
        lastName: "QA",
        phoneE164: phoneExisting,
        countryIso: "EC",
      });
      const stored = await readAccount(phoneExisting);
      expect(stored.firstName).toBe("Cliente iOS 4");
      expect(stored.lastName).toBe("QA");
      expect(stored.id).toBe(account.id);
      expect(existingAccount).toBe(false);
    });

    it("re-enroll with an existing phone → membership created, account byte for byte identical", async () => {
      const before = await readAccount(phoneExisting);

      const { account, membership, existingAccount } = await enroll(programB, {
        // A different name and country on purpose: NOTHING of it may land (ADR 0051 —
        // the typed data is discarded on a reused account; the toast says why).
        firstName: "Logan",
        lastName: "Wolf",
        // Same phone, so `accountByPhone` resolves the account created above.
        phoneE164: phoneExisting,
        countryIso: "AR",
      });

      // The caller is told the account pre-existed — that is ALL that changes for it.
      expect(existingAccount).toBe(true);
      expect(membership.programId).toBe(programB);

      // The value handed back is the STORED row — the 201, the Wallet pass and the
      // portal read off here, so it must carry the saved data, not the typed one.
      expect(account.id).toBe(before.id);
      expect(account.firstName).toBe("Cliente iOS 4");
      expect(account.lastName).toBe("QA");

      // The whole row, compared byte for byte (all 13 columns, `updated_at`
      // included): a successful re-enroll writes NOTHING to the account.
      const after = await readAccount(phoneExisting);
      expect(after).toEqual(before);

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
      // The invariant the owner DID validate of the 0050 era, conserved by the ADR
      // 0051: a rejected operation leaves no effects. Now trivial (no path writes to
      // the account) but still a guard against a regression that reintroduces one.
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
      expect(after.firstName).toBe("Cliente iOS 4");
      expect(after.lastName).toBe("QA");

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
