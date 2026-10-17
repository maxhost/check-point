import type { MetricTranslator } from "@mi-pasaporte/domain/analytics/metrics";
import type { ExpenseEvent } from "./events";
export const metricTranslators: readonly MetricTranslator[] = [
  "recorded",
  "updated",
  "deleted",
].map((mutation) => ({
  eventType: `expense.${mutation}`,
  translate(event) {
    const p = event.payload as ExpenseEvent;
    return {
      sourceKey: `expense:${p.expenseId}`,
      sourceRevision: p.revision,
      rows:
        mutation === "deleted"
          ? []
          : [
              {
                metric: p.isFixed
                  ? ("expense_fixed" as const)
                  : ("expense_variable" as const),
                locationId: p.locationId,
                day: p.paidOn,
                dimensionKind: "concept" as const,
                dimensionId: p.conceptId,
                dimensionLabel: p.conceptName,
                amountMinor: p.amountMinor,
                currencyCode: p.currencyCode,
                minorUnit: p.minorUnit,
              },
            ],
    };
  },
}));
