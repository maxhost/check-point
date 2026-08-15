import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
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
  loyaltyRewards,
  memberships,
  products,
  users,
} from "./schema";
import { sql } from "drizzle-orm";
import { LoyaltyError, programForOwner, saveProgram } from "./loyalty-program";

type Seed = { userId: string; businessId: string; productId: string };

async function seed(name: string): Promise<Seed> {
  const db = getDb();
  const userId = `rew-int-${randomUUID()}`;
  const businessId = randomUUID();
  const productId = randomUUID();
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
  await db.insert(products).values({
    id: productId,
    businessId,
    name: `${name} Café`,
    unitPrice: "2.50",
  });
  return { userId, businessId, productId };
}

async function cleanup(seedValue: Seed) {
  const db = getDb();
  await db
    .delete(loyaltyRewards)
    .where(eq(loyaltyRewards.businessId, seedValue.businessId));
  await db
    .delete(loyaltyProgramEvents)
    .where(eq(loyaltyProgramEvents.businessId, seedValue.businessId));
  await db
    .delete(loyaltyPrograms)
    .where(eq(loyaltyPrograms.businessId, seedValue.businessId));
  await db
    .delete(products)
    .where(eq(products.businessId, seedValue.businessId));
  await db
    .delete(memberships)
    .where(eq(memberships.businessId, seedValue.businessId));
  await db.delete(businesses).where(eq(businesses.id, seedValue.businessId));
  await db.delete(users).where(eq(users.id, seedValue.userId));
}

const rewardsOf = (programId: string) =>
  getDb()
    .select()
    .from(loyaltyRewards)
    .where(eq(loyaltyRewards.programId, programId))
    .orderBy(asc(loyaltyRewards.position));

describe.skipIf(!enabled)("loyalty reward persistence against Neon", () => {
  let a: Seed;
  let b: Seed;
  let c: Seed;

  beforeAll(async () => {
    a = await seed("Rewards A");
    b = await seed("Rewards B");
    c = await seed("Legacy C");
  }, 30_000);

  afterAll(async () => {
    for (const s of [a, b, c]) if (s) await cleanup(s);
  }, 30_000);

  it("persists Puntos mechanics + rewards, then round-trips an edit", async () => {
    await saveProgram(a.userId, {
      kind: "points",
      configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
      clauses: [{ text: "Términos." }],
      accrual: { mode: "per_amount", grant: 10, blockAmount: 3 },
      rewards: [
        { type: "catalog_product", productId: a.productId, pointsCost: 50 },
        { type: "custom", label: "Cerveza", pointsCost: 100 },
      ],
    });
    const ctx = await programForOwner(a.userId);
    expect(ctx?.program?.accrualMode).toBe("per_amount");
    expect(ctx?.program?.accrualGrant).toBe(10);
    expect(Number(ctx?.program?.accrualBlockAmount)).toBe(3);
    const first = await rewardsOf(ctx!.program!.id);
    expect(first).toHaveLength(2);
    // catalog_product label is snapshotted from the real product name.
    expect(first[0]).toMatchObject({
      rewardType: "catalog_product",
      productId: a.productId,
      label: "Rewards A Café",
      pointsCost: 50,
      position: 0,
    });
    expect(first[1]).toMatchObject({ label: "Cerveza", position: 1 });

    // Edit: change the mechanics and replace all rewards with a single discount.
    await saveProgram(a.userId, {
      kind: "points",
      configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
      clauses: [{ text: "Términos v2." }],
      accrual: { mode: "per_amount", grant: 5, blockAmount: 2 },
      rewards: [{ type: "discount", discountPercent: 20, pointsCost: 30 }],
    });
    const ctx2 = await programForOwner(a.userId);
    expect(ctx2?.program?.accrualGrant).toBe(5);
    expect(Number(ctx2?.program?.accrualBlockAmount)).toBe(2);
    const second = await rewardsOf(ctx2!.program!.id);
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({
      rewardType: "discount",
      discountPercent: 20,
      pointsCost: 30,
      label: "20% de descuento",
    });
  }, 60_000);

  it("rejects a productId from another business with 422", async () => {
    await expect(
      saveProgram(a.userId, {
        kind: "points",
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        clauses: [{ text: "Términos." }],
        accrual: { mode: "per_amount", grant: 10, blockAmount: 3 },
        // b.productId belongs to business B, not A.
        rewards: [
          { type: "catalog_product", productId: b.productId, pointsCost: 50 },
        ],
      }),
    ).rejects.toBeInstanceOf(LoyaltyError);
  }, 30_000);

  it("stores Sellos per_purchase with a null block amount and one reward", async () => {
    await saveProgram(b.userId, {
      kind: "stamps",
      configuration: { unitName: "Sello", target: 8 },
      clauses: [{ text: "Términos." }],
      cardDesign: null,
      accrual: { mode: "per_purchase", grant: 1, blockAmount: null },
      rewards: [{ type: "custom", label: "Café gratis" }],
    });
    const ctx = await programForOwner(b.userId);
    expect(ctx?.program?.accrualMode).toBe("per_purchase");
    expect(ctx?.program?.accrualBlockAmount).toBeNull();
    const rows = await rewardsOf(ctx!.program!.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: "Café gratis", pointsCost: null });
  }, 30_000);

  it("enforces the DB checks on accrual and reward columns", async () => {
    const ctx = await programForOwner(a.userId);
    const programId = ctx!.program!.id;
    // accrual_block_amount must be > 0.
    await expect(
      getDb().execute(
        sql`UPDATE core.loyalty_program SET accrual_block_amount = -1 WHERE id = ${programId}`,
      ),
    ).rejects.toBeTruthy();
    // discount_percent must be within 1..100.
    await expect(
      getDb().execute(
        sql`INSERT INTO core.loyalty_reward
          (program_id, business_id, reward_type, label, discount_percent, points_cost, position)
          VALUES (${programId}, ${a.businessId}, 'discount', '200%', 200, 10, 5)`,
      ),
    ).rejects.toBeTruthy();
  }, 30_000);

  it("hydrates a legacy program with null mechanics without crashing", async () => {
    // A program created before spec 0036: accrual columns null, no rewards.
    await getDb()
      .insert(loyaltyPrograms)
      .values({
        id: randomUUID(),
        businessId: c.businessId,
        kind: "points",
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        status: "active",
        termsMarkdown: "t",
        termsHash: "h",
        createdBy: c.userId,
      });
    const ctx = await programForOwner(c.userId);
    expect(ctx?.program?.accrualMode ?? null).toBeNull();
    expect(ctx?.rewards).toEqual([]);
  }, 30_000);
});
