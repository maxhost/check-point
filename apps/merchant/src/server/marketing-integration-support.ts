import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import {
  campaignLocations,
  campaignTurns,
  campaigns,
  couponRedemptions,
  locations,
  orders,
  programMemberships,
  walletPasses,
} from "./schema";

/**
 * Seeds for the marketing tick suites (spec 0065 phase A5), kept out of the test files
 * so each stays under the file-size budget. It builds on
 * `counter-integration-support.ts` (business, program, consumer) and adds what only
 * marketing needs: campaigns, doors with real coordinates, memberships with a chosen
 * age, wallet passes and orders.
 */

/** ~150 m apart at this latitude: the pair the 400 m rule has to collapse into one. */
export const NEAR = { latitude: "-2.9000000", longitude: "-79.0000000" };
export const NEAR_TWIN = { latitude: "-2.9013000", longitude: "-79.0000000" };
/** ~11 km away: far enough that the separation rule never fires. */
export const FAR = { latitude: "-3.0000000", longitude: "-79.0000000" };

export async function seedLocation(opts: {
  businessId: string;
  name?: string;
  latitude?: string | null;
  longitude?: string | null;
  status?: "active" | "archived";
}): Promise<string> {
  const [row] = await getDb()
    .insert(locations)
    .values({
      businessId: opts.businessId,
      name: opts.name ?? `Puerta ${randomUUID().slice(0, 8)}`,
      addressLabel: "Calle 1",
      latitude: opts.latitude === undefined ? NEAR.latitude : opts.latitude,
      longitude: opts.longitude === undefined ? NEAR.longitude : opts.longitude,
      countryCode: "EC",
      status: opts.status ?? "active",
      addressSnapshot: {},
    })
    .returning({ id: locations.id });
  return row.id;
}

export async function seedCampaign(opts: {
  businessId: string;
  createdByUserId: string;
  locationIds: string[];
  message?: string;
  name?: string;
  status?: "draft" | "active" | "paused" | "ended" | "archived";
  pauseReason?: "owner" | "plan_downgraded" | "no_active_locations" | null;
  dormantDays?: number;
  startsAt?: Date;
  endsAt?: Date | null;
  coupon?: { label: string; cost: string; maxRedemptions: number } | null;
}): Promise<string> {
  const [row] = await getDb()
    .insert(campaigns)
    .values({
      businessId: opts.businessId,
      kind: "proximity",
      name: opts.name ?? "Vuelvan",
      status: opts.status ?? "active",
      pauseReason: opts.pauseReason ?? null,
      dormantDays: opts.dormantDays ?? 30,
      message: opts.message ?? "2x1 en picadas",
      couponLabel: opts.coupon?.label ?? null,
      couponCost: opts.coupon?.cost ?? null,
      couponMaxRedemptions: opts.coupon?.maxRedemptions ?? null,
      startsAt: opts.startsAt ?? new Date(Date.now() - 86_400_000),
      endsAt: opts.endsAt ?? null,
      createdByUserId: opts.createdByUserId,
    })
    .returning({ id: campaigns.id });
  if (opts.locationIds.length > 0)
    await getDb()
      .insert(campaignLocations)
      .values(
        opts.locationIds.map((locationId) => ({
          campaignId: row.id,
          locationId,
        })),
      );
  return row.id;
}

/** A membership with a chosen age. `enrolledAt` is what makes a consumer «dormido»
 * without inventing an order: the audience rule is `greatest(last order, enrolled)`. */
export async function seedMembership(opts: {
  consumerId: string;
  programId: string;
  businessId: string;
  enrolledAt?: Date;
  originLocationId?: string | null;
  points?: number;
  stamps?: number;
  optedOutAt?: Date | null;
}): Promise<string> {
  const [row] = await getDb()
    .insert(programMemberships)
    .values({
      consumerId: opts.consumerId,
      programId: opts.programId,
      businessId: opts.businessId,
      enrolledAt: opts.enrolledAt ?? new Date(Date.now() - 400 * 86_400_000),
      originLocationId: opts.originLocationId ?? null,
      pointsBalance: opts.points ?? 0,
      stampsCount: opts.stamps ?? 0,
      marketingOptOutAt: opts.optedOutAt ?? null,
    })
    .returning({ id: programMemberships.id });
  return row.id;
}

export async function seedWalletPass(consumerId: string): Promise<void> {
  await getDb()
    .insert(walletPasses)
    .values({
      consumerId,
      provider: "apple",
      serialNumber: `mk-${randomUUID()}`,
      authToken: `tok-${randomUUID()}`,
    });
}

