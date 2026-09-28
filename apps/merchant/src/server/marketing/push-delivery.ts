/**
 * THE LAST-MOMENT CHECK OF A CAMPAIGN PUSH (spec 0103 §6 / ADR 0095 §3). The queue is the
 * outbox; marketing decides when the worker CLAIMS the row, because the tick runs every
 * 6 h and the worker every 5 min: a visit, an opt-out or a switched-off campaign in
 * between must not produce a push.
 *
 * `wallet/push.ts` calls {@link gateCampaignPush} for every claimed `campaign` row BEFORE
 * writing `latest_message`, and {@link recordCampaignPushSent} after closing the row as
 * `sent`. The logic lives here and not there because that file sits at the size budget.
 */

import { sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "../db";
import { type CouponReward, pushCouponToIssue } from "./coupon-issue";
import { toDate } from "./driver-values";
import { isInPushWindow, nextSendableAt } from "./push-window";

export type PushCancelReason =
  | "campaign_inactive"
  | "membership_gone"
  | "opt_out"
  | "visited";

export type CampaignGate =
  | { kind: "send"; clickId?: string }
  | { kind: "cancel"; reason: PushCancelReason }
  | { kind: "reschedule"; notBefore: Date };

/** What the gate reads of the `campaign_push` behind one queue row. */
export type GateFacts = {
  pushId: string;
  campaignStatus: string;
  endsAt: Date | null;
  membershipExists: boolean;
  optedOut: boolean;
  /** An order of this business and consumer, OR a redemption of the membership (spec
   * 0104 / ADR 0096 §5: a redemption is a visit), AFTER the decision (`decided_at`). */
  visitedSinceDecision: boolean;
  timeZone: string;
  windowStart: number;
  windowEnd: number;
};

/**
 * PURE, in the spec's order. No `campaign_push` behind the row (`null`) is SEND without a
 * click id: an orphan `campaign` row should not exist, and if it does the notice is not
 * lost. Only the window reschedules; every other «no» cancels.
 */
export function decideCampaignGate(
  facts: GateFacts | null,
  now: Date,
): CampaignGate {
  if (!facts) return { kind: "send" };
  if (
    facts.campaignStatus !== "active" ||
    (facts.endsAt !== null && facts.endsAt <= now)
  )
    return { kind: "cancel", reason: "campaign_inactive" };
  if (!facts.membershipExists)
    return { kind: "cancel", reason: "membership_gone" };
  if (facts.optedOut) return { kind: "cancel", reason: "opt_out" };
  if (facts.visitedSinceDecision) return { kind: "cancel", reason: "visited" };
  if (!isInPushWindow(now, facts.timeZone, facts.windowStart, facts.windowEnd))
    return {
      kind: "reschedule",
      notBefore: nextSendableAt(
        now,
        facts.timeZone,
        facts.windowStart,
        facts.windowEnd,
      ),
    };
  return { kind: "send", clickId: facts.pushId };
}

type Rows<T> = { rows?: T[] } | T[];
function rowsOf<T>(result: unknown): T[] {
  const value = result as Rows<T>;
  return Array.isArray(value) ? value : (value?.rows ?? []);
}

/**
 * RAW SQL with its own aliases (`cp`, `c`, `b`, `m`, `o`, `r`): the `exists` over orders
 * and redemptions are correlated subqueries, and the builder would bind its outer column to the inner table
 * (see `audience-store.ts`). The membership is a LEFT join: its absence is a reason.
 */
async function loadGateFacts(queueId: string): Promise<GateFacts | null> {
  const result = await getDb().execute(sql`
    select
      cp.id as push_id,
      c.status as campaign_status,
      c.ends_at,
      (m.id is not null) as membership_exists,
      (m.marketing_opt_out_at is not null) as opted_out,
      (exists (select 1 from core."order" o
                where o.business_id = cp.business_id
                  and o.consumer_id = cp.consumer_id
                  and o.created_at > cp.decided_at)
       or exists (select 1 from core.reward_redemption r
                   where r.membership_id = cp.membership_id
                     and r.created_at > cp.decided_at)) as visited,
      b.timezone,
      b.push_window_start_hour,
      b.push_window_end_hour
    from core.campaign_push cp
    join core.campaign c on c.id = cp.campaign_id
    join core.business b on b.id = cp.business_id
    left join consumer.program_membership m on m.id = cp.membership_id
    where cp.queue_id = ${queueId}
    limit 1`);
  const [row] = rowsOf<Record<string, unknown>>(result);
  if (!row) return null;
  return {
    pushId: String(row.push_id),
    campaignStatus: String(row.campaign_status),
    endsAt: toDate(row.ends_at),
    membershipExists: row.membership_exists === true,
    optedOut: row.opted_out === true,
    visitedSinceDecision: row.visited === true,
    timeZone: String(row.timezone),
    windowStart: Number(row.push_window_start_hour),
    windowEnd: Number(row.push_window_end_hour),
  };
}

/**
 * Decides AND applies. `cancel` closes the queue row (`cancelled`, the reason in
 * `last_error`) and the decision (`cancelled_at`, `cancel_reason`) — and touches nothing
 * of the consumer. `reschedule` hands the row back as `pending` at the next opening. The
 * caller only delivers on `send`.
 */
export async function gateCampaignPush(
  queueId: string,
  now: Date,
): Promise<CampaignGate> {
  const facts = await loadGateFacts(queueId);
  const gate = decideCampaignGate(facts, now);
  if (gate.kind === "cancel" && facts) {
    await withDbTransaction(async (tx) => {
      await tx.execute(sql`
        update consumer.wallet_push_queue
        set status = 'cancelled', last_error = ${gate.reason}
        where id = ${queueId}`);
      await tx.execute(sql`
        update core.campaign_push
        set cancelled_at = ${now.toISOString()}, cancel_reason = ${gate.reason}
        where id = ${facts.pushId}`);
    });
  }
  if (gate.kind === "reschedule")
    await getDb().execute(sql`
      update consumer.wallet_push_queue
      set status = 'pending', not_before = ${gate.notBefore.toISOString()}
      where id = ${queueId}`);
  return gate;
}

/** The campaign's reward as the raw `returning` of `recordCampaignPushSent` hands it over
 * (`numeric` is a string from the driver, `integer` a number). */
function rewardOf(row: Record<string, unknown>): CouponReward {
  const text = (value: unknown) =>
    value === null || value === undefined ? null : String(value);
  return {
    kind: text(row.coupon_kind) as CouponReward["kind"],
    productId: text(row.coupon_product_id),
    discountUnit: text(
      row.coupon_discount_unit,
    ) as CouponReward["discountUnit"],
    discountValue: text(row.coupon_discount_value),
    extraUnits:
      text(row.coupon_extra_units) === null
        ? null
        : Number(row.coupon_extra_units),
    rule: text(row.coupon_rule),
    currencyCode: String(row.currency_code),
  };
}

/**
 * After the queue row closed as `sent`: stamps `sent_at` and issues the push's coupon
 * (`pushCouponToIssue`) with the campaign's WHOLE reward (spec 0106), in ONE transaction. `on conflict (push_id) do nothing` over the
 * NON-partial unique makes a replay harmless.
 */
export async function recordCampaignPushSent(
  pushId: string,
  now: Date,
): Promise<void> {
  await withDbTransaction(async (tx) => {
    const result = await tx.execute(sql`
      update core.campaign_push cp
      set sent_at = ${now.toISOString()}
      from core.campaign c
      where cp.id = ${pushId} and c.id = cp.campaign_id
      returning cp.campaign_id, cp.business_id, cp.consumer_id, cp.membership_id,
        cp.holdout, c.coupon_label, c.coupon_cost, c.ends_at, c.coupon_kind,
        c.coupon_product_id, c.coupon_discount_unit, c.coupon_discount_value,
        c.coupon_extra_units, c.coupon_rule,
        (select b.currency_code from core.business b
          where b.id = cp.business_id) as currency_code,
        exists (select 1 from core.campaign_coupon cc
                 where cc.campaign_id = cp.campaign_id
                   and cc.consumer_id = cp.consumer_id
                   and not exists (select 1 from core.coupon_redemption r
                                    where r.coupon_id = cc.id)) as has_unredeemed`);
    const [row] = rowsOf<Record<string, unknown>>(result);
    if (!row) return;
    const coupon = pushCouponToIssue({
      pushId,
      holdout: row.holdout === true,
      couponLabel: (row.coupon_label as string | null) ?? null,
      couponCost: (row.coupon_cost as string | null) ?? null,
      reward: rewardOf(row),
      endsAt: toDate(row.ends_at),
      sentAt: now,
      hasUnredeemedCoupon: row.has_unredeemed === true,
    });
    if (!coupon) return;
    await tx.execute(sql`
      insert into core.campaign_coupon
        (campaign_id, business_id, consumer_id, membership_id, push_id,
         label_snapshot, cost_snapshot, kind_snapshot, product_id,
         discount_unit_snapshot, discount_value_snapshot, currency_code_snapshot,
         extra_units_snapshot, rule_snapshot, valid_from, valid_until)
      values (${row.campaign_id}, ${row.business_id}, ${row.consumer_id},
        ${row.membership_id}, ${coupon.pushId}, ${coupon.labelSnapshot},
        ${coupon.costSnapshot}, ${coupon.kindSnapshot}, ${coupon.productId},
        ${coupon.discountUnitSnapshot}, ${coupon.discountValueSnapshot},
        ${coupon.currencyCodeSnapshot}, ${coupon.extraUnitsSnapshot},
        ${coupon.ruleSnapshot}, ${coupon.validFrom.toISOString()},
        ${coupon.validUntil.toISOString()})
      on conflict (push_id) do nothing`);
  });
}

/**
 * `POST /api/public/push/click` (spec 0103 §9): the first click of a SENT push wins
 * (`coalesce`); an unknown id, a holdout or a never-sent push change nothing — and the
 * route answers 204 either way, so the endpoint does not reveal which ids exist.
 */
export async function recordPushClick(pushId: string): Promise<void> {
  await getDb().execute(sql`
    update core.campaign_push
    set clicked_at = coalesce(clicked_at, now())
    where id = ${pushId} and sent_at is not null`);
}
