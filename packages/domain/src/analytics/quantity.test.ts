import { describe, expect, it } from "vitest";
import { exactQuantity, sameQuantity, sumQuantity } from "./quantity";
import type { AnalyticsMetric } from "./types";

const row = (
  quantityExact?: string,
  metric = "mass_sold_g",
  quantity = 0,
): AnalyticsMetric => ({
  day: "2026-10-18",
  metric,
  quantity,
  quantityExact,
  locationId: "local",
  dimensionId: "product",
  amountMinor: 0,
  count: 0,
  currencyCode: "",
  minorUnit: 0,
});
describe("exact analytics quantities", () => {
  it("adds derived decimals exactly without capture limits", () => {
    const rows = [
      row("999999999999999999999999.00000000000001"),
      row("0.00000000000002"),
    ];
    expect(
      sameQuantity(
        sumQuantity(rows, "mass_sold_g"),
        exactQuantity(row("999999999999999999999999.00000000000003")),
      ),
    ).toBe(true);
  });
  it("accepts safe nonnegative legacy unit integers and exact integral units only", () => {
    expect(exactQuantity(row(undefined, "units_sold", 2))).toEqual({
      n: 2n,
      d: 1n,
    });
    expect(exactQuantity(row("2.00", "units_sold", Number.NaN))).toEqual({
      n: 200n,
      d: 100n,
    });
    expect(exactQuantity(row("0.5", "units_sold", 2))).toBeNull();
    expect(exactQuantity(row(undefined, "units_sold", 0.5))).toBeNull();
    expect(
      exactQuantity(row(undefined, "units_sold", Number.MAX_SAFE_INTEGER + 1)),
    ).toBeNull();
  });
  it("propagates unknown quantities rather than replacing them with zero", () => {
    expect(sumQuantity([row("1"), row(undefined)], "mass_sold_g")).toBeNull();
    expect(sameQuantity(null, { n: 0n, d: 1n })).toBe(false);
    expect(sumQuantity([], "mass_sold_g")).toEqual({ n: 0n, d: 1n });
  });
});
