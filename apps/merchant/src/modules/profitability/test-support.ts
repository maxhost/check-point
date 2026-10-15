import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  staffPersons,
  staffLocationPeriods,
  staffLocationAssignments,
} from "@mi-pasaporte/db/schema";
import { lockStaffPerson } from "../../server/staff-location-timeline";
import type { ModuleWorld } from "../modules-integration-support";
import { SERVER_MODULES } from "../server-registry";

export async function secondLocation(world: ModuleWorld) {
  const [location] = await getDb()
    .insert(locations)
    .values({
      businessId: world.businessId,
      name: "Segundo",
      addressLabel: "Guayaquil",
      countryCode: "EC",
      addressSnapshot: {},
    })
    .returning();
  return location.id;
}

export async function person(world: ModuleWorld, ids = [world.locationId]) {
  const [person] = await getDb()
    .insert(staffPersons)
    .values({ businessId: world.businessId, name: "Personal sin acceso" })
    .returning();
  if (ids.length) {
    const [period] = await getDb()
      .insert(staffLocationPeriods)
      .values({
        businessId: world.businessId,
        personId: person.id,
        fromMonth: "2026-01-01",
      })
      .returning();
    await getDb()
      .insert(staffLocationAssignments)
      .values(
        ids.map((locationId) => ({
          businessId: world.businessId,
          periodId: period.id,
          locationId,
        })),
      );
  }
  return person.id;
}

/** Module delivery test: core's transaction contract, including maintenance while OFF. */
export async function changeLocations(
  world: ModuleWorld,
  personId: string,
  fromMonth: string,
  locationIds: string[],
  fail = false,
) {
  return withDbTransaction(async (tx) => {
    await lockStaffPerson(tx, world.businessId, personId);
    const [previous] = await tx
      .select()
      .from(staffLocationPeriods)
      .where(
        and(
          eq(staffLocationPeriods.businessId, world.businessId),
          eq(staffLocationPeriods.personId, personId),
          lte(staffLocationPeriods.fromMonth, fromMonth),
          or(
            isNull(staffLocationPeriods.untilMonth),
            gt(staffLocationPeriods.untilMonth, fromMonth),
          ),
        ),
      );
    await tx
      .update(staffLocationPeriods)
      .set({ untilMonth: fromMonth })
      .where(eq(staffLocationPeriods.id, previous.id));
    const [next] = await tx
      .insert(staffLocationPeriods)
      .values({
        businessId: world.businessId,
        personId,
        fromMonth,
        untilMonth: previous.untilMonth,
      })
      .returning();
    await tx.insert(staffLocationAssignments).values(
      locationIds.map((locationId) => ({
        businessId: world.businessId,
        periodId: next.id,
        locationId,
      })),
    );
    await SERVER_MODULES.profitability.staffLocationsChanged!(tx, {
      businessId: world.businessId,
      personId,
      fromMonth,
      untilMonth: null,
      locationIds,
    });
    if (fail) throw new Error("deliberate transaction failure");
  });
}
