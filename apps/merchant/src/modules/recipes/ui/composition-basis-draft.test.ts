import { describe, expect, it } from "vitest";
import { defaultBasis, readBasis, validBasis } from "./composition-basis-draft";
import { compositionPayload } from "./recipe-types";
describe("base explícita exacta", () => {
  it("solo ausencia completa admite legacy", () => {
    expect(readBasis({})).toEqual(defaultBasis());
    for (const data of [
      { basisQuantity: "2" },
      { basisUnit: "kg" as const },
      { basisQuantity: "1", basisUnit: "unit" as const },
    ])
      expect(() => readBasis(data)).toThrow();
  });
  it("captura9dec sin floats ni conversión implícita", () => {
    expect(
      validBasis({
        ...defaultBasis(),
        basisQuantity: "1,123456789",
        basisUnit: "lb",
      }).basisQuantity,
    ).toBe("1.123456789");
    for (const value of ["0", "1e3", "1.2", "1.0000000000", "1000000000"])
      expect(() =>
        validBasis({ ...defaultBasis(), basisQuantity: value }),
      ).toThrow();
  });
  it("payload anterior compatible y nuevo explícito", () => {
    const component = [{ recipeId: "r", recipeName: "Masa", quantity: "2" }];
    expect(compositionPayload(false, component, "rev")).toEqual({
      isCombo: false,
      recipes: [{ recipeId: "r", quantity: "2" }],
      expectedRevisionId: "rev",
    });
    expect(
      compositionPayload(false, component, "rev", {
        ...defaultBasis(),
        basisQuantity: "100",
        basisUnit: "g",
      }),
    ).toMatchObject({
      basisQuantity: "100",
      basisUnit: "g",
      conversionVersion: "mass-si-1",
    });
  });
});
