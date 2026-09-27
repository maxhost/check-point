import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { seedMembership, seedOrder } from "./marketing-integration-support";
import {
  readPushes,
  readQueue,
  seedDecision,
  seedGooglePass,
  seedPushCampaign,
  seedWebPush,
} from "./marketing-push-support";
import { dropCampaigns, readTurns } from "./marketing-read-support";
import { getDb } from "./db";
import { campaignLocations, campaignTickAudiences } from "./schema";
import { type TickSummary, runMarketingTick } from "./marketing/tick";

/**
 * Step «1b push» of the tick against a real database (spec 0103 §4). Every state is read
 * BY SQL. The business seeds live in America/Guayaquil (UTC-5) with the default 9–21
 * window, so `NOW` (07:00 local) is OUTSIDE it: a decided push waits until 09:00 local.
 */
const NS = "marketing_push_tick";
const DAY = 86_400_000;
const NOW = new Date("2026-09-16T12:00:00.000Z");
const NINE_LOCAL = new Date("2026-09-16T14:00:00.000Z");
const LONG_AGO = new Date(NOW.getTime() - 400 * DAY);
const seeds: Seed[] = [];
/** Every consumer this file seeded: step 4 of the tick is scoped to them, so a run here
 * never places or refreshes another suite's consumers on the shared branch. */
const people: string[] = [];

afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
}, 120_000);

