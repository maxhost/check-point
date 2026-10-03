import { withDbTransaction } from "@mi-pasaporte/db";
import {
  factsFor,
  insertCrossCoupon,
  monthCount,
} from "../consumer/cross-offers";
import {
  loadClaimedCrossCoupons,
  loadConsumerPosition,
  loadCrossMemberships,
} from "../consumer/cross-facts";
import {
  COOLDOWN_MS,
  CROSS_LOTTERY_EPSILON,
  CROSS_LOTTERY_POLICY,
} from "../notifications/limits";
import { type LotteryCandidate, drawCrossLottery } from "./cross-lottery";
import { crossOrigin, decideCrossOffer, nearestPoint } from "./cross-rules";
import {
  type CandidateRow,
  closeDecision,
  enqueueCrossPush,
  gotNewCustomerSince,
  insertCandidates,
  loadLotteryHistory,
  loadOrderHistory,
  lockCampaigns,
  openDecision,
  readDecisionOrder,
} from "./cross-sale-store";
import {
  type CrossCampaign,
  loadCrossCampaigns,
  loadCrossLocations,
} from "./cross-store";
import { localMonthStart } from "./welcome-rules";

/**
 * THE CROSS SALE, TRIGGERED BY THE PURCHASE (spec 0143 / ADR 0117). After the counter
 * accredits an order in A (`counter/after-grant.ts`), ONE eligible cross campaign is drawn
 * by the H4 lottery (`cross-lottery.ts`), its coupon is issued to the consumer (already
 * theirs, ADR 0117 §2) and the «🎁 Tenés un regalo» push is queued at the minimum spacing.
 * Every decision is recorded (`core.cross_decision` + `core.cross_candidate`), including
 * the purchases with nothing to offer. ONE transaction; the rules are C1's
 * (`decideCrossOffer`, the cap last and counted under the campaigns' lock).
 */

const DAY_MS = 86_400_000;

export const CROSS_PUSH_TITLE = "🎁 Tenés un regalo";
export const crossPushBody = (businessName: string) =>
  `Por tu compra en ${businessName}. Abrí la app y descubrí qué es.`;

export type CrossSegment = "new" | "dormant" | "regular";

/** Spec 0143 §3: never bought in B → `new`; last order before `now − dormantDays` →
 * `dormant`; otherwise `regular`. Recorded, it does not weigh in stage 1. */
export function crossSegment(
  history: { count: number; lastOrderAt: Date | null },
  dormantDays: number,
  now: Date,
): CrossSegment {
  if (history.count === 0 || history.lastOrderAt === null) return "new";
  return history.lastOrderAt.getTime() < now.getTime() - dormantDays * DAY_MS
    ? "dormant"
    : "regular";
}

export type CrossSaleOutcome =
  "issued" | "no_candidates" | "no_origin" | "coupon_conflict";

export type CrossSaleOptions = {
  now?: Date;
  /** The draw `u ∈ [0, 1)`. */
  random?: () => number;
};

type Eligible = {
  campaign: CrossCampaign;
  locationId: string;
  distanceMeters: number;
  capRemaining: number;
  membershipId: string | null;
};

/**
 * Decides the cross sale of ONE accredited order. `null` when the order does not exist or
 * another run already decided it (nothing is written then).
 */
