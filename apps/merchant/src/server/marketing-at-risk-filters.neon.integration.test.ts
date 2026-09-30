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
import type { TemplateKey } from "./marketing/templates";
import { type TickSummary, runMarketingTick } from "./marketing/tick";

/**
 * The two gaps the independent review of spec 0105 found without an oracle (R1, R2),
 * against a real database, read by SQL:
 *  - R1: in proximity the custom composer goes AFTER every template, whatever its days.
 *  - R2: the rhythm is measured on THIS business's orders — an old order at another
 *    business must not stretch it.
 */
const NS = "marketing_at_risk_filters";
const DAY = 86_400_000;
const NOW = new Date("2026-09-16T14:00:00.000Z");
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
const seeds: Seed[] = [];
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

async function campaign(
  seed: Seed,
  templateKey: TemplateKey,
  dormantDays: number,
  push: boolean,
): Promise<string> {
  const id = await seedPushCampaign({
    businessId: seed.business.id,
    userId: seed.userId,
    templateKey,
    dormantDays,
    proximity: true,
    push,
  });
  await getDb()
    .insert(campaignLocations)
    .values({ campaignId: id, locationId: seed.locationId });
  return id;
}

/** Enrolled at `seed` with one order at each instant; the consumer is created if absent. */
async function ordersAt(
  seed: Seed,
  orders: Date[],
  consumerId?: string,
): Promise<string> {
  const id = consumerId ?? (await seedConsumer()).id;
  if (!consumerId) {
    people.push(id);
    await seedWalletPass(id);
    await seedWebPush(id);
  }
  const membershipId = await seedMembership({
    consumerId: id,
    programId: seed.programId,
    businessId: seed.business.id,
    enrolledAt: new Date(orders[0].getTime() - DAY),
  });
  for (const createdAt of orders)
    await seedOrder({
      businessId: seed.business.id,
      locationId: seed.locationId,
      programId: seed.programId,
      membershipId,
      consumerId: id,
      userId: seed.userId,
      createdAt,
    });
  return id;
}

function tick(seed: Seed) {
  return runMarketingTick({
    now: NOW,
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

describe.skipIf(!integrationEnabled)("marketing tick — #4 filters", () => {
  // ORACULO DE R1: by days alone —or with the composer ranked above— the custom one at
  // 90 d takes the turn of #3 at 30 d.
  it("proximity: a template beats the custom composer even with fewer days", async () => {
    const seed = await business("At risk composer");
    const custom = await campaign(seed, "missed_you", 90, false);
    // The composer writes `template_key = null` and never pushes.
    await getDb()
      .update(campaigns)
      .set({ templateKey: null })
      .where(eq(campaigns.id, custom));
    const missedYou = await campaign(seed, "missed_you", 30, false);
    const lost = await ordersAt(seed, [ago(95)]);

    expect(await tick(seed)).toMatchObject({ campaigns: 2, enqueued: 1 });
    expect(await turnsOf(seed)).toEqual([
      { campaignId: missedYou, consumerId: lost },
    ]);
  }, 120_000);

  // ORACULO DE R2, on BOTH loaders: every 5 days at A, away 35 → at risk. An order at B
  // 200 days ago, if it leaked into `first_order_at`, stretches the rhythm to 82.5 d.
  it("the rhythm reads only this business's orders", async () => {
    const seed = await business("At risk here");
    const elsewhere = await business("At risk elsewhere");
    const atRisk = await campaign(seed, "at_risk", 14, true);
    const broke = await ordersAt(seed, [ago(45), ago(40), ago(35)]);
    await ordersAt(elsewhere, [ago(200)], broke);

    await tick(seed);
    expect(await turnsOf(seed)).toEqual([
      { campaignId: atRisk, consumerId: broke },
    ]);
    expect(
      (await readPushes(seed.business.id)).map((push) => ({
        campaignId: push.campaignId,
        consumerId: push.consumerId,
      })),
    ).toEqual([{ campaignId: atRisk, consumerId: broke }]);
  }, 120_000);
});
