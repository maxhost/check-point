import { describe, expect, it } from "vitest";
import { personalPicks } from "./personal-picks";

const catalog = [
  { id: "coffee", name: "Café" },
  { id: "juice", name: "Jugo" },
  { id: "pastry", name: "Medialuna" },
];

describe("atajos del mostrador", () => {
  it("usa órdenes distintas para los habituales y mantiene la última compra exacta", () => {
    const result = personalPicks(
      [{ id: "new" }, { id: "old" }],
      [
        { orderId: "new", productId: "coffee", quantity: 2 },
        { orderId: "new", productId: "juice", quantity: 1 },
        { orderId: "old", productId: "coffee", quantity: 1 },
      ],
      catalog,
    );
    expect(result.habitualProductIds).toEqual(["coffee"]);
    expect(result.lastPurchase).toEqual({
      items: [
        { productId: "coffee", quantity: 2 },
        { productId: "juice", quantity: 1 },
      ],
    });
  });

  it("oculta la repetición si el producto ya no existe y no lo sugiere", () => {
    const result = personalPicks(
      [{ id: "new" }, { id: "old" }],
      [
        { orderId: "new", productId: null, quantity: 1 },
        { orderId: "old", productId: "coffee", quantity: 1 },
      ],
      catalog,
    );
    expect(result.lastPurchase).toBeNull();
    expect(result.habitualProductIds).toEqual([]);
  });
});
