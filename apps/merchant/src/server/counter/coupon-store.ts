import { and, desc, eq, sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "../db";
import {
  businesses,
  campaignCoupons,
  campaignTurns,
  campaigns,
  couponRedemptions,
  programMemberships,
  walletPushQueue,
} from "../schema";
import { buildCouponBody } from "../wallet/push";
import { CounterError } from "./core";
import { decideCouponRedemption } from "./coupon-decision";
import { grantCouponExtras } from "./coupon-extras";
import { recordRedemptionVisit } from "../customers/projection";
import type { CouponKind } from "../marketing/reward-input";

export { type ActiveCoupon, loadActiveCoupon } from "./coupon-scan";

/**
 * The DB half of the coupon (spec 0065 phase C; over `campaign_coupon` since spec 0102):
 * what the SCAN shows and what the redemption writes. `coupon-decision.ts` decides; this file only asks the rows and
 * applies the answer.
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
  campaignName: string;
  /** The `wallet_push_queue` row enqueued in the SAME transaction; `null` on the
   * idempotent-retry path, so a retry never re-notifies the consumer. */
  pushQueueId: string | null;
};

const redemptionColumns = {
  id: couponRedemptions.id,
  couponId: couponRedemptions.couponId,
  labelSnapshot: couponRedemptions.labelSnapshot,
  kindSnapshot: couponRedemptions.kindSnapshot,
  unitsGranted: couponRedemptions.unitsGranted,
  balanceAfter: couponRedemptions.balanceAfter,
};

/** A retry may only return the coupon it asked for. A `clientRequestId` reused over a
 * DIFFERENT coupon is refused rather than answered with somebody else's coupon. */
function assertSameCoupon(
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
): Promise<Omit<PersistedCoupon, "campaignName" | "pushQueueId"> | null> {
  const [row] = await getDb()
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
 * The redemption, as an INTERACTIVE TRANSACTION with the order the spec declares
 * normative (spec 0065, over the coupon since spec 0102):
 *
 *  0. Resolve which campaign to lock. Scoped by `business_id`, so a foreign coupon is a
 *     404 here and never reaches the lock. Not under a lock and it does not need to be: a
 *     coupon's `campaign_id` never changes, and everything decided later is re-read.
 *  1. `FOR UPDATE` on the CAMPAIGN — this serializes every redemption of every coupon of
 *     the campaign, which is what makes the cap hold — and then on the COUPON.
 *  2. Idempotency, under the lock and BEFORE any business guard.
 *  3. Decide with the PURE function over the LOCKED rows and a `count` taken under the
 *     same lock.
 *  3a. Spec 0112: the MEMBERSHIP of the redemption is the coupon's, or —a cross coupon
 *     claimed by a non-member— the consumer's membership in this business, read here (the
 *     scan auto-enrols, ADR 0033). None at all → 409 `not_enrolled`. The coupon is not
 *     rewritten.
 *  3b. Spec 0106: an `extra_*` coupon credits the program (`coupon-extras.ts`), or answers
 *     409 `program_changed` without writing anything.
 *  4. Insert with the coupon's SNAPSHOTS, and — when the coupon came from a turn — mark
 *     that turn's outcome (the turn is still proximity's unit of measurement, ADR 0093 §3).
 *     DECLARED: a coupon whose turn was CANCELLED (e.g. `opt_out`) still marks that turn
 *     `coupon_redeemed` — literal step 4 of spec 0102, accepted by the orchestrator.
 *     Results count only `done` turns, so it inflates no metric.
 *  5. Outbox push in the same transaction (ADR 0037).
 *
 * `unique (coupon_id)` and `unique (business_id, client_request_id)` stay as BACKSTOPS
 * (ADR 0054 §3), not as the mechanism. The oracle of the lock is the real race in the
 * integration suite plus the mutation that removes it — no plan shows a lock.
 */
