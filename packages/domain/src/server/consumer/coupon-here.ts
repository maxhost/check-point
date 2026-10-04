import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { type GeoPoint, haversineMeters } from "../marketing/cross-rules";

/**
 * «ACA» — WHERE THE CONSUMER IS, for the coupon list of the PWA (spec 0148 / ADR 0119 §2).
 * The list puts the `valid` coupons of this business first; nothing is filtered out.
 *
 *  1. With GPS: the closest ACTIVE, geocoded location of ANY business within
 *     {@link HERE_RADIUS_METERS} (haversine, the same as the cross offers).
 *  2. Without GPS, or nothing that close: the business whose counter scanned the consumer
 *     last (`core.business_customer.last_scan_at`, written by `counter/resolve.ts`). No age
 *     limit: it only orders.
 *  3. Neither → `null`.
 *
 * The GPS travels per request and is never stored.
 */

export const HERE_RADIUS_METERS = 200;

export type CouponHere = {
  businessId: string;
  businessName: string;
  source: "gps" | "last_scan";
};

/** ~1.1 km of latitude: a coarse box so the read never scans every location of the network;
 * the radius itself is decided by the haversine below, never by this box. */
const BOX_DEGREES = 0.01;

type PlaceRow = {
  business_id: string;
  business_name: string;
  latitude: unknown;
  longitude: unknown;
};

async function nearestBusiness(gps: GeoPoint): Promise<CouponHere | null> {
  const lngBox =
    BOX_DEGREES / Math.max(0.01, Math.cos((gps.latitude * Math.PI) / 180));
  const result = await getDb().execute<PlaceRow>(sql`
    select l.business_id, b.name as business_name, l.latitude, l.longitude
    from core.location l
    join core.business b on b.id = l.business_id
    where l.status = 'active'
      and l.latitude is not null and l.longitude is not null
      and l.latitude between ${gps.latitude - BOX_DEGREES} and ${gps.latitude + BOX_DEGREES}
      and l.longitude between ${gps.longitude - lngBox} and ${gps.longitude + lngBox}
  `);
  let best: { row: PlaceRow; meters: number } | null = null;
  for (const row of result.rows) {
    const meters = haversineMeters(gps, {
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    });
    if (meters <= HERE_RADIUS_METERS && (best === null || meters < best.meters))
      best = { row, meters };
  }
  return best
    ? {
        businessId: best.row.business_id,
        businessName: best.row.business_name,
        source: "gps",
      }
    : null;
}

async function lastScannedBusiness(
  consumerId: string,
): Promise<CouponHere | null> {
  const result = await getDb().execute<{
    business_id: string;
    business_name: string;
  }>(sql`
    select bc.business_id, b.name as business_name
    from core.business_customer bc
    join core.business b on b.id = bc.business_id
    where bc.consumer_id = ${consumerId} and bc.last_scan_at is not null
    order by bc.last_scan_at desc, bc.business_id
    limit 1
  `);
  const [row] = result.rows;
  return row
    ? {
        businessId: row.business_id,
        businessName: row.business_name,
        source: "last_scan",
      }
    : null;
}

export async function resolveCouponHere(
  consumerId: string,
  gps: GeoPoint | null,
): Promise<CouponHere | null> {
  const near = gps ? await nearestBusiness(gps) : null;
  return near ?? (await lastScannedBusiness(consumerId));
}
