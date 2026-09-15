import { randomUUID } from "node:crypto";
import { and, asc, count, eq, isNull } from "drizzle-orm";
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
export type SeededSubscription = {
  status?: string;
  interval?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  pendingPlan?: string | null;
  pendingPlanAt?: Date | null;
  downgradeRequestedAt?: Date | null;
  lastEventAt?: Date | null;
};

export async function seedLocationsBusiness(
  name: string,
  plan: "free" | "plus" | "none",
  /**
   * Spec 0063 [R2-I7]: EL SEED ACEPTA EL ESTADO COMPLETO DE LA SUSCRIPCIÓN, no sólo el plan.
   * Sin esto no se pueden sembrar los estados que la spec tiene que cubrir —A1 (`plus` SIN
   * `stripe_subscription_id`, `interval` NULL), una baja ya programada
   * (`pending_plan='free'` + `downgrade_requested_at`), un `last_event_at` anterior— y el
   * test tendría que construirlos con el código bajo prueba, que es el pre-chequeo
   * circular. `plan` queda como 2.º posicional para no tocar a los llamadores de la spec
   * 0061; todo lo demás entra por acá y el default es el de prod (`status='active'`, el
   * resto NULL).
   */
  subscription: SeededSubscription = {},
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
    .values({
      businessId: seed.business.id,
      plan,
      status: "active",
      ...subscription,
    });
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

/**
 * Spec 0064, fase B — LOS DOS CONTADORES de `locations-races.neon.integration.test.ts`,
 * mudados acá por tamaño (ese archivo estaba en 302/300 al hook).
 *
 * Leen el estado FINAL por SQL, que es lo que convierte una carrera en una aserción (ADR 0054
 * §4): `CLAUDE.md` prohíbe afirmar «atómico/idempotente» desde una lectura del código. Son
 * lecturas puras y sin `vi.mock` —que es POR ARCHIVO y no se puede compartir—, así que este
 * módulo es su lugar natural.
 */
export async function activeLocationCountSql(businessId: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(locations)
    .where(
      and(eq(locations.businessId, businessId), eq(locations.status, "active")),
    );
  return Number(row.value);
}

export async function liveVerificationCountSql(locationId: string) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(locationVerifications)
    .where(
      and(
        eq(locationVerifications.locationId, locationId),
        isNull(locationVerifications.supersededAt),
      ),
    );
  return Number(row.value);
}
