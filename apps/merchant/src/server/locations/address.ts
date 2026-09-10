import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { withDbTransaction, type DbTransaction } from "../db";
import { locations, locationVerifications } from "../schema";
import {
  LocationError,
  parseLocationName,
  resolveAddress,
  toLocationDTO,
  type LocationDTO,
  type ResolvedAddress,
} from "./core";
import {
  activeLocationCount,
  asObject,
  businessCountry,
  dtoColumns,
  limitReached,
  lockBusiness,
  parseLocationId,
  planLocationLimit,
  verificationValues,
} from "./shared";

/** Creates an ACTIVE location with its first verification row. The plan cap is enforced
 * here, under the business lock — hiding the button in the console is a courtesy, not
 * the rule. */
export async function createLocation(
  business: { id: string },
  value: unknown,
): Promise<LocationDTO> {
  const body = asObject(value);
  const name = parseLocationName(body.name);
  const address = await resolveAddress(
    body.address,
    await businessCountry(business.id),
  );

  return withDbTransaction(async (tx) => {
    await lockBusiness(tx, business.id);
    const limit = await planLocationLimit(tx, business.id);
    if ((await activeLocationCount(tx, business.id)) >= limit) {
      throw limitReached(limit);
    }
    const locationId = randomUUID();
    const verification = verificationValues(locationId, address);
    const [row] = await tx
      .insert(locations)
      .values({
        id: locationId,
        businessId: business.id,
        name,
        addressLabel: address.label,
        longitude: address.longitude,
        latitude: address.latitude,
        countryCode: address.countryCode,
        status: "active",
        activeVerificationId: verification.id,
        addressSnapshot: address.snapshot,
      })
      .returning(dtoColumns);
    await tx.insert(locationVerifications).values(verification);
    return toLocationDTO(row);
  });
}

/**
 * Supersedes the live verification of a location and installs a new one: the old row
 * KEEPS existing with `superseded_at` set (provenance is never destroyed, spec 0023) and
 * `active_verification_id` moves to the new row.
 */
async function moveAddress(
  tx: DbTransaction,
  locationId: string,
  address: ResolvedAddress,
) {
  await tx
    .update(locationVerifications)
    .set({ supersededAt: new Date() })
    .where(
      and(
        eq(locationVerifications.locationId, locationId),
        isNull(locationVerifications.supersededAt),
      ),
    );
  const verification = verificationValues(locationId, address);
  await tx.insert(locationVerifications).values(verification);
  return {
    addressLabel: address.label,
    longitude: address.longitude,
    latitude: address.latitude,
    countryCode: address.countryCode,
    activeVerificationId: verification.id,
    addressSnapshot: address.snapshot,
  };
}

/**
 * Edits a location: its `name`, its `address`, or both — in ONE transaction, so a request
 * that changes both never lands half applied.
 *
 * It holds `SELECT … FOR UPDATE` on the location row (ADR 0054 §2) instead of packing the
 * work into a single CTE statement. Deliberate, and the reason is measurable: inside one
 * statement every part shares the snapshot taken BEFORE the lock, so two concurrent
 * address edits each supersede only the verification they saw and BOTH insert a live one —
 * the invariant «exactly one row with `superseded_at IS NULL`» breaks. With the row lock
 * the second edit re-reads after the first commits. Both shapes were executed against Neon
 * in `locations-races.neon.integration.test.ts`; only this one holds.
 *
 * A name-only edit writes NO verification row and leaves `active_verification_id` alone.
 */
export async function updateLocation(
  business: { id: string },
  rawLocationId: unknown,
  value: unknown,
): Promise<LocationDTO> {
  const locationId = parseLocationId(rawLocationId);
  const body = asObject(value);
  const wantsName = body.name !== undefined;
  const wantsAddress = body.address !== undefined;
  if (!wantsName && !wantsAddress) {
    throw new LocationError(422, "invalid_input", "No hay nada que cambiar.");
  }
  const name = wantsName ? parseLocationName(body.name) : null;
  const address = wantsAddress
    ? await resolveAddress(body.address, await businessCountry(business.id))
    : null;

  return withDbTransaction(async (tx) => {
    const [target] = await tx
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(
          eq(locations.id, locationId),
          eq(locations.businessId, business.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!target) {
      throw new LocationError(404, "unknown_location", "Ese local no existe.");
    }
    const addressColumns = address
      ? await moveAddress(tx, locationId, address)
      : {};
    const [row] = await tx
      .update(locations)
      .set({ ...(name === null ? {} : { name }), ...addressColumns })
      .where(eq(locations.id, locationId))
      .returning(dtoColumns);
    return toLocationDTO(row);
  });
}
