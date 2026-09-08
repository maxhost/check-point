import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  type Seed,
  dropBusiness,
  seedBusiness,
  seedConsumer,
  seedReward,
  setBalance,
} from "./counter-integration-support";
import { getDb } from "./db";
import { rewardRedemptions, walletPushQueue } from "./schema";
import { resolveScan } from "./counter/resolve";

/**
 * Shared world + readers for the spec 0055 redemption integration tests. Split out of
 * the test files only to keep each of them under the file-size budget (same role as
 * `counter-integration-support.ts`); it has no consumer outside the tests.
 */

export const COST = 30;
export const TARGET = 10;
export const DISPENSED_COST = 100;

export type RedeemWorld = {
  /** Puntos, `redeem_allow_insufficient = false`, one reward of {@link COST}. */
  points: Seed;
  /** Sellos, `configuration.target` = {@link TARGET}, one reward without cost. */
  stamps: Seed;
  /** Puntos with the dispensation ON, one reward of {@link DISPENSED_COST}. */
  dispensing: Seed;
  /** Sellos with the dispensation ON — the owner's other §9 example (9 of 10 → 0). */
  dispensingStamps: Seed;
  pointsReward: string;
  stampsReward: string;
  dispensingReward: string;
  dispensingStampsReward: string;
};

export async function seedRedeemWorld(prefix: string): Promise<RedeemWorld> {
  const points = await seedBusiness({
    name: `${prefix} Puntos`,
    kind: "points",
    mode: "per_amount",
    grant: 10,
    blockAmount: "3.00",
    configuration: { unitSingular: "punto", unitPlural: "puntos" },
  });
  const stamps = await seedBusiness({
    name: `${prefix} Sellos`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
    configuration: { unitName: "sellos", target: TARGET },
  });
  const dispensing = await seedBusiness({
    name: `${prefix} Dispensa`,
    kind: "points",
    mode: "per_amount",
    grant: 10,
    blockAmount: "3.00",
    configuration: { unitSingular: "punto", unitPlural: "puntos" },
    redeemAllowInsufficient: true,
  });
  const dispensingStamps = await seedBusiness({
    name: `${prefix} Dispensa Sellos`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
    configuration: { unitName: "sellos", target: TARGET },
    redeemAllowInsufficient: true,
  });
  return {
    points,
    stamps,
    dispensing,
    dispensingStamps,
    pointsReward: await seedReward({
      programId: points.programId,
      businessId: points.business.id,
      label: "Café gratis",
      pointsCost: COST,
    }),
    stampsReward: await seedReward({
      programId: stamps.programId,
      businessId: stamps.business.id,
      label: "Cerveza",
      pointsCost: null,
    }),
    dispensingReward: await seedReward({
      programId: dispensing.programId,
      businessId: dispensing.business.id,
      label: "Premio grande",
      pointsCost: DISPENSED_COST,
    }),
    dispensingStampsReward: await seedReward({
      programId: dispensingStamps.programId,
      businessId: dispensingStamps.business.id,
      label: "Tarjeta llena",
      pointsCost: null,
    }),
  };
}

export async function dropRedeemWorld(world: RedeemWorld): Promise<void> {
  await dropBusiness(world.points.business.id);
  await dropBusiness(world.stamps.business.id);
  await dropBusiness(world.dispensing.business.id);
  await dropBusiness(world.dispensingStamps.business.id);
}

export type Card = { consumerId: string; membershipId: string };

/** A brand-new consumer auto-enrolled in the seed's program, at a forced balance. */
export async function newCard(
  seed: Seed,
  balance: { points?: number; stamps?: number },
): Promise<Card> {
  const consumer = await seedConsumer();
  const resolved = await resolveScan(seed.business, consumer.qrToken);
  await setBalance(resolved.membership.id, balance);
  return { consumerId: consumer.id, membershipId: resolved.membership.id };
}

export function redeemBody(
  card: Card,
  rewardId: string,
  seed: Seed,
  key?: string,
) {
  return {
    clientRequestId: key ?? randomUUID(),
    membershipId: card.membershipId,
    rewardId,
    locationId: seed.locationId,
  };
}

/** The FULL log rows for one idempotency key — the oracle of every redemption test.
 * The API response is never the oracle (ADR 0054 §4). */
export async function readLog(businessId: string, clientRequestId: string) {
  return getDb()
    .select()
    .from(rewardRedemptions)
    .where(
      and(
        eq(rewardRedemptions.businessId, businessId),
        eq(rewardRedemptions.clientRequestId, clientRequestId),
      ),
    );
}

/** Every log row of one card, whatever the key (the N-concurrent-keys cases). */
export async function readLogByMembership(membershipId: string) {
  return getDb()
    .select()
    .from(rewardRedemptions)
    .where(eq(rewardRedemptions.membershipId, membershipId));
}

export async function readPushes(consumerId: string) {
  return getDb()
    .select({ id: walletPushQueue.id, body: walletPushQueue.body })
    .from(walletPushQueue)
    .where(eq(walletPushQueue.consumerId, consumerId));
}

export const sleep = (ms: number) =>
  new Promise((done) => setTimeout(done, ms));
