import { describe, expect, it } from "vitest";
import { renderTermsText, validateConfiguration } from "./loyalty-program";

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

  it("renders only explicitly allowed terms variables", () => {
    expect(
      renderTermsText(
        "Programa de {{business_legal_name}}.",
        { business_legal_name: "LaCraft" },
        ["business_legal_name"],
      ),
    ).toBe("Programa de LaCraft.");
    expect(() =>
      renderTermsText("{{unknown}}", {}, ["business_legal_name"]),
    ).toThrow("no está permitida");
  });
});
