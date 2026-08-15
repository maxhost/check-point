import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "./db";
import { businesses, locations, memberships, users } from "./schema";
import {
  type OwnerBusiness,
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  listCatalog,
  ownerBusiness,
  updateProduct,
} from "./catalog";

type Seed = { userId: string; businessId: string; locationId: string };

async function seedBusiness(name: string): Promise<Seed> {
  const db = getDb();
  const userId = `cat-int-${randomUUID()}`;
  const businessId = randomUUID();
  const locationId = randomUUID();
  await db.insert(users).values({
    id: userId,
    name,
    email: `${userId}@example.test`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(businesses).values({
    id: businessId,
    name,
    countryCode: "EC",
    timezone: "America/Guayaquil",
  });
  await db.insert(memberships).values({ businessId, userId, role: "owner" });
  await db.insert(locations).values({
    id: locationId,
    businessId,
    name: `${name} centro`,
    addressLabel: "Calle 1",
    longitude: "0",
    latitude: "0",
    countryCode: "EC",
    addressSnapshot: {},
  });
  return { userId, businessId, locationId };
}

describe.skipIf(!enabled)("catalog service against Neon", () => {
  let a: Seed;
  let b: Seed;
  let ownerA: OwnerBusiness;
  let ownerB: OwnerBusiness;

  beforeAll(async () => {
    a = await seedBusiness("Negocio A");
    b = await seedBusiness("Negocio B");
    ownerA = (await ownerBusiness(a.userId))!;
    ownerB = (await ownerBusiness(b.userId))!;
    expect(ownerA.currencyCode).toBe("USD");
  }, 30_000);

  afterAll(async () => {
    const db = getDb();
    for (const seed of [a, b]) {
      if (!seed) continue;
      await db
        .delete(memberships)
        .where(eq(memberships.businessId, seed.businessId));
      await db.delete(businesses).where(eq(businesses.id, seed.businessId));
      await db.delete(users).where(eq(users.id, seed.userId));
    }
  }, 30_000);

  it("isolates products, categories and locations by business", async () => {
    const created = await createProduct(ownerA, { name: "Café" });
    expect(created).not.toHaveProperty("imageObjectKey");
    const catalogA = await listCatalog(ownerA);
    const catalogB = await listCatalog(ownerB);
    expect(catalogA.products.map((p) => p.id)).toContain(created.id);
    expect(catalogB.products.map((p) => p.id)).not.toContain(created.id);
  }, 30_000);

  it("rejects a category or location from another business (422)", async () => {
    const catB = await createCategory(ownerB, { name: "B-cat" });
    await expect(
      createProduct(ownerA, { name: "X", categoryId: catB.id }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      createProduct(ownerA, {
        name: "Y",
        availableAllLocations: false,
        locationIds: [b.locationId],
      }),
    ).rejects.toMatchObject({ status: 422 });
  }, 30_000);

  it("resolves restricted visibility to the business's own locations", async () => {
    const restricted = await createProduct(ownerA, {
      name: "Solo centro",
      availableAllLocations: false,
      locationIds: [a.locationId],
    });
    const catalogA = await listCatalog(ownerA);
    const found = catalogA.products.find((p) => p.id === restricted.id)!;
    expect(found.availableAllLocations).toBe(false);
    expect(found.locationIds).toEqual([a.locationId]);
  }, 30_000);

  it("leaves products uncategorized when their category is deleted", async () => {
    const category = await createCategory(ownerA, { name: "Bebidas" });
    const product = await createProduct(ownerA, {
      name: "Té",
      categoryId: category.id,
    });
    await deleteCategory(ownerA, category.id);
    const catalogA = await listCatalog(ownerA);
    const found = catalogA.products.find((p) => p.id === product.id)!;
    expect(found.categoryId).toBeNull();
  }, 30_000);

  it("blocks cross-business update and delete (404)", async () => {
    const product = await createProduct(ownerA, { name: "Privado A" });
    await expect(
      updateProduct(ownerB, product.id, { name: "Hack" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(deleteProduct(ownerB, product.id)).rejects.toMatchObject({
      status: 404,
    });
    // The owner can delete its own product.
    expect(await deleteProduct(ownerA, product.id)).toEqual({ ok: true });
  }, 30_000);

  it("exposes the business currency for price formatting", async () => {
    // Currency lives in brand config now; the catalog only reads it.
    expect((await listCatalog(ownerA)).currencyCode).toBe("USD");
  }, 30_000);
});
