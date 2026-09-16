/**
 * The two numbers block 5 of the composer shows BEFORE anything is activated (spec 0065,
 * «Limites y revision»): how many turns this campaign can occupy right now, and the most
 * its coupon can cost.
 *
 * It is PURE on purpose, and that is the whole reason this file exists instead of two
 * expressions inside the JSX: «el compositor muestra el costo maximo» is a behaviour, and
 * a regex over the markup is a proxy with preimages (CLAUDE.md, tarea 38). Extracting the
 * DECISION gives it a table of cases as an oracle. What extracting does NOT buy is the
 * WIRING — that the composer actually renders these values is a separate render test, and
 * what the owner sees on screen is the oracle that defines.
 */

import { DEFAULT_PLACEMENT_LIMITS } from "./placement-plan";

/** Concurrent non-holdout turns one business may hold platform-wide. Read from the
 * placement limits and not re-declared: the composer promising 50 while the tick caps at
 * another number is exactly the drift `audience-preview` was written to avoid. */
export const BUSINESS_QUOTA = DEFAULT_PLACEMENT_LIMITS.businessQuota;

/** What is left of the quota, floored at 0: a business already OVER the cap (the cap can
 * only be exceeded by lowering it in config, but the arithmetic must not invent a
 * negative number to show on a screen). */
export function remainingQuota(activeTurns: number): number {
  return Math.max(0, BUSINESS_QUOTA - activeTurns);
}

export type ComposerSummary = {
  /** `min(audiencia alcanzable, cuota libre)` — the turns this campaign could occupy on
   * a tick running right now. A SNAPSHOT, never a promise: both halves move. */
  turns: number;
  /** `costo × tope`, as a 2-decimal string; `null` when there is no coupon. */
  maxCost: string | null;
};

/**
 * `costo × tope`, in cents.
 *
 * ⚠️ The cents are NOT what makes this correct, and the comment that said so was wrong —
 * MEASURED with the mutation (M1 of B3): replacing this line with the plain float
 * `(amount * cap).toFixed(2)` leaves the whole suite GREEN, because `toFixed(2)` absorbs
 * IEEE noise of the order of 1e-13 at every magnitude this function can reach (the cap is
 * capped at 1e6 and the cost is a declared 2-decimal value). Written down rather than
 * quietly fixed: a docblock claiming a guard that nothing pins is the failure of ADR 0054,
 * and the next reader would have «protected» it in a refactor for no reason.
 *
 * It stays in cents anyway — exact by construction beats exact by rounding — but the
 * property this file actually PINS is the one below it: a blank or negative cost is
 * `null`, not a number.
 */
function maxCost(cost: string | null, cap: number | null): string | null {
  if (cost === null || cap === null) return null;
  // `Number("")` is 0, not NaN — MEASURED, the first version of this file printed «0.00»
  // as the maximum cost of a coupon whose price the owner had not typed yet, which reads
  // as «este cupón es gratis». A blank cost is an UNKNOWN cost.
  if (cost.trim() === "") return null;
  const amount = Number(cost);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (!Number.isInteger(cap) || cap < 0) return null;
  return ((Math.round(amount * 100) * cap) / 100).toFixed(2);
}

export function summarizeComposer(input: {
  reachable: number;
  remainingQuota: number;
  couponCost: string | null;
  couponMaxRedemptions: number | null;
}): ComposerSummary {
  return {
    turns: Math.max(0, Math.min(input.reachable, input.remainingQuota)),
    maxCost: maxCost(input.couponCost, input.couponMaxRedemptions),
  };
}
