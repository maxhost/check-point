import { describe, expect, it } from "vitest";
import { expandComposition } from "./expand";

const recipe = (id: string, quantity: string) => ({
  id,
  recipeId: id,
  name: id,
  lines: [{ itemId: "carne", itemName: "Carne", unit: "g", quantity }],
});
const component = (id: string, quantity = "1.000", position = 0) => ({
  recipeId: id,
  recipeRevisionId: id,
  quantity,
  position,
});
describe("R1 consolidated decimal expansion and provenance", () => {
  it("consolidates shared ingredient but keeps recipe sources", () => {
    const result = expandComposition(
      [component("a"), component("b", "2.000", 1)],
      [recipe("a", "100.000"), recipe("b", "50.000")],
      3,
    );
    expect(result.ingredients).toEqual([
      {
        itemId: "carne",
        itemName: "Carne",
        unit: "g",
        exactQuantity: "600.000000",
        quantity: "600.000",
      },
    ]);
    expect(
      result.sources.map((s) => [
        s.recipeId,
        s.recipeQuantity,
        s.exactQuantity,
        s.allocatedQuantity,
      ]),
    ).toEqual([
      ["a", "3.000", "300.000000", "300.000"],
      ["b", "6.000", "300.000000", "300.000"],
    ]);
  });
  it("rounds once after sold units and allocates largest remainder deterministically", () => {
    const result = expandComposition(
      [component("b", "0.400", 1), component("a", "0.400")],
      [recipe("a", "0.001"), recipe("b", "0.001")],
    );
    expect(result.ingredients[0].quantity).toBe("0.001");
    expect(
      result.sources.map((s) => [
        s.recipeId,
        s.exactQuantity,
        s.allocatedQuantity,
      ]),
    ).toEqual([
      ["b", "0.000400", "0.000"],
      ["a", "0.000400", "0.001"],
    ]);
    expect(
      expandComposition([component("a", "0.400")], [recipe("a", "0.001")], 3)
        .ingredients[0].quantity,
    ).toBe("0.001");
  });
  it("keeps positive exact sources when rounded ledger quantity is zero", () => {
    const result = expandComposition(
      [component("a", "0.100")],
      [recipe("a", "0.001")],
    );
    expect(result.sources[0]).toMatchObject({
      exactQuantity: "0.000100",
      allocatedQuantity: "0.000",
    });
    expect(result.rounding[0]).toMatchObject({
      reason: "rounded_to_zero",
      quantity: "0.000",
    });
  });
  it("half pizza and dozen use quantities per independent recipe unit", () => {
    expect(
      expandComposition([component("a", "0.500")], [recipe("a", "250.000")])
        .ingredients[0].quantity,
    ).toBe("125.000");
    expect(
      expandComposition([component("a", "12.000")], [recipe("a", "100.000")])
        .ingredients[0].quantity,
    ).toBe("1200.000");
  });
  it("rejects missing/cross-recipe revisions and ledger overflow", () => {
    expect(() => expandComposition([component("a")], [])).toThrow(
      "unavailable",
    );
    expect(() =>
      expandComposition(
        [component("a")],
        [{ ...recipe("a", "1.000"), recipeId: "b" }],
      ),
    ).toThrow("unavailable");
    expect(() =>
      expandComposition(
        [component("a", "2.000")],
        [recipe("a", "99999999999.999")],
      ),
    ).toThrow("máxima");
  });
});
