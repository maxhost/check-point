import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, memberships, users } from "./schema";
import { BrandError, saveBrand } from "./brand";

const brandInput = (revision: number) => ({
  name: "Marca Integración",
  timezone: "America/Guayaquil",
  brandPrimaryColor: "#176548",
  brandComplementaryColor: "#2D8B68",
  brandAccentColor: "#E78132",
  revision,
  logoAction: "keep" as const,
});

describe.skipIf(!enabled)("brand service against Neon", () => {
  const userId = `brand-int-${randomUUID()}`;
  const businessId = randomUUID();

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: userId,
      name: "Owner Marca",
      email: `${userId}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(businesses).values({
      id: businessId,
      name: "Marca QA",
      countryCode: "EC",
      timezone: "America/Guayaquil",
    });
    await db.insert(memberships).values({ businessId, userId, role: "owner" });
  }, 30_000);

  afterAll(async () => {
    const db = getDb();
    await db.delete(memberships).where(eq(memberships.businessId, businessId));
    await db.delete(businesses).where(eq(businesses.id, businessId));
    await db.delete(users).where(eq(users.id, userId));
  }, 30_000);

  it("bumps the revision on save and rejects a stale save with 409", async () => {
    // Fresh business starts at brand_revision = 1; the first save matches and bumps to 2.
    const saved = await saveBrand(userId, brandInput(1));
    expect(saved.brandRevision).toBe(2);
    // The client-facing route strips it, but the service still returns the key column.
    expect(saved).toHaveProperty("logoObjectKey");

    // A second save with the now-stale revision 1 must not silently succeed.
    await expect(saveBrand(userId, brandInput(1))).rejects.toMatchObject({
      status: 409,
    });
    // Saving with the current revision 2 succeeds again.
    const again = await saveBrand(userId, brandInput(2));
    expect(again.brandRevision).toBe(3);
  }, 30_000);

  it("rejects a user without an owner business with 403", async () => {
    await expect(
      saveBrand(`ghost-${randomUUID()}`, brandInput(1)),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("still surfaces BrandError for a malformed payload as 422", async () => {
    await expect(
      saveBrand(userId, { ...brandInput(3), brandPrimaryColor: "green" }),
    ).rejects.toBeInstanceOf(BrandError);
  });
});
