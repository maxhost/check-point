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
import { seedWelcomeCampaign } from "./marketing-welcome-support";
import { getDb } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";
import { and, eq, ne } from "drizzle-orm";

let fake: FakeStripe = fakeStripe();

vi.mock("./backoffice-membership", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./backoffice-membership")>();
  const { legacyMembershipFixtures } =
    await import("./backoffice-membership-fixture.test-support");
  return { ...actual, ...legacyMembershipFixtures() };
});

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      // Spec 0072: el doble declara `emailVerified` porque `requireApiOwner` corre el
      // gate de email en las 10 superficies del owner. Edicion del DOBLE.
      getSession: async () => ({
        user: { id: "usuario-de-prueba", emailVerified: true },
      }),
    },
  }),
}));

vi.mock("./staff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./staff")>();
  const { staffDouble } = await import("./billing-pages-support");
  return staffDouble(actual);
});

import { routeOwner } from "./billing-pages-support";
import { BASE_MONTHLY_PRICE } from "./billing-integration-support";
import { POST as PLAN } from "../app/api/billing/plan/route";

/**
 * Spec 0065 fase D + spec 0189 §D6 — EL BLOQUEO DURO POR CAMPAÑAS, DEL LADO DEL COMPORTAMIENTO:
 * bajar de plus a base (`POST /api/billing/plan {to: "base"}`) exige apagar antes las campañas
 * que el base no incluye (todas menos Bienvenida y Venta cruzada, ADR 0134 §4/§9). Con la
 * campaña sembrada de verdad: la ruta contesta 409 con el `code`, el conteo y el mensaje
 * literal, y no toca nada; con las campañas apagadas procede.
 *
 * La mitad de la PÁGINA (que cruzaba el `code` de campañas a la consola) se fue con la baja a
 * Free: la consola de hoy solo cancela, y cancelar ya no bloquea por campañas. La pantalla de
 * cambio de plan es de GPT (contrato §D10).
 */

const post = (body: unknown = { to: "base" }) => PLAN(billingRequest(body));

/** Un `plus` vivo (la prueba vencida) con N campañas propias `active` y una puerta usable. */
async function seedWithCampaigns(tag: string, count: number): Promise<Seed> {
  const seed = await seedBillingBusiness("plus", {
    ...livePlusState(fake, tag),
    trialEndsAt: new Date(Date.now() - 86_400_000),
  });
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
  "el bloqueo duro por campañas al bajar a base (spec 0189 §D6)",
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
            "El plan Base solo incluye Bienvenida y Venta cruzada; hoy tienes 2 campañas activas fuera de eso. Desactiva 2.",
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
        // El cambio se le pide a Stripe; el plan de la fila lo escribe el webhook.
        expect(fake.updateParams[0]?.items).toEqual([
          { id: "si_0", price: BASE_MONTHLY_PRICE },
        ]);
      } finally {
        await drop(seed);
      }
    }, 60_000);

    it("ADR 0134 §4: la Bienvenida NO cuenta (está en el base) — con ella y otra bloquea por 1, y sola no bloquea", async () => {
      const seed = await seedWithCampaigns("campwelcome", 1);
      routeOwner.businessId = seed.business.id;
      const welcome = { activatedAt: new Date("2026-09-01T12:00:00.000Z") };
      try {
        const welcomeId = await seedWelcomeCampaign(seed, welcome);
        const blocked = await post();
        expect(blocked.status).toBe(409);
        expect(await blocked.json()).toMatchObject({
          code: "downgrade_blocked_campaigns",
          deactivateCount: 1,
        });

        // Sólo queda la Bienvenida activa: el cambio procede y ella sigue activa.
        await getDb()
          .update(campaigns)
          .set({ status: "paused", pauseReason: "owner" })
          .where(
            and(
              eq(campaigns.businessId, seed.business.id),
              ne(campaigns.id, welcomeId),
            ),
          );
        const response = await post();
        expect(response.status).toBe(200);
        const [kept] = await getDb()
          .select({ status: campaigns.status })
          .from(campaigns)
          .where(eq(campaigns.id, welcomeId));
        expect(kept.status).toBe("active");
      } finally {
        await drop(seed);
      }
    }, 60_000);
  },
);
