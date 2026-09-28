import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import {
  type CouponWorld,
  dropCouponWorld,
  newCouponCard,
  seedCouponWorld,
} from "./counter-coupon-support";
import { getDb } from "./db";
import { couponRedemptions, products } from "./schema";
import { loadRewardResults } from "./marketing/reward-results";
import type { CouponKind } from "./marketing/reward-input";

/**
 * Spec 0106 E4 — results by reward against a real database. The redemptions are inserted
 * with a chosen `created_at` (the counter's path has its own suites): what is pinned here
 * is the GROUPING (kind + product), the sums, the label rule, the range in the business's
 * time zone (America/Guayaquil, UTC-5) and the isolation by business (ORACULO DE M6).
 */

const worlds: CouponWorld[] = [];

afterAll(async () => {
  for (const world of worlds.splice(0)) await dropCouponWorld(world);
}, 120_000);

async function world(prefix: string): Promise<CouponWorld> {
  const created = await seedCouponWorld(`${prefix} ${Date.now()}`);
  worlds.push(created);
  return created;
}

async function product(businessId: string, name: string): Promise<string> {
  const [row] = await getDb()
    .insert(products)
    .values({ businessId, name })
    .returning({ id: products.id });
  return row.id;
}

/** One redemption of a fresh card of `w`, as the counter would have stored it. */
async function redeemed(
  w: CouponWorld,
  row: {
    kind: CouponKind;
    label: string;
    cost: string;
    at: string;
    productId?: string;
    units?: number;
  },
): Promise<void> {
  const card = await newCouponCard(w);
  await getDb()
    .insert(couponRedemptions)
    .values({
      couponId: card.couponId,
      campaignId: w.campaignId,
      businessId: w.seed.business.id,
      consumerId: card.consumerId,
      membershipId: card.membershipId,
      labelSnapshot: row.label,
      costSnapshot: row.cost,
      kindSnapshot: row.kind,
      productId: row.productId ?? null,
      unitsGranted: row.units ?? null,
      balanceAfter: row.units === undefined ? null : 77 + row.units,
      createdByUserId: w.seed.userId,
      clientRequestId: randomUUID(),
      createdAt: new Date(row.at),
    });
}

describe.skipIf(!integrationEnabled)("results by reward (spec 0106 E4)", () => {
  it("groups the business's redemptions by kind + product, in its time zone, and never counts another business's", async () => {
    const mine = await world("Premios mios");
    const theirs = await world("Premios ajenos");
    const businessId = mine.seed.business.id;
    const cafe = await product(businessId, "Café");
    const medialuna = await product(businessId, "Medialuna");

    // 2x1 of the same product, two labels: the group is named by the PRODUCT.
    await redeemed(mine, {
      kind: "two_for_one",
      productId: cafe,
      label: "2x1 en Café",
      cost: "1.20",
      at: "2026-09-10T12:00:00Z",
    });
    await redeemed(mine, {
      kind: "two_for_one",
      productId: cafe,
      label: "2x1 Café viejo",
      cost: "1.50",
      at: "2026-09-11T12:00:00Z",
    });
    // A product deleted later: the fk sets null and the label falls back to the snapshot.
    await redeemed(mine, {
      kind: "free_product",
      productId: medialuna,
      label: "Medialuna gratis",
      cost: "0.80",
      at: "2026-09-12T12:00:00Z",
    });
    await getDb().delete(products).where(eq(products.id, medialuna));
    // Extras: units summed.
    await redeemed(mine, {
      kind: "extra_points",
      label: "5 puntos extra",
      cost: "0.00",
      units: 5,
      at: "2026-09-15T12:00:00Z",
    });
    await redeemed(mine, {
      kind: "extra_points",
      label: "3 puntos extra",
      cost: "0.00",
      units: 3,
      at: "2026-09-16T12:00:00Z",
    });
    // The range's edges, in local time (UTC-5): Sept 30 23:59 local is IN; Aug 31 23:59 is OUT.
    await redeemed(mine, {
      kind: "discount",
      label: "10% off",
      cost: "2.00",
      at: "2026-10-01T04:59:00Z",
    });
    await redeemed(mine, {
      kind: "discount",
      label: "10% off",
      cost: "9.00",
      at: "2026-09-01T04:59:00Z",
    });
    // ANOTHER business, inside the range: must not add anything.
    await redeemed(theirs, {
      kind: "extra_points",
      label: "100 puntos extra",
      cost: "0.00",
      units: 100,
      at: "2026-09-15T12:00:00Z",
    });
    await redeemed(theirs, {
      kind: "two_for_one",
      label: "2x1 ajeno",
      cost: "7.00",
      at: "2026-09-15T12:00:00Z",
    });

    expect(
      await loadRewardResults(businessId, "2026-09-01", "2026-09-30"),
    ).toEqual([
      {
        kind: "extra_points",
        productId: null,
        label: "3 puntos extra",
        redeemed: 2,
        incurredCost: "0.00",
        unitsGranted: 8,
      },
      {
        kind: "two_for_one",
        productId: cafe,
        label: "Café",
        redeemed: 2,
        incurredCost: "2.70",
        unitsGranted: null,
      },
      {
        kind: "discount",
        productId: null,
        label: "10% off",
        redeemed: 1,
        incurredCost: "2.00",
        unitsGranted: null,
      },
      {
        kind: "free_product",
        productId: null,
        label: "Medialuna gratis",
        redeemed: 1,
        incurredCost: "0.80",
        unitsGranted: null,
      },
    ]);
  }, 180_000);

  it("an invalid range is a 400 validation and reads nothing", async () => {
    const mine = await world("Premios rango");
    await expect(
      loadRewardResults(mine.seed.business.id, "2026-01-01", "2027-06-01"),
    ).rejects.toMatchObject({
      status: 400,
      code: "validation",
      fields: { to: expect.any(String) },
    });
    await expect(
      loadRewardResults(mine.seed.business.id, "ayer", "2026-06-01"),
    ).rejects.toMatchObject({
      status: 400,
      fields: { from: expect.any(String) },
    });
  }, 60_000);
});
