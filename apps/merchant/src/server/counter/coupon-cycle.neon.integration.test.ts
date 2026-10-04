import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  readBalances,
} from "../counter-integration-support";
import {
  type CycleWorld,
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
import { resolveScan } from "./resolve";
import { listTodaysAccreditations } from "./history";
import { listConsumerCoupons } from "@mi-pasaporte/domain/server/consumer/coupons";

/**
 * Spec 0148 — THE CHOSEN COUPON, from the PWA to the sale, against Neon (world in
 * `coupon-cycle-support.ts`: production shape). Every assertion that carries weight reads
 * the DATABASE (ADR 0054 §4). Points: 10 per 1.00, so «units over the net» is visible.
 * Spec 0153: there is no «validate» — the scan paints the choice with its verdict and the
 * sale applies it.
 */

let world: CycleWorld;

beforeAll(async () => {
  world = await seedCycleWorld("Cupon elegido");
}, 120_000);

afterAll(async () => {
  if (world) await dropCycleWorld(world);
}, 120_000);

const state = (membershipId: string) =>
  getCouponState(world.seed.business, membershipId).then((r) => r.couponState);

describe.skipIf(!integrationEnabled)("the chosen coupon (spec 0148)", () => {
  it("ORACULO DE M10 — choose → scan (green) → detailed sale: the order is the NET and the coupon is tied to it", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await welcomeCoupon(world, customer, {
      kind: "two_for_one",
      label: "2x1 en medialunas",
      productId: world.medialuna,
    });
    await choose(customer, couponId);

    const scan = await resolveScan(world.seed.business, customer.qrToken);
    expect(scan.couponState).toMatchObject({
      status: "selected",
      coupon: { couponId, kind: "two_for_one", productName: "Medialuna" },
      verdict: { valid: true },
    });

    // 2 medialunas (7.00) + 1 café (2.00) = 9.00; one medialuna off → 5.50 → 50 points.
    const sold = await sell(
      world,
      customer,
      {
        mode: "detailed",
        items: [
          { productId: world.medialuna, quantity: 2 },
          { productId: world.cafe, quantity: 1 },
        ],
      },
      { couponId },
    );
    expect(sold.order).toMatchObject({
      total: "5.50",
      grossTotal: "9.00",
      coupon: { label: "2x1 en medialunas", discountAmount: "3.50" },
    });
    const [order] = await ordersOf(world, customer);
    expect(order).toMatchObject({ total: "5.50", units: 50 });
    expect(await redemptionsOf(couponId)).toEqual([
      expect.objectContaining({ orderId: order.id, discountAmount: "3.50" }),
    ]);
    expect((await readBalances(customer.membershipId)).points).toBe(50);
    expect(await selectionOf(customer)).toBeNull();
    expect(await state(customer.membershipId)).toEqual({
      status: "used_today",
      label: "2x1 en medialunas",
    });
    const history = await listTodaysAccreditations(
      world.seed.business.id,
      "America/Guayaquil",
      new Date(),
    );
    expect(
      history.filter((entry) => entry.entryKind === "coupon"),
    ).toContainEqual(
      expect.objectContaining({ rewardLabel: "2x1 en medialunas" }),
    );
  }, 180_000);

  it("ORACULO DE M1 — 50 % off 20.00 in a quick sale: total 10.00 and the units over 10.00 (ADR 0119 §12)", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await welcomeCoupon(world, customer, {
      kind: "discount",
      label: "50% en tu compra",
      discountUnit: "percent",
      discountValue: "50",
    });
    await choose(customer, couponId);

    const sold = await sell(
      world,
      customer,
      { mode: "quick", total: "20.00" },
      { couponId },
    );
    expect(sold.order).toMatchObject({
      total: "10.00",
      grossTotal: "20.00",
      unitsGranted: 100,
    });
    const [order] = await ordersOf(world, customer);
    expect(order).toMatchObject({ total: "10.00", units: 100 });
    expect((await readBalances(customer.membershipId)).points).toBe(100);
    expect(await redemptionsOf(couponId)).toEqual([
      expect.objectContaining({ orderId: order.id, discountAmount: "10.00" }),
    ]);
  }, 180_000);

  it("a discount applies in a DETAILED sale too", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await welcomeCoupon(world, customer, {
      kind: "discount",
      label: "50% en tu compra",
      discountUnit: "percent",
      discountValue: "50",
    });
    await choose(customer, couponId);

    const sold = await sell(
      world,
      customer,
      {
        mode: "detailed",
        items: [{ productId: world.medialuna, quantity: 3 }],
      },
      { couponId },
    );
    // 10.50 → half-up 5.25 off → 5.25.
    expect(sold.order).toMatchObject({ total: "5.25", grossTotal: "10.50" });
    expect(await ordersOf(world, customer)).toEqual([
      expect.objectContaining({ total: "5.25", units: 50 }),
    ]);
  }, 180_000);

  it("a fixed 15.00 over a 10.00 sale charges 0.00 and grants nothing (ADR 0119 §13)", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await welcomeCoupon(world, customer, {
      kind: "discount",
      label: "15 de regalo",
      discountUnit: "amount",
      discountValue: "15.00",
    });
    await choose(customer, couponId);
    const sold = await sell(
      world,
      customer,
      { mode: "quick", total: "10.00" },
      { couponId },
    );
    expect(sold.order).toMatchObject({ total: "0.00", unitsGranted: 0 });
    expect(await redemptionsOf(couponId)).toEqual([
      expect.objectContaining({ discountAmount: "10.00" }),
    ]);
  }, 180_000);

  it("the same clientRequestId of a sale with a coupon, twice: ONE order, ONE redemption, points once", async () => {
    const customer = await scannedCustomer(world);
    const couponId = await welcomeCoupon(world, customer, {
      kind: "discount",
      label: "50% en tu compra",
      discountUnit: "percent",
      discountValue: "50",
    });
    await choose(customer, couponId);
    const key = randomUUID();
    const sale = { mode: "quick" as const, total: "20.00" };
    const first = await sell(world, customer, sale, { couponId }, key);
    const again = await sell(world, customer, sale, { couponId }, key);
    expect(again.order).toEqual(first.order);
    expect(await ordersOf(world, customer)).toHaveLength(1);
    expect(await redemptionsOf(couponId)).toHaveLength(1);
    expect((await readBalances(customer.membershipId)).points).toBe(100);
  }, 180_000);

  it("ORACULO DE M8 — a coupon the customer did NOT choose: the sale is 409 coupon_not_selected, nothing written", async () => {
    const customer = await scannedCustomer(world);
    const twoForOne = await welcomeCoupon(world, customer, {
      kind: "two_for_one",
      label: "2x1 en medialunas",
      productId: world.medialuna,
    });
    await expect(
      sell(
        world,
        customer,
        {
          mode: "detailed",
          items: [{ productId: world.medialuna, quantity: 2 }],
        },
        { couponId: twoForOne },
      ),
    ).rejects.toMatchObject({ status: 409, code: "coupon_not_selected" });
    expect(await redemptionsOf(twoForOne)).toEqual([]);
    expect(await ordersOf(world, customer)).toEqual([]);
  }, 180_000);

  it("the customer chooses AFTER the scan: coupon-state goes from hint to selected without re-scanning; another choice frees the first", async () => {
    const customer = await scannedCustomer(world);
    const first = await welcomeCoupon(world, customer, {
      kind: "free_product",
      label: "Medialuna gratis",
      productId: world.medialuna,
    });
    const second = await secondCoupon(world, customer);
    expect(await state(customer.membershipId)).toEqual({
      status: "hint",
      count: 2,
    });
    await choose(customer, first);
    expect(await state(customer.membershipId)).toMatchObject({
      status: "selected",
      coupon: { couponId: first },
    });
    await choose(customer, second);
    expect(await state(customer.membershipId)).toMatchObject({
      status: "selected",
      coupon: { couponId: second },
    });
    const { coupons } = await listConsumerCoupons(customer.consumerId);
    expect(
      coupons
        .filter((c) => c.id === first || c.id === second)
        .map((c) => [c.id, c.status, c.selected]),
    ).toEqual(
      expect.arrayContaining([
        [first, "valid", false],
        [second, "valid", true],
      ]),
    );
  }, 180_000);
});
