import { describe, it, expect } from "vitest";
import { metricTranslators as expenses } from "./expenses/server/metrics";
import { metricTranslators as recipes } from "./recipes/server/metrics";
import { coreMetricTranslators } from "../server/analytics/ingestion/core-translators";
import { localMetricDay } from "../server/analytics/ingestion/apply";
const envelope = { id: "event", businessId: "business", eventVersion: 1 };
describe("AN1 pure captured translators", () => {
  it("local date uses the business timezone", () =>
    expect(localMetricDay("2026-10-17T04:30:00Z", "America/Guayaquil")).toBe(
      "2026-10-16",
    ));
  it("expense deletion retains revision while updated moves explicit local day", () => {
    const payload = {
      expenseId: "expense",
      revision: 3,
      paidOn: "2026-10-02",
      locationId: null,
      conceptId: "concept",
      conceptName: "Alquiler",
      isFixed: true,
      amountMinor: "12345",
      currencyCode: "USD",
      minorUnit: 2,
    };
    const event = { ...envelope, eventType: "expense.updated", payload };
    expect(expenses[1].translate(event)).toEqual(
      expenses[1].translate(structuredClone(event)),
    );
    expect(expenses[1].translate(event)).toMatchObject({
      sourceKey: "expense:expense",
      sourceRevision: 3,
      rows: [{ day: "2026-10-02", locationId: null, amountMinor: "12345" }],
    });
    expect(
      expenses[2].translate({ ...event, eventType: "expense.deleted" }),
    ).toMatchObject({ sourceRevision: 3, rows: [] });
  });
  it("only complete recipe lines contribute cost and cost coverage; commission owns separate source", () => {
    const event = {
      ...envelope,
      eventType: "recipes.consumption.applied",
      payload: {
        sourceOrderId: "order",
        locationId: "local",
        closedAt: "2026-10-17T04:30:00Z",
        lines: [
          {
            productId: "product",
            productLabel: "Café",
            quantity: "2",
            cost: { amountMinor: "250", currencyCode: "USD", minorUnit: 2 },
          },
          { productId: "missing", quantity: "1", cost: null },
        ],
      },
    };
    expect(recipes[0].translate(event)).toEqual(
      recipes[0].translate(structuredClone(event)),
    );
    expect(recipes[0].translate(event).rows).toHaveLength(2);
    expect(
      coreMetricTranslators[0].translate({
        ...envelope,
        eventType: "sale.commission.frozen",
        payload: {
          ...event.payload,
          amountMinor: "100",
          currencyCode: "USD",
          minorUnit: 2,
        },
      }).sourceKey,
    ).toBe("sale.commission.frozen:order");
  });
});
