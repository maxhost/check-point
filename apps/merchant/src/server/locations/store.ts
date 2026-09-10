import { and, asc, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "../db";
import { locations } from "../schema";
import { LocationError, toLocationDTO, type LocationDTO } from "./core";
import {
  activeLocationCount,
  dtoColumns,
  limitReached,
  lockBusiness,
  parseLocationId,
  planLocationLimit,
} from "./shared";

/** Every location of a business, active first (`'active' < 'archived'` by text
 * collation), oldest first inside each group. */
export async function listLocations(
  businessId: string,
): Promise<LocationDTO[]> {
  const rows = await getDb()
    .select(dtoColumns)
    .from(locations)
    .where(eq(locations.businessId, businessId))
    .orderBy(asc(locations.status), asc(locations.createdAt));
  return rows.map(toLocationDTO);
}

/**
 * Archives or reactivates a location, under the business lock.
 *  - archiving the LAST active location is rejected: a business with no active location
 *    cannot operate the counter nor attribute anything (ADR 0042);
 *  - reactivating consumes a slot, so it obeys the same plan cap as creating. Otherwise
 *    "archive → create → reactivate" would walk a `free` business to two active locations.
 */
export async function setLocationStatus(
  business: { id: string },
  rawLocationId: unknown,
  rawStatus: unknown,
): Promise<LocationDTO> {
  const locationId = parseLocationId(rawLocationId);
  if (rawStatus !== "active" && rawStatus !== "archived") {
    throw new LocationError(422, "invalid_input", "El estado no es válido.");
  }

  return withDbTransaction(async (tx) => {
    await lockBusiness(tx, business.id);
    const [target] = await tx
      .select(dtoColumns)
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.businessId, business.id),
        ),
      )
      .limit(1);
    if (!target) {
      throw new LocationError(404, "unknown_location", "Ese local no existe.");
    }
    if (target.status === rawStatus) return toLocationDTO(target);

    const active = await activeLocationCount(tx, business.id);
    if (rawStatus === "archived" && active <= 1) {
      throw new LocationError(
        409,
        "last_active_location",
        "No puedes archivar tu único local activo.",
      );
    }
    if (rawStatus === "active") {
      const limit = await planLocationLimit(tx, business.id);
      if (active >= limit) throw limitReached(limit);
    }

    const [row] = await tx
      .update(locations)
      .set({ status: rawStatus })
      .where(eq(locations.id, locationId))
      .returning(dtoColumns);
    return toLocationDTO(row);
  });
}
