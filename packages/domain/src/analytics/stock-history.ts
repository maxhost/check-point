import { daysBetween } from "./date";
import { decimal, moneyRatio } from "./money";
import { latestGauges } from "./cards/stock";
import type { AnalyticsInput } from "./types";

/** Only daily observations: absence of a captured cost never means a zero cost. */
export function summarizeStockHistory(
  input: AnalyticsInput,
  from: string,
  to: string,
  locationId?: string,
) {
  const gauges = (input.gauges ?? []).filter(
    (g) => (!locationId || g.locationId === locationId) && g.day <= to,
  );
  const latest = latestGauges(gauges, to);
  let value = { n: 0n, d: 1n },
    valuedItems = 0,
    unvaluedItems = 0;
  for (const stock of latest.filter((g) => g.metric === "stock_on_hand")) {
    const cost = latest.find(
      (g) =>
        g.metric === "stock_unit_cost" &&
        g.locationId === stock.locationId &&
        g.dimensionId === stock.dimensionId &&
        g.currencyCode === input.currencyCode &&
        g.minorUnit === input.minorUnit,
    );
    if (!cost) {
      unvaluedItems++;
      continue;
    }
    const q = decimal(stock.quantity),
      c = decimal(cost.amountMinor);
    const n = q.n * c.n,
      d = q.d * c.d;
    value = { n: value.n * d + n * value.d, d: value.d * d };
    valuedItems++;
  }
  const knownValueMinor = moneyRatio(value.n, value.d);
  const series = new Map<string, typeof gauges>();
  for (const g of gauges.filter(
    (g) =>
      g.metric === "stock_unit_cost" &&
      g.currencyCode === input.currencyCode &&
      g.minorUnit === input.minorUnit,
  )) {
    const key = `${g.locationId}:${g.dimensionId}`;
    series.set(key, [...(series.get(key) ?? []), g]);
  }
  const changes: number[] = [],
    intervals: number[] = [];
  let increaseDays = 0;
  for (const observations of series.values()) {
    observations.sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.observedAt.localeCompare(b.observedAt) ||
        a.eventId.localeCompare(b.eventId),
    );
    let previous: (typeof observations)[number] | undefined,
      factor = 1,
      firstRise: string | undefined,
      lastRise: string | undefined,
      rises = 0;
    for (const current of observations) {
      if (current.day >= from && previous) {
        const a = decimal(current.amountMinor),
          b = decimal(previous.amountMinor);
        if (b.n > 0n && a.n * b.d > b.n * a.d) {
          factor *= Number(a.n * b.d) / Number(a.d * b.n);
          firstRise ??= current.day;
          lastRise = current.day;
          rises++;
        }
      }
      previous = current;
    }
    // A series with no comparison is unknown, rather than a measured zero rise.
    if (observations.some((g, i) => i > 0 && g.day >= from))
      changes.push(factor - 1);
    increaseDays += rises;
    if (rises > 1 && firstRise && lastRise)
      intervals.push(daysBetween(firstRise, lastRise) / (rises - 1));
  }
  return {
    valueMinor: valuedItems > 0 && unvaluedItems === 0 ? knownValueMinor : null,
    knownValueMinor,
    valuedItems,
    unvaluedItems,
    averageIncrease: changes.length
      ? changes.reduce((n, v) => n + v, 0) / changes.length
      : null,
    increaseDays,
    averageDaysBetweenIncreases: intervals.length
      ? intervals.reduce((n, v) => n + v, 0) / intervals.length
      : null,
  };
}
