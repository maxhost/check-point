import { describe, expect, it } from "vitest";
import { equalAllocations, minorUnitFor, parseAmount } from "./arithmetic";

describe("0231 exact monthly allocation", () => {
  it.each([
    ["USD", "100.00", ["33.34", "33.33", "33.33"]],
    ["USD", "0.02", ["0.02", "0.00", "0.00", "0.00"]],
    ["COP", "100", ["34.00", "33.00", "33.00"]],
    ["CLP", "1", ["1.00", "0.00", "0.00"]],
    ["JPY", "0", ["0.00", "0.00"]],
    ["PYG", "100", ["50.00", "50.00"]],
    ["EUR", "10.01", ["5.01", "5.00"]],
  ])(
    "%s %s uses the first sorted local for the entire remainder",
    (currency, total, expected) => {
      const ids = expected.map((_, i) => String(i));
      const unit = minorUnitFor(currency);
      const allocations = equalAllocations(
        parseAmount(total, unit),
        unit,
        [...ids].reverse().concat(ids[0]),
      );
      expect(allocations.map((a) => a.locationId)).toEqual(ids);
      expect(allocations.map((a) => a.monthlyAmount)).toEqual(expected);
      expect(
        allocations.reduce(
          (sum, a) => sum + parseAmount(a.monthlyAmount, unit),
          0n,
        ),
      ).toBe(parseAmount(total, unit));
    },
  );
  it("rejects hidden fractions, floating input, negative and overflowing amounts", () => {
    expect(() => minorUnitFor("ZZZ")).toThrow();
    for (const amount of [
      "0.25",
      "0.001",
      "NaN",
      "Infinity",
      "1e2",
      "-1",
      "10000000000000000",
      1,
      null,
    ])
      expect(() => parseAmount(amount, 0)).toThrow();
    expect(parseAmount("9999999999999999.99", 2)).toBe(999999999999999999n);
    expect(() => equalAllocations(1n, 2, [])).toThrow();
  });
});
