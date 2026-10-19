import { describe, expect, it } from "vitest";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import {
  assertLegacySnapshot,
  measuredItems,
  persistedSaleType,
  type MeasuredSnapshot,
} from "./measured-read";
import { posReadContract } from "./http";
const line = (extra: Partial<MeasuredSnapshot> = {}): MeasuredSnapshot => ({
  id: "line-1",
  productId: null,
  name: "Snapshot borrado",
  quantity: "1.000000000",
  unitPrice: "2.000000000",
  position: 0,
  measureKind: "unit",
  quantityUnit: "unit",
  priceUnit: "unit",
  conversionVersion: "mass-si-1",
  financialSnapshot: null,
  ...extra,
});
describe("POS trusted measured projections", () => {
  it("preserves legacy high quantities and prices without new input limits", () => {
    expect(
      measuredItems(
        [line({ quantity: "2147483647", unitPrice: "0" })],
        "USD",
      )[0],
    ).toMatchObject({
      quantity: "2147483647",
      unitPrice: "0",
      lineTotal: "0.00",
    });
    expect(
      measuredItems([line({ unitPrice: "9999999999.99" })], "USD")[0],
    ).toMatchObject({
      unitPrice: "9999999999.99",
      lineTotal: "9999999999.99",
      productId: null,
    });
  });
  it("rejects mass metadata before any legacy quantity or price projection", () => {
    for (const patch of [
      { measureKind: "mass", quantityUnit: "kg", priceUnit: "kg" },
      { conversionVersion: "future" },
      { quantityUnit: "g" },
      { quantity: "1.5" },
      { unitPrice: "2.000000001" },
    ]) {
      expect(() => assertLegacySnapshot(line(patch))).toThrowError(
        expect.objectContaining({
          code: "pos_client_upgrade_required",
          status: 409,
        }),
      );
    }
    expect(() => assertLegacySnapshot(line())).not.toThrow();
  });
  it("uses the shared financial kernel with exact mass originals and currency normalization", () => {
    const rows = [
      line({
        measureKind: "mass",
        quantityUnit: "g",
        priceUnit: "lb",
        quantity: "250.123456789",
        unitPrice: "4.123456789",
      }),
      line({
        id: "line-2",
        position: 1,
        measureKind: "mass",
        quantityUnit: "lb",
        priceUnit: "kg",
        quantity: "0.000000001",
        unitPrice: "0.999999999",
      }),
    ];
    for (const currencyCode of ["USD", "COP"]) {
      const projected = measuredItems(rows, currencyCode);
      const expected = buildFinancialAmountsFromSnapshots({
        currencyCode,
        discount: null,
        lines: projected.map((item, position) => ({
          ...item,
          position,
          sourceLineId: item.lineId,
        })),
      });
      expect(projected.map((item) => item.financialSnapshot)).toEqual(
        expected.lines,
      );
    }
  });
  it("preserves stored financial line objects without repricing", () => {
    const frozen = measuredItems([line()], "USD")[0].financialSnapshot!;
    const actual = measuredItems(
      [line({ unitPrice: "99", financialSnapshot: frozen })],
      "USD",
    )[0];
    expect(actual.financialSnapshot).toBe(frozen);
    expect(actual.lineTotal).toBe("2.00");
    expect(actual.unitPrice).toBe("99");
  });
  it("uses only the real table FK for transitional sale type", () => {
    expect(persistedSaleType(null, null)).toBe("legacy");
    expect(persistedSaleType(null, "table-id")).toBe("table");
    expect(persistedSaleType("pickup", null)).toBe("pickup");
  });
  it("selects only absent/1/2 contracts and rejects unknown capabilities", () => {
    for (const [version, expected] of [
      [undefined, 1],
      ["1", 1],
      ["2", 2],
    ] as const)
      expect(
        posReadContract(
          new Request("http://localhost", {
            headers: version ? { "X-Pos-Contract": version } : {},
          }),
        ),
      ).toBe(expected);
    for (const version of ["", "3", "02", "2, 1"])
      expect(() =>
        posReadContract(
          new Request("http://localhost", {
            headers: { "X-Pos-Contract": version },
          }),
        ),
      ).toThrowError(expect.objectContaining({ status: 409 }));
  });
});
