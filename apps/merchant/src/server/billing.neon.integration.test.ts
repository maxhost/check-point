import Stripe from "stripe";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveLocation,
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
import {
  integrationEnabled,
  readLocationRow,
  seedExtraLocation,
  type SeededSubscription,
} from "./locations-integration-support";

/**
 * Spec 0063 D6/D9/D10 — LAS 4 RUTAS contra Postgres de verdad. La baja INMEDIATA de la spec
 * 0064 (A2) y su secuencia completa viven en `billing-downgrade-now.neon.integration.test.ts`:
 * este archivo estaba en 299/300 y con ese caso adentro daba 323, medido al hook. El oráculo de cada escritura es
 * la FILA por SQL (ADR 0054), nunca la respuesta; y el de lo que se le pidió a Stripe son los
 * params y las claves del fake, nunca lo que devolvió. Staff activo vs. desactivado necesita
 * sesiones REALES y vive en `billing-routes-auth…`. Los ids salen de `subId`/`custId`: únicos
 * por archivo y por corrida (uniques GLOBALES; ver el bloque en el support).
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { getSession: async () => ({ user: { id: "owner" } }) },
  }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  ownerContext: async () =>
    world.businessId ? { id: world.businessId, currencyCode: "USD" } : null,
}));

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as SETTLE_FREE } from "../app/api/billing/settle-free/route";

type Handler = (request: NextRequest) => Promise<Response>;

const post = (handler: Handler, body: unknown = {}) =>
  handler(billingRequest(body));

/** Siembra, corre el cuerpo con el owner resuelto a ese negocio, y limpia siempre. */
async function withSeed(
  plan: "free" | "plus" | "none",
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

const livePlus = (tag: string, items?: { priceId: string }[]) =>
  livePlusState(fake, tag, items);

describe.skipIf(!integrationEnabled)(
  "api/billing routes against Neon (spec 0063 + 0064)",
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

    it("`cancel` con 2 locales de más: 409 `downgrade_blocked`, NADA escrito y CERO llamadas a Stripe", async () => {
      await withSeed("plus", livePlus("bloqueado"), async (seed) => {
        await seedExtraLocation(seed.business.id, "Sucursal 2");
        await seedExtraLocation(seed.business.id, "Sucursal 3");
        const response = await post(CANCEL);
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
          error:
            "Para volver a Free necesitas 1 local activo; hoy tienes 3. Archiva 2.",
          code: "downgrade_blocked",
          archiveCount: 2,
        });
        // Bloqueo duro EN EL SERVIDOR: la fila no se movió y Stripe no se enteró.
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
        expect(fake.calls).toEqual([]);
      });
    }, 60_000);

    /**
     * M5 — EL ORDEN DE A2 ES LOAD-BEARING. El paso 2 (escribir `pending_plan` y
     * `downgrade_requested_at`) commitea ANTES del paso 3 (la llamada a Stripe): el tope cae a
     * 1 en el MISMO commit que verificó el conteo y no queda ventana para desarchivar. El fake
     * dispara el desarchivado DENTRO del `cancel`, que es exactamente esa ventana.
     */
    it("`cancel` escribe la intención ANTES de llamar a Stripe: un desarchivado concurrente ya ve el tope caído", async () => {
      await withSeed("plus", livePlus("orden"), async (seed) => {
        const archivado = await seedExtraLocation(
          seed.business.id,
          "Sucursal 2",
        );
        await archiveLocation(archivado);
        let intento: PromiseSettledResult<unknown> | undefined;
        fake.beforeCancel = async () => {
          const { setLocationStatus } = await import("./locations");
          [intento] = await Promise.allSettled([
            setLocationStatus(seed.business, archivado, "active"),
          ]);
        };

        expect((await post(CANCEL)).status).toBe(200);
        expect(intento?.status).toBe("rejected");
        expect((intento as PromiseRejectedResult).reason).toMatchObject({
          status: 409,
          code: "location_limit",
        });
        // La tabla es el oráculo, no la promesa: el local sigue archivado.
        expect((await readLocationRow(archivado)).status).toBe("archived");
      });
    }, 60_000);

    it("`cancel`: un error de RED deja el estado PUESTO; uno determinista lo REVIERTE", async () => {
      await withSeed("plus", livePlus("red"), async (seed) => {
        fake.cancelError = new Stripe.errors.StripeConnectionError({
          message: "network",
        });
        const response = await post(CANCEL);
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({
          code: "stripe_unavailable",
        });
        // [R1-B3]: un timeout no prueba nada; el estado queda capado en 1 (conservador) y el
        // paso 4 NO corrió, así que el plan sigue siendo `plus` con la marca puesta.
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.plan).toBe("plus");
        expect(row.pendingPlan).toBe("free");
        expect(row.downgradeRequestedAt).not.toBeNull();
      });

      await withSeed("plus", livePlus("determinista"), async (seed) => {
        fake.cancelError = new Stripe.errors.StripeInvalidRequestError({
          message: "no such subscription",
          statusCode: 400,
        });
        expect((await post(CANCEL)).status).toBe(503);
        // Acá SÍ se revierte: el 4xx prueba que Stripe no aplicó nada.
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
      });
    }, 60_000);

    it("D10 — `settle-free`: 409 con 3 activos; con 1 escribe el SET completo SIN tocar Stripe, y después `checkout` procede", async () => {
      const dead = {
        status: "canceled",
        interval: "month",
        stripeCustomerId: custId("none"),
        stripeSubscriptionId: subId("none"),
      } satisfies SeededSubscription;
      await withSeed("none", dead, async (seed) => {
        const segunda = await seedExtraLocation(seed.business.id, "Sucursal 2");
        const tercera = await seedExtraLocation(seed.business.id, "Sucursal 3");
        const blocked = await post(SETTLE_FREE);
        expect(blocked.status).toBe(409);
        expect(await blocked.json()).toMatchObject({
          code: "downgrade_blocked",
          archiveCount: 2,
        });

        await archiveLocation(segunda);
        await archiveLocation(tercera);
        expect((await post(SETTLE_FREE)).status).toBe(200);
        const row = await readSubscriptionRow(seed.business.id);
        // El `SET` de D10; el customer SE CONSERVA (es la llave de D8).
        expect([
          row.plan,
          row.status,
          row.interval,
          row.stripeSubscriptionId,
          row.pendingPlan,
          row.downgradeRequestedAt,
          row.stripeCustomerId,
        ]).toEqual(["free", "active", null, null, null, null, custId("none")]);
        // LA ÚNICA operación de plan que no toca Stripe: cero llamadas al fake.
        expect(fake.calls).toEqual([]);

        // Y la salida es REAL: con el id limpio, `checkout` ya no ve suscripción viva (M14).
        const checkout = await post(CHECKOUT, { interval: "month" });
        expect(checkout.status).toBe(200);
        expect(await checkout.json()).toEqual({
          url: "https://checkout.stripe.test/session",
        });
      });
    }, 60_000);

    it("`checkout` persiste el customer, usa `MERCHANT_PUBLIC_ORIGIN` y rechaza una sesión no abierta", async () => {
      await withSeed("free", {}, async (seed) => {
        fake.nextCustomerId = custId("checkout");
        expect((await post(CHECKOUT, { interval: "year" })).status).toBe(200);
        // Sin esto D8 es un no-op: el customer id lo escribía sólo el webhook ([R2-6]).
        const row = await readSubscriptionRow(seed.business.id);
        expect(row.stripeCustomerId).toBe(custId("checkout"));
        expect(fake.customerParams[0]).toEqual({
          metadata: { businessId: seed.business.id },
        });
        expect(fake.sessionParams[0]).toMatchObject({
          customer: custId("checkout"),
          client_reference_id: seed.business.id,
          success_url: "https://checkpass.test/backoffice?checkout=success",
        });
        // `from: "subscription"` aterriza en la sección, no en la home ([R2-I8]).
        await post(CHECKOUT, { interval: "year", from: "subscription" });
        expect(fake.sessionParams[1]).toMatchObject({
          success_url:
            "https://checkpass.test/backoffice/subscription?checkout=success",
        });
        // UN solo customer (el 2.º intento reusa el persistido) y CON clave: sin ella, dos
        // checkouts concurrentes crean dos y el 2.º pisa la columna.
        expect(fake.customerKeys).toEqual([
          `billing:customer:${seed.business.id}`,
        ]);

        // Una sesión cacheada por la clave fija que ya no está abierta es un FALSO ÉXITO.
        fake.sessionStatus = "complete";
        const stale = await post(CHECKOUT, { interval: "month" });
        expect(stale.status).toBe(409);
        expect(await stale.json()).toMatchObject({
          code: "checkout_session_stale",
        });
      });
    }, 60_000);
  },
);
