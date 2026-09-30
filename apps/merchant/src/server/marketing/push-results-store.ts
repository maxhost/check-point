import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { PUSH_CONVERSION_DAYS, type PushFacts } from "./results";

/**
 * The push block of one campaign's results (spec 0103 §10), read by SQL. `null` when the
 * campaign has no push channel. Split from `results-store.ts` for the size budget.
 *
 * RAW SQL with its own aliases (`c`, `cp`, `o`): the «bought» `exists` is correlated, and
 * the builder would bind its outer column to the inner table (`audience-store.ts`). Every
 * count is cast to `int` — a bare `count(*)` comes back as a STRING (`results-store.ts`).
 * Filtered by `business_id` as well as by campaign: an id from elsewhere reads nothing.
 */
export async function loadPushFacts(
  businessId: string,
  campaignId: string,
  now: Date,
): Promise<PushFacts | null> {
  // A constant of this module, never input: safe to inline as a literal.
  const days = sql.raw(`interval '${PUSH_CONVERSION_DAYS} days'`);
  const at = now.toISOString();
  const closed = (t0: ReturnType<typeof sql>) =>
    sql`${t0} is not null and ${t0} + ${days} <= ${at}::timestamptz`;
  const bought = (t0: ReturnType<typeof sql>) =>
    sql`exists (select 1 from core."order" o
         where o.business_id = cp.business_id and o.consumer_id = cp.consumer_id
           and o.created_at > ${t0} and o.created_at <= ${t0} + ${days})`;
  const sentClosed = closed(sql`cp.sent_at`);
  const heldClosed = sql`cp.holdout and ${closed(sql`cp.decided_at`)}`;
  const result = await getDb().execute(sql`
    select
      c.channel_push,
      count(cp.id)::int as decided,
      count(cp.id) filter (where cp.holdout)::int as held,
      count(cp.id) filter (where not cp.holdout and cp.sent_at is null
                             and cp.cancelled_at is null)::int as pending,
      count(cp.id) filter (where cp.sent_at is not null)::int as sent,
      count(cp.id) filter (where cp.cancel_reason = 'campaign_inactive')::int as campaign_inactive,
      count(cp.id) filter (where cp.cancel_reason = 'membership_gone')::int as membership_gone,
      count(cp.id) filter (where cp.cancel_reason = 'opt_out')::int as opt_out,
      count(cp.id) filter (where cp.cancel_reason = 'visited')::int as visited,
      count(cp.id) filter (where cp.clicked_at is not null)::int as clicked,
      count(cp.id) filter (where ${sentClosed})::int as sent_of,
      count(cp.id) filter (where ${sentClosed} and ${bought(sql`cp.sent_at`)})::int as sent_purchases,
      count(cp.id) filter (where ${heldClosed})::int as held_of,
      count(cp.id) filter (where ${heldClosed} and ${bought(sql`cp.decided_at`)})::int as held_purchases
    from core.campaign c
    left join core.campaign_push cp
      on cp.campaign_id = c.id and cp.business_id = c.business_id
    where c.id = ${campaignId} and c.business_id = ${businessId}
    group by c.id, c.channel_push`);
  const rows = (result as { rows?: Record<string, unknown>[] }).rows ?? [];
  const row = rows[0];
  if (!row || row.channel_push !== true) return null;
  const n = (key: string) => Number(row[key]);
  return {
    decided: n("decided"),
    held: n("held"),
    pending: n("pending"),
    sent: n("sent"),
    cancelled: {
      campaign_inactive: n("campaign_inactive"),
      membership_gone: n("membership_gone"),
      opt_out: n("opt_out"),
      visited: n("visited"),
    },
    clicked: n("clicked"),
    conversion: {
      sent: { purchases: n("sent_purchases"), of: n("sent_of") },
      held: { purchases: n("held_purchases"), of: n("held_of") },
    },
  };
}
