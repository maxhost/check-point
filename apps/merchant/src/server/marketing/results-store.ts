/**
 * The DB half of the results screen (spec 0065, «Resultados»). It reads; it never
 * writes. `results.ts` holds the shape and the gating, this file only answers «what do
 * the rows say», and the route composes the two.
 *
 * ⚠️ Counts here go through the query builder with `.mapWith(Number)`, or through a raw
 * `count(...)::int`. MEASURED, not assumed: `count(*)` is a `bigint` and the Neon driver
 * hands a bare one back as the STRING `"7"` (probe against the ephemeral branch,
 * 2026-09-16), which `db.execute<T>`'s generic — an assertion, not a check — would let
 * through into a `number` field. `"7" + 1` is `"71"`, and a total that is a string
 * compares wrong against 30 in the estimate's gate.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  campaignTickAudiences,
  campaignTurns,
  couponRedemptions,
  passPlacements,
  programMemberships,
} from "../schema";
import {
  buildCampaignResults,
  type CampaignResults,
  type LocationRow,
  type ResultsFacts,
} from "./results";

/**
 * Same definition of «bought in its window» as `marketing/merit.ts`, and that is
 * load-bearing: the tick ORDERS the queue with it, so a results screen that counted only
 * `'purchase'` would contradict the ranking of the very campaign it describes.
 *
 * ONE list feeding BOTH shapes, and that is not tidiness. The first version wrote the
 * two literals twice — once for the builder, once inside the raw per-door SQL — and the
 * mutation that narrows it to `'purchase'` came out red in the totals and GREEN in the
 * breakdown: the same screen would have shown 1 of 4 at the top and 2 by the door, with
 * nothing failing. The raw half cannot reuse the builder fragment (drizzle renders the
 * column unqualified and it would bind to the wrong table — `CLAUDE.md`), so what is
 * shared is the VALUES.
 */
const BOUGHT_OUTCOMES = ["purchase", "coupon_redeemed"] as const;
const boughtList = sql.join(
  BOUGHT_OUTCOMES.map((outcome) => sql`${outcome}`),
  sql`, `,
);
const BOUGHT = sql`${campaignTurns.outcome} in (${boughtList})`;
const DONE = sql`${campaignTurns.status} = 'done'`;

async function loadAudiencePhoto(campaignId: string) {
  const [row] = await getDb()
    .select({
      ranAt: campaignTickAudiences.ranAt,
      total: campaignTickAudiences.total,
      reachable: campaignTickAudiences.reachable,
      noLocation: campaignTickAudiences.noLocation,
      optOut: campaignTickAudiences.optOut,
      cooldown: campaignTickAudiences.cooldown,
    })
    .from(campaignTickAudiences)
    .where(eq(campaignTickAudiences.campaignId, campaignId))
    // The LAST run wins: the table keeps one photo per `ran_at` and the screen says
    // «último tick». Without the order this would be whatever the scan returned first.
    .orderBy(desc(campaignTickAudiences.ranAt))
    .limit(1);
  return row ?? null;
}

