import { describe, expect, it } from "vitest";
import { ModuleError } from "../errors";
import { parseLimit, parseNote, parseOccurredAt } from "./movements";

/** Spec 0210 — la validacion de entrada de compras y ajustes, sin base (la de recetas, en
 * `recipes/parse.test.ts`: Stock no importa de Recetas, regla 7 del ADR 0141). */

function codeOf(work: () => unknown): string | null {
  try {
    work();
    return null;
  } catch (error) {
    return error instanceof ModuleError
      ? `${error.status} ${error.code}`
      : "otro";
  }
}

describe("parseOccurredAt", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  it("sin fecha es ahora; hasta 5 minutos al futuro se acepta", () => {
    expect(parseOccurredAt(undefined, now)).toEqual(now);
    expect(parseOccurredAt("2026-10-12T12:05:00Z", now).toISOString()).toBe(
      "2026-10-12T12:05:00.000Z",
    );
    expect(parseOccurredAt("2026-01-01T00:00:00Z", now).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
  it("mas de 5 minutos al futuro, basura u otro tipo → 422 invalid_date", () => {
    for (const raw of ["2026-10-12T12:05:01Z", "ayer", 1760000000000, {}]) {
      expect(codeOf(() => parseOccurredAt(raw, now))).toBe("422 invalid_date");
    }
  });
});

describe("parseNote y parseLimit", () => {
  it("nota: vacia es null, hasta 200, mas o no-string → 422 invalid_note", () => {
    expect(parseNote("  ")).toBeNull();
    expect(parseNote(" ok ")).toBe("ok");
    expect(parseNote("x".repeat(200))).toHaveLength(200);
    expect(codeOf(() => parseNote("x".repeat(201)))).toBe("422 invalid_note");
    expect(codeOf(() => parseNote(5))).toBe("422 invalid_note");
  });
  it("limit: default 50, tope 200", () => {
    expect(parseLimit(null)).toBe(50);
    expect(parseLimit("10")).toBe(10);
    expect(parseLimit("500")).toBe(200);
    expect(parseLimit("-1")).toBe(50);
    expect(parseLimit("abc")).toBe(50);
  });
});
