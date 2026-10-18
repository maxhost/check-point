import { validDay } from "./date";
import type { StockCostHistory } from "./stock-cost-contract";
import type { AnalyticsGauge, AnalyticsInput } from "./types";

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const observedOrder = (a: AnalyticsGauge, b: AnalyticsGauge) =>
  Date.parse(a.observedAt) - Date.parse(b.observedAt) ||
  compare(a.eventId, b.eventId);

/** Daily captured costs, plus one real baseline; never interpolates or rounds money. */
export function buildStockCostHistory(
  input: AnalyticsInput,
  from: string,
  to: string,
  locationId?: string,
): StockCostHistory {
  const history: StockCostHistory = {
    from,
    to,
    currencyCode: input.currencyCode,
    minorUnit: input.minorUnit,
    defaultSeriesId: null,
    series: [],
  };
  if (!validDay(from) || !validDay(to) || from > to) return history;
  const groups = new Map<string, Map<string, AnalyticsGauge>>();
  for (const row of input.gauges ?? []) {
    if (
      row.metric !== "stock_unit_cost" ||
      (locationId && row.locationId !== locationId) ||
      row.currencyCode !== input.currencyCode ||
      row.minorUnit !== input.minorUnit ||
      !row.dimensionId ||
      !row.unit ||
      !["g", "ml", "unit"].includes(row.unit) ||
      typeof row.amountMinor !== "string" ||
      !/^\d+(?:\.\d+)?$/.test(row.amountMinor) ||
      !validDay(row.day) ||
      row.day > to ||
      row.day > input.today ||
      !Number.isFinite(Date.parse(row.observedAt))
    )
      continue;
    // Tuple encoding prevents collisions between nulls and IDs containing separators.
    const id = JSON.stringify([row.dimensionId, row.locationId, row.unit]);
    const days = groups.get(id) ?? new Map<string, AnalyticsGauge>();
    const previous = days.get(row.day);
    if (!previous || observedOrder(row, previous) > 0) days.set(row.day, row);
    groups.set(id, days);
  }
  const latest = new Map<string, AnalyticsGauge>();
  for (const [id, days] of groups) {
    const observations = [...days.values()].sort((a, b) =>
      compare(a.day, b.day),
    );
    const baseline = observations.filter((row) => row.day < from).at(-1);
    const selected = observations.filter((row) => row.day >= from);
    if (baseline) selected.unshift(baseline);
    if (!selected.length) continue;
    const last = selected.at(-1)!;
    latest.set(id, last);
    history.series.push({
      id,
      itemId: last.dimensionId,
      label:
        input.labels.find((l) => l.kind === "item" && l.id === last.dimensionId)
          ?.label || "Insumo sin nombre",
      locationId: last.locationId,
      locationName:
        input.locations.find((l) => l.id === last.locationId)?.name ||
        "Local sin nombre",
      unit: last.unit!,
      points: selected.map((row) => ({
        date: row.day,
        amountMinor: row.amountMinor,
        isBaseline: row.day < from,
      })),
    });
  }
  // Default ties use label/id, not the immutable event ID of unrelated items.
  history.series.sort((a, b) => {
    const aLatest = latest.get(a.id)!,
      bLatest = latest.get(b.id)!;
    return (
      Number(b.points.length >= 2) - Number(a.points.length >= 2) ||
      Date.parse(bLatest.observedAt) - Date.parse(aLatest.observedAt) ||
      compare(a.label, b.label) ||
      compare(a.id, b.id)
    );
  });
  history.defaultSeriesId = history.series[0]?.id ?? null;
  return history;
}
