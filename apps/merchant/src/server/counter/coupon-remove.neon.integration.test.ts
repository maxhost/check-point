import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../counter-integration-support";
import {
  type CouponWorld,
  chooseAndSell,
  chooseCoupon,
  dropCouponWorld,
  newCouponCard,
  readCoupons,
  seedCouponWorld,
} from "../counter-coupon-support";
import { removeCoupon } from "./coupon-remove";
import { listConsumerCoupons } from "@mi-pasaporte/domain/server/consumer/coupons";

/**
 * Spec 0148 / ADR 0119 §10 — the counter TAKES BACK a coupon, against Neon. The world is the
 * proximity one (`counter-coupon-support.ts`): every card is created by the scan and its
 * coupon comes from a TURN. Spec 0153 / ADR 0120 §4: «Quitar» only clears the CHOICE (there
 * is no validated row to delete any more); the red choice is in `coupon-verdict`.
 */

let world: CouponWorld;

beforeAll(async () => {
  world = await seedCouponWorld("Cupon quitar");
}, 120_000);

afterAll(async () => {
  if (world) await dropCouponWorld(world);
}, 120_000);

const remove = (card: { membershipId: string; couponId: string }) =>
  removeCoupon(world.seed.business, {
    membershipId: card.membershipId,
    couponId: card.couponId,
  });

const ownRows = async (couponId: string) =>
  (await readCoupons(world.campaignId)).filter((r) => r.couponId === couponId);

async function e3(consumerId: string, couponId: string) {
  const { coupons } = await listConsumerCoupons(consumerId);
  return coupons.find((coupon) => coupon.id === couponId);
}

describe.skipIf(!integrationEnabled)("removing a coupon (spec 0148)", () => {
  it("a CHOSEN one (no row): the choice is cleared", async () => {
    const card = await newCouponCard(world);
    await chooseCoupon(card);
    expect(await remove(card)).toEqual({ removed: "selected" });
    expect(await e3(card.consumerId, card.couponId)).toMatchObject({
      status: "valid",
      selected: false,
    });
  }, 180_000);

  it("ORACULO DE M5 — after the SALE tied it: 409 coupon_not_removable, the row stays", async () => {
    const card = await newCouponCard(world);
    await chooseAndSell(world, card, undefined, "12.00");
    const [tied] = await ownRows(card.couponId);
    expect(tied).toBeDefined();

    await expect(remove(card)).rejects.toMatchObject({
      status: 409,
      code: "coupon_not_removable",
    });
    expect(await ownRows(card.couponId)).toEqual([tied]);
  }, 180_000);

  it("an EXTRA coupon (credited with its sale), or one never chosen: 409 coupon_not_removable", async () => {
    const extra = await newCouponCard(world, {
      extra: { kind: "extra_points", units: 5 },
    });
    await chooseAndSell(world, extra);
    await expect(remove(extra)).rejects.toMatchObject({
      status: 409,
      code: "coupon_not_removable",
    });
    expect(await ownRows(extra.couponId)).toHaveLength(1);

    const untouched = await newCouponCard(world);
    await expect(remove(untouched)).rejects.toMatchObject({
      status: 409,
      code: "coupon_not_removable",
    });
  }, 180_000);
});
