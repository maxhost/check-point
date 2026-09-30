import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import {
  type Seed,
  dropBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { seedLocationsBusiness } from "./locations-integration-support";
import { seedMembership, seedOrder } from "./marketing-integration-support";
import { dropCampaigns } from "./marketing-read-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  campaignCoupons,
  campaigns,
  locations,
} from "@mi-pasaporte/db/schema";
import { SESSION_COOKIE } from "./consumer/core";
import { issueSession } from "./consumer/session";
import { type GeoPoint, haversineMeters } from "./marketing/cross-rules";
import type { CrossAudience } from "./marketing/cross-rules";
import { GET } from "../app/api/public/consumer/cross-offers/route";
import { POST } from "../app/api/public/consumer/cross-offers/[campaignId]/claim/route";

/**
 * The world of «Oferta cruzada» (spec 0112) against a real base: `plus` businesses with a
 * LIVE subscription (the plan gate), each with ONE active location placed on REAL CABA
 * coordinates, a rubro of its own and —when the case needs it— its cross campaign. The
 * distances are built with the SAME haversine the code uses (moving north along a
 * meridian, where the arc is exact) and asserted with it, never written by hand.
 *
 * The rubros carry a per-case suffix (`category(tag)`): the «standing at» rule reads EVERY
 * active location of the base, so a case must not collide with another case's (or a
 * previous run's) businesses of the «same» rubro.
 */

const R = 6_371_000;
/** Plaza de Mayo, CABA. */
export const CABA: GeoPoint = { latitude: -34.6083, longitude: -58.3712 };
export const DAY = 86_400_000;

export const north = (from: GeoPoint, meters: number): GeoPoint => ({
  latitude: from.latitude + ((meters / R) * 180) / Math.PI,
  longitude: from.longitude,
});

/** Another base in CABA per case (~1.1 km of longitude apart), so cases do not overlap. */
export const base = (index: number): GeoPoint => ({
  latitude: CABA.latitude - 0.01 * index,
  longitude: CABA.longitude - 0.012 * index,
});

export const distance = haversineMeters;

export function category(tag: string): (name: string) => string {
  const run = randomUUID().slice(0, 8);
  return (name) => `gcid:${name}-${tag}-${run}`;
}

const worlds: string[] = [];

export type CrossWorld = { seed: Seed; categoryGcid: string; point: GeoPoint };

/** A business of `categoryGcid` whose only (active) location stands at `point`. */
export async function crossBusiness(
  label: string,
  categoryGcid: string,
  point: GeoPoint,
): Promise<CrossWorld> {
  const live = randomUUID().slice(0, 8);
  const seed = await seedLocationsBusiness(`${label} ${Date.now()}`, "plus", {
    interval: "month",
    stripeCustomerId: `cus_${live}`,
    stripeSubscriptionId: `sub_${live}`,
  });
  worlds.push(seed.business.id);
  await getDb()
    .update(businesses)
    .set({ categoryGcid })
    .where(eq(businesses.id, seed.business.id));
  await getDb()
    .update(locations)
    .set({
      latitude: point.latitude.toFixed(7),
      longitude: point.longitude.toFixed(7),
    })
    .where(eq(locations.id, seed.locationId));
  return { seed, categoryGcid, point };
}

export async function crossCampaign(
  world: CrossWorld,
  over: {
    audience?: CrossAudience;
    dormantDays?: number;
    validDays?: number;
    monthlyCap?: number;
  } = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(campaigns)
    .values({
      businessId: world.seed.business.id,
      kind: "proximity",
      templateKey: "cross",
      channelProximity: false,
      channelPush: false,
      name: "Oferta cruzada",
      status: "active",
      activatedAt: new Date("2026-01-01T00:00:00.000Z"),
      message: "Te esperamos con un regalo",
      couponLabel: "10% en tu primera clase",
      couponCost: "2.00",
      couponKind: "discount",
      couponDiscountUnit: "percent",
      couponDiscountValue: "10.00",
      dormantDays: over.dormantDays ?? 30,
      crossAudience: over.audience ?? "non_members",
      crossValidDays: over.validDays ?? 15,
      crossMonthlyCap: over.monthlyCap ?? 50,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      createdByUserId: world.seed.userId,
    })
    .returning({ id: campaigns.id });
  return row.id;
}

