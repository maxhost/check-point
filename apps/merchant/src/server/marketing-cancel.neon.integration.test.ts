import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import {
  NEAR,
  breakLocation,
  optOut,
  seedCampaign,
  seedLocation,
  seedMembership,
  seedTurn,
  seedWalletPass,
  setCampaignState,
} from "./marketing-integration-support";
import { dropCampaigns, readTurns } from "./marketing-read-support";
import { runMarketingTick, type TickSummary } from "./marketing/tick";
import { getDb } from "./db";
import { programMemberships } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Step 3 (spec 0065): every world that retires a live turn, and the reason each one
 * writes. The turns are SEEDED instead of produced by a previous run — the reason under
 * test is the cancel, not the audience, and seeding is what lets six different worlds
 * share one business (the partial unique allows one live turn per consumer, so one
 * consumer per reason is enough).
 */

/** Own advisory namespace: the suites share one database and a single key would
 * make them answer `tick_in_flight` to each other. The skip itself is asserted with the
 * production default, in `marketing-placement`. */
const NS = "marketing_tick_test_cancel";

const DAY = 86_400_000;
const NOW = new Date("2026-09-16T12:00:00.000Z");

type Case = {
  name: string;
  consumerId: string;
  membershipId: string;
  campaignId: string;
  turnId: string;
  locationId: string;
};

describe.skipIf(!integrationEnabled)("marketing cancel", () => {
  let seed: Seed;
  const cases: Record<string, Case> = {};

  async function scenario(
    name: string,
    doorId: string,
    campaignOpts: Parameters<typeof seedCampaign>[0] extends never
      ? never
      : Partial<{
          status: "draft" | "active" | "paused" | "ended" | "archived";
          pauseReason:
            | "owner"
            | "plan_downgraded"
            | "no_active_locations"
            | null;
        }> = {},
  ): Promise<Case> {
    const consumer = await seedConsumer();
    const membershipId = await seedMembership({
      consumerId: consumer.id,
      programId: seed.programId,
      businessId: seed.business.id,
      enrolledAt: new Date(NOW.getTime() - 400 * DAY),
    });
    await seedWalletPass(consumer.id);
    const campaignId = await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [doorId],
      name: name.slice(0, 80),
      ...campaignOpts,
    });
    const turnId = await seedTurn({
      campaignId,
      businessId: seed.business.id,
      consumerId: consumer.id,
      membershipId,
      locationId: doorId,
      status: "active",
      windowStart: new Date(NOW.getTime() - DAY),
      windowEnd: new Date(NOW.getTime() + 4 * DAY),
      messageSnapshot: "2x1 en picadas",
    });
    const built = {
      name,
      consumerId: consumer.id,
      membershipId,
      campaignId,
      turnId,
      locationId: doorId,
    };
    cases[name] = built;
    return built;
  }

  beforeAll(async () => {
    seed = await seedBusiness({
      name: `Marketing cancel ${Date.now()}`,
      kind: "stamps",
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    const shared = await seedLocation({
      businessId: seed.business.id,
      ...NEAR,
    });
    const toArchive = await seedLocation({
      businessId: seed.business.id,
      ...NEAR,
    });
    const toUngeocode = await seedLocation({
      businessId: seed.business.id,
      ...NEAR,
    });
    await scenario("campaign_paused", shared, {
      status: "paused",
      pauseReason: "owner",
    });
    await scenario("campaign_ended", shared, { status: "ended" });
    await scenario("plan_downgraded", shared, {
      status: "paused",
      pauseReason: "plan_downgraded",
    });
    const optedOut = await scenario("opt_out", shared);
    await optOut(optedOut.membershipId, new Date(NOW.getTime() - DAY));
    const archived = await scenario("location_archived", toArchive);
    await breakLocation(archived.locationId, "archive");
    const ungeocoded = await scenario(
      "location_without_coordinates",
      toUngeocode,
    );
    await breakLocation(ungeocoded.locationId, "ungeocode");

    await runMarketingTick({
      now: NOW,
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: Object.values(cases).map((row) => row.consumerId),
    });
  }, 180_000);

  afterAll(async () => {
    if (!integrationEnabled) return;
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }, 120_000);

  it("retires every live turn with ITS reason", async () => {
    const turns = await readTurns(seed.business.id);
    const byId = new Map(turns.map((turn) => [turn.id, turn]));
    for (const [reason, built] of Object.entries(cases)) {
      const turn = byId.get(built.turnId);
      expect([reason, turn?.status]).toEqual([reason, "cancelled"]);
      expect([reason, turn?.cancelReason]).toEqual([reason, reason]);
    }
  });

  it("cannot reach `membership_gone`: the fk forbids the state it describes", async () => {
    // DECLARED LIMIT, measured instead of assumed (`CLAUDE.md`): the sixth value of
    // `cancel_reason` has no reachable path today, because `campaign_turn.membership_id`
    // is `not null` with a NO ACTION fk. Making it reachable is a migration, not a fix
    // in this phase — and a spec item silently dropped is worse than a declared one.
    const built = cases.opt_out;
    const error = await getDb()
      .delete(programMemberships)
      .where(eq(programMemberships.id, built.membershipId))
      .then(() => null)
      .catch(
        (thrown: { cause?: { code?: string; constraint?: string } }) => thrown,
      );
    // Drizzle wraps the driver error, so the SQLSTATE lives in `cause` — reading
    // `error.code` finds `undefined` and the test would pass for the wrong reason.
    expect(error?.cause?.code).toBe("23503");
    expect(error?.cause?.constraint).toBe(
      "campaign_turn_membership_id_program_membership_id_fk",
    );
  });
});

