/**
 * The DB half of step 1 of the tick (spec 0065): it loads the facts
 * `decideTurnEligibility` needs, inserts the `queued` turns and writes the audience
 * photo. Every function takes the transaction: the whole tick runs inside ONE
 * interactive transaction that holds the advisory lock (see `tick.ts`).
 */

import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { DbTransaction } from "../db";
import {
  campaignLocations,
  campaignTickAudiences,
  campaignTurns,
  campaigns,
  locations,
} from "../schema";
import type { AudienceCandidate, AudienceCounts } from "./audience";
import { requireDate, toDate } from "./driver-values";

/** What step 1 needs of a campaign; the message and the coupon are read at ACTIVATION
 * (step 4), from the campaign row, and copied into the turn's snapshots. */
export type ActiveCampaign = {
  id: string;
  businessId: string;
  dormantDays: number;
};

/**
 * Campaigns whose window is open right now. `businessIds` narrows the run to the
 * businesses a test seeded — the same scoping `wallet/push-worker.ts` uses for its
 * drain, so an integration run is deterministic and never touches another file's rows.
 */
export async function loadActiveCampaigns(
  db: DbTransaction,
  now: Date,
  businessIds?: string[],
): Promise<ActiveCampaign[]> {
  return await db
    .select({
      id: campaigns.id,
      businessId: campaigns.businessId,
      dormantDays: campaigns.dormantDays,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.status, "active"),
        lte(campaigns.startsAt, now),
        or(isNull(campaigns.endsAt), gt(campaigns.endsAt, now)),
        businessIds && businessIds.length > 0
          ? inArray(campaigns.businessId, businessIds)
          : undefined,
      ),
    );
}

/**
 * The campaign's USABLE doors: assigned, `active` and with coordinates. The two
 * conditions live here and not only in the cancel step — see `AudienceContext`.
 */
export async function loadUsableCampaignLocations(
  db: DbTransaction,
  campaignId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: locations.id })
    .from(campaignLocations)
    .innerJoin(locations, eq(locations.id, campaignLocations.locationId))
    .where(
      and(
        eq(campaignLocations.campaignId, campaignId),
        eq(locations.status, "active"),
        isNotNull(locations.latitude),
        isNotNull(locations.longitude),
      ),
    );
  return rows.map((row) => row.id);
}

/**
 * Every membership of the business, with the facts of the six audience rules. The
 * filtering is NOT done here on purpose: the decision (and therefore the exclusion
 * counts of `campaign_tick_audience`) is the pure function's, and a `where` that
 * silently dropped a consumer would make the counts unreconstructible.
 *
 * ⚠️ Written as RAW SQL with an explicit alias (`m`), not with the query builder, and
 * that is not a style choice — it is a MEASURED one. Drizzle renders a column embedded
 * in a `sql` template UNQUALIFIED when the select has a single table (`"consumer_id"`,
 * not `"program_membership"."consumer_id"`), so
 * `exists (select 1 from consumer.wallet_pass wp where wp.consumer_id = ${...})`
 * compiled to `wp.consumer_id = "consumer_id"` — which Postgres happily resolves
 * against `wallet_pass`'s OWN column. The subquery stopped being correlated and became
 * «does any wallet pass exist at all»: every consumer read as reachable, with typecheck
 * green and rows that looked plausible. Caught by the integration seeding a consumer
 * WITHOUT a pass. A correlated subquery in this codebase carries its own aliases.
 */
