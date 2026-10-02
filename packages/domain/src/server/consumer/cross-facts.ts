import { sql } from "drizzle-orm";
import type {
  ConsumerPosition,
  CrossMembership,
  GeoPoint,
} from "../marketing/cross-rules";
import {
  type CrossCampaign,
  type CrossLocation,
  type Db,
  rowsOf,
} from "../marketing/cross-store";
import { requireDate, toDate } from "../marketing/driver-values";
import type { CouponKind, DiscountUnit } from "../marketing/reward-input";

/**
 * THE CONSUMER'S FACTS for «Oferta cruzada» (spec 0136): where they are, their memberships
 * and the cross coupons they already claimed. Read for ONE consumer —the session's— and
 * decided by `decideCrossOffer` (`marketing/cross-rules.ts`) — and `parseGeo`, the GPS of
 * the request (O4: never stored). Apart from `marketing/cross-store.ts` (the campaign's
 * side) and `cross-offers.ts` only for the size budget — as is the offer's DTO, shared by
 * the cross offers and the valley ones (spec 0113, `valley-offers.ts`).
 */

/**
 * One offer of C1. Allow-list: no cost, no cap, no membership id, no R2 key. Spec 0113
 * adds `type`; a `"valley"` one also carries `locationId` and `window` (`valley-offers.ts`)
 * and `validDays: null` — its coupon lives until `window.endsAt`, not for days.
 */
export type CrossOffer = {
  type: "cross";
  campaignId: string;
  businessId: string;
  businessName: string;
  logoPath: string | null;
  message: string;
  label: string;
  kind: CouponKind;
  rule: string | null;
  discountUnit: DiscountUnit | null;
  discountValue: string | null;
  currencyCode: string;
  extraUnits: number | null;
  validDays: number;
  distanceMeters: number;
  nearestLocation: { name: string; addressLabel: string };
};

export function toOffer(
  campaign: CrossCampaign,
  nearest: CrossLocation,
  meters: number,
): CrossOffer {
  const { reward } = campaign;
  return {
    type: "cross",
    campaignId: campaign.id,
    businessId: campaign.businessId,
    businessName: campaign.businessName,
    logoPath: campaign.logoPath,
    message: campaign.message,
    label: campaign.couponLabel,
    kind: reward.kind ?? "free_product",
    rule: reward.rule,
    discountUnit: reward.discountUnit,
    discountValue: reward.discountValue,
    currencyCode: reward.currencyCode,
    extraUnits: reward.extraUnits,
    validDays: campaign.validDays,
    distanceMeters: Math.round(meters),
    nearestLocation: { name: nearest.name, addressLabel: nearest.addressLabel },
  };
}

const EVENTS = (consumerId: string) => sql`(
  select o.business_id, o.location_id, o.created_at from core."order" o
   where o.consumer_id = ${consumerId}
  union all
  select r.business_id, r.location_id, r.created_at from core.reward_redemption r
   where r.consumer_id = ${consumerId}
  union all
  select k.business_id, k.location_id, k.created_at from core.coupon_redemption k
   where k.consumer_id = ${consumerId})`;

/**
 * O4/O5: where the consumer is. The rubro of the business of their MOST RECENT event
 * (order, reward redemption or coupon redemption — with or without a location), the
 * geocoded location of the most recent event that HAS one, and —only with GPS— every
 * active geocoded location with its rubro, to know where they are standing.
 */
export async function loadConsumerPosition(
  db: Db,
  consumerId: string,
  gps: GeoPoint | null,
): Promise<ConsumerPosition> {
  const [last] = rowsOf<{ category_gcid: string }>(
    await db.execute(sql`
      select b.category_gcid from ${EVENTS(consumerId)} e
      join core.business b on b.id = e.business_id
      order by e.created_at desc limit 1`),
  );
  const [point] = rowsOf<{ latitude: unknown; longitude: unknown }>(
    await db.execute(sql`
      select l.latitude, l.longitude from ${EVENTS(consumerId)} e
      join core.location l on l.id = e.location_id
      where l.latitude is not null and l.longitude is not null
      order by e.created_at desc limit 1`),
  );
  const places = gps
    ? rowsOf<Record<string, unknown>>(
        await db.execute(sql`
          select l.latitude, l.longitude, b.category_gcid
          from core.location l join core.business b on b.id = l.business_id
          where l.status = 'active'
            and l.latitude is not null and l.longitude is not null`),
      ).map((row) => ({
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        categoryGcid: String(row.category_gcid),
      }))
    : [];
  return {
    gps,
    lastScanCategory: last ? String(last.category_gcid) : null,
    lastScanPoint: point
      ? { latitude: Number(point.latitude), longitude: Number(point.longitude) }
      : null,
    places,
  };
}

