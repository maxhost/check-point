import { afterAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
  seedReward,
  setBalance,
} from "./counter-integration-support";
import { seedMembership, seedOrder } from "./marketing-integration-support";
import {
  readPushes,
  readQueue,
  seedPushCampaign,
  seedRedemption,
  seedWebPush,
} from "./marketing-push-support";
import { dropCampaigns } from "./marketing-read-support";
import { type TickSummary, runMarketingTick } from "./marketing/tick";

/**
 * The BALANCE templates on the tick (spec 0104 §6 / ADR 0096) against a real database.
 * Every state is READ BY SQL (`campaign_push`, the `body` of `wallet_push_queue`). The
 * consumers are dormant (enrolled 400 days ago, no order) and reachable by Web Push; what
 * each case varies is the balance, the history and the clock. `random` is `() => 1`: no
 * holdouts, so every decision has its queue row and its body.
 */
const NS = "marketing_balance_push_tick";
const DAY = 86_400_000;
const T0 = new Date("2026-09-16T12:00:00.000Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);
const LONG_AGO = at(-400);
const seeds: Seed[] = [];
const people: string[] = [];

afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
}, 120_000);

/** A Sellos business (card of 10, one reward) or a Puntos one whose CHEAPEST reward is
 * 100 (a 300 one next to it: the cost is the cheapest, as the utility bag reads it). */
