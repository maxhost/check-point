/**
 * What the LISTING screen reads (spec 0065: «lista las campañas del negocio con estado,
 * audiencia del ultimo tick, turnos activos y un resumen de resultados»), plus the one
 * number the composer needs about the business as a whole.
 *
 * It is not `loadCampaignResults` in a loop: that one fires five queries PER campaign to
 * build the full DTO of the detail screen. Here the tallies come grouped in a single
 * pass, because a listing of twenty campaigns would otherwise be a hundred round trips
 * for four numbers each.
 *
 * ⚠️ Every count goes through `.mapWith(Number)`. MEASURED (CLAUDE.md): `count(*)` is a
 * `bigint` and the Neon driver hands it back as the STRING `"7"`, which would travel into
 * a `number` field with typecheck in green and then compare lexicographically.
 */

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { campaignTickAudiences, campaignTurns } from "../schema";
import { type Campaign, listCampaigns } from "./campaign-store";

export type CampaignOverview = {
  campaign: Campaign;
  /** The LAST tick's photo, or `null` when no tick has evaluated this campaign yet.
   * Zeros would read as «nobody qualified» instead of «not measured yet». */
  lastAudience: { ranAt: Date; total: number; reachable: number } | null;
  activeTurns: number;
  doneTurns: number;
  /** Same definition of «bought» as `results-store.ts` and as the queue's merit:
   * `outcome in ('purchase','coupon_redeemed')`. A listing that counted only
   * `'purchase'` would disagree with the detail screen of the same campaign. */
  windowPurchases: number;
};

const tally = (filter: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${filter})`.mapWith(Number);

async function loadTallies(
  businessId: string,
): Promise<Map<string, { active: number; done: number; purchases: number }>> {
  const done = sql`${campaignTurns.status} = 'done'`;
  const rows = await getDb()
    .select({
      campaignId: campaignTurns.campaignId,
      active: tally(sql`${campaignTurns.status} = 'active'`),
      done: tally(done),
      purchases: tally(
        sql`${done} and ${campaignTurns.outcome} in ('purchase', 'coupon_redeemed')`,
      ),
    })
    .from(campaignTurns)
    .where(eq(campaignTurns.businessId, businessId))
    .groupBy(campaignTurns.campaignId);
  return new Map(rows.map((row) => [row.campaignId, row]));
}

/**
 * One row per campaign: its newest photo. `selectDistinctOn` renders Postgres's
 * `distinct on`, so the `order by` MUST start with the same column — that is what makes
 * «the first row of each group» well defined instead of whatever the scan returned first.
 */
async function loadPhotos(
  campaignIds: string[],
): Promise<Map<string, { ranAt: Date; total: number; reachable: number }>> {
  if (campaignIds.length === 0) return new Map();
  const rows = await getDb()
    .selectDistinctOn([campaignTickAudiences.campaignId], {
      campaignId: campaignTickAudiences.campaignId,
      ranAt: campaignTickAudiences.ranAt,
      total: campaignTickAudiences.total,
      reachable: campaignTickAudiences.reachable,
    })
    .from(campaignTickAudiences)
    .where(inArray(campaignTickAudiences.campaignId, campaignIds))
    .orderBy(
      campaignTickAudiences.campaignId,
      desc(campaignTickAudiences.ranAt),
    );
  return new Map(rows.map((row) => [row.campaignId, row]));
}

export async function listCampaignOverviews(
  businessId: string,
): Promise<CampaignOverview[]> {
  const campaigns = await listCampaigns(businessId);
  const [tallies, photos] = await Promise.all([
    loadTallies(businessId),
    loadPhotos(campaigns.map((campaign) => campaign.id)),
  ]);
  return campaigns.map((campaign) => {
    const counts = tallies.get(campaign.id);
    return {
      campaign,
      lastAudience: photos.get(campaign.id) ?? null,
      activeTurns: counts?.active ?? 0,
      doneTurns: counts?.done ?? 0,
      windowPurchases: counts?.purchases ?? 0,
    };
  });
}

/**
 * The business's live share of the platform quota — `active` non-holdout turns, the SAME
 * predicate `loadBusinessActiveTurns` uses inside the tick. Scoped to one business and
 * read outside a transaction, because the composer only needs it to show «va a ocupar N
 * turnos»: the cap that HOLDS is the tick's, under its advisory lock.
 */
export async function countActiveTurns(businessId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(campaignTurns)
    .where(
      and(
        eq(campaignTurns.businessId, businessId),
        eq(campaignTurns.status, "active"),
        eq(campaignTurns.holdout, false),
      ),
    );
  return row?.total ?? 0;
}
