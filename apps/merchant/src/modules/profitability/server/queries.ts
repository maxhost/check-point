import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  locations,
  memberships,
  staffPersons,
  staffLocationPeriods,
  staffLocationAssignments,
  profitabilityFixedCosts as costs,
  profitabilityFixedCostPeriods as periods,
  profitabilityFixedCostAllocations as allocations,
} from "@mi-pasaporte/db/schema";
import { displayAmount, identifier, month, parseAmount } from "../arithmetic";
import { costDTO } from "./dto";
import { containsMonth, type Period } from "../intervals";
import { costNotFound, type Cost } from "./repository";
import { ModuleError } from "../../errors";

export const activePeriod = (at: string) =>
  and(
    lte(periods.fromMonth, at),
    or(isNull(periods.untilMonth), gt(periods.untilMonth, at)),
  );
export const activeCost = (at: string) =>
  or(isNull(costs.endMonth), gt(costs.endMonth, at));

export async function listLocations(businessId: string) {
  return getDb()
    .select({
      id: locations.id,
      name: locations.name,
      status: locations.status,
    })
    .from(locations)
    .where(eq(locations.businessId, businessId))
    .orderBy(asc(locations.createdAt), asc(locations.id));
}

export async function readLocation(businessId: string, raw: unknown) {
  if (raw === null || raw === undefined || raw === "")
    throw new ModuleError(422, "location_required", "Elige un local.");
  const id = identifier(raw, "location");
  const [location] = await getDb()
    .select({
      id: locations.id,
      name: locations.name,
      status: locations.status,
    })
    .from(locations)
    .where(and(eq(locations.businessId, businessId), eq(locations.id, id)));
  if (!location)
    throw new ModuleError(404, "location_not_found", "Ese local no existe.");
  return location;
}

export async function listPeople(businessId: string, rawMonth: unknown) {
  const at = month(rawMonth);
  const rows = await getDb()
    .select({
      id: staffPersons.id,
      name: staffPersons.name,
      userId: staffPersons.membershipUserId,
      status: memberships.status,
      periodId: staffLocationPeriods.id,
      locationId: staffLocationAssignments.locationId,
    })
    .from(staffPersons)
    .leftJoin(
      memberships,
      and(
        eq(memberships.businessId, staffPersons.businessId),
        eq(memberships.userId, staffPersons.membershipUserId),
      ),
    )
    .leftJoin(
      staffLocationPeriods,
      and(
        eq(staffLocationPeriods.businessId, staffPersons.businessId),
        eq(staffLocationPeriods.personId, staffPersons.id),
        lte(staffLocationPeriods.fromMonth, at),
        or(
          isNull(staffLocationPeriods.untilMonth),
          gt(staffLocationPeriods.untilMonth, at),
        ),
      ),
    )
    .leftJoin(
      staffLocationAssignments,
      and(
        eq(
          staffLocationAssignments.businessId,
          staffLocationPeriods.businessId,
        ),
        eq(staffLocationAssignments.periodId, staffLocationPeriods.id),
      ),
    )
    .where(eq(staffPersons.businessId, businessId))
    .orderBy(
      asc(staffPersons.createdAt),
      asc(staffPersons.id),
      asc(staffLocationAssignments.locationId),
    );
  const people = new Map<
    string,
    {
      id: string;
      name: string;
      accessState: string;
      locationsConfigured: boolean;
      locationIds: string[];
    }
  >();
  for (const row of rows) {
    if (!people.has(row.id))
      people.set(row.id, {
        id: row.id,
        name: row.name,
        accessState:
          row.userId === null
            ? "none"
            : row.status === "active"
              ? "active"
              : "disabled",
        locationsConfigured: row.periodId !== null,
        locationIds: [],
      });
    if (row.locationId) people.get(row.id)!.locationIds.push(row.locationId);
  }
  return [...people.values()];
}

export async function getCost(
  businessId: string,
  rawId: unknown,
  rawMonth: unknown,
) {
  const id = identifier(rawId, "cost");
  const at = month(rawMonth);
  // One statement supplies metadata/revision/periods/allocations at a single snapshot.
  const rows = await getDb()
    .select({ cost: costs, period: periods, allocation: allocations })
    .from(costs)
    .leftJoin(
      periods,
      and(
        eq(periods.businessId, costs.businessId),
        eq(periods.costId, costs.id),
      ),
    )
    .leftJoin(
      allocations,
      and(
        eq(allocations.businessId, periods.businessId),
        eq(allocations.periodId, periods.id),
      ),
    )
    .where(and(eq(costs.businessId, businessId), eq(costs.id, id)))
    .orderBy(asc(periods.fromMonth), asc(allocations.locationId));
  if (!rows.length) throw costNotFound();
  const cost: Cost = rows[0].cost;
  const values = new Map<string, Period>();
  if (cost.endMonth === null || at < cost.endMonth)
    for (const row of rows) {
      if (!row.period || !containsMonth(row.period, at)) continue;
      if (!values.has(row.period.id))
        values.set(row.period.id, {
          ...row.period,
          distribution: row.period.distribution as Period["distribution"],
          allocations: [],
        });
      if (row.allocation)
        values.get(row.period.id)!.allocations.push({
          locationId: row.allocation.locationId,
          monthlyAmount: row.allocation.monthlyAmount,
        });
    }
  return costDTO(cost, [...values.values()]);
}

export async function listCosts(
  businessId: string,
  rawLocation: unknown,
  rawMonth: unknown,
) {
  const at = month(rawMonth);
  const location = await readLocation(businessId, rawLocation);
  const rows = await getDb()
    .select({
      id: costs.id,
      kind: costs.kind,
      personId: costs.personId,
      endMonth: costs.endMonth,
      revision: costs.revision,
      label: periods.label,
      fromMonth: periods.fromMonth,
      untilMonth: periods.untilMonth,
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
    .where(
      and(
        eq(costs.businessId, businessId),
        eq(allocations.locationId, location.id),
        activeCost(at),
        activePeriod(at),
      ),
    )
    .orderBy(asc(costs.createdAt), asc(costs.id));
  return {
    location,
    month: at.slice(0, 7),
    costs: rows.map((row) => ({
      ...row,
      locationId: location.id,
      endMonth: row.endMonth?.slice(0, 7) ?? null,
      fromMonth: row.fromMonth.slice(0, 7),
      untilMonth: row.untilMonth?.slice(0, 7) ?? null,
      monthlyAmount: displayAmount(
        parseAmount(row.monthlyAmount, row.minorUnit),
        row.minorUnit,
      ),
    })),
  };
}