async function business(kind: "stamps" | "points", label: string) {
  const name = `${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const seed =
    kind === "stamps"
      ? await seedBusiness({
          name,
          kind,
          mode: "per_purchase",
          grant: 1,
          blockAmount: null,
          configuration: { target: 10 },
        })
      : await seedBusiness({
          name,
          kind,
          mode: "per_amount",
          grant: 10,
          blockAmount: "1.00",
        });
  seeds.push(seed);
  const reward = { programId: seed.programId, businessId: seed.business.id };
  if (kind === "stamps") await seedReward({ ...reward, pointsCost: null });
  else {
    await seedReward({ ...reward, pointsCost: 300, position: 0 });
    await seedReward({ ...reward, pointsCost: 100, position: 1 });
  }
  return seed;
}

async function person(
  seed: Seed,
  balance: { stamps?: number; points?: number },
) {
  const consumer = await seedConsumer();
  people.push(consumer.id);
  const membershipId = await seedMembership({
    consumerId: consumer.id,
    programId: seed.programId,
    businessId: seed.business.id,
    enrolledAt: LONG_AGO,
    ...balance,
  });
  await seedWebPush(consumer.id);
  return { consumerId: consumer.id, membershipId };
}

function tick(seed: Seed, now: Date) {
  return runMarketingTick({
    now,
    random: () => 1,
    lockNamespace: NS,
    businessIds: [seed.business.id],
    consumerIds: people,
  }) as Promise<TickSummary>;
}

/** consumerId → the bodies of their queue rows. */
async function bodies(consumerIds: string[]) {
  const rows = await readQueue(consumerIds);
  return Object.fromEntries(
    consumerIds.map((id) => [
      id,
      rows.filter((row) => row.consumerId === id).map((row) => row.body),
    ]),
  );
}

describe.skipIf(!integrationEnabled)(
  "marketing tick — balance templates",
  () => {
    it("Sellos: #7 only to the dormant NEAR the reward, each with ITS gap; #8 to the one who has it; a second tick adds nothing", async () => {
      const seed = await business("stamps", "Saldo sellos");
      const near = await seedPushCampaign({
        businessId: seed.business.id,
        userId: seed.userId,
        templateKey: "near_reward",
        dormantDays: 7,
        message: "¡Estás a {faltan} de tu premio!",
      });
      const unclaimed = await seedPushCampaign({
        businessId: seed.business.id,
        userId: seed.userId,
        templateKey: "unclaimed_reward",
        dormantDays: 14,
        message: "Tenés un premio esperándote.",
      });
      const two = await person(seed, { stamps: 8 });
      const one = await person(seed, { stamps: 9 });
      const far = await person(seed, { stamps: 5 });
      const has = await person(seed, { stamps: 10 });

      expect(await tick(seed, T0)).toMatchObject({
        pushDecided: 3,
        pushHeld: 0,
      });
      const pushes = await readPushes(seed.business.id);
      expect(pushes.map((p) => [p.consumerId, p.campaignId]).sort()).toEqual(
        [
          [two.consumerId, near],
          [one.consumerId, near],
          [has.consumerId, unclaimed],
        ].sort(),
      );
      expect(
        await bodies([
          two.consumerId,
          one.consumerId,
          far.consumerId,
          has.consumerId,
        ]),
      ).toEqual({
        [two.consumerId]: ["¡Estás a 2 sellos de tu premio!"],
        [one.consumerId]: ["¡Estás a 1 sello de tu premio!"],
        [far.consumerId]: [],
        [has.consumerId]: ["Tenés un premio esperándote."],
      });

      expect(await tick(seed, T0)).toMatchObject({ pushDecided: 0 });
      expect(await readPushes(seed.business.id)).toHaveLength(3);
    }, 120_000);

    it("Puntos: the % threshold of the cheapest reward (P 10 of 100: gap 10 yes, gap 15 no)", async () => {
      const seed = await business("points", "Saldo puntos");
      const near = await seedPushCampaign({
        businessId: seed.business.id,
        userId: seed.userId,
        templateKey: "near_reward",
        dormantDays: 7,
        nearRewardStamps: 2,
        nearRewardPercent: 10,
        message: "Te faltan {faltan}",
      });
      const ten = await person(seed, { points: 90 });
      const fifteen = await person(seed, { points: 85 });

      expect(await tick(seed, T0)).toMatchObject({ pushDecided: 1 });
      const pushes = await readPushes(seed.business.id);
      expect(pushes.map((p) => [p.consumerId, p.campaignId])).toEqual([
        [ten.consumerId, near],
      ]);
      expect(await bodies([ten.consumerId, fifteen.consumerId])).toEqual({
        [ten.consumerId]: ["Te faltan 10 puntos"],
        [fifteen.consumerId]: [],
      });
    }, 120_000);

    it("#7 is ONE per redemption cycle: a visit does not reopen it, a redemption does", async () => {
      const seed = await business("stamps", "Saldo ciclo");
      await seedPushCampaign({
        businessId: seed.business.id,
        userId: seed.userId,
        templateKey: "near_reward",
        dormantDays: 7,
        message: "¡Estás a {faltan} de tu premio!",
      });
      const who = await person(seed, { stamps: 8 });
      const facts = {
        businessId: seed.business.id,
        programId: seed.programId,
        membershipId: who.membershipId,
        consumerId: who.consumerId,
        userId: seed.userId,
      };
      expect(await tick(seed, T0)).toMatchObject({ pushDecided: 1 });

      // A visit (still near: 9 of 10) and a new absence: SAME cycle → no.
      await seedOrder({
        ...facts,
        locationId: seed.locationId,
        createdAt: at(1),
      });
      await setBalance(who.membershipId, { stamps: 9 });
      expect(await tick(seed, at(30))).toMatchObject({ pushDecided: 0 });

      // A redemption opens a new cycle (balance back near the reward) → yes.
      await seedRedemption({ ...facts, createdAt: at(31) });
      await setBalance(who.membershipId, { stamps: 8 });
      expect(await tick(seed, at(60))).toMatchObject({ pushDecided: 1 });
      expect(
        (await readPushes(seed.business.id)).map((p) => p.decidedAt),
      ).toEqual([T0, at(60)]);
    }, 120_000);

    it("#8 every_30_days: a second push only 30 days later, never a third; `once` never a second", async () => {
      const seed = await business("stamps", "Saldo repeticion");
      await seedPushCampaign({
        businessId: seed.business.id,
        userId: seed.userId,
        templateKey: "unclaimed_reward",
        dormantDays: 7,
        rewardRepeat: "every_30_days",
      });
      await person(seed, { stamps: 10 });
      expect(await tick(seed, T0)).toMatchObject({ pushDecided: 1 });
      expect(await tick(seed, at(29))).toMatchObject({ pushDecided: 0 });
      expect(await tick(seed, at(30))).toMatchObject({ pushDecided: 1 });
      expect(await tick(seed, at(90))).toMatchObject({ pushDecided: 0 });
      expect(
        (await readPushes(seed.business.id)).map((p) => p.decidedAt),
      ).toEqual([T0, at(30)]);

      const other = await business("stamps", "Saldo una vez");
      await seedPushCampaign({
        businessId: other.business.id,
        userId: other.userId,
        templateKey: "unclaimed_reward",
        dormantDays: 7,
      });
      await person(other, { stamps: 12 });
      expect(await tick(other, T0)).toMatchObject({ pushDecided: 1 });
      expect(await tick(other, at(60))).toMatchObject({ pushDecided: 0 });
    }, 120_000);

    it("no reward in the operational program → zero decisions", async () => {
      const name = `Saldo sin premio ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
      const seed = await seedBusiness({
        name,
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
        configuration: { target: 10 },
      });
      seeds.push(seed);
      await seedPushCampaign({
        businessId: seed.business.id,
        userId: seed.userId,
        templateKey: "near_reward",
        dormantDays: 7,
        message: "¡Estás a {faltan} de tu premio!",
      });
      await person(seed, { stamps: 9 });
      expect(await tick(seed, T0)).toMatchObject({ pushDecided: 0 });
    }, 120_000);
  },
);
