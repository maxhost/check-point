import { describe, it, expect } from "vitest";
import { metricTranslators as stock } from "./stock/server/metrics";
import { metricTranslators as recipes } from "./recipes/server/metrics";
import type {
  PurchaseRecorded,
  AdjustmentRecorded,
} from "./stock/server/analytics-facts";
const purchase: PurchaseRecorded = {
  eventVersion: 1,
  movementId: "purchase",
  itemId: "flour",
  itemLabel: "Harina",
  itemUnit: "g",
  locationId: "local",
  occurredAt: "2026-09-01T23:00:00Z",
  observedAt: "2026-10-17T14:00:00Z",
  quantity: "0.001",
  onHandAfter: "20.001",
  totalCost: "0.01",
  unitCostBefore: "0.000200",
  unitCostAfter: "0.000220",
  currencyCode: "USD",
  minorUnit: 2,
};
const translate = (eventType: string, payload: unknown) =>
  [...stock, ...recipes]
    .find((t) => t.eventType === eventType)!
    .translate({
      id: "event",
      businessId: "business",
      eventType,
      eventVersion: 1,
      payload,
    });
describe("AN2 pure autosufficient translators", () => {
  it("preserves six decimal input, exact quantities and snapshot day separately from purchase day", () => {
    const copy = structuredClone(purchase);
    const result = translate("stock.purchase.recorded", purchase);
    expect(result).toEqual(translate("stock.purchase.recorded", copy));
    expect(purchase).toEqual(copy);
    expect(result.rows[0]).toMatchObject({
      metric: "stock_purchase",
      amountMinor: "1",
      quantity: "0.001",
      occurredAt: purchase.occurredAt,
    });
    expect(result.gauges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: "stock_unit_cost",
          amountMinor: "0.022000",
          occurredAt: purchase.observedAt,
        }),
        expect.objectContaining({
          metric: "stock_on_hand",
          quantity: "20.001",
          unit: "g",
        }),
      ]),
    );
    const zero = translate("stock.purchase.recorded", {
      ...purchase,
      currencyCode: "COP",
      minorUnit: 0,
      unitCostAfter: "0.000220",
    });
    expect(zero.gauges?.[1].amountMinor).toBe("0.000220");
  });
  it("does not invent a monetary valuation for missing purchase price or count cost", () => {
    const unknown = translate("stock.purchase.recorded", {
      ...purchase,
      totalCost: null,
      unitCostAfter: null,
    });
    expect(unknown.rows[0]).toMatchObject({
      amountMinor: "0",
      count: 0,
      quantity: "0.001",
    });
    expect(unknown.gauges).toHaveLength(1);
    const p: AdjustmentRecorded = {
      ...purchase,
      countedQuantity: "20",
      theoreticalQuantity: "23",
      quantity: "-3",
      unitCost: null,
      gapAmountMinor: null,
    };
    const result = translate("stock.adjustment.recorded", p);
    expect(result.facts).toEqual([]);
    expect(result.rows[0]).toMatchObject({
      quantity: "-3",
      amountMinor: "0",
      count: 0,
    });
  });
  it("count gap preserves signed money/quantity and a specific count destination", () => {
    const p: AdjustmentRecorded = {
      ...purchase,
      countedQuantity: "20",
      theoreticalQuantity: "23",
      quantity: "-3",
      unitCost: "2.000000",
      gapAmountMinor: "-600",
    };
    const result = translate("stock.adjustment.recorded", p);
    expect(result.facts?.[0]).toMatchObject({
      kind: "count_gap",
      amountMinor: "-600",
      quantity: "-3",
      actionHref: expect.stringContaining("movementId=purchase"),
    });
    expect(result.rows[0]).toMatchObject({
      metric: "stock_count_gap",
      amountMinor: "-600",
      quantity: "-3",
    });
  });
  it("late consumption sums on sale day but observes balance when applied", () => {
    const result = translate("recipes.consumption.applied", {
      eventVersion: 1,
      sourceOrderId: "order",
      locationId: "local",
      closedAt: purchase.occurredAt,
      observedAt: purchase.observedAt,
      lines: [],
      items: [
        {
          itemId: "flour",
          itemLabel: "Harina",
          itemUnit: "g",
          quantity: "0.001",
          onHandAfter: "19.999",
        },
      ],
    });
    expect(result.rows).toEqual([
      expect.objectContaining({
        metric: "stock_consumption",
        quantity: "0.001",
        occurredAt: purchase.occurredAt,
      }),
    ]);
    expect(result.gauges?.[0]).toMatchObject({
      quantity: "19.999",
      occurredAt: purchase.observedAt,
      unit: "g",
    });
  });
  it("derivative emits generic exact facts and signed rounded integer sums", () => {
    const result = translate("recipes.product_cost.changed", {
      ...purchase,
      purchaseId: "purchase",
      itemUnitCostBefore: "0.000200",
      itemUnitCostAfter: "0.000220",
      products: [
        {
          productId: "pizza",
          productLabel: "Muzza",
          unitCostBefore: "0.100001",
          unitCostAfter: "0.105002",
        },
      ],
    });
    expect(result.rows[0]).toMatchObject({
      metric: "product_unit_cost_change",
      amountMinor: "1",
      count: 1,
    });
    expect(result.facts?.[0]).toMatchObject({
      kind: "unit_cost_change",
      unitCostBefore: "0.100001",
      unitCostAfter: "0.105002",
      itemUnitCostBefore: "0.000200",
      itemUnitCostAfter: "0.000220",
    });
  });
  it("nullable product cost remains a logged fact without inventing a delta or card", () => {
    const result = translate("recipes.product_cost.changed", {
      ...purchase,
      purchaseId: "first",
      itemUnitCostBefore: null,
      itemUnitCostAfter: "0.000220",
      products: [
        {
          productId: "pizza",
          productLabel: "Muzza",
          unitCostBefore: null,
          unitCostAfter: "0.105002",
        },
      ],
    });
    expect(result.rows).toEqual([]);
    expect(result.facts).toEqual([]);
  });
});
