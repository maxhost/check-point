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
import { scheduleCancel } from "./billing/store";
import { withDbTransaction } from "@mi-pasaporte/db";
import { lockBusiness } from "./locations/shared";
import { useBusiness } from "./billing-pages-support";
import SubscriptionPage from "../app/backoffice/subscription/page";
import { POST as CHECKOUT } from "../app/api/billing/checkout/route";

/** Las páginas se importan DESPUÉS de los `vi.mock` y no desde el support: el motivo (un
 * ciclo de imports que cuelga la colección entera) está en `billing-pages-support.ts`. */
const renderSubscription = async () =>
  renderToStaticMarkup(
    await SubscriptionPage({ searchParams: Promise.resolve({}) }),
  );

/**
 * Spec 0063 + spec 0189 — EL ESTADO «PLAN PAGO CON LA SUSCRIPCIÓN MUERTA» Y SU SALIDA. Desde la
 * spec 0189 no hay plan gratis al que bajar: la salida es CONTRATAR (la suscripción muerta no
 * cuenta como viva, así que el Checkout procede), y D8 reconcilia a `none` cuando Stripe lo
 * cuenta.
 *
 * Archivo propio por CORTE DE TAMAÑO. Los `vi.mock` de arriba se repiten a propósito — no
 * pueden vivir en el support.
 */
describe.skipIf(!integrationEnabled)(
  "«plan pago con la suscripción muerta»: su salida (spec 0063 D8 + spec 0189)",
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
          items: [{ priceId: PRICE_IDS.plus.month }],
        }),
      ];
      const html = await renderSubscription();

      // Por SQL, que es el oráculo (la respuesta nunca lo es): un `canceled` sobre un plan
      // PAGO es `none` (spec 0189 §D5).
      const row = await readSubscriptionRow(seed.business.id);
      expect(row.plan).toBe("none");
      // Y el owner ve el estado NUEVO en el mismo render, no en el siguiente.
      expect(html).toContain("Sin plan");
      // …sin el «Plan Sin plan» que la decisión 3 sacó de la home (menor 8 del revisor,
      // medido: la primera sonda aseveró `toContain("Plan Sin plan")` y PASÓ).
      expect(html).not.toContain("Plan Sin plan");
      expect(html).toContain("Tu suscripción terminó");
      expect(html).toContain("Elegir un plan");
    }, 60_000);

    it("SALIDA 2: con Stripe sin nada que contar, el estado muerto NO es un callejón: el checkout procede", async () => {
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("muerta"),
        stripeSubscriptionId: subId("muerta"),
        status: "canceled",
        trialEndsAt: new Date(Date.now() - 86_400_000),
      });
      useBusiness(seed);
      // Lista VACÍA: D8 no escribe nada (M16) y el estado muerto SIGUE ahí.
      fake.list = [];
      const html = await renderSubscription();
      expect(await readSubscriptionRow(seed.business.id)).toMatchObject({
        plan: "plus",
        stripeSubscriptionId: subId("muerta"),
      });
      expect(html).toContain("Elegir un plan");
      expect(html).toContain("No pudimos confirmar tu suscripción con Stripe");
      // La suscripción MUERTA no cuenta como viva: el checkout procede sin pasar por nada.
      const checkout = await CHECKOUT(
        billingRequest({
          plan: "plus",
          interval: "month",
          from: "subscription",
        }),
      );
      expect(checkout.status).toBe(200);
      expect(((await checkout.json()) as { url?: string }).url).toBeTruthy();
    }, 90_000);

    it("la D1 no rompió el ALTA: el body del onboarding sigue llegando a Checkout", async () => {
      // §onboarding del encargo. Que el onboarding MANDE este body lo pinnea
      // `billing-click-probe.test.ts` (antes se transcribía a mano y pinneaba la copia);
      // acá se pinnea lo que la RUTA hace con él: la sesión vuelve a `/backoffice` y no a
      // la sección, que es el [R2-I8] del lado del aterrizaje.
      seed = await seedBillingBusiness("trial");
      useBusiness(seed);

      const response = await CHECKOUT(
        billingRequest({ plan: "base", interval: "month", from: "onboarding" }),
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

    it("S9: la página lee el estado BAJO el lock, así que una cancelación en vuelo se ve commiteada y nunca a medias", async () => {
      // Un escritor toma `lockBusiness`, PROGRAMA la cancelación y RETIENE el commit mientras
      // la página renderiza. Con el lock, el render espera y muestra la cancelación; sin él
      // (R9), lee la fila vieja y ofrece «Cancelar suscripción» sobre algo ya cancelado.
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
        await scheduleCancel(tx, businessId, {
          now: new Date(),
          pendingPlan: "none",
          pendingPlanAt: null,
        });
        locked();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      });
      await writerHoldsTheLock;
      const html = await renderSubscription();
      await writer;

      // Lo que el owner vio es el estado COMMITEADO: la cancelación programada, sin el botón.
      expect(html).not.toContain("Cancelar suscripción");
      expect(html).toContain("al final del período");
      expect((await readSubscriptionRow(businessId)).pendingPlan).toBe("none");
    }, 60_000);
  },
);
