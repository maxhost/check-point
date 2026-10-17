import type { CardCandidate, CardState } from "./types";
export const WEIGHTS = {
  minimum: 0.05,
  maximumCards: 5,
  noveltyDecay: 0.6,
  maximumPlata: 3,
  noSalesDailyMajor: 20,
} as const;
export function materialFingerprint(
  subjectKey: string,
  amountMinor: number | null,
): string {
  return `${subjectKey}:${amountMinor === null ? "none" : Math.floor(Math.log2(Math.max(1, Math.abs(amountMinor))))}`;
}
export function novelty(fingerprint: string, state?: CardState): number {
  if (!state || fingerprint !== state.fingerprint) return 1;
  if (state.status !== "shown") return 0;
  return WEIGHTS.noveltyDecay ** state.shownDays;
}
export function cardWeight(
  card: CardCandidate,
  averageDailyMinor: number,
  state?: CardState,
): number {
  const n = novelty(card.fingerprint, state);
  if (!n) return 0;
  if (card.cardKey === "1") return 10;
  const p =
    card.fixedPlata ??
    Math.min(
      WEIGHTS.maximumPlata,
      Math.abs(card.amountMinor ?? 0) /
        (averageDailyMinor > 0
          ? averageDailyMinor
          : WEIGHTS.noSalesDailyMajor * 10 ** card.minorUnit),
    );
  return (
    p *
    Math.max(0.2, Math.min(1, card.urgency)) *
    (card.weightMultiplier ?? 1) *
    n
  );
}
export function selectCards<
  T extends { cardKey: string; subjectKey: string; weight: number },
>(cards: readonly T[]): T[] {
  return cards
    .filter((c) => c.weight >= WEIGHTS.minimum)
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.cardKey.localeCompare(b.cardKey) ||
        a.subjectKey.localeCompare(b.subjectKey),
    )
    .slice(0, WEIGHTS.maximumCards);
}
