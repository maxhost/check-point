import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import {
  optOut,
  seedMembership,
  seedOrder,
  setCampaignState,
} from "./marketing-integration-support";
import {
  readPush,
  readQueue,
  seedDecision,
  seedPushCampaign,
  seedWebPush,
} from "./marketing-push-support";
import { dropCampaigns, readAccount } from "./marketing-read-support";
import { getDb } from "./db";
import { campaignCoupons } from "./schema";
import { recordPushClick } from "./marketing/push-delivery";
import { FakePushChannel } from "./wallet/push-channel";
import { runPushWorker } from "./wallet/push-worker";
import { FakeWebPushChannel } from "./push/webpush-channel";

/**
 * The worker's side of a campaign push (spec 0103 §6-§9) against a real database, through
 * the REAL `runPushWorker` with fake transports. The consumers only have Web Push, so the
 * notice goes by Web Push (transport = transactional) and the click id is observable in
 * the payload. Business zone: America/Guayaquil (UTC-5), window 9–21.
 */
const HOUR = 3_600_000;
const NOON = new Date("2026-09-16T17:00:00.000Z"); // 12:00 local — inside
const NIGHT = new Date("2026-09-17T03:00:00.000Z"); // 22:00 local — outside
const NEXT_NINE = new Date("2026-09-17T14:00:00.000Z");
const ENDS = new Date("2026-12-31T00:00:00.000Z");
const seeds: Seed[] = [];

afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
}, 120_000);

/** One business, one push campaign with a coupon, one dormant consumer reachable only
 * by Web Push, and ONE pending decision taken two hours before `NOON`. */
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

async function work(built: { consumerId: string }, now: Date) {
  const web = new FakeWebPushChannel();
  await runPushWorker({
    channel: new FakePushChannel(),
    webPushChannel: web,
    now,
    consumerIds: [built.consumerId],
  });
  return web;
}

const coupons = (consumerId: string) =>
  getDb()
    .select()
    .from(campaignCoupons)
    .where(eq(campaignCoupons.consumerId, consumerId));

