import { describe, expect, it } from "vitest";
import {
  blankLine,
  countedQuantity,
  editableAmount,
  entryLines,
  type StockItem,
  type StockLine,
} from "./stock-types";

const items: StockItem[] = [
  { id: "flour", name: "Harina", unit: "g", status: "active" },
];
const line = (patch: Partial<StockLine> = {}): StockLine => ({
  key: "line",
  itemId: "flour",
  name: "Harina",
  unit: "g",
  quantity: "1000",
  totalCost: "5",
  ...patch,
});

describe("precios obligatorios en nuevas entradas de Stock", () => {
  it.each(["", " ", "\t\n"])("rechaza precio en blanco %j", (totalCost) => {
    expect(() => entryLines([line({ totalCost })], items)).toThrow(
      "Ítem 1: Completa el precio total",
    );
  });
  it("comprueba todas las líneas e identifica la que no tiene precio", () => {
    expect(() =>
      entryLines([line(), line({ key: "second", totalCost: "" })], items),
    ).toThrow("Ítem 2: Completa el precio total");
  });
  it("el borrador IA sin precio sigue vacío y exige completarlo en revisión", () => {
    const totalCost = editableAmount(null);
    expect(totalCost).toBe("");
    expect(() =>
      entryLines([line({ totalCost, sourceText: "un kilo de harina" })], items),
    ).toThrow("Completa el precio total");
  });
  it("una línea manual nueva empieza sin precio, nunca en cero", () => {
    const manual = {
      ...blankLine("manual"),
      itemId: "flour",
      name: "Harina",
      unit: "g" as const,
      quantity: "1000",
    };
    expect(manual.totalCost).toBe("");
    expect(() => entryLines([manual], items)).toThrow(
      "Completa el precio total",
    );
  });
  it.each(["0", "0,00", "0.00"])(
    "acepta precio cero explícito %s",
    (totalCost) => {
      expect(
        Number(entryLines([line({ totalCost })], items)[0].totalCost),
      ).toBe(0);
    },
  );
  it("conserva decimales y unidades del payload", () => {
    expect(
      entryLines(
        [line({ quantity: "1,5", unit: "kg", totalCost: "7,25" })],
        items,
      ),
    ).toEqual([
      { itemId: "flour", quantity: "1.5", unit: "kg", totalCost: "7.25" },
    ]);
  });
  it.each(["-1", "1e3", "0.001", "10000000000"])(
    "mantiene el rechazo del precio inválido %s",
    (totalCost) => {
      expect(() => entryLines([line({ totalCost })], items)).toThrow();
    },
  );
  it("el conteo conserva su validación de cantidades independiente del precio", () => {
    expect(countedQuantity("0", "g")).toBe("0.000");
    expect(countedQuantity("1,5", "kg")).toBe("1500.000");
  });
});
