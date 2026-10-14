import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, type DbTransaction } from "@mi-pasaporte/db";
import { locations, stockItemLocations } from "@mi-pasaporte/db/schema";
import { isUuid } from "@mi-pasaporte/domain/server/counter/core";
import { ModuleError } from "../errors";
export async function listLocations(businessId: string) {
  const rows = await getDb()
    .select({
      id: locations.id,
      name: locations.name,
      status: locations.status,
    })
    .from(locations)
    .where(eq(locations.businessId, businessId))
    .orderBy(asc(locations.createdAt), asc(locations.id));
  return {
    locations: rows,
    defaultLocationId: rows.find((l) => l.status === "active")?.id ?? null,
  };
}
export async function resolveLocation(
  businessId: string,
  rawLocationId?: unknown,
  options: { purchase?: boolean } = {},
) {
  const available = await listLocations(businessId);
  let location;
  if (
    rawLocationId === undefined ||
    rawLocationId === null ||
    rawLocationId === ""
  ) {
    const active = available.locations.filter((l) => l.status === "active");
    if (active.length !== 1)
      throw new ModuleError(422, "location_required", "Elige un local.");
    location = active[0];
  } else {
    location = isUuid(rawLocationId)
      ? available.locations.find((l) => l.id === rawLocationId)
      : undefined;
    if (!location)
      throw new ModuleError(404, "location_not_found", "Ese local no existe.");
  }
  if (options.purchase && location.status !== "active")
    throw new ModuleError(
      409,
      "location_archived",
      "El local está archivado. Elige un local activo para registrar compras.",
    );
  return location;
}
export async function lockItemLocation(
  tx: DbTransaction,
  businessId: string,
  itemId: string,
  locationId: string,
) {
  await tx
    .insert(stockItemLocations)
    .values({ businessId, itemId, locationId })
    .onConflictDoNothing();
  const [pair] = await tx
    .select()
    .from(stockItemLocations)
    .where(
      and(
        eq(stockItemLocations.businessId, businessId),
        eq(stockItemLocations.itemId, itemId),
        eq(stockItemLocations.locationId, locationId),
      ),
    )
    .for("update");
  return pair;
}

/** Caller has already acquired ingredient KEY SHARE locks in the same sorted order. */
export async function lockItemLocations(
  tx: DbTransaction,
  businessId: string,
  itemIds: readonly string[],
  locationId: string,
) {
  const ids = [...new Set(itemIds)].sort();
  if (!ids.length) return;
  await tx
    .insert(stockItemLocations)
    .values(ids.map((itemId) => ({ businessId, itemId, locationId })))
    .onConflictDoNothing();
  await tx
    .select({ itemId: stockItemLocations.itemId })
    .from(stockItemLocations)
    .where(
      and(
        eq(stockItemLocations.businessId, businessId),
        eq(stockItemLocations.locationId, locationId),
        inArray(stockItemLocations.itemId, ids),
      ),
    )
    .orderBy(asc(stockItemLocations.itemId))
    .for("update");
}
