import { describe, expect, it } from "vitest";
import { UNIT_MEASURE, type LineMeasure } from "@mi-pasaporte/domain/measures";
import { expandComposition } from "./expand";
import {
  expandMeasuredComposition,
  type CapturedCompositionBasis,
  type MeasuredRecipeSale,
} from "./expand-measured";

const component = (recipeId: string, quantity = "1.000") => ({
  recipeId,
  recipeRevisionId: `${recipeId}-revision`,
  quantity,
  position: 0,
});
const recipe = (recipeId: string, quantity = "1.000", unit = "g") => ({
  id: `${recipeId}-revision`,
  recipeId,
  name: recipeId,
  lines: [{ itemId: "ingredient", itemName: "Ingrediente", quantity, unit }],
});
const basis: CapturedCompositionBasis = {
  basisQuantity: "1",
  basisUnit: "unit",
  conversionVersion: "mass-si-1",
};
const mass = (
  quantityUnit: "g" | "kg" | "lb",
  priceUnit = quantityUnit,
): LineMeasure => ({
  kind: "mass",
  quantityUnit,
  priceUnit,
  conversionVersion: "mass-si-1",
});
const sale: MeasuredRecipeSale = { quantity: "1", measure: UNIT_MEASURE };
const expand = (
  quantity = "1.000",
  sold = sale,
  capturedBasis = basis,
  componentQuantity = "1.000",
) =>
  expandMeasuredComposition(
    [component("a", componentQuantity)],
    [recipe("a", quantity)],
    sold,
    capturedBasis,
  );

