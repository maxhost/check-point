import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import { parseMeasuredVoidInput } from "./measured-void";
import { frozenVoidFromRow, decodeVoidMetricSnapshot } from "./void-snapshot";

describe("0242 internal measured void", () => {
  it("allows an absent version and validates supplied syntax strictly", () => {
    expect(parseMeasuredVoidInput()).toEqual({});
    expect(parseMeasuredVoidInput({})).toEqual({});
    expect(parseMeasuredVoidInput({ version: 2147483647 })).toEqual({
      version: 2147483647,
    });
    for (const raw of [
      null,
      [],
      "",
      { version: undefined },
      { version: null },
      { version: "1" },
      { version: 0 },
      { version: 1.1 },
      { version: 2147483648 },
      { version: 1, payments: [] },
    ])
      expect(() => parseMeasuredVoidInput(raw)).toThrow();
  });
  it("allocates measured original rationals once across stable lines, independently of payments", () => {
    const lines = [0, 1].map((position) => ({
      sourceLineId: randomUUID(),
      position,
      quantity: "0.001",
      unitPrice: "5",
      measure: {
        kind: "mass" as const,
        quantityUnit: "kg" as const,
        priceUnit: "kg" as const,
        conversionVersion: "mass-si-1" as const,
      },
    }));
    const money = buildFinancialAmountsFromSnapshots({
      currencyCode: "USD",
      discount: null,
      lines,
    });
    expect(money.gross).toBe("0.01");
    expect(money.lines.map((line) => line.money.gross)).toEqual([
      "0.01",
      "0.00",
    ]);
    expect(money.lines.map((line) => line.money.originals.gross)).toEqual([
      { numerator: "1", denominator: "2", scale: 2 },
      { numerator: "1", denominator: "2", scale: 2 },
    ]);
    expect(money).not.toHaveProperty("payments");
  });
  it("reads scalar void authority and rejects corrupted version/currency precision", () => {
    const row = {
      voidEventId: randomUUID(),
      voidPayloadVersion: 2,
      voidAmountMinor: "9007199254740993",
      voidCurrency: "USD",
      voidMinorUnit: 2,
    };
    expect(frozenVoidFromRow(row)).toEqual({
      gross: "90071992547409.93",
      currencyCode: "USD",
    });
    expect(frozenVoidFromRow({ ...row, voidEventId: null })).toBeNull();
    for (const patch of [
      { voidPayloadVersion: 1 },
      { voidAmountMinor: "1.2" },
      { voidMinorUnit: 0 },
    ])
      expect(() => frozenVoidFromRow({ ...row, ...patch })).toThrow();
    expect(() => decodeVoidMetricSnapshot({ eventVersion: 2 }, 4)).toThrow();
  });
});