export async function loadAudienceCandidates(
  db: DbTransaction,
  businessId: string,
): Promise<AudienceCandidate[]> {
  const result = await db.execute<{
    membership_id: string;
    consumer_id: string;
    marketing_opt_out_at: string | null;
    enrolled_at: string;
    last_order_at: string | null;
    last_order_location_id: string | null;
    origin_location_id: string | null;
    has_pass: boolean;
    last_window_end: string | null;
    has_live_turn: boolean;
  }>(sql`
    select
      m.id as membership_id,
      m.consumer_id,
      m.marketing_opt_out_at,
      m.enrolled_at,
      m.origin_location_id,
      (select max(o.created_at) from core."order" o
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id) as last_order_at,
      (select o.location_id from core."order" o
         where o.business_id = m.business_id and o.consumer_id = m.consumer_id
         order by o.created_at desc, o.id desc limit 1) as last_order_location_id,
      exists (select 1 from consumer.wallet_pass wp
         where wp.consumer_id = m.consumer_id) as has_pass,
      (select max(t.window_end) from core.campaign_turn t
         where t.business_id = m.business_id and t.consumer_id = m.consumer_id
           and t.status in ('active', 'done')) as last_window_end,
      exists (select 1 from core.campaign_turn t
         where t.business_id = m.business_id and t.consumer_id = m.consumer_id
           and t.status in ('queued', 'active')) as has_live_turn
    from consumer.program_membership m
    where m.business_id = ${businessId}
  `);
  return result.rows.map((row) => ({
    membershipId: row.membership_id,
    consumerId: row.consumer_id,
    marketingOptOutAt: toDate(row.marketing_opt_out_at),
    enrolledAt: requireDate(row.enrolled_at),
    lastOrderAt: toDate(row.last_order_at),
    lastOrderLocationId: row.last_order_location_id,
    originLocationId: row.origin_location_id,
    hasPass: row.has_pass,
    lastWindowEnd: toDate(row.last_window_end),
    hasLiveTurn: row.has_live_turn,
  }));
}

export type TurnToQueue = {
  consumerId: string;
  membershipId: string;
  locationId: string;
};

/**
 * Inserts the `queued` turns of one campaign.
 *
 * ⚠️ The `where` of the conflict target is NOT optional: the unique index is PARTIAL
 * (`(business_id, consumer_id) where status in ('queued','active')`), and a bare
 * `on conflict (business_id, consumer_id) do nothing` fails at RUNTIME with «there is
 * no unique or exclusion constraint matching the ON CONFLICT specification» — the tick
 * would blow up on its FIRST run. Verified against Postgres 18 (both cases) while
 * reviewing the spec.
 *
 * Returns the turns actually inserted: `returning` only yields inserted rows, so the
 * count is the honest «enqueued» of the log, not «evaluated».
 */
export async function enqueueTurns(
  db: DbTransaction,
  campaign: ActiveCampaign,
  turns: readonly TurnToQueue[],
  now: Date,
): Promise<number> {
  if (turns.length === 0) return 0;
  const inserted = await db
    .insert(campaignTurns)
    .values(
      turns.map((turn) => ({
        campaignId: campaign.id,
        businessId: campaign.businessId,
        consumerId: turn.consumerId,
        membershipId: turn.membershipId,
        locationId: turn.locationId,
        status: "queued",
        queuedAt: now,
      })),
    )
    .onConflictDoNothing({
      target: [campaignTurns.businessId, campaignTurns.consumerId],
      where: sql`status in ('queued', 'active')`,
    })
    .returning({ id: campaignTurns.id });
  return inserted.length;
}

/**
 * The audience photo of this campaign in this run (pk `(campaign_id, ran_at)`).
 *
 * `do update` and not a plain insert: two runs sharing the same `ran_at` are the SAME
 * photo, and a bare insert made them collide with `23505` — which turned «the tick is
 * idempotent» into «the tick is idempotent unless you run it twice on the same clock»,
 * the exact hedge the DoD exists to forbid. In production the clock moves between runs,
 * so this fires only for a replay; that is precisely when crashing would be worst.
 */
export async function recordTickAudience(
  db: DbTransaction,
  campaignId: string,
  ranAt: Date,
  counts: AudienceCounts,
): Promise<void> {
  const row = {
    total: counts.total,
    reachable: counts.reachable,
    noLocation: counts.noLocation,
    optOut: counts.optOut,
    cooldown: counts.cooldown,
  };
  await db
    .insert(campaignTickAudiences)
    .values({ campaignId, ranAt, ...row })
    .onConflictDoUpdate({
      target: [campaignTickAudiences.campaignId, campaignTickAudiences.ranAt],
      set: row,
    });
}
