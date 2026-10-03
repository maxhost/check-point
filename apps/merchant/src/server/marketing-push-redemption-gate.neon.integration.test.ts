import { afterAll, describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { seedMembership } from "./marketing-integration-support";
import {
  readPush,
  readQueue,
  seedDecision,
  seedPushCampaign,
  seedRedemption,
  seedWebPush,
} from "./marketing-push-support";
import { dropCampaigns } from "./marketing-read-support";
import { FakePushChannel } from "./wallet/push-channel";
import { runPushWorker } from "./wallet/push-worker";
import { FakeWebPushChannel } from "@mi-pasaporte/domain/server/push/webpush-channel";

/**
 * Spec 0104 §7 / ADR 0096 §5: A REDEMPTION IS A VISIT for the gate of a campaign push, for
 * EVERY template. Through the REAL `runPushWorker` (fake transports), as the 0103 suite
 * `marketing-push-delivery.neon.integration.test.ts` does — a separate file because that
 * one sits at the size budget. Zone America/Guayaquil (UTC-5), window 9–21: `NOON` is in.
 */
const HOUR = 3_600_000;
const NOON = new Date("2026-09-16T17:00:00.000Z");
const seeds: Seed[] = [];

afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
}, 120_000);

/** One #3 push-only campaign and ONE pending decision taken two hours before `NOON`. */
async function world(label: string) {
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
    templateKey: "missed_you",
    dormantDays: 30,
  });
  const consumer = await seedConsumer();
  const membershipId = await seedMembership({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
  });
  await seedWebPush(consumer.id);
  const decision = await seedDecision({
    campaignId,
    businessId: seed.business.id,
    consumerId: consumer.id,
    membershipId,
    decidedAt: new Date(NOON.getTime() - 2 * HOUR),
  });
  const redeem = (createdAt: Date) =>
    seedRedemption({
      businessId: seed.business.id,
      programId: seed.programId,
      membershipId,
      consumerId: consumer.id,
      userId: seed.userId,
      createdAt,
    });
  return { consumerId: consumer.id, redeem, ...decision };
}

async function work(consumerId: string) {
  const web = new FakeWebPushChannel();
  await runPushWorker({
    channel: new FakePushChannel(),
    webPushChannel: web,
    now: NOON,
    consumerIds: [consumerId],
  });
  return web;
}

describe.skipIf(!integrationEnabled || !campaignKindEnabled("missed_you"))(
  "campaign push gate — redemption",
  () => {
    it("CANCEL visited: a redemption between the decision and the delivery", async () => {
      const built = await world("Gate canje");
      await built.redeem(new Date(NOON.getTime() - HOUR));
      const web = await work(built.consumerId);
      const [row] = await readQueue([built.consumerId]);
      expect(row).toMatchObject({ status: "cancelled", lastError: "visited" });
      expect(await readPush(built.pushId)).toMatchObject({
        cancelReason: "visited",
        cancelledAt: NOON,
        sentAt: null,
      });
      expect(web.calls).toEqual([]);
    }, 120_000);

    it("SEND: a redemption BEFORE the decision is not a visit since it", async () => {
      const built = await world("Gate canje previo");
      await built.redeem(new Date(NOON.getTime() - 3 * HOUR));
      const web = await work(built.consumerId);
      expect(await readPush(built.pushId)).toMatchObject({
        sentAt: NOON,
        cancelledAt: null,
      });
      expect(web.calls).toHaveLength(1);
    }, 120_000);
  },
);
