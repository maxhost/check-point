import { describe, expect, it } from "vitest";
import { parsePosCreateV2, parsePosUpdateV2 } from "./measured-input";

const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const line = {
  productId: id,
  quantity: "1",
  quantityUnit: "unit",
  catalogRevision: "1",
};
const command = {
  createRequestId: id,
  saleType: "pickup",
  orderLabel: " Pedido ",
  locationId: id,
  tableId: null,
  note: " Nota ",
  items: [line],
};
const update = {
  version: 1,
  saleType: "pickup",
  orderLabel: "Pedido",
  locationId: id,
  tableId: null,
  note: null,
  items: [line],
};

describe("V2 command input without service authority", () => {
  it("normalizes four creation contexts, UUIDs and text without resolving references", () => {
    expect(
      parsePosCreateV2({
        ...command,
        createRequestId: ` ${id.toUpperCase()} `,
        locationId: null,
      }),
    ).toMatchObject({
      createRequestId: id,
      locationId: null,
      orderLabel: "Pedido",
      note: "Nota",
    });
    expect(
      parsePosCreateV2({ ...command, saleType: "delivery" }).saleType,
    ).toBe("delivery");
    expect(
      parsePosCreateV2({
        ...command,
        saleType: "table",
        tableId: id,
        orderLabel: "untrusted",
      }).orderLabel,
    ).toBe("");
    expect(parsePosCreateV2({ ...command, saleType: "table" }).orderLabel).toBe(
      "Pedido",
    );
    expect(
      parsePosCreateV2({ ...command, saleType: "counter" }).orderLabel,
    ).toBe("");
    expect(parsePosCreateV2({ ...command, note: "  " }).note).toBeNull();
  });
  it.each([
    null,
    [],
    {},
    { ...command, saleType: "legacy" },
    { ...command, saleType: "unknown" },
    { ...command, tableId: id },
    { ...command, saleType: "counter", tableId: id },
    { ...command, orderLabel: " " },
    { ...command, orderLabel: "x".repeat(61) },
    { ...command, note: "x".repeat(1001) },
    { ...command, note: 4 },
    { ...command, locationId: "" },
    { ...command, tableId: "bad" },
    { ...command, createRequestId: null },
    { ...command, locationId: undefined },
    { ...command, items: undefined },
    { ...command, items: [{ ...line, lineId: id }] },
    { ...command, total: "0" },
    { ...command, businessId: id },
    { ...command, tableName: "fake" },
  ])(
    "rejects invalid/incomplete or authority-bearing create payload %#",
    (raw) => {
      expect(() => parsePosCreateV2(raw)).toThrowError(
        expect.objectContaining({ status: 422 }),
      );
    },
  );
  it("requires explicit full items and preserves cardinality, including identical product IDs", () => {
    expect(parsePosCreateV2({ ...command, items: [] }).items).toEqual([]);
    expect(
      parsePosCreateV2({ ...command, items: Array(200).fill(line) }).items,
    ).toHaveLength(200);
    expect(() =>
      parsePosCreateV2({ ...command, items: Array(201).fill(line) }),
    ).toThrow();
    expect(
      parsePosCreateV2({
        ...command,
        items: [line, { ...line, catalogRevision: "2" }],
      }).items.map((item) => item.catalogRevision),
    ).toEqual(["1", "2"]);
  });
  it.each([0, -1, 1.5, "1", null, 2147483648])(
    "rejects invalid update version %s",
    (version) => {
      expect(() => parsePosUpdateV2({ ...update, version })).toThrow();
    },
  );
  it("requires separately supplied legacy order authority, not a body assertion", () => {
    expect(() => parsePosUpdateV2({ ...update, saleType: "legacy" })).toThrow();
    expect(() =>
      parsePosUpdateV2(
        { ...update, saleType: "legacy" },
        { saleType: "table" },
      ),
    ).toThrow();
    expect(
      parsePosUpdateV2(
        { ...update, saleType: "legacy", version: 2147483647 },
        { saleType: "legacy" },
      ).saleType,
    ).toBe("legacy");
    expect(() =>
      parsePosUpdateV2({
        ...update,
        saleType: "legacy",
        existing: { saleType: "legacy" },
      }),
    ).toThrow();
  });
  it("rejects duplicate existing IDs after UUID normalization", () => {
    const existing = {
      lineId: id,
      productId: null,
      quantity: "1",
      quantityUnit: "unit",
    };
    expect(() =>
      parsePosUpdateV2({
        ...update,
        items: [existing, { ...existing, lineId: id.toUpperCase() }],
      }),
    ).toThrow();
    expect(
      parsePosUpdateV2({ ...update, items: [existing, line] }).items,
    ).toHaveLength(2);
  });
});
