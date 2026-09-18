import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRICE_IDS,
  billingRequest,
  custId,
  fakeStripe,
  readSubscriptionRow,
  stripeSubscription,
  subId,
  type FakeStripe,
} from "./billing-integration-support";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";

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

import { renderToStaticMarkup } from "react-dom/server";
import { subscriptionOffers } from "./billing";
import { settleToFree } from "./billing/store";
import { withDbTransaction } from "./db";
import { lockBusiness } from "./locations/shared";
import { useBusiness } from "./billing-pages-support";
import SubscriptionPage from "../app/backoffice/subscription/page";
import { POST as CHECKOUT } from "../app/api/billing/checkout/route";
import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { downgradeToFree } from "../app/api/billing/_downgrade";
import { POST as SETTLE_FREE } from "../app/api/billing/settle-free/route";

/** Las páginas se importan DESPUÉS de los `vi.mock` y no desde el support: el motivo (un
 * ciclo de imports que cuelga la colección entera) está en `billing-pages-support.ts`. */
const renderSubscription = async () =>
  renderToStaticMarkup(
    await SubscriptionPage({ searchParams: Promise.resolve({}) }),
  );

/**
 * Spec 0063 — EL ESTADO «`plus` CON LA SUSCRIPCIÓN MUERTA» Y SUS DOS SALIDAS, JUNTAS Y SOBRE
 * EL MISMO ESTADO. Existe por una razón de proceso: la spec dice que ese estado sale por
 * «**D8 o el botón de D10**», D10 se cerró en la fase D1 y D8 en la D2, así que NINGÚN
 * REVISOR VIO LAS DOS JUNTAS. Si las dos se debilitaran, `already_on_plan` volvería a ser un
 * callejón sin salida — «Ya estás en el plan Plus» sobre una suscripción que no existe.
 *
 * Archivo propio por CORTE DE TAMAÑO (delta de la D2): `billing-reconcile-page.neon…` llegó a
 * 300 exactas. Los `vi.mock` de arriba se repiten a propósito — no pueden vivir en el support.
 */
