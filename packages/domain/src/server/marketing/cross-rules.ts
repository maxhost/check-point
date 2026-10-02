import { dormantSince } from "./audience";
import type { TemplateDefinition } from "./templates";
import { capAllows } from "./welcome-rules";

/**
 * THE PURE RULES OF «OFERTA CRUZADA» (spec 0112 / ADR 0104). The database half lives in
 * `cross-store.ts` and `consumer/cross-offers.ts`; everything that DECIDES lives here, so
 * every reason has a table of cases as its oracle (`cross-rules.test.ts`).
 *
 * The filter —another rubro, ≤ 2 km— applies ONLY to the cross offer (ADR 0104 §1): the
 * consumer's own coupons are never filtered. Distances are haversine over a 6 371 km sphere,
 * computed HERE over the rows the store brings (the store only narrows by what does not
 * depend on the consumer).
 */

/**
 * `not_active` (spec 0113 / ADR 0105) is INTERNAL: «Horas valle»'s fixed audience — not a
 * member, or a dormant one. No cross campaign can be enabled with it (`cross-input.ts`
 * checks against `CROSS_TEMPLATE`'s options) and `core_campaign_cross_audience_check`
 * does not admit it.
 */
export type CrossAudience = "non_members" | "dormant" | "any" | "not_active";

/** «Oferta cruzada»'s parameters (spec 0112): audience, validity from the claim, cap. */
export type CrossDefinition = {
  audience: { options: readonly CrossAudience[]; default: CrossAudience };
  validDays: { options: readonly number[]; default: number };
  monthlyCap: { min: number; max: number; default: number };
};

/**
 * The catalog entry (`templates.ts` lists it LAST). It lives here only for the size budget
 * of `templates.ts`. The cap and validity are «Bienvenida»'s (orchestrator's O2); the audience
 * options are the owner's (ADR 0104: no clientes / dormidos / cualquiera).
 */
export const CROSS_TEMPLATE: TemplateDefinition = {
  key: "cross",
  title: "Oferta cruzada",
  description:
    "Regala un premio a clientes de otros comercios cercanos, para que te descubran.",
  channels: [],
  group: "cross",
  rank: 1,
  dormantDays: { options: [30, 60, 90], default: 30 },
  message: {
    default: "Te esperamos con un regalo",
    maxLength: 60,
    gapMarker: false,
  },
  couponRecommended: true,
  couponAllowed: true,
  couponRequired: true,
  nearReward: null,
  repeat: null,
  atRisk: null,
  welcome: null,
  cross: {
    audience: {
      options: ["non_members", "dormant", "any"],
      default: "non_members",
    },
    validDays: { options: [7, 15, 30], default: 15 },
    monthlyCap: { min: 1, max: 10000, default: 50 },
  },
  valley: null,
};

/** ADR 0103: the radius of the network. At most this far from the origin point. */
export const CROSS_RADIUS_METERS = 2000;
/** O3: «parado en un local» = at most this far from an active, geocoded location. */
export const STANDING_METERS = 100;
const EARTH_RADIUS_METERS = 6_371_000;
const DAY_MS = 86_400_000;

export type GeoPoint = { latitude: number; longitude: number };

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in meters (haversine, R = 6 371 000 m). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The closest of `points` to `origin`, or `null` when there is none. */
export function nearestPoint<T extends GeoPoint>(
  origin: GeoPoint,
  points: readonly T[],
): { point: T; meters: number } | null {
  let best: { point: T; meters: number } | null = null;
  for (const point of points) {
    const meters = haversineMeters(origin, point);
    if (best === null || meters < best.meters) best = { point, meters };
  }
  return best;
}

/** Where the consumer is, as far as the offer is concerned (O4, O5). */
export type ConsumerPosition = {
  /** The phone's GPS of THIS request (never stored), or `null`. */
  gps: GeoPoint | null;
  /** O5: the rubro of the business of the consumer's most recent event, or `null`. */
  lastScanCategory: string | null;
  /** O5: the geocoded location of the most recent event that has one, or `null`. */
  lastScanPoint: GeoPoint | null;
  /** Active, geocoded locations with their business's rubro: where they may be standing. */
  places: readonly (GeoPoint & { categoryGcid: string })[];
};

