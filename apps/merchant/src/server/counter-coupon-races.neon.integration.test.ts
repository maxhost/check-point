import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import {
  type CouponWorld,
  couponBody,
  dropCouponWorld,
  newCouponCard,
  readCoupons,
  seedCouponWorld,
} from "./counter-coupon-support";
import { redeemCoupon } from "./counter/coupon";

/**
 * Spec 0065 phase C — the coupon under REAL concurrency against Neon.
 *
 * Two races, and they are NOT the same guard (the lesson of spec 0055, where a plan of
 * mutations claimed one test covered the lock and the measurement said otherwise):
 *
 *  - **Same turn.** Here `unique (turn_id)` alone is already sufficient: the loser's
 *    `23505` aborts its whole transaction, so removing the `FOR UPDATE` would leave this
 *    GREEN. It is kept because it is a DoD item, not because it pins the lock.
 *  - **Different turns, one slot left in the cap.** THIS is the lock's oracle. There is
 *    no unique key to collide on — two different turns, two different rows — so the only
 *    thing that stops both from passing `count < cap` is the campaign's `FOR UPDATE`.
 *
 * A single pair of requests may not interleave, so the same-turn race repeats over fresh
 * cards; the cap race is deterministic by construction.
 */

const RACES = 4;
const CONCURRENCY = 4;
const worlds: CouponWorld[] = [];

afterAll(async () => {
  for (const world of worlds.splice(0)) await dropCouponWorld(world);
}, 120_000);

async function world(prefix: string, cap?: number): Promise<CouponWorld> {
  const created = await seedCouponWorld(prefix, cap);
  worlds.push(created);
  return created;
}

describe.skipIf(!integrationEnabled)("coupon races (spec 0065 C)", () => {
  for (let attempt = 1; attempt <= RACES; attempt += 1) {
    it(`race ${attempt}/${RACES}: ${CONCURRENCY} concurrent redemptions of the SAME turn leave ONE row`, async () => {
      const w = await world(`Carrera mismo turno ${attempt}`);
      const card = await newCouponCard(w);
      const body = couponBody(card, w.seed, randomUUID());

      const settled = await Promise.allSettled(
        Array.from({ length: CONCURRENCY }, () =>
          redeemCoupon(w.seed.business, w.seed.userId, body),
        ),
      );

      // Every caller gets a 2xx: the losers are absorbed by the idempotent read under
      // the lock, or by the `23505` backstop followed by a reread.
      expect(
        settled
          .filter((r) => r.status === "rejected")
          .map((r) => String(r.reason)),
      ).toEqual([]);
      const rows = await readCoupons(w.campaignId);
      expect(rows).toHaveLength(1);
      expect(rows[0].turnId).toBe(card.turnId);
    }, 180_000);
  }

  it("with ONE slot left in the cap, two DIFFERENT turns leave ONE row", async () => {
    // cap 2, one already handed over → exactly one slot. Without the campaign's
    // `FOR UPDATE` both readers see `count = 1 < 2` and both insert.
    const w = await world("Carrera cupo", 2);
    const spent = await newCouponCard(w);
    await redeemCoupon(
      w.seed.business,
      w.seed.userId,
      couponBody(spent, w.seed),
    );
    expect(await readCoupons(w.campaignId)).toHaveLength(1);

    const a = await newCouponCard(w);
    const b = await newCouponCard(w);
    const settled = await Promise.allSettled([
      redeemCoupon(w.seed.business, w.seed.userId, couponBody(a, w.seed)),
      redeemCoupon(w.seed.business, w.seed.userId, couponBody(b, w.seed)),
    ]);

    const rows = await readCoupons(w.campaignId);
    expect(rows).toHaveLength(2);
    // One winner, one named refusal — never two rows and never a 503.
    const rejected = settled.filter((r) => r.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
      code: "coupon_cap_reached",
    });
  }, 180_000);
});