describe.skipIf(!integrationEnabled)(
  "«plus con la suscripción muerta»: las DOS salidas (spec 0063, D8 y D10)",
  () => {
    let seed: Seed | null = null;

    beforeEach(() => {
      fake = fakeStripe();
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
      // `checkout` exige la env de origen ANTES de decidir: sin ella contesta 503
      // `origin_not_configured` y un test que espere 200 se pone rojo POR EL SETUP.
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://mp.test");
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      if (seed) await dropBusiness(seed.business.id);
      seed = null;
    });

    it("SALIDA 1 (D8): Stripe cuenta la verdad y la página reconcilia a `none` antes de renderizar", async () => {
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("d8"),
        stripeSubscriptionId: subId("d8"),
      });
      useBusiness(seed);
      fake.list = [
        stripeSubscription({
          id: subId("d8"),
          status: "canceled",
          customer: custId("d8"),
          items: [{ priceId: PRICE_IDS.monthly }],
        }),
      ];
      const html = await renderSubscription();

      // Por SQL, que es el oráculo (la respuesta nunca lo es): un `canceled` sobre un plan
      // PAGO sin `downgrade_requested_at` es `none`, no `free` (bloqueante R2-1).
      const row = await readSubscriptionRow(seed.business.id);
      expect(row.plan).toBe("none");
      // Y el owner ve el estado NUEVO en el mismo render, no en el siguiente.
      expect(html).toContain("Sin plan");
      // …sin el «Plan Sin plan» que la decisión 3 sacó de la home (menor 8 del revisor,
      // medido: la primera sonda aseveró `toContain("Plan Sin plan")` y PASÓ).
      expect(html).not.toContain("Plan Sin plan");
      expect(html).toContain("Tu suscripción terminó");
      expect(html).toContain("Volver a Plus");
    }, 60_000);

    it("SALIDA 2 (D10): con Stripe sin nada que contar, el botón sigue siendo salida y deja pasar el checkout", async () => {
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("d10"),
        stripeSubscriptionId: subId("d10"),
        status: "canceled",
      });
      useBusiness(seed);
      // Lista VACÍA: D8 no escribe nada (M16) y el estado muerto SIGUE ahí.
      fake.list = [];
      const html = await renderSubscription();
      expect(await readSubscriptionRow(seed.business.id)).toMatchObject({
        plan: "plus",
        stripeSubscriptionId: subId("d10"),
      });
      expect(html).toContain("Bajar a Free");
      expect(html).toContain("No pudimos confirmar tu suscripción con Stripe");

      // EL ALIAS, ENUNCIADO (menor 9 del revisor): para un `plus` muerto las offers mandan
      // el botón a `/api/billing/cancel`, y `settle-free` es LITERALMENTE el mismo handler
      // (`settle-free/route.ts`: `export const POST = downgradeToFree`, de `_downgrade.ts`). Qué hacer lo decide
      // la FILA, no la URL. Si alguien los separa, esto lo dice antes que prod.
      expect(
        subscriptionOffers({
          plan: "plus",
          status: "canceled",
          interval: "month",
          pendingPlan: null,
          pendingPlanAt: null,
        }).downgrade?.endpoint,
      ).toBe("/api/billing/cancel");
      expect(SETTLE_FREE).toBe(downgradeToFree);

      // El botón es salida de verdad, POR EL ENDPOINT QUE EL BOTÓN USA: limpia el id en
      // local, SIN tocar Stripe.
      const callsAntes = fake.calls.length;
      expect((await CANCEL(billingRequest({}))).status).toBe(200);
      const settled = await readSubscriptionRow(seed.business.id);
      expect([settled.plan, settled.stripeSubscriptionId]).toEqual([
        "free",
        null,
      ]);
      expect(fake.calls.length).toBe(callsAntes);
      // Y RECIÉN ACÁ deja de ser un callejón: el checkout procede.
      const checkout = await CHECKOUT(
        billingRequest({ interval: "month", from: "subscription" }),
      );
      expect(checkout.status).toBe(200);
      expect(((await checkout.json()) as { url?: string }).url).toBeTruthy();
    }, 90_000);

    it("la D1 no rompió el ALTA: el body del onboarding sigue llegando a Checkout", async () => {
      // §onboarding del encargo. Que el onboarding MANDE este body lo pinnea
      // `billing-click-probe.test.ts` (antes se transcribía a mano y pinneaba la copia);
      // acá se pinnea lo que la RUTA hace con él: la sesión vuelve a `/backoffice` y no a
      // la sección, que es el [R2-I8] del lado del aterrizaje.
      seed = await seedBillingBusiness("free");
      useBusiness(seed);

      const response = await CHECKOUT(
        billingRequest({ interval: "month", from: "onboarding" }),
      );
      expect(response.status).toBe(200);
      expect(((await response.json()) as { url?: string }).url).toBeTruthy();
      const params = fake.sessionParams.at(-1);
      expect(params?.success_url).toBe(
        "https://mp.test/backoffice?checkout=success",
      );
      expect(params?.success_url).not.toContain("/backoffice/subscription");
      // Y el negocio sobre el que actuó es el del CALLER, no uno nombrado en el body.
      expect(params?.client_reference_id).toBe(seed.business.id);
    }, 60_000);

    it("S9: la página lee el estado BAJO el lock, así que una baja en vuelo se ve commiteada y nunca a medias", async () => {
      // EL LÍMITE QUE LA D2 DECLARÓ («sólo lo pinnearía una carrera») ERA FALSO, y lo
      // falsificó un revisor escribiendo esta carrera: ~40 líneas, 0 paquetes. Un escritor
      // toma `lockBusiness`, escribe el `SET` de `settle_to_free` y RETIENE el commit
      // mientras la página renderiza. Con el lock, el render espera y muestra `free`; sin
      // él (R9), lee `plus` y ofrece «Bajar a Free» sobre un estado que ya no existe.
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("carrera"),
        stripeSubscriptionId: subId("carrera"),
      });
      useBusiness(seed);
      const businessId = seed.business.id;
      fake.list = [];

      let locked!: () => void;
      const writerHoldsTheLock = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const writer = withDbTransaction(async (tx) => {
        await lockBusiness(tx, businessId);
        await settleToFree(tx, businessId);
        locked();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      });
      await writerHoldsTheLock;
      const html = await renderSubscription();
      await writer;

      // Lo que el owner vio es el estado COMMITEADO: free, sin la baja que ya ocurrió.
      expect(html).not.toContain("Bajar a Free");
      expect(html).toContain("Mejorar a Plus");
      expect((await readSubscriptionRow(businessId)).plan).toBe("free");
    }, 60_000);
  },
);
