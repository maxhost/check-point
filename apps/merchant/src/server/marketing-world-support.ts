import {
  type Seed,
  dropBusiness,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import {
  NEAR,
  seedCampaign,
  seedLocation,
  seedMembership,
  seedWalletPass,
} from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";
import { runMarketingTick } from "./marketing/tick";

/**
 * A WORLD for the step-4 suites (spec 0065 phase A5): one business, one usable door,
 * one active campaign and N dormant, reachable consumers. Shared by the placement and
 * the merit files, which are separate files only because of the size budget.
 *
 * Every suite passes its OWN advisory namespace: they run in parallel against one
 * database, and the tick's exclusion is global by design (see `marketing/tick.ts`).
 */

export const WORLD_DAY = 86_400_000;
export const WORLD_NOW = new Date("2026-09-16T12:00:00.000Z");

export type World = {
  seed: Seed;
  campaignId: string;
  doorId: string;
  consumerIds: string[];
};

export async function seedWorld(opts: {
  label: string;
  people: number;
}): Promise<World> {
  const seed = await seedBusiness({
    name: `${opts.label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
  });
  const doorId = await seedLocation({ businessId: seed.business.id, ...NEAR });
  const campaignId = await seedCampaign({
    businessId: seed.business.id,
    createdByUserId: seed.userId,
    locationIds: [doorId],
  });
  const consumerIds: string[] = [];
  for (let index = 0; index < opts.people; index += 1) {
    const consumer = await seedConsumer();
    await seedMembership({
      consumerId: consumer.id,
      programId: seed.programId,
      businessId: seed.business.id,
      enrolledAt: new Date(WORLD_NOW.getTime() - 400 * WORLD_DAY),
    });
    await seedWalletPass(consumer.id);
    consumerIds.push(consumer.id);
  }
  return { seed, campaignId, doorId, consumerIds };
}

export function tickWorld(
  built: World,
  lockNamespace: string,
  options: Parameters<typeof runMarketingTick>[0] = {},
) {
  return runMarketingTick({
    now: WORLD_NOW,
    random: () => 1,
    lockNamespace,
    businessIds: [built.seed.business.id],
    consumerIds: built.consumerIds,
    ...options,
  });
}

/** Marketing rows first, then the business: the fks of `campaign_turn` are NO ACTION
 * and `dropBusiness` deletes the memberships those turns point at. */
export async function dropWorlds(worlds: World[]): Promise<void> {
  for (const built of worlds.splice(0)) {
    await dropCampaigns(built.seed.business.id);
    await dropBusiness(built.seed.business.id);
  }
}
