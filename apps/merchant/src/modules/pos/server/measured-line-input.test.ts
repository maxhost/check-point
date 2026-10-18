import { describe, expect, it } from "vitest";
import {
  UNIT_MEASURE,
  CONVERSION_VERSION,
  captureQuantity,
  trustedUnitSnapshotQuantity,
} from "@mi-pasaporte/domain/measures";
import type { PosExistingLineV2 } from "../contracts";
import {
  parseMeasuredLineInput,
  resolveExistingMeasuredLine,
  type TrustedPosLineSnapshot,
} from "./measured-line-input";
const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const other = "00000000-1111-2222-3333-444444444444";
const line = {
  productId: id,
  quantity: "1",
  quantityUnit: "unit",
  catalogRevision: "1",
};
const snapshot: TrustedPosLineSnapshot = {
  lineId: id,
  productId: id,
  name: "Frozen",
  quantity: "2",
  unitPrice: "9999999999.99",
  measure: UNIT_MEASURE,
};
function existing(quantity: string, quantityUnit = "unit") {
  return parseMeasuredLineInput(
    { lineId: id, productId: id, quantity, quantityUnit },
    true,
  ) as PosExistingLineV2;
}
describe("measured line authority and capture", () => {
  it("normalizes exact nine-decimal captures and revision", () => {
    expect(
      parseMeasuredLineInput({
        ...line,
        quantity: "0001.123456789",
        quantityUnit: "lb",
        catalogRevision: "0003",
      }),
    ).toMatchObject({ quantity: "1.123456789", catalogRevision: "3" });
  });
  it.each([
    1,
    null,
    "1e3",
    "1,2",
    "0",
    "-1",
    "+1",
    "NaN",
    "Infinity",
    " 1 ",
    "1.0000000000",
    "1000000000",
    "1.2",
  ])("rejects invalid unit capture %s", (quantity) => {
    expect(() => parseMeasuredLineInput({ ...line, quantity })).toThrowError(
      expect.objectContaining({ status: 422, code: "invalid_quantity" }),
    );
  });
  it.each([
    { quantityUnit: "oz" },
    { catalogRevision: 1 },
    { catalogRevision: "0" },
    { catalogRevision: "2147483648" },
    { unitPrice: "0" },
    { name: "fake" },
    { measure: UNIT_MEASURE },
    { lineTotal: "0" },
    { productId: null },
  ])("rejects client commercial or invalid references %#", (change) => {
    expect(() => parseMeasuredLineInput({ ...line, ...change })).toThrow();
  });
  it("rejects malformed existing fields, revision and missing/foreign snapshots", () => {
    expect(() =>
      parseMeasuredLineInput({ ...line, lineId: id }, true),
    ).toThrow();
    expect(() =>
      resolveExistingMeasuredLine(existing("2"), undefined),
    ).toThrow();
    expect(() =>
      resolveExistingMeasuredLine(existing("2"), {
        ...snapshot,
        lineId: other,
      }),
    ).toThrow();
    expect(() =>
      resolveExistingMeasuredLine(existing("2"), {
        ...snapshot,
        productId: other,
      }),
    ).toThrow();
    expect(() =>
      resolveExistingMeasuredLine(existing("2"), {
        ...snapshot,
        productId: null,
      }),
    ).toThrow();
  });
  it("retains orphan snapshots only with matching null product reference", () => {
    const input = { ...existing("3"), productId: null };
    expect(
      resolveExistingMeasuredLine(input, { ...snapshot, productId: null }),
    ).toMatchObject({
      name: "Frozen",
      productId: null,
      unitPrice: "9999999999.99",
      quantity: "3",
    });
  });
  it("preserves high historical unit quantity exclusively when unchanged against source", () => {
    const source = { ...snapshot, quantity: "2147483647.000000000" };
    expect(
      resolveExistingMeasuredLine(existing("2147483647.0"), source).quantity,
    ).toBe("2147483647");
    expect(() =>
      resolveExistingMeasuredLine(existing("2147483646"), source),
    ).toThrow();
    expect(() =>
      resolveExistingMeasuredLine(existing("2147483647"), snapshot),
    ).toThrow();
    expect(
      resolveExistingMeasuredLine(existing("999999999"), source).quantity,
    ).toBe("999999999");
    expect(() =>
      parseMeasuredLineInput({ ...line, quantity: "2147483647" }),
    ).toThrow();
    expect(() => existing("2147483648")).toThrow();
    expect(() => captureQuantity("2147483647", "unit")).toThrow();
    expect(trustedUnitSnapshotQuantity("2147483647")).toBe("2147483647");
  });
  it("allows a new compatible mass capture without resetting tariff or conversion", () => {
    const source = {
      ...snapshot,
      quantity: "1",
      unitPrice: "4.123456789",
      measure: {
        kind: "mass" as const,
        quantityUnit: "lb" as const,
        priceUnit: "lb" as const,
        conversionVersion: CONVERSION_VERSION,
      },
    };
    const frozen = structuredClone(source);
    expect(
      resolveExistingMeasuredLine(existing("453.59237", "g"), source),
    ).toEqual({
      ...source,
      quantity: "453.59237",
      measure: { ...source.measure, quantityUnit: "g" },
    });
    expect(
      resolveExistingMeasuredLine(existing("1", "lb"), source).quantity,
    ).toBe("1");
    expect(source).toEqual(frozen);
    expect(() => resolveExistingMeasuredLine(existing("1"), source)).toThrow();
    expect(() =>
      resolveExistingMeasuredLine(existing("1", "kg"), snapshot),
    ).toThrow();
  });
});
