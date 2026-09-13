import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRICE_IDS,
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
    api: { getSession: async () => ({ user: { id: "usuario-de-prueba" } }) },
  }),
}));

vi.mock("./staff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./staff")>();
  const { staffDouble } = await import("./billing-pages-support");
  return staffDouble(actual);
});

import { renderToStaticMarkup } from "react-dom/server";
import { useBusiness } from "./billing-pages-support";
import SubscriptionPage from "../app/backoffice/subscription/page";

/**
 * LAS PÁGINAS SE IMPORTAN ACÁ, DESPUÉS DE LOS `vi.mock`, Y NO DESDE EL SUPPORT. La primera
 * versión las importaba desde `billing-pages-support.ts` y la corrida COLGABA para siempre
 * sin emitir una línea (0,0% de CPU, ni `vitest list` terminaba): la factory del
 * `vi.mock("./auth-guards")` importa el support, el support importaba la página y la página
 * importa `./auth-guards` — cuya factory no terminó todavía. El motivo está escrito en el
 * support para que nadie las vuelva a mover ahí.
 */
const renderSubscription = async (
  params: { checkout?: string; done?: string } = {},
) =>
  renderToStaticMarkup(
    await SubscriptionPage({ searchParams: Promise.resolve(params) }),
  );

/**
 * Spec 0063, D8 — LA RECONCILIACIÓN AL ABRIR LA PÁGINA, contra la rama real.
 * CORTE DECIDIDO POR EL ORQUESTADOR ANTES DE DESPACHAR (§Corte): el archivo único daba 311
 * al hook (`EXIT=2`, umbral 260), así que D8 sale acá y el preámbulo al support — donde los
 * `vi.mock` NO pueden vivir: van en cada `.test.ts`, y son las 20 líneas de arriba.
 * SEGUNDO CORTE (delta de la D2): este archivo llegó a 300 exactas y el oráculo de R6 no
 * entraba, así que las DOS SALIDAS del estado muerto, el ALTA y la carrera S9 viven en
 * `billing-dead-state.neon.integration.test.ts`. Acá queda SOLO lo que es D8.
 *
 * POR QUÉ EL CABLEADO NECESITA ESTE ARCHIVO: `reconcileFromStripe` ya tenía oráculo a nivel
 * store (M16, fase B). Lo que NO tenía es que la PÁGINA lo llame ANTES de renderizar, y que
 * un Stripe caído se degrade en un aviso en vez de tumbar la sección.
 */
