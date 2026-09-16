/**
 * Builders for the `planConsumerPlacement` unit (spec 0065). Kept out of the test file
 * so both halves of the table — activation and slots — read as the case they describe
 * and not as forty lines of fixture.
 */

import type {
  ActiveTurn,
  PlacementInput,
  QueuedTurn,
  UtilityCandidate,
} from "./placement-plan";

export const NOW = new Date("2026-09-15T12:00:00.000Z");
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Buenos Aires, Plaza de Mayo. Everything else is an offset from here. */
const BASE = { latitude: -34.6083, longitude: -58.3712 };

/** 1° of latitude ≈ 111.32 km, so 0.0018° ≈ 200 m and 0.01° ≈ 1.11 km. */
export function northOf(metres: number): {
  latitude: number;
  longitude: number;
} {
  return {
    latitude: BASE.latitude + metres / 111_320,
    longitude: BASE.longitude,
  };
}

export function queued(
  id: string,
  overrides: Partial<QueuedTurn> = {},
): QueuedTurn {
  return {
    turnId: `turn-${id}`,
    campaignId: `campaign-${id}`,
    businessId: `business-${id}`,
    businessName: `Negocio ${id}`,
    membershipId: `membership-${id}`,
    locationId: `location-${id}`,
    ...northOf(0),
    queuedAt: new Date(NOW.getTime() - DAY_MS),
    message: `Promo ${id}`,
    couponLabel: null,
    couponCost: null,
    ...overrides,
  };
}

export function active(
  id: string,
  overrides: Partial<ActiveTurn> = {},
): ActiveTurn {
  return {
    turnId: `turn-${id}`,
    businessId: `business-${id}`,
    businessName: `Negocio ${id}`,
    locationId: `location-${id}`,
    ...northOf(0),
    message: `Promo ${id}`,
    ...overrides,
  };
}

export function utility(
  id: string,
  overrides: Partial<UtilityCandidate> = {},
): UtilityCandidate {
  return {
    membershipId: `membership-${id}`,
    businessId: `business-${id}`,
    businessName: `Negocio ${id}`,
    locationId: `location-${id}`,
    ...northOf(0),
    text: `Negocio ${id}: 3 sellos`,
    lastActivityAt: new Date(NOW.getTime() - DAY_MS),
    ...overrides,
  };
}

/** A random that walks a fixed list and then always returns `rest` — so a test states
 * exactly which draws it cares about. */
export function draws(values: number[], rest = 0.5): () => number {
  let index = 0;
  return () => (index < values.length ? values[index++]! : rest);
}

/** Default input: nothing live, nothing queued, nothing in the pass, no history. */
export function input(overrides: Partial<PlacementInput> = {}): PlacementInput {
  return {
    now: NOW,
    random: draws([]),
    activeTurns: [],
    queued: [],
    utility: [],
    currentPlacement: [],
    businessScores: new Map(),
    businessActiveTurns: new Map(),
    lastWindowEndByBusiness: new Map(),
    ...overrides,
  };
}
