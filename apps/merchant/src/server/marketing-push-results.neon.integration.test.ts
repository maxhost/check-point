import { afterAll, describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { seedMembership, seedOrder } from "./marketing-integration-support";
import { seedDecision, seedPushCampaign } from "./marketing-push-support";
import { dropCampaigns } from "./marketing-read-support";
import { loadCampaignResults } from "./marketing/results-store";

/**
 * The `push` block of the results (spec 0103 §10) against a real database. Decisions are
 * SEEDED, not produced by the tick: this suite is about what the results READ (same
 * reasoning as `marketing-results-support.ts`). «Bought» = an order within 7 days of
 * `sent_at` (sent) or `decided_at` (holdout): day 6 counts, day 8 does not.
 */
const DAY = 86_400_000;
const NOW = new Date("2026-09-26T12:00:00.000Z");
const T0 = new Date(NOW.getTime() - 10 * DAY);
const seeds: Seed[] = [];

afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
}, 120_000);

describe.skipIf(
  !integrationEnabled ||
    !campaignKindEnabled("missed_you") ||
    !campaignKindEnabled("win_back"),
)("campaign results — push block", () => {
  it("counts every state and the 7-day conversion of sent vs holdout", async () => {
    const seed = await seedBusiness({
      name: `Push results ${Date.now()}`,
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
    });
    const proximityOnly = await seedPushCampaign({
      businessId: seed.business.id,
      userId: seed.userId,
      templateKey: "missed_you",
      dormantDays: 30,
      proximity: true,
      push: false,
    });

    const decide = async (
      over: Omit<
        Parameters<typeof seedDecision>[0],
        "campaignId" | "businessId" | "consumerId" | "membershipId"
      >,
      boughtAfterDays?: number,
    ) => {
      const consumer = await seedConsumer();
      const membershipId = await seedMembership({
        consumerId: consumer.id,
        programId: seed.programId,
        businessId: seed.business.id,
      });
      await seedDecision({
        campaignId,
        businessId: seed.business.id,
        consumerId: consumer.id,
        membershipId,
        ...over,
      });
      if (boughtAfterDays !== undefined) {
        const t0 = over.sentAt ?? over.decidedAt;
        await seedOrder({
          businessId: seed.business.id,
          locationId: seed.locationId,
          programId: seed.programId,
          membershipId,
          consumerId: consumer.id,
          userId: seed.userId,
          createdAt: new Date(t0.getTime() + boughtAfterDays * DAY),
        });
      }
    };
    // Sent 10 days ago: bought on day 6 (counts, and clicked) / day 8 (does not). The
    // first was DECIDED two days before it went out: day 6 from `sent_at` is day 8 from
    // `decided_at`, so measuring the sent group from the decision drops it.
    await decide(
      {
        decidedAt: new Date(T0.getTime() - 2 * DAY),
        sentAt: T0,
        clickedAt: T0,
      },
      6,
    );
    await decide({ decidedAt: T0, sentAt: T0 }, 8);
    // Sent 2 days ago: its 7 days are not over, it is not part of the rate.
    const recent = new Date(NOW.getTime() - 2 * DAY);
    await decide({ decidedAt: recent, sentAt: recent }, 1);
    // Holdout decided 10 days ago: day 6 / day 8, same rule from `decided_at`.
    await decide({ decidedAt: T0, holdout: true }, 6);
    await decide({ decidedAt: T0, holdout: true }, 8);
    // Pending and cancelled.
    await decide({ decidedAt: recent });
    await decide({
      decidedAt: T0,
      cancel: { at: T0, reason: "visited" },
    });

    const results = await loadCampaignResults(
      seed.business.id,
      campaignId,
      { label: null, cap: null },
      NOW,
    );
    expect(results.push).toEqual({
      quality: "observada",
      decided: 7,
      held: 2,
      pending: 1,
      sent: 3,
      cancelled: {
        campaign_inactive: 0,
        membership_gone: 0,
        opt_out: 0,
        visited: 1,
      },
      clicked: 1,
      conversion: {
        windowDays: 7,
        sent: { purchases: 1, of: 2 },
        held: { purchases: 1, of: 2 },
      },
      effect: { quality: "no_disponible", holdoutN: 2, needed: 30 },
    });

    const none = await loadCampaignResults(
      seed.business.id,
      proximityOnly,
      { label: null, cap: null },
      NOW,
    );
    expect(none.push).toBeNull();
    // Another business reading this campaign id reads nothing.
    const other = await loadCampaignResults(
      "00000000-0000-4000-8000-000000000000",
      campaignId,
      { label: null, cap: null },
      NOW,
    );
    expect(other.push).toBeNull();
  }, 180_000);
});
