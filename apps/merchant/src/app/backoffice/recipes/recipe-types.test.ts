import { describe, expect, it } from "vitest";
import {
  draftIngredients,
  recipePayload,
  type RecipeDraft,
  type RecipeLine,
} from "./recipe-types";
import type { StockItem } from "../stock/stock-types";
import { editableAmount, formatAmount } from "../stock/stock-types";

const items: StockItem[] = [
  { id: "flour", name: "Harina", unit: "g", status: "active" },
  { id: "water", name: "Agua", unit: "ml", status: "active" },
  { id: "old", name: "Insumo anterior", unit: "g", status: "archived" },
];
const ingredient = (patch: Partial<RecipeLine> = {}): RecipeLine => ({
  key: "line",
  itemId: "flour",
  name: "Harina",
  quantity: "25.000",
  unit: "g",
  ...patch,
});

describe("revisión de recetas y payload HTTP", () => {
  it("formatea cantidades españolas sin cambiar su valor en el payload", () => {
    for (const [api, displayed] of [
      ["15.000", "15"],
      ["7.500", "7,5"],
      ["0.100", "0,1"],
    ]) {
      expect(formatAmount(api)).toBe(displayed);
      expect(editableAmount(api)).toBe(displayed);
      expect(
        recipePayload([ingredient({ quantity: editableAmount(api) })], items)[0]
          .quantity,
      ).toBe(String(Number(api)));
    }
    expect(editableAmount(null)).toBe("");
    expect(editableAmount("15000.500")).toBe("15000,5");
    expect(formatAmount("15000.500")).toBe(
      Number("15000.500").toLocaleString("es", { maximumFractionDigits: 3 }),
    );
    expect(formatAmount("0.000")).toBe("0");
  });
  it("guarda cantidades por unidad sin volver a dividir por rendimiento", () => {
    const draft: RecipeDraft = {
      yield: 40,
      lines: [
        {
          itemId: "flour",
          name: "Harina",
          isNew: false,
          quantity: "25.000",
          unit: "g",
          sourceText: "1 kg para 40 medialunas",
        },
      ],
      unparsed: [],
    };
    const lines = draftIngredients(draft);
    expect(recipePayload(lines, items)).toEqual([
      { itemId: "flour", quantity: "25", unit: "g" },
    ]);
    expect(lines[0].sourceText).toBe("1 kg para 40 medialunas");
  });
  it("ingrediente a gusto exige cantidad antes de guardar", () => {
    const lines = draftIngredients({
      yield: 1,
      lines: [
        {
          itemId: null,
          name: "Orégano",
          isNew: true,
          quantity: null,
          unit: "g",
          sourceText: "a gusto",
        },
      ],
      unparsed: [],
    });
    expect(lines[0].quantity).toBe("");
    expect(() => recipePayload(lines, items)).toThrow(
      "cantidad mayor que cero",
    );
    lines[0].quantity = "0,5";
    expect(recipePayload(lines, items)).toEqual([
      { newItem: { name: "Orégano" }, quantity: "0.5", unit: "g" },
    ]);
  });
  it.each(["", "0", "-1", "1e3", "0.0001", "100000000000"])(
    "rechaza cantidad inválida %s",
    (quantity) => {
      expect(() => recipePayload([ingredient({ quantity })], items)).toThrow();
    },
  );
  it("conserva unidad kg y valida su conversión sin hacerla en el payload", () => {
    expect(
      recipePayload([ingredient({ quantity: "1,5", unit: "kg" })], items),
    ).toEqual([{ itemId: "flour", quantity: "1.5", unit: "kg" }]);
    expect(() => recipePayload([ingredient({ unit: "ml" })], items)).toThrow(
      "unidad no coincide",
    );
    expect(() =>
      recipePayload([ingredient({ quantity: "100000000", unit: "kg" })], items),
    ).toThrow("demasiado grande");
  });
  it("solo conserva archivados que ya pertenecían a la receta", () => {
    const line = ingredient({ itemId: "old" });
    expect(() => recipePayload([line], items)).toThrow("activo");
    expect(recipePayload([line], items, ["old"])[0]).toMatchObject({
      itemId: "old",
    });
    expect(() =>
      recipePayload([ingredient({ itemId: "foreign" })], items),
    ).toThrow("activo");
  });
  it("impide duplicados existentes y nuevos antes de crear insumos", () => {
    expect(() => recipePayload([ingredient(), ingredient()], items)).toThrow(
      "repetido",
    );
    expect(() =>
      recipePayload(
        [
          ingredient({ itemId: null, name: "Sal" }),
          ingredient({ itemId: null, name: " sal " }),
        ],
        items,
      ),
    ).toThrow("repetido");
    expect(() =>
      recipePayload([ingredient({ itemId: null, name: "harina" })], items),
    ).toThrow("ya existe");
  });
  it("valida nombre y límite de líneas; vaciar exige receta existente", () => {
    expect(() =>
      recipePayload([ingredient({ itemId: null, name: " " })], items),
    ).toThrow("nombre");
    expect(() =>
      recipePayload(
        [ingredient({ itemId: null, name: "x".repeat(81) })],
        items,
      ),
    ).toThrow("nombre");
    expect(() => recipePayload([], items)).toThrow();
    expect(recipePayload([], items, [], true)).toEqual([]);
    expect(() =>
      recipePayload(
        Array.from({ length: 51 }, () => ingredient()),
        items,
      ),
    ).toThrow("50");
  });
});
