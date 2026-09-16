import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import {
  dropBusiness,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { campaignTickAudiences, passPlacements } from "./schema";
import {
  seedCampaign,
  seedCouponRedemption,
  seedLocation,
  seedMembership,
  seedTurn,
  seedWalletPass,
} from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";

/**
 * The world of the results suite (spec 0065 phase B2): one business, THREE assigned
 * doors — one of them deliberately with no turns at all — one campaign with a coupon,
 * and seven consumers covering every status and outcome the DTO counts.
 *
 * The turns are seeded directly instead of produced by the tick: this suite is about
 * what the results READ, and running the engine to arrive at a fixture would make a
 * failure ambiguous between «the counts are wrong» and «the tick placed something else».
 */

export type ResultsWorld = {
  businessId: string;
  userId: string;
  campaignId: string;
  doors: { a: string; b: string; c: string };
  consumerIds: string[];
};

const worlds: ResultsWorld[] = [];

export async function seedResultsWorld(): Promise<ResultsWorld> {
  const seed = await seedBusiness({
    name: `Results ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    kind: "stamps",
    mode: "per_purchase",
    grant: 1,
    blockAmount: null,
  });
  const businessId = seed.business.id;
  const doors = {
    a: await seedLocation({ businessId, name: "A Centro" }),
    b: await seedLocation({ businessId, name: "B Norte" }),
    c: await seedLocation({ businessId, name: "C Sin turnos" }),
  };
  const campaignId = await seedCampaign({
    businessId,
    createdByUserId: seed.userId,
    locationIds: [doors.a, doors.b, doors.c],
    coupon: { label: "2x1 en picadas", cost: "3.00", maxRedemptions: 50 },
  });

  // status × holdout × outcome × door, one consumer each. The two `coupon_redeemed`
  // rows carry DIFFERENT cost snapshots on purpose.
  const plan = [
    { status: "done", outcome: "purchase", door: doors.a },
    { status: "done", outcome: "coupon_redeemed", door: doors.a, cost: "3.00" },
    { status: "done", outcome: "none", door: doors.b, holdout: true },
    { status: "active", outcome: null, door: doors.b },
    { status: "cancelled", outcome: null, door: doors.a },
    { status: "done", outcome: "coupon_redeemed", door: doors.b, cost: "4.50" },
    { status: "done", outcome: "none", door: doors.b },
  ] as const;

  const consumerIds: string[] = [];
  for (const row of plan) {
    const consumer = await seedConsumer();
    consumerIds.push(consumer.id);
    await seedWalletPass(consumer.id);
    const membershipId = await seedMembership({
      consumerId: consumer.id,
      programId: seed.programId,
      businessId,
    });
    const turnId = await seedTurn({
      campaignId,
      businessId,
      consumerId: consumer.id,
      membershipId,
      locationId: row.door,
      status: row.status,
      holdout: "holdout" in row ? row.holdout : false,
      outcome: row.outcome,
    });
    if ("cost" in row)
      await seedCouponRedemption({
        turnId,
        campaignId,
        businessId,
        consumerId: consumer.id,
        membershipId,
        locationId: row.door,
        userId: seed.userId,
        costSnapshot: row.cost,
      });
  }

  const world = {
    businessId,
    userId: seed.userId,
    campaignId,
    doors,
    consumerIds,
  };
  worlds.push(world);
  return world;
}

/** Two of the seven carry a door of this business in their pass: `K` of `C`. */
export async function seedPassPlacements(world: ResultsWorld): Promise<void> {
  await getDb()
    .insert(passPlacements)
    .values(
      world.consumerIds.slice(0, 2).map((consumerId) => ({
        consumerId,
        locationId: world.doors.a,
        slotKind: "turn",
        businessId: world.businessId,
        relevantText: "2x1 en picadas",
      })),
    );
}

/** Two photos of the same campaign: the results must read the LATER one. */
export async function seedTickPhotos(campaignId: string): Promise<Date> {
  const older = new Date("2026-09-10T00:00:00.000Z");
  const newer = new Date("2026-09-14T00:00:00.000Z");
  await getDb()
    .insert(campaignTickAudiences)
    .values([
      {
        campaignId,
        ranAt: older,
        total: 1,
        reachable: 1,
        noLocation: 1,
        optOut: 1,
        cooldown: 1,
      },
      {
        campaignId,
        ranAt: newer,
        total: 40,
        reachable: 31,
        noLocation: 4,
        optOut: 2,
        cooldown: 3,
      },
    ]);
  return newer;
}

/** A business id that exists nowhere: the oracle of the `business_id` scope. */
export const FOREIGN_BUSINESS = randomUUID();

export async function dropResultsWorlds(): Promise<void> {
  for (const world of worlds.splice(0)) {
    await dropCampaigns(world.businessId);
    await dropBusiness(world.businessId);
  }
}
