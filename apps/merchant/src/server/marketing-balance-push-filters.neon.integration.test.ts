import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
  seedReward,
} from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { seedMembership } from "./marketing-integration-support";
import {
  readPushes,
  seedDecision,
  seedPushCampaign,
  seedWebPush,
} from "./marketing-push-support";
import { dropCampaigns } from "./marketing-read-support";
import { loyaltyPrograms } from "@mi-pasaporte/db/schema";
import { type TickSummary, runMarketingTick } from "./marketing/tick";

/**
 * The two SQL filters of `loadBalanceCandidates` (spec 0104 §5-6) that the first
 * integration file does not reach, found by the independent review (R1, R4):
 *  - only memberships of the OPERATIONAL program count — a consumer can hold a
 *    membership of an `inactive` program of the same business (the unique is
 *    `(consumer_id, program_id)`), and its balance must not be read against the cost of
 *    the program that replaced it;
 *  - `own_decisions` skips CANCELLED decisions — a #7 that never went out does not use up
 *    the cycle.
 */
const NS = "marketing_balance_push_filters";
const DAY = 86_400_000;
const T0 = new Date("2026-09-16T12:00:00.000Z");
const LONG_AGO = new Date(T0.getTime() - 400 * DAY);
const seeds: Seed[] = [];
const people: string[] = [];

afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
}, 120_000);

/** Sellos, card of 10, one reward, with a live «Te falta poco» (2 stamps, 7 days). */
async function stampsBusiness(label: string) {
  const seed = await seedBusiness({
    name: `${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
    configuration: { target: 10 },
  });
  seeds.push(seed);
  await seedReward({
    programId: seed.programId,
    businessId: seed.business.id,
    pointsCost: null,
  });
  const campaignId = await seedPushCampaign({
    businessId: seed.business.id,
    userId: seed.userId,
    templateKey: "near_reward",
    dormantDays: 7,
    message: "¡Estás a {faltan} de tu premio!",
  });
  return { seed, campaignId };
}

async function member(seed: Seed, programId: string, stamps: number) {
  const consumer = await seedConsumer();
  people.push(consumer.id);
  await seedWebPush(consumer.id);
  const membershipId = await seedMembership({
    consumerId: consumer.id,
    programId,
    businessId: seed.business.id,
    enrolledAt: LONG_AGO,
    stamps,
  });
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

describe.skipIf(!integrationEnabled || !campaignKindEnabled("near_reward"))(
  "marketing tick — balance filters",
  () => {
    it("ORACULO DE R1: a membership of an INACTIVE program of the business is not a candidate", async () => {
      const { seed, campaignId } = await stampsBusiness("Saldo programa viejo");
      const oldProgramId = randomUUID();
      await getDb()
        .insert(loyaltyPrograms)
        .values({
          id: oldProgramId,
          businessId: seed.business.id,
          kind: "stamps",
          configuration: { target: 10 },
          status: "inactive",
          termsMarkdown: "TOS",
          termsHash: "hash",
          createdBy: seed.userId,
          accrualMode: "per_purchase",
          accrualGrant: 1,
          createdAt: LONG_AGO,
        });
      const stale = await member(seed, oldProgramId, 9);
      const live = await member(seed, seed.programId, 8);

      expect(await tick(seed, T0)).toMatchObject({ pushDecided: 1 });
      expect(
        (await readPushes(seed.business.id)).map((p) => [
          p.consumerId,
          p.campaignId,
        ]),
      ).toEqual([[live.consumerId, campaignId]]);
      expect(people).toContain(stale.consumerId);
    }, 120_000);

    it("ORACULO DE R4: a CANCELLED #7 does not use up the cycle", async () => {
      const { seed, campaignId } = await stampsBusiness("Saldo cancelado");
      const who = await member(seed, seed.programId, 8);
      await seedDecision({
        campaignId,
        businessId: seed.business.id,
        consumerId: who.consumerId,
        membershipId: who.membershipId,
        decidedAt: T0,
        cancel: { at: T0, reason: "campaign_inactive" },
      });

      expect(await tick(seed, new Date(T0.getTime() + DAY))).toMatchObject({
        pushDecided: 1,
      });
      expect(await readPushes(seed.business.id)).toHaveLength(2);
    }, 120_000);
  },
);
