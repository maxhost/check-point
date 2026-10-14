import { describe, expect, it } from "vitest";
import type { SaleClosedEvent } from "../../../server/module-events/types";
import { expandRecipes } from "./consumption-snapshot";
const event: SaleClosedEvent = {
  eventVersion: 1,
  sourceOrderId: "order",
  locationId: "local",
  userId: "user",
  closedAt: "2026-10-14T12:00:00Z",
  lines: [
    {
      sourceLineId: "first",
      productId: "pizza",
      quantity: 3,
      resourceVersions: [
        { providerId: "recipes", slot: "recipe", versionId: "old" },
      ],
    },
  ],
};
const revisions = [
  {
    id: "old",
    productId: "pizza",
    lines: [{ itemId: "flour", unit: "g", quantity: "250.000" }],
  },
  {
    id: "new",
    productId: "pizza",
    lines: [{ itemId: "flour", unit: "g", quantity: "1.000" }],
  },
];
describe("captured immutable recipe consumption", () => {
  it("2500g/10 pizzas already normalized to250g ×3 =750g, ignores today's revision", () => {
    expect(expandRecipes(event, revisions)).toEqual([
      {
        sourceLineId: "first",
        productId: "pizza",
        itemId: "flour",
        quantity: "750.000",
      },
    ]);
  });
  it("same ingredient across distinct sale lines preserves each source", () => {
    expect(
      expandRecipes(
        {
          ...event,
          lines: [
            ...event.lines,
            { ...event.lines[0], sourceLineId: "second", quantity: 2 },
          ],
        },
        revisions,
      ),
    ).toEqual([
      {
        sourceLineId: "first",
        productId: "pizza",
        itemId: "flour",
        quantity: "750.000",
      },
      {
        sourceLineId: "second",
        productId: "pizza",
        itemId: "flour",
        quantity: "500.000",
      },
    ]);
  });
  it("missing or foreign captured revision fails instead of acknowledging partial work", () => {
    expect(() => expandRecipes(event, [])).toThrow("unavailable");
    expect(() =>
      expandRecipes(event, [{ ...revisions[0], productId: "foreign" }]),
    ).toThrow("unavailable");
  });
  it("no product, no pointer or immutable empty deletion produces no consumption", () => {
    expect(
      expandRecipes(
        {
          ...event,
          lines: [
            { ...event.lines[0], productId: null },
            { ...event.lines[0], resourceVersions: [] },
          ],
        },
        revisions,
      ),
    ).toEqual([]);
    expect(expandRecipes(event, [{ ...revisions[0], lines: [] }])).toEqual([]);
  });
  it("multiplication preserves exact thousandths", () => {
    expect(
      expandRecipes(event, [
        {
          ...revisions[0],
          lines: [{ itemId: "salt", unit: "g", quantity: "0.001" }],
        },
      ])[0].quantity,
    ).toBe("0.003");
  });
});