/** A consumer, optionally a member of `world` (enrolled 400 days ago by default). */
export async function crossConsumer(): Promise<{
  id: string;
  qrToken: string;
}> {
  return await seedConsumer();
}

export async function memberOf(
  world: CrossWorld,
  consumerId: string,
  opts: { enrolledAt?: Date; optedOutAt?: Date | null } = {},
): Promise<string> {
  return await seedMembership({
    consumerId,
    programId: world.seed.programId,
    businessId: world.seed.business.id,
    enrolledAt: opts.enrolledAt,
    optedOutAt: opts.optedOutAt,
  });
}

/** A «scan» at `world` (an order at its location) at `at`, enrolling if needed. */
export async function scanAt(
  world: CrossWorld,
  consumerId: string,
  at: Date,
  membershipId?: string,
): Promise<void> {
  await seedOrder({
    businessId: world.seed.business.id,
    locationId: world.seed.locationId,
    programId: world.seed.programId,
    membershipId: membershipId ?? (await memberOf(world, consumerId)),
    consumerId,
    userId: world.seed.userId,
    createdAt: at,
  });
}

const cookie = async (consumerId: string) => ({
  cookie: `${SESSION_COOKIE}=${await issueSession(consumerId)}`,
});

export type OfferBody = {
  origin: string;
  offers: Record<string, unknown>[];
};

/** C1 through the REAL route with a real session. */
export async function offersOf(
  consumerId: string,
  gps?: GeoPoint,
): Promise<OfferBody> {
  const query = gps ? `?lat=${gps.latitude}&lng=${gps.longitude}` : "";
  const response = await GET(
    new NextRequest(
      `https://mp.test/api/public/consumer/cross-offers${query}`,
      {
        headers: await cookie(consumerId),
      },
    ),
  );
  if (response.status !== 200)
    throw new Error(`C1 respondio ${response.status}`);
  return (await response.json()) as OfferBody;
}

/** The ids of the offers of THESE businesses (the base has other worlds too). */
export function offeredBy(body: OfferBody, ...worldsIn: CrossWorld[]) {
  const ids = new Set(worldsIn.map((w) => w.seed.business.id));
  return body.offers
    .filter((offer) => ids.has(String(offer.businessId)))
    .map((offer) => String(offer.businessId));
}

/** C2 through the REAL route with a real session. */
export async function claim(
  consumerId: string,
  campaignId: string,
  gps?: GeoPoint,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await POST(
    new NextRequest(
      `https://mp.test/api/public/consumer/cross-offers/${campaignId}/claim`,
      {
        method: "POST",
        headers: await cookie(consumerId),
        body: JSON.stringify(
          gps ? { lat: gps.latitude, lng: gps.longitude } : {},
        ),
      },
    ),
    { params: Promise.resolve({ campaignId }) },
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

export async function readCrossCoupons(campaignId: string) {
  return await getDb()
    .select({
      id: campaignCoupons.id,
      consumerId: campaignCoupons.consumerId,
      membershipId: campaignCoupons.membershipId,
      crossClaimedAt: campaignCoupons.crossClaimedAt,
      welcomeMembershipId: campaignCoupons.welcomeMembershipId,
      validFrom: campaignCoupons.validFrom,
      validUntil: campaignCoupons.validUntil,
      createdAt: campaignCoupons.createdAt,
      label: campaignCoupons.labelSnapshot,
      cost: campaignCoupons.costSnapshot,
      kind: campaignCoupons.kindSnapshot,
      discountValue: campaignCoupons.discountValueSnapshot,
    })
    .from(campaignCoupons)
    .where(eq(campaignCoupons.campaignId, campaignId));
}

export async function dropCrossWorlds(): Promise<void> {
  for (const businessId of worlds.splice(0)) {
    await dropCampaigns(businessId);
    await dropBusiness(businessId);
  }
}
