import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  dropBusiness,
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import { seedLocationsBusiness } from "./locations-integration-support";
import {
  seedMembership,
  seedWalletPass,
} from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";
import { getDb } from "@mi-pasaporte/db";
import { campaignTurns } from "@mi-pasaporte/db/schema";
import { runMarketingTick } from "./marketing/tick";
import { enableTemplate } from "./marketing/template-store";
import type { TemplateKey } from "@mi-pasaporte/domain/server/marketing/templates";

/**
 * SOLAPAMIENTO (spec 0101 / ADR 0092 §6): two live campaigns of one business want the
 * same consumer, and the one with the HIGHEST `dormant_days` keeps them. A consumer 100
 * days away is inside «Te extrañamos» (30) AND «Recuperar perdidos» (90); the turn has
 * to be of `win_back`.
 *
 * Run in BOTH creation orders on purpose: without an `order by` in `loadActiveCampaigns`
 * the winner is whatever the heap returns, which usually follows insertion — so one of
 * the two orders would pass by luck. Only the pair pins the rule.
 */

const DAY = 86_400_000;
const NS = "marketing_overlap_test_tick";
const businesses: string[] = [];

afterAll(async () => {
  for (const id of businesses.splice(0)) {
    await dropCampaigns(id);
    await dropBusiness(id);
  }
}, 120_000);

async function overlap(order: readonly TemplateKey[]) {
  const live = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  // `plus` with a live subscription: `enable` goes through the campaign plan gate.
  const seed = await seedLocationsBusiness(`Overlap ${live}`, "plus", {
    interval: "month",
    stripeCustomerId: `cus_ov${live}`,
    stripeSubscriptionId: `sub_ov${live}`,
  });
  businesses.push(seed.business.id);
  const ids: Partial<Record<TemplateKey, string>> = {};
  for (const key of order)
    ids[key] = (
      await enableTemplate(seed.business.id, seed.userId, key, {})
    ).id;

  // The tick runs a minute after `enable` (whose `startsAt` is the real now), and the
  // consumer enrolled 100 days before it, with a pass and the business's single door.
  const now = new Date(Date.now() + 60_000);
  const consumer = await seedConsumer();
  await seedMembership({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
    enrolledAt: new Date(now.getTime() - 100 * DAY),
  });
  await seedWalletPass(consumer.id);

  const summary = await runMarketingTick({
    now,
    random: () => 1,
    lockNamespace: NS,
    businessIds: [seed.business.id],
    consumerIds: [consumer.id],
  });
  expect(summary).toMatchObject({ campaigns: 2, enqueued: 1 });

  const turns = await getDb()
    .select({ campaignId: campaignTurns.campaignId })
    .from(campaignTurns)
    .where(
      and(
        eq(campaignTurns.businessId, seed.business.id),
        inArray(campaignTurns.status, ["queued", "active"]),
      ),
    );
  return { turns, ids };
}

describe.skipIf(!integrationEnabled)(
  "marketing tick — overlapping campaigns",
  () => {
    it("missed_you created FIRST, win_back second: the turn is win_back's", async () => {
      const { turns, ids } = await overlap(["missed_you", "win_back"]);
      expect(turns).toEqual([{ campaignId: ids.win_back }]);
    }, 180_000);

    it("win_back created FIRST, missed_you second: the turn is still win_back's", async () => {
      const { turns, ids } = await overlap(["win_back", "missed_you"]);
      expect(turns).toEqual([{ campaignId: ids.win_back }]);
    }, 180_000);
  },
);
