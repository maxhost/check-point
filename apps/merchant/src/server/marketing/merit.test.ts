import { describe, expect, it } from "vitest";
import {
  buildMeritTable,
  businessScore,
  globalLift,
  MERIT_ALPHA,
  type BusinessTurnStats,
} from "./merit";

function stats(
  businessId: string,
  placedN: number,
  placedPurchases: number,
  holdoutN: number,
  holdoutPurchases: number,
): BusinessTurnStats {
  return { businessId, placedN, placedPurchases, holdoutN, holdoutPurchases };
}

/** `1 de 1` (a perfect lift over one turn) against `40 de 50` with a real holdout. */
const LUCKY = stats("lucky", 1, 1, 1, 0);
const PROVEN = stats("proven", 50, 40, 10, 2);

describe("businessScore — ADR 0066", () => {
  it("does not let `1 de 1` beat `40 de 50`", () => {
    const lucky = businessScore(LUCKY, 0.1);
    const proven = businessScore(PROVEN, 0.1);
    expect(lucky).toBeLessThan(proven);
  });

  it("scores a business without history at `globalLift`: in the MIDDLE, not last", () => {
    const rows = [PROVEN, stats("weak", 50, 5, 10, 4)];
    const table = buildMeritTable(rows);
    const ranking = ["proven", "debutante", "weak"]
      .map((businessId) => ({
        businessId,
        score: table.scores.get(businessId) ?? table.defaultScore,
      }))
      .sort((a, b) => b.score - a.score)
      .map((row) => row.businessId);
    expect(ranking).toEqual(["proven", "debutante", "weak"]);
    expect(table.scores.get("debutante")).toBeUndefined();
    expect(table.defaultScore).toBe(globalLift(rows));
  });

  it("treats an empty side as 0, never `NaN`", () => {
    const noHoldout = businessScore(stats("a", 10, 3, 0, 0), 0);
    const onlyHoldout = businessScore(stats("b", 0, 0, 10, 3), 0);
    expect(Number.isNaN(noHoldout)).toBe(false);
    expect(Number.isNaN(onlyHoldout)).toBe(false);
    expect(noHoldout).toBeCloseTo((0.3 * 10) / (10 + MERIT_ALPHA), 12);
    expect(onlyHoldout).toBe(0);
    expect(globalLift([])).toBe(0);
  });

  it("(D6) pools the global lift: two turns do not move the prior like a thousand", () => {
    // The docblock declares the aggregation POOLED. The old assertion for this was
    // `expect(table.defaultScore).toBe(globalLift(rows))` — TAUTOLOGICAL: it compares
    // the function with itself and stays green under any aggregation. Hardcoded value.
    const rows = [stats("big", 1000, 400, 200, 40), stats("small", 2, 2, 1, 0)];
    expect(globalLift(rows)).toBeCloseTo(0.2021926, 6);
    // The unweighted average would be (0.2 + 1.0) / 2 = 0.6: `small` would have moved
    // the prior of the whole platform with two turns.
    expect(globalLift(rows)).toBeLessThan(0.3);
  });

  it("gives the ADR 0065 example to B (+8), not to A (+3) who has the higher rate", () => {
    const a = stats("a", 100, 33, 100, 30);
    const b = stats("b", 100, 10, 100, 2);
    expect(businessScore(a, 0)).toBeLessThan(businessScore(b, 0));
    // The raw rate — the metric the ADR forbids — would have said the opposite.
    expect(a.placedPurchases / a.placedN).toBeGreaterThan(
      b.placedPurchases / b.placedN,
    );
  });
});
