import { describe, expect, it } from "vitest";
import { UNIT_MEASURE, type LineMeasure } from "@mi-pasaporte/domain/measures";
import { metricTranslators } from "./metrics";
import type { MeasuredConsumptionApplied } from "./consumption-applied";
const mass: LineMeasure = {
  kind: "mass",
  quantityUnit: "lb",
  priceUnit: "kg",
  conversionVersion: "mass-si-1",
};
const line = (
  measure: LineMeasure = mass,
  quantity = "0.000000001",
): MeasuredConsumptionApplied["lines"][number] => ({
  sourceLineId: "line",
  productId: "product",
  productLabel: "Captured",
  quantity,
  measure,
  revenueMinor: "120",
  allocatedCommissionMinor: "3",
  cost: { amountMinor: "0", currencyCode: "USD", minorUnit: 2 },
});
const payload = (): MeasuredConsumptionApplied => ({
  eventVersion: 2,
  sourceOrderId: "order",
  locationId: "location",
  closedAt: "2026-10-18T10:00:00Z",
  observedAt: "2026-10-18T11:00:00Z",
  currencyCode: "USD",
  minorUnit: 2,
  lines: [
    line(),
    { ...line(UNIT_MEASURE, "2"), sourceLineId: "unit" },
    { ...line(), sourceLineId: "missing", cost: null },
  ],
  items: [
    {
      itemId: "ingredient",
      itemLabel: "Ingredient",
      itemUnit: "g",
      quantity: "17.123",
      onHandAfter: "-7.123",
    },
  ],
});
const translate = (p: unknown = payload(), eventVersion = 2) =>
  metricTranslators[1].translate({
    id: "event",
    businessId: "business",
    eventType: "recipes.consumption.applied",
    eventVersion,
    payload: p,
  });
describe("measured consumption metrics", () => {
  it("separates exact 14-decimal grams and discrete units, with complete zero coverage", () => {
    const result = translate();
    expect(result).toMatchObject({
      sourceKey: "recipes.consumption.applied:order",
      sourceRevision: 1,
    });
    expect(result.rows.filter((r) => r.metric === "mass_with_cost_g")).toEqual([
      expect.objectContaining({ quantity: "0.00000045359237" }),
    ]);
    expect(result.rows.filter((r) => r.metric === "units_with_cost")).toEqual([
      expect.objectContaining({ quantity: "2" }),
    ]);
    for (const metric of [
      "cost_of_goods",
      "revenue_with_cost",
      "payment_commission_with_cost",
    ])
      expect(result.rows.filter((r) => r.metric === metric)).toHaveLength(2);
    expect(
      result.rows
        .filter((r) => r.metric === "cost_of_goods")
        .map((r) => r.amountMinor),
    ).toEqual(["0", "0"]);
    expect(
      result.rows.find((r) => r.metric === "stock_consumption"),
    ).toMatchObject({ quantity: "17.123", occurredAt: payload().closedAt });
    expect(result.gauges).toEqual([
      expect.objectContaining({
        quantity: "-7.123",
        unit: "g",
        occurredAt: payload().observedAt,
      }),
    ]);
  });
  it("priceUnit affects neither physical coverage nor captured money", () => {
    const p = payload();
    p.lines[0].measure = { ...mass, priceUnit: "g" } as LineMeasure;
    expect(translate(p)).toEqual(translate());
  });
  it("null costs have no coverage or financial rows", () => {
    const p = payload();
    p.lines = p.lines.map((l) => ({ ...l, cost: null }));
    expect(translate(p).rows.map((r) => r.metric)).toEqual([
      "stock_consumption",
    ]);
  });
  it.each([1, 3, 4, 0])(
    "rejects an incompatible external version %s",
    (version) => {
      expect(() => translate(payload(), version)).toThrow();
    },
  );
  it.each([
    { measure: undefined },
    { measure: {} },
    { measure: { ...mass, conversionVersion: "future" } },
    { measure: { ...mass, quantityUnit: "unit" } },
    { measure: UNIT_MEASURE, quantity: "1.5" },
    { quantity: 1 },
    { quantity: "0" },
    { quantity: "0.0000000001" },
    { cost: {} },
  ])("rejects invalid measured lines before emitting rows: %j", (patch) => {
    const p = payload();
    Object.assign(p.lines[0], patch);
    expect(() => translate(p)).toThrow();
  });
  it("rejects inconsistent payload version", () => {
    expect(() => translate({ ...payload(), eventVersion: 1 })).toThrow();
  });
  it("keeps legacy additive-field tolerance and original unit/money semantics", () => {
    const result = translate(
      {
        sourceOrderId: "old",
        locationId: "local",
        closedAt: "old-time",
        lines: [
          {
            quantity: "3",
            productId: "p",
            cost: { amountMinor: "2", currencyCode: "COP", minorUnit: 0 },
          },
        ],
        items: [],
      },
      1,
    );
    expect(result).toMatchObject({
      sourceKey: "recipes.consumption.applied:old",
      sourceRevision: 1,
      rows: [
        expect.objectContaining({ metric: "cost_of_goods", amountMinor: "2" }),
        expect.objectContaining({ metric: "units_with_cost", quantity: "3" }),
      ],
    });
  });
});
