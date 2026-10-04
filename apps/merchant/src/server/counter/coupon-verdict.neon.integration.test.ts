import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { campaignCoupons, consumerAccounts } from "@mi-pasaporte/db/schema";
import {
  integrationEnabled,
  readBalances,
} from "../counter-integration-support";
import {
  type CycleWorld,
  type Customer,
  choose,
  dropCycleWorld,
  ordersOf,
  redemptionsOf,
  scannedCustomer,
  secondCoupon,
  seedCycleWorld,
  selectionOf,
  sell,
  welcomeCoupon,
} from "./coupon-cycle-support";
import { getCouponState } from "./coupon-state";
import { removeCoupon } from "./coupon-remove";
import { resolveScan } from "./resolve";

/**
 * Spec 0153 / ADR 0120 — THE SYSTEM VALIDATES THE COUPON, against Neon (production-shaped
 * world, `coupon-cycle-support.ts`: `America/Guayaquil`, points 10 per 1.00). The scan paints
 * the choice with its verdict — red too —, the sale applies it with no prior «validate», an
 * `extra_*` credits WITH the sale, and «Quitar» takes back a red choice. Every assertion that
 * carries weight reads the DATABASE (ADR 0054 §4).
 */

let world: CycleWorld;

beforeAll(async () => {
  world = await seedCycleWorld("Cupon veredicto");
}, 120_000);

afterAll(async () => {
  if (world) await dropCycleWorld(world);
}, 120_000);

const state = (membershipId: string) =>
  getCouponState(world.seed.business, membershipId).then((r) => r.couponState);

/** A choice that went STALE: chosen while valid, expired since (the PWA refuses to choose
 * an expired one, so the stale state is written directly — ADR 0119 §4). */
async function expiredChoice(customer: Customer): Promise<string> {
  const couponId = await secondCoupon(world, customer, "Café vencido");
  await getDb()
    .update(campaignCoupons)
    .set({
      validFrom: new Date("2026-09-01T12:00:00.000Z"),
      validUntil: new Date("2026-10-01T12:00:00.000Z"),
    })
    .where(eq(campaignCoupons.id, couponId));
  await getDb()
    .update(consumerAccounts)
    .set({ selectedCouponId: couponId, couponSelectedAt: new Date() })
    .where(eq(consumerAccounts.id, customer.consumerId));
  return couponId;
}

describe.skipIf(!integrationEnabled)("the coupon's verdict (spec 0153)", () => {
  it("an EXPIRED choice is painted red with its local date; the sale refuses it; «Quitar» takes it back", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await expiredChoice(customer);

    const scan = await resolveScan(world.seed.business, customer.qrToken);
    expect(scan.couponState).toMatchObject({
      status: "selected",
      coupon: { couponId, label: "Café vencido" },
      verdict: {
        valid: false,
        code: "coupon_expired",
        message: "Este cupón venció el 01/10/2026.",
      },
    });

    await expect(
      sell(world, customer, { mode: "quick", total: "5.00" }, { couponId }),
    ).rejects.toMatchObject({ status: 409, code: "coupon_expired" });
    expect(await ordersOf(world, customer)).toEqual([]);
    expect(await redemptionsOf(couponId)).toEqual([]);

    expect(
      await removeCoupon(world.seed.business, {
        membershipId: customer.membershipId,
        couponId,
      }),
    ).toEqual({ removed: "selected" });
    expect(await selectionOf(customer)).toBeNull();
    // Its only coupon is the expired one: nothing valid left to hint at.
    expect(await state(customer.membershipId)).toEqual({ status: "none" });
  }, 180_000);

  it("a chosen free product, detailed sale with it in the cart: 200 and one unit off, with no «validate» before", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await welcomeCoupon(world, customer, {
      kind: "free_product",
      label: "Café gratis",
      productId: world.cafe,
    });
    await choose(customer, couponId);
    expect(await state(customer.membershipId)).toMatchObject({
      status: "selected",
      coupon: { couponId, productId: world.cafe },
      verdict: { valid: true },
    });

    // 1 café (2.00) + 1 medialuna (3.50) = 5.50; the café off → 3.50 → 30 points (whole
    // blocks of 1.00).
    const sold = await sell(
      world,
      customer,
      {
        mode: "detailed",
        items: [
          { productId: world.cafe, quantity: 1 },
          { productId: world.medialuna, quantity: 1 },
        ],
      },
      { couponId },
    );
    expect(sold.order).toMatchObject({
      total: "3.50",
      grossTotal: "5.50",
      coupon: {
        label: "Café gratis",
        discountAmount: "2.00",
        extraUnits: null,
      },
    });
    const [order] = await ordersOf(world, customer);
    expect(order).toMatchObject({ total: "3.50", units: 30 });
    expect(await redemptionsOf(couponId)).toEqual([
      expect.objectContaining({ orderId: order.id, discountAmount: "2.00" }),
    ]);
  }, 180_000);

  it("a chosen EXTRA POINTS coupon credits WITH the sale: final balance = sale + extra, on the order's row; a retry answers the same", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await welcomeCoupon(world, customer, {
      kind: "extra_points",
      label: "2 puntos extra",
      extraUnits: 2,
    });
    await choose(customer, couponId);
    const key = randomUUID();
    const sale = { mode: "quick" as const, total: "1.00" };

    const sold = await sell(world, customer, sale, { couponId }, key);
    expect(sold.order).toMatchObject({
      unitsGranted: 10,
      balanceAfter: 12,
      total: "1.00",
      grossTotal: "1.00",
      coupon: {
        label: "2 puntos extra",
        discountAmount: "0.00",
        extraUnits: 2,
      },
    });
    expect((await readBalances(customer.membershipId)).points).toBe(12);
    const [order] = await ordersOf(world, customer);
    expect(order).toMatchObject({ total: "1.00", units: 10 });
    // By SQL: the extra lives on the coupon's row, tied to the order.
    const { rows } = await getDb().execute<{
      order_id: string;
      units_granted: number;
      balance_after: number;
    }>(sql`select order_id, units_granted, balance_after
      from core.coupon_redemption where coupon_id = ${couponId}`);
    const [row] = rows;
    expect(row).toEqual({
      order_id: order.id,
      units_granted: 2,
      balance_after: 12,
    });

    const again = await sell(world, customer, sale, { couponId }, key);
    expect(again.order).toEqual(sold.order);
    expect((await readBalances(customer.membershipId)).points).toBe(12);
  }, 180_000);

  it("ORACULO DE M1 — a coupon that is no longer the choice (the customer switched): 409 coupon_not_selected, no order, no redemption", async () => {
    const customer = await scannedCustomer(world);
    const first = await welcomeCoupon(world, customer, {
      kind: "discount",
      label: "50% en tu compra",
      discountUnit: "percent",
      discountValue: "50",
    });
    const second = await secondCoupon(world, customer);
    await choose(customer, first);
    await choose(customer, second);

    await expect(
      sell(
        world,
        customer,
        { mode: "quick", total: "20.00" },
        { couponId: first },
      ),
    ).rejects.toMatchObject({ status: 409, code: "coupon_not_selected" });
    expect(await ordersOf(world, customer)).toEqual([]);
    expect(await redemptionsOf(first)).toEqual([]);
    expect(await selectionOf(customer)).toBe(second);
  }, 180_000);
});
