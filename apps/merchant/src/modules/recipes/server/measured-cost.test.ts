import { describe, expect, it } from "vitest";
import { projectRecipeCostIngredients, recipeCostMoney } from "./measured-cost";
import { parseCompositionBasis } from "./model/input";
import type { CapturedCompositionBasis } from "./model/expand-measured";
const components = [
  { recipeId: "r", recipeRevisionId: "v", quantity: "1.000", position: 0 },
];
const revisions = [
  {
    id: "v",
    recipeId: "r",
    name: "Recipe",
    lines: [{ itemId: "i", itemName: "Flour", unit: "g", quantity: "100.000" }],
  },
];
const basis = (
  quantity: string,
  unit: CapturedCompositionBasis["basisUnit"],
): CapturedCompositionBasis => ({
  basisQuantity: quantity,
  basisUnit: unit,
  conversionVersion: "mass-si-1",
});
describe("comparable recipe costs", () => {
  it.each([
    ["1", "100.000"],
    ["2", "50.000"],
    ["10", "10.000"],
  ])("projects unit basis %s before valuation", (quantity, expected) => {
    expect(
      projectRecipeCostIngredients(
        components,
        revisions,
        basis(quantity, "unit"),
        { soldByWeight: false, pricingUnit: "unit" },
      )?.ingredients[0].quantity,
    ).toBe(expected);
  });
  it.each([
    ["kg", "220.462"],
    ["lb", "100.000"],
    ["g", "0.220"],
  ])("projects 100g per 1lb for a %s tariff", (pricingUnit, expected) => {
    expect(
      projectRecipeCostIngredients(components, revisions, basis("1", "lb"), {
        soldByWeight: true,
        pricingUnit,
      })?.ingredients[0].quantity,
    ).toBe(expected);
  });
  it("consolidates shared ingredients before the single ledger rounding", () => {
    const parts = [
      { recipeId: "a", recipeRevisionId: "av", quantity: "0.500", position: 0 },
      { recipeId: "b", recipeRevisionId: "bv", quantity: "0.500", position: 1 },
    ];
    const captured = parts.map((c) => ({
      id: c.recipeRevisionId,
      recipeId: c.recipeId,
      name: c.recipeId,
      lines: [{ itemId: "i", itemName: "Flour", unit: "g", quantity: "0.001" }],
    }));
    const projected = projectRecipeCostIngredients(
      parts,
      captured,
      basis("2", "unit"),
      { soldByWeight: false, pricingUnit: "unit" },
    )!;
    expect(projected.ingredients).toHaveLength(1);
    expect(projected.ingredients[0]).toMatchObject({
      quantity: "0.001",
      exactQuantityRatio: { numerator: "1", denominator: "2000" },
    });
  });
  it("does not infer piece to mass conversion", () => {
    expect(
      projectRecipeCostIngredients(components, revisions, basis("1", "kg"), {
        soldByWeight: false,
        pricingUnit: "unit",
      }),
    ).toBeNull();
    expect(
      projectRecipeCostIngredients(components, revisions, basis("1", "unit"), {
        soldByWeight: true,
        pricingUnit: "kg",
      }),
    ).toBeNull();
  });
  it("retains positive tiny ingredients even when no ledger quantity exists", () => {
    const projected = projectRecipeCostIngredients(
      components,
      revisions,
      basis("999999999", "unit"),
      { soldByWeight: false, pricingUnit: "unit" },
    )!;
    expect(projected.ingredients[0]).toMatchObject({
      quantity: "0.000",
      roundingReason: "rounded_to_zero",
    });
    expect(projected.ingredients[0].exactQuantityRatio.numerator).not.toBe("0");
    expect(recipeCostMoney(0n, "1", "USD", false)).toMatchObject({
      recipeCost: null,
      profit: null,
      marginPercent: null,
    });
  });
  it("retains valid legacy figures, zero and missing prices", () => {
    expect(recipeCostMoney(209800000n, "2.000000000", "USD", true)).toEqual({
      recipeCost: "0.21",
      price: "2.00",
      profit: "1.79",
      marginPercent: "89.5",
    });
    expect(recipeCostMoney(0n, "0", "USD", true)).toEqual({
      recipeCost: "0.00",
      price: "0.00",
      profit: "0.00",
      marginPercent: null,
    });
    expect(recipeCostMoney(0n, null, "USD", true).price).toBeNull();
    expect(recipeCostMoney(0n, "9999999999.99", "USD", true).price).toBe(
      "9999999999.99",
    );
  });
  it("normalizes nine-place original tariffs in the business currency", () => {
    expect(recipeCostMoney(0n, "0.005000001", "USD", true).price).toBe("0.01");
    expect(recipeCostMoney(0n, "10.500000001", "COP", true).price).toBe("11");
    expect(recipeCostMoney(0n, "10.499999999", "JPY", true).price).toBe("10");
  });
});
describe("composition basis HTTP input", () => {
  it("distinguishes omitted legacy fields from explicit captures", () => {
    expect(parseCompositionBasis({})).toEqual({});
    expect(
      parseCompositionBasis({
        basisQuantity: "2.000000000",
        basisUnit: "unit",
      }),
    ).toEqual(basis("2", "unit"));
    expect(
      parseCompositionBasis({ basisQuantity: "0.000000001", basisUnit: "lb" }),
    ).toEqual(basis("0.000000001", "lb"));
  });
  it.each([
    { basisQuantity: "1" },
    { basisUnit: "kg" },
    { basisQuantity: null, basisUnit: "kg" },
    { basisQuantity: "0", basisUnit: "kg" },
    { basisQuantity: "-1", basisUnit: "kg" },
    { basisQuantity: "1", basisUnit: "l" },
    { basisQuantity: "1.5", basisUnit: "unit" },
    { basisQuantity: "1e2", basisUnit: "kg" },
    { basisQuantity: "1.0000000001", basisUnit: "kg" },
    { basisQuantity: "1000000000", basisUnit: "kg" },
    { basisQuantity: "1", basisUnit: "kg", conversionVersion: null },
    { conversionVersion: "mass-si-1" },
    { basisQuantity: undefined, basisUnit: undefined },
  ])("rejects partial or invalid captures %j", (body) => {
    expect(() => parseCompositionBasis(body)).toThrow();
  });
});
