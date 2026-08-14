import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
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
import { RATE_LIMIT_MAX, enforceEnrollRateLimit } from "./consumer/rate-limit";
import { issueSession, resolveSession } from "./consumer/session";

function baseProgram(id: string, businessId: string) {
  return {
    id,
    businessId,
    kind: "points" as const,
    configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
    termsMarkdown: "Términos.",
    termsHash: "hash",
  };
}

describe.skipIf(!enabled)("consumer enrollment against Neon", () => {
  const userId = `int-${randomUUID()}`;
  // Two businesses: the partial unique index allows only ONE operational
  // program per business, so `active` and `closing` must live in different ones.
  const businessA = randomUUID();
  const businessB = randomUUID();
  const programActive = randomUUID();
  const programInactive = randomUUID();
  const programClosing = randomUUID();
  // Distinct phones keep each behavior isolated (attempts are per-phone).
  const phoneMain = "+59398" + Math.floor(1000000 + Math.random() * 8999999);
  const phoneRate = "+59397" + Math.floor(1000000 + Math.random() * 8999999);
  const phoneOther = "+59396" + Math.floor(1000000 + Math.random() * 8999999);
  const phones = [phoneMain, phoneRate, phoneOther];

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Consumer QA",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values([
      {
        id: businessA,
        name: "La Gringa",
        countryCode: "EC",
        timezone: "America/Guayaquil",
      },
      {
        id: businessB,
        name: "Cervecería Cuervo",
        countryCode: "EC",
        timezone: "America/Guayaquil",
      },
    ]);
    // Distinct createdAt per program in the same business: `core.loyalty_program`
    // has a unique on (business_id, created_at), so the two businessA programs
    // (active + inactive) must not share a timestamp.
    await db.insert(loyaltyPrograms).values([
      {
        ...baseProgram(programActive, businessA),
        status: "active",
        createdBy: userId,
        createdAt: new Date(Date.now() - 10_000),
      },
      {
        ...baseProgram(programInactive, businessA),
        status: "inactive",
        createdBy: userId,
        createdAt: new Date(Date.now() - 20_000),
      },
      {
        ...baseProgram(programClosing, businessB),
        status: "closing",
        createdBy: userId,
        earningEndsAt: new Date(Date.now() + 2 * 86_400_000),
        redemptionEndsAt: new Date(Date.now() + 7 * 86_400_000),
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
      .where(
        inArray(loyaltyPrograms.id, [
          programActive,
          programInactive,
          programClosing,
        ]),
      );
    await db
      .delete(businesses)
      .where(inArray(businesses.id, [businessA, businessB]));
    await db.delete(users).where(eq(users.id, userId));
  }, 30_000);

  it("enrolls into an active program: creates one unverified account + a membership", async () => {
    const { account, membership } = await enroll(programActive, {
      firstName: "Marcos",
      lastName: "Pérez",
      phoneE164: phoneMain,
    });
    expect(account.phoneVerifiedAt).toBeNull();
    expect(account.qrToken).toBeTruthy();
    expect(membership.businessId).toBe(businessA);
    expect(membership.programId).toBe(programActive);
  });

  it("reuses the same account across a second program: 1 account / 2 memberships", async () => {
    const { account } = await enroll(programClosing, {
      // Different form data must NOT overwrite the reused profile.
      firstName: "OTRO",
      lastName: "NOMBRE",
      phoneE164: phoneMain,
    });
    expect(account.firstName).toBe("Marcos");
    expect(account.lastName).toBe("Pérez");
    const accounts = await getDb()
      .select()
      .from(consumerAccounts)
      .where(eq(consumerAccounts.phoneE164, phoneMain));
    expect(accounts).toHaveLength(1);
    const memberships = await getDb()
      .select()
      .from(programMemberships)
      .where(eq(programMemberships.consumerId, account.id));
    expect(memberships).toHaveLength(2);
  });

  it("enrolls into a closing program (closing still admits enrollment)", async () => {
    // Covered by the reuse test above (programClosing). Assert the membership landed.
    const [acc] = await getDb()
      .select()
      .from(consumerAccounts)
      .where(eq(consumerAccounts.phoneE164, phoneMain));
    const closing = await getDb()
      .select()
      .from(programMemberships)
      .where(
        and(
          eq(programMemberships.consumerId, acc.id),
          eq(programMemberships.programId, programClosing),
        ),
      );
    expect(closing).toHaveLength(1);
  });

  it("reenrolling into the same program → 409 already_member, no 2nd membership", async () => {
    const before = await getDb()
      .select()
      .from(programMemberships)
      .where(eq(programMemberships.programId, programActive));
    await expect(
      enroll(programActive, {
        firstName: "Marcos",
        lastName: "Pérez",
        phoneE164: phoneMain,
      }),
    ).rejects.toMatchObject({ status: 409, code: "already_member" });
    const after = await getDb()
      .select()
      .from(programMemberships)
      .where(eq(programMemberships.programId, programActive));
    expect(after).toHaveLength(before.length);
  });

  it("rejects an inactive program with 404", async () => {
    await expect(
      enroll(programInactive, {
        firstName: "Ana",
        lastName: "Gómez",
        phoneE164: phoneOther,
      }),
    ).rejects.toMatchObject({ status: 404, code: "program_unavailable" });
  });

  it("rejects a malformed program id with 404, not a 500", async () => {
    await expect(
      enroll("not-a-uuid", {
        firstName: "Ana",
        lastName: "Gómez",
        phoneE164: phoneOther,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("business isolation: business B never sees business A's membership", async () => {
    const scopedToB = await getDb()
      .select()
      .from(programMemberships)
      .where(eq(programMemberships.businessId, businessB));
    // The active-program membership belongs to business A and must be absent here.
    expect(scopedToB.some((m) => m.programId === programActive)).toBe(false);
    expect(scopedToB.every((m) => m.businessId === businessB)).toBe(true);
  });

  it("rate limit: the 4th attempt in the window → 429; a different phone is unaffected", async () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      await enforceEnrollRateLimit(phoneRate);
    }
    await expect(enforceEnrollRateLimit(phoneRate)).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    });
    // A different phone starts fresh.
    await expect(enforceEnrollRateLimit(phoneOther)).resolves.toBeUndefined();
  });

  it("session: a valid cookie resolves; absent/revoked/expired → null", async () => {
    const [acc] = await getDb()
      .select()
      .from(consumerAccounts)
      .where(eq(consumerAccounts.phoneE164, phoneMain));
    const token = await issueSession(acc.id);
    const resolved = await resolveSession(token);
    expect(resolved?.id).toBe(acc.id);

    // Absent cookie.
    expect(await resolveSession(undefined)).toBeNull();
    // Unknown token.
    expect(await resolveSession("nope-not-a-real-token")).toBeNull();

    // Expired: a session issued 31 days ago is already past its 30-day expiry.
    const past = new Date(Date.now() - 31 * 86_400_000);
    const expiredToken = await issueSession(acc.id, past);
    expect(await resolveSession(expiredToken)).toBeNull();

    // Revoked.
    const revokedToken = await issueSession(acc.id);
    await getDb()
      .update(consumerSessions)
      .set({ revokedAt: new Date() })
      .where(eq(consumerSessions.consumerId, acc.id));
    expect(await resolveSession(revokedToken)).toBeNull();
  });
});
