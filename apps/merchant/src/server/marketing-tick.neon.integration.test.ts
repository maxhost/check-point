import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import {
  NEAR,
  NEAR_TWIN,
  seedCampaign,
  seedLocation,
  seedMembership,
  seedOrder,
  seedTurn,
  seedWalletPass,
} from "./marketing-integration-support";
import {
  dropCampaigns,
  readAccount,
  readPlacement,
  readTurns,
} from "./marketing-read-support";
import { runMarketingTick, type TickSummary } from "./marketing/tick";
import { getDb } from "./db";
import { campaignTickAudiences } from "./schema";
import { eq } from "drizzle-orm";

/**
 * The tick end to end (spec 0065, phase A5): the audience with its six exclusion
 * reasons, the activation, the fused door and — the item the whole design hangs from —
 * IDEMPOTENCE: a second run over the same world changes nothing.
 *
 * `random` is injected as `() => 1` so NOTHING is a holdout here: the holdout has its
 * own file, with the draw forced the other way. Rolling dice in a suite that asserts
 * exact rows is how a green turns into a coin flip.
 */

/** Own advisory namespace: the suites share one database and a single key would
 * make them answer `tick_in_flight` to each other. The skip itself is asserted with the
 * production default, in `marketing-placement`. */
const NS = "marketing_tick_test_tick";

const DAY = 86_400_000;
const NOW = new Date("2026-09-16T12:00:00.000Z");
const LATER = new Date(NOW.getTime() + 60_000);

type Person = { consumerId: string; membershipId: string };

