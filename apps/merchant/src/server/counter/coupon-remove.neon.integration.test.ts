import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "../counter-integration-support";
import {
  type CouponWorld,
  chooseAndValidate,
  chooseCoupon,
  dropCouponWorld,
  newCouponCard,
  readCoupons,
  readTurn,
  seedCouponWorld,
} from "../counter-coupon-support";
import { getDb } from "@mi-pasaporte/db";
import { couponRedemptions } from "@mi-pasaporte/db/schema";
import { removeCoupon } from "./coupon-remove";
import { grantAccrual } from "./grant";
import { listConsumerCoupons } from "@mi-pasaporte/domain/server/consumer/coupons";

/**
 * Spec 0148 / ADR 0119 §10 — the counter TAKES BACK a coupon, against Neon. The world is the
 * proximity one (`counter-coupon-support.ts`): every card is created by the scan and its
 * coupon comes from a TURN, so «the turn loses its outcome» has something to lose.
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
  it("a VALIDATED one: the row goes, the turn loses its outcome, and the coupon is `valid` again and not chosen", async () => {
    const card = await newCouponCard(world);
    await chooseAndValidate(world, card);
    expect((await readTurn(card.turnId)).outcome).toBe("coupon_redeemed");

    expect(await remove(card)).toEqual({ removed: "validated" });
    expect(await ownRows(card.couponId)).toEqual([]);
    expect(await readTurn(card.turnId)).toMatchObject({
      outcome: null,
      outcomeRedemptionId: null,
      outcomeAt: null,
    });
    expect(await e3(card.consumerId, card.couponId)).toMatchObject({
      status: "valid",
      selected: false,
    });
    // It is the customer's again: choosing and validating it works.
    await expect(chooseAndValidate(world, card)).resolves.toMatchObject({
      coupon: { label: expect.any(String) },
    });
  }, 180_000);

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
    await chooseAndValidate(world, card);
    await grantAccrual(world.seed.business, world.seed.userId, {
      clientRequestId: randomUUID(),
      membershipId: card.membershipId,
      locationId: world.seed.locationId,
      mode: "quick",
      total: "12.00",
      note: "2x1 en picadas",
      coupon: { couponId: card.couponId },
    });
    const [tied] = await ownRows(card.couponId);
    expect(tied).toBeDefined();

    await expect(remove(card)).rejects.toMatchObject({
      status: 409,
      code: "coupon_not_removable",
    });
    expect(await ownRows(card.couponId)).toEqual([tied]);
  }, 180_000);

  it("an EXTRA coupon (credited when validated), or one neither validated nor chosen: 409 coupon_not_removable", async () => {
    const extra = await newCouponCard(world, {
      extra: { kind: "extra_points", units: 5 },
    });
    await chooseAndValidate(world, extra);
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

  it("a coupon validated YESTERDAY: 409 coupon_not_removable", async () => {
    const card = await newCouponCard(world);
    await chooseAndValidate(world, card);
    await getDb()
      .update(couponRedemptions)
      .set({ createdAt: new Date(Date.now() - 86_400_000) })
      .where(eq(couponRedemptions.couponId, card.couponId));
    await expect(remove(card)).rejects.toMatchObject({
      status: 409,
      code: "coupon_not_removable",
    });
  }, 180_000);
});
