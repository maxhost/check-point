import { add, type Rational } from "../financial/rational";
import { decimal } from "./money";
import type { AnalyticsMetric } from "./types";

/** Invalid quantities remain unknown, never zero. Mass has no Number fallback. */
export function exactQuantity(row: AnalyticsMetric): Rational | null {
  const mass =
    row.metric === "mass_sold_g" || row.metric === "mass_with_cost_g";
  if (row.quantityExact === undefined) {
    return !mass && Number.isSafeInteger(row.quantity) && row.quantity >= 0
      ? { n: BigInt(row.quantity), d: 1n }
      : null;
  }
  if (
    typeof row.quantityExact !== "string" ||
    !/^\d+(?:\.\d+)?$/.test(row.quantityExact)
  )
    return null;
  const value = decimal(row.quantityExact);
  return !mass && value.n % value.d !== 0n ? null : value;
}

export function sumQuantity(
  rows: readonly AnalyticsMetric[],
  metric: string,
): Rational | null {
  let total: Rational = { n: 0n, d: 1n };
  for (const row of rows) {
    if (row.metric !== metric) continue;
    const value = exactQuantity(row);
    if (value === null) return null;
    total = add(total, value);
  }
  return total;
}

export const sameQuantity = (a: Rational | null, b: Rational | null) =>
  a !== null && b !== null && a.n * b.d === b.n * a.d;
