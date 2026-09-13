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
    api: { getSession: async () => ({ user: { id: "usuario-de-prueba" } }) },
  }),
}));

vi.mock("./staff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./staff")>();
  const { staffDouble } = await import("./billing-pages-support");
  return staffDouble(actual);
});

import { renderToStaticMarkup } from "react-dom/server";
import { expectCrossesExactly, useBusiness } from "./billing-pages-support";
import { subscriptionOffers, type SubscriptionView } from "./billing";
import SubscriptionPage from "../app/backoffice/subscription/page";
import { SubscriptionConsole } from "../app/backoffice/subscription/subscription-console";
import BackofficePage from "../app/backoffice/page";

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

const renderHome = async () => renderToStaticMarkup(await BackofficePage());

/**
 * Spec 0063, D7 — EL HTML DE VERDAD. Precedente del esqueleto:
 * `locations-backoffice-pages.neon.integration.test.ts:113` (`renderToStaticMarkup(await
 * BackofficePage())`), y el `environment: "node"` del vitest de merchant alcanza sin instalar
 * nada.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE y no le alcanza al unit: `billing-view.test.ts` pinnea que el
 * DTO no trae las claves internas y `billing-offers.test.ts` que la tabla de D7 decide bien —
 * las DOS son decisiones. Que la PÁGINA use el DTO y respete la tabla es CABLEADO, y es el
 * hueco exacto que la tarea 38 pagó tres veces con guards sintácticos evadidos.
 *
 * Los 3 casos de D8 viven en `billing-reconcile-page.neon.integration.test.ts` (corte de
 * tamaño decidido por el orquestador antes de despachar).
 */
