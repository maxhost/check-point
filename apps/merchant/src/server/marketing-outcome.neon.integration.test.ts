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
  seedCampaign,
  seedCouponRedemption,
  seedLocation,
  seedMembership,
  seedOrder,
  seedTurn,
  seedWalletPass,
} from "./marketing-integration-support";
import { dropCampaigns, readTurns } from "./marketing-read-support";
import { runMarketingTick, type TickSummary } from "./marketing/tick";

/**
 * Step 2 (spec 0065): a window closes and the turn is `done` WITH its result. The four
 * cases the design distinguishes, each on its own consumer, plus the two traps: an
 * order OUTSIDE the window must not count, and when a coupon was handed over the coupon
 * wins even though there is also a purchase.
 */

/** Own advisory namespace: the suites share one database and a single key would
 * make them answer `tick_in_flight` to each other. The skip itself is asserted with the
 * production default, in `marketing-placement`. */
const NS = "marketing_tick_test_outcome";

const DAY = 86_400_000;
const HOUR = 3_600_000;
const WINDOW_START = new Date("2026-09-01T12:00:00.000Z");
const WINDOW_END = new Date(WINDOW_START.getTime() + 5 * DAY);
const NOW = new Date(WINDOW_END.getTime() + HOUR);

type Case = {
  consumerId: string;
  membershipId: string;
  turnId: string;
  firstOrderId?: string;
};

describe.skipIf(!integrationEnabled)("marketing outcome", () => {
  let seed: Seed;
  let doorId: string;
  let campaignId: string;
  const cases: Record<string, Case> = {};
  let summary: TickSummary;

  async function turnFor(name: string, holdout = false): Promise<Case> {
    const consumer = await seedConsumer();
    const membershipId = await seedMembership({
      consumerId: consumer.id,
      programId: seed.programId,
      businessId: seed.business.id,
      enrolledAt: new Date(WINDOW_START.getTime() - 400 * DAY),
    });
    await seedWalletPass(consumer.id);
    const turnId = await seedTurn({
      campaignId,
      businessId: seed.business.id,
      consumerId: consumer.id,
      membershipId,
      locationId: doorId,
      status: "active",
      holdout,
      windowStart: WINDOW_START,
      windowEnd: WINDOW_END,
      messageSnapshot: "2x1 en picadas",
    });
    const built = { consumerId: consumer.id, membershipId, turnId };
    cases[name] = built;
    return built;
  }

  function order(built: Case, createdAt: Date) {
    return seedOrder({
      businessId: seed.business.id,
      locationId: doorId,
      programId: seed.programId,
      membershipId: built.membershipId,
      consumerId: built.consumerId,
      userId: seed.userId,
      createdAt,
    });
  }

  beforeAll(async () => {
    seed = await seedBusiness({
      name: `Marketing outcome ${Date.now()}`,
      kind: "stamps",
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    doorId = await seedLocation({ businessId: seed.business.id, ...NEAR });
    campaignId = await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [doorId],
      coupon: { label: "2x1 en picadas", cost: "3.00", maxRedemptions: 50 },
    });

    const bought = await turnFor("purchase");
    // TWO orders inside the window: «the first» has to be the earliest, deterministically.
    bought.firstOrderId = await order(
      bought,
      new Date(WINDOW_START.getTime() + HOUR),
    );
    await order(bought, new Date(WINDOW_START.getTime() + 2 * DAY));

    const silent = await turnFor("none");
    // Outside the window on both sides: neither may count.
    await order(silent, new Date(WINDOW_START.getTime() - DAY));
    await order(silent, new Date(WINDOW_END.getTime() + 30 * 60_000));

    const redeemed = await turnFor("coupon_redeemed");
    await order(redeemed, new Date(WINDOW_START.getTime() + HOUR));
    await seedCouponRedemption({
      turnId: redeemed.turnId,
      campaignId,
      businessId: seed.business.id,
      consumerId: redeemed.consumerId,
      membershipId: redeemed.membershipId,
      locationId: doorId,
      userId: seed.userId,
    });

    const held = await turnFor("holdout", true);
    await order(held, new Date(WINDOW_START.getTime() + HOUR));

    summary = (await runMarketingTick({
      now: NOW,
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: Object.values(cases).map((row) => row.consumerId),
    })) as TickSummary;
  }, 180_000);

  afterAll(async () => {
    if (!integrationEnabled) return;
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }, 120_000);

  it("closes every expired window exactly once", () => {
    expect(summary.expired).toBe(4);
  });

  it("writes `purchase` with the FIRST order of the window", async () => {
    const turns = await readTurns(seed.business.id);
    const turn = turns.find((row) => row.id === cases.purchase.turnId);
    expect(turn).toMatchObject({ status: "done", outcome: "purchase" });
    expect(turn?.outcomeOrderId).toBe(cases.purchase.firstOrderId);
  });

  it("writes `none` when the orders fall outside the window", async () => {
    const turns = await readTurns(seed.business.id);
    const turn = turns.find((row) => row.id === cases.none.turnId);
    expect(turn).toMatchObject({
      status: "done",
      outcome: "none",
      outcomeOrderId: null,
    });
  });

  it("lets the coupon win over the purchase, and records no order", async () => {
    const turns = await readTurns(seed.business.id);
    const turn = turns.find((row) => row.id === cases.coupon_redeemed.turnId);
    expect(turn).toMatchObject({
      status: "done",
      outcome: "coupon_redeemed",
      // `outcome_order_id` stays null: the result of this turn is the coupon, and two
      // results on one row would make the merit table count it twice.
      outcomeOrderId: null,
    });
  });

  it("measures the HOLDOUT too: a base line that did not measure would not be one", async () => {
    const turns = await readTurns(seed.business.id);
    const turn = turns.find((row) => row.id === cases.holdout.turnId);
    expect(turn).toMatchObject({
      status: "done",
      holdout: true,
      outcome: "purchase",
    });
  });
});
