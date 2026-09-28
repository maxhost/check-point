import { eq } from "drizzle-orm";
import {
  type Seed,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { seedMembership } from "./marketing-integration-support";
import {
  seedDecision,
  seedPushCampaign,
  seedWebPush,
} from "./marketing-push-support";
import { getDb } from "./db";
import { campaignCoupons } from "./schema";
import { FakePushChannel } from "./wallet/push-channel";
import { runPushWorker } from "./wallet/push-worker";
import { FakeWebPushChannel } from "./push/webpush-channel";

/**
 * The world of `marketing-push-delivery.neon.integration.test.ts`, split out by the size
 * budget (spec 0106 added a case). Business zone: America/Guayaquil (UTC-5), window 9–21.
 * `seeds` is dropped by the test file's `afterAll`.
 */
export const HOUR = 3_600_000;
export const NOON = new Date("2026-09-16T17:00:00.000Z"); // 12:00 local — inside
export const NIGHT = new Date("2026-09-17T03:00:00.000Z"); // 22:00 local — outside
export const NEXT_NINE = new Date("2026-09-17T14:00:00.000Z");
export const ENDS = new Date("2026-12-31T00:00:00.000Z");
export const seeds: Seed[] = [];

/** One business, one push campaign with a coupon, one dormant consumer reachable only
 * by Web Push, and ONE pending decision taken two hours before `NOON`. */
export async function world(label: string) {
  const seed = await seedBusiness({
    name: `${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
  });
  seeds.push(seed);
  const campaignId = await seedPushCampaign({
    businessId: seed.business.id,
    userId: seed.userId,
    templateKey: "win_back",
    dormantDays: 60,
    coupon: { label: "2x1 en picadas", cost: "2.50", maxRedemptions: 50 },
    endsAt: ENDS,
  });
  const consumer = await seedConsumer();
  const membershipId = await seedMembership({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
  });
  const endpoint = await seedWebPush(consumer.id);
  const decision = await seedDecision({
    campaignId,
    businessId: seed.business.id,
    consumerId: consumer.id,
    membershipId,
    decidedAt: new Date(NOON.getTime() - 2 * HOUR),
    title: "La Gringa",
    body: "¡Volvé! · 2x1 en picadas",
  });
  return {
    seed,
    campaignId,
    consumerId: consumer.id,
    membershipId,
    endpoint,
    ...decision,
  };
}

export async function work(built: { consumerId: string }, now: Date) {
  const web = new FakeWebPushChannel();
  await runPushWorker({
    channel: new FakePushChannel(),
    webPushChannel: web,
    now,
    consumerIds: [built.consumerId],
  });
  return web;
}

export const coupons = (consumerId: string) =>
  getDb()
    .select()
    .from(campaignCoupons)
    .where(eq(campaignCoupons.consumerId, consumerId));
