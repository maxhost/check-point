import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  type Seed,
  dropBusiness,
  seedBusiness,
  seedConsumer,
  setBalance,
} from "./counter-integration-support";
import { dropCampaigns } from "./marketing-read-support";
import { seedCampaign, seedTurn } from "./marketing-integration-support";
import { seedCampaignCoupon } from "./marketing-coupon-support";
import { getDb } from "./db";
import { campaignTurns, couponRedemptions, walletPushQueue } from "./schema";
import { resolveScan } from "./counter/resolve";

/**
 * The world of the coupon at the counter (spec 0065 phase C): one business with a
 * `points` program and an ACTIVE campaign that carries a coupon, plus a factory for
 * consumers who each hold a live turn of that campaign AND the coupon that turn issued
 * (spec 0102: the counter redeems the coupon, the turn is only its provenance).
 *
 * It seeds the turn and its coupon DIRECTLY instead of running the tick (the tick's
 * issuing has its own suite, `marketing-coupon-issue`). That is deliberate and
 * declared: what phase C has to prove is the redemption's atomicity, and driving the
 * tick would make every assertion here depend on the placement rules of phase A — a red
 * would no longer say which of the two broke.
 */

export const COUPON_LABEL = "2x1 en picadas";
export const COUPON_COST = "2.50";
const DAY = 86_400_000;

export type CouponWorld = {
  seed: Seed;
  campaignId: string;
  /** The campaign's `ends_at`, which every coupon of this world copies as `valid_until`. */
  endsAt: Date;
};

export async function seedCouponWorld(
  prefix: string,
  cap = 100,
  endsAt: Date = new Date(Date.now() + 30 * DAY),
): Promise<CouponWorld> {
  const seed = await seedBusiness({
    name: `${prefix} ${Date.now()}`,
    kind: "points",
    mode: "per_amount",
    grant: 10,
    blockAmount: "1.00",
  });
  const campaignId = await seedCampaign({
    businessId: seed.business.id,
    createdByUserId: seed.userId,
    locationIds: [seed.locationId],
    status: "active",
    coupon: { label: COUPON_LABEL, cost: COUPON_COST, maxRedemptions: cap },
    endsAt,
  });
  return { seed, campaignId, endsAt };
}

export async function dropCouponWorld(world: CouponWorld): Promise<void> {
  await dropCampaigns(world.seed.business.id);
  await dropBusiness(world.seed.business.id);
}

export type CouponCard = {
  consumerId: string;
  membershipId: string;
  turnId: string;
  couponId: string;
  qrToken: string;
};

/**
 * A consumer with a live turn of the world's campaign. `points` is seeded non-zero on
 * purpose: the DoD demands the coupon leaves `points_balance` and `stamps_count`
 * untouched, and a balance of 0 would satisfy that assertion for free.
 */
type TurnOverrides = Partial<
  Omit<Parameters<typeof seedTurn>[0], "campaignId" | "businessId">
> & {
  /** Spec 0106: the card's coupon credits extra stamps/points. */
  extra?: Parameters<typeof seedCampaignCoupon>[0]["extra"];
};

export async function newCouponCard(
  world: CouponWorld,
  { extra, ...over }: TurnOverrides = {},
): Promise<CouponCard> {
  const consumer = await seedConsumer();
  const resolved = await resolveScan(world.seed.business, consumer.qrToken);
  await setBalance(resolved.membership.id, { points: 77 });
  const now = Date.now();
  const turnId = await seedTurn({
    campaignId: world.campaignId,
    businessId: world.seed.business.id,
    consumerId: consumer.id,
    membershipId: resolved.membership.id,
    locationId: world.seed.locationId,
    status: "active",
    windowStart: new Date(now - DAY),
    windowEnd: new Date(now + 4 * DAY),
    messageSnapshot: "2x1 en picadas hasta el domingo",
    couponLabelSnapshot: COUPON_LABEL,
    couponCostSnapshot: COUPON_COST,
    ...over,
  });
  // The coupon the tick would have issued at activation: valid from the window's start
  // until the campaign's `ends_at`, copied (ADR 0094 §1).
  const couponId = await seedCampaignCoupon({
    campaignId: world.campaignId,
    businessId: world.seed.business.id,
    consumerId: consumer.id,
    membershipId: resolved.membership.id,
    turnId,
    label: COUPON_LABEL,
    cost: COUPON_COST,
    validFrom: new Date(now - DAY),
    validUntil: world.endsAt,
    extra,
  });
  return {
    consumerId: consumer.id,
    membershipId: resolved.membership.id,
    turnId,
    couponId,
    qrToken: consumer.qrToken,
  };
}

export function couponBody(card: CouponCard, seed: Seed, key?: string) {
  return {
    clientRequestId: key ?? randomUUID(),
    couponId: card.couponId,
    locationId: seed.locationId,
  };
}

/** The redemption rows of a campaign, read by SQL. The API answer is never the oracle
 * (ADR 0054 §4). */
export async function readCoupons(campaignId: string) {
  return getDb()
    .select({
      id: couponRedemptions.id,
      couponId: couponRedemptions.couponId,
      labelSnapshot: couponRedemptions.labelSnapshot,
      costSnapshot: couponRedemptions.costSnapshot,
      clientRequestId: couponRedemptions.clientRequestId,
    })
    .from(couponRedemptions)
    .where(eq(couponRedemptions.campaignId, campaignId))
    .orderBy(couponRedemptions.createdAt);
}

export async function readTurn(turnId: string) {
  const [row] = await getDb()
    .select({
      status: campaignTurns.status,
      outcome: campaignTurns.outcome,
      outcomeRedemptionId: campaignTurns.outcomeRedemptionId,
      outcomeAt: campaignTurns.outcomeAt,
    })
    .from(campaignTurns)
    .where(eq(campaignTurns.id, turnId));
  return row;
}

export async function readPushes(consumerId: string) {
  return getDb()
    .select({
      id: walletPushQueue.id,
      class: walletPushQueue.class,
      body: walletPushQueue.body,
    })
    .from(walletPushQueue)
    .where(eq(walletPushQueue.consumerId, consumerId));
}