describe.skipIf(!integrationEnabled)(
  "D8 — reconciliación al abrir la página (spec 0063)",
  () => {
    let seed: Seed | null = null;

    beforeEach(() => {
      fake = fakeStripe();
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://mp.test");
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      if (seed) await dropBusiness(seed.business.id);
      seed = null;
    });

    it("una fila DIVERGENTE se reconcilia ANTES de renderizar", async () => {
      // EL CASO MOTIVADOR DE D8: el webhook se perdió el evento, la DB dice `free` sin id y
      // Stripe tiene una suscripción viva → `checkout` crearía una SEGUNDA suscripción viva
      // (DOBLE COBRO). El «antes de renderizar» es lo que el oráculo del store no ve: acá se
      // asevera que el MISMO render ya muestra Plus.
      seed = await seedBillingBusiness("free", {
        stripeCustomerId: custId("divergente"),
      });
      useBusiness(seed);
      fake.list = [
        stripeSubscription({
          id: subId("divergente"),
          status: "active",
          customer: custId("divergente"),
          items: [{ priceId: PRICE_IDS.monthly }],
        }),
      ];
      const html = await renderSubscription();

      const row = await readSubscriptionRow(seed.business.id);
      expect([row.plan, row.interval, row.stripeSubscriptionId]).toEqual([
        "plus",
        "month",
        subId("divergente"),
      ]);
      // El owner ve el plan RECONCILIADO en este render y NO el «Mejorar a Plus» que
      // llevaba al doble cobro.
      expect(html).toContain("Plan Plus");
      expect(html).not.toContain("Mejorar a Plus");
      expect(fake.calls).toContain("subscriptions.list");
    }, 60_000);

    it("con la lista VACÍA no escribe NADA y lo avisa", async () => {
      // Vacío con `status:"all"` significa «este customer nunca tuvo suscripción», y eso NO
      // alcanza para degradar un plan desde el render (M16). Lo que agrega sobre el caso del
      // store es que la página lo DICE en vez de callarse.
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("vacia"),
        stripeSubscriptionId: subId("vacia"),
      });
      useBusiness(seed);
      const antes = await readSubscriptionRow(seed.business.id);
      fake.list = [];
      const html = await renderSubscription();

      // LA FILA PRIMERO: con el aviso antes, su rojo TAPA el de la escritura.
      expect(await readSubscriptionRow(seed.business.id)).toEqual(antes);
      expect(html).toContain("No pudimos confirmar tu suscripción con Stripe");
      // Y la sección NO se bloquea: sigue mostrando el plan y sus operaciones.
      expect(html).toContain("Plan Plus");
      expect(html).toContain("Bajar a Free");
    }, 60_000);

    it("con Stripe CAÍDO renderiza con el aviso y sin bloquear la sección", async () => {
      // Ítem del DoD. El `list` falla sobre la INSTANCIA del fake (el gateway es un objeto
      // plano): no hace falta tocar `billing-stripe-fake.ts`.
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("caido"),
        stripeSubscriptionId: subId("caido"),
      });
      useBusiness(seed);
      const antes = await readSubscriptionRow(seed.business.id);
      fake.gateway.subscriptions.list = (async () => {
        throw new Error("Stripe no contesta");
      }) as unknown as typeof fake.gateway.subscriptions.list;

      const html = await renderSubscription();
      expect(html).toContain("No pudimos confirmar tu suscripción con Stripe");
      expect(await readSubscriptionRow(seed.business.id)).toEqual(antes);
      // LO QUE IMPORTA DEL CASO: la sección sigue viva y operable con lo de la DB. Si el
      // fallo tumbara la página, el owner perdería la sección entera por un timeout de red.
      expect(html).toContain("Plan Plus");
      expect(html).toContain("Pasar a anual");
      expect(html).toContain("Bajar a Free");
    }, 60_000);

    it("un `free` SIN customer no dispara el aviso: no hay nada que confirmar", async () => {
      // Los 9 `free` de prod tienen `stripe_customer_id` NULL: avisar ahí sería alarmar a
      // todos los negocios gratis por un no-evento, con el aviso siempre encendido.
      seed = await seedBillingBusiness("free");
      useBusiness(seed);
      const html = await renderSubscription();
      expect(html).not.toContain("No pudimos confirmar");
      expect(html).toContain("Mejorar a Plus");
      // Y no se le preguntó nada a Stripe: sin customer no hay por dónde.
      expect(fake.calls).toEqual([]);
    }, 60_000);

    it("una suscripción AJENA en la lista NO confirma nada: avisa y no escribe (decisión 6)", async () => {
      // `ignored` = Stripe contestó algo que NO respalda la fila: una suscripción viva con
      // OTRO id sobre una fila que ya tiene la suya. La decisión 6 lo pone del lado del
      // aviso y el docblock de `reconcileOnOpen` lo afirma — y un revisor midió que nada lo
      // pinneaba: contar `ignored` como confirmado dejaba 13/13 en verde (R6).
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("ajena"),
        stripeSubscriptionId: subId("propia"),
      });
      useBusiness(seed);
      const antes = await readSubscriptionRow(seed.business.id);
      fake.list = [
        stripeSubscription({
          id: subId("ajena"),
          status: "active",
          customer: custId("ajena"),
          items: [{ priceId: PRICE_IDS.monthly }],
        }),
      ];
      const html = await renderSubscription();

      // LA FILA PRIMERO (mismo orden que el caso de la lista vacía).
      expect(await readSubscriptionRow(seed.business.id)).toEqual(antes);
      expect(html).toContain("No pudimos confirmar tu suscripción con Stripe");
      // CONTROL: sí se le preguntó a Stripe — el aviso no viene de un `catch`.
      expect(fake.calls).toContain("subscriptions.list");
      expect(html).toContain("Plan Plus");
    }, 60_000);
  },
);