describe.skipIf(!integrationEnabled)("marketing tick", () => {
  let seed: Seed;
  const businessName = `Marketing tick ${Date.now()}`;
  let campaignId: string;
  let doorA: string;
  let doorB: string;
  let doorNoCoords: string;
  const people: Record<string, Person> = {};
  let firstRun: TickSummary;
  const infoLines: string[] = [];

  async function person(
    name: string,
    opts: {
      pass?: boolean;
      enrolledAt?: Date;
      optedOutAt?: Date | null;
      stamps?: number;
      orderAt?: Date;
      orderLocationId?: string | null;
    } = {},
  ): Promise<Person> {
    const consumer = await seedConsumer();
    const membershipId = await seedMembership({
      consumerId: consumer.id,
      programId: seed.programId,
      businessId: seed.business.id,
      enrolledAt: opts.enrolledAt ?? new Date(NOW.getTime() - 400 * DAY),
      optedOutAt: opts.optedOutAt ?? null,
      stamps: opts.stamps ?? 0,
    });
    if (opts.pass !== false) await seedWalletPass(consumer.id);
    if (opts.orderAt)
      await seedOrder({
        businessId: seed.business.id,
        locationId: opts.orderLocationId ?? doorA,
        programId: seed.programId,
        membershipId,
        consumerId: consumer.id,
        userId: seed.userId,
        createdAt: opts.orderAt,
      });
    const row = { consumerId: consumer.id, membershipId };
    people[name] = row;
    return row;
  }

  beforeAll(async () => {
    seed = await seedBusiness({
      name: businessName,
      kind: "stamps",
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    doorA = await seedLocation({ businessId: seed.business.id, ...NEAR });
    doorB = await seedLocation({ businessId: seed.business.id, ...NEAR_TWIN });
    doorNoCoords = await seedLocation({
      businessId: seed.business.id,
      latitude: null,
      longitude: null,
    });
    campaignId = await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [doorA, doorB, doorNoCoords],
    });

    // The eight states of the audience, one consumer each.
    await person("dormant", { orderAt: new Date(NOW.getTime() - 90 * DAY) });
    await person("optOut", { optedOutAt: new Date(NOW.getTime() - DAY) });
    await person("noPass", { pass: false });
    await person("fresh", { orderAt: new Date(NOW.getTime() - 5 * DAY) });
    await person("noDoor", {
      orderAt: new Date(NOW.getTime() - 90 * DAY),
      orderLocationId: doorNoCoords,
    });
    const cooled = await person("cooldown", {
      orderAt: new Date(NOW.getTime() - 90 * DAY),
    });
    await seedTurn({
      campaignId,
      businessId: seed.business.id,
      consumerId: cooled.consumerId,
      membershipId: cooled.membershipId,
      locationId: doorA,
      status: "done",
      windowStart: new Date(NOW.getTime() - 15 * DAY),
      windowEnd: new Date(NOW.getTime() - 10 * DAY),
      outcome: "none",
    });
    const waiting = await person("queued", {
      orderAt: new Date(NOW.getTime() - 90 * DAY),
    });
    await seedTurn({
      campaignId,
      businessId: seed.business.id,
      consumerId: waiting.consumerId,
      membershipId: waiting.membershipId,
      locationId: doorB,
      status: "queued",
      queuedAt: new Date(NOW.getTime() - 2 * DAY),
    });
    // Dormant AND with a live balance at the SAME door: the central profile, not an
    // edge — it is the one that fuses into a single `both` row.
    await person("both", {
      orderAt: new Date(NOW.getTime() - 60 * DAY),
      stamps: 2,
    });

    const spy = vi.spyOn(console, "info").mockImplementation((...args) => {
      infoLines.push(args.map((arg) => String(arg)).join(" "));
    });
    firstRun = (await runMarketingTick({
      now: NOW,
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: Object.values(people).map((row) => row.consumerId),
    })) as TickSummary;
    spy.mockRestore();
  }, 120_000);

  afterAll(async () => {
    if (!integrationEnabled) return;
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  });

  it("queues only the eligible consumers and says why for the rest", async () => {
    expect(firstRun.campaigns).toBe(1);
    expect(firstRun.enqueued).toBe(2);
    const [photo] = await getDb()
      .select()
      .from(campaignTickAudiences)
      .where(eq(campaignTickAudiences.campaignId, campaignId));
    expect(photo).toMatchObject({
      total: 8,
      // Seven own a wallet pass; `optOut` is counted reachable although it was excluded
      // first — `reachable` is a capability, not a leftover of the decision.
      reachable: 7,
      noLocation: 1,
      optOut: 1,
      cooldown: 1,
    });
  });

  it("activates with the window and the snapshots, and leaves nobody else a turn", async () => {
    const turns = await readTurns(seed.business.id);
    const byConsumer = new Map(turns.map((turn) => [turn.consumerId, turn]));
    expect(turns).toHaveLength(4);
    expect(firstRun.activated).toBe(3);
    for (const name of ["dormant", "queued", "both"]) {
      const turn = byConsumer.get(people[name].consumerId);
      expect([name, turn?.status]).toEqual([name, "active"]);
      expect(turn?.windowStart).toEqual(NOW);
      expect(turn?.windowEnd).toEqual(new Date(NOW.getTime() + 5 * DAY));
      // Copied at activation from the campaign, never read live afterwards.
      expect(turn?.messageSnapshot).toBe("2x1 en picadas");
    }
    for (const name of ["optOut", "noPass", "fresh", "noDoor"])
      expect([name, byConsumer.has(people[name].consumerId)]).toEqual([
        name,
        false,
      ]);
  });

  it("puts each turn in the pass, and the shared door as ONE fused row", async () => {
    expect(firstRun.consumers).toBe(3);
    expect(firstRun.refreshes).toBe(3);
    const plain = await readPlacement(people.dormant.consumerId);
    expect(plain).toHaveLength(1);
    expect(plain[0]).toMatchObject({
      locationId: doorA,
      slotKind: "turn",
      businessId: seed.business.id,
    });
    expect(plain[0].relevantText).toBe(`${businessName}: 2x1 en picadas`);
    const fused = await readPlacement(people.both.consumerId);
    expect(fused).toHaveLength(1);
    expect(fused[0].slotKind).toBe("both");
    expect(fused[0].relevantText).toBe(
      `${businessName}: 2 sellos · 2x1 en picadas`,
    );
    expect(fused[0].locationId).toBe(doorA);
  });

  it("marks the pass as changed without touching «Última novedad»", async () => {
    const account = await readAccount(people.dormant.consumerId);
    expect(account.messageUpdatedAt).toEqual(NOW);
    expect(account.latestMessage).toBeNull();
    expect(account.lastPushAt).toBeNull();
  });

  it("logs the run as JSON, so the log is an oracle and not a decoration", () => {
    const line = infoLines.find((text) => text.startsWith("marketing_tick "));
    expect(line).toBeDefined();
    expect(JSON.parse(line!.replace("marketing_tick ", ""))).toEqual({
      campaigns: 1,
      enqueued: 2,
      expired: 0,
      cancelled: 0,
      consumers: 3,
      activated: 3,
      holdouts: 0,
      refreshes: 3,
    });
  });

  it("is IDEMPOTENT: a second run changes no row and re-queues nobody", async () => {
    const before = await readTurns(seed.business.id);
    const placementBefore = await readPlacement(people.both.consumerId);
    const accountBefore = await readAccount(people.dormant.consumerId);
    const second = (await runMarketingTick({
      now: LATER,
      random: () => 1,
      lockNamespace: NS,
      businessIds: [seed.business.id],
      consumerIds: Object.values(people).map((row) => row.consumerId),
    })) as TickSummary;
    expect(second).toMatchObject({
      enqueued: 0,
      activated: 0,
      expired: 0,
      cancelled: 0,
      refreshes: 0,
    });
    expect(await readTurns(seed.business.id)).toEqual(before);
    expect(await readPlacement(people.both.consumerId)).toEqual(
      placementBefore,
    );
    // `message_updated_at` untouched: an unchanged set must not re-tag the pass, or
    // every tick would rewrite it and Apple would re-download it forever.
    expect(await readAccount(people.dormant.consumerId)).toEqual(accountBefore);
  }, 120_000);
});
