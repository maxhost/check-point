import type { DbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  staffPersons,
  staffLocationPeriods,
  staffLocationAssignments,
} from "@mi-pasaporte/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { StaffError } from "./staff-error";

/** Avoid FK/location inversion against archive's business FOR UPDATE lock. */
export async function lockStaffBusiness(tx: DbTransaction, businessId: string) {
  const [business] = await tx
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .for("key share");
  if (!business) throw new Error("Staff business unavailable");
}

export async function lockStaffPerson(
  tx: DbTransaction,
  businessId: string,
  personId: string,
) {
  if (!isUuid(personId))
    throw new StaffError(404, "Esa persona no existe.", "person_not_found");
  await lockStaffBusiness(tx, businessId);
  const [person] = await tx
    .select()
    .from(staffPersons)
    .where(
      and(
        eq(staffPersons.businessId, businessId),
        eq(staffPersons.id, personId),
      ),
    )
    .for("update");
  if (!person)
    throw new StaffError(404, "Esa persona no existe.", "person_not_found");
  return person;
}

export type StaffLocationTimelinePeriod = {
  id: string;
  fromMonth: string;
  untilMonth: string | null;
  locationIds: string[];
};

/** All periods, including future frontiers; no locks/writes or implicit local assignment. */
export async function listStaffLocationTimeline(
  tx: DbTransaction,
  businessId: string,
  personId: string,
): Promise<StaffLocationTimelinePeriod[]> {
  const rows = await tx
    .select({
      id: staffLocationPeriods.id,
      fromMonth: staffLocationPeriods.fromMonth,
      untilMonth: staffLocationPeriods.untilMonth,
      locationId: staffLocationAssignments.locationId,
    })
    .from(staffLocationPeriods)
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
    .where(
      and(
        eq(staffLocationPeriods.businessId, businessId),
        eq(staffLocationPeriods.personId, personId),
      ),
    )
    .orderBy(
      asc(staffLocationPeriods.fromMonth),
      asc(staffLocationAssignments.locationId),
    );
  const periods = new Map<string, StaffLocationTimelinePeriod>();
  for (const row of rows) {
    const period = periods.get(row.id) ?? {
      id: row.id,
      fromMonth: row.fromMonth,
      untilMonth: row.untilMonth,
      locationIds: [],
    };
    if (row.locationId) period.locationIds.push(row.locationId);
    periods.set(row.id, period);
  }
  return [...periods.values()];
}
