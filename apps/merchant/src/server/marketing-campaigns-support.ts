import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { type Seed, dropBusiness } from "./counter-integration-support";
import { seedLocationsBusiness } from "./locations-integration-support";
import { getDb } from "./db";
import { campaigns } from "./schema";
import { CampaignError } from "./marketing/campaign-store";

/**
 * Shared fixtures of the phase-B suites (spec 0065). They are two files only because of
 * the size budget: one covers creating/scoping/editing, the other the four transitions
 * and the `activate` guards.
 */

export const campaignWorlds: string[] = [];

/**
 * A business with its plan AND —when it is `plus`— a LIVE subscription.
 *
 * The live id is not decoration (spec 0065 phase D): the campaign plan gate is
 * `plan === 'plus'` AND `hasLiveSubscription`, so a `plus` row with a null
 * `stripe_subscription_id` (the A1 shape of spec 0063) is refused with 402. Seeding it
 * random keeps the two unique indexes of `core.subscription` happy across parallel worlds.
 */
export async function campaignWorld(
  plan: "free" | "plus",
  label: string,
): Promise<Seed> {
  const live = randomUUID().slice(0, 8);
  const seed = await seedLocationsBusiness(
    `${label} ${Date.now()}`,
    plan,
    plan === "plus"
      ? {
          interval: "month",
          stripeCustomerId: `cus_${live}`,
          stripeSubscriptionId: `sub_${live}`,
        }
      : {},
  );
  campaignWorlds.push(seed.business.id);
  return seed;
}

/**
 * Deletes the campaigns of each seeded business and then the business itself.
 *
 * `core.campaign_location` is NOT deleted here on purpose: its fk to `campaign` is
 * `on delete cascade`, so the rows go with the campaign. A first version of this teardown
 * «helped» the cascade with `delete ... where campaignId = campaignId`, and `.toSQL()`
 * showed what that really is — `where "campaign_id" = "campaign_id"`, a tautology that
 * wipes the doors of EVERY business in the database on every run. It broke nothing only
 * because no other suite happened to be reading those rows at the time.
 */
export async function dropCampaignWorlds(): Promise<void> {
  for (const businessId of campaignWorlds.splice(0)) {
    await getDb().delete(campaigns).where(eq(campaigns.businessId, businessId));
    await dropBusiness(businessId);
  }
}

export function campaignBody(seed: Seed, over: Record<string, unknown> = {}) {
  return {
    name: "Dormidos de septiembre",
    message: "2x1 en picadas hasta el domingo",
    dormantDays: 45,
    startsAt: "2026-10-01T12:00:00.000Z",
    locationIds: [seed.locationId],
    ...over,
  };
}

/** Asserts on the ERROR, not on a truthy/falsy result: a helper that swallowed a
 * different exception would make every «409» assertion below pass for free. */
export async function caughtCampaignError(
  work: () => Promise<unknown>,
): Promise<CampaignError> {
  try {
    await work();
  } catch (error) {
    if (error instanceof CampaignError) return error;
    throw error;
  }
  throw new Error("esperaba un CampaignError y no hubo ninguno");
}
