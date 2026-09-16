/**
 * Step 4 of the marketing tick as a PURE function (spec 0065; ADR 0065 §8, ADR 0066 §5):
 * for ONE consumer, which queued turns get activated and what its wallet pass must show.
 * No DB and no ambient clock — `now` and `random` are INJECTED, the same factura as
 * `wallet/push-plan.ts`. `marketing/placement.ts` only executes the plan.
 *
 * What this function does NOT cover, declared instead of papered over: that the applier
 * calls it under the per-consumer lock (`select … for update` on `consumer_account`) and
 * with the rows it says it is passing. No unit test pins that down — it is the Neon
 * integration's job (quota inside one run, two overlapping ticks).
 */

import { composeRelevantText, RELEVANT_TEXT_CAP } from "./relevant-text";

/** A door. The only geometry the planner knows. */
export type LatLng = { latitude: number; longitude: number };

/** A turn already `active` and NOT holdout: it occupies one of the ≤5 slots, imposes the
 * 400 m exclusion on the queue, and is in the pass. */
export type ActiveTurn = LatLng & {
  turnId: string;
  businessId: string;
  businessName: string;
  locationId: string;
  /** `message_snapshot`: what was copied at activation, not today's campaign text. */
  message: string;
};

/** A `queued` turn, candidate to be activated in this run. */
export type QueuedTurn = ActiveTurn & {
  campaignId: string;
  membershipId: string;
  queuedAt: Date;
  couponLabel: string | null;
  /** `numeric` comes back from the driver as a string; it is copied, never computed. */
  couponCost: string | null;
};

/** A live relationship: the consumer's own balance at a door, with its text already
 * produced by `utilityText` (≤ 60). Never filtered by the marketing opt-out. */
export type UtilityCandidate = LatLng & {
  membershipId: string;
  businessId: string;
  businessName: string;
  locationId: string;
  text: string;
  lastActivityAt: Date;
};

/** A row of `consumer.pass_placement` as it is TODAY (to decide `refresh`). */
export type PlacedSlot = {
  locationId: string;
  slotKind: "utility" | "turn" | "both";
  relevantText: string;
};

/** A row of `consumer.pass_placement` as it MUST be after this plan. */
export type PlannedSlot = PlacedSlot & {
  businessId: string;
  turnId: string | null;
};

export type TurnActivation = {
  turnId: string;
  businessId: string;
  locationId: string;
  windowStart: Date;
  windowEnd: Date;
  holdout: boolean;
  messageSnapshot: string;
  couponLabelSnapshot: string | null;
  couponCostSnapshot: string | null;
};

export type PlacementPlan = {
  activations: TurnActivation[];
  placements: PlannedSlot[];
  /** `false` when the target set is identical to `currentPlacement`: no rewrite, no
   * `message_updated_at`, no `pass_refresh` row. */
  refresh: boolean;
};

/** Every number of the design is a PARAMETER, so a test can lower it instead of seeding
 * fifty rows. Defaults are the ORQUESTADOR's (spec 0065 / ADR 0066). */
export type PlacementLimits = {
  maxActiveTurns: number;
  businessQuota: number;
  minSeparationMeters: number;
  holdoutRate: number;
  cooldownDays: number;
  utilitySlots: number;
  windowDays: number;
  /** Hard ceiling of the pass: Apple accepts 10 `locations`, Google 10 per object. */
  maxSlots: number;
  textCap: number;
};

export const DEFAULT_PLACEMENT_LIMITS: PlacementLimits = {
  maxActiveTurns: 5,
  businessQuota: 50,
  minSeparationMeters: 400,
  holdoutRate: 0.1,
  cooldownDays: 30,
  utilitySlots: 3,
  windowDays: 5,
  maxSlots: 10,
  textCap: RELEVANT_TEXT_CAP,
};

