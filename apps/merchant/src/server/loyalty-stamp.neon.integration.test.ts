import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import {
  businesses,
  loyaltyProgramEvents,
  loyaltyPrograms,
  memberships,
  users,
} from "./schema";
import {
  programForOwner,
  saveProgram,
  stampForPublicProgram,
} from "./loyalty-program";

describe.skipIf(!enabled)("loyalty stamp columns against Neon", () => {
  const userId = `stamp-${randomUUID()}`;
  const businessId = randomUUID();

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Sello",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: "Sello QA",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db.insert(memberships).values({ businessId, userId, role: "owner" });
  }, 30_000);

  afterAll(async () => {
    const db = getDb();
    await db
      .delete(loyaltyProgramEvents)
      .where(eq(loyaltyProgramEvents.businessId, businessId));
    await db
      .delete(loyaltyPrograms)
      .where(eq(loyaltyPrograms.businessId, businessId));
    await db.delete(memberships).where(eq(memberships.businessId, businessId));
    await db.delete(businesses).where(eq(businesses.id, businessId));
    await db.delete(users).where(eq(users.id, userId));
  }, 30_000);

  it("defaults stamp columns and gates the public stamp read", async () => {
    await saveProgram(userId, {
      kind: "stamps",
      configuration: { unitName: "Sello", target: 8 },
      clauses: [{ text: "Términos del sello." }],
    });
    const ctx = await programForOwner(userId);
    expect(ctx?.program?.stampImageObjectKey).toBeNull();
    expect(ctx?.program?.stampImageVersion).toBe(0);
    // No stamp yet → the public read is denied regardless of version.
    expect(
      await stampForPublicProgram(businessId, ctx!.program!.id, "0"),
    ).toBeNull();
    // Editing with the default keep leaves the stamp columns untouched.
    await saveProgram(userId, {
      kind: "stamps",
      configuration: { unitName: "Sello", target: 10 },
      clauses: [{ text: "Términos actualizados." }],
    });
    const after = await programForOwner(userId);
    expect(after?.program?.stampImageObjectKey).toBeNull();
    expect(after?.program?.stampImageVersion).toBe(0);
  }, 30_000);
});
