import { and, eq, isNotNull, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "../db";
import {
  businesses,
  campaignTurns,
  campaigns,
  couponRedemptions,
  walletPushQueue,
} from "../schema";
import { buildCouponBody } from "../wallet/push";
import { CounterError } from "./core";
import { decideCouponRedemption } from "./coupon-decision";

/**
 * The DB half of the coupon (spec 0065 phase C): what the SCAN shows and what the
 * redemption writes. `coupon-decision.ts` decides; this file only asks the rows and
 * applies the answer.
 */

export type ActiveCoupon = {
  turnId: string;
  label: string;
  campaignName: string;
  windowEnd: Date;
};

/**
 * The coupon this consumer can be handed AT THIS COUNTER, or `null`. Same conditions the
 * redemption re-checks under the lock — this one only decides what to PAINT, and the
 * balance may move between the scan and the confirmation, which is why the real guard is
 * the transaction and never this read.
 *
 * `outcome <> 'coupon_redeemed'` is a DECISION OF THE ORCHESTRATOR: the spec lists the
 * conditions and does not name this one. A turn keeps `status = 'active'` until the tick
 * closes its window, so without it the panel would keep offering «Canjear cupón» for days
 * after the coupon was handed over, and every press would answer 409. A button that is
 * always an error is worse than no button.
 */
export async function loadActiveCoupon(
  businessId: string,
  consumerId: string,
  now: Date = new Date(),
): Promise<ActiveCoupon | null> {
  const [row] = await getDb()
    .select({
      turnId: campaignTurns.id,
      label: campaignTurns.couponLabelSnapshot,
      campaignName: campaigns.name,
      windowEnd: campaignTurns.windowEnd,
    })
    .from(campaignTurns)
    .innerJoin(campaigns, eq(campaigns.id, campaignTurns.campaignId))
    .where(
      and(
        eq(campaignTurns.businessId, businessId),
        eq(campaignTurns.consumerId, consumerId),
        eq(campaignTurns.status, "active"),
        eq(campaignTurns.holdout, false),
        isNotNull(campaignTurns.couponLabelSnapshot),
        eq(campaigns.status, "active"),
        sql`${campaignTurns.windowStart} <= ${now}`,
        sql`${campaignTurns.windowEnd} >= ${now}`,
        sql`${campaignTurns.outcome} is distinct from 'coupon_redeemed'`,
      ),
    )
    // At most one turn per business is live per consumer (the partial unique of the
    // migration 0031 enforces it), so the order is belt and braces — but a `select`
    // without one returns whatever the scan produced (`CLAUDE.md`).
    .orderBy(campaignTurns.queuedAt)
    .limit(1);
  if (!row || row.label === null || row.windowEnd === null) return null;
  return {
    turnId: row.turnId,
    label: row.label,
    campaignName: row.campaignName,
    windowEnd: row.windowEnd,
  };
}

export type PersistedCoupon = {
  id: string;
  turnId: string;
  labelSnapshot: string;
  campaignName: string;
  /** The `wallet_push_queue` row enqueued in the SAME transaction; `null` on the
   * idempotent-retry path, so a retry never re-notifies the consumer. */
  pushQueueId: string | null;
};

const redemptionColumns = {
  id: couponRedemptions.id,
  turnId: couponRedemptions.turnId,
  labelSnapshot: couponRedemptions.labelSnapshot,
};

/** A retry may only return the coupon it asked for. A `clientRequestId` reused over a
 * DIFFERENT turn is refused rather than answered with somebody else's coupon. */
function assertSameTurn(previous: { turnId: string }, turnId: string): void {
  if (previous.turnId !== turnId)
    throw new CounterError(
      409,
      "request_id_reused",
      "Ese identificador ya se usó para canjear otro cupón.",
    );
}

export async function readCouponByRequest(
  businessId: string,
  clientRequestId: string,
): Promise<{ id: string; turnId: string; labelSnapshot: string } | null> {
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
 * normative:
 *
 *  0. Resolve which campaign to lock. Scoped by `business_id`, so a foreign turn is a
 *     404 here and never reaches the lock. This read is NOT under a lock and does not
 *     need to be: a turn's `campaign_id` never changes, and everything decided later is
 *     re-read under the lock.
 *  1. `FOR UPDATE` on the CAMPAIGN — this serializes every redemption of every turn of
 *     the campaign, which is what makes the cap hold — and then on the TURN.
 *  2. Idempotency, under the lock and BEFORE any business guard: a concurrent redemption
 *     with this `client_request_id` either already committed (it made us wait) or has not
 *     started (it waits for us). Nothing here depends on a property of the planner.
 *  3. Decide with the PURE function over the LOCKED rows and a `count` taken under the
 *     same lock.
 *  4. Insert, and mark the turn's outcome.
 *  5. Outbox push in the same transaction (ADR 0037).
 *
 * `unique (turn_id)` and `unique (business_id, client_request_id)` stay as BACKSTOPS
 * (ADR 0054 §3), not as the mechanism. **And the `count` under the lock is the guard, not
 * an `EXPLAIN`**: the `FOR UPDATE` and the `count` are two statements and no plan shows a
 * lock — the oracle is the real race in the integration suite, plus the mutation that
 * removes the lock.
 */
export async function persistCouponRedemption(input: {
  businessId: string;
  turnId: string;
  locationId: string | null;
  createdByUserId: string;
  clientRequestId: string;
  now?: Date;
}): Promise<PersistedCoupon> {
  const now = input.now ?? new Date();
  return withDbTransaction(async (tx) => {
    // (0) Which campaign does this turn belong to? Scoped: a foreign turn is a 404.
    const [head] = await tx
      .select({ campaignId: campaignTurns.campaignId })
      .from(campaignTurns)
      .where(
        and(
          eq(campaignTurns.id, input.turnId),
          eq(campaignTurns.businessId, input.businessId),
        ),
      )
      .limit(1);
    if (!head)
      throw new CounterError(404, "unknown_turn", "Ese cupón no existe.");

    // (1) Lock the campaign, then the turn.
    const [campaign] = await tx
      .select({
        id: campaigns.id,
        name: campaigns.name,
        status: campaigns.status,
        couponCost: campaigns.couponCost,
        couponMaxRedemptions: campaigns.couponMaxRedemptions,
      })
      .from(campaigns)
      .where(eq(campaigns.id, head.campaignId))
      .limit(1)
      .for("update");
    const [turn] = await tx
      .select({
        id: campaignTurns.id,
        consumerId: campaignTurns.consumerId,
        membershipId: campaignTurns.membershipId,
        status: campaignTurns.status,
        holdout: campaignTurns.holdout,
        couponLabelSnapshot: campaignTurns.couponLabelSnapshot,
        couponCostSnapshot: campaignTurns.couponCostSnapshot,
        windowStart: campaignTurns.windowStart,
        windowEnd: campaignTurns.windowEnd,
        outcome: campaignTurns.outcome,
      })
      .from(campaignTurns)
      .where(eq(campaignTurns.id, input.turnId))
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
      assertSameTurn(previous, input.turnId);
      return { ...previous, campaignName: campaign.name, pushQueueId: null };
    }

    // (3) Decide over the locked rows.
    const [counted] = await tx
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(couponRedemptions)
      .where(eq(couponRedemptions.campaignId, campaign.id));
    const decision = decideCouponRedemption({
      turn,
      campaign,
      redeemedCount: counted?.total ?? 0,
      now,
    });
    if (!decision.ok)
      throw new CounterError(decision.status, decision.code, decision.message);

    // (4) Write. The label and the cost are SNAPSHOTS of the turn, never of the campaign
    // as it reads today: editing a paused campaign's coupon may not restate what the
    // counter already handed over (same rule as the incurred cost in results).
    const [row] = await tx
      .insert(couponRedemptions)
      .values({
        turnId: turn.id,
        campaignId: campaign.id,
        businessId: input.businessId,
        consumerId: turn.consumerId,
        membershipId: turn.membershipId,
        locationId: input.locationId,
        labelSnapshot: turn.couponLabelSnapshot as string,
        costSnapshot: turn.couponCostSnapshot ?? campaign.couponCost ?? "0.00",
        createdByUserId: input.createdByUserId,
        clientRequestId: input.clientRequestId,
      })
      .returning(redemptionColumns);
    await tx
      .update(campaignTurns)
      .set({
        outcome: "coupon_redeemed",
        outcomeRedemptionId: row.id,
        outcomeAt: now,
      })
      .where(eq(campaignTurns.id, turn.id));

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
        consumerId: turn.consumerId,
        class: "transactional",
        title: business?.name ?? "CheckPass Club",
        body: buildCouponBody(row.labelSnapshot),
        status: "pending",
      })
      .returning({ id: walletPushQueue.id });

    return { ...row, campaignName: campaign.name, pushQueueId: push.id };
  });
}

export { assertSameTurn };
