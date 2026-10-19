import { describe, expect, it } from "vitest";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
} from "@mi-pasaporte/domain/financial";
import {
  assertLegacySnapshot,
  measuredItems,
  measuredTotal,
  persistedSaleType,
  type MeasuredSnapshot,
} from "./measured-read";
import { canCombinePosLines } from "../contracts";
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
      expect(projected.map((item) => item.lineTotal)).toEqual(
        expected.lines.map((line) => line.money.gross),
      );
      expect(projected.every((item) => item.financialSnapshot === null)).toBe(
        true,
      );
    }
  });
  it("preserves stored financial line objects without repricing", () => {
    const frozen = buildFinancialAmountsFromSnapshots({
      currencyCode: "USD",
      discount: null,
      lines: [
        {
          sourceLineId: "line-1",
          position: 0,
          unitPrice: "2",
          quantity: "1",
          measure: {
            kind: "unit",
            quantityUnit: "unit",
            priceUnit: "unit",
            conversionVersion: "mass-si-1",
          },
        },
      ],
    }).lines[0];
    const actual = measuredItems(
      [line({ unitPrice: "99", financialSnapshot: frozen })],
      "USD",
    )[0];
    expect(actual.financialSnapshot).toBe(frozen);
    expect(actual.lineTotal).toBe("2.00");
    expect(actual.unitPrice).toBe("99");
  });
  it("defensively uses the settlement's frozen line by sourceLineId if its row capture is absent", () => {
    const settlement = buildFinancialSettlementFromSnapshots({
      currencyCode: "USD",
      lines: [
        {
          sourceLineId: "line-1",
          position: 0,
          quantity: "1",
          unitPrice: "2",
          measure: {
            kind: "unit",
            quantityUnit: "unit",
            priceUnit: "unit",
            conversionVersion: "mass-si-1",
          },
        },
      ],
      discount: {
        amount: "1.00",
        origin: { type: "campaign_coupon", sourceId: "coupon", scope: "order" },
      },
      payments: [{ paymentId: "payment", methodId: "method", amount: "1.00" }],
    });
    const [actual] = measuredItems(
      [line({ unitPrice: "99", financialSnapshot: null })],
      "COP",
      true,
      settlement,
    );
    expect(actual.financialSnapshot).toBe(settlement.lines[0]);
    expect(actual.lineTotal).toBe("2.00");
    expect(actual.financialSnapshot?.money.discount).toBe("1.00");
  });
  it("keeps open calculated amounts separate from persisted financial snapshots and permits combining", () => {
    const [first, second] = measuredItems(
      [
        line({ productId: "product" }),
        line({ id: "second", position: 1, productId: "product" }),
      ],
      "USD",
    );
    expect(first.lineTotal).toBe("2.00");
    expect(first.financialSnapshot).toBeNull();
    expect(canCombinePosLines(first, second)).toBe(true);
  });
  it("preserves exact historical unit cents instead of repricing in the current zero-minor currency", () => {
    const rows = [line({ quantity: "2", unitPrice: "0.49" })];
    const historical = measuredItems(rows, "COP", true);
    expect(historical[0]).toMatchObject({
      lineTotal: "0.98",
      financialSnapshot: null,
    });
    expect(measuredTotal(historical, "COP", true)).toBe("0.98");
    const twoLines = measuredItems(
      [
        line({ unitPrice: "0.49" }),
        line({ id: "second", position: 1, unitPrice: "0.49" }),
      ],
      "COP",
      true,
    );
    expect(twoLines.map((item) => item.lineTotal)).toEqual(["0.49", "0.49"]);
    expect(measuredTotal(twoLines, "COP", true)).toBe("0.98");
    expect(measuredTotal(measuredItems(rows, "COP"), "COP", false)).toBe("1");
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
