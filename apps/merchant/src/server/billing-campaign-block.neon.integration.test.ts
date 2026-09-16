import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingRequest,
  fakeStripe,
  livePlusState,
  readSubscriptionRow,
  type FakeStripe,
} from "./billing-integration-support";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";
import { seedCampaign } from "./marketing-integration-support";
import { getDb } from "./db";
import { campaigns } from "./schema";
import { eq } from "drizzle-orm";

let fake: FakeStripe = fakeStripe();

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

vi.mock("./auth-guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./auth-guards")>();
  const { authGuardsDouble } = await import("./billing-pages-support");
  return authGuardsDouble(actual);
});

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { getSession: async () => ({ user: { id: "usuario-de-prueba" } }) },
  }),
}));

vi.mock("./staff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./staff")>();
  const { staffDouble } = await import("./billing-pages-support");
  return staffDouble(actual);
});

import { routeOwner, useBusiness } from "./billing-pages-support";
import SubscriptionPage from "../app/backoffice/subscription/page";
import { POST as CANCEL } from "../app/api/billing/cancel/route";

/**
 * Spec 0065, fase D — EL BLOQUEO DURO POR CAMPAÑAS, DEL LADO DEL COMPORTAMIENTO.
 *
 * ARCHIVO NUEVO PORQUE ESTE ORACULO NO EXISTIA, y lo encontró la revisión independiente de
 * la fase D con dos mutaciones que quedaron VERDES: `activeCampaignCount` devolviendo
 * siempre 0 (53/53) y sacar `downgrade_blocked_campaigns` de `BLOCKS_WITH_ACTION` (21/21).
 * Lo que había pinneaba otra cosa — la matriz de 14580 puntos prueba la DECISIÓN pura, el
 * test del modal prueba que elige bien el destino DADO el `code`, y `billing-routes.test.ts`
 * **dobla `activeCampaignCount` a 0**, así que ni por la ruta se ejercía. Es la lección de
 * la tarea 38: extraer la decisión deja el CABLEADO sin oráculo.
 *
 * Las dos mitades que faltaban, y las dos con la campaña sembrada de verdad:
 *  1. la RUTA contesta 409 con el `code`, el conteo y el mensaje literal, y no toca nada;
 *  2. la PÁGINA cruza ese mismo `code` a la consola, que es lo que decide a dónde manda el
 *     modal.
 *
 * Va en su archivo y no en `billing.neon` / `billing-pages-props` porque los dos están a
 * menos de 40 líneas del límite de 300 (medido con el hook, no con `wc`).
 */

const post = (body: unknown = {}) => CANCEL(billingRequest(body));

/** Un `plus` vivo con N campañas `active` y una puerta usable. */
async function seedWithCampaigns(tag: string, count: number): Promise<Seed> {
  const seed = await seedBillingBusiness("plus", livePlusState(fake, tag));
  // La puerta es la que el seed ya trae: agregar una SEGUNDA haría que la guarda de
  // LOCALES —que va primero por diseño— se lleve el 409 y el caso mediría otra cosa.
  // Medido: con `seedExtraLocation` la ruta contesta `downgrade_blocked` / `archiveCount: 1`.
  const locationId = seed.locationId;
  for (let index = 0; index < count; index += 1) {
    await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [locationId],
      name: `Campaña ${index + 1}`,
      status: "active",
    });
  }
  return seed;
}

async function drop(seed: Seed): Promise<void> {
  await getDb()
    .delete(campaigns)
    .where(eq(campaigns.businessId, seed.business.id));
  await dropBusiness(seed.business.id);
}

describe.skipIf(!integrationEnabled)(
  "el bloqueo duro por campañas (spec 0065, fase D)",
  () => {
    beforeEach(() => {
      fake = fakeStripe();
      routeOwner.businessId = null;
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://checkpass.test");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("la RUTA contesta 409 `downgrade_blocked_campaigns`, no escribe nada y no llama a Stripe", async () => {
      const seed = await seedWithCampaigns("campblock", 2);
      routeOwner.businessId = seed.business.id;
      try {
        const response = await post();
        expect(response.status).toBe(409);
        // El mensaje va LITERAL: es el que el modal muestra, y sale de la misma llamada a
        // `decidePlanChange` que el 409.
        expect(await response.json()).toEqual({
          error:
            "Para volver a Free no puedes tener campañas activas; hoy tienes 2. Desactiva 2.",
          code: "downgrade_blocked_campaigns",
          deactivateCount: 2,
        });
        // Bloqueo duro EN EL SERVIDOR: la fila no se movió y Stripe no se enteró.
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.plan).toBe("plus");
        expect(row.pendingPlan).toBeNull();
        expect(fake.calls).toEqual([]);
      } finally {
        await drop(seed);
      }
    }, 60_000);

    it("y con las campañas desactivadas la baja PROCEDE: el bloqueo no es permanente", async () => {
      // El control del caso de arriba. Sin él, un `decidePlanChange` que bloqueara SIEMPRE
      // pasaría los dos.
      const seed = await seedWithCampaigns("campfree", 1);
      routeOwner.businessId = seed.business.id;
      try {
        await getDb()
          .update(campaigns)
          .set({ status: "paused", pauseReason: "owner" })
          .where(eq(campaigns.businessId, seed.business.id));
        const response = await post();
        expect(response.status).toBe(200);
        expect((await readSubscriptionRow(seed.business.id)).plan).toBe("free");
      } finally {
        await drop(seed);
      }
    }, 60_000);

    it("la PÁGINA cruza el `code` de campañas a la consola, no el genérico", async () => {
      const seed = await seedWithCampaigns("campprops", 3);
      useBusiness(seed);
      try {
        const element = (await SubscriptionPage({
          searchParams: Promise.resolve({}),
        })) as { props: Record<string, unknown> };
        expect(element.props.canCancel).toBe(false);
        expect(element.props.downgradeBlock).toEqual({
          code: "downgrade_blocked_campaigns",
          message:
            "Para volver a Free no puedes tener campañas activas; hoy tienes 3. Desactiva 3.",
        });
      } finally {
        await drop(seed);
      }
    }, 60_000);
  },
);
