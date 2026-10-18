import { describe, expect, it } from "vitest";
import { createIntentFingerprint } from "./create-intent";
const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const other = "00000000-1111-2222-3333-444444444444";
const line = {
  productId: id,
  quantity: "1",
  quantityUnit: "unit",
  catalogRevision: "1",
};
const command = {
  createRequestId: id,
  saleType: "pickup",
  orderLabel: "Pedido",
  locationId: id,
  tableId: null,
  note: null,
  items: [line],
};
describe("canonical create fingerprint", () => {
  it("is SHA256, stable across key order and contracted normalization without mutation", () => {
    const raw = {
      items: [
        {
          catalogRevision: "01",
          quantityUnit: "unit",
          quantity: "01.000",
          productId: id.toUpperCase(),
        },
      ],
      note: "  ",
      tableId: null,
      locationId: ` ${id.toUpperCase()} `,
      orderLabel: " Pedido ",
      saleType: "pickup",
      createRequestId: other,
    };
    const before = structuredClone(raw);
    const digest = createIntentFingerprint(raw);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).toBe(createIntentFingerprint(command));
    expect(raw).toEqual(before);
  });
  it.each([
    { saleType: "delivery" },
    { locationId: other },
    { locationId: null },
    { orderLabel: "Otro" },
    { note: "Nota" },
    { items: [{ ...line, productId: other }] },
    { items: [{ ...line, quantity: "2" }] },
    { items: [{ ...line, quantityUnit: "g" }] },
    { items: [{ ...line, catalogRevision: "2" }] },
    { items: [] },
    { items: [line, line] },
    { orderLabel: "Pe\u0301dido" },
  ])("changes with semantic intent %#", (change) => {
    expect(createIntentFingerprint({ ...command, ...change })).not.toBe(
      createIntentFingerprint(command),
    );
  });
  it("preserves order, multiplicity and distinct snapshots of the same product", () => {
    const second = { ...line, catalogRevision: "2" };
    expect(
      createIntentFingerprint({ ...command, items: [line, second] }),
    ).not.toBe(createIntentFingerprint({ ...command, items: [second, line] }));
  });
  it("normalizes nonauthoritative labels and includes real table reference", () => {
    const table = { ...command, saleType: "table", tableId: id };
    expect(createIntentFingerprint(table)).toBe(
      createIntentFingerprint({
        ...table,
        orderLabel: "current DB name is irrelevant",
      }),
    );
    expect(createIntentFingerprint(table)).not.toBe(
      createIntentFingerprint({ ...table, tableId: other }),
    );
    const counter = { ...command, saleType: "counter" };
    expect(createIntentFingerprint(counter)).toBe(
      createIntentFingerprint({ ...counter, orderLabel: "arbitrary" }),
    );
  });
});