const tally = (filter: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${filter})`.mapWith(Number);

async function loadTurnFacts(businessId: string, campaignId: string) {
  const held = sql`${campaignTurns.holdout} = true`;
  const placed = sql`${campaignTurns.holdout} = false`;
  const [row] = await getDb()
    .select({
      queued: tally(sql`${campaignTurns.status} = 'queued'`),
      active: tally(sql`${campaignTurns.status} = 'active'`),
      done: tally(DONE),
      cancelled: tally(sql`${campaignTurns.status} = 'cancelled'`),
      held: tally(held),
      placedN: tally(sql`${placed} and ${DONE}`),
      placedPurchases: tally(sql`${placed} and ${DONE} and ${BOUGHT}`),
      holdoutN: tally(sql`${held} and ${DONE}`),
      holdoutPurchases: tally(sql`${held} and ${DONE} and ${BOUGHT}`),
    })
    .from(campaignTurns)
    .where(
      and(
        eq(campaignTurns.campaignId, campaignId),
        eq(campaignTurns.businessId, businessId),
      ),
    );
  return row;
}

/**
 * `sum(cost_snapshot)`, NOT `n × coupon_cost`.
 *
 * DECISION OF THE ORCHESTRATOR, not of the owner: the spec writes the incurred cost as
 * «n × costo» and says nothing about which cost. The two agree until somebody edits a
 * paused campaign's coupon — and then `n × costo_actual` restates what was already
 * handed over at the counter, which is the one thing a cost «incurrido» may not do. The
 * snapshot is what the consumer was promised and what the counter honoured.
 */
async function loadCouponFacts(businessId: string, campaignId: string) {
  const [row] = await getDb()
    .select({
      redeemed: sql<number>`count(*)`.mapWith(Number),
      incurredCost: sql<string | null>`sum(${couponRedemptions.costSnapshot})`,
    })
    .from(couponRedemptions)
    .where(
      and(
        eq(couponRedemptions.campaignId, campaignId),
        eq(couponRedemptions.businessId, businessId),
      ),
    );
  return row;
}

/**
 * Per door (ADR 0042). It walks `campaign_location`, not the turns, so a door the owner
 * assigned and that produced NOTHING still shows up with its zeros — «este local no
 * trajo a nadie» is an answer, and a missing row reads as «todavía no calculado».
 *
 * Raw SQL with explicit aliases: a correlated subquery written with the builder gets its
 * column rendered UNQUALIFIED when the select has a single table and silently binds to
 * the inner one (`CLAUDE.md`, measured in A5). Every count is cast to `int`.
 */
async function loadByLocation(campaignId: string): Promise<LocationRow[]> {
  const result = await getDb().execute<{
    location_id: string;
    name: string;
    turns: number;
    window_purchases: number;
    redemptions: number;
  }>(sql`
    select
      l.id as location_id,
      l.name,
      count(t.id)::int as turns,
      count(t.id) filter (
        where t.status = 'done' and t.outcome in (${boughtList})
      )::int as window_purchases,
      (select count(*) from core.coupon_redemption cr
         where cr.campaign_id = ${campaignId} and cr.location_id = l.id)::int as redemptions
    from core.campaign_location cl
    join core.location l on l.id = cl.location_id
    left join core.campaign_turn t
      on t.campaign_id = ${campaignId} and t.location_id = l.id
    where cl.campaign_id = ${campaignId}
    group by l.id, l.name
    order by l.name asc, l.id asc
  `);
  return result.rows.map((row) => ({
    locationId: row.location_id,
    name: row.name,
    turns: row.turns,
    windowPurchases: row.window_purchases,
    redemptions: row.redemptions,
  }));
}

/**
 * «Estás en el pase de K de tus C clientes» — per BUSINESS and not per campaign, which
 * is what the spec asks for: it answers «cuánta de mi gente me lleva encima», a fact
 * about the business that no single campaign owns. `count(distinct consumer_id)` because
 * one consumer can hold several doors of the same business in their pass.
 */
async function loadPassReach(businessId: string) {
  const [placed] = await getDb()
    .select({
      inPass: sql<number>`count(distinct ${passPlacements.consumerId})`.mapWith(
        Number,
      ),
    })
    .from(passPlacements)
    .where(eq(passPlacements.businessId, businessId));
  const [members] = await getDb()
    .select({ members: sql<number>`count(*)`.mapWith(Number) })
    .from(programMemberships)
    .where(eq(programMemberships.businessId, businessId));
  return { inPass: placed?.inPass ?? 0, members: members?.members ?? 0 };
}

/**
 * The facts of one campaign. The caller resolves the 404 — `getCampaign` is what scopes
 * by business — and the two counting queries filter by `business_id` AS WELL, since both
 * tables carry it denormalized: a campaign id that arrived from anywhere else still
 * cannot sum another business's turns or redemptions.
 */
export async function loadCampaignResults(
  businessId: string,
  campaignId: string,
  coupon: { label: string | null; cap: number | null },
): Promise<CampaignResults> {
  const [audience, turns, redeemed, byLocation, passReach] = await Promise.all([
    loadAudiencePhoto(campaignId),
    loadTurnFacts(businessId, campaignId),
    loadCouponFacts(businessId, campaignId),
    loadByLocation(campaignId),
    loadPassReach(businessId),
  ]);
  const facts: ResultsFacts = {
    audience,
    turns: {
      queued: turns.queued,
      active: turns.active,
      done: turns.done,
      cancelled: turns.cancelled,
      held: turns.held,
    },
    window: {
      placedN: turns.placedN,
      placedPurchases: turns.placedPurchases,
      holdoutN: turns.holdoutN,
      holdoutPurchases: turns.holdoutPurchases,
    },
    coupon: {
      label: coupon.label,
      cap: coupon.cap,
      redeemed: redeemed.redeemed,
      incurredCost: redeemed.incurredCost,
    },
    byLocation,
    passReach,
  };
  return buildCampaignResults(facts);
}
