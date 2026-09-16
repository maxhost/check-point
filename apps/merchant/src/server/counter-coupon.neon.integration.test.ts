import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  readBalances,
} from "./counter-integration-support";
import {
  COUPON_COST,
  COUPON_LABEL,
  type CouponWorld,
  couponBody,
  dropCouponWorld,
  newCouponCard,
  readCoupons,
  readPushes,
  readTurn,
  seedCouponWorld,
} from "./counter-coupon-support";
import { redeemCoupon } from "./counter/coupon";
import { resolveScan } from "./counter/resolve";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { campaigns } from "./schema";

/**
 * Spec 0065 phase C — the coupon at the counter, against Neon.
 *
 * Every assertion that carries weight reads the DATABASE, never the returned object: an
 * API that reports a state it did not write is the failure ADR 0054 exists about.
 */
describe.skipIf(!integrationEnabled)("coupon redemption (spec 0065 C)", () => {
  let world: CouponWorld;

  beforeAll(async () => {
    world = await seedCouponWorld("Cupon");
  }, 60_000);

  afterAll(async () => {
    await dropCouponWorld(world);
  }, 60_000);

  it("the scan shows the live coupon, and stops showing it once handed over", async () => {
    const card = await newCouponCard(world);

    const before = await resolveScan(world.seed.business, card.qrToken);
    expect(before.coupon).toMatchObject({
      turnId: card.turnId,
      label: COUPON_LABEL,
    });
    // EXACT allow-list, the shape `counter-redeem-surfaces` pins for the rest of the DTO
    // and cannot pin here (its world has no campaign, so `coupon` is null there). Any
    // new field — whatever it is called — turns this red until someone adds it on
    // purpose. Nothing internal travels: no consumer id, no membership id, no
    // `client_request_id`, no `*ObjectKey`.
    expect(Object.keys(before.coupon as object).sort()).toEqual([
      "campaignName",
      "label",
      "turnId",
      "windowEnd",
    ]);

    await redeemCoupon(
      world.seed.business,
      world.seed.userId,
      couponBody(card, world.seed),
    );

    // The turn stays `active` until the tick closes its window, so without the
    // `outcome` filter the panel would keep offering a button that always answers 409.
    const after = await resolveScan(world.seed.business, card.qrToken);
    expect(after.coupon).toBeNull();
  }, 120_000);

  it("writes the row and the outcome, and does NOT touch points or stamps", async () => {
    const card = await newCouponCard(world);
    const before = await readBalances(card.membershipId);

    const result = await redeemCoupon(
      world.seed.business,
      world.seed.userId,
      couponBody(card, world.seed),
    );

    expect(result.coupon.label).toBe(COUPON_LABEL);
    const rows = (await readCoupons(world.campaignId)).filter(
      (row) => row.turnId === card.turnId,
    );
    expect(rows).toHaveLength(1);
    // The SNAPSHOT of the turn, not the campaign's current coupon.
    expect(rows[0]).toMatchObject({
      labelSnapshot: COUPON_LABEL,
      costSnapshot: COUPON_COST,
    });
    const turn = await readTurn(card.turnId);
    expect(turn.outcome).toBe("coupon_redeemed");
    expect(turn.outcomeRedemptionId).toBe(rows[0].id);
    expect(turn.outcomeAt).not.toBeNull();
    // By SQL, before and after: a coupon is not a redemption of the loyalty balance.
    expect(await readBalances(card.membershipId)).toEqual(before);
    expect(before.points).toBeGreaterThan(0);
  }, 120_000);

  it("honours the TURN's snapshot, not the campaign's coupon as it reads today", async () => {
    // The scenario the docblock names: the owner pauses the campaign, edits its coupon,
    // and a turn that is still live carries what it PROMISED. Without this the fixture's
    // snapshot and the campaign's current coupon are the same values and the invariant
    // has no oracle at all — found by mutation C4 coming out green.
    const card = await newCouponCard(world);
    await getDb()
      .update(campaigns)
      .set({ couponLabel: "3x1 rebautizado", couponCost: "9.99" })
      .where(eq(campaigns.id, world.campaignId));

    try {
      const result = await redeemCoupon(
        world.seed.business,
        world.seed.userId,
        couponBody(card, world.seed),
      );

      expect(result.coupon.label).toBe(COUPON_LABEL);
      const [row] = (await readCoupons(world.campaignId)).filter(
        (r) => r.turnId === card.turnId,
      );
      expect(row).toMatchObject({
        labelSnapshot: COUPON_LABEL,
        costSnapshot: COUPON_COST,
      });
      const pushes = await readPushes(card.consumerId);
      expect(pushes).toHaveLength(1);
      expect(pushes[0].body).toContain(COUPON_LABEL);
    } finally {
      // In a `finally` on purpose: the other cases SHARE this world, so a red here must
      // not leave the campaign renamed and turn the next case red for the wrong reason
      // (measured while running mutation C4 — it produced exactly that second red).
      await getDb()
        .update(campaigns)
        .set({ couponLabel: COUPON_LABEL, couponCost: COUPON_COST })
        .where(eq(campaigns.id, world.campaignId));
    }
  }, 120_000);

  it("enqueues ONE transactional notice carrying the label snapshot", async () => {
    const card = await newCouponCard(world);

    await redeemCoupon(
      world.seed.business,
      world.seed.userId,
      couponBody(card, world.seed),
    );

    const pushes = await readPushes(card.consumerId);
    expect(pushes).toHaveLength(1);
    // `transactional`, not `campaign`: it is the receipt of something that just
    // happened at the counter, so it is not subject to the marketing cooldown.
    expect(pushes[0].class).toBe("transactional");
    expect(pushes[0].body).toContain(COUPON_LABEL);
  }, 120_000);

  it("the same clientRequestId answers 200 with the SAME row, never 409", async () => {
    const card = await newCouponCard(world);
    const body = couponBody(card, world.seed, randomUUID());

    const first = await redeemCoupon(
      world.seed.business,
      world.seed.userId,
      body,
    );
    const second = await redeemCoupon(
      world.seed.business,
      world.seed.userId,
      body,
    );

    expect(second.coupon.label).toBe(first.coupon.label);
    expect(
      (await readCoupons(world.campaignId)).filter(
        (row) => row.turnId === card.turnId,
      ),
    ).toHaveLength(1);
    // And the retry did NOT re-notify: one push, not two.
    expect(await readPushes(card.consumerId)).toHaveLength(1);
  }, 120_000);

  it("a DIFFERENT clientRequestId over a redeemed coupon is 409 already_redeemed", async () => {
    const card = await newCouponCard(world);
    await redeemCoupon(
      world.seed.business,
      world.seed.userId,
      couponBody(card, world.seed),
    );

    await expect(
      redeemCoupon(
        world.seed.business,
        world.seed.userId,
        couponBody(card, world.seed),
      ),
    ).rejects.toMatchObject({ status: 409, code: "already_redeemed" });
  }, 120_000);

  it("a turn of ANOTHER business is 404, never 403", async () => {
    const other = await seedCouponWorld("Cupon ajeno");
    try {
      const card = await newCouponCard(other);
      await expect(
        redeemCoupon(
          world.seed.business,
          world.seed.userId,
          couponBody(card, world.seed),
        ),
      ).rejects.toMatchObject({ status: 404, code: "unknown_turn" });
    } finally {
      await dropCouponWorld(other);
    }
  }, 120_000);

  it("a holdout turn is refused: the consumer never saw the offer", async () => {
    const card = await newCouponCard(world, { holdout: true });
    await expect(
      redeemCoupon(
        world.seed.business,
        world.seed.userId,
        couponBody(card, world.seed),
      ),
    ).rejects.toMatchObject({ status: 409, code: "turn_not_active" });
  }, 120_000);
});