export async function persistCouponRedemption(input: {
  businessId: string;
  couponId: string;
  locationId: string | null;
  createdByUserId: string;
  clientRequestId: string;
  now?: Date;
}): Promise<PersistedCoupon> {
  const now = input.now ?? new Date();
  return withDbTransaction(async (tx) => {
    // (0) Which campaign does this coupon belong to? Scoped: a foreign one is a 404.
    const [head] = await tx
      .select({ campaignId: campaignCoupons.campaignId })
      .from(campaignCoupons)
      .where(
        and(
          eq(campaignCoupons.id, input.couponId),
          eq(campaignCoupons.businessId, input.businessId),
        ),
      )
      .limit(1);
    if (!head)
      throw new CounterError(404, "unknown_coupon", "Ese cupón no existe.");

    // (1) Lock the campaign, then the coupon.
    const [campaign] = await tx
      .select({
        id: campaigns.id,
        name: campaigns.name,
        couponMaxRedemptions: campaigns.couponMaxRedemptions,
      })
      .from(campaigns)
      .where(eq(campaigns.id, head.campaignId))
      .limit(1)
      .for("update");
    const [coupon] = await tx
      .select({
        id: campaignCoupons.id,
        consumerId: campaignCoupons.consumerId,
        membershipId: campaignCoupons.membershipId,
        turnId: campaignCoupons.turnId,
        labelSnapshot: campaignCoupons.labelSnapshot,
        costSnapshot: campaignCoupons.costSnapshot,
        kindSnapshot: campaignCoupons.kindSnapshot,
        productId: campaignCoupons.productId,
        extraUnitsSnapshot: campaignCoupons.extraUnitsSnapshot,
        validFrom: campaignCoupons.validFrom,
        validUntil: campaignCoupons.validUntil,
      })
      .from(campaignCoupons)
      .where(eq(campaignCoupons.id, input.couponId))
      .limit(1)
      .for("update");

    // (2) Idempotency, under the lock and before every business guard.
    const [previous] = await tx
      .select(redemptionColumns)
      .from(couponRedemptions)
      .where(
        and(
          eq(couponRedemptions.businessId, input.businessId),
          eq(couponRedemptions.clientRequestId, input.clientRequestId),
        ),
      )
      .limit(1);
    if (previous) {
      assertSameCoupon(previous, input.couponId);
      return { ...previous, campaignName: campaign.name, pushQueueId: null };
    }

    // (3) Decide over the locked rows.
    const [counted] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(couponRedemptions)
      .where(eq(couponRedemptions.campaignId, campaign.id));
    const [spent] = await tx
      .select({ id: couponRedemptions.id })
      .from(couponRedemptions)
      .where(eq(couponRedemptions.couponId, coupon.id))
      .limit(1);
    const decision = decideCouponRedemption({
      coupon: { ...coupon, redeemed: spent !== undefined },
      campaign,
      redeemedCount: counted?.total ?? 0,
      now,
    });
    if (!decision.ok)
      throw new CounterError(decision.status, decision.code, decision.message);

    // (3a) Spec 0112: whose membership this redemption is.
    const membershipId =
      coupon.membershipId ??
      (await enrolledMembership(tx, coupon.consumerId, input.businessId));

    // (3b) Spec 0106: an `extra_*` coupon credits the program HERE — same transaction, after
    // the locks and the decision, before the insert (`coupon-extras.ts`). A program that
    // changed is a 409 `program_changed` and nothing is written.
    const grant = await grantCouponExtras(tx, {
      businessId: input.businessId,
      membershipId,
      kindSnapshot: coupon.kindSnapshot,
      extraUnitsSnapshot: coupon.extraUnitsSnapshot,
    });

    // (4) Write. Label and cost are SNAPSHOTS of the coupon, never of the campaign as it
    // reads today: editing a campaign may not restate what the counter already handed over.
    const [row] = await tx
      .insert(couponRedemptions)
      .values({
        couponId: coupon.id,
        campaignId: campaign.id,
        businessId: input.businessId,
        consumerId: coupon.consumerId,
        membershipId,
        locationId: input.locationId,
        labelSnapshot: coupon.labelSnapshot,
        costSnapshot: coupon.costSnapshot,
        // Spec 0106: what the rewards results group by, copied from the coupon too.
        kindSnapshot: coupon.kindSnapshot,
        productId: coupon.productId,
        unitsGranted: grant?.unitsGranted ?? null,
        balanceAfter: grant?.balanceAfter ?? null,
        createdByUserId: input.createdByUserId,
        clientRequestId: input.clientRequestId,
      })
      .returning(redemptionColumns);
    // (4b) Spec 0108: every coupon redemption at the counter is a visit — same transaction.
    await recordRedemptionVisit(tx, "coupon_redemption", row.id);
    if (coupon.turnId !== null)
      await tx
        .update(campaignTurns)
        .set({
          outcome: "coupon_redeemed",
          outcomeRedemptionId: row.id,
          outcomeAt: now,
        })
        .where(eq(campaignTurns.id, coupon.turnId));

    // (5) Outbox push, same transaction. `transactional` on purpose: it is the receipt of
    // something that just happened at the counter, not marketing — so it is NOT subject
    // to the campaign cooldown and does not move `last_push_at` semantics.
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

    return { ...row, campaignName: campaign.name, pushQueueId: push.id };
  });
}

/** The consumer's membership in this business (latest enrolment), or 409 `not_enrolled`. */
async function enrolledMembership(
  tx: DbTransaction,
  consumerId: string,
  businessId: string,
): Promise<string> {
  const [row] = await tx
    .select({ id: programMemberships.id })
    .from(programMemberships)
    .where(
      and(
        eq(programMemberships.consumerId, consumerId),
        eq(programMemberships.businessId, businessId),
      ),
    )
    .orderBy(desc(programMemberships.enrolledAt), programMemberships.id)
    .limit(1);
  if (!row)
    throw new CounterError(
      409,
      "not_enrolled",
      "Escaneá el QR del cliente primero.",
    );
  return row.id;
}

export { assertSameCoupon };
