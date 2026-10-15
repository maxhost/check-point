import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, type DbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  profitabilityFixedCosts as costs,
  profitabilityFixedCostPeriods as periods,
  profitabilityFixedCostAllocations as allocations,
} from "@mi-pasaporte/db/schema";
import { lockStaffPerson } from "../../../server/staff-location-timeline";
import { ModuleError } from "../../errors";
import { parseAmount } from "../arithmetic";
import { equivalentPeriods, type Period } from "../intervals";

export type Reader = DbTransaction | ReturnType<typeof getDb>;
export type Cost = typeof costs.$inferSelect;
export const costNotFound = () =>
  new ModuleError(404, "cost_not_found", "Ese costo no existe.");

/** Before any child FK/local lock: serializes safely with location archive's business lock. */
export async function lockBusiness(tx: DbTransaction, businessId: string) {
  const [business] = await tx
    .select({ id: businesses.id, currencyCode: businesses.currencyCode })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .for("key share");
  if (!business) throw costNotFound();
  return business;
}

export async function lockPerson(
  tx: DbTransaction,
  businessId: string,
  personId: string,
) {
  try {
    return await lockStaffPerson(tx, businessId, personId);
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "person_not_found"
    )
      throw new ModuleError(
        404,
        "person_not_found",
        "Ese integrante no existe.",
      );
    throw error;
  }
}

export async function findCost(db: Reader, businessId: string, costId: string) {
  const [cost] = await db
    .select()
    .from(costs)
    .where(and(eq(costs.businessId, businessId), eq(costs.id, costId)));
  if (!cost) throw costNotFound();
  return cost;
}

export async function lockCost(
  tx: DbTransaction,
  businessId: string,
  costId: string,
) {
  // The first read identifies the person; the authoritative read follows its lock.
  const candidate = await findCost(tx, businessId, costId);
  if (candidate.personId) await lockPerson(tx, businessId, candidate.personId);
  const [cost] = await tx
    .select()
    .from(costs)
    .where(and(eq(costs.businessId, businessId), eq(costs.id, costId)))
    .for("update");
  if (!cost) throw costNotFound();
  return cost;
}

export async function loadPeriods(
  db: Reader,
  businessId: string,
  costId: string,
): Promise<Period[]> {
  const rows = await db
    .select({ period: periods, allocation: allocations })
    .from(periods)
    .leftJoin(
      allocations,
      and(
        eq(allocations.businessId, periods.businessId),
        eq(allocations.periodId, periods.id),
      ),
    )
    .where(and(eq(periods.businessId, businessId), eq(periods.costId, costId)))
    .orderBy(asc(periods.fromMonth), asc(allocations.locationId));
  const result = new Map<string, Period>();
  for (const row of rows) {
    if (!result.has(row.period.id))
      result.set(row.period.id, {
        ...row.period,
        distribution: row.period.distribution as Period["distribution"],
        allocations: [],
      });
    if (row.allocation)
      result.get(row.period.id)!.allocations.push({
        locationId: row.allocation.locationId,
        monthlyAmount: row.allocation.monthlyAmount,
      });
  }
  return [...result.values()];
}

export async function lockLocations(
  tx: DbTransaction,
  businessId: string,
  ids: string[],
  allowedArchived: ReadonlySet<string> = new Set(),
) {
  const sorted = [...new Set(ids)].sort();
  if (!sorted.length)
    throw new ModuleError(422, "location_required", "Elige un local.");
  const rows = await tx
    .select({ id: locations.id, status: locations.status })
    .from(locations)
    .where(
      and(eq(locations.businessId, businessId), inArray(locations.id, sorted)),
    )
    .orderBy(asc(locations.id))
    .for("share");
  if (rows.length !== sorted.length)
    throw new ModuleError(404, "location_not_found", "Ese local no existe.");
  if (
    rows.some((row) => row.status !== "active" && !allowedArchived.has(row.id))
  )
    throw new ModuleError(409, "location_archived", "El local está archivado.");
}

function validatePeriods(values: Period[]) {
  for (const [i, period] of values.entries()) {
    const total = parseAmount(period.monthlyTotal, period.minorUnit);
    const assigned = period.allocations.reduce(
      (sum, a) => sum + parseAmount(a.monthlyAmount, period.minorUnit),
      0n,
    );
    if (
      !period.allocations.length ||
      new Set(period.allocations.map((a) => a.locationId)).size !==
        period.allocations.length ||
      assigned !== total ||
      (period.untilMonth !== null && period.untilMonth <= period.fromMonth) ||
      (i > 0 &&
        (values[i - 1].untilMonth === null ||
          values[i - 1].untilMonth! > period.fromMonth))
    )
      throw new Error("Invalid fixed cost timeline");
  }
}

/** Updates only changed rows. Historical periods outside the edit keep identity and values. */
export async function savePeriods(
  tx: DbTransaction,
  businessId: string,
  costId: string,
  before: Period[],
  after: Period[],
) {
  validatePeriods(after);
  const keep = new Set(after.map((p) => p.id));
  const removed = before.filter((p) => !keep.has(p.id)).map((p) => p.id);
  if (removed.length) {
    await tx
      .delete(allocations)
      .where(
        and(
          eq(allocations.businessId, businessId),
          inArray(allocations.periodId, removed),
        ),
      );
    await tx
      .delete(periods)
      .where(
        and(
          eq(periods.businessId, businessId),
          eq(periods.costId, costId),
          inArray(periods.id, removed),
        ),
      );
  }
  for (const period of after) {
    const previous = before.find((p) => p.id === period.id);
    if (previous && equivalentPeriods([previous], [period])) continue;
    const { allocations: assigned, id, ...values } = period;
    if (previous) {
      await tx
        .delete(allocations)
        .where(
          and(
            eq(allocations.businessId, businessId),
            eq(allocations.periodId, id),
          ),
        );
      await tx
        .update(periods)
        .set({ ...values, updatedAt: new Date() })
        .where(
          and(
            eq(periods.businessId, businessId),
            eq(periods.costId, costId),
            eq(periods.id, id),
          ),
        );
    } else {
      await tx.insert(periods).values({ ...values, id, businessId, costId });
    }
    await tx
      .insert(allocations)
      .values(assigned.map((a) => ({ ...a, businessId, periodId: id })));
  }
}
