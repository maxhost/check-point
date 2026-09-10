import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { getDb, type DbTransaction } from "../db";
import { businesses, locations, subscriptions } from "../schema";
import { parseUuid } from "../counter/core";
import {
  LocationError,
  locationLimitForPlan,
  type ResolvedAddress,
} from "./core";

/** Allow-list of the columns any location query may read. Never `select()` the whole
 * row: `address_snapshot` and the coordinates must not travel towards a response. */
export const dtoColumns = {
  id: locations.id,
  name: locations.name,
  addressLabel: locations.addressLabel,
  status: locations.status,
};

/** ONE uuid validator for the whole repo (`counter/core.ts`), re-labelled with this
 * domain's error. A second regex is how two places that decide the same thing diverge. */
export function parseLocationId(value: unknown): string {
  try {
    return parseUuid(value, "local");
  } catch {
    throw new LocationError(422, "invalid_input", "El local no es válido.");
  }
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LocationError(422, "invalid_input", "El cuerpo no es válido.");
  }
  return value as Record<string, unknown>;
}

/**
 * Takes the business row lock for the rest of the transaction. Every operation that
 * changes HOW MANY locations are active (create, archive, reactivate) goes through it, so
 * the plan cap and the "never archive the last active one" rule are decided while nobody
 * else can change the count.
 *
 * This is ADR 0054 §2 applied to a counting invariant: a `count(*) < limit` guard read
 * outside a lock is exactly the uncorrelated pre-check Postgres evaluates ONCE, before
 * anyone blocks — two concurrent creates would both see `0 < 1` and both insert. Executed
 * both ways in `locations-races.neon.integration.test.ts`.
 */
export async function lockBusiness(tx: DbTransaction, businessId: string) {
  const [row] = await tx
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .for("update")
    .limit(1);
  if (!row) {
    throw new LocationError(404, "unknown_business", "El negocio no existe.");
  }
  return row;
}

export async function activeLocationCount(
  tx: DbTransaction,
  businessId: string,
) {
  const [row] = await tx
    .select({ value: count() })
    .from(locations)
    .where(
      and(eq(locations.businessId, businessId), eq(locations.status, "active")),
    );
  return Number(row?.value ?? 0);
}

export async function planLocationLimit(tx: DbTransaction, businessId: string) {
  const [row] = await tx
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(eq(subscriptions.businessId, businessId))
    .limit(1);
  return locationLimitForPlan(row?.plan ?? null);
}

export function limitReached(limit: number): LocationError {
  return new LocationError(
    409,
    "location_limit",
    limit === 1
      ? "Tu plan permite 1 local activo. Mejora tu plan para abrir otro."
      : `Tu plan permite ${limit} locales activos.`,
  );
}

/** The business country, read BEFORE opening the transaction: resolving a Geoapify
 * selection is a network round-trip and must never happen while holding a row lock. */
export async function businessCountry(businessId: string): Promise<string> {
  const [row] = await getDb()
    .select({ countryCode: businesses.countryCode })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!row) {
    throw new LocationError(404, "unknown_business", "El negocio no existe.");
  }
  return row.countryCode;
}

export function verificationValues(
  locationId: string,
  address: ResolvedAddress,
) {
  return {
    id: randomUUID(),
    locationId,
    source: address.source,
    provider: address.provider,
    providerPlaceId: address.providerPlaceId,
    normalizedAddress: address.label,
    longitude: address.longitude,
    latitude: address.latitude,
    countryCode: address.countryCode,
    providerSnapshot: address.snapshot,
    attribution: address.attribution,
  };
}
