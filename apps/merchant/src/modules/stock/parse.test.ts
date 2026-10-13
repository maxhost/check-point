import { describe, expect, it } from "vitest";
import { ModuleError } from "../errors";
import { parseLimit, parseNote, parseOccurredAt } from "./movements";
import { MAX_RECIPE_LINES, parseRecipeLines } from "../recipes/recipes";

/** Spec 0210 — la validacion de entrada de compras, ajustes y recetas, sin base. */

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

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

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

describe("parseRecipeLines", () => {
  it("lineas validas, en orden", () => {
    expect(
      parseRecipeLines({
        lines: [
          { itemId: ID_A, quantity: "200" },
          { itemId: ID_B, quantity: 0.5 },
        ],
      }),
    ).toEqual([
      { itemId: ID_A, quantity: 200000n },
      { itemId: ID_B, quantity: 500n },
    ]);
    expect(parseRecipeLines({ lines: [] })).toEqual([]);
  });
  it("errores del contrato", () => {
    expect(codeOf(() => parseRecipeLines({}))).toBe("422 invalid_body");
    const many = Array.from({ length: MAX_RECIPE_LINES + 1 }, () => ({
      itemId: ID_A,
      quantity: 1,
    }));
    expect(codeOf(() => parseRecipeLines({ lines: many }))).toBe(
      "422 too_many_lines",
    );
    expect(
      codeOf(() =>
        parseRecipeLines({
          lines: [
            { itemId: ID_A, quantity: 1 },
            { itemId: ID_A.toUpperCase(), quantity: 2 },
          ],
        }),
      ),
    ).toBe("422 duplicate_item");
    for (const quantity of [0, -1, "0.000"]) {
      expect(
        codeOf(() => parseRecipeLines({ lines: [{ itemId: ID_A, quantity }] })),
      ).toBe("422 invalid_quantity");
    }
    expect(
      codeOf(() =>
        parseRecipeLines({ lines: [{ itemId: ID_A, quantity: "1.0001" }] }),
      ),
    ).toBe("422 invalid_number");
    expect(
      codeOf(() =>
        parseRecipeLines({ lines: [{ itemId: "no-uuid", quantity: 1 }] }),
      ),
    ).toBe("404 item_not_found");
  });
});
