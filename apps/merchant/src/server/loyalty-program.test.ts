import { describe, expect, it } from "vitest";
import {
  LoyaltyError,
  normalizeConfiguration,
  renderTermsText,
  validateClosingWindow,
  validateProgramInput,
  zonedDateTimeToUtc,
} from "./loyalty-program";
import { isIanaTimezone } from "./timezone";
import { toClientProgram } from "./loyalty-program/client-view";

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

  it("normalizes configuration to whitelisted keys per modality", () => {
    expect(
      normalizeConfiguration("points", {
        unitSingular: " Punto ",
        unitPlural: "Puntos",
        malicious: "x",
      }),
    ).toEqual({ unitSingular: "Punto", unitPlural: "Puntos" });
    expect(
      normalizeConfiguration("stamps", {
        unitName: "Sello",
        target: 8,
        extra: 1,
      }),
    ).toEqual({ unitName: "Sello", target: 8 });
    // The stamp image is a dedicated column now, never persisted in configuration.
    expect(
      normalizeConfiguration("stamps", {
        unitName: "Sello",
        target: 8,
        stampImageObjectKey: "loyalty/x/y/z",
      }),
    ).toEqual({ unitName: "Sello", target: 8 });
  });

  it("strips unknown configuration keys when validating a full payload", () => {
    expect(
      validateProgramInput({
        kind: "points",
        configuration: {
          unitSingular: "Punto",
          unitPlural: "Puntos",
          injected: "nope",
        },
        clauses: [{ text: "Términos." }],
      }).configuration,
    ).toEqual({ unitSingular: "Punto", unitPlural: "Puntos" });
  });

  it("validates the stamp action per modality", () => {
    const stamps = {
      kind: "stamps" as const,
      configuration: { unitName: "Sello", target: 8 },
      clauses: [{ text: "Términos." }],
    };
    // Points cannot carry a stamp action.
    expect(() =>
      validateProgramInput({
        kind: "points",
        configuration: { unitSingular: "Punto", unitPlural: "Puntos" },
        clauses: [{ text: "Términos." }],
        stampAction: "replace",
        stampUploadId: "u",
      }),
    ).toThrow("Solo los Sellos");
    // replace requires an upload id.
    expect(() =>
      validateProgramInput({ ...stamps, stampAction: "replace" }),
    ).toThrow("Selecciona una imagen");
    // an upload id without replace is rejected.
    expect(() =>
      validateProgramInput({
        ...stamps,
        stampAction: "keep",
        stampUploadId: "u",
      }),
    ).toThrow("no corresponde");
    // a valid replace and the default keep.
    expect(
      validateProgramInput({
        ...stamps,
        stampAction: "replace",
        stampUploadId: "u",
      }),
    ).toMatchObject({ stampAction: "replace", stampUploadId: "u" });
    expect(validateProgramInput(stamps)).toMatchObject({ stampAction: "keep" });
  });

  it("validates the closing window against the business zone and clock", () => {
    const tz = "America/Guayaquil";
    const now = new Date("2026-08-12T20:00:00.000Z"); // 15:00 local
    expect(
      validateClosingWindow(
        {
          earningEndsAt: "2026-08-20T12:00",
          redemptionEndsAt: "2026-09-01T12:00",
        },
        tz,
        now,
      ).earningEndsAt.toISOString(),
    ).toBe("2026-08-20T17:00:00.000Z");
    // earning end in the past
    expect(() =>
      validateClosingWindow(
        {
          earningEndsAt: "2026-08-01T12:00",
          redemptionEndsAt: "2026-09-01T12:00",
        },
        tz,
        now,
      ),
    ).toThrow(LoyaltyError);
    // earning end in the past has its own message
    expect(() =>
      validateClosingWindow(
        {
          earningEndsAt: "2026-08-01T12:00",
          redemptionEndsAt: "2026-09-01T12:00",
        },
        tz,
        now,
      ),
    ).toThrow("fecha y hora futuras");
    // earning end not before redemption end
    expect(() =>
      validateClosingWindow(
        {
          earningEndsAt: "2026-09-01T12:00",
          redemptionEndsAt: "2026-08-20T12:00",
        },
        tz,
        now,
      ),
    ).toThrow("posterior al fin de acumulación");
    // malformed datetime
    expect(() =>
      validateClosingWindow(
        { earningEndsAt: "nope", redemptionEndsAt: "2026-09-01T12:00" },
        tz,
        now,
      ),
    ).toThrow(LoyaltyError);
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

  it("never serializes the internal stamp key, only a public path", () => {
    const base = {
      id: "prog-1",
      kind: "stamps",
      stampImageVersion: 3,
      termsMarkdown: "t",
    };
    const withStamp = toClientProgram(
      { ...base, stampImageObjectKey: "loyalty/b/p/a" },
      "biz-1",
    );
    expect(withStamp).not.toHaveProperty("stampImageObjectKey");
    expect(withStamp).toMatchObject({
      stampImagePath: "/api/public/loyalty/biz-1/prog-1/stamp?v=3",
    });
    const withoutStamp = toClientProgram(
      { ...base, stampImageObjectKey: null },
      "biz-1",
    );
    expect(withoutStamp).not.toHaveProperty("stampImageObjectKey");
    expect(withoutStamp).toMatchObject({ stampImagePath: null });
    expect(toClientProgram(null, "biz-1")).toBeNull();
  });
});
