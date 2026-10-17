import { describe, expect, it } from "vitest";
import {
  buildFactCandidates,
  buildStockCandidates,
  carryFactCandidate,
} from "@mi-pasaporte/domain/analytics/cards/stock";
import { summarizeStockHistory } from "@mi-pasaporte/domain/analytics/stock-history";
import { addDays } from "@mi-pasaporte/domain/analytics/date";
import type {
  AnalyticsGauge,
  AnalyticsInput,
  AnalyticsMetric,
  CardState,
} from "@mi-pasaporte/domain/analytics/types";
import type { AnalyticsFact } from "@mi-pasaporte/domain/analytics/metrics";
const metric = (
  metric: string,
  quantity = 0,
  amountMinor = 0,
  day = "2026-10-19",
  locationId = "center",
  dimensionId: string | null = "flour",
): AnalyticsMetric => ({
  metric,
  day,
  locationId,
  dimensionId,
  amountMinor,
  quantity,
  count: 1,
  currencyCode: "USD",
  minorUnit: 2,
});
const gauge = (
  metric: string,
  day = "2026-10-20",
  quantity = "20",
  amountMinor = "120",
  locationId = "center",
  dimensionId = "flour",
): AnalyticsGauge => ({
  metric,
  day,
  locationId,
  dimensionId,
  amountMinor,
  quantity,
  unit: "kg",
  currencyCode: "USD",
  minorUnit: 2,
  observedAt: `${day}T12:00:00Z`,
  eventId: day,
});
const input = (): AnalyticsInput => ({
  today: "2026-10-20",
  currencyCode: "USD",
  minorUnit: 2,
  locations: [
    { id: "center", name: "Centro" },
    { id: "north", name: "Norte" },
  ],
  labels: [{ kind: "item", id: "flour", label: "harina" }],
  metrics: [
    metric("units_sold", 200, 0, "2026-10-19", "center", "pizza"),
    metric("revenue", 0, 10000, "2026-10-19", "center", null),
  ],
  gauges: [gauge("stock_on_hand")],
  firstConsumptionDays: [
    { locationId: "center", itemId: "flour", day: "2026-09-22" },
  ],
});
const cost = (
  patch: Partial<Extract<AnalyticsFact, { kind: "unit_cost_change" }>> = {},
): AnalyticsFact => ({
  kind: "unit_cost_change",
  occurredAt: "2026-10-20T10:00:00Z",
  locationId: "center",
  itemId: "flour",
  itemLabel: "harina",
  itemUnit: "kg",
  itemUnitCostBefore: "1.000000",
  itemUnitCostAfter: "1.120000",
  productId: "pizza",
  productLabel: "muzza",
  unitCostBefore: "1.500000",
  unitCostAfter: "1.680000",
  currencyCode: "USD",
  minorUnit: 2,
  ...patch,
});
const gap = (
  patch: Partial<Extract<AnalyticsFact, { kind: "count_gap" }>> = {},
): AnalyticsFact => ({
  kind: "count_gap",
  occurredAt: "2026-10-20T10:00:00Z",
  locationId: "center",
  itemId: "flour",
  itemLabel: "harina",
  itemUnit: "kg",
  quantity: "-3",
  amountMinor: "-300",
  currencyCode: "USD",
  minorUnit: 2,
  actionHref: "/backoffice/sample?movementId=count",
  ...patch,
});
const facts = (i: AnalyticsInput, f: AnalyticsFact[], id = "event") =>
  buildFactCandidates(i, f, id, (d) => d.slice(0, 10));

