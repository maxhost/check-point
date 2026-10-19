import { describe, expect, it, vi } from "vitest";
import type { DbTransaction } from "@mi-pasaporte/db";
import { captureMeasuredLines } from "./measured-capture";

// Availability/tenant SQL is exercised by the real integration suite. This suite
// supplies already-selected catalog rows to isolate exact capture projection.
vi.mock("../../../server/counter/catalog-visibility", () => ({
  availableAtCounter: () => undefined,
}));

/** Pure capture projection only: deliberately does not certify canonical mass writes. */
function transaction(
  product: Record<string, unknown>,
  units = ["kg", "lb", "g"],
) {
  let selection = 0;
  return {
    select() {
      const rows = selection++ === 0 ? [{ units }] : [product];
      const query = {
        from() {
          return query;
        },
        where() {
          return query;
        },
        orderBy() {
          return query;
        },
        for() {
          return Promise.resolve(rows);
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve);
        },
      };
      return query;
    },
  } as unknown as DbTransaction;
}
const product = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Producto",
  unitPrice: "4.000000000",
  soldByWeight: true,
  pricingUnit: "lb",
  revision: 3,
};
const line = {
  productId: product.id,
  quantity: "2",
  quantityUnit: "lb" as const,
  catalogRevision: "3",
};
describe("0242 transactional capture projection (mass algebra, no canonical DB writes)", () => {
  it("interprets price by pricingUnit while preserving the captured unit", async () => {
    for (const input of [
      line,
      { ...line, quantity: "907.18474", quantityUnit: "g" as const },
      { ...line, quantity: "0.90718474", quantityUnit: "kg" as const },
    ]) {
      const captured = await captureMeasuredLines(
        transaction(product),
        "business",
        "local",
        "USD",
        [input],
      );
      expect(captured.total).toBe("8.00");
      expect(captured.lines[0].measure).toEqual({
        kind: "mass",
        quantityUnit: input.quantityUnit,
        priceUnit: "lb",
        conversionVersion: "mass-si-1",
      });
      expect(captured.lines[0].quantity).toBe(input.quantity);
    }
  });
  it("keeps repeated products distinct with actual source IDs and positions", async () => {
    const captured = await captureMeasuredLines(
      transaction(product),
      "business",
      "local",
      "USD",
      [line, line],
    );
    expect(captured.total).toBe("16.00");
    expect(captured.lines.map((item) => item.position)).toEqual([0, 1]);
    expect(new Set(captured.lines.map((item) => item.sourceLineId)).size).toBe(
      2,
    );
  });
  it("rejects disabled capture units and incompatible dimensions", async () => {
    await expect(
      captureMeasuredLines(
        transaction(product, ["kg"]),
        "business",
        "local",
        "USD",
        [line],
      ),
    ).rejects.toMatchObject({ code: "invalid_unit" });
    await expect(
      captureMeasuredLines(transaction(product), "business", "local", "USD", [
        { ...line, quantityUnit: "unit" },
      ]),
    ).rejects.toMatchObject({ code: "invalid_measure" });
  });
  it("exposes only the authorized catalog projection on revision conflicts", async () => {
    await expect(
      captureMeasuredLines(
        transaction({ ...product, unitCost: "secret" }),
        "business",
        "local",
        "USD",
        [{ ...line, catalogRevision: "2" }],
      ),
    ).rejects.toMatchObject({
      code: "catalog_changed",
      extra: {
        product: { id: product.id, catalogRevision: "3", unitPrice: "4" },
      },
    });
  });
});
