import { randomUUID } from "node:crypto";
import { and, asc, count, eq, isNull } from "drizzle-orm";
// Importing this module is what points `DATABASE_URL` at the isolated Neon branch.
import {
  integrationEnabled,
  seedBusiness,
  type Seed,
} from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  locations,
  locationVerifications,
  subscriptions,
} from "@mi-pasaporte/db/schema";

import {
  CUENCA_PLACE,
  testSelectionToken,
} from "./places/selection-test-support";

export { integrationEnabled, CUENCA_PLACE };

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
  /** Spec 0189: la fecha de fin de la prueba. Ausente = la del alta (`seedBusiness`, +90 d). */
  trialEndsAt?: Date | null;
};

export async function seedLocationsBusiness(
  name: string,
  plan: "trial" | "base" | "plus" | "none",
  /**
   * Spec 0063 [R2-I7]: EL SEED ACEPTA EL ESTADO COMPLETO DE LA SUSCRIPCIÓN, no sólo el plan,
   * para sembrar los estados que el test tiene que cubrir sin construirlos con el código bajo
   * prueba. Spec 0189: `seedBusiness` ya deja la fila de prueba del alta; esto la REESCRIBE con
   * el plan y el estado pedidos (default de prod: `status='active'`, la prueba del alta).
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
    .update(subscriptions)
    .set({ plan, status: "active", ...subscription })
    .where(eq(subscriptions.businessId, seed.business.id));
  const verificationId = randomUUID();
  await getDb().insert(locationVerifications).values({
    id: verificationId,
    locationId: seed.locationId,
    source: "provider_verified",
    provider: "google",
    providerPlaceId: "seed-place",
    normalizedAddress: "Calle 1",
    longitude: "0",
    latitude: "0",
    countryCode: "EC",
    providerSnapshot: {},
    attribution: null,
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

/**
 * Spec 0155 — the body the console sends when the owner PICKED a Google place: the `label`
 * it shows plus the signed `selectionToken` of `POST /api/places/details`. The token is a
 * real one (`signSelection`), so `resolveAddress` runs unmocked; the `label` is a decoy the
 * server must ignore in favour of the token's.
 */
export function providerSelection(
  overrides: Partial<typeof CUENCA_PLACE> = {},
) {
  return {
    label: "lo que muestra el navegador",
    selectionToken: testSelectionToken(overrides),
  };
}

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