describe("AN-2 cost increase", () => {
  it("uses the ingredient 5% threshold inclusively and local product weekly impact", () => {
    const i = input();
    i.metrics = [
      ...i.metrics,
      metric("units_sold", 900, 0, "2026-10-19", "north", "pizza"),
    ];
    expect(facts(i, [cost({ itemUnitCostAfter: "1.049999" })])).toEqual([]);
    const c = facts(i, [cost({ itemUnitCostAfter: "1.050000" })])[0]!;
    expect(c.amountMinor).toBe(900);
    expect(c.body).toContain("5%");
    expect(c.body).toContain("muzza");
    expect(c.actionKey).toBe("edit_product_price");
    expect(facts(i, [cost({ itemUnitCostBefore: "0" })])).toEqual([]);
    expect(facts(i, [cost({ unitCostAfter: "1.49" })])).toEqual([]);
  });
  it("preserves sub-cent costs before multiplying sales and decays below the urgency floor", () => {
    const i = input();
    i.metrics = [
      metric("units_sold", 100000, 0, "2026-10-19", "center", "pizza"),
    ];
    const c = facts(i, [
      cost({
        itemUnitCostBefore: "0.000100",
        itemUnitCostAfter: "0.000105",
        unitCostBefore: "0.000100",
        unitCostAfter: "0.000105",
      }),
    ])[0]!;
    expect(c.amountMinor).toBe(13); // 12.5 minor, rounded only after the 25k weekly units
    expect(c.body).not.toContain("$0.00 más");
    const after = carryFactCandidate({ ...i, today: "2026-10-30" }, c)!;
    expect(after.weight).toBeCloseTo(c.weight * 0.7 ** 10);
  });
  it("sums fractional sales exactly before rounding a half minor unit", () => {
    const i = input();
    i.metrics = [
      metric("units_sold", 0.1, 0, "2026-10-18", "center", "pizza"),
      metric("units_sold", 0.7, 0, "2026-10-19", "center", "pizza"),
    ];
    expect(
      facts(i, [
        cost({
          itemUnitCostAfter: "1.05",
          unitCostBefore: "2",
          unitCostAfter: "2.025",
        }),
      ])[0]?.amountMinor,
    ).toBe(1);
  });
  it("honors dismissals until a material change and rejects facts in another currency", () => {
    const i = input(),
      c = facts(i, [cost()])[0]!;
    const state: CardState = {
      ...c,
      status: "dismissed",
      shownDays: 1,
      lastShownDay: i.today,
    };
    expect(carryFactCandidate(i, c, [state])?.weight).toBe(0);
    expect(facts(i, [cost({ currencyCode: "ARS" })])).toEqual([]);
  });
});

describe("AN-2 depletion range", () => {
  const withConsumption = () => {
    const i = input();
    i.metrics = [
      ...i.metrics,
      ...Array.from({ length: 28 }, (_, n) =>
        metric(
          "stock_consumption",
          n < 14 ? 5 : 10,
          0,
          addDays(i.today, -n - 1),
        ),
      ),
    ];
    return i;
  };
  it("requires 28 days for that local/item and uses all 28 days' p25/p75", () => {
    const i = withConsumption();
    const c = buildStockCandidates(i)[0]!;
    expect(c.body).toContain("20 kg en Centro");
    expect(c.body).toContain("jueves");
    expect(c.body).toContain("sábado");
    expect(c.urgency).toBeCloseTo(0.6);
    expect(c.actionKey).toBe("record_purchase");
    expect(c.quality).toBe("estimated");
    expect(
      buildStockCandidates({
        ...i,
        firstConsumptionDays: [
          { locationId: "center", itemId: "flour", day: "2026-09-23" },
        ],
        metrics: i.metrics.filter((r) => r.day >= "2026-09-23"),
      }),
    ).toEqual([]);
    expect(
      buildStockCandidates({
        ...i,
        gauges: [gauge("stock_on_hand", i.today, "20", "0", "north")],
      }),
    ).toEqual([]);
    expect(
      buildStockCandidates({
        ...i,
        gauges: [
          gauge("stock_on_hand", i.today, "20", "0", "center", "new-item"),
        ],
      }),
    ).toEqual([]);
  });
  it("includes the four-day boundary and makes the missing upper bound explicit", () => {
    const i = withConsumption();
    expect(
      buildStockCandidates({
        ...i,
        gauges: [gauge("stock_on_hand", i.today, "40")],
      }),
    ).toHaveLength(1);
    expect(
      buildStockCandidates({
        ...i,
        gauges: [gauge("stock_on_hand", i.today, "40.001")],
      }),
    ).toEqual([]);
    i.metrics = i.metrics.filter(
      (r) => r.metric !== "stock_consumption" || r.day >= "2026-10-07",
    );
    expect(buildStockCandidates(i)[0]?.body).toContain("días sin consumo");
    expect(buildStockCandidates({ ...i, metrics: [] })).toEqual([]);
    expect(
      buildStockCandidates({
        ...withConsumption(),
        gauges: [gauge("stock_on_hand", i.today, "-1")],
      })[0]?.body,
    ).toContain("Quedan 0 kg");
  });
});

