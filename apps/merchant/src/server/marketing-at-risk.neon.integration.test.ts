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
  campaignWorld,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";
import {
  seedMembership,
  seedOrder,
  seedWalletPass,
} from "./marketing-integration-support";
import {
  readPushes,
  seedPushCampaign,
  seedWebPush,
} from "./marketing-push-support";
import { dropCampaigns } from "./marketing-read-support";
import { getDb } from "@mi-pasaporte/db";
import {
  campaignLocations,
  campaignTurns,
  campaigns,
} from "@mi-pasaporte/db/schema";
import { enableTemplate } from "./marketing/template-store";
import type { TemplateKey } from "./marketing/templates";
import { type TickSummary, runMarketingTick } from "./marketing/tick";

/**
 * #4 «Cliente en riesgo» against a real database (spec 0105 / ADR 0097), on BOTH paths of
 * the tick. Every state is READ BY SQL. The business lives in America/Guayaquil (UTC-5):
 * `NOW` is 09:00 local, and every order below is placed at a LOCAL hour on purpose — the
 * visits are distinct days in the business's timezone, not UTC days.
 */
const NS = "marketing_at_risk_tick";
const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = new Date("2026-09-16T14:00:00.000Z");
const ago = (days: number, hours = 0) =>
  new Date(NOW.getTime() - days * DAY + hours * HOUR);
const seeds: Seed[] = [];
const people: string[] = [];

afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
  await dropCampaignWorlds();
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

/** A template campaign on its channel(s); with proximity it gets the business's door. */
async function campaign(
  seed: Seed,
  templateKey: TemplateKey,
  dormantDays: number,
  channel: "proximity" | "push" | "both",
): Promise<string> {
  const id = await seedPushCampaign({
    businessId: seed.business.id,
    userId: seed.userId,
    templateKey,
    dormantDays,
    proximity: channel !== "push",
    push: channel !== "proximity",
  });
  if (channel !== "push")
    await getDb()
      .insert(campaignLocations)
      .values({ campaignId: id, locationId: seed.locationId });
  return id;
}

/** A consumer reachable on both channels with one order at each instant. */
async function customer(seed: Seed, orders: Date[]): Promise<string> {
  const consumer = await seedConsumer();
  people.push(consumer.id);
  const membershipId = await seedMembership({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
    enrolledAt: new Date(orders[0].getTime() - DAY),
  });
  await seedWalletPass(consumer.id);
  await seedWebPush(consumer.id);
  for (const createdAt of orders)
    await seedOrder({
      businessId: seed.business.id,
      locationId: seed.locationId,
      programId: seed.programId,
      membershipId,
      consumerId: consumer.id,
      userId: seed.userId,
      createdAt,
    });
  return consumer.id;
}

function tick(seed: Seed, now: Date = NOW) {
  return runMarketingTick({
    now,
    random: () => 1,
    lockNamespace: NS,
    businessIds: [seed.business.id],
    consumerIds: people,
  }) as Promise<TickSummary>;
}

async function turnsOf(seed: Seed) {
  return await getDb()
    .select({
      campaignId: campaignTurns.campaignId,
      consumerId: campaignTurns.consumerId,
    })
    .from(campaignTurns)
    .where(eq(campaignTurns.businessId, seed.business.id));
}

async function pushesOf(seed: Seed) {
  return (await readPushes(seed.business.id)).map((push) => ({
    campaignId: push.campaignId,
    consumerId: push.consumerId,
  }));
}

/** The three shapes every wiring case seeds. */
async function threeCustomers(seed: Seed) {
  // Every 30 days, away 20: dormant for the 14-day floor, but 20 ≤ 2 × 30.
  const steady = await customer(seed, [ago(80), ago(50), ago(20)]);
  // Every 5 days, away 35 > 2 × 5: the habitual who broke their rhythm.
  const broke = await customer(seed, [ago(45), ago(40), ago(35)]);
  // One visit 60 days ago: dormant, but not a habit.
  await customer(seed, [ago(60)]);
  return { steady, broke };
}

