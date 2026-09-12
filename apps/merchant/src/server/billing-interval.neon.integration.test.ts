import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  MONTHLY_PRICE,
  YEARLY_PRICE,
  billingRequest,
  dropWebhookEvents,
  livePlusState,
  readSubscriptionRow,
  subId,
} from "./billing-integration-support";
import { PERIOD_END_SECONDS } from "./billing-derive-support";
import { fakeStripe, type FakeStripe } from "./billing-stripe-fake";
import {
  deliver,
  eventIdRegistry,
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness, type Seed } from "./counter-integration-support";
import {
  integrationEnabled,
  type SeededSubscription,
} from "./locations-integration-support";

/**
 * Spec 0063, D9 — EL CAMBIO DE INTERVALO contra Postgres de verdad. Archivo propio y no un
 * bloque de `billing.neon.integration.test.ts`: D9 es su propia sección de diseño, con sus
 * propios modos de falla (402 por tarjeta rechazada, 409 `interval_ambiguous`, 409
 * `interval_downgrade_unsupported`) y es el único consumidor de `updateError`/`updateParams`
 * del fake. El corte lo decidió el orquestador, por naturaleza y no por tamaño.
 *
 * Lo que se asevera de Stripe son los PARAMS que se le pidieron, no lo que el fake devolvió;
 * y lo que se asevera de la fila se lee por SQL (ADR 0054).
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };
const events = eventIdRegistry();

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

import { POST as INTERVAL } from "../app/api/billing/interval/route";

const post = (handler: (r: NextRequest) => Promise<Response>, body: unknown) =>
  handler(billingRequest(body));

async function withSeed(
  state: SeededSubscription,
  body: (seed: Seed) => Promise<void>,
): Promise<void> {
  const seed = await seedBillingBusiness("plus", state);
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
  "api/billing/interval against Neon (spec 0063, D9)",
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

    afterAll(async () => {
      await dropWebhookEvents(events.ids);
    }, 30_000);

    it("`interval` con la tarjeta rechazada: 402 y NADA aplicado", async () => {
      await withSeed(livePlus("tarjeta"), async (seed) => {
        fake.cardDeclined = true;
        const response = await post(INTERVAL, { to: "year" });
        expect(response.status).toBe(402);
        expect(await response.json()).toMatchObject({ code: "payment_failed" });
        // `error_if_incomplete` es lo que evita que el price quede aplicado con la factura
        // abierta y la fila mintiendo (M17).
        expect(fake.updateParams[0]).toMatchObject({
          payment_behavior: "error_if_incomplete",
          proration_behavior: "always_invoice",
        });
        const sub = fake.subscriptions.get(subId("tarjeta"))!;
        expect(sub.items.data[0].price.id).toBe(MONTHLY_PRICE);
        expect(sub.status).toBe("active");
        expect((await readSubscriptionRow(seed.business.id)).interval).toBe(
          "month",
        );
      });

      // S17 — `isCardError` mira `type` Y `rawType`, y la rama `rawType` era INALCANZABLE por
      // la suite: el único rechazo que se construía era un `StripeCardError` de verdad, que
      // trae `type`. Un error PLANO con `rawType: "card_error"` —lo que llega si el SDK cambia
      // de forma o si el error cruzó otra copia del módulo— tiene que seguir dando 402.
      await withSeed(livePlus("rawcard"), async (seed) => {
        fake.updateError = Object.assign(new Error("Your card was declined."), {
          rawType: "card_error",
        });
        const response = await post(INTERVAL, { to: "year" });
        expect(response.status).toBe(402);
        expect(await response.json()).toMatchObject({ code: "payment_failed" });
        expect((await readSubscriptionRow(seed.business.id)).interval).toBe(
          "month",
        );
      });
    }, 60_000);

    it("`interval`: mensual → anual cambia el price; ambiguo y anual → mensual no tocan nada", async () => {
      // Tag único por corrida: los ids de Stripe son uniques GLOBALES y vitest paraleliza
      // archivos (un literal compartido revienta con un `23505` EN EL SEED).
      const tag = `anual${randomUUID().slice(0, 8)}`;
      await withSeed(livePlus(tag), async (seed) => {
        expect((await post(INTERVAL, { to: "year" })).status).toBe(200);
        expect(fake.subscriptions.get(subId(tag))!.items.data[0].price.id).toBe(
          YEARLY_PRICE,
        );
        // El `interval` de la fila lo escribe el WEBHOOK, no la ruta (D9.6): así no hay dos
        // escritores del mismo campo y la fila nunca afirma un intervalo que Stripe no
        // confirmó. Recién cuando llega el evento, la fila dice `year`.
        expect((await readSubscriptionRow(seed.business.id)).interval).toBe(
          "month",
        );
        fake.subscriptions.get(subId(tag))!.metadata = {
          businessId: seed.business.id,
        };
        await deliver({
          id: events.next("interval"),
          type: "customer.subscription.updated",
          object: { id: subId(tag) },
        });
        expect((await readSubscriptionRow(seed.business.id)).interval).toBe(
          "year",
        );
        expect((await post(INTERVAL, { to: "month" })).status).toBe(409);
        expect(fake.updateParams).toHaveLength(1);
        // S16 — la clave lleva el `current_period_end` del item que matcheó: con una clave
        // FIJA, un segundo cambio dentro de las 24 h se comería la respuesta cacheada de
        // Stripe y el price no se aplicaría nunca.
        expect(fake.updateKeys.at(-1)).toBe(
          `billing:interval:${subId(tag)}:year:${PERIOD_END_SECONDS}`,
        );
      });

      const items = [{ priceId: MONTHLY_PRICE }, { priceId: YEARLY_PRICE }];
      await withSeed(livePlus("ambiguo", items), async () => {
        const response = await post(INTERVAL, { to: "year" });
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          code: "interval_ambiguous",
        });
        // Lo leyó y NO lo tocó. (Se filtra: el fake es el mismo en los dos bloques.)
        expect(fake.calls.filter((c) => c.endsWith(subId("ambiguo")))).toEqual([
          `subscriptions.retrieve:${subId("ambiguo")}`,
        ]);
      });

      // LA 3.ª CONDICIÓN de `interval_ambiguous`, que el docblock de `soleOurItem` enumera y
      // que hasta acá NADIE pinneaba (mutación MUT-I): con `items.has_more === true` la lista
      // viene TRUNCADA, así que el item nuestro podría ni estar en `data` y elegir sobre lo
      // que se ve sería escribir un price a ciegas. No es un camino vivo hoy —exige más de 10
      // items en una suscripción de un solo plan— pero el guard existe, así que tiene oráculo.
      const truncada = `truncada${randomUUID().slice(0, 8)}`;
      await withSeed(livePlus(truncada), async () => {
        fake.subscriptions.get(subId(truncada))!.items.has_more = true;
        const response = await post(INTERVAL, { to: "year" });
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
          code: "interval_ambiguous",
        });
        expect(fake.calls.filter((c) => c.endsWith(subId(truncada)))).toEqual([
          `subscriptions.retrieve:${subId(truncada)}`,
        ]);
      });
    }, 60_000);
  },
);
