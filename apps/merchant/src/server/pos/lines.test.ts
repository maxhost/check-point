import { describe, expect, it } from "vitest";
import {
  type IncomingLine,
  MAX_LINES,
  lineTotalOf,
  mergeLines,
  normalizeTableLabel,
  parseIncomingLines,
  totalOf,
} from "./lines";

/** Spec 0169 §Plan de pruebas (unit): el total en centavos, el nombre de la mesa y el merge
 * de lineas del `PUT`. */

const L1 = "11111111-1111-4111-8111-111111111111";
const L2 = "22222222-2222-4222-8222-222222222222";
const L3 = "33333333-3333-4333-8333-333333333333";

const line = (lineId: string | null, quantity: unknown = 1): IncomingLine => ({
  lineId,
  quantity,
  raw: { lineId, quantity, productId: "p" },
});

describe("el total de la orden, en centavos", () => {
  it("suma linea por linea sin arrastrar el error de punto flotante", () => {
    // 0.10 × 3 = 0.30000000000000004 en punto flotante; sumado en centavos, exacto.
    expect(
      totalOf([
        { unitPrice: "0.10", quantity: 3 },
        { unitPrice: "0.20", quantity: 1 },
      ]),
    ).toBe("0.50");
    expect(totalOf([{ unitPrice: "1.15", quantity: 3 }])).toBe("3.45");
    expect(
      totalOf(
        Array.from({ length: 10 }, () => ({ unitPrice: "0.10", quantity: 1 })),
      ),
    ).toBe("1.00");
  });

  it("una orden vacia suma 0.00, y la linea usa el mismo calculo que `buildDetailed`", () => {
    expect(totalOf([])).toBe("0.00");
    expect(lineTotalOf("3.50", 2)).toBe("7.00");
    expect(lineTotalOf("12.99", 7)).toBe((12.99 * 7).toFixed(2));
  });
});

describe("el nombre de la mesa", () => {
  it("recorta espacios y acepta de 1 a 60 caracteres", () => {
    expect(normalizeTableLabel("  Mesa 4  ")).toBe("Mesa 4");
    expect(normalizeTableLabel("x".repeat(60))).toHaveLength(60);
  });

  it.each<unknown>(["", "   ", "x".repeat(61), null, 4])(
    "rechaza %j con 422 `invalid_table_label`",
    (value) => {
      expect(() => normalizeTableLabel(value)).toThrowError(
        expect.objectContaining({ status: 422, code: "invalid_table_label" }),
      );
    },
  );
});

describe("el merge de lineas del PUT", () => {
  it("conserva las existentes (solo cantidad y posicion), borra las ausentes y agrega las nuevas en su lugar", () => {
    const merge = mergeLines(
      [L1, L2, L3],
      [line(null, 2), line(L3, 5), line(L1)],
    );
    expect(merge.kept).toEqual([
      { id: L3, quantity: 5, position: 1 },
      { id: L1, quantity: 1, position: 2 },
    ]);
    expect(merge.removed).toEqual([L2]);
    expect(merge.added).toEqual([
      { raw: { lineId: null, quantity: 2, productId: "p" }, position: 0 },
    ]);
  });

  it("un `lineId` que no es de la orden → 422 `unknown_line`", () => {
    expect(() => mergeLines([L1], [line(L2)])).toThrowError(
      expect.objectContaining({ status: 422, code: "unknown_line" }),
    );
  });

  it("un `lineId` repetido o una cantidad invalida → 422 `invalid_input`", () => {
    expect(() => mergeLines([L1], [line(L1), line(L1)])).toThrowError(
      expect.objectContaining({ code: "invalid_input" }),
    );
    expect(() => mergeLines([L1], [line(L1, 0)])).toThrowError(
      expect.objectContaining({ code: "invalid_input" }),
    );
  });

  it("la lista vacia borra todo; crear (sin existentes) solo agrega", () => {
    expect(mergeLines([L1, L2], [])).toEqual({
      kept: [],
      removed: [L1, L2],
      added: [],
    });
    expect(mergeLines([], [line(null), line(null)]).added).toHaveLength(2);
  });

  it(`mas de ${MAX_LINES} lineas → 422 \`too_many_items\`; un lineId mal formado → \`unknown_line\``, () => {
    expect(() =>
      parseIncomingLines(
        Array.from({ length: MAX_LINES + 1 }, () => ({
          productId: "p",
          quantity: 1,
        })),
      ),
    ).toThrowError(expect.objectContaining({ code: "too_many_items" }));
    expect(parseIncomingLines(undefined)).toEqual([]);
    expect(() => parseIncomingLines([{ lineId: "no-uuid" }])).toThrowError(
      expect.objectContaining({ code: "unknown_line" }),
    );
  });
});
