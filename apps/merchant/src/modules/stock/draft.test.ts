import { describe, expect, it } from "vitest";
import { normalizeDraft } from "./draft";

/** Spec 0212 — el servidor NO confia en la salida del modelo. */

const items = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Harina", unit: "g" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Leche", unit: "ml" },
];
const line = (over: Record<string, unknown>) => ({
  itemId: null,
  name: "Tomate",
  quantity: "2",
  unit: "kg",
  totalCost: "7",
  sourceText: "dos kilos de tomate por 7",
  ...over,
});

describe("normalizeDraft (spec 0212)", () => {
  it("empareja un insumo propio y formatea numeros", () => {
    const d = normalizeDraft(
      {
        lines: [
          line({
            itemId: items[0].id,
            name: "harina",
            quantity: "1",
            totalCost: "25",
          }),
        ],
        unparsed: [],
      },
      items,
    );
    expect(d.lines).toEqual([
      {
        itemId: items[0].id,
        name: "Harina",
        isNew: false,
        quantity: "1.000",
        unit: "kg",
        totalCost: "25.00",
        sourceText: "dos kilos de tomate por 7",
      },
    ]);
  });

  it("un itemId que no es de este negocio sale como NUEVO, nunca como existente", () => {
    const d = normalizeDraft(
      {
        lines: [
          line({
            itemId: "33333333-3333-4333-8333-333333333333",
            name: "Queso",
          }),
        ],
        unparsed: [],
      },
      items,
    );
    expect(d.lines[0]).toMatchObject({
      itemId: null,
      isNew: true,
      name: "Queso",
    });
  });

  it("unidad incompatible con el insumo emparejado → nuevo (decide el dueño)", () => {
    const d = normalizeDraft(
      {
        lines: [line({ itemId: items[1].id, name: "Leche", unit: "kg" })],
        unparsed: [],
      },
      items,
    );
    expect(d.lines[0]).toMatchObject({ itemId: null, isNew: true });
  });

  it("unidad invalida, cantidad 0, costo negativo o numero roto → unparsed", () => {
    const d = normalizeDraft(
      {
        lines: [
          line({ unit: "taza", sourceText: "a" }),
          line({ quantity: "0", sourceText: "b" }),
          line({ totalCost: "-1", sourceText: "c" }),
          line({ quantity: "1e3", sourceText: "d" }),
        ],
        unparsed: ["hola"],
      },
      items,
    );
    expect(d.lines).toEqual([]);
    expect(d.unparsed).toEqual(["hola", "a", "b", "c", "d"]);
  });

  it("costo null se conserva (no se inventa precio) y mas de 30 lineas van a unparsed", () => {
    const many = Array.from({ length: 32 }, (_, i) =>
      line({ totalCost: null, sourceText: `l${i}` }),
    );
    const d = normalizeDraft({ lines: many, unparsed: [] }, items);
    expect(d.lines).toHaveLength(30);
    expect(d.lines[0].totalCost).toBeNull();
    expect(d.unparsed).toEqual(["l30", "l31"]);
  });
});
