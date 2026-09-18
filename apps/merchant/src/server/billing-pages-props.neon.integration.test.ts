import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  custId,
  fakeStripe,
  subId,
  type FakeStripe,
} from "./billing-integration-support";
import {
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import {
  integrationEnabled,
  seedExtraLocation,
} from "./locations-integration-support";

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

import { expectCrossesExactly, useBusiness } from "./billing-pages-support";
import { subscriptionOffers, type SubscriptionView } from "./billing";
import { stripeInvoice, stripeSubscription } from "./billing-stripe-fake";
import SubscriptionPage from "../app/backoffice/subscription/page";
import { SubscriptionConsole } from "../app/backoffice/subscription/subscription-console";

/**
 * Spec 0064, fase B — EL ORACULO DE PROPS DE LA SECCION DE SUSCRIPCION (ADR 0062), en su
 * archivo propio.
 *
 * CORTE DE TAMANO HECHO ANTES DE AGREGAR: `billing-pages.neon.integration.test.ts` estaba en
 * 302/300 al hook —ya pasado— y esta fase le suma una prop (`facts`) a los dos estados mas un
 * `it` nuevo con las llaves de Stripe sembradas de verdad. Los tests del HTML se quedan alla;
 * aca vive lo que mira el ELEMENTO que devuelve la pagina, que es otra clase de oraculo.
 *
 * POR QUE NO ALCANZA EL HTML, en una linea (el relato completo son CINCO vueltas y esta en el
 * ADR 0062): `renderToStaticMarkup` NO emite el payload RSC, asi que bajar la fila cruda a la
 * consola dejaba 66/66 en VERDE. Lo que cierra la propiedad es `expectCrossesExactly`: `type`,
 * `key`, UNA SOLA lectura (`structuredClone`, que es lo que hace Flight) y VALOR EXACTO de
 * TODAS las props, en CADA estado.
 *
 * LOS `vi.mock` ESTAN DUPLICADOS RESPECTO DEL ARCHIVO HERMANO, Y NO SE PUEDEN COMPARTIR: son
 * por archivo, y moverlos a `billing-pages-support.ts` CUELGA la corrida entera (el ciclo esta
 * escrito en ese archivo, con su medicion).
 */

describe.skipIf(!integrationEnabled)(
  "lo que la página de suscripción le PASA a la consola (ADR 0062 / spec 0064)",
  () => {
    let seed: Seed | null = null;
    // El DTO que los DOS estados del oráculo de props esperan: lo que cambia entre ellos es
    // el bloqueo (`activeLocations`/`canCancel`/`downgradeBlock`), no la suscripción.
    const plusMensual: SubscriptionView = {
      plan: "plus",
      status: "active",
      interval: "month",
      pendingPlan: null,
      pendingPlanAt: null,
    };

    beforeEach(() => {
      fake = fakeStripe();
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
      // `checkout` exige la env de origen ANTES de decidir: sin ella contesta 503
      // `origin_not_configured` y un test que espere 200 se pone rojo POR EL SETUP, no por
      // la propiedad. Pasó en la primera corrida de este archivo.
      vi.stubEnv("MERCHANT_PUBLIC_ORIGIN", "https://mp.test");
    });

    afterEach(async () => {
      vi.unstubAllEnvs();
      if (seed) await dropBusiness(seed.business.id);
      seed = null;
    });
    it("la página le pasa a la consola el DTO, NO la fila", async () => {
      // NACE DE UNA MUTACIÓN VERDE (S7) y lleva CINCO vueltas de oráculo; el relato entero
      // está en el ADR 0062. El resumen: `renderToStaticMarkup` NO emite el payload RSC, así
      // que el test del HTML pinnea «la consola no IMPRIME las claves», no «la página no las
      // PASA». Se inspecciona el ELEMENTO que devuelve la página, patrón que el repo ya usa
      // (`locations-backoffice-pages.neon.integration.test.ts:81`), sin mock ni `resetModules`.
      const requestedAt = new Date(Date.UTC(2026, 8, 11));
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("props"),
        stripeSubscriptionId: subId("props"),
        downgradeRequestedAt: requestedAt,
      });
      useBusiness(seed);
      // LAS CUATRO ASERCIONES VIVEN EN `expectCrossesExactly` (ADR 0062) y se corren en LOS
      // DOS ESTADOS. LÍMITE DECLARADO (ADR 0062, §Límite): esto cierra todo error PLAUSIBLE
      // —una prop de más, la fila cruda, el DTO olvidado, algo no serializable anidado— y NO
      // cierra la afirmación universal «no filtra por ningún canal»: queda afuera un canal
      // introducido a propósito por una vía no aseverada (un estado que el test no siembra).
      // Eso pide otra clase de oráculo, no otra mutación. La versión anterior aseveraba el conjunto completo sólo acá y en el
      // estado bloqueado miraba únicamente `downgradeBlock`: un revisor metió el secreto en
      // OTRA prop, gateada a ese estado, y quedaba 44/44 VERDE. Un oráculo de un solo estado
      // no cubre las ramas que en ese estado salen nulas.
      expectCrossesExactly(
        await SubscriptionPage({ searchParams: Promise.resolve({}) }),
        SubscriptionConsole,
        {
          subscription: plusMensual,
          offers: subscriptionOffers(plusMensual),
          // El fake no tiene la suscripción ni ninguna factura, así que `readBillingFacts`
          // devuelve los dos campos en `null` — el estado DEGRADADO, que es real: es lo que
          // ve el owner cuando Stripe no contesta. El estado con datos tiene su `it` abajo.
          facts: { renewalAt: null, lastPaidInvoice: null },
          activeLocations: 1,
          canCancel: true,
          downgradeBlock: null,
          // `fake.list` vacío → `no_subscriptions` → NO confirmado (decisión 6).
          stripeUnconfirmed: true,
          timezone: "America/Guayaquil",
          notice: null,
        },
      );
    }, 60_000);

    it("le pasa el DTO también en el estado BLOQUEADO, con el conjunto COMPLETO", async () => {
      // ES UN `it` PROPIO Y NO UN SEGUNDO TRAMO DEL ANTERIOR: adentro del mismo `it` el
      // primer rojo corta y este estado NUNCA se evalúa —medido: con la fuga del `key` puesta
      // sólo salía la aserción del estado 1—, así que un rojo no diría CUÁL de los dos
      // estados se rompió. Es la lección del `it` que cargaba tres oráculos y nombraba uno.
      //
      // Se siembra con claves internas REALES (`custId`/`subId`) a propósito: el estado
      // bloqueado no tenía ninguna, y lo más que podía exhibir una fuga del `key` era el
      // string `"null"` (React coacciona: `key = '' + config.key`). Eso no es un oráculo.
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("bloq"),
        stripeSubscriptionId: subId("bloq"),
      });
      await seedExtraLocation(seed.business.id, "Sucursal Sur");
      useBusiness(seed);
      expectCrossesExactly(
        await SubscriptionPage({ searchParams: Promise.resolve({}) }),
        SubscriptionConsole,
        {
          subscription: plusMensual,
          offers: subscriptionOffers(plusMensual),
          facts: { renewalAt: null, lastPaidInvoice: null },
          activeLocations: 2,
          canCancel: false,
          downgradeBlock: {
            message:
              "Para volver a Free necesitas 1 local activo; hoy tienes 2. Archiva 1.",
            // Spec 0065, fase D: lo que cruza es el `code`, no el conteo — el modal usa el
            // `code` para elegir a dónde manda y el conteo ya viaja dentro del mensaje.
            code: "downgrade_blocked",
          },
          stripeUnconfirmed: true,
          timezone: "America/Guayaquil",
          notice: null,
        },
      );
    }, 60_000);

    it("con los datos del cobro poblados, el customer id y el subscription id SIGUEN sin cruzar", async () => {
      // ÍTEM DEL DoD de la fase B. Es el estado que los otros dos `it` NO recorren: ahí
      // `facts` sale en `null` porque el fake no tiene nada, así que las ramas que LEEN
      // Stripe —y por lo tanto las que podrían arrastrar una llave— quedaban sin aseverar.
      // Es la lección de la 6ª preimagen del ADR 0062: un oráculo que mira un solo estado no
      // cubre las ramas que en ese estado salen nulas.
      const customer = custId("facts");
      const subscription = subId("facts");
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: customer,
        stripeSubscriptionId: subscription,
      });
      useBusiness(seed);
      // El 1 de diciembre de 2026 a las 12:00 UTC, en unix SECONDS: si alguien sacara el
      // `* 1000` de `fromUnixSeconds`, la fecha cae en 1970 y este `toEqual` lo dice.
      const renewal = Math.floor(Date.UTC(2026, 11, 1, 12) / 1000);
      fake.subscriptions.set(
        subscription,
        stripeSubscription({
          id: subscription,
          customer,
          items: [{ priceId: "price_plus_monthly" }],
        }),
      );
      // `current_period_end` vive en el ITEM, no en la suscripción (ver `derive-rules.ts`).
      const seeded = fake.subscriptions.get(subscription);
      if (seeded) seeded.items.data[0].current_period_end = renewal;
      // DOS facturas, y la que gana NO es la primera de la lista: `readBillingFacts` elige
      // por `created` MÁXIMO y no por posición.
      fake.invoices = [
        stripeInvoice({
          created: renewal - 60 * 60 * 24 * 60,
          amountPaid: 100,
          hostedInvoiceUrl: "https://stripe.test/recibo-viejo",
        }),
        stripeInvoice({
          created: renewal - 60 * 60 * 24 * 30,
          amountPaid: 2000,
          currency: "usd",
          hostedInvoiceUrl: "https://stripe.test/recibo-ultimo",
        }),
      ];

      const element = await SubscriptionPage({
        searchParams: Promise.resolve({}),
      });
      expectCrossesExactly(element, SubscriptionConsole, {
        subscription: plusMensual,
        offers: subscriptionOffers(plusMensual),
        facts: {
          renewalAt: "2026-12-01T12:00:00.000Z",
          lastPaidInvoice: {
            amountPaid: 2000,
            currency: "usd",
            receiptUrl: "https://stripe.test/recibo-ultimo",
          },
        },
        activeLocations: 1,
        canCancel: true,
        downgradeBlock: null,
        // `fake.list` sigue vacío (`subscriptions.list` es lo que mira D8), así que la
        // reconciliación no confirma. Poblar `retrieve` no la afecta.
        stripeUnconfirmed: true,
        timezone: "America/Guayaquil",
        notice: null,
      });

      // EL QUE HACE EL TRABAJO ES EL `toEqual` EXACTO DE ARRIBA: si una llave cruzara en
      // cualquier prop, el conjunto ya no sería igual. Esto de acá NO agrega cobertura y se
      // etiqueta como lo que es —un mensaje de error— : con el `toEqual` pelado, el rojo es
      // un diff de nueve props y hay que leerlo entero para ver que lo que se filtró es un
      // `cus_`. Un guard por substring tiene preimagen por transformación (ADR 0062: un
      // `cus_…` en base64 la pasa entera), así que no se apoya ninguna conclusión acá.
      const crossed = JSON.stringify(
        structuredClone((element as { props: unknown }).props),
      );
      expect(crossed).not.toContain(customer);
      expect(crossed).not.toContain(subscription);
      // Piso: el JSON que se acaba de revisar NO está vacío ni es un error.
      expect(crossed).toContain("recibo-ultimo");
    }, 60_000);
  },
);