describe("AN-2 count loss", () => {
  it("uses max(3 major, 1% weekly sales), inclusive, and only missing stock", () => {
    const i = input();
    expect(facts(i, [gap({ amountMinor: "-299" })])).toEqual([]);
    expect(facts(i, [gap()])[0]?.amountMinor).toBe(300);
    expect(facts(i, [gap({ quantity: "3", amountMinor: "300" })])).toEqual([]);
    const high = {
      ...i,
      metrics: [metric("revenue", 0, 40000, "2026-10-19", "center", null)],
    };
    expect(facts(high, [gap()])).toEqual([]);
    expect(facts(high, [gap({ amountMinor: "-400" })])).toHaveLength(1);
    expect(
      facts(
        {
          ...i,
          metrics: [metric("revenue", 0, 999999, "2026-10-19", "north")],
        },
        [gap()],
      ),
    ).toHaveLength(1);
  });
  it("keeps each count's destination and applies decay in the business currency without FX", () => {
    const i = { ...input(), currencyCode: "JPY", minorUnit: 0, metrics: [] };
    const c = facts(
      i,
      [gap({ currencyCode: "JPY", minorUnit: 0, amountMinor: "-3" })],
      "count1",
    )[0]!;
    expect(c.actionHref).toContain("movementId=count");
    expect(c.subjectKey).toBe("count1:flour");
    expect(
      facts(i, [gap({ currencyCode: "JPY", minorUnit: 0, amountMinor: "-2" })]),
    ).toEqual([]);
    expect(
      carryFactCandidate({ ...i, today: "2026-10-30" }, c)?.weight,
    ).toBeCloseTo(c.weight * 0.7 ** 10);
  });
});

describe("AN-2 stock history", () => {
  it("uses independent latest cost/stock before period end and reports unknown costs", () => {
    const i = input();
    i.gauges = [
      gauge("stock_unit_cost", "2026-09-01", "0", "0.0001"),
      gauge("stock_on_hand", "2026-10-10", "100000"),
      gauge("stock_on_hand", "2026-10-15", "3", "0", "north"),
      gauge("stock_unit_cost", "2026-11-01", "0", "999"),
    ];
    expect(
      summarizeStockHistory(i, "2026-10-01", i.today, "center"),
    ).toMatchObject({
      valueMinor: 10,
      knownValueMinor: 10,
      valuedItems: 1,
      unvaluedItems: 0,
    });
    expect(summarizeStockHistory(i, "2026-10-01", i.today)).toMatchObject({
      valueMinor: null,
      knownValueMinor: 10,
      unvaluedItems: 1,
    });
    expect(
      summarizeStockHistory({ ...i, gauges: [] }, "2026-10-01", i.today)
        .valueMinor,
    ).toBeNull();
  });
  it("counts observed daily rises within period/local, never invents an interval from one rise", () => {
    const i = input();
    i.gauges = [
      gauge("stock_unit_cost", "2026-09-01", "0", "100"),
      gauge("stock_unit_cost", "2026-10-01", "0", "110"),
      gauge("stock_unit_cost", "2026-10-11", "0", "121"),
      gauge("stock_unit_cost", "2026-10-15", "0", "10000", "north"),
    ];
    const h = summarizeStockHistory(i, "2026-10-01", i.today, "center");
    expect(h.averageIncrease).toBeCloseTo(0.21);
    expect(h.increaseDays).toBe(2);
    expect(h.averageDaysBetweenIncreases).toBe(10);
    const fluctuating = {
      ...i,
      gauges: [
        gauge("stock_unit_cost", "2026-09-01", "0", "100"),
        gauge("stock_unit_cost", "2026-10-01", "0", "110"),
        gauge("stock_unit_cost", "2026-10-05", "0", "100"),
        gauge("stock_unit_cost", "2026-10-11", "0", "110"),
      ],
    };
    expect(
      summarizeStockHistory(fluctuating, "2026-10-01", i.today).averageIncrease,
    ).toBeCloseTo(0.1);
    expect(
      summarizeStockHistory(i, "2026-10-10", i.today, "center")
        .averageDaysBetweenIncreases,
    ).toBeNull();
  });
});
