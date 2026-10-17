import { ANALYTICS_POLICY, type AnalyticsPolicy } from "./policy/index";
import type { CardCandidate, CardState } from "./types";
/** Compatibility export; defaults have one source. */
export const WEIGHTS = ANALYTICS_POLICY.weights;
export function materialFingerprint(
  subjectKey: string,
  amountMinor: number | null,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
): string {
  const exponent =
    amountMinor === null
      ? null
      : Math.floor(
          policy.weights.materialBucketBase === 2
            ? Math.log2(Math.max(1, Math.abs(amountMinor)))
            : Math.log(Math.max(1, Math.abs(amountMinor))) /
                Math.log(policy.weights.materialBucketBase),
        );
  return `${subjectKey}:${exponent === null ? "none" : exponent}`;
}
export function novelty(
  fingerprint: string,
  state?: CardState,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
): number {
  if (!state || fingerprint !== state.fingerprint) return 1;
  if (!["shown", "open", "snoozed"].includes(state.status)) return 0;
  return policy.weights.noveltyDecay ** state.shownDays;
}
export function cardWeight(
  card: CardCandidate,
  averageDailyMinor: number,
  state?: CardState,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
): number {
  const n = novelty(card.fingerprint, state, policy);
  if (!n) return 0;
  if (
    policy.rules.some((r) => r.id === card.cardKey && r.handler === "summary")
  )
    return policy.weights.summaryFixed;
  const denominator =
    averageDailyMinor > 0
      ? averageDailyMinor
      : policy.weights.noSalesDailyMajor * 10 ** card.minorUnit;
  const p =
    card.fixedPlata ??
    Math.min(
      policy.weights.maximumPlata,
      Math.abs(card.amountMinor ?? 0) / (denominator ?? 1),
    );
  return (
    p *
    Math.max(
      policy.weights.minimumUrgency,
      Math.min(policy.weights.maximumUrgency, card.urgency),
    ) *
    (card.weightMultiplier ?? 1) *
    n
  );
}
export function selectCards<
  T extends { cardKey: string; subjectKey: string; weight: number },
>(cards: readonly T[], policy: AnalyticsPolicy = ANALYTICS_POLICY): T[] {
  return cards
    .filter((c) => c.weight >= policy.weights.minimum)
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.cardKey.localeCompare(b.cardKey) ||
        a.subjectKey.localeCompare(b.subjectKey),
    )
    .slice(0, policy.weights.maximumCards);
}
