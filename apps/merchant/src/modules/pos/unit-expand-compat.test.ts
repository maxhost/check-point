import { describe, expect, it, vi } from "vitest";
import {
  MeasureError,
  parsePrice,
  trustedUnitLegacyPrice,
  trustedUnitQuantityNumber,
} from "@mi-pasaporte/domain/measures";
import { CounterError } from "@mi-pasaporte/domain/server/counter/core";
import {
  lineTotalOf,
  totalOf,
  unitPriceOf,
  unitQuantityOf,
} from "./server/lines";
import { buildDetailed, parseMoney } from "../../server/counter/grant-input";

const catalog = vi.hoisted(() => ({ price: null as string | null }));
vi.mock("@mi-pasaporte/db", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: async () => [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Unit",
            unitPrice: catalog.price,
          },
        ],
      }),
    }),
  }),
}));
const productId = "11111111-1111-4111-8111-111111111111";
const cart = (quantity: unknown = 1, unitPrice: unknown = "0.10") => [
  { productId, quantity, unitPrice },
];

describe("CP1b unit DB projections before DDL", () => {
  it.each([2, "2", "2.000000000", "0002.000"])(
    "normalizes quantity %j after validation",
    (raw) => {
      expect(trustedUnitQuantityNumber(raw)).toBe(2);
      expect(unitQuantityOf(raw)).toBe(2);
    },
  );
  it.each([
    0,
    null,
    "2.000000001",
    "1e2",
    "2147483648",
    1.5,
    -1,
    Infinity,
    "2.0000000000",
  ])("rejects incompatible quantity %j", (raw) => {
    expect(() => trustedUnitQuantityNumber(raw)).toThrow(MeasureError);
    expect(() => unitQuantityOf(raw)).toThrow(
      expect.objectContaining({
        status: 409,
        code: "pos_client_upgrade_required",
      }),
    );
  });
  it.each(["1.20", "1.200000000", 1.2])(
    "projects DB price %j exactly",
    (raw) => {
      expect(trustedUnitLegacyPrice(raw)).toBe("1.20");
    },
  );
  it.each([
    null,
    "1e2",
    "0.000000001",
    "1.201",
    "10000000000",
    "1.0000000000",
    NaN,
  ])("rejects incompatible price %j", (raw) => {
    expect(() => trustedUnitLegacyPrice(raw)).toThrow(MeasureError);
    expect(() => unitPriceOf(raw)).toThrow(CounterError);
  });
  it("preserves zero, int32 maximum, full legacy tariff and exact padding", () => {
    expect(unitPriceOf("0.000000000")).toBe("0.00");
    expect(unitQuantityOf("2147483647.000000000")).toBe(2147483647);
    expect(lineTotalOf("0.000000000", "2147483647.000000000")).toBe("0.00");
    expect(lineTotalOf("9999999999.990000000", "1.000000000")).toBe(
      "9999999999.99",
    );
    expect(
      totalOf([
        { quantity: "3.000000000", unitPrice: "0.100000000" },
        { quantity: 1, unitPrice: "0.20" },
      ]),
    ).toBe("0.50");
    expect(() => parsePrice("9999999999.99")).toThrow(MeasureError);
  });
  it("rejects line and aggregate overflow with serializable existing error", () => {
    expect(() => lineTotalOf("9999999999.99", 2)).toThrow(
      expect.objectContaining({ status: 422, code: "invalid_amount" }),
    );
    expect(() =>
      totalOf([
        { quantity: 1, unitPrice: "9999999999.99" },
        { quantity: 1, unitPrice: "0.01" },
      ]),
    ).toThrow(CounterError);
  });
  it("snapshots authoritative legacy tariffs and sums/multiplies exactly", async () => {
    catalog.price = "9999999999.990000000";
    expect(await buildDetailed("business", null, cart())).toMatchObject({
      total: "9999999999.99",
      items: [{ unitPrice: "9999999999.99", lineTotal: "9999999999.99" }],
    });
    catalog.price = "0.100000000";
    expect(
      await buildDetailed("business", null, [...cart(3), ...cart(7)]),
    ).toMatchObject({
      total: "1.00",
      items: [{ lineTotal: "0.30" }, { lineTotal: "0.70" }],
    });
    catalog.price = "0";
    expect(
      await buildDetailed("business", null, cart(2147483647)),
    ).toMatchObject({ total: "0.00" });
    catalog.price = null;
    expect(
      await buildDetailed("business", null, cart(1, "2.50")),
    ).toMatchObject({ total: "2.50" });
  });
  it("does not expand HTTP quantity or change the legacy public money parser", async () => {
    catalog.price = "0";
    for (const quantity of ["2", "2.000000000", "1e2", 0, 1.5, 2147483648]) {
      await expect(
        buildDetailed("business", null, cart(quantity)),
      ).rejects.toMatchObject({ status: 422, code: "invalid_input" });
    }
    expect(parseMoney(" 1e2 ", "Importe")).toBe("100.00");
    expect(parseMoney("1.234", "Importe")).toBe("1.23");
  });
  it("rejects incompatible DB price and cart overflow before returning snapshots", async () => {
    catalog.price = "1.000000001";
    await expect(buildDetailed("business", null, cart())).rejects.toMatchObject(
      { status: 409, code: "pos_client_upgrade_required" },
    );
    catalog.price = "9999999999.99";
    await expect(
      buildDetailed("business", null, cart(2)),
    ).rejects.toMatchObject({ status: 422, code: "invalid_amount" });
    await expect(
      buildDetailed("business", null, [...cart(), ...cart()]),
    ).rejects.toMatchObject({ status: 422, code: "invalid_amount" });
  });
});