describe.skipIf(!integrationEnabled)(
  "las páginas de billing, renderizadas (spec 0063, D7)",
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

    it("el HTML de /backoffice/subscription NO emite ninguna clave interna", async () => {
      // ÍTEM DEL DoD y regla de `CLAUDE.md`: una ruta que devuelve una entidad al navegador
      // nunca serializa claves internas. Un revisor ya cazó esta fuga en marca (spec 0025).
      // Los tres valores se siembran RECONOCIBLES para buscarlos por substring.
      const requestedAt = new Date(Date.UTC(2026, 8, 11));
      seed = await seedBillingBusiness("plus", {
        interval: "month",
        stripeCustomerId: custId("fuga"),
        stripeSubscriptionId: subId("fuga"),
        pendingPlan: "free",
        pendingPlanAt: new Date(Date.UTC(2026, 11, 1)),
        downgradeRequestedAt: requestedAt,
      });
      useBusiness(seed);
      const html = await renderSubscription();

      expect(html).not.toContain(custId("fuga"));
      expect(html).not.toContain(subId("fuga"));
      expect(html).not.toContain("cus_");
      expect(html).not.toContain("sub_");
      expect(html).not.toContain(requestedAt.toISOString());
      // PISO DE LA ASERCIÓN: las cinco negativas de arriba no pasan por haber renderizado
      // una página vacía o un error. El estado sembrado es «baja programada CON fecha».
      expect(html).toContain("Suscripción");
      expect(html).toContain("Tu plan baja a Free el");
      expect(html).toContain("Reanudar suscripción");
      expect(html.length).toBeGreaterThan(800);
    }, 60_000);

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
          activeLocations: 2,
          canCancel: false,
          downgradeBlock: {
            message:
              "Para volver a Free necesitas 1 local activo; hoy tienes 2. Archiva 1.",
            archiveCount: 1,
          },
          stripeUnconfirmed: true,
          timezone: "America/Guayaquil",
          notice: null,
        },
      );
    }, 60_000);

    it("la home dice «Sin plan» para `none` y NUNCA «confirmando pago» para un free cancelado", async () => {
      // Los DOS ítems del DoD sobre la home, que son los dos ternarios que había:
      // `plan === "plus" ? "Plus" : "Free"` mostraba `none` como «Free».
      seed = await seedBillingBusiness("none", { status: "canceled" });
      useBusiness(seed, "Negocio sin plan");
      const sinPlan = await renderHome();
      expect(sinPlan).toContain("Sin plan");
      expect(sinPlan).not.toContain("Plan Free");
      // La tarjeta de entrada a la sección, y que NO cae al mock de la spec 0015.
      expect(sinPlan).toContain('href="/backoffice/subscription"');
      expect(sinPlan).not.toContain("/backoffice/demo/subscription");

      await dropBusiness(seed.business.id);
      seed = await seedBillingBusiness("free", { status: "canceled" });
      useBusiness(seed, "Negocio free cancelado");
      const freeCancelado = await renderHome();
      expect(freeCancelado).not.toContain("confirmando pago");
      expect(freeCancelado).toContain("cancelada");
    }, 90_000);

    it("el aviso de la query string sale por ALLOW-LIST: un `done` inventado no imprime nada", async () => {
      // OTRA MUTACIÓN QUE SALIÓ VERDE (S8) Y POR ESO ESTE TEST EXISTE: devolver
      // `params.done` crudo desde `noticeFor` dejaba los 67 tests en verde. El docblock de
      // esa función dice que la lista es una allow-list «porque es entrada del atacante», y
      // eso era un invariante declarado que nada pinneaba.
      seed = await seedBillingBusiness("free");
      useBusiness(seed);

      const inventado = await renderSubscription({
        done: "<script>x</script>",
      });
      expect(inventado).not.toContain("script>x");
      expect(inventado).not.toContain("&lt;script");
      // CONTROL POSITIVO, o sea lo que hace que la negativa de arriba discrimine: un valor
      // de la lista SÍ imprime su texto.
      const valido = await renderSubscription({ done: "cancel" });
      expect(valido).toContain("Programamos la baja a Free.");
      // Y el aterrizaje de Stripe Checkout, que es el otro consumidor de la lista.
      expect(await renderSubscription({ checkout: "success" })).toContain(
        "Recibimos tu pago",
      );
    }, 90_000);

    it("un `status` desconocido sale traducido y NUNCA crudo al HTML", async () => {
      // `Subscription.Status` termina en `| OtherString` y el endpoint de prod está pineado
      // seis años atrás: lo desconocido llega de verdad, y la columna guarda el status CRUDO.
      seed = await seedBillingBusiness("plus", {
        status: "quantum_paused",
        interval: "month",
      });
      useBusiness(seed);
      const html = await renderSubscription();
      expect(html).not.toContain("quantum_paused");
      expect(html).toContain("en revisión");
    }, 60_000);

    it("con 2 locales activos el botón de bajar NO se deshabilita", async () => {
      // ÍTEM DEL DoD y ADR 0058 §8, respuesta literal del owner («el usuario no sabría qué
      // debe hacer»): con `canCancel === false` el botón se renderiza IGUAL. Acá
      // `activeLocations = 2`, así que `decidePlanChange` bloquea y `canCancel` es false.
      //
      // SE ASEVERA EL TAG COMPLETO a propósito: es lo único que distingue «el botón está» de
      // «el botón está deshabilitado». Un `disabled={!canCancel}` en la consola —el reflejo
      // natural, y lo que el owner rechazó— rompe este string.
      seed = await seedBillingBusiness("plus", { interval: "month" });
      await seedExtraLocation(seed.business.id, "Sucursal Sur");
      useBusiness(seed);
      const html = await renderSubscription();

      expect(html).toContain(
        '<button class="archive-button" type="button">Bajar a Free</button>',
      );
      expect(html).toContain("2 locales activos");
      // LO QUE ESTE RENDER NO PUEDE VER, y no se disimula: el CONTENIDO del modal. Está
      // cerrado en la carga (`ConfirmDialog` devuelve `null` con `open=false`) y abrirlo
      // exige un click, que `renderToStaticMarkup` no hace. Medido, no supuesto: la primera
      // versión de este test aseveraba «hoy tienes 2» y salió ROJA por eso.
      // El modal SÍ tiene oráculo, en dos mitades y sin base ni paquetes nuevos
      // (`billing-offers.test.ts`): el CABLEADO —qué props le pasa la consola— con un doble
      // del módulo del modal, y su CONTENIDO renderizándolo con `open`.
      expect(html).not.toContain("hoy tienes 2");
    }, 60_000);
  },
);