async function business(label: string): Promise<Seed> {
  const seed = await seedBusiness({
    name: `${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
  });
  seeds.push(seed);
  return seed;
}

async function person(
  seed: Seed,
  opts: { enrolledAt?: Date; optedOutAt?: Date | null } = {},
) {
  const consumer = await seedConsumer();
  people.push(consumer.id);
  const membershipId = await seedMembership({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
    enrolledAt: opts.enrolledAt ?? LONG_AGO,
    optedOutAt: opts.optedOutAt ?? null,
  });
  return { consumerId: consumer.id, membershipId };
}

function tick(seed: Seed, random: () => number = () => 1) {
  return runMarketingTick({
    now: NOW,
    random,
    lockNamespace: NS,
    businessIds: [seed.business.id],
    consumerIds: people,
  }) as Promise<TickSummary>;
}

describe.skipIf(!integrationEnabled)("marketing tick — push channel", () => {
  it("decides ONE push per eligible consumer; the holdout has no queue row; no turns", async () => {
    const seed = await business("Push decide");
    const campaignId = await seedPushCampaign({
      businessId: seed.business.id,
      userId: seed.userId,
      templateKey: "missed_you",
      dormantDays: 30,
      message: "Hace rato no te vemos",
    });
    // Doors attached on purpose: a push-only run must STILL queue no turn with them.
    await getDb()
      .insert(campaignLocations)
      .values({ campaignId, locationId: seed.locationId });
    const web = await person(seed);
    await seedWebPush(web.consumerId);
    const google = await person(seed);
    await seedGooglePass(google.consumerId);
    const unreachable = await person(seed);
    const optedOut = await person(seed, { optedOutAt: NOW });
    await seedWebPush(optedOut.consumerId);
    const fresh = await person(seed, {
      enrolledAt: new Date(NOW.getTime() - 5 * DAY),
    });
    await seedWebPush(fresh.consumerId);

    const draws = [0.05, 0.9];
    const summary = await tick(seed, () => draws.shift() ?? 1);
    expect(summary).toMatchObject({ pushDecided: 2, pushHeld: 1, enqueued: 0 });

    const pushes = await readPushes(seed.business.id);
    expect(pushes.map((p) => p.consumerId).sort()).toEqual(
      [web.consumerId, google.consumerId].sort(),
    );
    const held = pushes.filter((p) => p.holdout);
    const sent = pushes.filter((p) => !p.holdout);
    expect(held).toHaveLength(1);
    expect(held[0].queueId).toBeNull();
    // THE HOLDOUT HAS NO QUEUE ROW AT ALL — not merely a null pointer.
    expect(await readQueue([held[0].consumerId])).toEqual([]);
    expect(sent).toHaveLength(1);
    const queue = await readQueue([sent[0].consumerId]);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id: sent[0].queueId,
      class: "campaign",
      status: "pending",
      body: "Hace rato no te vemos",
      notBefore: NINE_LOCAL,
    });
    expect(queue[0].title).toContain("Push decide");
    expect(sent[0]).toMatchObject({ decidedAt: NOW, sentAt: null });
    expect(
      await readQueue([
        unreachable.consumerId,
        optedOut.consumerId,
        fresh.consumerId,
      ]),
    ).toEqual([]);

    // Push-only: no turn and no audience photo (those are proximity's).
    expect(await readTurns(seed.business.id)).toEqual([]);
    expect(
      await getDb()
        .select()
        .from(campaignTickAudiences)
        .where(eq(campaignTickAudiences.campaignId, campaignId)),
    ).toEqual([]);

    // Idempotent: the same clock decides nothing new.
    expect(await tick(seed)).toMatchObject({ pushDecided: 0, pushHeld: 0 });
    expect(await readPushes(seed.business.id)).toEqual(pushes);
  }, 180_000);

  it("a proximity-only template decides no push", async () => {
    const seed = await business("Push proximity only");
    await seedPushCampaign({
      businessId: seed.business.id,
      userId: seed.userId,
      templateKey: "win_back",
      dormantDays: 60,
      proximity: true,
      push: false,
    });
    const web = await person(seed);
    await seedWebPush(web.consumerId);
    expect(await tick(seed)).toMatchObject({ pushDecided: 0 });
    expect(await readPushes(seed.business.id)).toEqual([]);
  }, 120_000);

  it("groups: #5 blocks #3, #3 does not block #5, a new visit reopens, holdout blocks, cancelled does not", async () => {
    const seed = await business("Push groups");
    const missedYou = await seedPushCampaign({
      businessId: seed.business.id,
      userId: seed.userId,
      templateKey: "missed_you",
      dormantDays: 30,
    });
    const winBack = await seedPushCampaign({
      businessId: seed.business.id,
      userId: seed.userId,
      templateKey: "win_back",
      dormantDays: 60,
    });
    const reachable = async () => {
      const row = await person(seed);
      await seedWebPush(row.consumerId);
      return row;
    };
    const decided = (who: { consumerId: string; membershipId: string }) => ({
      businessId: seed.business.id,
      consumerId: who.consumerId,
      membershipId: who.membershipId,
    });
    // Nothing yet: #5 decides first (higher rank) and then #3 must stay out.
    const fresh = await reachable();
    // Already has a #3 since the visit: #5 still escalates.
    const hadThree = await reachable();
    await seedDecision({
      ...decided(hadThree),
      campaignId: missedYou,
      decidedAt: new Date(NOW.getTime() - DAY),
      sentAt: new Date(NOW.getTime() - DAY),
    });
    // A #5 BEFORE their last visit: that absence is over, this one is new.
    const cameBack = await reachable();
    await seedDecision({
      ...decided(cameBack),
      campaignId: winBack,
      decidedAt: new Date(NOW.getTime() - 200 * DAY),
      sentAt: new Date(NOW.getTime() - 200 * DAY),
    });
    await seedOrder({
      ...decided(cameBack),
      locationId: seed.locationId,
      programId: seed.programId,
      userId: seed.userId,
      createdAt: new Date(NOW.getTime() - 100 * DAY),
    });
    // A #5 HOLDOUT since the visit: the control group is not re-drawn.
    const heldFive = await reachable();
    await seedDecision({
      ...decided(heldFive),
      campaignId: winBack,
      decidedAt: new Date(NOW.getTime() - 10 * DAY),
      holdout: true,
    });
    // A #5 CANCELLED since the visit: it never went out, so it blocks nothing.
    const cancelledFive = await reachable();
    await seedDecision({
      ...decided(cancelledFive),
      campaignId: winBack,
      decidedAt: new Date(NOW.getTime() - 10 * DAY),
      cancel: {
        at: new Date(NOW.getTime() - 9 * DAY),
        reason: "campaign_inactive",
      },
    });

    await tick(seed);
    const today = (await readPushes(seed.business.id)).filter(
      (p) => p.decidedAt.getTime() === NOW.getTime(),
    );
    const got = (campaignId: string) =>
      today
        .filter((p) => p.campaignId === campaignId)
        .map((p) => p.consumerId)
        .sort();
    // `soft`: the two directions of the scale are separate properties, and a mutation
    // that inverts it must be seen failing BOTH, not just the first one.
    expect
      .soft(got(winBack))
      .toEqual(
        [
          fresh.consumerId,
          hadThree.consumerId,
          cameBack.consumerId,
          cancelledFive.consumerId,
        ].sort(),
      );
    // #5 blocks #3 for everybody who got (or held) a #5 in this absence — and #3's own
    // earlier push blocks the #3 of `hadThree`.
    expect.soft(got(missedYou)).toEqual([]);
  }, 180_000);
});
