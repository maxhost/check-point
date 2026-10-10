import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BASE_MONTHLY_PRICE,
  BASE_YEARLY_PRICE,
  MONTHLY_PRICE,
  YEARLY_PRICE,
  billingRequest,
  custId,
  readSubscriptionRow,
} from "./billing-integration-support";
import { fakeStripe, type FakeStripe } from "./billing-stripe-fake";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import {
  integrationEnabled,
  seedExtraLocation,
  type SeededSubscription,
} from "./locations-integration-support";

/**
 * Spec 0189 §Plan de pruebas, T10 — LAS RUTAS DE COBRO contra Postgres de verdad, con Stripe
 * DOBLADO. El oráculo de cada escritura es la FILA por SQL (ADR 0054), nunca la respuesta; y el
 * de lo que se le pidió a Stripe son los params y las claves del fake, nunca lo que devolvió.
 * Staff activo vs. desactivado vive en `billing-routes-auth…`; el bloqueo por campañas fuera del
 * base, en `billing-campaign-block…`.
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      getSession: async () => ({
        user: { id: "owner", emailVerified: true },
      }),
    },
  }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: async () =>
    world.businessId
      ? {
          id: world.businessId,
          slug: "int",
          currencyCode: "USD",
          status: "active",
          suspensionReason: null,
        }
      : null,
}));

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

import { POST as CHECKOUT } from "../app/api/billing/checkout/route";

type Handler = (request: NextRequest) => Promise<Response>;

const post = (handler: Handler, body: unknown = {}) =>
  handler(billingRequest(body));

const DAY = 86_400_000;

/** Siembra, corre el cuerpo con el owner resuelto a ese negocio, y limpia siempre. */
async function withSeed(
  plan: "trial" | "base" | "plus" | "none",
  state: SeededSubscription,
  body: (seed: Seed) => Promise<void>,
): Promise<void> {
  const seed = await seedBillingBusiness(plan, state);
  world.businessId = seed.business.id;
  try {
    await body(seed);
  } finally {
    await dropBusiness(seed.business.id);
  }
}

describe.skipIf(!integrationEnabled)(
  "api/billing — las rutas de cobro contra Neon (spec 0189, T10)",
  () => {
    beforeEach(() => {
      fake = fakeStripe();
      world.businessId = "";
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://checkpass.test");
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("`checkout` en prueba: precio del plan elegido, `trial_end` = fin de la prueba, clave por plan", async () => {
      // El fin de la prueba con segundos enteros: `trial_end` es unix SECONDS.
      const trialEndsAt = new Date(
        Math.floor((Date.now() + 30 * DAY) / 1000) * 1000,
      );
      await withSeed("trial", { trialEndsAt }, async (seed) => {
        fake.nextCustomerId = custId("checkout");
        const response = await post(CHECKOUT, {
          plan: "base",
          interval: "month",
        });
        expect(response.status).toBe(200);
        expect(fake.sessionParams[0]).toMatchObject({
          line_items: [{ price: BASE_MONTHLY_PRICE, quantity: 1 }],
          customer: custId("checkout"),
          client_reference_id: seed.business.id,
          metadata: {
            businessId: seed.business.id,
            plan: "base",
            interval: "month",
          },
          subscription_data: {
            metadata: {
              businessId: seed.business.id,
              plan: "base",
              interval: "month",
            },
            trial_end: trialEndsAt.getTime() / 1000,
          },
          success_url: "https://checkpass.test/backoffice?checkout=success",
        });
        expect(fake.sessionKeys).toEqual([
          `checkout:${seed.business.id}:base:month:${trialEndsAt.getTime() / 1000}`,
        ]);
        // El customer se PERSISTE (sin esto la reconciliación es un no-op, [R2-6]).
        expect(
          (await readSubscriptionRow(seed.business.id)).stripeCustomerId,
        ).toBe(custId("checkout"));

        // Otro plan e intervalo: otro precio y otra clave; UN solo customer (se reusa).
        await post(CHECKOUT, {
          plan: "plus",
          interval: "year",
          from: "subscription",
        });
        expect(fake.sessionParams[1]).toMatchObject({
          line_items: [{ price: YEARLY_PRICE, quantity: 1 }],
          success_url:
            "https://checkpass.test/backoffice/subscription?checkout=success",
        });
        expect(fake.sessionKeys[1]).toBe(
          `checkout:${seed.business.id}:plus:year:${trialEndsAt.getTime() / 1000}`,
        );
        expect(fake.customerKeys).toEqual([
          `billing:customer:${seed.business.id}`,
        ]);

        // Una sesión cacheada que ya no está abierta es un FALSO ÉXITO.
        fake.sessionStatus = "complete";
        const stale = await post(CHECKOUT, { plan: "base", interval: "month" });
        expect(stale.status).toBe(409);
        expect(await stale.json()).toMatchObject({
          code: "checkout_session_stale",
        });
      });
    }, 60_000);

    it("`checkout` con la prueba vencida (o a < 48 h) cobra en el acto: SIN `trial_end`", async () => {
      await withSeed(
        "none",
        { trialEndsAt: new Date(Date.now() - DAY) },
        async (seed) => {
          expect(
            (await post(CHECKOUT, { plan: "plus", interval: "month" })).status,
          ).toBe(200);
          // #6 de la revision: sin `trial_end`, la clave lo dice (`now`), asi no choca con la
          // de una sesion del mismo plan que SI lo llevaba.
          expect(fake.sessionKeys[0]).toBe(
            `checkout:${seed.business.id}:plus:month:now`,
          );
          expect(fake.sessionParams[0]?.line_items).toEqual([
            { price: MONTHLY_PRICE, quantity: 1 },
          ]);
          expect(fake.sessionParams[0]?.subscription_data).not.toHaveProperty(
            "trial_end",
          );
        },
      );
      const casi = new Date(Date.now() + 47 * 3_600_000);
      await withSeed("trial", { trialEndsAt: casi }, async () => {
        expect(
          (await post(CHECKOUT, { plan: "base", interval: "year" })).status,
        ).toBe(200);
        expect(fake.sessionParams.at(-1)?.line_items).toEqual([
          { price: BASE_YEARLY_PRICE, quantity: 1 },
        ]);
        expect(fake.sessionParams.at(-1)?.subscription_data).not.toHaveProperty(
          "trial_end",
        );
      });
    }, 60_000);

    it("`checkout` del base con 2 locales: 409 `downgrade_blocked` con su contador y CERO Stripe", async () => {
      await withSeed("trial", {}, async (seed) => {
        await seedExtraLocation(seed.business.id, "Sucursal 2");
        const response = await post(CHECKOUT, {
          plan: "base",
          interval: "month",
        });
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
          error: "El plan Base admite 1 local activo; hoy tienes 2. Archiva 1.",
          code: "downgrade_blocked",
          archiveCount: 1,
        });
        expect(fake.calls).toEqual([]);
        // Y el plus sí: 2 locales caben en 3.
        expect(
          (await post(CHECKOUT, { plan: "plus", interval: "month" })).status,
        ).toBe(200);
      });
    }, 60_000);
  },
);
