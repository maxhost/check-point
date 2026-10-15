import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  profitabilityFixedCosts as costs,
  profitabilityFixedCostPeriods as periods,
  profitabilityFixedCostAllocations as allocations,
} from "@mi-pasaporte/db/schema";
import { displayAmount, minorUnitFor, month, parseAmount } from "../arithmetic";
import {
  activeCost,
  activePeriod,
  listLocations,
  readLocation,
} from "./queries";
import { costNotFound } from "./repository";

type Bucket = { currencyCode: string; minorUnit: number; cents: bigint };
function add(
  buckets: Map<string, Bucket>,
  currencyCode: string,
  minorUnit: number,
  amount: string,
) {
  const key = `${currencyCode}:${minorUnit}`;
  const bucket = buckets.get(key) ?? { currencyCode, minorUnit, cents: 0n };
  bucket.cents += parseAmount(amount, minorUnit);
  buckets.set(key, bucket);
}
const bucketDTO = (buckets: Map<string, Bucket>) =>
  [...buckets.values()]
    .sort(
      (a, b) =>
        a.currencyCode.localeCompare(b.currencyCode) ||
        a.minorUnit - b.minorUnit,
    )
    .map(({ currencyCode, minorUnit, cents }) => ({
      currencyCode,
      minorUnit,
      total: displayAmount(cents, minorUnit),
    }));

export async function totals(
  businessId: string,
  rawMonth: unknown,
  rawLocation?: unknown,
) {
  const at = month(rawMonth);
  const selected =
    rawLocation === null || rawLocation === undefined
      ? null
      : await readLocation(businessId, rawLocation);
  const [business] = await getDb()
    .select({ currencyCode: businesses.currencyCode })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) throw costNotFound();
  const locals = selected ? [selected] : await listLocations(businessId);
  const rows = await getDb()
    .select({
      locationId: locations.id,
      status: locations.status,
      currencyCode: periods.currencyCode,
      minorUnit: periods.minorUnit,
      monthlyAmount: allocations.monthlyAmount,
    })
    .from(costs)
    .innerJoin(
      periods,
      and(
        eq(periods.businessId, costs.businessId),
        eq(periods.costId, costs.id),
      ),
    )
    .innerJoin(
      allocations,
      and(
        eq(allocations.businessId, periods.businessId),
        eq(allocations.periodId, periods.id),
      ),
    )
    .innerJoin(
      locations,
      and(
        eq(locations.businessId, allocations.businessId),
        eq(locations.id, allocations.locationId),
      ),
    )
    .where(
      and(
        eq(costs.businessId, businessId),
        activeCost(at),
        activePeriod(at),
        selected ? eq(allocations.locationId, selected.id) : undefined,
      ),
    );
  const all = new Map<string, Bucket>();
  const byLocal = new Map(
    locals.map((l) => [
      l.id,
      { status: l.status, buckets: new Map<string, Bucket>() },
    ]),
  );
  for (const row of rows) {
    add(all, row.currencyCode, row.minorUnit, row.monthlyAmount);
    if (!byLocal.has(row.locationId))
      byLocal.set(row.locationId, { status: row.status, buckets: new Map() });
    add(
      byLocal.get(row.locationId)!.buckets,
      row.currencyCode,
      row.minorUnit,
      row.monthlyAmount,
    );
  }
  const zero = () => [
    {
      currencyCode: business.currencyCode,
      minorUnit: minorUnitFor(business.currencyCode),
      total: displayAmount(0n, minorUnitFor(business.currencyCode)),
    },
  ];
  const totalValues = all.size ? bucketDTO(all) : zero();
  if (selected)
    return {
      month: at.slice(0, 7),
      locationId: selected.id,
      totals: totalValues,
    };
  return {
    month: at.slice(0, 7),
    totals: totalValues,
    locations: [...byLocal.entries()].map(([locationId, local]) => ({
      locationId,
      status: local.status,
      totals: local.buckets.size ? bucketDTO(local.buckets) : zero(),
    })),
  };
}