describe.skipIf(!integrationEnabled)("marketing tick — #4 at risk", () => {
  // ORACULO DE M4: without the rule in `runCampaign`, the steady one is queued too.
  it("proximity: queues ONLY the habitual who broke their rhythm; a second tick adds nothing", async () => {
    const seed = await business("At risk turn");
    const id = await campaign(seed, "at_risk", 14, "proximity");
    const { broke } = await threeCustomers(seed);

    expect(await tick(seed)).toMatchObject({ campaigns: 1, enqueued: 1 });
    expect(await turnsOf(seed)).toEqual([
      { campaignId: id, consumerId: broke },
    ]);
    expect(await tick(seed)).toMatchObject({ enqueued: 0 });
    expect(await turnsOf(seed)).toHaveLength(1);
  }, 120_000);

  // ORACULO DE M5: without the rule in `runPushCampaign`, the steady one is pushed too.
  it("push: decides ONLY for the habitual who broke their rhythm; a second tick adds nothing", async () => {
    const seed = await business("At risk push");
    const id = await campaign(seed, "at_risk", 14, "push");
    const { broke } = await threeCustomers(seed);

    expect(await tick(seed)).toMatchObject({ pushDecided: 1, enqueued: 0 });
    expect(await pushesOf(seed)).toEqual([
      { campaignId: id, consumerId: broke },
    ]);
    expect(await tick(seed)).toMatchObject({ pushDecided: 0 });
    expect(await pushesOf(seed)).toHaveLength(1);
  }, 120_000);

  // ORACULO DE M3, on BOTH loaders (the campaign runs on both channels): two orders the
  // same LOCAL day are ONE visit. They straddle UTC midnight (18:30 and 20:30 local =
  // 23:30Z and 01:30Z), so counting rows — or UTC days — makes 3 visits (rhythm ~9.8 d,
  // away 21 > 2×) and decides.
  it("visits are distinct days in the business's timezone, not orders", async () => {
    const seed = await business("At risk days");
    const id = await campaign(seed, "at_risk", 14, "both");
    await customer(seed, [ago(41, 9.5), ago(41, 11.5), ago(21)]);
    // Control: the same schedule with the second visit on the NEXT day is 3 visits.
    const three = await customer(seed, [ago(41), ago(40), ago(21)]);

    await tick(seed);
    expect(await turnsOf(seed)).toEqual([
      { campaignId: id, consumerId: three },
    ]);
    expect(await pushesOf(seed)).toEqual([
      { campaignId: id, consumerId: three },
    ]);
  }, 120_000);

  // ORACULO DE M6: #5 must still reach a customer already pushed with #4.
  it("ladder: after #4's push, #3 does not decide and #5 does (same absence)", async () => {
    const seed = await business("At risk ladder");
    const missedYou = await campaign(seed, "missed_you", 30, "push");
    const atRisk = await campaign(seed, "at_risk", 14, "push");
    const winBack = await campaign(seed, "win_back", 60, "push");
    const broke = await customer(seed, [ago(45), ago(40), ago(35)]);

    // Away 35: #3 (30) and #4 (14) both want them; #4 ranks higher and blocks #3.
    await tick(seed);
    expect(await pushesOf(seed)).toEqual([
      { campaignId: atRisk, consumerId: broke },
    ]);
    // Away 65: #5 (60) escalates; #4 and #3 stay out.
    await tick(seed, new Date(NOW.getTime() + 30 * DAY));
    const pushes = await pushesOf(seed);
    expect(pushes).toEqual([
      { campaignId: atRisk, consumerId: broke },
      { campaignId: winBack, consumerId: broke },
    ]);
    expect(pushes.map((push) => push.campaignId)).not.toContain(missedYou);
  }, 120_000);

  // ORACULO DE M7: by days alone, #3 at 30 would take the turn of #4 at 14.
  it("proximity order: with #3 (30 d) and #4 (14 d) live, the habitual at risk gets #4's turn", async () => {
    const seed = await business("At risk order");
    await campaign(seed, "missed_you", 30, "proximity");
    const atRisk = await campaign(seed, "at_risk", 14, "proximity");
    const broke = await customer(seed, [ago(45), ago(40), ago(35)]);

    expect(await tick(seed)).toMatchObject({ campaigns: 2, enqueued: 1 });
    expect(await turnsOf(seed)).toEqual([
      { campaignId: atRisk, consumerId: broke },
    ]);
  }, 120_000);

  it("enable {} creates #4 on both channels at 14 days; 7 days is a 400", async () => {
    const seed = await campaignWorld("plus", "At risk enable");
    expect(
      await caught(() =>
        enableTemplate(seed.business.id, seed.userId, "at_risk", {
          dormantDays: 7,
        }),
      ),
    ).toMatchObject({
      status: 400,
      code: "validation",
      fields: { dormantDays: expect.any(String) },
    });

    const created = await enableTemplate(
      seed.business.id,
      seed.userId,
      "at_risk",
      {},
    );
    const [row] = await getDb()
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, created.id));
    expect(row).toMatchObject({
      templateKey: "at_risk",
      name: "Cliente en riesgo",
      status: "active",
      channelProximity: true,
      channelPush: true,
      dormantDays: 14,
      message: "Hace unos días que no te vemos. ¡Te esperamos!",
      couponLabel: null,
    });
  }, 120_000);
});
