import { describe, expect, it } from "vitest";
import { toProductDTO, type ProductRecord } from "./core";
import {
  catalogPrice,
  parseCatalogMeasure,
  parseSalesRevision,
  rethrowCatalogWriteError,
  toMeasuredProductDTO,
} from "./measured-contract";
const product: ProductRecord = {
  id: "public-id",
  name: "Producto",
  categoryId: null,
  unitPrice: "2.340000000",
  unitCost: null,
  imageObjectKey: "private/key",
  imageVersion: 3,
  imageSource: null,
  imageAuthor: null,
  imageAuthorUrl: null,
  imageSourceUrl: null,
  availableAllLocations: true,
  locationIds: [],
  soldByWeight: false,
  pricingUnit: "unit",
  salesRevision: 7,
};
describe("catalog measured contracts", () => {
  it("explicit public projections preserve legacy shape and expose exact v2 metadata", () => {
    expect(toProductDTO(product)).toEqual({
      id: product.id,
      name: product.name,
      categoryId: null,
      unitPrice: 2.34,
      unitCost: null,
      imagePath: "/api/public/catalog/public-id/image?v=3",
      imageVersion: 3,
      imageSource: null,
      imageAuthor: null,
      imageAuthorUrl: null,
      imageSourceUrl: null,
      availableAllLocations: true,
      locationIds: [],
    });
    expect(toMeasuredProductDTO(product)).toMatchObject({
      unitPrice: "2.34",
      unitCost: null,
      catalogRevision: "7",
      soldByWeight: false,
      pricingUnit: "unit",
    });
    expect(JSON.stringify(toMeasuredProductDTO(product))).not.toContain(
      "private/key",
    );
    expect(
      toMeasuredProductDTO({
        ...product,
        soldByWeight: true,
        pricingUnit: "lb",
        unitPrice: "0.123456789",
      }),
    ).toMatchObject({ unitPrice: "0.123456789", pricingUnit: "lb" });
    expect(() =>
      toMeasuredProductDTO({ ...product, salesRevision: undefined }),
    ).toThrow();
  });
  it("rejects legacy projection before downcasting mass or precise tariffs", () => {
    for (const p of [
      { ...product, soldByWeight: true, pricingUnit: "kg" },
      { ...product, unitPrice: "1.001" },
      { ...product, unitCost: "10000000000" },
    ]) {
      expect(() => toProductDTO(p)).toThrow(
        expect.objectContaining({ code: "pos_client_upgrade_required" }),
      );
    }
    expect(
      toProductDTO({ ...product, unitPrice: "9999999999.990000000" }).unitPrice,
    ).toBe(9999999999.99);
  });
  it("uses strict new prices, allowing only an identical trusted unit legacy snapshot", () => {
    for (const invalid of [
      undefined,
      "",
      1,
      "1e2",
      "-1",
      "NaN",
      "1.0000000000",
      "1000000000",
      "9999999999.99",
    ])
      expect(() => catalogPrice(invalid)).toThrow();
    expect(catalogPrice("999999999.999999999")).toBe("999999999.999999999");
    expect(catalogPrice(null)).toBeNull();
    expect(catalogPrice("0002.340000000")).toBe("2.34");
    expect(catalogPrice("9999999999.99", "9999999999.990000000", true)).toBe(
      "9999999999.99",
    );
    expect(() =>
      catalogPrice("9999999999.98", "9999999999.99", true),
    ).toThrow();
    expect(() =>
      catalogPrice("9999999999.99", "9999999999.99", false),
    ).toThrow();
    expect(
      toMeasuredProductDTO({ ...product, unitPrice: "9999999999.990000000" })
        .unitPrice,
    ).toBe("9999999999.99");
  });
  it("requires valid units and revisions without fabrication", () => {
    for (const [weight, unit] of [
      [false, "kg"],
      [true, "unit"],
      [true, "oz"],
      [undefined, "unit"],
    ])
      expect(() => parseCatalogMeasure(weight, unit)).toThrow();
    for (const invalid of [1, "0", "01", "-1", "1.0", "2147483648", undefined])
      expect(() => parseSalesRevision(invalid)).toThrow();
    expect(parseSalesRevision("2147483647")).toBe("2147483647");
  });
  it("maps only named PostgreSQL expand constraints and retains unrelated failures", () => {
    for (const constraint of [
      "product_sale_measure_legacy_check",
      "product_unit_price_legacy_check",
      "product_unit_cost_legacy_check",
    ])
      expect(() =>
        rethrowCatalogWriteError({ cause: { code: "23514", constraint } }),
      ).toThrow(
        expect.objectContaining({ code: "pos_client_upgrade_required" }),
      );
    const failure = new Error("unrelated");
    expect(() => rethrowCatalogWriteError(failure)).toThrow(failure);
    const other = { code: "23514", constraint: "product_sale_measure_check" };
    try {
      rethrowCatalogWriteError(other);
    } catch (error) {
      expect(error).toBe(other);
    }
  });
});