describe.skipIf(!integrationEnabled)("campaign push delivery", () => {
  it("SEND: Web Push with the click id, `sent_at`, «Última novedad» and ONE coupon", async () => {
    const built = await world("Push send");
    const web = await work(built, NOON);

    const [row] = await readQueue([built.consumerId]);
    expect(row).toMatchObject({ status: "sent", sentAt: NOON });
    expect(await readPush(built.pushId)).toMatchObject({
      sentAt: NOON,
      cancelledAt: null,
    });
    expect(web.calls).toEqual([
      {
        endpoint: built.endpoint,
        payload: {
          title: "La Gringa",
          body: "¡Volvé! · 2x1 en picadas",
          url: "/wallet",
          clickId: built.pushId,
        },
      },
    ]);
    expect((await readAccount(built.consumerId)).latestMessage).toBe(
      "La Gringa: ¡Volvé! · 2x1 en picadas",
    );
    expect(await coupons(built.consumerId)).toEqual([
      expect.objectContaining({
        campaignId: built.campaignId,
        pushId: built.pushId,
        turnId: null,
        labelSnapshot: "2x1 en picadas",
        costSnapshot: "2.50",
        validFrom: NOON,
        validUntil: ENDS,
      }),
    ]);

    // The click: first one wins, an unknown id is a no-op.
    await recordPushClick(built.pushId);
    const first = (await readPush(built.pushId)).clickedAt;
    expect(first).toBeInstanceOf(Date);
    await recordPushClick(built.pushId);
    expect((await readPush(built.pushId)).clickedAt).toEqual(first);
    await recordPushClick("99999999-9999-4999-8999-999999999999");
  }, 120_000);

  it("an unredeemed coupon of the campaign already held: the push goes, a second coupon does not", async () => {
    const built = await world("Push second coupon");
    await getDb()
      .insert(campaignCoupons)
      .values({
        campaignId: built.campaignId,
        businessId: built.seed.business.id,
        consumerId: built.consumerId,
        membershipId: built.membershipId,
        labelSnapshot: "2x1 en picadas",
        costSnapshot: "2.50",
        validFrom: new Date(NOON.getTime() - 24 * HOUR),
        validUntil: ENDS,
      });
    await work(built, NOON);
    expect((await readPush(built.pushId)).sentAt).toEqual(NOON);
    expect(await coupons(built.consumerId)).toHaveLength(1);
  }, 120_000);

  it("CANCEL visited: a purchase between the decision and the delivery", async () => {
    const built = await world("Push visited");
    await seedOrder({
      businessId: built.seed.business.id,
      locationId: built.seed.locationId,
      programId: built.seed.programId,
      membershipId: built.membershipId,
      consumerId: built.consumerId,
      userId: built.seed.userId,
      createdAt: new Date(NOON.getTime() - HOUR),
    });
    const web = await work(built, NOON);
    await expectCancelled(built, web, "visited");
  }, 120_000);

  it("CANCEL campaign_inactive: the campaign was paused after the decision", async () => {
    const built = await world("Push paused");
    await setCampaignState(built.campaignId, "paused", "owner");
    await expectCancelled(built, await work(built, NOON), "campaign_inactive");
  }, 120_000);

  it("CANCEL opt_out: the consumer turned promotions off", async () => {
    const built = await world("Push opt-out");
    await optOut(built.membershipId, new Date(NOON.getTime() - HOUR));
    await expectCancelled(built, await work(built, NOON), "opt_out");
  }, 120_000);

  it("RESCHEDULE outside the window: back to pending at the next 09:00 local, nothing sent", async () => {
    const built = await world("Push night");
    const web = await work(built, NIGHT);
    const [row] = await readQueue([built.consumerId]);
    expect(row).toMatchObject({ status: "pending", notBefore: NEXT_NINE });
    expect(await readPush(built.pushId)).toMatchObject({
      sentAt: null,
      cancelledAt: null,
    });
    expect(web.calls).toEqual([]);
    expect((await readAccount(built.consumerId)).latestMessage).toBeNull();
  }, 120_000);

  it("SEND despite ANOTHER consumer's unredeemed coupon and a purchase at ANOTHER business", async () => {
    const built = await world("Push not mine");
    const other = await seedConsumer();
    const otherMembership = await seedMembership({
      consumerId: other.id,
      programId: built.seed.programId,
      businessId: built.seed.business.id,
    });
    await getDb()
      .insert(campaignCoupons)
      .values({
        campaignId: built.campaignId,
        businessId: built.seed.business.id,
        consumerId: other.id,
        membershipId: otherMembership,
        labelSnapshot: "2x1 en picadas",
        costSnapshot: "2.50",
        validFrom: new Date(NOON.getTime() - 24 * HOUR),
        validUntil: ENDS,
      });
    const elsewhere = await seedBusiness({
      name: `Push elsewhere ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      kind: "stamps",
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    seeds.push(elsewhere);
    await seedOrder({
      businessId: elsewhere.business.id,
      locationId: elsewhere.locationId,
      programId: elsewhere.programId,
      membershipId: await seedMembership({
        consumerId: built.consumerId,
        programId: elsewhere.programId,
        businessId: elsewhere.business.id,
      }),
      consumerId: built.consumerId,
      userId: elsewhere.userId,
      createdAt: new Date(NOON.getTime() - HOUR),
    });
    await work(built, NOON);
    expect(await readPush(built.pushId)).toMatchObject({
      sentAt: NOON,
      cancelledAt: null,
    });
    expect(await coupons(built.consumerId)).toHaveLength(1);
  }, 120_000);
});

async function expectCancelled(
  built: { consumerId: string; pushId: string },
  web: FakeWebPushChannel,
  reason: string,
) {
  const [row] = await readQueue([built.consumerId]);
  expect(row).toMatchObject({ status: "cancelled", lastError: reason });
  expect(await readPush(built.pushId)).toMatchObject({
    cancelReason: reason,
    cancelledAt: NOON,
    sentAt: null,
  });
  expect(web.calls).toEqual([]);
  // Nothing of the consumer is touched: no «Última novedad», no cooldown clock.
  const account = await readAccount(built.consumerId);
  expect(account.latestMessage).toBeNull();
  expect(account.lastPushAt).toBeNull();
  expect(await coupons(built.consumerId)).toEqual([]);
}
