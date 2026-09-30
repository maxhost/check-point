import { sql } from "drizzle-orm";
import { type DbTransaction, getDb, withDbTransaction } from "../db";
import { rewardSnapshot } from "../marketing/coupon-issue";
import {
  type CrossOfferFacts,
  type CrossOrigin,
  type GeoPoint,
  crossOrigin,
  decideCrossOffer,
  nearestPoint,
} from "../marketing/cross-rules";
import {
  type CrossCampaign,
  type CrossLocation,
  type Db,
  countMonthCrossCoupons,
  loadCrossCampaigns,
  loadCrossLocations,
  rowsOf,
} from "../marketing/cross-store";
import type { CouponKind, DiscountUnit } from "../marketing/reward-input";
import { localMonthStart } from "../marketing/welcome-rules";
import { type ConsumerCoupon, readConsumerCoupon } from "./coupons";
import {
  type CrossMembershipRow,
  loadClaimedCrossCoupons,
  loadConsumerPosition,
  loadCrossMemberships,
} from "./cross-facts";

/**
 * «MIS BENEFICIOS» — THE CROSS OFFERS (spec 0112 / ADR 0104; contract C1 and C2 of
 * `0112-contratos-de-api.md`). The consumer comes ONLY from the session: `consumerId` is the
 * isolation, never a request field.
 *
 *  - `listCrossOffers` (C1) READS: it never issues a coupon (orchestrator's O1 — the monthly
 *    cap counts coupons, so a look or a prefetch must not spend it).
 *  - `claimCrossOffer` (C2) issues the coupon in ONE transaction: `for update` on the
 *    campaign row, «already has it → 200 with it» (idempotent, not re-evaluated), then the
 *    rules re-decided over facts read INSIDE the transaction (the cap counted under the
 *    lock), and the insert with `on conflict … where cross_claimed_at is not null do
 *    nothing` + re-read as the backstop of O8. No push, no Wallet (ADR 0103 §2).
 */

const DAY_MS = 86_400_000;

/** One offer of C1. Allow-list: no cost, no cap, no membership id, no R2 key. */
export type CrossOffer = {
  campaignId: string;
  businessId: string;
  businessName: string;
  logoPath: string | null;
  message: string;
  label: string;
  kind: CouponKind;
  rule: string | null;
  discountUnit: DiscountUnit | null;
  discountValue: string | null;
  currencyCode: string;
  extraUnits: number | null;
  validDays: number;
  distanceMeters: number;
  nearestLocation: { name: string; addressLabel: string };
};

function toOffer(
  campaign: CrossCampaign,
  nearest: CrossLocation,
  meters: number,
): CrossOffer {
  const { reward } = campaign;
  return {
    campaignId: campaign.id,
    businessId: campaign.businessId,
    businessName: campaign.businessName,
    logoPath: campaign.logoPath,
    message: campaign.message,
    label: campaign.couponLabel,
    kind: reward.kind ?? "free_product",
    rule: reward.rule,
    discountUnit: reward.discountUnit,
    discountValue: reward.discountValue,
    currencyCode: reward.currencyCode,
    extraUnits: reward.extraUnits,
    validDays: campaign.validDays,
    distanceMeters: Math.round(meters),
    nearestLocation: { name: nearest.name, addressLabel: nearest.addressLabel },
  };
}

function factsFor(
  campaign: CrossCampaign,
  locations: CrossLocation[],
  base: Pick<CrossOfferFacts, "now" | "position">,
  membership: CrossMembershipRow | null,
  claimed: boolean,
  claimedThisMonth: number,
): CrossOfferFacts {
  return {
    ...base,
    offer: {
      categoryGcid: campaign.categoryGcid,
      audience: campaign.audience,
      dormantDays: campaign.dormantDays,
      monthlyCap: campaign.monthlyCap,
      locations,
    },
    membership,
    claimed,
    claimedThisMonth,
  };
}

const monthCount = (db: Db, campaign: CrossCampaign, now: Date) =>
  countMonthCrossCoupons(
    db,
    campaign.id,
    localMonthStart(now, campaign.timeZone),
  );

