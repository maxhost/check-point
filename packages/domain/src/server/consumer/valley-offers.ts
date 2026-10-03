import { sql } from "drizzle-orm";
import { type DbTransaction, withDbTransaction } from "@mi-pasaporte/db";
import { rewardSnapshot } from "../marketing/coupon-issue";
import {
  type CrossOfferFacts,
  type GeoPoint,
  decideCrossOffer,
} from "../marketing/cross-rules";
import {
  type CrossCampaign,
  type Db,
  loadCrossCampaigns,
  loadCrossLocations,
  rowsOf,
} from "../marketing/cross-store";
import { loadWindowRows } from "../marketing/valley-store";
import { campaignKindEnabled } from "../marketing/enabled-campaigns";
import { readConsumerCoupon } from "./coupons";
import type { ClaimResult } from "./cross-offers";
import {
  type CrossMembershipRow,
  loadConsumerPosition,
  loadCrossMemberships,
} from "./cross-facts";
import {
  type OpenSlot,
  type ValleyOffer,
  monthCount,
  openSlots,
  toValleyOffer,
  valleyFacts,
} from "./valley-facts";

export type { ValleyOffer } from "./valley-facts";

/**
 * «HORAS VALLE» IN «MIS BENEFICIOS» (spec 0113 / ADR 0105; H4 of `0113-contratos-de-api.md`):
 * the valley offers of C1 and their claim in C2. It REUSES the cross offer's rule
 * (`decideCrossOffer`, never a copy): per candidate valley campaign and per location of its
 * business whose window is OPEN NOW (on the business's wall clock), the rule is asked with
 * `offer.locations = [that location]` —so `too_far` is measured to THAT location—,
 * `audience = "not_active"` and `claimed` = the consumer already holds a valley coupon of
 * THAT location, of any campaign (ADR 0105 §4: once per person and location, forever).
 *
 * The claim is the cross one's shape: `for update` on the campaign, «already has it → 200»
 * without re-evaluating, the rule re-decided inside the transaction with the cap counted
 * under the lock, and `on conflict (valley_location_id, consumer_id) where … do nothing` +
 * re-read as the backstop — 200 when the coupon found is of THIS campaign, 404 otherwise.
 * The coupon lives from the claim until the window closes TODAY (ADR 0105 §3).
 */

type Held = { couponId: string; campaignId: string };

/** ADR 0105 §4: the valley coupons the consumer holds, by location (any campaign). */
export async function loadValleyClaims(
  db: Db,
  consumerId: string,
  locationId?: string,
): Promise<Map<string, Held>> {
  const result = await db.execute(sql`
    select cc.valley_location_id, cc.id, cc.campaign_id from core.campaign_coupon cc
    where cc.consumer_id = ${consumerId} and cc.valley_location_id is not null
      ${locationId ? sql`and cc.valley_location_id = ${locationId}` : sql``}`);
  return new Map(
    rowsOf<Record<string, unknown>>(result).map((row) => [
      String(row.valley_location_id),
      { couponId: String(row.id), campaignId: String(row.campaign_id) },
    ]),
  );
}

/** C1's valley half: one offer per (campaign, location with an open window) that passes. */
export async function listValleyOffers(
  db: Db,
  consumerId: string,
  base: Pick<CrossOfferFacts, "now" | "position">,
  memberships: Map<string, CrossMembershipRow>,
): Promise<{ offer: ValleyOffer; meters: number }[]> {
  const campaigns = await loadCrossCampaigns(db, base.now, undefined, "valley");
  if (campaigns.length === 0) return [];
  const locations = await loadCrossLocations(db, [
    ...new Set(campaigns.map((campaign) => campaign.businessId)),
  ]);
  const windows = await loadWindowRows(
    db,
    locations.map((location) => location.id),
  );
  const held = await loadValleyClaims(db, consumerId);
  const found: { offer: ValleyOffer; meters: number }[] = [];
  for (const campaign of campaigns) {
    let count: number | null = null;
    for (const slot of openSlots(campaign, locations, windows, base.now)) {
      const facts = (given: number) =>
        valleyFacts(
          campaign,
          slot,
          base,
          memberships.get(campaign.businessId) ?? null,
          held.has(slot.location.id),
          given,
        );
      // The cap is the LAST rule: its count is only read for an offer that passes the rest.
      if (!decideCrossOffer(facts(0)).ok) continue;
      count ??= await monthCount(db, campaign, base.now);
      const decision = decideCrossOffer(facts(count));
      if (!decision.ok) continue;
      found.push({
        offer: toValleyOffer(campaign, slot, decision.distanceMeters),
        meters: decision.distanceMeters,
      });
    }
  }
  return found;
}

