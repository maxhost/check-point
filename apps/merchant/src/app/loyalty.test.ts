import { describe, expect, it } from "vitest";
import { empty } from "./demo";
import { normalizedLoyaltyProgram, validateLoyaltyProgram } from "./loyalty";

describe("loyalty program validation", () => {
  it("requires both point unit names", () => {
    const program = { ...empty.loyaltyProgram, pointUnitPlural: "" };
    expect(validateLoyaltyProgram(program, "points")).toBeTruthy();
  });

  it("accepts a valid stamp card and rejects an invalid target", () => {
    const valid = {
      ...empty.loyaltyProgram,
      stampUnitName: "Visita",
      stampTarget: 8,
    };
    expect(validateLoyaltyProgram(valid, "stamps")).toBeNull();
    expect(
      validateLoyaltyProgram({ ...valid, stampTarget: 51 }, "stamps"),
    ).toBeTruthy();
  });

  it("normalizes unit labels before persisting", () => {
    expect(
      normalizedLoyaltyProgram({
        ...empty.loyaltyProgram,
        pointUnitSingular: " Punto ",
        pointUnitPlural: " Puntos ",
      }),
    ).toMatchObject({ pointUnitSingular: "Punto", pointUnitPlural: "Puntos" });
  });
});
