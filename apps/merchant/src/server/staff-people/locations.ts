import type { DbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  staffLocationPeriods,
  staffLocationAssignments,
} from "@mi-pasaporte/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { listStaffLocationTimeline } from "../staff-location-timeline";
import { StaffError } from "../staff-error";
import { touchStaffPerson } from "./identity";

/** Caller already holds business KEY SHARE and person UPDATE, before any local/cost locks. */
export async function assignStaffLocations(
  tx: DbTransaction,
  businessId: string,
  personId: string,
  fromMonth: string,
  locationIds: string[],
) {
  const timeline = await listStaffLocationTimeline(tx, businessId, personId);
  const current = timeline.find(
    (p) =>
      p.fromMonth <= fromMonth && (!p.untilMonth || fromMonth < p.untilMonth),
  );
  if (current && current.locationIds.join("/") === locationIds.join("/"))
    return false;
  const selected = await tx
    .select({ id: locations.id, status: locations.status })
    .from(locations)
    .where(
      and(
        eq(locations.businessId, businessId),
        inArray(locations.id, locationIds),
      ),
    )
    .orderBy(locations.id)
    .for("update");
  if (selected.length !== locationIds.length)
    throw new StaffError(404, "Ese local no existe.", "location_not_found");
  if (
    selected.some(
      (location) =>
        location.status !== "active" &&
        !current?.locationIds.includes(location.id),
    )
  )
    throw new StaffError(
      409,
      "El local está archivado. Elige un local activo.",
      "location_archived",
    );
  const untilMonth =
    current?.untilMonth ??
    timeline.find((p) => p.fromMonth > fromMonth)?.fromMonth ??
    null;
  let periodId: string;
  if (current?.fromMonth === fromMonth) {
    periodId = current.id;
    await tx
      .delete(staffLocationAssignments)
      .where(
        and(
          eq(staffLocationAssignments.businessId, businessId),
          eq(staffLocationAssignments.periodId, periodId),
        ),
      );
  } else {
    if (current)
      await tx
        .update(staffLocationPeriods)
        .set({ untilMonth: fromMonth })
        .where(
          and(
            eq(staffLocationPeriods.businessId, businessId),
            eq(staffLocationPeriods.id, current.id),
          ),
        );
    const [period] = await tx
      .insert(staffLocationPeriods)
      .values({ businessId, personId, fromMonth, untilMonth })
      .returning({ id: staffLocationPeriods.id });
    periodId = period.id;
  }
  await tx
    .insert(staffLocationAssignments)
    .values(
      locationIds.map((locationId) => ({ businessId, periodId, locationId })),
    );
  await touchStaffPerson(tx, businessId, personId);
  return true;
}
