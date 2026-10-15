import { randomUUID } from "node:crypto";
import { equalAllocations, parseAmount } from "./arithmetic";
import { ModuleError } from "../errors";

export type Allocation = { locationId: string; monthlyAmount: string };
export type Period = {
  id: string;
  fromMonth: string;
  untilMonth: string | null;
  label: string;
  monthlyTotal: string;
  currencyCode: string;
  minorUnit: number;
  distribution: "single" | "equal" | "manual";
  staffLocationPeriodId: string | null;
  allocations: Allocation[];
};
export type Timeline = {
  id: string;
  fromMonth: string;
  untilMonth: string | null;
  locationIds: string[];
}[];

export const containsMonth = (
  period: Pick<Period, "fromMonth" | "untilMonth">,
  at: string,
) =>
  period.fromMonth <= at &&
  (period.untilMonth === null || at < period.untilMonth);

const earlierEnd = (a: string | null, b: string | null) =>
  a === null ? b : b === null ? a : a < b ? a : b;

export function overlaps(
  a: Pick<Period, "fromMonth" | "untilMonth">,
  b: Pick<Period, "fromMonth" | "untilMonth">,
) {
  return (
    (a.untilMonth === null || b.fromMonth < a.untilMonth) &&
    (b.untilMonth === null || a.fromMonth < b.untilMonth)
  );
}

/** Replace exactly the requested interval; copies retain every exterior value. */
export function replaceInterval(
  previous: Period[],
  replacement: Period,
): Period[] {
  const result: Period[] = [];
  for (const period of previous) {
    if (!overlaps(period, replacement)) {
      result.push(period);
      continue;
    }
    if (period.fromMonth < replacement.fromMonth)
      result.push({ ...period, untilMonth: replacement.fromMonth });
    if (
      replacement.untilMonth !== null &&
      (period.untilMonth === null || period.untilMonth > replacement.untilMonth)
    )
      result.push({
        ...period,
        id: randomUUID(),
        fromMonth: replacement.untilMonth,
      });
  }
  result.push(replacement);
  return result.sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
}

/** Split each salary total at core boundaries, never flattening a future raise. */
export function salaryPeriods(periods: Period[], timeline: Timeline): Period[] {
  return periods.flatMap((period) => {
    const result: Period[] = [];
    let cursor: string | null = period.fromMonth;
    for (const assignment of timeline) {
      if (!overlaps(period, assignment)) continue;
      const fromMonth =
        period.fromMonth > assignment.fromMonth
          ? period.fromMonth
          : assignment.fromMonth;
      if (cursor !== fromMonth || !assignment.locationIds.length)
        throw new ModuleError(
          422,
          "staff_locations_required",
          "Asigna locales durante toda la vigencia del sueldo.",
        );
      const untilMonth = earlierEnd(period.untilMonth, assignment.untilMonth);
      result.push({
        ...period,
        id: result.length === 0 ? period.id : randomUUID(),
        fromMonth,
        untilMonth,
        distribution: "equal",
        staffLocationPeriodId: assignment.id,
        allocations: equalAllocations(
          parseAmount(period.monthlyTotal, period.minorUnit),
          period.minorUnit,
          assignment.locationIds,
        ),
      });
      cursor = untilMonth;
      if (cursor === null || cursor === period.untilMonth) break;
    }
    if (cursor !== period.untilMonth || !result.length)
      throw new ModuleError(
        422,
        "staff_locations_required",
        "Asigna locales durante toda la vigencia del sueldo.",
      );
    return result;
  });
}

export function equivalentPeriods(a: Period[], b: Period[]) {
  const values = (periods: Period[]) =>
    periods.map((period) => ({
      ...period,
      id: undefined,
      allocations: [...period.allocations].sort((x, y) =>
        x.locationId.localeCompare(y.locationId),
      ),
    }));
  return JSON.stringify(values(a)) === JSON.stringify(values(b));
}