export type CrossOrigin = "gps" | "last_scan" | "none";

/** The origin of the distance: the GPS, else the last scanned location, else none. */
export function crossOrigin(position: ConsumerPosition): {
  kind: CrossOrigin;
  point: GeoPoint | null;
} {
  if (position.gps) return { kind: "gps", point: position.gps };
  if (position.lastScanPoint)
    return { kind: "last_scan", point: position.lastScanPoint };
  return { kind: "none", point: null };
}

/** The consumer's membership facts in the OFFERING business, or `null` if not a member. */
export type CrossMembership = {
  enrolledAt: Date;
  /** `max(order.created_at)` in that business, `null` when they never bought. */
  lastOrderAt: Date | null;
  /** O7: they turned that business's promotions off. */
  optedOut: boolean;
};

export type CrossOfferFacts = {
  now: Date;
  position: ConsumerPosition;
  offer: {
    categoryGcid: string;
    audience: CrossAudience;
    dormantDays: number;
    monthlyCap: number;
    /** The offering business's ACTIVE locations WITH coordinates. */
    locations: readonly GeoPoint[];
  };
  membership: CrossMembership | null;
  /** O8: they already have a coupon of this campaign. */
  claimed: boolean;
  /** Coupons of this campaign created since the business's local month start. */
  claimedThisMonth: number;
};

export type CrossRefusal =
  | "no_origin"
  | "same_category"
  | "too_far"
  | "audience"
  | "opt_out"
  | "claimed"
  | "cap_reached";

export type CrossDecision =
  { ok: true; distanceMeters: number } | { ok: false; reason: CrossRefusal };

/**
 * Whether the audience of the campaign includes this consumer (spec 0112, reason 4).
 * `not_active` (spec 0113): the non-member is in; a member only when dormant, like
 * `dormant` — the ACTIVE member never.
 */
function inAudience(facts: CrossOfferFacts): boolean {
  const { audience, dormantDays } = facts.offer;
  if (audience === "any") return true;
  if (audience === "non_members") return facts.membership === null;
  if (audience === "not_active" && facts.membership === null) return true;
  if (facts.membership === null) return false;
  const floor = new Date(facts.now.getTime() - dormantDays * DAY_MS);
  return dormantSince(facts.membership) <= floor;
}

/**
 * Spec 0112 «Elegibilidad», in THIS order — the reason is the first one that applies:
 * no origin → same rubro (the last scanned business's, or —only with GPS— the one of a
 * location within 100 m) → farther than 2 km (or no geocoded location) → audience → opt-out
 * → already claimed → monthly cap.
 */
export function decideCrossOffer(facts: CrossOfferFacts): CrossDecision {
  const origin = crossOrigin(facts.position);
  if (origin.point === null) return { ok: false, reason: "no_origin" };
  const category = facts.offer.categoryGcid;
  if (facts.position.lastScanCategory === category)
    return { ok: false, reason: "same_category" };
  const gps = facts.position.gps;
  if (
    gps &&
    facts.position.places.some(
      (place) =>
        place.categoryGcid === category &&
        haversineMeters(gps, place) <= STANDING_METERS,
    )
  )
    return { ok: false, reason: "same_category" };
  const nearest = nearestPoint(origin.point, facts.offer.locations);
  if (nearest === null || nearest.meters > CROSS_RADIUS_METERS)
    return { ok: false, reason: "too_far" };
  if (!inAudience(facts)) return { ok: false, reason: "audience" };
  if (facts.membership?.optedOut) return { ok: false, reason: "opt_out" };
  if (facts.claimed) return { ok: false, reason: "claimed" };
  if (!capAllows(facts.claimedThisMonth, facts.offer.monthlyCap))
    return { ok: false, reason: "cap_reached" };
  return { ok: true, distanceMeters: nearest.meters };
}
