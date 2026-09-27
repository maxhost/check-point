import { randomUUID } from "node:crypto";
import { campaignCoupons, couponRedemptions } from "./schema";
import { getDb } from "./db";

/**
 * Seeds of the campaign coupon (spec 0102) for the integration suites, split from
 * `marketing-integration-support.ts` by the file-size budget.
 *
 * A seeded coupon has the shape of one the tick issues: `valid_from < valid_until`
 * (`core_campaign_coupon_validity_check`), snapshots copied, and — when it comes from
 * proximity — the `turn_id` of its turn.
 */

const EPOCH = new Date("2026-01-01T00:00:00.000Z");
const FAR = new Date("2099-01-01T00:00:00.000Z");

export async function seedCampaignCoupon(opts: {
  campaignId: string;
  businessId: string;
  consumerId: string;
  membershipId: string;
  turnId: string | null;
  label?: string;
  cost?: string;
  validFrom?: Date;
  validUntil?: Date;
}): Promise<string> {
  const [row] = await getDb()
    .insert(campaignCoupons)
    .values({
      campaignId: opts.campaignId,
      businessId: opts.businessId,
      consumerId: opts.consumerId,
      membershipId: opts.membershipId,
      turnId: opts.turnId,
      labelSnapshot: opts.label ?? "2x1 en picadas",
      costSnapshot: opts.cost ?? "3.00",
      validFrom: opts.validFrom ?? EPOCH,
      validUntil: opts.validUntil ?? FAR,
    })
    .returning({ id: campaignCoupons.id });
  return row.id;
}

/** A coupon handed over at the counter. Phase C owns the route; the tick only needs the
 * ROW to exist to write `outcome = 'coupon_redeemed'`. Since spec 0102 a redemption points
 * at a COUPON, so this seeds the turn's coupon first and redeems that one. */
export async function seedCouponRedemption(opts: {
  turnId: string;
  campaignId: string;
  businessId: string;
  consumerId: string;
  membershipId: string;
  locationId: string | null;
  userId: string;
  /** The cost the counter honoured. Left open because results sum the SNAPSHOTS, and a
   * fixture where every row carries the same number cannot tell that from `n × costo`. */
  costSnapshot?: string;
}): Promise<string> {
  const couponId = await seedCampaignCoupon({
    campaignId: opts.campaignId,
    businessId: opts.businessId,
    consumerId: opts.consumerId,
    membershipId: opts.membershipId,
    turnId: opts.turnId,
    cost: opts.costSnapshot,
  });
  const [row] = await getDb()
    .insert(couponRedemptions)
    .values({
      couponId,
      campaignId: opts.campaignId,
      businessId: opts.businessId,
      consumerId: opts.consumerId,
      membershipId: opts.membershipId,
      locationId: opts.locationId,
      labelSnapshot: "2x1 en picadas",
      costSnapshot: opts.costSnapshot ?? "3.00",
      createdByUserId: opts.userId,
      clientRequestId: randomUUID(),
    })
    .returning({ id: couponRedemptions.id });
  return row.id;
}