export type PlacementInput = {
  now: Date;
  /** Injected so the integration can force and exclude holdouts instead of praying. */
  random: () => number;
  activeTurns: ActiveTurn[];
  queued: QueuedTurn[];
  utility: UtilityCandidate[];
  currentPlacement: PlacedSlot[];
  /** Shrunk lift per business (ADR 0066), computed in SQL by `merit.ts`. */
  businessScores: Map<string, number>;
  /** What a business ABSENT from `businessScores` scores: `lift_global`, so a business
   * without history lands in the MIDDLE of the table, not last (ADR 0066 §3). */
  defaultBusinessScore?: number;
  /** `active` non-holdout turns per business across the whole platform (the quota). */
  businessActiveTurns: Map<string, number>;
  /** Latest `window_end` of an `active`/`done` turn of that business for THIS consumer.
   * A `cancelled` turn keeps its `window_end` and must not be here: only the turn that
   * CONSUMED the opportunity burns the cooldown (spec 0065, audience rule 5). */
  lastWindowEndByBusiness: Map<string, Date>;
  limits?: Partial<PlacementLimits>;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** IUGG mean Earth radius, in metres. */
const EARTH_RADIUS_M = 6_371_008.8;

/** Great-circle distance in metres (haversine). Distances here are hundreds of metres,
 * where the spherical error is centimetres — far under the 400 m rule. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const halfDLat = toRad(b.latitude - a.latitude) / 2;
  const halfDLng = toRad(b.longitude - a.longitude) / 2;
  const h =
    Math.sin(halfDLat) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(halfDLng) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The queue's order (ADR 0066): `score(negocio) desc`, tie broken by `queued_at asc` and
 * — so that two runs over the same data give the same order even if the driver returns
 * the rows shuffled — by `turn_id` as the last resort.
 */
function byMerit(
  scoreOf: (businessId: string) => number,
): (a: QueuedTurn, b: QueuedTurn) => number {
  return (a, b) => {
    const byScore = scoreOf(b.businessId) - scoreOf(a.businessId);
    if (byScore !== 0) return byScore;
    const byAge = a.queuedAt.getTime() - b.queuedAt.getTime();
    if (byAge !== 0) return byAge;
    return a.turnId < b.turnId ? -1 : a.turnId > b.turnId ? 1 : 0;
  };
}

/**
 * Walks the queue in merit order and activates while there is room. Each candidate must
 * satisfy ALL FOUR conditions; failing one only skips THAT candidate — it stays `queued`
 * for the next tick, which is what makes the 400 m rule a separation and not a purge.
 *
 * `holdout` is drawn AFTER the filters, so a retained turn is a turn that WOULD have been
 * placed — that is what makes it a base line and not a different population.
 */
function planActivations(
  input: PlacementInput,
  limits: PlacementLimits,
): { activations: TurnActivation[]; live: ActiveTurn[] } {
  const live = [...input.activeTurns];
  const withLiveTurn = new Set(live.map((turn) => turn.businessId));
  const quota = new Map(input.businessActiveTurns);
  const cooldownFloor = new Date(
    input.now.getTime() - limits.cooldownDays * DAY_MS,
  );
  const fallback = input.defaultBusinessScore ?? 0;
  const scoreOf = (businessId: string) =>
    input.businessScores.get(businessId) ?? fallback;
  const activations: TurnActivation[] = [];
  for (const candidate of [...input.queued].sort(byMerit(scoreOf))) {
    if (live.length >= limits.maxActiveTurns) break;
    if (withLiveTurn.has(candidate.businessId)) continue;
    const lastWindowEnd = input.lastWindowEndByBusiness.get(
      candidate.businessId,
    );
    if (lastWindowEnd && lastWindowEnd >= cooldownFloor) continue;
    const tooClose = live.some(
      (turn) => distanceMeters(turn, candidate) < limits.minSeparationMeters,
    );
    if (tooClose) continue;
    const used = quota.get(candidate.businessId) ?? 0;
    if (used >= limits.businessQuota) continue;
    const holdout = input.random() < limits.holdoutRate;
    activations.push({
      turnId: candidate.turnId,
      businessId: candidate.businessId,
      locationId: candidate.locationId,
      windowStart: input.now,
      windowEnd: new Date(input.now.getTime() + limits.windowDays * DAY_MS),
      holdout,
      messageSnapshot: candidate.message,
      couponLabelSnapshot: candidate.couponLabel,
      couponCostSnapshot: candidate.couponCost,
    });
    withLiveTurn.add(candidate.businessId);
    if (holdout) continue;
    live.push(candidate);
    quota.set(candidate.businessId, used + 1);
  }
  return { activations, live };
}

/**
 * Target set = `utility` (≤ 3, most recent first) ∪ `live` turns (≤ 5), FUSED by
 * `location_id`. A door in both bags is ONE row `slot_kind = 'both'` with the composed
 * text; without that the applier would die with `23505` against the pk, or a deduped
 * turn would sit `active` burning quota while absent from the pass.
 */
function planSlots(
  live: ActiveTurn[],
  utility: UtilityCandidate[],
  limits: PlacementLimits,
): PlannedSlot[] {
  const byLocation = new Map<string, PlannedSlot>();
  const recent = [...utility]
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
    .slice(0, limits.utilitySlots);
  for (const candidate of recent) {
    byLocation.set(candidate.locationId, {
      locationId: candidate.locationId,
      businessId: candidate.businessId,
      slotKind: "utility",
      turnId: null,
      relevantText: candidate.text,
    });
  }
  for (const turn of live) {
    const shared = byLocation.get(turn.locationId);
    const campaign = { businessName: turn.businessName, message: turn.message };
    byLocation.set(turn.locationId, {
      locationId: turn.locationId,
      businessId: turn.businessId,
      slotKind: shared ? "both" : "turn",
      turnId: turn.turnId,
      relevantText: composeRelevantText(
        shared ? shared.relevantText : null,
        campaign,
        limits.textCap,
      ),
    });
  }
  return [...byLocation.values()].slice(0, limits.maxSlots);
}

/** The pass is rewritten only when the SET changed — by `location_id`, `slot_kind` or
 * `relevant_text` (spec 0065, step 4). Order is irrelevant: it is a set. */
function differs(next: PlannedSlot[], current: PlacedSlot[]): boolean {
  if (next.length !== current.length) return true;
  const key = (slot: PlacedSlot) =>
    JSON.stringify([slot.locationId, slot.slotKind, slot.relevantText]);
  const planned = next.map(key).sort();
  const placed = current.map(key).sort();
  return planned.some((value, index) => value !== placed[index]);
}

export function planConsumerPlacement(input: PlacementInput): PlacementPlan {
  const limits = { ...DEFAULT_PLACEMENT_LIMITS, ...input.limits };
  const { activations, live } = planActivations(input, limits);
  const placements = planSlots(live, input.utility, limits);
  return {
    activations,
    placements,
    refresh: differs(placements, input.currentPlacement),
  };
}
