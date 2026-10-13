import { describe, expect, it } from "vitest";
import { normalizeRecipeDraft } from "./draft";

/** Spec 0214 — el servidor no confia en la salida del modelo, y la receta queda POR UNIDAD. */

const H = "11111111-1111-4111-8111-111111111111";
const L = "22222222-2222-4222-8222-222222222222";
const items = [
  { id: H, name: "Harina", unit: "g" },
  { id: L, name: "Leche", unit: "ml" },
];
const line = (over: Record<string, unknown>) => ({
  itemId: null,
  name: "Manteca",
  quantity: "250",
  unit: "g",
  sourceText: "250 de manteca",
  ...over,
});

describe("normalizeRecipeDraft (spec 0214)", () => {
  it("kg → g y divide por el rendimiento (1 kg para 40 medialunas = 25 g)", () => {
    const d = normalizeRecipeDraft(
      {
        yield: 40,
        lines: [line({ itemId: H, name: "harina", quantity: "1", unit: "kg" })],
        unparsed: [],
      },
      items,
    );
    expect(d.yield).toBe(40);
    expect(d.lines).toEqual([
      {
        itemId: H,
        name: "Harina",
        isNew: false,
        quantity: "25.000",
        unit: "g",
        sourceText: "250 de manteca",
      },
    ]);
  });

  it("yield invalido vale 1; «a gusto» queda sin cantidad; redondeo a 0 queda null", () => {
    const d = normalizeRecipeDraft(
      {
        yield: -3,
        lines: [
          line({ name: "Oregano", quantity: null }),
          line({ name: "Sal", quantity: "0.001" }),
        ],
        unparsed: [],
      },
      items,
    );
    expect(d.yield).toBe(1);
    expect(d.lines.map((l) => l.quantity)).toEqual([null, "0.001"]);
    const tiny = normalizeRecipeDraft(
      {
        yield: 10,
        lines: [line({ name: "Sal", quantity: "0.001" })],
        unparsed: [],
      },
      items,
    );
    expect(tiny.lines[0].quantity).toBeNull();
  });

  it("itemId ajeno o de unidad incompatible sale como NUEVO", () => {
    const d = normalizeRecipeDraft(
      {
        yield: 1,
        lines: [
          line({
            itemId: "33333333-3333-4333-8333-333333333333",
            name: "Queso",
          }),
          line({ itemId: L, name: "Leche", unit: "g" }),
        ],
        unparsed: [],
      },
      items,
    );
    expect(d.lines.map((l) => [l.itemId, l.isNew])).toEqual([
      [null, true],
      [null, true],
    ]);
  });

  it("repetidos se suman (el mismo insumo dos veces, o el mismo nuevo)", () => {
    const d = normalizeRecipeDraft(
      {
        yield: 1,
        lines: [
          line({ itemId: H, name: "Harina", quantity: "200" }),
          line({ itemId: H, name: "Harina", quantity: "50" }),
          line({ name: "Manteca", quantity: "10" }),
          line({ name: "manteca", quantity: null }),
        ],
        unparsed: [],
      },
      items,
    );
    expect(d.lines.map((l) => [l.name, l.quantity])).toEqual([
      ["Harina", "250.000"],
      ["Manteca", "10.000"],
    ]);
  });

  it("unidad o cantidad invalidas van a unparsed", () => {
    const d = normalizeRecipeDraft(
      {
        yield: 1,
        lines: [
          line({ unit: "taza", sourceText: "a" }),
          line({ quantity: "0", sourceText: "b" }),
        ],
        unparsed: ["x"],
      },
      items,
    );
    expect(d.lines).toEqual([]);
    expect(d.unparsed).toEqual(["x", "a", "b"]);
  });
});
