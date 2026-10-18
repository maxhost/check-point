import { describe, expect, it } from "vitest";
import { formatStockCost, stockCostGeometryValue } from "./stock-cost-format";

describe("exact unit-cost labels", () => {
  it("retains sub-cent precision, grouping and values beyond Number precision", () => {
    expect(formatStockCost("0.1", "USD", 2, "g")).toBe("0,001 USD/g");
    expect(formatStockCost("123456789012345678901.2345", "USD", 2, "ml")).toBe(
      "1.234.567.890.123.456.789,012345 USD/ml",
    );
    expect(formatStockCost("100", "USD", 2, "unit")).toBe("1 USD/unidad");
    expect(formatStockCost("100.000", "USD", 2, "unidad")).toBe("1 USD/unidad");
    expect(formatStockCost("0", "USD", 2, "g")).toBe("0 USD/g");
    expect(formatStockCost("123.4", "JPY", 0, "g")).toBe("123,4 JPY/g");
    expect(formatStockCost("1", "KWD", 3, "g")).toBe("0,001 KWD/g");
  });
  it("does not render malformed or missing observations as zero", () => {
    for (const value of ["", "-1", "NaN", "1e9", ".2", "Infinity"]) {
      expect(formatStockCost(value, "USD", 2, "g")).toBe("Costo no disponible");
      expect(stockCostGeometryValue(value)).toBeNull();
    }
    expect(stockCostGeometryValue("0")).toBe(0);
    expect(stockCostGeometryValue("0.1")).toBe(0.1);
    expect(stockCostGeometryValue("9".repeat(400))).toBeNull();
    expect(stockCostGeometryValue(`0.${"0".repeat(400)}1`)).toBeNull();
  });
});
