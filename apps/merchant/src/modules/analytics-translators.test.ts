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
        items: [],
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
    expect(
      recipes
        .find((t) => t.eventType === "recipes.consumption.applied")!
        .translate(event),
    ).toEqual(
      recipes
        .find((t) => t.eventType === "recipes.consumption.applied")!
        .translate(structuredClone(event)),
    );
    expect(
      recipes
        .find((t) => t.eventType === "recipes.consumption.applied")!
        .translate(event).rows,
    ).toHaveLength(2);
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

describe("AN1 exact covered money", () => {
  it("allocates a frozen cent over all three equal lines by position deterministically", async () => {
    const { allocateLineCommissions } =
      await import("../server/business/commission-close");
    const { buildFinancialSettlement } =
      await import("@mi-pasaporte/domain/financial");
    const settlement = buildFinancialSettlement({
      currencyCode: "USD",
      discount: null,
      lines: [0, 1, 2].map((position) => ({
        sourceLineId: `line-${position}`,
        position,
        unitPrice: "1.00",
        quantity: 1,
      })),
      payments: [{ methodId: "method", paymentId: "payment", amount: "3.00" }],
    });
    const expected = { "line-0": "0", "line-1": "1", "line-2": "0" };
    expect(allocateLineCommissions(1n, settlement.lines)).toEqual(expected);
    expect(
      allocateLineCommissions(1n, [...settlement.lines].reverse()),
    ).toEqual(expected);
    expect(
      Object.values(expected).reduce((sum, fee) => sum + BigInt(fee), 0n),
    ).toBe(1n);
    expect(allocateLineCommissions(null, settlement.lines)).toEqual({
      "line-0": null,
      "line-1": null,
      "line-2": null,
    });
    expect(allocateLineCommissions(0n, settlement.lines)).toEqual({
      "line-0": "0",
      "line-1": "0",
      "line-2": "0",
    });
    expect(() =>
      allocateLineCommissions(
        1n,
        settlement.lines.map((l) => ({
          ...l,
          money: { ...l.money, net: "0.00" },
        })),
      ),
    ).toThrow();
  });
  it("keeps exact known revenue and fee for one of two differently priced same-product lines", () => {
    const event = {
      ...envelope,
      eventType: "recipes.consumption.applied",
      payload: {
        eventVersion: 1,
        sourceOrderId: "order",
        locationId: "local",
        closedAt: "2026-10-17T15:00:00Z",
        currencyCode: "USD",
        minorUnit: 2,
        lines: [
          {
            productId: "product",
            productLabel: "Café",
            quantity: "1",
            revenueMinor: "100",
            allocatedCommissionMinor: "2",
            cost: { amountMinor: "40", currencyCode: "USD", minorUnit: 2 },
          },
          {
            productId: "product",
            productLabel: "Café",
            quantity: "1",
            revenueMinor: "900",
            allocatedCommissionMinor: "18",
            cost: null,
          },
        ],
        items: [],
      },
    };
    const rows = recipes
      .find((t) => t.eventType === "recipes.consumption.applied")!
      .translate(event).rows;
    expect(rows.find((r) => r.metric === "revenue_with_cost")).toMatchObject({
      amountMinor: "100",
      count: 1,
    });
    expect(
      rows.find((r) => r.metric === "payment_commission_with_cost"),
    ).toMatchObject({ amountMinor: "2", count: 1 });
    expect(rows.find((r) => r.metric === "cost_of_goods")).toMatchObject({
      amountMinor: "40",
      count: 1,
    });
    expect((100 - 40 - 2) / 100).toBe(0.58);
    expect(rows.filter((r) => r.metric === "revenue_with_cost")).toHaveLength(
      1,
    );
  });
  it("does not convert unknown commission or legacy missing revenue into zero", () => {
    const event = {
      ...envelope,
      eventType: "recipes.consumption.applied",
      payload: {
        sourceOrderId: "unknown",
        items: [],
        locationId: "local",
        closedAt: "2026-10-17T15:00:00Z",
        currencyCode: "USD",
        minorUnit: 2,
        lines: [
          {
            productId: "product",
            quantity: "1",
            revenueMinor: "100",
            allocatedCommissionMinor: null,
            cost: { amountMinor: "40", currencyCode: "USD", minorUnit: 2 },
          },
        ],
      },
    };
    expect(
      recipes
        .find((t) => t.eventType === "recipes.consumption.applied")!
        .translate(event)
        .rows.some((r) => r.metric === "payment_commission_with_cost"),
    ).toBe(false);
    const zero = structuredClone(event);
    zero.payload.lines[0].allocatedCommissionMinor = "0" as never;
    expect(
      recipes
        .find((t) => t.eventType === "recipes.consumption.applied")!
        .translate(zero)
        .rows.find((r) => r.metric === "payment_commission_with_cost"),
    ).toMatchObject({ amountMinor: "0", count: 1 });
    const legacy = {
      ...event,
      payload: {
        ...event.payload,
        currencyCode: null,
        minorUnit: null,
        lines: event.payload.lines.map((l) => ({ ...l, revenueMinor: null })),
      },
    };
    const rows = recipes
      .find((t) => t.eventType === "recipes.consumption.applied")!
      .translate(legacy).rows;
    expect(rows.find((r) => r.metric === "cost_of_goods")?.count).toBe(1);
    expect(rows.some((r) => r.metric === "revenue_with_cost")).toBe(false);
  });
});
