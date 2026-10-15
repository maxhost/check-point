import { displayAmount, parseAmount } from "../arithmetic";
import type { Period } from "../intervals";
import type { Cost } from "./repository";

export function periodDTO(period: Period) {
  return {
    fromMonth: period.fromMonth.slice(0, 7),
    untilMonth: period.untilMonth?.slice(0, 7) ?? null,
    label: period.label,
    monthlyTotal: displayAmount(
      parseAmount(period.monthlyTotal, period.minorUnit),
      period.minorUnit,
    ),
    currencyCode: period.currencyCode,
    minorUnit: period.minorUnit,
    distribution: period.distribution,
    allocations: period.allocations.map((a) => ({
      locationId: a.locationId,
      monthlyAmount: displayAmount(
        parseAmount(a.monthlyAmount, period.minorUnit),
        period.minorUnit,
      ),
    })),
  };
}

export function costDTO(cost: Cost, periods: Period[]) {
  return {
    id: cost.id,
    kind: cost.kind,
    personId: cost.personId,
    endMonth: cost.endMonth?.slice(0, 7) ?? null,
    revision: cost.revision,
    periods: periods.map(periodDTO),
  };
}
