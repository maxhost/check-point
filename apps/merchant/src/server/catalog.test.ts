import { describe, expect, it } from "vitest";
import { CatalogError, toProductDTO, type ProductRecord } from "./catalog/core";
import {
  validateCategoryName,
  validateCurrencyCode,
  validateProductInput,
} from "./catalog/validation";
import { currencyForCountry, isSupportedCurrency } from "../lib/currencies";

const base = {
  name: "Café",
  availableAllLocations: true,
};

describe("validateProductInput", () => {
  it("requires a non-empty, bounded name", () => {
    expect(() => validateProductInput({ ...base, name: "  " })).toThrow(
      CatalogError,
    );
    expect(() =>
      validateProductInput({ ...base, name: "x".repeat(121) }),
    ).toThrow(CatalogError);
  });

  it("treats price and cost as optional but non-negative", () => {
    const empty = validateProductInput(base);
    expect(empty.unitPrice).toBeNull();
    expect(empty.unitCost).toBeNull();
    const priced = validateProductInput({
      ...base,
      unitPrice: 3.5,
      unitCost: "1.2",
    });
    expect(priced.unitPrice).toBe("3.50");
    expect(priced.unitCost).toBe("1.20");
    expect(() => validateProductInput({ ...base, unitPrice: -1 })).toThrowError(
      /mayor o igual a 0/,
    );
    expect(() => validateProductInput({ ...base, unitCost: -0.01 })).toThrow(
      CatalogError,
    );
  });

  it("rejects a malformed category id", () => {
    expect(() =>
      validateProductInput({ ...base, categoryId: "not-a-uuid" }),
    ).toThrow(CatalogError);
    expect(
      validateProductInput({ ...base, categoryId: "" }).categoryId,
    ).toBeNull();
  });

  it("requires >=1 location when visibility is restricted", () => {
    expect(() =>
      validateProductInput({
        ...base,
        availableAllLocations: false,
        locationIds: [],
      }),
    ).toThrow(CatalogError);
    const restricted = validateProductInput({
      ...base,
      availableAllLocations: false,
      locationIds: ["11111111-1111-1111-1111-111111111111"],
    });
    expect(restricted.availableAllLocations).toBe(false);
    expect(restricted.locationIds).toHaveLength(1);
  });

  it("parses the deferred image action", () => {
    expect(validateProductInput(base).imageAction).toBe("keep");
    expect(
      validateProductInput({ ...base, imageAction: "remove" }).imageAction,
    ).toBe("remove");
    expect(() =>
      validateProductInput({ ...base, imageAction: "replace" }),
    ).toThrow(CatalogError);
    const replace = validateProductInput({
      ...base,
      imageAction: "replace",
      uploadId: "abc",
    });
    expect(replace.uploadId).toBe("abc");
  });
});

describe("validateCategoryName / validateCurrencyCode", () => {
  it("requires a category name", () => {
    expect(() => validateCategoryName({ name: "" })).toThrow(CatalogError);
    expect(validateCategoryName({ name: " Bebidas " })).toBe("Bebidas");
  });

  it("accepts only supported ISO 4217 codes", () => {
    expect(validateCurrencyCode({ currencyCode: "USD" })).toBe("USD");
    expect(() => validateCurrencyCode({ currencyCode: "ZZZ" })).toThrow(
      CatalogError,
    );
    expect(() => validateCurrencyCode({ currencyCode: "usd" })).toThrow(
      CatalogError,
    );
  });
});

describe("currency defaults", () => {
  it("derives from country and falls back to USD", () => {
    expect(currencyForCountry("EC")).toBe("USD");
    expect(currencyForCountry("br")).toBe("BRL");
    expect(currencyForCountry("ZZ")).toBe("USD");
    expect(currencyForCountry(null)).toBe("USD");
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("ZZZ")).toBe(false);
  });
});

describe("toProductDTO anti-leak", () => {
  const record: ProductRecord = {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Café",
    categoryId: null,
    unitPrice: "3.50",
    unitCost: "1.00",
    imageObjectKey: "products/biz/asset",
    imageVersion: 4,
    availableAllLocations: true,
    locationIds: [],
  };

  it("never serializes imageObjectKey and exposes only imagePath", () => {
    const dto = toProductDTO(record);
    expect(dto).not.toHaveProperty("imageObjectKey");
    expect(dto.imagePath).toBe(
      "/api/public/catalog/22222222-2222-2222-2222-222222222222/image?v=4",
    );
    expect(dto.unitPrice).toBe(3.5);
    expect(dto.unitCost).toBe(1);
  });

  it("returns a null imagePath when there is no image", () => {
    const dto = toProductDTO({ ...record, imageObjectKey: null });
    expect(dto.imagePath).toBeNull();
    expect(dto).not.toHaveProperty("imageObjectKey");
  });
});
