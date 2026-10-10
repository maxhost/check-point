import Stripe from "stripe";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BASE_MONTHLY_PRICE,
  BASE_YEARLY_PRICE,
  MONTHLY_PRICE,
  YEARLY_PRICE,
  billingRequest,
  livePlusState,
  readSubscriptionRow,
  subId,
} from "./billing-integration-support";
import { PERIOD_END_SECONDS } from "./billing-derive-support";
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
 * Spec 0189 §Plan de pruebas, T10 (segunda mitad: `plan`, `cancel` y `resume`; `checkout` vive en
 * `billing.neon.integration.test.ts`, partido por el límite de 300 líneas) — LAS RUTAS DE COBRO
 * contra Postgres de verdad, con Stripe DOBLADO. El oráculo de cada escritura es la FILA por SQL (ADR 0054), nunca la respuesta; y el
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

import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as PLAN } from "../app/api/billing/plan/route";
import { POST as RESUME } from "../app/api/billing/resume/route";

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

/** Una suscripción VIVA en el doble, con la prueba ya vencida: el plan pago decide. */
const live = (tag: string, priceId: string): SeededSubscription => ({
  ...livePlusState(fake, tag, [{ priceId }]),
  trialEndsAt: new Date(Date.now() - DAY),
});

describe.skipIf(!integrationEnabled)(
  "api/billing — plan, cancel y resume contra Neon (spec 0189, T10)",
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

    it("`plan`: subir de base a plus cobra en el acto; bajar de plus a base rige desde la próxima factura", async () => {
      await withSeed("base", live("subir", BASE_MONTHLY_PRICE), async () => {
        expect((await post(PLAN, { to: "plus" })).status).toBe(200);
        expect(fake.updateParams[0]).toEqual({
          items: [{ id: "si_0", price: MONTHLY_PRICE }],
          proration_behavior: "always_invoice",
          payment_behavior: "error_if_incomplete",
        });
        // La clave lleva el fin del periodo del item: un reintento reusa la respuesta.
        expect(fake.updateKeys[0]).toBe(
          `billing:plan:${subId("subir")}:plus:${PERIOD_END_SECONDS}`,
        );
      });
      await withSeed("plus", live("bajar", YEARLY_PRICE), async () => {
        expect((await post(PLAN, { to: "base" })).status).toBe(200);
        // El MISMO intervalo: anual → anual del base. (`at(-1)`: el doble es del `it`.)
        expect(fake.updateParams.at(-1)).toEqual({
          items: [{ id: "si_0", price: BASE_YEARLY_PRICE }],
          proration_behavior: "none",
          payment_behavior: "error_if_incomplete",
        });
      });
    }, 60_000);

    it("`plan` a base con 2 locales: 409 y nada se le pide a Stripe", async () => {
      await withSeed("plus", live("bloqueo", MONTHLY_PRICE), async (seed) => {
        await seedExtraLocation(seed.business.id, "Sucursal 2");
        const response = await post(PLAN, { to: "base" });
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          code: "downgrade_blocked",
          archiveCount: 1,
        });
        expect(fake.calls).toEqual([]);
      });
    }, 60_000);

    it("`cancel` programa al fin del periodo y `resume` lo deshace; el plan NO se toca", async () => {
      await withSeed("plus", live("cancelar", MONTHLY_PRICE), async (seed) => {
        expect((await post(CANCEL)).status).toBe(200);
        expect(fake.updateParams[0]).toEqual({ cancel_at_period_end: true });
        const programada = await readSubscriptionRow(seed.business.id);
        expect(programada.plan).toBe("plus");
        expect(programada.pendingPlan).toBe("none");
        // La fecha sale de la respuesta de Stripe (fin del periodo), en SEGUNDOS unix.
        expect(programada.pendingPlanAt).toEqual(
          new Date(PERIOD_END_SECONDS * 1000),
        );
        expect(programada.downgradeRequestedAt).not.toBeNull();

        // Cancelar dos veces es 409, sin llamar a Stripe otra vez.
        const otra = await post(CANCEL);
        expect(otra.status).toBe(409);
        expect(await otra.json()).toMatchObject({ code: "cancel_scheduled" });
        expect(fake.updateParams).toHaveLength(1);

        expect((await post(RESUME)).status).toBe(200);
        expect(fake.updateParams[1]).toEqual({ cancel_at_period_end: false });
        const reanudada = await readSubscriptionRow(seed.business.id);
        expect([
          reanudada.plan,
          reanudada.pendingPlan,
          reanudada.pendingPlanAt,
          reanudada.downgradeRequestedAt,
        ]).toEqual(["plus", null, null, null]);

        // Y sin cancelación no hay nada que reanudar.
        const nada = await post(RESUME);
        expect(nada.status).toBe(409);
        expect(await nada.json()).toMatchObject({ code: "nothing_to_resume" });
      });
    }, 60_000);

    it("`cancel` con Stripe caído: 503 y la fila NO dice que hay una cancelación", async () => {
      await withSeed("plus", live("caido", MONTHLY_PRICE), async (seed) => {
        fake.updateError = new Stripe.errors.StripeConnectionError({
          message: "network",
        });
        const response = await post(CANCEL);
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          code: "stripe_unavailable",
        });
        const row = await readSubscriptionRow(seed.business.id);
        expect([row.pendingPlan, row.downgradeRequestedAt]).toEqual([
          null,
          null,
        ]);
      });
    }, 60_000);

    it("`cancel` sin suscripción viva (en prueba) es 409 `no_subscription`", async () => {
      await withSeed("trial", {}, async () => {
        const response = await post(CANCEL);
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          code: "no_subscription",
        });
        expect(fake.calls).toEqual([]);
      });
    }, 60_000);
  },
);