async function insertValleyCoupon(
  tx: DbTransaction,
  campaign: CrossCampaign,
  slot: OpenSlot,
  consumerId: string,
  membershipId: string | null,
  now: Date,
): Promise<string | null> {
  const reward = rewardSnapshot(campaign.reward);
  const at = now.toISOString();
  const [row] = rowsOf<{ id: string }>(
    await tx.execute(sql`
      insert into core.campaign_coupon
        (campaign_id, business_id, consumer_id, membership_id, cross_claimed_at,
         valley_location_id, label_snapshot, cost_snapshot, kind_snapshot, product_id,
         discount_unit_snapshot, discount_value_snapshot, currency_code_snapshot,
         extra_units_snapshot, rule_snapshot, valid_from, valid_until, created_at)
      values (${campaign.id}, ${campaign.businessId}, ${consumerId}, ${membershipId},
        ${at}, ${slot.location.id}, ${campaign.couponLabel}, ${campaign.couponCost},
        ${reward.kindSnapshot}, ${reward.productId}, ${reward.discountUnitSnapshot},
        ${reward.discountValueSnapshot}, ${reward.currencyCodeSnapshot},
        ${reward.extraUnitsSnapshot}, ${reward.ruleSnapshot}, ${at},
        ${slot.endsAt.toISOString()}, ${at})
      on conflict (valley_location_id, consumer_id) where valley_location_id is not null
      do nothing
      returning id`),
  );
  return row ? String(row.id) : null;
}

const NO_LOCATION_IN_CROSS = {
  locationId: "Esta oferta no lleva local: se reclama sin él.",
};

/** C2 for a valley offer: `locationId` is the location of the open window. */
export async function claimValleyOffer(
  consumerId: string,
  campaignId: string,
  locationId: string,
  gps: GeoPoint | null,
  now: Date = new Date(),
): Promise<ClaimResult> {
  // Spec 0138 / ADR 0115: valley is OFF — the same 404 as a campaign that does not exist,
  // answered before opening the transaction.
  if (!campaignKindEnabled("valley")) return { status: 404 };
  const outcome = await withDbTransaction(async (tx) => {
    const [locked] = rowsOf<{ template_key: string }>(
      await tx.execute(sql`
        select c.template_key from core.campaign c
        where c.id = ${campaignId} and c.template_key in ('cross', 'valley')
        for update`),
    );
    if (!locked) return null;
    if (locked.template_key !== "valley") return { status: 400 as const };
    const held = (await loadValleyClaims(tx, consumerId, locationId)).get(
      locationId,
    );
    if (held)
      return held.campaignId === campaignId
        ? { status: 200 as const, id: held.couponId }
        : null;
    const [campaign] = await loadCrossCampaigns(tx, now, campaignId, "valley");
    if (!campaign) return null;
    const location = (await loadCrossLocations(tx, [campaign.businessId])).find(
      (own) => own.id === locationId,
    );
    if (!location) return null;
    const [slot] = openSlots(
      campaign,
      [location],
      await loadWindowRows(tx, [location.id]),
      now,
    );
    if (!slot) return null;
    const membership =
      (await loadCrossMemberships(tx, consumerId)).get(campaign.businessId) ??
      null;
    const decision = decideCrossOffer(
      valleyFacts(
        campaign,
        slot,
        { now, position: await loadConsumerPosition(tx, consumerId, gps) },
        membership,
        false, // answered by the read above: no valley coupon of this location
        await monthCount(tx, campaign, now), // under the campaign's lock
      ),
    );
    if (!decision.ok) return null;
    const id = await insertValleyCoupon(
      tx,
      campaign,
      slot,
      consumerId,
      membership?.membershipId ?? null,
      now,
    );
    if (id) return { status: 201 as const, id };
    const again = (await loadValleyClaims(tx, consumerId, locationId)).get(
      locationId,
    );
    return again?.campaignId === campaignId
      ? { status: 200 as const, id: again.couponId }
      : null;
  });
  if (outcome === null) return { status: 404 };
  if (outcome.status === 400)
    return { status: 400, fields: NO_LOCATION_IN_CROSS };
  const coupon = await readConsumerCoupon(consumerId, outcome.id, now);
  if (!coupon)
    throw new Error("El cupón de horas valle recién emitido no se pudo leer.");
  return { status: outcome.status, coupon };
}
