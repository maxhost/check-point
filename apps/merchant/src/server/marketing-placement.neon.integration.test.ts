import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedConsumer,
} from "./counter-integration-support";
import { seedMembership, seedTurn } from "./marketing-integration-support";
import { readPlacement, readTurns } from "./marketing-read-support";
import {
  type World,
  WORLD_DAY as DAY,
  WORLD_NOW as NOW,
  dropWorlds,
  seedWorld,
  tickWorld,
} from "./marketing-world-support";
import {
  TICK_LOCK_NAMESPACE,
  runMarketingTick,
  type TickSummary,
} from "./marketing/tick";
import { withDbTransaction } from "./db";

/**
 * The properties of step 4 that only a database can answer (spec 0065 phase A5): the
 * holdout stays OUT of the pass, the per-business quota holds INSIDE one run, two
 * overlapping runs do not both place, and the opt-out never reaches the utility bag.
 * The merit WIRING lives in `marketing-merit.neon.integration.test.ts` — same design,
 * split only by the file-size budget.
 */

/** Own advisory namespace: the suites share one database and a single key would make
 * them answer `tick_in_flight` to each other. The skip itself is asserted with the
 * PRODUCTION default, below. */
const NS = "marketing_tick_test_placement";

const worlds: World[] = [];

async function world(people: number): Promise<World> {
  const built = await seedWorld({ label: "Marketing placement", people });
  worlds.push(built);
  return built;
}

function tick(
  built: World,
  options: Parameters<typeof runMarketingTick>[0] = {},
) {
  return tickWorld(built, NS, options);
}

