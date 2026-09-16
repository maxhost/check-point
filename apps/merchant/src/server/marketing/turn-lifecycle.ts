/**
 * Steps 2 (vencer) and 3 (cancelar) of the tick (spec 0065). Both are SINGLE statements
 * on purpose: they walk every live turn of the platform, and the outcome of a turn is a
 * question about rows the database already has — pulling them into JS would add a round
 * trip per turn and a window where the answer changes underneath.
 *
 * `businessIds` narrows a run to what a test seeded (same scoping as
 * `wallet/push-worker.ts`); production passes none and touches everything.
 */

import { sql, type SQL } from "drizzle-orm";
import type { DbTransaction } from "../db";

/** `and t.business_id in (…)`, or nothing at all. Built with `sql.join` so each id
 * travels as a bound parameter instead of being pasted into the statement. */
function businessScope(businessIds?: string[]): SQL {
  if (!businessIds || businessIds.length === 0) return sql``;
  const ids = sql.join(
    businessIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql` and t.business_id in (${ids})`;
}

/**
 * Step 2 — an `active` turn whose window closed becomes `done` WITH its result:
 * a coupon handed over wins (`coupon_redeemed`), else the FIRST order of that consumer
 * with that business inside the window (`purchase` + `outcome_order_id`), else `none`.
 * A `holdout` expires exactly the same way: it is the base line, and a base line that
 * did not measure its own purchases would not be one.
 *
 * The order is picked with an explicit `order by created_at asc, id asc`: two orders in
 * the same window are ordinary, and «the first» has to mean the same thing on every run
 * (`CLAUDE.md`: a `select` without a total order plus `.at(-1)` is a flaky waiting).
 */
export async function expireTurns(
  db: DbTransaction,
  now: Date,
  businessIds?: string[],
): Promise<number> {
  const redeemed = sql`exists (select 1 from core.coupon_redemption cr where cr.turn_id = t.id)`;
  const firstOrder = sql`(select o.id from core."order" o where o.business_id = t.business_id and o.consumer_id = t.consumer_id and o.created_at >= t.window_start and o.created_at <= t.window_end order by o.created_at asc, o.id asc limit 1)`;
  const result = await db.execute<{ id: string }>(sql`
    update core.campaign_turn t set
      status = 'done',
      outcome_at = ${now},
      outcome_redemption_id = (select cr.id from core.coupon_redemption cr where cr.turn_id = t.id),
      outcome_order_id = case when ${redeemed} then null else ${firstOrder} end,
      outcome = case
        when ${redeemed} then 'coupon_redeemed'
        when ${firstOrder} is not null then 'purchase'
        else 'none' end
    where t.status = 'active' and t.window_end < ${now}${businessScope(businessIds)}
    returning t.id
  `);
  return result.rows.length;
}

/** The six values of `campaign_turn.cancel_reason`, tallied by step 3. */
export type CancelCounts = Record<string, number>;

/**
 * Step 3 — a live turn whose world changed is `cancelled` with WHY. The order of the
 * `case` is the precedence, and it is deliberate: the campaign's own state explains the
 * turn better than the door does (a paused campaign whose door was also archived reads
 * as `campaign_paused`, which is the thing the owner did).
 *
 * `plan_downgraded` is a `paused` campaign whose `pause_reason` says the brake came from
 * billing, not from the owner — the defensive pause of `billing/webhook-apply.ts`
 * (phase D). `campaign_ended` covers `ended` and `archived`.
 *
 * ⚠️ `membership_gone` is NOT produced here, and cannot be: `campaign_turn.membership_id`
 * is `not null` with a NO ACTION fk, so deleting a membership that has a live turn
 * fails with `23503` — the state the reason describes is unreachable while the turn
 * exists. Measured, not assumed (see the integration test). Making it reachable is a
 * schema change (fk to `set null`/cascade), i.e. a new migration, and it is declared
 * instead of being silently dropped from the DoD.
 */
export async function cancelTurns(
  db: DbTransaction,
  businessIds?: string[],
): Promise<CancelCounts> {
  const doorAlive = sql`exists (select 1 from core.location l where l.id = t.location_id and l.status = 'active')`;
  const doorUsable = sql`exists (select 1 from core.location l where l.id = t.location_id and l.status = 'active' and l.latitude is not null and l.longitude is not null)`;
  const result = await db.execute<{ cancel_reason: string }>(sql`
    update core.campaign_turn t set
      status = 'cancelled',
      cancel_reason = case
        when c.status <> 'active' and c.pause_reason = 'plan_downgraded' then 'plan_downgraded'
        when c.status in ('ended', 'archived') then 'campaign_ended'
        when c.status <> 'active' then 'campaign_paused'
        when m.marketing_opt_out_at is not null then 'opt_out'
        when not ${doorAlive} then 'location_archived'
        else 'location_without_coordinates' end
    from core.campaign c, consumer.program_membership m
    where t.status in ('queued', 'active')
      and c.id = t.campaign_id
      and m.id = t.membership_id
      and (c.status <> 'active' or m.marketing_opt_out_at is not null or not ${doorUsable})
      ${businessScope(businessIds)}
    returning t.cancel_reason
  `);
  const counts: CancelCounts = {};
  for (const row of result.rows)
    counts[row.cancel_reason] = (counts[row.cancel_reason] ?? 0) + 1;
  return counts;
}