/** An accreditation order, inserted directly: these suites test the tick, not the
 * counter, and `persistGrant` would drag the whole grant path into the seed. */
export async function seedOrder(opts: {
  businessId: string;
  locationId: string | null;
  programId: string;
  membershipId: string;
  consumerId: string;
  userId: string;
  createdAt: Date;
}): Promise<string> {
  const [row] = await getDb()
    .insert(orders)
    .values({
      businessId: opts.businessId,
      locationId: opts.locationId,
      programId: opts.programId,
      membershipId: opts.membershipId,
      consumerId: opts.consumerId,
      mode: "quick",
      total: "10.00",
      currencyCode: "USD",
      accrualKind: "stamps",
      unitsGranted: 1,
      balanceAfter: 1,
      createdByUserId: opts.userId,
      clientRequestId: randomUUID(),
      createdAt: opts.createdAt,
    })
    .returning({ id: orders.id });
  return row.id;
}

/**
 * A `campaign_turn` inserted directly, to put the world in a state a previous run would
 * have left: a `done` turn that burns the cooldown, a `queued` one waiting for step 4,
 * an `active` one whose window is about to close.
 */
export async function seedTurn(opts: {
  campaignId: string;
  businessId: string;
  consumerId: string;
  membershipId: string;
  locationId: string | null;
  status: "queued" | "active" | "done" | "cancelled";
  holdout?: boolean;
  queuedAt?: Date;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  messageSnapshot?: string | null;
  outcome?: "purchase" | "coupon_redeemed" | "none" | null;
}): Promise<string> {
  const [row] = await getDb()
    .insert(campaignTurns)
    .values({
      campaignId: opts.campaignId,
      businessId: opts.businessId,
      consumerId: opts.consumerId,
      membershipId: opts.membershipId,
      locationId: opts.locationId,
      status: opts.status,
      holdout: opts.holdout ?? false,
      queuedAt: opts.queuedAt ?? new Date(),
      windowStart: opts.windowStart ?? null,
      windowEnd: opts.windowEnd ?? null,
      messageSnapshot: opts.messageSnapshot ?? null,
      outcome: opts.outcome ?? null,
    })
    .returning({ id: campaignTurns.id });
  return row.id;
}

/** A coupon handed over at the counter. Phase C owns the route; the tick only needs the
 * ROW to exist to write `outcome = 'coupon_redeemed'`. */
export async function seedCouponRedemption(opts: {
  turnId: string;
  campaignId: string;
  businessId: string;
  consumerId: string;
  membershipId: string;
  locationId: string | null;
  userId: string;
}): Promise<string> {
  const [row] = await getDb()
    .insert(couponRedemptions)
    .values({
      turnId: opts.turnId,
      campaignId: opts.campaignId,
      businessId: opts.businessId,
      consumerId: opts.consumerId,
      membershipId: opts.membershipId,
      locationId: opts.locationId,
      labelSnapshot: "2x1 en picadas",
      costSnapshot: "3.00",
      createdByUserId: opts.userId,
      clientRequestId: randomUUID(),
    })
    .returning({ id: couponRedemptions.id });
  return row.id;
}

/** Archives a door / strips its coordinates: the two states that retire a turn. */
export async function breakLocation(
  locationId: string,
  how: "archive" | "ungeocode",
): Promise<void> {
  await getDb()
    .update(locations)
    .set(
      how === "archive"
        ? { status: "archived" }
        : { latitude: null, longitude: null },
    )
    .where(eq(locations.id, locationId));
}

/** `marketing_opt_out_at`, written here by SQL on purpose: the portal that owns the
 * column is phase D, and the spec declares this is how phase A tests its effect. */
export async function optOut(membershipId: string, at: Date): Promise<void> {
  await getDb()
    .update(programMemberships)
    .set({ marketingOptOutAt: at })
    .where(eq(programMemberships.id, membershipId));
}

/** Moves a campaign to a state the owner (or the billing webhook) would have set. */
export async function setCampaignState(
  campaignId: string,
  status: "draft" | "active" | "paused" | "ended" | "archived",
  pauseReason:
    | "owner"
    | "plan_downgraded"
    | "no_active_locations"
    | null = null,
): Promise<void> {
  await getDb()
    .update(campaigns)
    .set({ status, pauseReason })
    .where(eq(campaigns.id, campaignId));
}
