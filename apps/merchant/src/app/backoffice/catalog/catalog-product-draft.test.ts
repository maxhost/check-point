import { describe, expect, it } from "vitest";
import { draftPrice, reconcileProduct } from "./catalog-product-draft";
import { formatMoney, type Product, type ProductPayload } from "./types";
const base: Product = {
  id: "one",
  name: "Original",
  categoryId: null,
  unitPrice: "2",
  unitCost: null,
  soldByWeight: false,
  pricingUnit: "unit",
  catalogRevision: "1",
  imagePath: null,
  imageVersion: 0,
  imageSource: null,
  imageAuthor: null,
  imageAuthorUrl: null,
  imageSourceUrl: null,
  availableAllLocations: true,
  locationIds: [],
};
const draft: ProductPayload = {
  ...base,
  imageAction: "keep",
  expectedSalesRevision: "1",
};
describe("catalog exact draft and reconciliation", () => {
  it("preserves null, zero, nine decimals and an unchanged trusted legacy tariff", () => {
    expect(draftPrice("", null, false)).toBeNull();
    expect(draftPrice("0", null, false)).toBe("0");
    expect(draftPrice("0.123456789", null, false)).toBe("0.123456789");
    expect(draftPrice("9999999999.99", "9999999999.99", true)).toBe(
      "9999999999.99",
    );
    for (const value of [
      "9999999999.98",
      "1e2",
      " 2",
      "1,2",
      "-1",
      "1.0000000000",
    ])
      expect(() => draftPrice(value, "9999999999.99", true)).toThrow();
  });
  it("formats fractions exactly for currencies with two or zero minor digits", () => {
    expect(formatMoney("9999999999.99", "USD")).toContain("9.999.999.999,99");
    expect(formatMoney("1234.123456789", "USD")).toContain("1.234,123456789");
    expect(formatMoney("1234.000000001", "JPY")).toContain("1.234,000000001");
    expect(formatMoney("0", "USD")).toContain("0,00");
  });
  it("adopts untouched remote fields, preserves edited ones and reports overlaps", () => {
    const result = reconcileProduct(
      base,
      { ...draft, name: "My draft", imageAction: "remove" },
      {
        ...base,
        name: "Remote",
        unitPrice: "3.123456789",
        catalogRevision: "2",
        imagePath: "/new.jpg",
      },
    );
    expect(result.next).toMatchObject({
      name: "My draft",
      unitPrice: "3.123456789",
      imageAction: "remove",
      expectedSalesRevision: "2",
    });
    expect(result.overlaps).toEqual(["Nombre", "Imagen"]);
    expect(draft.expectedSalesRevision).toBe("1");
  });
  it("keeps mode/unit and availability/locations together when both sides change", () => {
    const result = reconcileProduct(
      base,
      {
        ...draft,
        soldByWeight: true,
        pricingUnit: "g",
        availableAllLocations: false,
        locationIds: ["mine"],
      },
      {
        ...base,
        soldByWeight: true,
        pricingUnit: "lb",
        availableAllLocations: false,
        locationIds: ["remote"],
      },
    );
    expect(result.next).toMatchObject({
      soldByWeight: true,
      pricingUnit: "g",
      availableAllLocations: false,
      locationIds: ["mine"],
    });
    expect(result.overlaps).toHaveLength(2);
  });
  it("never reinterprets local tariffs under a remotely changed measure or vice versa", () => {
    const remote = {
      ...base,
      soldByWeight: true,
      pricingUnit: "lb" as const,
      unitPrice: "8",
      catalogRevision: "2",
    };
    const result = reconcileProduct(base, { ...draft, unitPrice: "5" }, remote);
    expect(result.next).toMatchObject({
      soldByWeight: false,
      pricingUnit: "unit",
      unitPrice: "5",
      unitCost: null,
    });
    expect(result.overlaps).toEqual([
      "Venta por peso / Unidad de venta / Precio de venta / Precio de costo",
    ]);
    const inverse = reconcileProduct(
      base,
      { ...draft, soldByWeight: true, pricingUnit: "g" },
      { ...base, unitCost: "4" },
    );
    expect(inverse.next).toMatchObject({
      soldByWeight: true,
      pricingUnit: "g",
      unitPrice: "2",
      unitCost: null,
    });
    expect(inverse.overlaps).toHaveLength(1);
  });
});
