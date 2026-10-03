import { sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { rowsOf } from "./cross-store";
import { toDate } from "./driver-values";

/**
 * THE DATABASE HALF of the cross sale's decision (spec 0143 §2): the reads that feed the H4
 * lottery and the writes of the record. The decision itself is `cross-sale.ts`; every
 * function here runs INSIDE its transaction. Raw SQL with explicit aliases (correlated
 * subqueries, `gotchas-del-repo`); counts are `::int`, sums `::float8`, dates cross
 * `driver-values.ts`.
 */

export type DecisionOrder = {
  consumerId: string;
  businessId: string;
  businessName: string;
  locationId: string | null;
};

/** The accredited order and the name of its business (A). `null` when it does not exist. */
export async function readDecisionOrder(
  tx: DbTransaction,
  orderId: string,
): Promise<DecisionOrder | null> {
  const [row] = rowsOf<Record<string, unknown>>(
    await tx.execute(sql`
      select o.consumer_id, o.business_id, o.location_id, b.name as business_name
      from core."order" o join core.business b on b.id = o.business_id
      where o.id = ${orderId}`),
  );
  if (!row) return null;
  return {
    consumerId: String(row.consumer_id),
    businessId: String(row.business_id),
    businessName: String(row.business_name),
    locationId: row.location_id === null ? null : String(row.location_id),
  };
}

/**
 * THE IDEMPOTENCY: the decision row of this order, or `null` when another run already has
 * it (`unique (order_id)`). It is born `no_candidates` with 0 candidates and closed by
 * {@link closeDecision} in the same transaction — nobody ever reads it half-done.
 */
export async function openDecision(
  tx: DbTransaction,
  orderId: string,
  order: DecisionOrder,
  meta: { policy: string; epsilon: number; now: Date },
): Promise<string | null> {
  const [row] = rowsOf<{ id: string }>(
    await tx.execute(sql`
      insert into core.cross_decision
        (order_id, consumer_id, business_id, location_id, origin_kind, policy, epsilon,
         candidate_count, outcome, decided_at)
      values (${orderId}, ${order.consumerId}, ${order.businessId}, ${order.locationId},
        'none', ${meta.policy}, ${meta.epsilon}, 0, 'no_candidates', ${meta.now.toISOString()})
      on conflict (order_id) do nothing
      returning id`),
  );
  return row ? String(row.id) : null;
}

/**
 * Locks the campaign rows that passed every rule but the cap, IN ID ORDER (two purchases at
 * once never deadlock), so the monthly cap is counted under the lock (spec 0143 §2.3).
 */
export async function lockCampaigns(
  tx: DbTransaction,
  campaignIds: readonly string[],
): Promise<void> {
  if (campaignIds.length === 0) return;
  const list = sql.join(
    campaignIds.map((id) => sql`${id}`),
    sql`, `,
  );
  await tx.execute(sql`
    select c.id from core.campaign c
    where c.id in (${list})
    order by c.id
    for update`);
}

/**
 * `F` (without this decision) and `R` of one BUSINESS since `monthStart` (spec 0143 §3), over
 * ANY of its campaigns (spec 0144): recreating the cross campaign mid-month keeps the count.
 * Filtered by `campaign_id` to use `core_cross_candidate_campaign_idx`.
 */
export async function loadLotteryHistory(
  tx: DbTransaction,
  businessId: string,
  monthStart: Date,
): Promise<{ previousShare: number; received: number }> {
  const [row] = rowsOf<Record<string, unknown>>(
    await tx.execute(sql`
      select coalesce(sum(1.0 / d.candidate_count), 0)::float8 as share,
        (count(*) filter (where d.chosen_campaign_id = k.campaign_id
                            and d.outcome = 'issued'))::int as received
      from core.cross_candidate k
      join core.cross_decision d on d.id = k.decision_id
      where k.campaign_id in (
          select c.id from core.campaign c where c.business_id = ${businessId})
        and d.decided_at >= ${monthStart.toISOString()}::timestamptz`),
  );
  return {
    previousShare: Number(row?.share ?? 0),
    received: Number(row?.received ?? 0),
  };
}

/**
 * H4: whether B got a NEW customer since `monthStart` — a consumer whose FIRST order in B
 * (ever) falls in the month (spec 0143 §3).
 */
export async function gotNewCustomerSince(
  tx: DbTransaction,
  businessId: string,
  monthStart: Date,
): Promise<boolean> {
  const [row] = rowsOf<{ found: boolean }>(
    await tx.execute(sql`
      select exists (
        select 1 from core."order" o
        where o.business_id = ${businessId}
        group by o.consumer_id
        having min(o.created_at) >= ${monthStart.toISOString()}::timestamptz
      ) as found`),
  );
  return row?.found === true;
}

/** The consumer's orders in B: how many and the last one (the candidate's segment). */
export async function loadOrderHistory(
  tx: DbTransaction,
  consumerId: string,
  businessId: string,
): Promise<{ count: number; lastOrderAt: Date | null }> {
  const [row] = rowsOf<Record<string, unknown>>(
    await tx.execute(sql`
      select count(*)::int as given, max(o.created_at) as last_order_at
      from core."order" o
      where o.consumer_id = ${consumerId} and o.business_id = ${businessId}`),
  );
  return {
    count: Number(row?.given ?? 0),
    lastOrderAt: toDate(row?.last_order_at),
  };
}

/** The «regalo misterio»: one `campaign` row of the queue, due at `notBefore`. */
export async function enqueueCrossPush(
  tx: DbTransaction,
  push: { consumerId: string; title: string; body: string; notBefore: Date },
): Promise<string> {
  const [row] = rowsOf<{ id: string }>(
    await tx.execute(sql`
      insert into consumer.wallet_push_queue (consumer_id, class, title, body, not_before)
      values (${push.consumerId}, 'campaign', ${push.title}, ${push.body},
        ${push.notBefore.toISOString()})
      returning id`),
  );
  return String(row.id);
}

export type DecisionClose = {
  originKind: "last_scan" | "none";
  outcome: "issued" | "no_candidates" | "no_origin" | "coupon_conflict";
  candidateCount: number;
  draw: number | null;
  chosenCampaignId: string | null;
  couponId: string | null;
  queueId: string | null;
};

export async function closeDecision(
  tx: DbTransaction,
  decisionId: string,
  close: DecisionClose,
): Promise<void> {
  await tx.execute(sql`
    update core.cross_decision
    set origin_kind = ${close.originKind}, outcome = ${close.outcome},
      candidate_count = ${close.candidateCount}, draw = ${close.draw},
      chosen_campaign_id = ${close.chosenCampaignId}, coupon_id = ${close.couponId},
      queue_id = ${close.queueId}
    where id = ${decisionId}`);
}

export type CandidateRow = {
  campaignId: string;
  businessId: string;
  locationId: string;
  categoryGcid: string;
  distanceMeters: number;
  capRemaining: number;
  segment: "new" | "dormant" | "regular";
  daysSinceLastOrder: number | null;
  ordersCount: number;
  closeness: number;
  behind: number;
  bonus: number;
  probability: number;
};

export async function insertCandidates(
  tx: DbTransaction,
  decisionId: string,
  rows: readonly CandidateRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const values = sql.join(
    rows.map(
      (
        r,
      ) => sql`(${decisionId}, ${r.campaignId}, ${r.businessId}, ${r.locationId},
        ${r.categoryGcid}, ${r.distanceMeters}, ${r.capRemaining}, ${r.segment},
        ${r.daysSinceLastOrder}, ${r.ordersCount}, ${r.closeness}, ${r.behind}, ${r.bonus},
        ${r.probability})`,
    ),
    sql`, `,
  );
  await tx.execute(sql`
    insert into core.cross_candidate
      (decision_id, campaign_id, business_id, location_id, category_gcid, distance_meters,
       cap_remaining, segment, days_since_last_order, orders_count, factor_closeness,
       factor_behind, factor_bonus, probability)
    values ${values}`);
}
