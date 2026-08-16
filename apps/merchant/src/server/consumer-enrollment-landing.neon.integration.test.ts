import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, loyaltyPrograms, users } from "./schema";
import { getEnrollLanding } from "./consumer/enrollment";

// Split out of consumer-enrollment.neon.integration.test.ts (file-size hook, 300 lines):
// the branding of the enroll landing (spec 0039) gets its own seed + assertions.
describe.skipIf(!enabled)("getEnrollLanding branding against Neon", () => {
  const userId = `int-${randomUUID()}`;
  // One business WITH a published logo + non-default brand colors, one WITHOUT.
  const businessWithLogo = randomUUID();
  const businessNoLogo = randomUUID();
  const programWithLogo = randomUUID();
  const programNoLogo = randomUUID();
  const programInactive = randomUUID();

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Landing QA",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values([
      {
        id: businessWithLogo,
        name: "La Gringa",
        countryCode: "EC",
        timezone: "America/Guayaquil",
        // Non-default brand + a published logo (so hasLogo resolves true).
        brandPrimaryColor: "#123456",
        brandComplementaryColor: "#654321",
        brandAccentColor: "#abcdef",
        logoObjectKey: `brands/${businessWithLogo}/logo.png`,
        logoVersion: 7,
      },
      {
        id: businessNoLogo,
        name: "Cervecería Cuervo",
        countryCode: "EC",
        timezone: "America/Guayaquil",
        // No logoObjectKey → hasLogo false; brand colors keep their schema defaults.
      },
    ]);
    await db.insert(loyaltyPrograms).values([
      {
        id: programWithLogo,
        businessId: businessWithLogo,
        kind: "points" as const,
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        termsMarkdown: "Términos.",
        termsHash: "hash",
        status: "active",
        createdBy: userId,
        createdAt: new Date(Date.now() - 10_000),
      },
      {
        id: programInactive,
        businessId: businessWithLogo,
        kind: "points" as const,
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        termsMarkdown: "Términos.",
        termsHash: "hash",
        status: "inactive",
        createdBy: userId,
        createdAt: new Date(Date.now() - 20_000),
      },
      {
        id: programNoLogo,
        businessId: businessNoLogo,
        kind: "points" as const,
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        termsMarkdown: "Términos.",
        termsHash: "hash",
        status: "closing",
        createdBy: userId,
        earningEndsAt: new Date(Date.now() + 2 * 86_400_000),
        redemptionEndsAt: new Date(Date.now() + 7 * 86_400_000),
      },
    ]);
  }, 30_000);

  afterAll(async () => {
    const db = getDb();
    await db
      .delete(loyaltyPrograms)
      .where(
        inArray(loyaltyPrograms.id, [
          programWithLogo,
          programInactive,
          programNoLogo,
        ]),
      );
    await db
      .delete(businesses)
      .where(inArray(businesses.id, [businessWithLogo, businessNoLogo]));
    await db.delete(users).where(eq(users.id, userId));
  }, 30_000);

  it("business WITH logo → hasLogo true, branding, never logoObjectKey", async () => {
    const landing = await getEnrollLanding(programWithLogo);
    expect(landing).not.toBeNull();
    expect(landing?.businessId).toBe(businessWithLogo);
    expect(landing?.businessName).toBe("La Gringa");
    expect(landing?.hasLogo).toBe(true);
    expect(landing?.logoVersion).toBe(7);
    expect(landing?.brandPrimaryColor).toBe("#123456");
    expect(landing?.brandComplementaryColor).toBe("#654321");
    expect(landing?.brandAccentColor).toBe("#abcdef");
    // Anti-leak (CLAUDE.md): the internal R2 key must never reach the client.
    expect(landing).not.toHaveProperty("logoObjectKey");
  });

  it("business WITHOUT logo → hasLogo false, default branding, never logoObjectKey", async () => {
    const landing = await getEnrollLanding(programNoLogo);
    expect(landing).not.toBeNull();
    expect(landing?.businessId).toBe(businessNoLogo);
    expect(landing?.hasLogo).toBe(false);
    expect(landing?.logoVersion).toBe(0);
    expect(landing?.brandPrimaryColor).toBe("#176548");
    expect(landing).not.toHaveProperty("logoObjectKey");
  });

  it("inactive program → null (does not admit enrollment)", async () => {
    expect(await getEnrollLanding(programInactive)).toBeNull();
  });
});
