import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
// Importing this module is what points `DATABASE_URL` at the isolated Neon branch.
import {
  integrationEnabled,
  seedBusiness,
  type Seed,
} from "./counter-integration-support";
import { getDb } from "./db";
import { locations, locationVerifications, subscriptions } from "./schema";

export { integrationEnabled };

/**
 * Shared world for the spec 0061 integration tests. Split out of the test files only to
 * keep each under the file-size budget (same role as `counter-integration-support.ts`).
 */

/**
 * A business with a subscription plan and its first location wired the way production
 * has it: ONE live verification row, and `active_verification_id` pointing at it.
 * `seedBusiness` alone leaves the location without provenance, which would make the
 * address-edit test start from a state that does not exist in prod.
 */
export async function seedLocationsBusiness(
  name: string,
  plan: "free" | "plus",
): Promise<Seed> {
  const seed = await seedBusiness({
    name,
    kind: "points",
    mode: "per_amount",
    grant: 10,
    blockAmount: "1.00",
  });
  await getDb()
    .insert(subscriptions)
    .values({ businessId: seed.business.id, plan, status: "active" });
  const verificationId = randomUUID();
  await getDb().insert(locationVerifications).values({
    id: verificationId,
    locationId: seed.locationId,
    source: "provider_verified",
    provider: "geoapify",
    providerPlaceId: "seed-place",
    normalizedAddress: "Calle 1",
    longitude: "0",
    latitude: "0",
    countryCode: "EC",
    providerSnapshot: {},
    attribution: "© OpenStreetMap contributors, © Geoapify",
  });
  await getDb()
    .update(locations)
    .set({ activeVerificationId: verificationId })
    .where(eq(locations.id, seed.locationId));
  return seed;
}

/** Inserts an extra ACTIVE location straight by SQL, bypassing the plan cap. Used to
 * reach a two-location world without depending on the code under test. */
export async function seedExtraLocation(
  businessId: string,
  name: string,
): Promise<string> {
  const [row] = await getDb()
    .insert(locations)
    .values({
      businessId,
      name,
      addressLabel: `${name} 1`,
      longitude: "1",
      latitude: "1",
      countryCode: "EC",
      status: "active",
      addressSnapshot: {},
    })
    .returning({ id: locations.id });
  return row.id;
}

/** The FULL location row, read by SQL. The API response is never the oracle (ADR 0054). */
export async function readLocationRow(locationId: string) {
  const [row] = await getDb()
    .select()
    .from(locations)
    .where(eq(locations.id, locationId));
  return row;
}

/** Every verification of a location, oldest first — including the superseded ones, which
 * is the whole point: provenance is never destroyed. */
export async function readVerifications(locationId: string) {
  return getDb()
    .select()
    .from(locationVerifications)
    .where(eq(locationVerifications.locationId, locationId))
    .orderBy(asc(locationVerifications.verifiedAt));
}

/** A Geoapify reverse-geocode result shaped like the real one, for `vi.mock`ing
 * `verifyLocation`. The provider call itself is NOT under test here. */
export const VERIFIED_ADDRESS = {
  source: "provider_verified" as const,
  provider: "geoapify" as const,
  providerPlaceId: "place-123",
  label: "Av. Amazonas 123, Quito",
  longitude: "-78.4877",
  latitude: "-0.1807",
  countryCode: "EC",
  snapshot: { formatted: "Av. Amazonas 123, Quito", place_id: "place-123" },
  attribution: "© OpenStreetMap contributors, © Geoapify",
};

/** The body the console sends when the owner PICKED a Geoapify suggestion. */
export const providerSelection = {
  label: VERIFIED_ADDRESS.label,
  provider: "geoapify",
  longitude: -78.4877,
  latitude: -0.1807,
  featureId: "place-123",
};
