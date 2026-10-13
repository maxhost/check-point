import { describe, expect, it } from "vitest";
import { formatDecimal, fromDb, parseDecimal, roundDiv } from "./decimal";
import { ModuleError } from "./errors";
import { COUNTED, QUANTITY, TOTAL_COST, unitCostOf } from "./stock/numbers";

/** Spec 0210 §Plan 1 — validacion de numeros: decimales de mas, negativos, strings. */

function codeOf(work: () => unknown): string | null {
  try {
    work();
    return null;
  } catch (error) {
    return error instanceof ModuleError ? error.code : "otro";
  }
}

describe("parseDecimal", () => {
  it("acepta number y string decimal, con hasta los decimales de la columna", () => {
    expect(parseDecimal(1.5, QUANTITY)).toBe(1500n);
    expect(parseDecimal("1.5", QUANTITY)).toBe(1500n);
    expect(parseDecimal(" 2 ", QUANTITY)).toBe(2000n);
    expect(parseDecimal("0.001", QUANTITY)).toBe(1n);
    expect(parseDecimal("12.50", TOTAL_COST)).toBe(1250n);
    expect(parseDecimal(0, TOTAL_COST)).toBe(0n);
  });

  it("los negativos se parsean (la regla de rango la pone cada campo)", () => {
    expect(parseDecimal("-3.25", QUANTITY)).toBe(-3250n);
    expect(parseDecimal(-1, COUNTED)).toBe(-1000n);
  });

  it("mas decimales que la columna → 422 invalid_number", () => {
    expect(codeOf(() => parseDecimal("1.0001", QUANTITY))).toBe(
      "invalid_number",
    );
    expect(codeOf(() => parseDecimal(0.0001, QUANTITY))).toBe("invalid_number");
    expect(codeOf(() => parseDecimal("12.505", TOTAL_COST))).toBe(
      "invalid_number",
    );
    expect(codeOf(() => parseDecimal("12.50", TOTAL_COST))).toBeNull();
  });

  it("strings que no son decimales, exponentes, NaN, Infinity, otros tipos → invalid_number", () => {
    for (const raw of [
      "abc",
      "1,5",
      "",
      "1e3",
      "1.",
      ".5",
      "--1",
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1e21,
      null,
      undefined,
      true,
      {},
      [],
    ]) {
      expect(
        codeOf(() => parseDecimal(raw, QUANTITY)),
        String(raw),
      ).toBe("invalid_number");
    }
  });

  it("mas digitos enteros de los que entran en la columna → invalid_number", () => {
    expect(codeOf(() => parseDecimal("99999999999", QUANTITY))).toBeNull();
    expect(codeOf(() => parseDecimal("100000000000", QUANTITY))).toBe(
      "invalid_number",
    );
    expect(codeOf(() => parseDecimal("0000000000001", QUANTITY))).toBeNull();
  });
});

describe("formato y redondeo", () => {
  it("formatDecimal pone la escala exacta, tambien en negativos y en cero", () => {
    expect(formatDecimal(1250n, 2)).toBe("12.50");
    expect(formatDecimal(5n, 3)).toBe("0.005");
    expect(formatDecimal(-1500n, 3)).toBe("-1.500");
    expect(formatDecimal(0n, 6)).toBe("0.000000");
    expect(formatDecimal(7n, 0)).toBe("7");
  });

  it("roundDiv redondea mitades lejos del cero", () => {
    expect(roundDiv(5n, 2n)).toBe(3n);
    expect(roundDiv(-5n, 2n)).toBe(-3n);
    expect(roundDiv(4n, 3n)).toBe(1n);
    expect(roundDiv(-4n, 3n)).toBe(-1n);
  });

  it("fromDb lee lo que devuelve el driver y redondea si trae mas decimales", () => {
    expect(fromDb("100.000", 3)).toBe(100000n);
    expect(fromDb("0", 3)).toBe(0n);
    expect(fromDb("-2.5", 3)).toBe(-2500n);
    expect(fromDb("1.0005", 3)).toBe(1001n);
  });
});

describe("unitCostOf (last_unit_cost = totalCost / quantity, a 6 decimales)", () => {
  it("12.00 por 10000 g → 0.001200 por g", () => {
    expect(formatDecimal(unitCostOf(1200n, 10_000_000n)!, 6)).toBe("0.001200");
  });

  it("redondea a 6: 10.00 / 3 unidades → 3.333333", () => {
    expect(formatDecimal(unitCostOf(1000n, 3000n)!, 6)).toBe("3.333333");
  });

  it("una compra gratis da costo 0", () => {
    expect(unitCostOf(0n, 1000n)).toBe(0n);
  });

  it("un costo por unidad que no entra en numeric(14,6) → null", () => {
    expect(unitCostOf(999_999_999_999n, 1n)).toBeNull();
  });
});
