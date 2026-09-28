import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  readBalances,
} from "./counter-integration-support";
import {
  type CouponWorld,
  couponBody,
  dropCouponWorld,
  newCouponCard,
  readCoupons,
  seedCouponWorld,
} from "./counter-coupon-support";
import { getDb } from "./db";
import { couponRedemptions, loyaltyPrograms, orders } from "./schema";
import { redeemCoupon } from "./counter/coupon";
import { resolveScan } from "./counter/resolve";

/**
 * Spec 0106 E2 / ADR 0098 §6 — a coupon of EXTRA stamps/points at the counter, against a
 * real database. The world is a POINTS program and every card starts with 77 points
 * (`newCouponCard`). Balances and rows are READ BY SQL: the API answer is never the oracle
 * (ADR 0054 §4). The concurrent case lives in `counter-coupon-races` (ORACULO DE M4).
 */

const worlds: CouponWorld[] = [];

afterAll(async () => {
  for (const world of worlds.splice(0)) await dropCouponWorld(world);
}, 120_000);

async function world(prefix: string): Promise<CouponWorld> {
  const created = await seedCouponWorld(
    `${prefix} ${randomUUID().slice(0, 6)}`,
  );
  worlds.push(created);
  return created;
}

const ordersOf = (consumerId: string) =>
  getDb()
    .select({ id: orders.id })
    .from(orders)
    .where(eq(orders.consumerId, consumerId));

describe.skipIf(!integrationEnabled)(
  "coupon of extra units (spec 0106 E2)",
  () => {
    it("the scan shows the reward; redeeming extra POINTS credits once, creates no order, and a retry answers the STORED values", async () => {
      const w = await world("Extras puntos");
      const card = await newCouponCard(w, {
        extra: { kind: "extra_points", units: 5 },
      });

      expect(
        (await resolveScan(w.seed.business, card.qrToken)).coupon,
      ).toMatchObject({
        couponId: card.couponId,
        kind: "extra_points",
        extraUnits: 5,
        rule: null,
        discountUnit: null,
        discountValue: null,
        currencyCode: "USD",
      });

      const body = couponBody(card, w.seed, randomUUID());
      const first = await redeemCoupon(w.seed.business, w.seed.userId, body);
      expect(first.coupon).toMatchObject({
        kind: "extra_points",
        unitsGranted: 5,
        balanceAfter: 82,
      });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 82,
        stamps: 0,
      });
      expect(await ordersOf(card.consumerId)).toEqual([]);
      const [row] = await getDb()
        .select({
          kindSnapshot: couponRedemptions.kindSnapshot,
          unitsGranted: couponRedemptions.unitsGranted,
          balanceAfter: couponRedemptions.balanceAfter,
        })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, card.couponId));
      expect(row).toEqual({
        kindSnapshot: "extra_points",
        unitsGranted: 5,
        balanceAfter: 82,
      });

      // The idempotent retry: same answer, from the stored row, and no second credit.
      const second = await redeemCoupon(w.seed.business, w.seed.userId, body);
      expect(second.coupon).toMatchObject({
        kind: "extra_points",
        unitsGranted: 5,
        balanceAfter: 82,
      });
      expect((await readBalances(card.membershipId)).points).toBe(82);
    }, 120_000);

    it("a STAMPS coupon on a POINTS program is 409 program_changed: balance intact, coupon still unredeemed — and it redeems once the program is stamps again", async () => {
      // ORACULO DE M3.
      const w = await world("Extras cambio");
      const card = await newCouponCard(w, {
        extra: { kind: "extra_stamps", units: 3 },
      });

      await expect(
        redeemCoupon(w.seed.business, w.seed.userId, couponBody(card, w.seed)),
      ).rejects.toMatchObject({ status: 409, code: "program_changed" });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 77,
        stamps: 0,
      });
      expect(await readCoupons(w.campaignId)).toEqual([]);
      expect(
        (await resolveScan(w.seed.business, card.qrToken)).coupon?.couponId,
      ).toBe(card.couponId);

      await getDb()
        .update(loyaltyPrograms)
        .set({ kind: "stamps" })
        .where(eq(loyaltyPrograms.id, w.seed.programId));
      const redeemed = await redeemCoupon(
        w.seed.business,
        w.seed.userId,
        couponBody(card, w.seed),
      );
      expect(redeemed.coupon).toMatchObject({
        kind: "extra_stamps",
        unitsGranted: 3,
        balanceAfter: 3,
      });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 77,
        stamps: 3,
      });
    }, 120_000);

    it("a coupon that is NOT extra credits nothing and answers null units", async () => {
      const w = await world("Extras texto");
      const card = await newCouponCard(w);
      const result = await redeemCoupon(
        w.seed.business,
        w.seed.userId,
        couponBody(card, w.seed),
      );
      expect(result.coupon).toMatchObject({
        kind: "free_product",
        unitsGranted: null,
        balanceAfter: null,
      });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 77,
        stamps: 0,
      });
    }, 120_000);
  },
);
