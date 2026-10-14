import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
// getDb() reads DATABASE_URL lazily; point it at the isolated integration branch.
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  stockItems,
  stockItemLocations,
  users,
} from "@mi-pasaporte/db/schema";
import {
  BrandError,
  ownerBusiness,
  saveBrand,
} from "@mi-pasaporte/domain/server/brand";

import { listCatalog } from "@mi-pasaporte/domain/server/catalog";
import { listConsumerPrograms } from "@mi-pasaporte/domain/server/consumer/programs";
import { listItems } from "../modules/stock/items";
import { scannedCustomer } from "./counter/coupon-cycle-support";
import {
  seedPosWorld,
  dropPosWorld,
  openOrder,
  pos,
} from "../modules/pos/server/pos-integration-support";

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

  it("starts a new business at false/null/false without guessing a country rate", async () => {
    expect(await ownerBusiness(userId)).toMatchObject({
      chargesVat: false,
      saleVatRate: null,
      recoversPurchaseVat: false,
    });
  });

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

  it("round-trips the currency now owned by brand config", async () => {
    const before = await ownerBusiness(userId);
    // Seeded without an explicit currency → the column default applies.
    expect(before?.currencyCode).toBe("USD");
    const saved = await saveBrand(userId, {
      ...brandInput(before!.brandRevision),
      currencyCode: "BRL",
    });
    expect(saved.currencyCode).toBe("BRL");
  });
  it("round-trips exact fiscal values, legacy omissions, retention and null versus zero", async () => {
    const current = (await ownerBusiness(userId))!;
    const saved = await saveBrand(userId, {
      ...brandInput(current.brandRevision),
      chargesVat: true,
      saleVatRate: "015.2",
      recoversPurchaseVat: true,
    });
    expect(saved).toMatchObject({
      chargesVat: true,
      saleVatRate: "15.20",
      recoversPurchaseVat: true,
    });
    const legacy = await saveBrand(userId, brandInput(saved.brandRevision));
    expect(legacy).toMatchObject({
      chargesVat: true,
      saleVatRate: "15.20",
      recoversPurchaseVat: true,
    });
    const off = await saveBrand(userId, {
      ...brandInput(legacy.brandRevision),
      chargesVat: false,
    });
    expect(off.saleVatRate).toBe("15.20");
    const zero = await saveBrand(userId, {
      ...brandInput(off.brandRevision),
      chargesVat: true,
      saleVatRate: "0",
    });
    expect(zero.saleVatRate).toBe("0.00");
    const empty = await saveBrand(userId, {
      ...brandInput(zero.brandRevision),
      chargesVat: false,
      saleVatRate: null,
    });
    expect(empty.saleVatRate).toBeNull();
    await expect(
      saveBrand(userId, {
        ...brandInput(empty.brandRevision),
        chargesVat: true,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await ownerBusiness(userId)).toEqual(empty);
  }, 30_000);
});

describe.skipIf(!enabled)(
  "fiscal settings are inert for current calculations and public consumers",
  () => {
    it("saving flags changes neither catalog price, comparable POS total nor local ingredient cost", async () => {
      const world = await seedPosWorld("Fiscal inert");
      try {
        const businessId = world.seed.business.id;
        const [item] = await getDb()
          .insert(stockItems)
          .values({ businessId, name: "Fiscal Ingredient", unit: "unit" })
          .returning();
        await getDb()
          .insert(stockItemLocations)
          .values({
            businessId,
            itemId: item.id,
            locationId: world.seed.locationId,
            lastUnitCost: "11.500000",
            weightedAverageUnitCost: "10.250000",
            weightedAverageInitializedAt: new Date(),
          });
        const customer = await scannedCustomer(world);
        const catalogBefore = await listCatalog(world.seed.business);
        const stockBefore = await listItems(
          businessId,
          "all",
          world.seed.locationId,
        );
        const costBefore = await getDb()
          .select()
          .from(stockItemLocations)
          .where(eq(stockItemLocations.itemId, item.id));
        const close = async () => {
          const order = await openOrder(world, [
            { productId: world.medialuna, quantity: 2 },
            { productId: world.cafe, quantity: 1 },
          ]);
          const response = await pos.close(world.ownerCookie, order.id, {
            clientRequestId: randomUUID(),
            version: order.version,
            membershipId: customer.membershipId,
          });
          expect(response.status).toBe(200);
          return response.json();
        };
        const saleBefore = await close();
        expect(saleBefore.total).toBe("9.00");
        const current = (await ownerBusiness(world.seed.userId))!;
        await saveBrand(world.seed.userId, {
          ...brandInput(current.brandRevision),
          name: current.name,
          chargesVat: true,
          saleVatRate: "100.00",
          recoversPurchaseVat: true,
        });
        expect(await listCatalog(world.seed.business)).toEqual(catalogBefore);
        expect(
          await listItems(businessId, "all", world.seed.locationId),
        ).toEqual(stockBefore);
        expect(
          await getDb()
            .select()
            .from(stockItemLocations)
            .where(eq(stockItemLocations.itemId, item.id)),
        ).toEqual(costBefore);
        const saleAfter = await close();
        expect(saleAfter.total).toBe(saleBefore.total);
        const consumerDTO = await listConsumerPrograms(customer.consumerId);
        expect(consumerDTO).toHaveLength(1);
        const serialized = JSON.stringify({
          consumerDTO,
          saleBefore,
          saleAfter,
          catalogBefore,
          stockBefore,
        });
        for (const key of ["chargesVat", "saleVatRate", "recoversPurchaseVat"])
          expect(serialized).not.toContain(key);
      } finally {
        await dropPosWorld(world);
      }
    }, 180_000);
  },
);
