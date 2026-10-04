import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  readBalances,
} from "./counter-integration-support";
import {
  type CouponWorld,
  chooseCoupon,
  dropCouponWorld,
  newCouponCard,
  readCoupons,
  seedCouponWorld,
  sellCoupon,
} from "./counter-coupon-support";
import { getDb } from "@mi-pasaporte/db";
import {
  couponRedemptions,
  loyaltyPrograms,
  orders,
} from "@mi-pasaporte/db/schema";
import { resolveScan } from "./counter/resolve";

/**
 * Spec 0106 E2 / ADR 0098 §6 — a coupon of EXTRA stamps/points at the counter, against a
 * real database. The world is a POINTS program and every card starts with 77 points
 * (`newCouponCard`). Balances and rows are READ BY SQL: the API answer is never the oracle
 * (ADR 0054 §4). The concurrent case lives in `counter-coupon-races` (ORACULO DE M4).
 *
 * Spec 0148: the consumer CHOOSES the coupon (`chooseCoupon`) and the scan paints it as
 * `couponState.selected`. Spec 0153 / ADR 0120 §5: the counter's SALE applies it
 * (`sellCoupon`) and that is where an `extra_*` coupon credits — on top of the sale's units,
 * after the order, in the same transaction. A sale of 0.00 grants 0 units, so the balance
 * measures the coupon alone; the STAMPS case sells 1.00 to measure both together.
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
    it("the scan shows the reward; the sale with extra POINTS credits once, on its order, and a retry answers the STORED values", async () => {
      const w = await world("Extras puntos");
      const card = await newCouponCard(w, {
        extra: { kind: "extra_points", units: 5 },
      });
      await chooseCoupon(card);

      expect(
        (await resolveScan(w.seed.business, card.qrToken)).couponState,
      ).toMatchObject({
        status: "selected",
        coupon: {
          couponId: card.couponId,
          kind: "extra_points",
          extraUnits: 5,
          rule: null,
          discountUnit: null,
          discountValue: null,
          currencyCode: "USD",
        },
        verdict: { valid: true },
      });

      const key = randomUUID();
      const first = await sellCoupon(w, card, key);
      expect(first.order).toMatchObject({
        unitsGranted: 0,
        balanceAfter: 82,
        coupon: { discountAmount: "0.00", extraUnits: 5 },
      });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 82,
        stamps: 0,
      });
      const [order] = await ordersOf(card.consumerId);
      expect(await ordersOf(card.consumerId)).toHaveLength(1);
      const [row] = await getDb()
        .select({
          kindSnapshot: couponRedemptions.kindSnapshot,
          unitsGranted: couponRedemptions.unitsGranted,
          balanceAfter: couponRedemptions.balanceAfter,
          orderId: couponRedemptions.orderId,
        })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, card.couponId));
      expect(row).toEqual({
        kindSnapshot: "extra_points",
        unitsGranted: 5,
        balanceAfter: 82,
        orderId: order.id,
      });

      // The idempotent retry: same answer, from the stored rows, and no second credit.
      const second = await sellCoupon(w, card, key);
      expect(second.order).toEqual(first.order);
      expect((await readBalances(card.membershipId)).points).toBe(82);
    }, 120_000);

    it("a STAMPS coupon on a POINTS program is 409 program_changed: balance intact, coupon still unredeemed — and it redeems once the program is stamps again", async () => {
      // ORACULO DE M3.
      const w = await world("Extras cambio");
      const card = await newCouponCard(w, {
        extra: { kind: "extra_stamps", units: 3 },
      });
      await chooseCoupon(card);

      // The counter already paints it red, with the same rule the sale applies.
      expect(
        (await resolveScan(w.seed.business, card.qrToken)).couponState,
      ).toMatchObject({
        status: "selected",
        coupon: { couponId: card.couponId },
        verdict: { valid: false, code: "program_changed" },
      });
      await expect(
        sellCoupon(w, card, undefined, "1.00"),
      ).rejects.toMatchObject({ status: 409, code: "program_changed" });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 77,
        stamps: 0,
      });
      expect(await readCoupons(w.campaignId)).toEqual([]);
      expect(await ordersOf(card.consumerId)).toEqual([]);
      // The refusal rolled back whole: the choice is still there, the coupon still chosen.
      expect(
        (await resolveScan(w.seed.business, card.qrToken)).couponState,
      ).toMatchObject({
        status: "selected",
        coupon: { couponId: card.couponId },
      });

      await getDb()
        .update(loyaltyPrograms)
        .set({ kind: "stamps" })
        .where(eq(loyaltyPrograms.id, w.seed.programId));
      // A sale of 1.00 = 10 stamps (10 per 1.00), plus the coupon's 3: 13 at the end.
      const redeemed = await sellCoupon(w, card, undefined, "1.00");
      expect(redeemed.order).toMatchObject({
        kind: "stamps",
        unitsGranted: 10,
        balanceAfter: 13,
        coupon: { extraUnits: 3 },
      });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 77,
        stamps: 13,
      });
      const [row] = await getDb()
        .select({
          unitsGranted: couponRedemptions.unitsGranted,
          balanceAfter: couponRedemptions.balanceAfter,
          orderId: couponRedemptions.orderId,
        })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, card.couponId));
      const [order] = await ordersOf(card.consumerId);
      expect(row).toEqual({
        unitsGranted: 3,
        balanceAfter: 13,
        orderId: order.id,
      });
    }, 120_000);

    it("a coupon that is NOT extra credits nothing and answers null units", async () => {
      const w = await world("Extras texto");
      const card = await newCouponCard(w);
      await chooseCoupon(card);
      const result = await sellCoupon(w, card);
      expect(result.order).toMatchObject({
        balanceAfter: 77,
        coupon: { extraUnits: null },
      });
      expect(await readBalances(card.membershipId)).toEqual({
        points: 77,
        stamps: 0,
      });
    }, 120_000);
  },
);
