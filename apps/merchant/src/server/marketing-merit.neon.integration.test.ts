import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import { seedWalletPass } from "./marketing-integration-support";
import {
  FAR,
  seedLocation,
  seedMembership,
} from "./marketing-integration-support";
import { readTurns } from "./marketing-read-support";
import {
  type World,
  WORLD_DAY as DAY,
  WORLD_NOW as NOW,
  dropWorlds,
  seedWorld,
} from "./marketing-world-support";
import { loadBusinessTurnStats } from "./marketing/merit";
import { runMarketingTick, type TickSummary } from "./marketing/tick";
import { getDb, withDbTransaction } from "./db";
import { campaignTurns } from "./schema";

/**
 * The MERIT wiring (ADR 0066, spec 0065 phase A5). `businessScore` and `byMerit` have
 * their own unit suites; what has no oracle until here is that the tick READS the stats
 * in SQL, shrinks them and hands the map to the planner — the hole of tarea 38, where a
 * pure decision was tested and its call-site was not.
 */

const NS = "marketing_tick_test_merit";

const worlds: World[] = [];

async function world(people: number): Promise<World> {
  const built = await seedWorld({ label: "Marketing merit", people });
  worlds.push(built);
  return built;
}

describe.skipIf(!integrationEnabled)("marketing merit", () => {
  afterEach(async () => {
    await dropWorlds(worlds);
  }, 120_000);

  /**
   * A business's PAST, in one insert: `done` turns with their outcome, placed and
   * holdout apart — which is exactly what `merit.ts` reads to compute the lift.
   * The history consumer gets NO wallet pass, so it is `not_reachable` and never
   * competes in the run under test.
   */
  async function history(
    built: World,
    counts: {
      placed: number;
      placedBought: number;
      held: number;
      heldBought: number;
    },
    boughtOutcome: "purchase" | "coupon_redeemed" = "purchase",
  ): Promise<void> {
    const consumer = await seedConsumer();
    const membershipId = await seedMembership({
      consumerId: consumer.id,
      programId: built.seed.programId,
      businessId: built.seed.business.id,
      enrolledAt: new Date(NOW.getTime() - 400 * DAY),
    });
    const rows: (typeof campaignTurns.$inferInsert)[] = [];
    const push = (holdout: boolean, total: number, bought: number) => {
      for (let index = 0; index < total; index += 1)
        rows.push({
          campaignId: built.campaignId,
          businessId: built.seed.business.id,
          consumerId: consumer.id,
          membershipId,
          locationId: built.doorId,
          status: "done",
          holdout,
          windowStart: new Date(NOW.getTime() - 100 * DAY),
          windowEnd: new Date(NOW.getTime() - 95 * DAY),
          outcome: index < bought ? boughtOutcome : "none",
        });
    };
    push(false, counts.placed, counts.placedBought);
    push(true, counts.held, counts.heldBought);
    await getDb().insert(campaignTurns).values(rows);
  }

  it("orders the queue by MERIT: the wiring, not only the formula", async () => {
    // The two unit suites pin `businessScore` and `byMerit`; what has no oracle until
    // here is the WIRING — that the tick reads the stats in SQL, shrinks them and hands
    // the map to the planner. The hole of tarea 38: the decision was pure and tested,
    // and the call-site was not.
    const good = await world(0);
    const bad = await world(0);
    // Symmetric histories (+0.8 vs −0.8 with the same n) so the ordering survives the
    // shrinkage whatever the platform's global lift is — other suites share this branch
    // and move it, and a test that flipped with them would be a coin toss.
    await history(good, {
      placed: 50,
      placedBought: 45,
      held: 10,
      heldBought: 1,
    });
    await history(bad, {
      placed: 50,
      placedBought: 5,
      held: 10,
      heldBought: 9,
    });
    const farDoor = await seedLocation({
      businessId: bad.seed.business.id,
      ...FAR,
    });
    await getDb()
      .update(campaignTurns)
      .set({ locationId: bad.doorId })
      .where(eq(campaignTurns.businessId, bad.seed.business.id));
    expect(farDoor).toBeTruthy();

    const consumer = await seedConsumer();
    for (const built of [good, bad]) {
      await seedMembership({
        consumerId: consumer.id,
        programId: built.seed.programId,
        businessId: built.seed.business.id,
        enrolledAt: new Date(NOW.getTime() - 400 * DAY),
      });
      built.consumerIds.push(consumer.id);
    }
    await seedWalletPass(consumer.id);

    // The BAD business queues FIRST, an hour earlier: with `maxActiveTurns: 0` nothing
    // activates and its turn simply waits. Without this the two turns would tie on
    // `queued_at` and the FIFO tie-break would fall to the random `turn_id` — the test
    // would be a coin toss, and a coin toss that lands green is worse than no test.
    await runMarketingTick({
      now: new Date(NOW.getTime() - 3_600_000),
      random: () => 1,
      lockNamespace: NS,
      limits: { maxActiveTurns: 0 },
      businessIds: [bad.seed.business.id],
      consumerIds: [consumer.id],
    });
    const summary = (await runMarketingTick({
      now: NOW,
      random: () => 1,
      lockNamespace: NS,
      // One slot: the two businesses compete for it, and merit decides — against FIFO.
      limits: { maxActiveTurns: 1 },
      businessIds: [good.seed.business.id, bad.seed.business.id],
      consumerIds: [consumer.id],
    })) as TickSummary;
    expect(summary).toMatchObject({ enqueued: 1, activated: 1 });
    const winner = (await readTurns(good.seed.business.id)).filter(
      (turn) => turn.consumerId === consumer.id,
    );
    const loser = (await readTurns(bad.seed.business.id)).filter(
      (turn) => turn.consumerId === consumer.id,
    );
    expect(winner.map((turn) => turn.status)).toEqual(["active"]);
    expect(loser.map((turn) => turn.status)).toEqual(["queued"]);
  }, 180_000);

  /**
   * R1 — `loadBusinessTurnStats` counts `coupon_redeemed` as a purchase, because step 2
   * writes it INSTEAD of `purchase` when the coupon was handed over: reading only
   * `'purchase'` would score a campaign whose coupon WORKED as if nobody had come.
   *
   * The review of phase A found that invariant declared in the docblock of `merit.ts`
   * and pinned by nothing: `marketing-outcome` pins that the tick WRITES the value, and
   * this file only ever seeded `purchase`/`none`, so the two halves never met. The stats
   * are asserted directly instead of through the race — the property is the COUNT, and a
   * test should fail for the reason it names (`CLAUDE.md`).
   *
   * Mutation that turns this red: `in ('purchase', 'coupon_redeemed')` → `= 'purchase'`.
   */
  it("counts a COUPON REDEMPTION as a purchase in the stats", async () => {
    const built = await world(0);
    await history(
      built,
      { placed: 4, placedBought: 3, held: 2, heldBought: 1 },
      "coupon_redeemed",
    );

    const stats = await withDbTransaction((tx) => loadBusinessTurnStats(tx));

    expect(
      stats.find((row) => row.businessId === built.seed.business.id),
    ).toEqual({
      businessId: built.seed.business.id,
      placedN: 4,
      placedPurchases: 3,
      holdoutN: 2,
      holdoutPurchases: 1,
    });
  }, 180_000);
});