export async function decideCrossSale(
  orderId: string,
  options: CrossSaleOptions = {},
): Promise<CrossSaleOutcome | null> {
  const now = options.now ?? new Date();
  const random = options.random ?? Math.random;
  return await withDbTransaction(async (tx) => {
    const order = await readDecisionOrder(tx, orderId);
    if (!order) return null;
    const decisionId = await openDecision(tx, orderId, order, {
      policy: CROSS_LOTTERY_POLICY,
      epsilon: CROSS_LOTTERY_EPSILON,
      now,
    });
    // Another run already decided this order: nothing more is written.
    if (decisionId === null) return null;
    const close = (fields: Parameters<typeof closeDecision>[2]) =>
      closeDecision(tx, decisionId, fields);
    const empty = {
      draw: null,
      chosenCampaignId: null,
      couponId: null,
      queueId: null,
    };

    const position = await loadConsumerPosition(tx, order.consumerId, null);
    const origin = crossOrigin(position);
    if (origin.point === null) {
      await close({
        originKind: "none",
        outcome: "no_origin",
        candidateCount: 0,
        ...empty,
      });
      return "no_origin";
    }
    const campaigns = await loadCrossCampaigns(tx, now);
    const locations = await loadCrossLocations(tx, [
      ...new Set(campaigns.map((campaign) => campaign.businessId)),
    ]);
    const memberships = await loadCrossMemberships(tx, order.consumerId);
    const claimed = await loadClaimedCrossCoupons(tx, order.consumerId);
    const factsOf = (campaign: CrossCampaign, count: number) =>
      factsFor(
        campaign,
        locations.filter((l) => l.businessId === campaign.businessId),
        { now, position },
        memberships.get(campaign.businessId) ?? null,
        claimed.has(campaign.id),
        count,
      );
    // Every rule but the cap; then the cap, counted under the campaigns' lock.
    const passing = campaigns.filter((c) => decideCrossOffer(factsOf(c, 0)).ok);
    await lockCampaigns(
      tx,
      passing.map((c) => c.id),
    );
    const eligible: Eligible[] = [];
    for (const campaign of passing) {
      const count = await monthCount(tx, campaign, now);
      if (!decideCrossOffer(factsOf(campaign, count)).ok) continue;
      const own = locations.filter((l) => l.businessId === campaign.businessId);
      const nearest = nearestPoint(origin.point, own);
      if (!nearest) continue;
      eligible.push({
        campaign,
        locationId: nearest.point.id,
        distanceMeters: nearest.meters,
        capRemaining: campaign.monthlyCap - count,
        membershipId:
          memberships.get(campaign.businessId)?.membershipId ?? null,
      });
    }
    if (eligible.length === 0) {
      await close({
        originKind: "last_scan",
        outcome: "no_candidates",
        candidateCount: 0,
        ...empty,
      });
      return "no_candidates";
    }

    const lottery: LotteryCandidate[] = [];
    const history = new Map<
      string,
      { count: number; lastOrderAt: Date | null }
    >();
    for (const entry of eligible) {
      const { campaign } = entry;
      const monthStart = localMonthStart(now, campaign.timeZone);
      const past = await loadLotteryHistory(tx, campaign.id, monthStart);
      lottery.push({
        campaignId: campaign.id,
        distanceMeters: entry.distanceMeters,
        previousShare: past.previousShare,
        received: past.received,
        noNewCustomer: !(await gotNewCustomerSince(
          tx,
          campaign.businessId,
          monthStart,
        )),
      });
      history.set(
        campaign.id,
        await loadOrderHistory(tx, order.consumerId, campaign.businessId),
      );
    }
    const result = drawCrossLottery(lottery, random());
    if (!result) throw new Error("La loteria no eligio con candidatas.");
    const chosen = eligible.find((e) => e.campaign.id === result.chosen)!;
    const couponId = await insertCrossCoupon(
      tx,
      chosen.campaign,
      order.consumerId,
      chosen.membershipId,
      now,
    );
    const queueId = couponId
      ? await enqueueCrossPush(tx, {
          consumerId: order.consumerId,
          title: CROSS_PUSH_TITLE,
          body: crossPushBody(order.businessName),
          notBefore: new Date(now.getTime() + COOLDOWN_MS),
        })
      : null;
    await close({
      originKind: "last_scan",
      outcome: couponId ? "issued" : "coupon_conflict",
      candidateCount: eligible.length,
      draw: result.draw,
      chosenCampaignId: result.chosen,
      couponId,
      queueId,
    });
    await insertCandidates(
      tx,
      decisionId,
      result.entries.map((factor): CandidateRow => {
        const entry = eligible.find(
          (e) => e.campaign.id === factor.campaignId,
        )!;
        const past = history.get(factor.campaignId)!;
        return {
          campaignId: factor.campaignId,
          businessId: entry.campaign.businessId,
          locationId: entry.locationId,
          categoryGcid: entry.campaign.categoryGcid,
          distanceMeters: Math.round(entry.distanceMeters),
          capRemaining: entry.capRemaining,
          segment: crossSegment(past, entry.campaign.dormantDays, now),
          daysSinceLastOrder: past.lastOrderAt
            ? Math.floor((now.getTime() - past.lastOrderAt.getTime()) / DAY_MS)
            : null,
          ordersCount: past.count,
          closeness: factor.closeness,
          behind: factor.behind,
          bonus: factor.bonus,
          probability: factor.probability,
        };
      }),
    );
    return couponId ? "issued" : "coupon_conflict";
  });
}