describe("exact captured measured recipe expansion (dormant)", () => {
  it.each([
    ["1.000", "100.000", "2.000", "50.000", 3],
    ["0.400", "0.001", "0.400", "0.001", 1],
    ["0.100", "0.001", "0.100", "0.001", 1],
    ["0.500", "250.000", "12.000", "100.000", 2],
  ])(
    "matches legacy projections for base1unit (%s/%s)",
    (a, aq, b, bq, sold) => {
      const components = [component("b", b), component("a", a)];
      const revisions = [recipe("a", aq), recipe("b", bq)];
      expect(
        expandMeasuredComposition(
          components,
          revisions,
          { ...sale, quantity: String(sold) },
          basis,
        ),
      ).toMatchObject(expandComposition(components, revisions, sold));
    },
  );

  it("keeps exact nonterminating 1g/base1lb factors and both source ratios", () => {
    const result = expand(
      "0.003",
      { quantity: "1", measure: mass("g") },
      { ...basis, basisUnit: "lb" },
      "0.002",
    );
    expect(result.factor).toEqual({
      numerator: "100000",
      denominator: "45359237",
    });
    expect(result.sources[0].recipeQuantityRatio).toEqual({
      numerator: "200",
      denominator: "45359237",
    });
    expect(result.sources[0].exactQuantityRatio).toEqual({
      numerator: "3",
      denominator: "226796185",
    });
    expect(result.sources[0]).toMatchObject({
      recipeQuantity: "0.000",
      exactQuantity: "0.000000",
      allocatedQuantity: "0.000",
    });
    expect(result.ingredients[0].exactQuantityRatio).toEqual(
      result.sources[0].exactQuantityRatio,
    );
    expect(result.rounding[0]).toMatchObject({
      quantity: "0.000",
      reason: "rounded_to_zero",
    });
  });

  it("equivalent kg/lb/g captures and price-unit changes preserve physical results", () => {
    const capturedBasis = {
      ...basis,
      basisUnit: "lb" as const,
      basisQuantity: "2",
    };
    const grams = expand(
      "10.001",
      { quantity: "453.59237", measure: mass("g") },
      capturedBasis,
    );
    expect(
      expand(
        "10.001",
        { quantity: "0.45359237", measure: mass("kg", "lb") },
        capturedBasis,
      ),
    ).toEqual(grams);
    expect(
      expand(
        "10.001",
        { quantity: "1", measure: mass("lb", "kg") },
        capturedBasis,
      ),
    ).toEqual(grams);
    expect(
      expand(
        "10.001",
        { quantity: "453.59237", measure: mass("g", "kg") },
        capturedBasis,
      ),
    ).toEqual(grams);
    expect(grams.ingredients[0].quantity).toBe("5.001");
  });

  it("consolidates before rounding and allocates exact residues independent of component order", () => {
    const components = [component("b", "0.400"), component("a", "0.400")];
    const revisions = [recipe("a", "0.001"), recipe("b", "0.001")];
    const run = (parts: typeof components) =>
      expandMeasuredComposition(parts, revisions, sale, basis);
    const result = run(components);
    expect(result.ingredients[0].quantity).toBe("0.001");
    const allocation = (value: typeof result) =>
      value.sources.map((s) => [s.recipeId, s.allocatedQuantity]).sort();
    expect(allocation(result)).toEqual([
      ["a", "0.001"],
      ["b", "0.000"],
    ]);
    expect(allocation(run([...components].reverse()))).toEqual(
      allocation(result),
    );
    // A nonterminating factor keeps unequal residues exact, too.
    const rational = expandMeasuredComposition(
      [component("a", "0.200"), component("b", "0.300")],
      revisions,
      { quantity: "1", measure: mass("g") },
      { ...basis, basisUnit: "lb" },
    );
    expect(rational.ingredients[0].quantity).toBe("0.000");
    expect(rational.sources.every((s) => s.allocatedQuantity === "0.000")).toBe(
      true,
    );
  });

  it("compares rational residues that collapse to the same scale6 projection", () => {
    const result = expandMeasuredComposition(
      [component("a", "0.500"), component("b", "0.501")],
      [recipe("a", "0.001"), recipe("b", "0.001")],
      { ...sale, quantity: "999" },
      { ...basis, basisQuantity: "1000" },
    );
    expect(result.ingredients[0].quantity).toBe("0.001");
    expect(result.sources.map((s) => s.exactQuantity)).toEqual([
      "0.000500",
      "0.000500",
    ]);
    expect(result.sources.map((s) => s.allocatedQuantity)).toEqual([
      "0.000",
      "0.001",
    ]);
  });

  it("retains zero-ledger provenance and compares rounding against ratios rather than rounded scale6", () => {
    const result = expand(
      "0.001",
      { quantity: "0.000000001", measure: mass("g") },
      { ...basis, basisUnit: "g" },
      "0.001",
    );
    expect(result.sources[0].exactQuantityRatio).toEqual({
      numerator: "1",
      denominator: "1000000000000000",
    });
    expect(result.rounding[0].reason).toBe("rounded_to_zero");
    expect(result.ingredients[0].quantity).toBe("0.000");
    expect(result).not.toHaveProperty("movement");
    expect(result).not.toHaveProperty("cost");
  });

  it("detects rounding hidden by scale6 and allocates nonterminating remainders", () => {
    const almostOne = expand(
      "0.001",
      { quantity: "1", measure: mass("g") },
      { ...basis, basisUnit: "lb" },
      "453592.369",
    );
    expect(almostOne.ingredients[0]).toMatchObject({
      exactQuantity: "1.000000",
      quantity: "1.000",
      roundingReason: "precision_changed",
    });
    expect(almostOne.rounding).toHaveLength(1);
    const result = expandMeasuredComposition(
      [component("b", "454"), component("a", "453")],
      [recipe("a", "0.001"), recipe("b", "0.001")],
      { quantity: "1", measure: mass("g") },
      { ...basis, basisUnit: "lb" },
    );
    expect(result.ingredients[0].quantity).toBe("0.002");
    expect(result.sources.map((source) => source.allocatedQuantity)).toEqual([
      "0.001",
      "0.001",
    ]);
    expect(result.sources[0].exactQuantityRatio.denominator).toBe("45359237");
  });

  it("validates captured recipe numeric14,3 independently from nine-place product captures", () => {
    expect(expand("1000000000.000").ingredients[0].quantity).toBe(
      "1000000000.000",
    );
    expect(() => expand("1.0000")).toThrow();
    expect(() => expand("100000000000.000")).toThrow();
    expect(() => expand("1", sale, basis, "1.0001")).toThrow();
  });

  it("bounds V4 trusted units at INT32 without changing legacy safeInteger support", () => {
    expect(
      expand("0.001", {
        ...sale,
        quantity: "2147483647.000000000",
        quantitySource: "trusted-unit-snapshot",
      }).sources[0].recipeQuantity,
    ).toBe("2147483647.000");
    expect(() =>
      expand("0.001", { ...sale, quantity: "2147483647" }),
    ).toThrow();
    expect(() =>
      expand("0.001", {
        ...sale,
        quantity: "2147483648",
        quantitySource: "trusted-unit-snapshot",
      }),
    ).toThrow();
    expect(() =>
      expand(
        "0.001",
        {
          quantity: "1",
          measure: mass("g"),
          quantitySource: "trusted-unit-snapshot",
        },
        { ...basis, basisUnit: "g" },
      ),
    ).toThrow();
    expect(
      expandComposition(
        [component("a", "0.001")],
        [recipe("a", "0.001")],
        Number.MAX_SAFE_INTEGER,
      ).ingredients[0].quantity,
    ).toBe("9007199254.741");
  });

  it("checks ledger overflow after final rounding, retaining the largest representable value", () => {
    expect(expand("99999999999.999").ingredients[0].quantity).toBe(
      "99999999999.999",
    );
    expect(() => expand("99999999999.999", { ...sale, quantity: "2" })).toThrow(
      "máxima",
    );
    const components = [component("a"), component("b", "0.500")];
    expect(() =>
      expandMeasuredComposition(
        components,
        [recipe("a", "99999999999.999"), recipe("b", "0.001")],
        sale,
        basis,
      ),
    ).toThrow("máxima");
  });

  it.each(["0", "-1", "1e2", "1.0000000001", "1000000000", "NaN"])(
    "rejects invalid mass capture %s",
    (quantity) => {
      expect(() =>
        expand(
          "1",
          { quantity, measure: mass("g") },
          { ...basis, basisUnit: "g" },
        ),
      ).toThrow();
    },
  );

  it("rejects absent, zero, fractional unit, incompatible or unversioned bases and invalid measures", () => {
    for (const bad of [
      undefined,
      { ...basis, basisQuantity: "0" },
      { ...basis, basisQuantity: "1.5" },
      { ...basis, basisUnit: "g" },
      { ...basis, conversionVersion: "next" },
    ])
      expect(() =>
        expandMeasuredComposition(
          [component("a")],
          [recipe("a")],
          sale,
          bad as CapturedCompositionBasis,
        ),
      ).toThrow();
    expect(() =>
      expand("1", {
        ...sale,
        measure: { ...UNIT_MEASURE, priceUnit: "g" } as LineMeasure,
      }),
    ).toThrow();
  });

  it("rejects invalid snapshots, missing/foreign revisions and inconsistent ingredient units", () => {
    for (const quantity of ["0", "-1", "1e2", "NaN"])
      expect(() => expand(quantity)).toThrow();
    expect(() =>
      expandMeasuredComposition([component("a")], [], sale, basis),
    ).toThrow("unavailable");
    expect(() =>
      expandMeasuredComposition(
        [component("a")],
        [{ ...recipe("a"), recipeId: "b" }],
        sale,
        basis,
      ),
    ).toThrow("unavailable");
    expect(() =>
      expandMeasuredComposition(
        [component("a"), component("b")],
        [recipe("a", "1", "g"), recipe("b", "1", "kg")],
        sale,
        basis,
      ),
    ).toThrow("Inconsistent");
  });
});
