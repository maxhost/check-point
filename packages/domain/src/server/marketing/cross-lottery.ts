import {
  CROSS_LOTTERY_BEHIND_MAX,
  CROSS_LOTTERY_BEHIND_MIN,
  CROSS_LOTTERY_DECAY_METERS,
  CROSS_LOTTERY_EPSILON,
  CROSS_LOTTERY_NEW_CUSTOMER_BONUS,
} from "../notifications/limits";

/**
 * THE H4 LOTTERY OF THE CROSS SALE (spec 0143 §3 / ADR 0117 §12-§13). PURE: the facts come
 * from `cross-sale-store.ts`, the draw `u` from the caller (the tests fix it). For each
 * eligible campaign `i` (one live cross campaign per business, so campaign = business):
 *
 *  - closeness `c = e^(−d / DECAY)`, `d` = meters to B's nearest location;
 *  - behind `a = clamp((1 + F) / (1 + R), MIN, MAX)`, where `F` = the sum of `1/k` over the
 *    decisions of B's local month in which `i` was a candidate, INCLUDING THIS ONE, and `R` =
 *    the decisions of that month in which `i` was chosen — «equal per opportunity»;
 *  - bonus `b = NEW_CUSTOMER_BONUS` when B got no new customer in its local month, else 1;
 *  - `p = ε/k + (1 − ε) · c·a·b / Σ c·a·b`.
 *
 * The draw: candidates by campaign id, the first whose cumulative probability exceeds `u`
 * (the last one when rounding falls short).
 */

export type LotteryCandidate = {
  campaignId: string;
  distanceMeters: number;
  /** `F` WITHOUT this decision: the `1/k` of the month's previous decisions. */
  previousShare: number;
  /** `R`: the month's decisions in which this campaign was chosen. */
  received: number;
  /** B got no new customer in its local month (H4's bonus applies). */
  noNewCustomer: boolean;
};

export type LotteryEntry = {
  campaignId: string;
  closeness: number;
  behind: number;
  bonus: number;
  probability: number;
};

export type LotteryResult = {
  /** By campaign id, the order of the draw. */
  entries: LotteryEntry[];
  chosen: string;
  draw: number;
};

export type LotteryLimits = {
  epsilon: number;
  decayMeters: number;
  behindMin: number;
  behindMax: number;
  newCustomerBonus: number;
};

export const DEFAULT_LOTTERY_LIMITS: LotteryLimits = {
  epsilon: CROSS_LOTTERY_EPSILON,
  decayMeters: CROSS_LOTTERY_DECAY_METERS,
  behindMin: CROSS_LOTTERY_BEHIND_MIN,
  behindMax: CROSS_LOTTERY_BEHIND_MAX,
  newCustomerBonus: CROSS_LOTTERY_NEW_CUSTOMER_BONUS,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The probabilities and factors of every candidate, by campaign id. `k ≥ 1`. */
export function lotteryEntries(
  candidates: readonly LotteryCandidate[],
  limits: LotteryLimits = DEFAULT_LOTTERY_LIMITS,
): LotteryEntry[] {
  const k = candidates.length;
  if (k === 0) return [];
  const sorted = [...candidates].sort((a, b) =>
    a.campaignId < b.campaignId ? -1 : a.campaignId > b.campaignId ? 1 : 0,
  );
  const factors = sorted.map((candidate) => {
    const closeness = Math.exp(-candidate.distanceMeters / limits.decayMeters);
    const fair = candidate.previousShare + 1 / k;
    const behind = clamp(
      (1 + fair) / (1 + candidate.received),
      limits.behindMin,
      limits.behindMax,
    );
    const bonus = candidate.noNewCustomer ? limits.newCustomerBonus : 1;
    return { campaignId: candidate.campaignId, closeness, behind, bonus };
  });
  // Every factor is > 0 (`e^x > 0`, `a ≥ behindMin`, `b ≥ 1`), so the total is too.
  const total = factors.reduce(
    (sum, f) => sum + f.closeness * f.behind * f.bonus,
    0,
  );
  return factors.map((f) => ({
    ...f,
    probability:
      limits.epsilon / k +
      ((1 - limits.epsilon) * (f.closeness * f.behind * f.bonus)) / total,
  }));
}

/** Draws ONE candidate with `u ∈ [0, 1)`. `null` when there is none. */
export function drawCrossLottery(
  candidates: readonly LotteryCandidate[],
  u: number,
  limits: LotteryLimits = DEFAULT_LOTTERY_LIMITS,
): LotteryResult | null {
  const entries = lotteryEntries(candidates, limits);
  if (entries.length === 0) return null;
  let cumulative = 0;
  let chosen = entries[entries.length - 1].campaignId;
  for (const entry of entries) {
    cumulative += entry.probability;
    if (cumulative > u) {
      chosen = entry.campaignId;
      break;
    }
  }
  return { entries, chosen, draw: u };
}
