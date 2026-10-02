import type {
  ConsumerPosition,
  CrossOfferFacts,
  GeoPoint,
} from "@mi-pasaporte/domain/server/marketing/cross-rules";

/**
 * The fixtures of the PURE rules' suites (`cross-rules*.test.ts`, spec 0136): a consumer at
 * Plaza de Mayo with GPS, last scanned in a café, and a gym's offer 640 m north. Points are
 * built by moving NORTH along a meridian, where haversine is exactly the arc (`meters / R`
 * radians): no hand-written distances. Apart only for the size budget.
 */

const R = 6_371_000;
/** Plaza de Mayo, CABA. */
export const ORIGIN: GeoPoint = { latitude: -34.6083, longitude: -58.3712 };
export const north = (from: GeoPoint, meters: number): GeoPoint => ({
  latitude: from.latitude + ((meters / R) * 180) / Math.PI,
  longitude: from.longitude,
});

export const NOW = new Date("2026-10-15T15:00:00.000Z");
export const DAY = 86_400_000;
export const CAFE = "gcid:cafe";
export const GYM = "gcid:gym";

export const position = (
  over: Partial<ConsumerPosition> = {},
): ConsumerPosition => ({
  gps: ORIGIN,
  lastScanCategory: CAFE,
  lastScanPoint: null,
  places: [],
  ...over,
});

export function facts(over: Partial<CrossOfferFacts> = {}): CrossOfferFacts {
  return {
    now: NOW,
    position: position(),
    offer: {
      categoryGcid: GYM,
      audience: "non_members",
      dormantDays: 30,
      monthlyCap: 50,
      locations: [north(ORIGIN, 640)],
    },
    membership: null,
    claimed: false,
    claimedThisMonth: 0,
    ...over,
  };
}

export const offer = (over: Partial<CrossOfferFacts["offer"]>) => ({
  ...facts().offer,
  ...over,
});

export const member = (lastOrderDaysAgo: number | null) => ({
  enrolledAt: new Date(NOW.getTime() - 400 * DAY),
  lastOrderAt:
    lastOrderDaysAgo === null
      ? null
      : new Date(NOW.getTime() - lastOrderDaysAgo * DAY),
  optedOut: false,
});