describe.skipIf(!integrationEnabled)(
  "pausing does not burn the audience",
  () => {
    let seed: Seed;
    let campaignId: string;
    let consumerId: string;

    beforeAll(async () => {
      seed = await seedBusiness({
        name: `Marketing resume ${Date.now()}`,
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      const doorId = await seedLocation({
        businessId: seed.business.id,
        ...NEAR,
      });
      campaignId = await seedCampaign({
        businessId: seed.business.id,
        createdByUserId: seed.userId,
        locationIds: [doorId],
      });
      const consumer = await seedConsumer();
      consumerId = consumer.id;
      await seedMembership({
        consumerId,
        programId: seed.programId,
        businessId: seed.business.id,
        enrolledAt: new Date(NOW.getTime() - 400 * DAY),
      });
      await seedWalletPass(consumerId);
    }, 120_000);

    afterAll(async () => {
      if (!integrationEnabled) return;
      await dropCampaigns(seed.business.id);
      await dropBusiness(seed.business.id);
    }, 120_000);

    it("re-places after a pause: a cancelled turn does not spend the cooldown", async () => {
      const run = (now: Date) =>
        runMarketingTick({
          now,
          random: () => 1,
          lockNamespace: NS,
          businessIds: [seed.business.id],
          consumerIds: [consumerId],
        }) as Promise<TickSummary>;

      expect(await run(NOW)).toMatchObject({ enqueued: 1, activated: 1 });
      await setCampaignState(campaignId, "paused", "owner");
      expect(await run(new Date(NOW.getTime() + 60_000))).toMatchObject({
        cancelled: 1,
      });
      const cancelled = await readTurns(seed.business.id);
      expect(cancelled[0]).toMatchObject({
        status: "cancelled",
        cancelReason: "campaign_paused",
      });
      // The cancelled turn keeps a `window_end` INSIDE the 30-day cooldown: if the
      // cooldown query did not filter `status in ('active','done')`, correcting a typo
      // would lock the whole audience out for a month.
      expect(cancelled[0].windowEnd!.getTime()).toBeGreaterThan(
        NOW.getTime() - 30 * DAY,
      );
      await setCampaignState(campaignId, "active", null);
      expect(await run(new Date(NOW.getTime() + 120_000))).toMatchObject({
        enqueued: 1,
        activated: 1,
      });
      const after = await readTurns(seed.business.id);
      expect(after.filter((turn) => turn.status === "active")).toHaveLength(1);
      expect(randomUUID().length).toBeGreaterThan(0);
    }, 180_000);
  },
);
