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
import { programForOwner, saveProgram } from "./loyalty-program";

describe.skipIf(!enabled)("loyalty card design against Neon", () => {
  const userId = `card-${randomUUID()}`;
  const businessId = randomUUID();

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Tarjeta",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: "Tarjeta QA",
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

  it("persists a gradient design, round-trips an edit to solid, and rejects bad hex", async () => {
    // create with a gradient design; colors normalize to uppercase
    await saveProgram(userId, {
      kind: "stamps",
      configuration: { unitName: "Sello", target: 8 },
      clauses: [{ text: "Términos." }],
      cardDesign: {
        backgroundColor: "#aabbcc",
        backgroundColor2: "#112233",
        gradientAngle: 135,
        borderColor: "#445566",
      },
    });
    let ctx = await programForOwner(userId);
    expect(ctx?.program).toMatchObject({
      cardBackgroundColor: "#AABBCC",
      cardBackgroundColor2: "#112233",
      cardBackgroundGradientAngle: 135,
      cardBorderColor: "#445566",
    });

    // edit to a solid background clears the 2nd color and the angle
    await saveProgram(userId, {
      kind: "stamps",
      configuration: { unitName: "Sello", target: 8 },
      clauses: [{ text: "Términos v2." }],
      cardDesign: {
        backgroundColor: "#010203",
        backgroundColor2: null,
        gradientAngle: null,
        borderColor: "#0a0b0c",
      },
    });
    ctx = await programForOwner(userId);
    expect(ctx?.program).toMatchObject({
      cardBackgroundColor: "#010203",
      cardBackgroundColor2: null,
      cardBackgroundGradientAngle: null,
      cardBorderColor: "#0A0B0C",
    });

    // the DB check constraint rejects an invalid hex written directly
    const bad = await getDb()
      .update(loyaltyPrograms)
      .set({ cardBackgroundColor: "not-a-color" })
      .where(eq(loyaltyPrograms.businessId, businessId))
      .then(
        () => null,
        (reason: unknown) => reason,
      );
    expect(bad).not.toBeNull();
  }, 45_000);
});
