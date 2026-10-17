import { daysBetween, median } from "./date";
import { moneyRatio, sumIntegers } from "./money";
import type { AnalyticsInput, AnalyticsMetric } from "./types";

/** Habit uses unique local days; operations and money remain complete. */
export function customerCohorts(input: AnalyticsInput, rows = input.metrics) {
  const visits = rows.filter(
    (r) =>
      r.metric === "visits" &&
      r.dimensionId &&
      r.count > 0 &&
      r.day <= input.today,
  );
  return [...new Set(visits.map((r) => r.dimensionId!))].map((key) => {
    const records = visits
      .filter((r) => r.dimensionId === key)
      .sort((a, b) => a.day.localeCompare(b.day));
    // Merge currencies/duplicate observations for intervals, never discard counts.
    const days = new Map<string, number>();
    for (const r of records)
      days.set(r.day, sumIntegers([days.get(r.day) ?? 0, r.count]));
    const intervals: number[] = [];
    let previous: string | null = null;
    for (const day of days.keys()) {
      if (previous) intervals.push(daysBetween(previous, day));
      previous = day;
    }
    const known = records.filter(
      (r) =>
        r.currencyCode === input.currencyCode &&
        r.minorUnit === input.minorUnit,
    );
    const knownVisits = sumIntegers(known.map((r) => r.quantity));
    const allAmountsKnown = knownVisits === sumIntegers([...days.values()]);
    const spent = sumIntegers(known.map((r) => r.amountMinor));
    return {
      id: records[0]!.dimensionId!,
      visits: sumIntegers([...days.values()]),
      visitDays: days.size,
      lastDay: previous!,
      medianDays: median(intervals),
      knownVisits,
      spentMinor: spent,
      averageSpendMinor: allAmountsKnown
        ? moneyRatio(BigInt(spent), BigInt(days.size))
        : null,
      allAmountsKnown,
    };
  });
}
export function summarizeCustomerPromoHistory(
  input: AnalyticsInput,
  from: string,
  to: string,
  locationId?: string,
) {
  const rows = input.metrics.filter(
    (r) =>
      r.day >= from &&
      r.day <= to &&
      (!locationId || r.locationId === locationId),
  );
  const visits = rows.filter((r) => r.metric === "visits" && r.count > 0);
  const sum = (r: readonly AnalyticsMetric[], metric: string) =>
    sumIntegers(
      r
        .filter(
          (v) =>
            v.metric === metric &&
            v.currencyCode === input.currencyCode &&
            v.minorUnit === input.minorUnit,
        )
        .map((v) => v.amountMinor),
    );
  return {
    customers: {
      count: new Set(visits.map((r) => r.dimensionId)).size,
      visits: sumIntegers(visits.map((r) => r.count)),
      returning: new Set(
        visits
          .filter((r) =>
            input.metrics.some(
              (p) =>
                p.metric === "visits" &&
                p.dimensionId === r.dimensionId &&
                p.count > 0 &&
                p.day < from &&
                (!locationId || p.locationId === locationId),
            ),
          )
          .map((r) => r.dimensionId),
      ).size,
    },
    promos: [
      ...new Set(
        rows
          .filter((r) => r.metric.startsWith("promo_"))
          .map((r) => r.dimensionId),
      ),
    ].map((id) => {
      const campaign = rows.filter((r) => r.dimensionId === id);
      return {
        id,
        label:
          input.labels.find((l) => l.kind === "campaign" && l.id === id)
            ?.label ?? "Campaña",
        discountMinor: sum(campaign, "promo_discount"),
        salesMinor: sum(campaign, "promo_sales"),
        costMinor: campaign.some((r) => r.metric === "promo_cost")
          ? sum(campaign, "promo_cost")
          : null,
      };
    }),
  };
}
