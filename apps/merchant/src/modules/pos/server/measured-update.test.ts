import { describe, expect, it } from "vitest";
import { resolveUpdateSource } from "./measured-update";
const id = "00000000-0000-4000-8000-000000000001";
const source = {
  lineId: id,
  productId: null,
  name: "Histórico",
  quantity: "907.18474",
  unitPrice: "4",
  measure: {
    kind: "mass" as const,
    quantityUnit: "g" as const,
    priceUnit: "lb" as const,
    conversionVersion: "mass-si-1" as const,
  },
};
describe("0242 update authoritative sources (mass algebra only)", () => {
  it("preserves deleted product, old tariff and conversion while changing compatible capture", () => {
    expect(
      resolveUpdateSource(
        { lineId: id, productId: null, quantity: "2", quantityUnit: "lb" },
        source,
        ["lb"],
      ),
    ).toEqual({
      ...source,
      quantity: "2",
      measure: { ...source.measure, quantityUnit: "lb" },
    });
  });
  it("disabled capture can only be kept exactly unchanged", () => {
    expect(
      resolveUpdateSource(
        {
          lineId: id,
          productId: null,
          quantity: source.quantity,
          quantityUnit: "g",
        },
        source,
        ["kg"],
      ),
    ).toEqual(source);
    expect(() =>
      resolveUpdateSource(
        { lineId: id, productId: null, quantity: "1", quantityUnit: "g" },
        source,
        ["kg"],
      ),
    ).toThrow();
    expect(() =>
      resolveUpdateSource(
        { lineId: id, productId: null, quantity: "2", quantityUnit: "lb" },
        source,
        ["kg"],
      ),
    ).toThrow();
  });
  it("legacy high count is trusted only when identical to DB", () => {
    const unit = {
      ...source,
      quantity: "1000000000",
      measure: {
        ...source.measure,
        kind: "unit" as const,
        quantityUnit: "unit" as const,
        priceUnit: "unit" as const,
      },
    };
    expect(
      resolveUpdateSource(
        {
          lineId: id,
          productId: null,
          quantity: unit.quantity,
          quantityUnit: "unit",
        },
        unit,
        [],
      ),
    ).toEqual(unit);
    expect(() =>
      resolveUpdateSource(
        {
          lineId: id,
          productId: null,
          quantity: "1000000001",
          quantityUnit: "unit",
        },
        unit,
        [],
      ),
    ).toThrow();
    expect(() =>
      resolveUpdateSource(
        { lineId: id, productId: id, quantity: "1", quantityUnit: "unit" },
        unit,
        [],
      ),
    ).toThrow();
  });
});