export type CrossMembershipRow = CrossMembership & { membershipId: string };

/**
 * The consumer's membership facts PER BUSINESS: the latest enrolment (its id is the one a
 * claimed coupon carries), opted out if any membership there is, and their last order in
 * that business (`dormantSince` of `audience.ts`).
 */
export async function loadCrossMemberships(
  db: Db,
  consumerId: string,
): Promise<Map<string, CrossMembershipRow>> {
  const result = await db.execute(sql`
    select m.business_id,
      (array_agg(m.id order by m.enrolled_at desc, m.id))[1] as membership_id,
      max(m.enrolled_at) as enrolled_at,
      bool_or(m.marketing_opt_out_at is not null) as opted_out,
      (select max(o.created_at) from core."order" o
        where o.consumer_id = ${consumerId} and o.business_id = m.business_id)
        as last_order_at
    from consumer.program_membership m
    where m.consumer_id = ${consumerId}
    group by m.business_id`);
  return new Map(
    rowsOf<Record<string, unknown>>(result).map((row) => [
      String(row.business_id),
      {
        membershipId: String(row.membership_id),
        enrolledAt: requireDate(row.enrolled_at),
        lastOrderAt: toDate(row.last_order_at),
        optedOut: row.opted_out === true,
      },
    ]),
  );
}

/** O8: the cross coupons this consumer already has, by campaign id → coupon id. */
export async function loadClaimedCrossCoupons(
  db: Db,
  consumerId: string,
  campaignId?: string,
): Promise<Map<string, string>> {
  const result = await db.execute(sql`
    select cc.campaign_id, cc.id from core.campaign_coupon cc
    where cc.consumer_id = ${consumerId} and cc.cross_claimed_at is not null
      ${campaignId ? sql`and cc.campaign_id = ${campaignId}` : sql``}`);
  return new Map(
    rowsOf<{ campaign_id: string; id: string }>(result).map((row) => [
      String(row.campaign_id),
      String(row.id),
    ]),
  );
}

export type GeoParse =
  | { ok: true; gps: GeoPoint | null }
  | { ok: false; fields: Record<string, string> };

const LABELS = { lat: "La latitud", lng: "La longitud" } as const;

function coordinate(raw: unknown): number | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string")
    return raw.trim() === "" ? null : Number(raw.trim());
  return undefined;
}

/** `lat`/`lng`: both or neither; finite, in [-90, 90] / [-180, 180] (contract C1). */
export function parseGeo(rawLat: unknown, rawLng: unknown): GeoParse {
  const fields: Record<string, string> = {};
  const values = { lat: coordinate(rawLat), lng: coordinate(rawLng) };
  const limits = { lat: 90, lng: 180 } as const;
  for (const key of ["lat", "lng"] as const) {
    const value = values[key];
    if (value === null) continue;
    if (
      value === undefined ||
      !Number.isFinite(value) ||
      Math.abs(value) > limits[key]
    )
      fields[key] =
        `${LABELS[key]} tiene que ser un número entre -${limits[key]} y ${limits[key]}.`;
  }
  if (
    Object.keys(fields).length === 0 &&
    (values.lat === null) !== (values.lng === null)
  ) {
    const missing = values.lat === null ? "lat" : "lng";
    fields[missing] =
      `Falta ${LABELS[missing].toLowerCase()}: mandá lat y lng juntos.`;
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  if (values.lat === null || values.lng === null)
    return { ok: true, gps: null };
  return {
    ok: true,
    gps: { latitude: values.lat as number, longitude: values.lng as number },
  };
}
