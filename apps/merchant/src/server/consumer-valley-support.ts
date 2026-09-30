import { eq } from "drizzle-orm";
import {
  type CrossWorld,
  crossBusiness,
  offeredBy,
} from "./consumer-cross-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  campaignCoupons,
  campaigns,
  locations,
  valleyWindows,
} from "@mi-pasaporte/db/schema";
import { listCrossOffers } from "./consumer/cross-offers";
import { claimValleyOffer } from "./consumer/valley-offers";
import type { GeoPoint } from "./marketing/cross-rules";
import { type ValleyWindow, localClock } from "./marketing/valley-rules";

/**
 * The world of «Horas valle» (spec 0113) against a real base, on top of the cross offer's
 * (`consumer-cross-support.ts`): a business in Buenos Aires (UTC-3, no DST) whose location
 * has valley windows, and its valley campaign. EVERY clock is injected — `at("16:59")` is
 * Tuesday 2026-10-06 on the business's wall clock — and the domain is called with it
 * (`listCrossOffers` / `claimValleyOffer`), never the real hour: the route passes
 * `new Date()`, and its wiring is pinned by `cross-offers-routes.test.ts`.
 */

export const BA = "America/Argentina/Buenos_Aires";

/** Tuesday 2026-10-06 at `hh:mm` in Buenos Aires. */
export const at = (hhmm: string) => new Date(`2026-10-06T${hhmm}:00-03:00`);

/** The ISO weekday of `at(...)` in the business's zone (Tuesday = 2), read, not assumed. */
export const TUESDAY = localClock(at("12:00"), BA).weekday;

export async function valleyBusiness(
  label: string,
  categoryGcid: string,
  point: GeoPoint,
): Promise<CrossWorld> {
  const world = await crossBusiness(label, categoryGcid, point);
  await getDb()
    .update(businesses)
    .set({ timezone: BA })
    .where(eq(businesses.id, world.seed.business.id));
  return world;
}

/** A second ACTIVE, geocoded location of the same business, at `point`. */
export async function secondLocation(
  world: CrossWorld,
  point: GeoPoint,
): Promise<string> {
  const [row] = await getDb()
    .insert(locations)
    .values({
      businessId: world.seed.business.id,
      name: "Sede Norte",
      addressLabel: "Calle 2",
      countryCode: "EC",
      addressSnapshot: {},
      latitude: point.latitude.toFixed(7),
      longitude: point.longitude.toFixed(7),
    })
    .returning({ id: locations.id });
  return row.id;
}

/** A valley campaign — by default `active` with a FREE-TEXT reward (`custom`). */
export async function valleyCampaign(
  world: CrossWorld,
  over: { monthlyCap?: number; dormantDays?: number; status?: string } = {},
): Promise<string> {
  const [row] = await getDb()
    .insert(campaigns)
    .values({
      businessId: world.seed.business.id,
      kind: "proximity",
      templateKey: "valley",
      channelProximity: false,
      channelPush: false,
      name: "Horas valle",
      status: over.status ?? "active",
      activatedAt: new Date("2026-01-01T00:00:00.000Z"),
      message: "Ahora hay lugar: te esperamos con un regalo",
      couponLabel: "2x1 en cerveza",
      couponCost: "3.00",
      couponKind: "custom",
      dormantDays: over.dormantDays ?? 30,
      valleyMonthlyCap: over.monthlyCap ?? 50,
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      createdByUserId: world.seed.userId,
    })
    .returning({ id: campaigns.id });
  return row.id;
}

export async function setWindows(
  locationId: string,
  windows: ValleyWindow[],
  source: "network" | "merchant" = "merchant",
): Promise<void> {
  await getDb()
    .insert(valleyWindows)
    .values(windows.map((window) => ({ locationId, source, ...window })));
}

/** C1 through the domain, with the INJECTED clock. */
export async function valleyOffersOf(
  consumerId: string,
  gps: GeoPoint | null,
  now: Date,
) {
  return await listCrossOffers(consumerId, gps, now);
}

/** The business ids of the offers of THESE worlds (the base has others). */
export const listedBy = offeredBy;

/** C2 of a valley offer through the domain, with the INJECTED clock. */
export async function claimValley(
  consumerId: string,
  campaignId: string,
  locationId: string,
  gps: GeoPoint | null,
  now: Date,
) {
  return await claimValleyOffer(consumerId, campaignId, locationId, gps, now);
}

export async function readValleyCoupons(campaignId: string) {
  return await getDb()
    .select({
      id: campaignCoupons.id,
      consumerId: campaignCoupons.consumerId,
      membershipId: campaignCoupons.membershipId,
      crossClaimedAt: campaignCoupons.crossClaimedAt,
      valleyLocationId: campaignCoupons.valleyLocationId,
      validFrom: campaignCoupons.validFrom,
      validUntil: campaignCoupons.validUntil,
      kind: campaignCoupons.kindSnapshot,
      label: campaignCoupons.labelSnapshot,
    })
    .from(campaignCoupons)
    .where(eq(campaignCoupons.campaignId, campaignId));
}
