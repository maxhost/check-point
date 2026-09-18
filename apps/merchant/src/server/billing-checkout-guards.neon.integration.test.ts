import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingRequest,
  custId,
  livePlusState,
  readSubscriptionRow,
  subId,
} from "./billing-integration-support";
import { fakeStripe, type FakeStripe } from "./billing-stripe-fake";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D6 — LOS GUARDS DE `checkout`. Hermano de
 * `billing-cancel-guards.neon.integration.test.ts` y nacido del mismo modo: un FAIL de
 * revisor por un invariante DECLARADO que nada pinneaba (ADR 0054).
 *
 * LA `idempotencyKey` DEL CHECKOUT ES FIJA POR NEGOCIO+INTERVALO, y eso es una decisión
 * escrita: §Decisiones del orquestador punto 3 dice «la clave fija se conserva» —cambiarla
 * permitiría varias sesiones de pago abiertas a la vez—, y el docblock de `confirmAtStripe`
 * en `cancel/route.ts` la usa como CONTRAEJEMPLO normativo para explicar por qué la clave de
 * `cancel` sí varía. O sea que hay texto de producción razonando sobre esta propiedad; sin
 * este test, romperla (p. ej. sumándole un `Date.now()`) deja la suite entera en verde.
 * Mutación MUT-K.
 *
 * Lo que el `checkout` NO rompe con la clave fija —una sesión ya cerrada— tiene su propio
 * caso en `billing.neon.integration.test.ts` (409 `checkout_session_stale`): sin ese chequeo
 * la clave fija mandaría al owner a un FALSO ÉXITO.
 *
 * El archivo cubre además el GATE DE PLAN y la normalización del origen: los dos salieron del
 * barrido sistemático de afirmaciones (S4 y S6), que los encontró sin oráculo.
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      // Spec 0072: el doble declara `emailVerified` porque `requireApiOwner` corre el
      // gate de email en las 10 superficies del owner. Edicion del DOBLE.
      getSession: async () => ({
        user: { id: "owner", emailVerified: true },
      }),
    },
  }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  // Spec 0072: `ownerContext` selecciona ademas el eje `status`, y `requireApiOwner` es
  // fail-closed — una fila sin `status` NO opera. Edicion del DOBLE, no de una asercion.
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

describe.skipIf(!integrationEnabled)(
  "api/billing/checkout — la clave de idempotencia (spec 0063, D6)",
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

    it("la `idempotencyKey` del Checkout es FIJA por negocio + intervalo", async () => {
      const seed = await seedBillingBusiness("free", {});
      world.businessId = seed.business.id;
      // El customer que devuelve el fake se ESCRIBE en `core.subscription`, y ese unique es
      // GLOBAL: con el literal por defecto este archivo chocaría con el `checkout` de
      // `billing.neon.integration.test.ts` al correr en paralelo (`23505` en el seed).
      fake.nextCustomerId = `cus_${randomUUID().slice(0, 8)}`;
      try {
        const open = (body: unknown) =>
          CHECKOUT(billingRequest(body) as NextRequest);
        expect((await open({ interval: "month" })).status).toBe(200);
        expect((await open({ interval: "month" })).status).toBe(200);

        // DOS intentos del MISMO plan reusan la MISMA clave: es lo que impide que queden dos
        // sesiones de pago abiertas a la vez (§Decisiones del orquestador, 3).
        expect(fake.sessionKeys).toEqual([
          `checkout:${seed.business.id}:month`,
          `checkout:${seed.business.id}:month`,
        ]);

        // …y el INTERVALO sí forma parte de la clave: cambiar de mensual a anual es otro
        // pago, y tiene que poder abrir su propia sesión.
        expect((await open({ interval: "year" })).status).toBe(200);
        expect(fake.sessionKeys[2]).toBe(`checkout:${seed.business.id}:year`);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    /**
     * S4 — EL CABLEADO DEL GATE DE PLAN, que es donde estaba el agujero: la DECISIÓN
     * (`decidePlanChange` → `subscription_live`) tiene sus units de la fase A, pero ningún
     * test llamaba a `checkout` sobre una suscripción VIVA, así que saltear `decideUnderLock`
     * entero dejaba la suite en verde. Es el hueco de `choosePushPromptView` que describe
     * `CLAUDE.md`, sobre la propiedad cuyo daño es COBRAR DOS VECES.
     */
    it("un negocio con suscripción VIVA recibe 409 `subscription_live` y NO abre una 2.ª sesión", async () => {
      const tag = `viva${randomUUID().slice(0, 8)}`;
      const seed = await seedBillingBusiness("plus", livePlusState(fake, tag));
      world.businessId = seed.business.id;
      try {
        const response = await CHECKOUT(
          billingRequest({ interval: "month" }) as NextRequest,
        );
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          code: "subscription_live",
        });
        // Ni sesión ni customer: el gate corta ANTES de tocar Stripe, que es lo que evita la
        // segunda suscripción viva (y el doble cobro).
        expect(fake.calls).toEqual([]);
        // Y la fila no se movió: sigue apuntando a la suscripción que ya paga.
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.stripeSubscriptionId).toBe(subId(tag));
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    /**
     * S6 — la barra final de `MERCHANT_PUBLIC_ORIGIN` se normaliza. Es cosmético comparado con
     * el resto, pero la env la escribe una persona en el panel de Vercel y `//backoffice` en un
     * `success_url` es un 404 después de pagar.
     */
    it("un `MERCHANT_PUBLIC_ORIGIN` con barra final no produce `//backoffice`", async () => {
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://checkpass.test/");
      const seed: Seed = await seedBillingBusiness("free", {});
      world.businessId = seed.business.id;
      fake.nextCustomerId = custId("barra");
      try {
        expect(
          (await CHECKOUT(billingRequest({ interval: "month" }) as NextRequest))
            .status,
        ).toBe(200);
        expect(fake.sessionParams[0]).toMatchObject({
          success_url: "https://checkpass.test/backoffice?checkout=success",
          cancel_url: "https://checkpass.test/backoffice?checkout=cancelled",
        });
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);
  },
);
