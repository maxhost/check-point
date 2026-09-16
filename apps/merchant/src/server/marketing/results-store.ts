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
import { boughtList } from "./campaign-values";
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

/** La definición de «compró en su ventana» sale de `campaign-values.ts`, que es la ÚNICA:
 * este archivo la usa en sus dos formas (builder y SQL crudo) y otros dos la usan en la
 * suya. Ver ahí por qué estar sincronizadas es load-bearing. */
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
async function loadByLocation(
  businessId: string,
  campaignId: string,
): Promise<LocationRow[]> {
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
         where cr.campaign_id = ${campaignId} and cr.location_id = l.id
           and cr.business_id = ${businessId})::int as redemptions
    from core.campaign_location cl
    join core.location l on l.id = cl.location_id
    left join core.campaign_turn t
      on t.campaign_id = ${campaignId} and t.location_id = l.id
    where cl.campaign_id = ${campaignId} and l.business_id = ${businessId}
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
 * by business — and **every** query here filters by `business_id` AS WELL: a campaign id
 * that arrived from anywhere else still cannot read another business's numbers.
 *
 * DECIA «the two counting queries», Y ERAN DOS DE CUATRO. La revision independiente de la
 * fase B lo cazo con una sonda: `loadByLocation` no recibia `businessId` y devolvia el
 * desglose por puerta —nombres de locales, turnos, compras y CANJES— de la campaña de otro
 * negocio. No era explotable por la ruta (el `getCampaign` 404ea antes, y eso si tiene
 * oraculo), pero era la defensa en profundidad que este docblock afirmaba tener. El
 * `where` por negocio va ahora en el `join` de locales Y en el subselect de canjes.
 *
 * `loadAudiencePhoto` sigue sin `business_id` a proposito: `campaign_tick_audience` no lo
 * lleva, su pk es `(campaign_id, ran_at)` y sus cinco conteos son de la campaña, no del
 * negocio. Queda declarado acá para que nadie lo lea como el mismo olvido.
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
    loadByLocation(businessId, campaignId),
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
