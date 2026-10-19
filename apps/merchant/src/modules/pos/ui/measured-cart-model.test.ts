import { describe, expect, it } from "vitest";
import { UNIT_MEASURE } from "@mi-pasaporte/domain/measures";
import {
  existingCartLine,
  newCartLine,
  quantityEditor,
  changePresentation,
  editQuantity,
  editorPresentation,
  serializeMeasuredCart,
  appendCartLine,
} from "./measured-cart-model";
import {
  existing,
  products,
} from "../../../../../../tests/e2e/support/pos-measured-cart-fixture";
const enabled = ["kg", "lb", "g"] as const;
const serialize = (line: ReturnType<typeof existingCartLine>) =>
  serializeMeasuredCart([line], enabled, "USD")[0];
describe("measured cart source and commands", () => {
  it("keeps exact source through approximate presentation and confirm", () => {
    const line = existingCartLine(existing[2]);
    line.editor = changePresentation(line.editor, "lb");
    expect(editorPresentation(line.editor).approximate).toBe(true);
    expect(serialize(line)).toEqual({
      lineId: "grams",
      productId: "mass",
      quantity: "1",
      quantityUnit: "g",
    });
    line.editor = editQuantity(line.editor, "0,123456789");
    expect(serialize(line)).toMatchObject({
      quantity: "0.123456789",
      quantityUnit: "lb",
    });
  });
  it("keeps historical disabled unit, rejects a fresh capture in it", () => {
    const line = existingCartLine(existing[2]);
    expect(serializeMeasuredCart([line], ["kg"], "USD")[0].quantityUnit).toBe(
      "g",
    );
    line.editor = editQuantity(line.editor, "2");
    expect(() => serializeMeasuredCart([line], ["kg"], "USD")).toThrow(
      /habilitada/,
    );
  });
  it.each([
    "",
    "0",
    "-1",
    "1e2",
    "1.",
    "1,",
    "0.1234567891",
    "1000000000",
    "NaN",
  ])("never serializes stale buffer %s", (buffer) => {
    const line = existingCartLine(existing[2]);
    line.editor = editQuantity(line.editor, buffer);
    expect(() => serialize(line)).toThrow();
  });
  it("preserves null product, snapshots, price revisions and cardinality", () => {
    const old = existingCartLine(existing[0]);
    const orphan = existingCartLine(existing[1]);
    const fresh = newCartLine(
      products[0],
      "fresh",
      editQuantity(quantityEditor(null, "unit"), "1"),
      enabled,
    );
    const lines = appendCartLine([old, orphan], fresh);
    expect(serializeMeasuredCart(lines, enabled, "USD")).toEqual([
      {
        lineId: "old",
        productId: "coffee",
        quantity: "2",
        quantityUnit: "unit",
      },
      {
        lineId: "deleted",
        productId: null,
        quantity: "1",
        quantityUnit: "unit",
      },
      {
        productId: "coffee",
        quantity: "1",
        quantityUnit: "unit",
        catalogRevision: "2",
      },
    ]);
    expect(old.snapshot.unitPrice).toBe("2");
    expect(() =>
      appendCartLine(
        Array.from({ length: 200 }, () => old),
        fresh,
      ),
    ).toThrow(/200/);
    expect(() =>
      serializeMeasuredCart(
        Array.from({ length: 201 }, () => old),
        enabled,
        "USD",
      ),
    ).toThrow(/200/);
  });
  it("mass requires explicit capture, zero is priced, null unavailable", () => {
    expect(() =>
      newCartLine(products[1], "m", quantityEditor(null, "kg"), enabled),
    ).toThrow();
    expect(() =>
      newCartLine(
        products[3],
        "m",
        editQuantity(quantityEditor(null, "kg"), "1"),
        enabled,
      ),
    ).toThrow(/precio/);
    expect(
      newCartLine(
        products[2],
        "f",
        editQuantity(quantityEditor(null, "unit"), "1"),
        enabled,
      ).snapshot.unitPrice,
    ).toBe("0");
  });
  it("preserves unchanged high legacy quantity/tariff and checks new limits/overflow", () => {
    const line = existingCartLine({
      ...existing[0],
      quantity: "2147483647",
      unitPrice: "0",
    });
    expect(serialize(line).quantity).toBe("2147483647");
    line.editor = editQuantity(line.editor, "2147483647");
    expect(() => serialize(line)).toThrow();
    const price = existingCartLine({
      ...existing[0],
      quantity: "1",
      unitPrice: "9999999999.99",
      measure: UNIT_MEASURE,
    });
    expect(serialize(price).quantity).toBe("1");
    price.editor = editQuantity(price.editor, "2");
    expect(() => serialize(price)).toThrow();
  });
  it("kg/lb/g views and exactly 200 distinct zero-priced lines", () => {
    const line = existingCartLine({
      ...existing[2],
      quantity: "1",
      measure: {
        ...existing[2].measure,
        kind: "mass",
        quantityUnit: "lb",
        priceUnit: "lb",
      },
    });
    line.editor = changePresentation(line.editor, "g");
    expect(editorPresentation(line.editor).display).toBe("453.59237");
    line.editor = changePresentation(line.editor, "kg");
    expect(editorPresentation(line.editor).display).toBe("0.45359237");
    expect(serialize(line)).toMatchObject({
      quantity: "1",
      quantityUnit: "lb",
    });
    const rows = Array.from({ length: 200 }, (_, i) =>
      existingCartLine({ ...existing[1], lineId: `line-${i}` }),
    );
    expect(serializeMeasuredCart(rows, enabled, "USD")).toHaveLength(200);
    expect(() =>
      newCartLine(
        products[0],
        "x",
        quantityEditor(
          { quantity: "2147483647", quantityUnit: "unit" },
          "unit",
        ),
        enabled,
      ),
    ).toThrow();
  });
  it("rejects overflow of the exact combined order even when each line fits", () => {
    const one = existingCartLine({
      ...existing[0],
      lineId: "a",
      quantity: "1",
      unitPrice: "6000000000",
    });
    const two = existingCartLine({
      ...existing[0],
      lineId: "b",
      quantity: "1",
      unitPrice: "6000000000",
    });
    expect(() => serializeMeasuredCart([one, two], enabled, "USD")).toThrow();
  });
  it("unit integers, dimension and fresh enabled units", () => {
    expect(() =>
      newCartLine(
        products[0],
        "x",
        editQuantity(quantityEditor(null, "unit"), "1.1"),
        enabled,
      ),
    ).toThrow();
    expect(() =>
      newCartLine(
        products[0],
        "x",
        editQuantity(quantityEditor(null, "kg"), "1"),
        enabled,
      ),
    ).toThrow(/medidas/);
    expect(() =>
      changePresentation(existingCartLine(existing[0]).editor, "kg"),
    ).toThrow();
  });
});
