import { describe, expect, it } from "vitest";
import {
  consumptionAmount,
  consumptionMinorUnits,
  formatConsumptionAmount,
} from "../consumption-money";
import {
  summarizeConsumptionCost,
  type CostMovement,
  type ExpectedCostLine,
} from "./consumption-cost";

const line: ExpectedCostLine = {
  sourceLineId: "l1",
  productId: "p1",
  recipe: "present",
  consumptions: [{ itemId: "i1", quantity: "3.000" }],
};
const movement: CostMovement = {
  sourceLineId: "l1",
  productId: "p1",
  itemId: "i1",
  quantity: "-3.000",
  consumptionUnitCost: "2.666667",
  consumptionLossFactor: "1.000000",
  consumptionCurrencyCode: "USD",
  consumptionMinorUnits: 2,
};
const applied = { state: "applied" } as const;

describe("0230 exact consumption valuation and coverage", () => {
  it("preserves six decimal costs and rounds once in the currency minimum unit", () => {
    const amount = consumptionAmount("-3.000", "2.666667", "1.000000");
    expect(amount).toBe(8000001000000000n);
    expect(formatConsumptionAmount(amount, 2)).toBe("8.00");
    expect(formatConsumptionAmount(amount, 0)).toBe("8");
    for (const code of ["COP", "CLP", "JPY", "PYG"])
      expect(consumptionMinorUnits(code)).toBe(0);
    expect(consumptionMinorUnits("USD")).toBe(2);
    expect(() => consumptionMinorUnits("ZZZ")).toThrow("Unsupported");
    expect(() => formatConsumptionAmount(amount, 3)).toThrow("Invalid");
  });

  it("sums exact movements instead of rounded lines, also for amounts beyond a purchase column", () => {
    const l2 = {
      ...line,
      sourceLineId: "l2",
      consumptions: [{ itemId: "i1", quantity: "1.000" }],
    };
    const l1 = { ...line, consumptions: [{ itemId: "i1", quantity: "1.000" }] };
    const m1 = {
      ...movement,
      quantity: "-1.000",
      consumptionUnitCost: "5.005000",
    };
    const result = summarizeConsumptionCost([l1, l2], applied, [
      m1,
      { ...m1, sourceLineId: "l2" },
    ]);
    expect(result.knownCost).toBe("10.01");
    expect(result.lines.map((l) => l.knownCost)).toEqual(["5.01", "5.01"]);
    expect(
      formatConsumptionAmount(
        consumptionAmount("-99999999999.999", "99999999.999999", "1.000000"),
        2,
      ),
    ).toBe("9999999999999800000.00");
  });

  it("known positive COP0.25 rounds to complete zero; unknown and no movements stay null", () => {
    const l = { ...line, consumptions: [{ itemId: "i1", quantity: "1.000" }] };
    const m = {
      ...movement,
      quantity: "-1.000",
      consumptionUnitCost: "0.250000",
      consumptionCurrencyCode: "COP",
      consumptionMinorUnits: 0,
    };
    expect(summarizeConsumptionCost([l], applied, [m])).toMatchObject({
      state: "completo",
      knownCost: "0",
      currencyCode: "COP",
    });
    expect(
      summarizeConsumptionCost([l], applied, [
        { ...m, consumptionUnitCost: null },
      ]),
    ).toMatchObject({
      state: "incompleto",
      knownCost: null,
      missingPrices: [{ itemId: "i1", sourceLineIds: ["l1"] }],
    });
    expect(
      summarizeConsumptionCost([], { state: "unknown" }, []),
    ).toMatchObject({ state: "incompleto", knownCost: null });
    expect(summarizeConsumptionCost([l], applied, [])).toMatchObject({
      state: "incompleto",
      knownCost: null,
      reasons: ["consumo_inconsistente"],
    });
    expect(
      summarizeConsumptionCost([l], applied, [
        { ...m, consumptionUnitCost: "0.000000" },
      ]),
    ).toMatchObject({ state: "completo", knownCost: "0" });
  });

  it("lists missing recipes and prices, preserving a known zero partial and pending precedence", () => {
    const missingRecipe = {
      ...line,
      sourceLineId: "no-recipe",
      recipe: "absent",
      consumptions: [],
    } as const;
    const extraIngredient = {
      ...line,
      consumptions: [...line.consumptions, { itemId: "i2", quantity: "1.000" }],
    };
    const rows = [
      { ...movement, consumptionUnitCost: "0.000000" },
      {
        ...movement,
        itemId: "i2",
        quantity: "-1.000",
        consumptionUnitCost: null,
      },
    ];
    const result = summarizeConsumptionCost(
      [extraIngredient, { ...missingRecipe, consumptions: [] }],
      applied,
      rows,
    );
    expect(result).toMatchObject({
      state: "incompleto",
      knownCost: "0.00",
      missingRecipes: [{ sourceLineId: "no-recipe", productId: "p1" }],
      missingPrices: [{ itemId: "i2", sourceLineIds: ["l1"] }],
    });
    const pending = summarizeConsumptionCost(
      [line, { ...missingRecipe, consumptions: [] }],
      { state: "pending" },
      [],
    );
    expect(pending.state).toBe("pendiente");
    expect(pending.lines.map((l) => l.state)).toEqual([
      "pendiente",
      "incompleto",
    ]);
    expect(
      summarizeConsumptionCost([line], { state: "processing" }, []).state,
    ).toBe("pendiente");
    expect(
      summarizeConsumptionCost(
        [line],
        { state: "skipped", terminalReason: "permanent_failure" },
        [],
      ).state,
    ).toBe("incompleto");
  });

  it("never completes a legacy snapshot, conflicting quantity/product or mixed currency", () => {
    const legacy = {
      ...movement,
      consumptionUnitCost: null,
      consumptionLossFactor: null,
      consumptionCurrencyCode: null,
      consumptionMinorUnits: null,
    };
    expect(summarizeConsumptionCost([line], applied, [legacy])).toMatchObject({
      state: "incompleto",
      knownCost: null,
      reasons: ["snapshot_ausente"],
    });
    for (const changed of [
      { ...movement, quantity: "-2.000" },
      { ...movement, productId: "other" },
    ])
      expect(summarizeConsumptionCost([line], applied, [changed]).state).toBe(
        "incompleto",
      );
    const result = summarizeConsumptionCost(
      [line, { ...line, sourceLineId: "l2" }],
      applied,
      [
        movement,
        {
          ...movement,
          sourceLineId: "l2",
          consumptionCurrencyCode: "COP",
          consumptionMinorUnits: 0,
        },
      ],
    );
    expect(result).toMatchObject({
      state: "incompleto",
      knownCost: null,
      currencyCode: null,
    });
    expect(result.reasons).toContain("moneda_inconsistente");
  });
});
