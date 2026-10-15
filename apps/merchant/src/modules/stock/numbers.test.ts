import { describe, expect, it } from "vitest";
import { weightedAverageCostOf, parsePurchaseCost } from "./numbers";

describe("0228 exact mobile average", () => {
  it("weights the exact total and rounds only the persisted result", () => {
    expect(weightedAverageCostOf(10000n, 2000000n, 5000n, 2000n)).toBe(
      2666667n,
    );
    expect(weightedAverageCostOf(1n, 0n, 6n, 1n)).toBe(1428571n);
    expect(weightedAverageCostOf(0n, null, 20000000n, 1n)).toBe(1n);
  });
  it("retains unknown/known zero without a price and resets nonpositive stock", () => {
    for (const quantity of [-10000n, 0n, 10000n]) {
      expect(weightedAverageCostOf(quantity, null, 1000n, null)).toBeNull();
      expect(weightedAverageCostOf(quantity, 0n, 1000n, null)).toBe(0n);
    }
    expect(weightedAverageCostOf(-10000n, 2000000n, 1000n, 400n)).toBe(
      4000000n,
    );
    expect(weightedAverageCostOf(10000n, null, 1000n, 400n)).toBe(4000000n);
    expect(weightedAverageCostOf(10000n, 2000000n, 1000n, 0n)).toBe(1818182n);
    expect(weightedAverageCostOf(0n, 2000000n, 1000n, 0n)).toBe(0n);
  });
  it("preserves quantity and price limits, known zero and null", () => {
    expect(parsePurchaseCost(null, 1n)).toBeNull();
    expect(parsePurchaseCost("0", 1n)).toEqual({ totalCost: 0n, unitCost: 0n });
    expect(() => parsePurchaseCost("100000.00", 1n)).toThrow();
    expect(
      weightedAverageCostOf(1000n, 99999999999999n, 1000n, 9999999999n),
    ).toBe(99999999995000n);
    expect(() => weightedAverageCostOf(0n, null, 0n, 0n)).toThrow(RangeError);
    expect(() => weightedAverageCostOf(0n, null, 1n, -1n)).toThrow(RangeError);
  });
});
