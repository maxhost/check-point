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
  chooseAndValidate,
  chooseCoupon,
  couponBody,
  dropCouponWorld,
  newCouponCard,
  readCoupons,
  readPushes,
  readTurn,
  seedCouponWorld,
} from "./counter-coupon-support";
import { validateCoupon } from "./counter/coupon-validate";
import { resolveScan } from "./counter/resolve";
import { eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";

/**
 * Spec 0065 phase C — the coupon at the counter, against Neon.
 *
 * Every assertion that carries weight reads the DATABASE, never the returned object: an
 * API that reports a state it did not write is the failure ADR 0054 exists about.
 *
 * Spec 0148: the consumer CHOOSES the coupon in the PWA and the counter VALIDATES it
 * (`chooseAndValidate`); the scan paints `couponState` instead of the old single coupon.
 */
describe.skipIf(!integrationEnabled)(
  "coupon redemption (spec 0065 C / 0102)",
  () => {
    let world: CouponWorld;

    beforeAll(async () => {
      world = await seedCouponWorld("Cupon");
    }, 60_000);

    afterAll(async () => {
      await dropCouponWorld(world);
    }, 60_000);

    it("the scan shows the chosen coupon, and then that it was validated", async () => {
      const card = await newCouponCard(world);

      // Not chosen yet: the counter only sees the advice (ADR 0119 §3).
      const unchosen = await resolveScan(world.seed.business, card.qrToken);
      expect(unchosen.couponState).toEqual({ status: "hint", count: 1 });

      await chooseCoupon(card);
      const before = await resolveScan(world.seed.business, card.qrToken);
      expect(before.couponState).toMatchObject({
        status: "selected",
        coupon: {
          couponId: card.couponId,
          label: COUPON_LABEL,
          validUntil: world.endsAt,
        },
      });
      // EXACT allow-list, the shape `counter-redeem-surfaces` pins for the rest of the DTO
      // and cannot pin here (its world has no campaign). Any new field — whatever it is
      // called — turns this red until someone adds it on purpose. Nothing internal travels:
      // no consumer id, no membership id, no `client_request_id`, no `*ObjectKey`, no cost.
      // Spec 0148 (contract M0): the product travels, the campaign name does not.
      const painted = before.couponState as { coupon: object };
      expect(Object.keys(painted.coupon).sort()).toEqual([
        "couponId",
        "currencyCode",
        "discountUnit",
        "discountValue",
        "extraUnits",
        "kind",
        "label",
        "productId",
        "productName",
        "rule",
        "validUntil",
      ]);

      await validateCoupon(
        world.seed.business,
        world.seed.userId,
        couponBody(card, world.seed),
      );

      // Validated, not consumed: the counter sees it as such until the sale ties it.
      const after = await resolveScan(world.seed.business, card.qrToken);
      expect(after.couponState).toMatchObject({
        status: "validated",
        coupon: { couponId: card.couponId },
      });
    }, 120_000);

    it("writes the row and the outcome, and does NOT touch points or stamps", async () => {
      const card = await newCouponCard(world);
      const before = await readBalances(card.membershipId);

      const result = await chooseAndValidate(world, card);

      expect(result.coupon.label).toBe(COUPON_LABEL);
      const rows = (await readCoupons(world.campaignId)).filter(
        (row) => row.couponId === card.couponId,
      );
      expect(rows).toHaveLength(1);
      // The SNAPSHOT of the coupon, not the campaign's current coupon.
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

    it("honours the COUPON's snapshot, not the campaign's coupon as it reads today", async () => {
      // The scenario the docblock names: the owner pauses the campaign, edits its coupon,
      // and a coupon already issued carries what it PROMISED. Without this the fixture's
      // snapshot and the campaign's current coupon are the same values and the invariant
      // has no oracle at all — found by mutation C4 coming out green.
      const card = await newCouponCard(world);
      await getDb()
        .update(campaigns)
        .set({ couponLabel: "3x1 rebautizado", couponCost: "9.99" })
        .where(eq(campaigns.id, world.campaignId));

      try {
        const result = await chooseAndValidate(world, card);

        expect(result.coupon.label).toBe(COUPON_LABEL);
        const [row] = (await readCoupons(world.campaignId)).filter(
          (r) => r.couponId === card.couponId,
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

      await chooseAndValidate(world, card);

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
      await chooseCoupon(card);

      const first = await validateCoupon(
        world.seed.business,
        world.seed.userId,
        body,
      );
      const second = await validateCoupon(
        world.seed.business,
        world.seed.userId,
        body,
      );

      expect(second.coupon.label).toBe(first.coupon.label);
      expect(
        (await readCoupons(world.campaignId)).filter(
          (row) => row.couponId === card.couponId,
        ),
      ).toHaveLength(1);
      // And the retry did NOT re-notify: one push, not two.
      expect(await readPushes(card.consumerId)).toHaveLength(1);
    }, 120_000);

    it("a DIFFERENT clientRequestId over a validated coupon is 409 coupon_not_selected", async () => {
      // Spec 0148: the validation SPENDS the consumer's choice, so a second request with
      // another key finds nothing chosen — before the `already_redeemed` of the decision.
      const card = await newCouponCard(world);
      await chooseAndValidate(world, card);

      await expect(
        validateCoupon(
          world.seed.business,
          world.seed.userId,
          couponBody(card, world.seed),
        ),
      ).rejects.toMatchObject({ status: 409, code: "coupon_not_selected" });
      expect(
        (await readCoupons(world.campaignId)).filter(
          (row) => row.couponId === card.couponId,
        ),
      ).toHaveLength(1);
    }, 120_000);

    it("(c) a coupon of ANOTHER business is 404 unknown_coupon, never 403", async () => {
      const other = await seedCouponWorld("Cupon ajeno");
      try {
        // Spec 0148: the validation names a membership of THIS business; the coupon is the
        // other business's (same consumer would not change it: it is scoped by business).
        const mine = await newCouponCard(world);
        const card = await newCouponCard(other);
        await expect(
          validateCoupon(world.seed.business, world.seed.userId, {
            ...couponBody(mine, world.seed),
            couponId: card.couponId,
          }),
        ).rejects.toMatchObject({ status: 404, code: "unknown_coupon" });
      } finally {
        await dropCouponWorld(other);
      }
    }, 120_000);
  },
);
