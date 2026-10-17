import { analyticsMoney } from "./analytics-events";
import { appendModuleEvent } from "../module-events/append";
import { eq } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { campaignTurns, couponRedemptions } from "@mi-pasaporte/db/schema";
import type { LockedCoupon } from "./coupon-locks";

/**
 * The DB half of the coupon redemption row (spec 0065 phase C; over `campaign_coupon` since
 * spec 0102; since spec 0153 the ONLY writer is the sale, `grant-coupon.ts`). The decisions
 * live in `coupon-decision.ts` and `coupon-discount.ts`; the locks and the day in
 * `coupon-locks.ts`; the facts of the verdict in `coupon-verdict.ts`.
 */

/**
 * Writes the redemption row of a LOCKED coupon, in the sale's transaction, tied to its order:
 *
 *  - label, cost, kind and product are SNAPSHOTS of the coupon, never of the campaign as it
 *    reads today: editing a campaign may not restate what the counter already handed over;
 *  - `grant`: what an `extra_*` coupon credited (`grantCouponExtras`), `null` for the rest;
 *  - no visit of its own (spec 0108): the redemption is always tied to its order, and the
 *    order already moves `last_visit_at` in this same transaction, at the same `now()`;
 *  - when the coupon came from a turn, that turn's outcome (the turn is still proximity's
 *    unit of measurement, ADR 0093 §3). DECLARED: a coupon whose turn was CANCELLED still
 *    marks it `coupon_redeemed` (spec 0102 step 4); results count only `done` turns.
 *
 * No push of its own: the order already enqueues the sale's (spec 0148, «No entra»).
 */
export async function insertCounterRedemption(
  tx: DbTransaction,
  input: {
    locked: LockedCoupon;
    businessId: string;
    membershipId: string;
    locationId: string | null;
    createdByUserId: string;
    clientRequestId: string;
    grant: { unitsGranted: number; balanceAfter: number } | null;
    orderId: string;
    discountAmount: string;
    now: Date;
    salesAmount: string;
    currencyCode: string;
  },
): Promise<void> {
  const { coupon, campaign } = input.locked;
  const [row] = await tx
    .insert(couponRedemptions)
    .values({
      couponId: coupon.id,
      campaignId: campaign.id,
      businessId: input.businessId,
      consumerId: coupon.consumerId,
      membershipId: input.membershipId,
      locationId: input.locationId,
      labelSnapshot: coupon.labelSnapshot,
      costSnapshot: coupon.costSnapshot,
      kindSnapshot: coupon.kindSnapshot,
      productId: coupon.productId,
      unitsGranted: input.grant?.unitsGranted ?? null,
      balanceAfter: input.grant?.balanceAfter ?? null,
      orderId: input.orderId,
      discountAmount: input.discountAmount,
      createdByUserId: input.createdByUserId,
      clientRequestId: input.clientRequestId,
    })
    .returning({ id: couponRedemptions.id });
  const money = analyticsMoney(input.discountAmount, input.currencyCode);
  await appendModuleEvent(tx, {
    businessId: input.businessId,
    eventType: "coupon.redeemed",
    eventVersion: 1,
    sourceId: coupon.id,
    locationId: input.locationId,
    payload: {
      eventVersion: 1,
      couponId: coupon.id,
      campaignId: campaign.id,
      campaignLabel: campaign.name,
      locationId: input.locationId,
      occurredAt: input.now.toISOString(),
      discountMinor: money.amountMinor,
      salesMinor: analyticsMoney(input.salesAmount, input.currencyCode)
        .amountMinor,
      costMinor: analyticsMoney(coupon.costSnapshot, input.currencyCode)
        .amountMinor,
      currencyCode: money.currencyCode,
      minorUnit: money.minorUnit,
    },
  });
  if (coupon.turnId !== null)
    await tx
      .update(campaignTurns)
      .set({
        outcome: "coupon_redeemed",
        outcomeRedemptionId: row.id,
        outcomeAt: input.now,
      })
      .where(eq(campaignTurns.id, coupon.turnId));
}
