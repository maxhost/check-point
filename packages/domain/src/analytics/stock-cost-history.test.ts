import { describe, expect, it } from "vitest";
import { buildStockCostHistory } from "./stock-cost-history";
import { historyRange } from "./history";
import type { AnalyticsGauge, AnalyticsInput } from "./types";

const gauge = (
  day: string,
  amountMinor = "0.1",
  patch: Partial<AnalyticsGauge> = {},
): AnalyticsGauge => ({
  day,
  amountMinor,
  metric: "stock_unit_cost",
  dimensionId: "flour",
  locationId: "center",
  unit: "g",
  quantity: "0",
  currencyCode: "USD",
  minorUnit: 2,
  observedAt: `${day}T12:00:00Z`,
  eventId: "a",
  ...patch,
});
const input = (gauges: AnalyticsGauge[] = []): AnalyticsInput => ({
  today: "2026-10-18",
  currencyCode: "USD",
  minorUnit: 2,
  metrics: [],
  gauges,
  labels: [{ kind: "item", id: "flour", label: "Harina" }],
  locations: [
    { id: "center", name: "Principal" },
    { id: "north", name: "Norte" },
  ],
});
const build = (rows: AnalyticsGauge[], locationId?: string) =>
  buildStockCostHistory(input(rows), "2026-10-01", "2026-10-18", locationId);

