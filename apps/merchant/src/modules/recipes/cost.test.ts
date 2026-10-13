import { describe, expect, it } from "vitest";
import { lineCostOf, summarizeCost } from "./cost";

/** Spec 0210 §Plan 1 — costo, `costComplete`, margen y margen % (insumo sin costo, precio null y 0). */

describe("summarizeCost", () => {
  it("receta completa: cost, margin y marginPct", () => {
    // 200 g de harina a 0.0012 + 2 huevos a 0.15 = 0.24 + 0.30 = 0.54
    const s = summarizeCost("2.00", [
      { quantity: "200.000", unitCost: "0.001200" },
      { quantity: "2.000", unitCost: "0.150000" },
    ]);
    expect(s).toEqual({
      unitPrice: "2.00",
      cost: "0.54",
      costComplete: true,
      margin: "1.46",
      marginPct: "73.0",
      lineCount: 2,
    });
  });

  it("redondea la SUMA, no cada linea: 3 × 0.333333 x 1 = 0.999999 → 1.00", () => {
    const line = { quantity: "1.000", unitCost: "0.333333" };
    expect(lineCostOf(line)).toBe("0.33");
    expect(summarizeCost("1.00", [line, line, line]).cost).toBe("1.00");
  });

  it("insumo sin costo: suma solo las conocidas y costComplete=false", () => {
    const s = summarizeCost("10.00", [
      { quantity: "1.000", unitCost: "4.000000" },
      { quantity: "5.000", unitCost: null },
    ]);
    expect(s.cost).toBe("4.00");
    expect(s.costComplete).toBe(false);
    expect(s.margin).toBe("6.00");
    expect(s.marginPct).toBe("60.0");
  });

  it("todas sin costo: cost 0.00 y costComplete=false (hay lineas)", () => {
    const s = summarizeCost("10.00", [{ quantity: "1.000", unitCost: null }]);
    expect(s).toMatchObject({
      cost: "0.00",
      costComplete: false,
      lineCount: 1,
    });
  });

  it("sin lineas: cost null, costComplete false, margin y marginPct null", () => {
    expect(summarizeCost("5.00", [])).toEqual({
      unitPrice: "5.00",
      cost: null,
      costComplete: false,
      margin: null,
      marginPct: null,
      lineCount: 0,
    });
  });

  it("precio null: margin y marginPct null, cost igual se calcula", () => {
    const s = summarizeCost(null, [
      { quantity: "2.000", unitCost: "1.500000" },
    ]);
    expect(s).toMatchObject({
      unitPrice: null,
      cost: "3.00",
      margin: null,
      marginPct: null,
    });
  });

  it("precio 0: margin = −cost y marginPct null (no divide por cero)", () => {
    const s = summarizeCost("0.00", [
      { quantity: "1.000", unitCost: "2.000000" },
    ]);
    expect(s).toMatchObject({ margin: "-2.00", marginPct: null });
  });

  it("margen negativo y redondeo del porcentaje a 1 decimal", () => {
    // precio 3.00, costo 4.00 → margen −1.00 → −33.33…% → −33.3
    const s = summarizeCost("3.00", [
      { quantity: "1.000", unitCost: "4.000000" },
    ]);
    expect(s).toMatchObject({ margin: "-1.00", marginPct: "-33.3" });
    // precio 3.00, costo 1.00 → 66.66…% → 66.7
    expect(
      summarizeCost("3.00", [{ quantity: "1.000", unitCost: "1.000000" }])
        .marginPct,
    ).toBe("66.7");
  });

  it("lineCostOf: null si el insumo no tiene costo; redondea a 2", () => {
    expect(lineCostOf({ quantity: "1.000", unitCost: null })).toBeNull();
    expect(lineCostOf({ quantity: "0.005", unitCost: "1.000000" })).toBe(
      "0.01",
    );
  });
});
