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
import { getDb } from "./db";
import { campaignTurns, couponRedemptions, walletPushQueue } from "./schema";
import { resolveScan } from "./counter/resolve";

/**
 * The world of the coupon at the counter (spec 0065 phase C): one business with a
 * `points` program and an ACTIVE campaign that carries a coupon, plus a factory for
 * consumers who each hold a live turn of that campaign.
 *
 * It seeds the turn DIRECTLY instead of running the tick. That is deliberate and
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
};

export async function seedCouponWorld(
  prefix: string,
  cap = 100,
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
  });
  return { seed, campaignId };
}

export async function dropCouponWorld(world: CouponWorld): Promise<void> {
  await dropCampaigns(world.seed.business.id);
  await dropBusiness(world.seed.business.id);
}

export type CouponCard = {
  consumerId: string;
  membershipId: string;
  turnId: string;
  qrToken: string;
};

/**
 * A consumer with a live turn of the world's campaign. `points` is seeded non-zero on
 * purpose: the DoD demands the coupon leaves `points_balance` and `stamps_count`
 * untouched, and a balance of 0 would satisfy that assertion for free.
 */
type TurnOverrides = Partial<
  Omit<Parameters<typeof seedTurn>[0], "campaignId" | "businessId">
>;

export async function newCouponCard(
  world: CouponWorld,
  over: TurnOverrides = {},
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
  return {
    consumerId: consumer.id,
    membershipId: resolved.membership.id,
    turnId,
    qrToken: consumer.qrToken,
  };
}

export function couponBody(card: CouponCard, seed: Seed, key?: string) {
  return {
    clientRequestId: key ?? randomUUID(),
    turnId: card.turnId,
    locationId: seed.locationId,
  };
}

/** The redemption rows of a campaign, read by SQL. The API answer is never the oracle
 * (ADR 0054 §4). */
export async function readCoupons(campaignId: string) {
  return getDb()
    .select({
      id: couponRedemptions.id,
      turnId: couponRedemptions.turnId,
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