describe.skipIf(!integrationEnabled)("marketing placement", () => {
  afterEach(async () => {
    await dropWorlds(worlds);
  }, 120_000);

  it("keeps the holdout OUT of the pass while its turn runs", async () => {
    const built = await world(1);
    const summary = (await tick(built, { random: () => 0 })) as TickSummary;
    expect(summary).toMatchObject({
      activated: 1,
      holdouts: 1,
      // Nothing to write: the pass of a holdout is the pass it already had.
      refreshes: 0,
    });
    const [turn] = await readTurns(built.seed.business.id);
    expect(turn).toMatchObject({ status: "active", holdout: true });
    expect(await readPlacement(built.consumerIds[0])).toEqual([]);
  }, 120_000);

  it("holds the business quota INSIDE one run: the excess stays queued", async () => {
    const built = await world(3);
    // The quota is a parameter so a test can lower it instead of seeding fifty turns.
    const summary = (await tick(built, {
      limits: { businessQuota: 2 },
    })) as TickSummary;
    expect(summary).toMatchObject({ enqueued: 3, activated: 2 });
    const turns = await readTurns(built.seed.business.id);
    expect(turns.filter((turn) => turn.status === "active")).toHaveLength(2);
    expect(turns.filter((turn) => turn.status === "queued")).toHaveLength(1);
    // And it stays queued: the next run reads the quota as full, it does not reset.
    await tick(built, { limits: { businessQuota: 2 } });
    const after = await readTurns(built.seed.business.id);
    expect(after.filter((turn) => turn.status === "queued")).toHaveLength(1);
  }, 120_000);

  /**
   * R4 — the quota counts `active` NON-HOLDOUT turns (`loadBusinessActiveTurns`), which
   * is the literal wording of the DoD: a holdout is the base line of the measurement,
   * not an exposure, so it must not eat a slot the business paid for.
   *
   * The review of phase A found that half of the invariant pinned by nothing — the
   * holdout suite and the quota suite both existed, but no case mixed holdouts and quota
   * in the SAME business, which is the only shape that tells the two readings apart.
   *
   * The two holdouts are seeded as turns ALREADY `active` on purpose, and that detail is
   * the whole test: `loadBusinessActiveTurns` only SEEDS the counter at the start of a
   * run, and from there the planner advances it in memory. Holdouts created inside the
   * run under test would never reach the query, so the first version of this test passed
   * with the mutation mounted — measured, not reasoned (`CLAUDE.md`: the pair
   * mutation↔test is executed, never predicted).
   *
   * Mutation that turns this red: drop `eq(campaignTurns.holdout, false)` from
   * `loadBusinessActiveTurns`. Then the two seeded holdouts fill the quota of 2 and the
   * two reachable consumers stay `queued`.
   */
  it("does NOT let a holdout eat the business quota", async () => {
    const built = await world(2);
    for (let index = 0; index < 2; index += 1) {
      const consumer = await seedConsumer();
      const membershipId = await seedMembership({
        consumerId: consumer.id,
        programId: built.seed.programId,
        businessId: built.seed.business.id,
        enrolledAt: new Date(NOW.getTime() - 400 * DAY),
      });
      await seedTurn({
        campaignId: built.campaignId,
        businessId: built.seed.business.id,
        consumerId: consumer.id,
        membershipId,
        locationId: built.doorId,
        status: "active",
        holdout: true,
        // Window still open: step 2 must not expire them before step 4 reads the quota.
        windowStart: new Date(NOW.getTime() - DAY),
        windowEnd: new Date(NOW.getTime() + 4 * DAY),
      });
    }

    const summary = (await tick(built, {
      limits: { businessQuota: 2 },
    })) as TickSummary;

    expect(summary).toMatchObject({ enqueued: 2, activated: 2 });
    const turns = await readTurns(built.seed.business.id);
    expect(
      turns.filter((turn) => turn.status === "active" && !turn.holdout),
    ).toHaveLength(2);
    expect(turns.filter((turn) => turn.status === "queued")).toHaveLength(0);
  }, 120_000);

  it("skips while another run holds the tick lock, and writes nothing", async () => {
    const built = await world(1);
    let lockTaken: () => void = () => {};
    let release: () => void = () => {};
    const taken = new Promise<void>((resolve) => (lockTaken = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    // The test IS the other tick: it takes the same advisory key and holds it. Racing
    // two real ticks would be a coin flip — a fast one commits before the other starts.
    // The key comes from the PRODUCTION constant, so the test cannot drift from it.
    const holder = withDbTransaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${TICK_LOCK_NAMESPACE}, 0))`,
      );
      lockTaken();
      await released;
    });
    await taken;
    const underLock = { lockNamespace: TICK_LOCK_NAMESPACE };
    expect(await tick(built, underLock)).toEqual({ skipped: "tick_in_flight" });
    expect(await readTurns(built.seed.business.id)).toEqual([]);
    release();
    await holder;
    // The very same call, with the lock free, does the work: the skip was the lock and
    // not a seed that could never have produced a turn.
    expect((await tick(built, underLock)) as TickSummary).toMatchObject({
      enqueued: 1,
      activated: 1,
    });
  }, 120_000);
  it("keeps the utility door of a business the consumer opted OUT of", async () => {
    // The owner's rule (spec 0065): the opt-out silences MARKETING, never the
    // consumer's own balance — «el opt-out no apaga la utilidad». The bag is loaded by
    // a query of its own, so nothing but this stops someone from copying the audience's
    // `marketing_opt_out_at is null` into it, which reads like consistency.
    const built = await world(1);
    const other = await world(0);
    await seedMembership({
      consumerId: built.consumerIds[0],
      programId: other.seed.programId,
      businessId: other.seed.business.id,
      enrolledAt: new Date(NOW.getTime() - 400 * DAY),
      // The door they enrolled at: `seedBusiness` already gave this business a second
      // usable door, so without an attribution there is no single-door fallback and the
      // bag would be empty for a reason that has nothing to do with the opt-out.
      originLocationId: other.doorId,
      stamps: 2,
      optedOutAt: new Date(NOW.getTime() - DAY),
    });
    await tick(built);
    const placement = await readPlacement(built.consumerIds[0]);
    expect(
      placement.map((slot) => [slot.businessId, slot.slotKind]).sort(),
    ).toEqual(
      [
        [built.seed.business.id, "turn"],
        [other.seed.business.id, "utility"],
      ].sort(),
    );
    const utility = placement.find((slot) => slot.slotKind === "utility");
    expect(utility?.relevantText).toContain("2 sellos");
  }, 180_000);
});
