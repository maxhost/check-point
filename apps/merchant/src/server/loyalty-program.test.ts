import { describe, expect, it } from "vitest";
import {
  LoyaltyError,
  renderTermsText,
  validateProgramInput,
  zonedDateTimeToUtc,
} from "./loyalty-program";
import { isIanaTimezone } from "./timezone";

describe("loyalty program contract", () => {
  it("accepts Puntos and Sellos and rejects malformed payloads with 422", () => {
    expect(
      validateProgramInput({
        kind: "points",
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        clauses: [{ text: "Términos." }],
      }),
    ).toMatchObject({ kind: "points" });
    expect(
      validateProgramInput({
        kind: "stamps",
        configuration: { unitName: "Sello", target: 10 },
        clauses: [{ text: "Términos." }],
      }),
    ).toMatchObject({ kind: "stamps" });
    expect(() =>
      validateProgramInput({
        kind: "points",
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        clauses: "hola",
      }),
    ).toThrow(LoyaltyError);
    expect(() =>
      validateProgramInput({
        kind: "points",
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        clauses: "hola",
      }),
    ).toThrow("cláusulas");
  });

  it("converts business-local times to UTC and rejects a DST gap", () => {
    expect(isIanaTimezone("America/Guayaquil")).toBe(true);
    expect(isIanaTimezone("not-a-timezone")).toBe(false);
    expect(
      zonedDateTimeToUtc(
        "2026-08-12T15:00",
        "America/Guayaquil",
      )?.toISOString(),
    ).toBe("2026-08-12T20:00:00.000Z");
    expect(
      zonedDateTimeToUtc("2026-09-06T00:30", "America/Santiago"),
    ).toBeNull();
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
