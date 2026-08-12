import { describe, expect, it } from "vitest";
import { validateConfiguration } from "./loyalty-program";

describe("loyalty program configuration", () => {
  it("accepts valid points and stamps", () => {
    expect(
      validateConfiguration("points", {
        unitSingular: "Punto",
        unitPlural: "Puntos",
      }),
    ).toBeNull();
    expect(
      validateConfiguration("stamps", { unitName: "Sello", target: 10 }),
    ).toBeNull();
  });

  it("rejects invalid configuration and modalities not yet enabled", () => {
    expect(validateConfiguration("points", { unitSingular: "" })).toBeTruthy();
    expect(
      validateConfiguration("stamps", { unitName: "Sello", target: 51 }),
    ).toBeTruthy();
    expect(validateConfiguration("tiers", {})).toBeTruthy();
  });
});