/** C1: the cross offers the session consumer can claim, nearest first (O6). */
export async function listCrossOffers(
  consumerId: string,
  gps: GeoPoint | null,
  now: Date = new Date(),
): Promise<{ origin: CrossOrigin; offers: CrossOffer[] }> {
  const db = getDb();
  const position = await loadConsumerPosition(db, consumerId, gps);
  const origin = crossOrigin(position);
  if (origin.point === null) return { origin: "none", offers: [] };
  const campaigns = await loadCrossCampaigns(db, now);
  const locations = await loadCrossLocations(db, [
    ...new Set(campaigns.map((campaign) => campaign.businessId)),
  ]);
  const memberships = await loadCrossMemberships(db, consumerId);
  const claimed = await loadClaimedCrossCoupons(db, consumerId);
  const found: { offer: CrossOffer; meters: number }[] = [];
  for (const campaign of campaigns) {
    const own = locations.filter((l) => l.businessId === campaign.businessId);
    const facts = (count: number) =>
      factsFor(
        campaign,
        own,
        { now, position },
        memberships.get(campaign.businessId) ?? null,
        claimed.has(campaign.id),
        count,
      );
    // The cap is the LAST rule: its count is only read for an offer that passes the rest.
    if (!decideCrossOffer(facts(0)).ok) continue;
    const decision = decideCrossOffer(
      facts(await monthCount(db, campaign, now)),
    );
    if (!decision.ok) continue;
    const nearest = nearestPoint(origin.point, own);
    if (!nearest) continue;
    found.push({
      offer: toOffer(campaign, nearest.point, decision.distanceMeters),
      meters: decision.distanceMeters,
    });
  }
  found.sort(
    (a, b) =>
      a.meters - b.meters || (a.offer.campaignId < b.offer.campaignId ? -1 : 1),
  );
  return { origin: origin.kind, offers: found.map((entry) => entry.offer) };
}

async function insertCrossCoupon(
  tx: DbTransaction,
  campaign: CrossCampaign,
  consumerId: string,
  membershipId: string | null,
  now: Date,
): Promise<string | null> {
  const reward = rewardSnapshot(campaign.reward);
  const validUntil = new Date(now.getTime() + campaign.validDays * DAY_MS);
  const [row] = rowsOf<{ id: string }>(
    await tx.execute(sql`
      insert into core.campaign_coupon
        (campaign_id, business_id, consumer_id, membership_id, cross_claimed_at,
         label_snapshot, cost_snapshot, kind_snapshot, product_id,
         discount_unit_snapshot, discount_value_snapshot, currency_code_snapshot,
         extra_units_snapshot, rule_snapshot, valid_from, valid_until, created_at)
      values (${campaign.id}, ${campaign.businessId}, ${consumerId}, ${membershipId},
        ${now.toISOString()}, ${campaign.couponLabel}, ${campaign.couponCost},
        ${reward.kindSnapshot}, ${reward.productId}, ${reward.discountUnitSnapshot},
        ${reward.discountValueSnapshot}, ${reward.currencyCodeSnapshot},
        ${reward.extraUnitsSnapshot}, ${reward.ruleSnapshot}, ${now.toISOString()},
        ${validUntil.toISOString()}, ${now.toISOString()})
      on conflict (campaign_id, consumer_id) where cross_claimed_at is not null
      do nothing
      returning id`),
  );
  return row ? String(row.id) : null;
}

export type ClaimResult =
  | { status: 200 | 201; coupon: ConsumerCoupon }
  | { status: 404 };

/** C2: claim one cross offer for the session consumer. */
export async function claimCrossOffer(
  consumerId: string,
  campaignId: string,
  gps: GeoPoint | null,
  now: Date = new Date(),
): Promise<ClaimResult> {
  const outcome = await withDbTransaction(async (tx) => {
    const [locked] = rowsOf<{ id: string }>(
      await tx.execute(sql`
        select c.id from core.campaign c
        where c.id = ${campaignId} and c.template_key = 'cross'
        for update`),
    );
    if (!locked) return null;
    const existing = (
      await loadClaimedCrossCoupons(tx, consumerId, campaignId)
    ).get(campaignId);
    if (existing) return { status: 200 as const, id: existing };
    const [campaign] = await loadCrossCampaigns(tx, now, campaignId);
    if (!campaign) return null;
    const membership =
      (await loadCrossMemberships(tx, consumerId)).get(campaign.businessId) ??
      null;
    const decision = decideCrossOffer(
      factsFor(
        campaign,
        await loadCrossLocations(tx, [campaign.businessId]),
        { now, position: await loadConsumerPosition(tx, consumerId, gps) },
        membership,
        false, // answered by the read above: they have no coupon of this campaign
        await monthCount(tx, campaign, now), // under the campaign's lock
      ),
    );
    if (!decision.ok) return null;
    const id = await insertCrossCoupon(
      tx,
      campaign,
      consumerId,
      membership?.membershipId ?? null,
      now,
    );
    if (id) return { status: 201 as const, id };
    const again = (
      await loadClaimedCrossCoupons(tx, consumerId, campaignId)
    ).get(campaignId);
    return again ? { status: 200 as const, id: again } : null;
  });
  if (outcome === null) return { status: 404 };
  const coupon = await readConsumerCoupon(consumerId, outcome.id, now);
  if (!coupon)
    throw new Error("El cupón cruzado recién emitido no se pudo leer.");
  return { status: outcome.status, coupon };
}