describe("captured stock unit cost history", () => {
  it("keeps exactly the last real baseline and actual sparse observations across months", () => {
    const h = build([
      gauge("2026-10-18", "0.123456789012345678900"),
      gauge("2026-08-01", "1"),
      gauge("2026-09-29", "0.1"),
      gauge("2026-10-02", "0"),
      gauge("2026-10-19", "999"),
    ]);
    expect(h.series[0]?.points).toEqual([
      { date: "2026-09-29", amountMinor: "0.1", isBaseline: true },
      { date: "2026-10-02", amountMinor: "0", isBaseline: false },
      {
        date: "2026-10-18",
        amountMinor: "0.123456789012345678900",
        isBaseline: false,
      },
    ]);
    expect(h).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-18",
      currencyCode: "USD",
      minorUnit: 2,
    });
  });
  it("chooses each day's latest instant then event ID, independent of ISO offset and input order", () => {
    const rows = [
      gauge("2026-09-30", "1"),
      gauge("2026-10-02", "2", { observedAt: "2026-10-02T09:00:00-05:00" }),
      gauge("2026-10-02", "3", {
        observedAt: "2026-10-02T14:00:00Z",
        eventId: "z",
      }),
      gauge("2026-10-02", "4", { observedAt: "2026-10-02T13:00:00Z" }),
    ];
    expect(build(rows).series[0]?.points.at(-1)?.amountMinor).toBe("3");
    const forward = build(rows);
    expect(build([...rows].reverse())).toEqual(forward);
  });
  it("isolates item/local/unit tuples and labels of kind item only", () => {
    const i = input([
      gauge("2026-10-01"),
      gauge("2026-10-02", "2", { locationId: "north" }),
      gauge("2026-10-03", "3", { unit: "ml" }),
      gauge("2026-10-04", "4", {
        dimensionId: "missing",
        locationId: null,
        unit: "unit",
      }),
    ]);
    i.labels = [
      ...i.labels,
      { kind: "product", id: "missing", label: "Wrong" },
    ];
    const all = buildStockCostHistory(i, "2026-10-01", i.today);
    expect(all.series).toHaveLength(4);
    expect(new Set(all.series.map((s) => s.id)).size).toBe(4);
    expect(all.series.find((s) => s.locationId === "north")).toMatchObject({
      label: "Harina",
      locationName: "Norte",
    });
    expect(all.series.find((s) => s.itemId === "missing")).toMatchObject({
      label: "Insumo sin nombre",
      locationName: "Local sin nombre",
      locationId: null,
    });
    expect(
      buildStockCostHistory(i, "2026-10-01", i.today, "center").series,
    ).toHaveLength(2);
    expect(
      buildStockCostHistory(i, "2026-10-01", i.today, "foreign").series,
    ).toEqual([]);
  });
  it("rejects foreign currency/minor units, absent/foreign units, invalid/negative decimals and future observations", () => {
    const patches: Partial<AnalyticsGauge>[] = [
      { currencyCode: "EUR" },
      { minorUnit: 0 },
      { unit: null },
      { unit: "kg" },
      { unit: "m" },
      { amountMinor: "-1" },
      { amountMinor: "NaN" },
      { amountMinor: "1e-3" },
      { amountMinor: "" },
      { amountMinor: "Infinity" },
      { day: "2026-10-19" },
      { day: "2026-02-30" },
      { observedAt: "bad" },
      { metric: "stock_on_hand" },
      { dimensionId: "" },
    ];
    expect(
      build(patches.map((p) => gauge("2026-10-01", "1", p))).series,
    ).toEqual([]);
    expect(
      buildStockCostHistory(
        input([gauge("2026-10-19")]),
        "2026-10-01",
        "2026-10-31",
      ).series,
    ).toEqual([]);
  });
  it("prefers comparable series, then latest observation, then stable label/id ties", () => {
    const rows = [
      gauge("2026-10-18", "1", { dimensionId: "single" }),
      ...["z", "a"].flatMap((dimensionId) => [
        gauge("2026-09-01", "1", { dimensionId }),
        gauge("2026-10-05", "1", { dimensionId }),
      ]),
      gauge("2026-10-01", "1", { dimensionId: "old" }),
      gauge("2026-10-03", "1", { dimensionId: "old" }),
    ];
    const i = input(rows);
    i.labels = [
      { kind: "item", id: "a", label: "Zeta" },
      { kind: "item", id: "z", label: "Alfa" },
    ];
    const h = buildStockCostHistory(i, "2026-10-01", i.today);
    expect(h.series.map((s) => s.itemId)).toEqual(["z", "a", "old", "single"]);
    expect(h.defaultSeriesId).toBe(h.series[0]?.id);
    const unlabeled = build(rows);
    expect(unlabeled.series.slice(0, 2).map((s) => s.itemId)).toEqual([
      "a",
      "z",
    ]);
    expect(build([...rows].reverse())).toEqual(unlabeled);
  });
  it("supports empty, singleton, baseline-only and flat zero costs without fabricating points", () => {
    expect(build([])).toMatchObject({ series: [], defaultSeriesId: null });
    const single = build([gauge("2026-10-05", "0")]);
    expect(single.series[0]?.points).toEqual([
      { date: "2026-10-05", amountMinor: "0", isBaseline: false },
    ]);
    expect(single.defaultSeriesId).toBe(single.series[0]?.id);
    expect(
      build([gauge("2026-09-01", "0")]).series[0]?.points[0]?.isBaseline,
    ).toBe(true);
    expect(
      build([
        gauge("2026-10-05", "0"),
        gauge("2026-10-10", "0"),
      ]).series[0]?.points.map((p) => p.amountMinor),
    ).toEqual(["0", "0"]);
  });
  it("uses the caller's real period boundaries including leap months and single days", () => {
    for (const period of ["month", "3m", "6m", "9m", "12m"] as const) {
      const range = historyRange("2024-03-01", period);
      const h = buildStockCostHistory(
        { ...input([gauge("2024-02-29")]), today: "2024-03-01" },
        range.from,
        range.to,
      );
      expect(h.series[0]?.points[0]).toEqual({
        date: "2024-02-29",
        amountMinor: "0.1",
        isBaseline: "2024-02-29" < range.from,
      });
    }
    expect(
      buildStockCostHistory(
        input([gauge("2026-10-01"), gauge("2026-10-02")]),
        "2026-10-02",
        "2026-10-02",
      ).series[0]?.points.map((p) => p.isBaseline),
    ).toEqual([true, false]);
    expect(
      buildStockCostHistory(input(), "invalid", "2026-10-02").series,
    ).toEqual([]);
  });
  it("does not mutate input and stable IDs survive range/filter changes", () => {
    const i = input([gauge("2026-10-03"), gauge("2026-09-01")]);
    const snapshot = structuredClone(i);
    Object.freeze(i.gauges);
    i.gauges?.forEach(Object.freeze);
    Object.freeze(i.labels);
    const a = buildStockCostHistory(i, "2026-10-01", i.today);
    const b = buildStockCostHistory(i, "2026-10-02", i.today, "center");
    expect(a.series[0]?.id).toBe(b.series[0]?.id);
    expect(i).toEqual(snapshot);
  });
});
