import { and, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb } from "@mi-pasaporte/db";
import {
  businesses,
  campaignTurns,
  couponRedemptions,
  walletPushQueue,
} from "@mi-pasaporte/db/schema";
import { buildCouponBody } from "../wallet/push";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
import { recordRedemptionVisit } from "@mi-pasaporte/domain/server/customers/projection";
import type { CouponKind } from "@mi-pasaporte/domain/server/marketing/reward-input";
import type { LockedCoupon } from "./coupon-locks";
import { decideCouponRedemption } from "./coupon-decision";

/**
 * The DB half of the coupon redemption row (spec 0065 phase C; over `campaign_coupon` since
 * spec 0102; spec 0148 split the flow into validate / remove / the sale): what every writer
 * of a `coupon_redemption` row shares. The decisions live in `coupon-decision.ts` and
 * `coupon-discount.ts`; the locks and the day in `coupon-locks.ts`.
 */

export type PersistedCoupon = {
  id: string;
  couponId: string;
  labelSnapshot: string;
  /** Spec 0106: the reward type, and what an `extra_*` coupon credited (`null` otherwise).
   * On an idempotent retry they are the STORED values, never recomputed. */
  kindSnapshot: CouponKind;
  unitsGranted: number | null;
  balanceAfter: number | null;
  /** The `wallet_push_queue` row enqueued in the SAME transaction; `null` on the
   * idempotent-retry path, so a retry never re-notifies the consumer. */
  pushQueueId: string | null;
};

export const redemptionColumns = {
  id: couponRedemptions.id,
  couponId: couponRedemptions.couponId,
  labelSnapshot: couponRedemptions.labelSnapshot,
  kindSnapshot: couponRedemptions.kindSnapshot,
  unitsGranted: couponRedemptions.unitsGranted,
  balanceAfter: couponRedemptions.balanceAfter,
};

/** A retry may only return the coupon it asked for. A `clientRequestId` reused over a
 * DIFFERENT coupon is refused rather than answered with somebody else's coupon. */
export function assertSameCoupon(
  previous: { couponId: string },
  couponId: string,
): void {
  if (previous.couponId !== couponId)
    throw new CounterError(
      409,
      "request_id_reused",
      "Ese identificador ya se usó para canjear otro cupón.",
    );
}

export async function readCouponByRequest(
  businessId: string,
  clientRequestId: string,
  executor: Pick<DbTransaction, "select"> = getDb(),
): Promise<Omit<PersistedCoupon, "pushQueueId"> | null> {
  const [row] = await executor
    .select(redemptionColumns)
    .from(couponRedemptions)
    .where(
      and(
        eq(couponRedemptions.businessId, businessId),
        eq(couponRedemptions.clientRequestId, clientRequestId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Spec 0065 step 3 under the locks: the count of the campaign's redemptions (its cap) and
 * whether this coupon already has a row, decided by the PURE `decideCouponRedemption`
 * (validity window, already redeemed, cap — in that order).
 */
export async function assertCouponRedeemable(
  tx: DbTransaction,
  locked: LockedCoupon,
  now: Date,
): Promise<void> {
  const [counted] = await tx
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.campaignId, locked.campaign.id));
  const [spent] = await tx
    .select({ id: couponRedemptions.id })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.couponId, locked.coupon.id))
    .limit(1);
  const decision = decideCouponRedemption({
    coupon: { ...locked.coupon, redeemed: spent !== undefined },
    campaign: locked.campaign,
    redeemedCount: counted?.total ?? 0,
    now,
  });
  if (!decision.ok)
    throw new CounterError(decision.status, decision.code, decision.message);
}

/**
 * Writes the redemption row of a LOCKED coupon, in the caller's transaction:
 *
 *  - label, cost, kind and product are SNAPSHOTS of the coupon, never of the campaign as it
 *    reads today: editing a campaign may not restate what the counter already handed over;
 *  - spec 0108: every coupon redemption at the counter is a visit — same transaction;
 *  - when the coupon came from a turn, that turn's outcome (the turn is still proximity's
 *    unit of measurement, ADR 0093 §3). DECLARED: a coupon whose turn was CANCELLED still
 *    marks it `coupon_redeemed` (spec 0102 step 4); results count only `done` turns;
 *  - `push`: the transactional receipt (ADR 0037) of the VALIDATION. The sale does not ask
 *    for it: the order already enqueues its own (spec 0148, «No entra»).
 *
 * Spec 0148: `orderId`/`discountAmount` are set when the coupon is tied to a sale at once.
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
    orderId: string | null;
    discountAmount: string | null;
    push: boolean;
    now: Date;
  },
): Promise<PersistedCoupon> {
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
    .returning(redemptionColumns);
  await recordRedemptionVisit(tx, "coupon_redemption", row.id);
  if (coupon.turnId !== null)
    await tx
      .update(campaignTurns)
      .set({
        outcome: "coupon_redeemed",
        outcomeRedemptionId: row.id,
        outcomeAt: input.now,
      })
      .where(eq(campaignTurns.id, coupon.turnId));
  if (!input.push) return { ...row, pushQueueId: null };

  // `transactional` on purpose: the receipt of something that just happened at the counter,
  // not marketing — NOT subject to the campaign cooldown.
  const [business] = await tx
    .select({ name: businesses.name })
    .from(businesses)
    .where(eq(businesses.id, input.businessId))
    .limit(1);
  const [push] = await tx
    .insert(walletPushQueue)
    .values({
      consumerId: coupon.consumerId,
      class: "transactional",
      title: business?.name ?? "CheckPass Club",
      body: buildCouponBody(row.labelSnapshot),
      status: "pending",
    })
    .returning({ id: walletPushQueue.id });
  return { ...row, pushQueueId: push.id };
}
