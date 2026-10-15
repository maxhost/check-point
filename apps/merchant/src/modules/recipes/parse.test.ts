import { describe, expect, it } from "vitest";
import { ModuleError } from "../errors";
import { MAX_RECIPE_LINES } from "./server/contracts";
import { parseRecipeLines } from "./server/model/input";

/** Spec 0210 — la validacion de entrada de las recetas, sin base. Mudado de `stock/parse.test.ts`
 * (spec 0220): Stock no puede importar de Recetas, que no esta en su `requires` (regla 7). */

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
