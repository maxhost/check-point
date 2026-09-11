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
  dropWebhookEvents,
  fakeStripe,
  readSubscriptionRow,
  readWebhookEvent,
  stripeSubscription,
  type FakeStripe,
} from "./billing-integration-support";
import {
  ageEventRow,
  deliver,
  eventIdRegistry,
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { LEASE_WINDOW_SECONDS } from "./billing";
import { dropBusiness } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D5.a-b/g — EL CLAIM, LA ALLOW-LIST Y LA DIAGNOSTICABILIDAD, contra Neon y por la
 * RUTA REAL.
 *
 * Firma verdadera (`generateTestHeaderString`), claim verdadero, transacciones verdaderas. Lo
 * único fakeado es el RECURSO de Stripe: el doble de `stripe-config` conserva `webhooks` real
 * y reemplaza `subscriptions` / `checkout`, así que la red no se toca y la verificación de
 * firma SÍ corre.
 *
 * Lo que el webhook ESCRIBE sobre `core.subscription` vive en el sibling
 * `billing-webhook-writes.neon.integration.test.ts` (límite de 300 líneas).
 *
 * El oráculo es siempre la fila leída por SQL, nunca la respuesta de la ruta (ADR 0054).
 */

let fake: FakeStripe = fakeStripe();

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  // `import()` dinámico y no un import estático: el factory de `vi.mock` se hoistea arriba de
  // los imports del archivo, así que una referencia estática podría evaluarse sin inicializar.
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

const events = eventIdRegistry();

describe.skipIf(!integrationEnabled)(
  "stripe webhook — claim y allow-list (spec 0063)",
  () => {
    beforeEach(() => {
      fake = fakeStripe();
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    afterAll(async () => {
      await dropWebhookEvents(events.ids);
    }, 30_000);

    it("un tipo fuera de la allow-list queda procesado con motivo y SIN llamar a Stripe", async () => {
      // `invoice.paid` ya está en la base de prod, y su `id` es un `in_…`: pasárselo a
      // `subscriptions.retrieve` tira `resource_missing` → con el claim después, Stripe
      // reintentaría para siempre. El oráculo de «sin llamar» es el contador del fake.
      const id = events.next("invoice");
      const response = await deliver({
        id,
        type: "invoice.paid",
        object: { id: "in_123" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        received: true,
        ignored: "event_type_not_handled",
      });
      const row = await readWebhookEvent(id);
      expect(row.processedAt).not.toBeNull();
      expect(row.ignoredReason).toBe("event_type_not_handled");
      expect(fake.calls).toEqual([]);
    }, 30_000);

    it("una firma que no corresponde da 400 y NO deja fila", async () => {
      // Es el único camino sin rastro, y es correcto: no sabemos si el request era de Stripe.
      // Este caso es además el que prueba que los 400 no llegan por la CONFIGURACIÓN: acá las
      // 5 env están bien puestas y lo único mal es el secreto con el que se firmó.
      const id = events.next("badsig");
      const response = await deliver(
        { id, type: "customer.subscription.updated", object: { id: "sub_x" } },
        "whsec_otro_secreto",
      );
      expect(response.status).toBe(400);
      await expect(response.text()).resolves.toBe("Firma inválida.");
      expect(await readWebhookEvent(id)).toBeUndefined();
      expect(fake.calls).toEqual([]);
    }, 30_000);

    it("un `retrieve` que falla deja la fila SIN procesar, y el reintento la procesa", async () => {
      // La señal de diagnóstico de D11: se distingue «Stripe nunca entregó» (no hay fila) de
      // «lo tomamos y falló» (fila con `processed_at IS NULL`) de «lo ignoramos a propósito»
      // (`ignored_reason`). Y el reintento NO contesta `{duplicate:true}`, que es el bug del
      // §Problema-4: la versión vieja marcaba el evento recibido ANTES de procesarlo.
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_retry",
      });
      try {
        fake.subscriptions.set(
          "sub_retry",
          stripeSubscription({
            id: "sub_retry",
            status: "active",
            customer: "cus_retry",
            businessId: seeded.business.id,
            items: [{ priceId: MONTHLY_PRICE }],
          }),
        );
        fake.retrieveError = new Error("Stripe no responde");
        const spec = {
          id: events.next("retry"),
          type: "customer.subscription.created",
          object: { id: "sub_retry" },
        };
        const failed = await deliver(spec);
        expect(failed.status).toBe(500);
        expect((await readWebhookEvent(spec.id)).processedAt).toBeNull();
        expect((await readSubscriptionRow(seeded.business.id)).plan).toBe(
          "free",
        );

        // [fase C, D12] El reintento va FUERA de la ventana del lease. La PROPIEDAD que este
        // test pinnea no cambia —un `retrieve` fallido deja la fila sin procesar y el
        // reintento la procesa, que es el bug del §Problema-4—, pero desde el lease el
        // reintento INMEDIATO recibe 409 en vez de procesar: D12.e lo declara como el unico
        // costo que queda (se DEMORA, no se pierde). Envejecer la fila es exactamente lo que
        // el paso del tiempo hace en prod.
        fake.retrieveError = null;
        await ageEventRow(spec.id, LEASE_WINDOW_SECONDS * 2);
        const retried = await deliver(spec);
        expect(retried.status).toBe(200);
        await expect(retried.json()).resolves.toEqual({ received: true });
        expect((await readWebhookEvent(spec.id)).processedAt).not.toBeNull();
        const row = await readSubscriptionRow(seeded.business.id);
        expect([row.plan, row.interval, row.stripeSubscriptionId]).toEqual([
          "plus",
          "month",
          "sub_retry",
        ]);
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("reentregar un evento YA PROCESADO contesta `{duplicate:true}` y no lo vuelve a aplicar", async () => {
      // EL OBSERVABLE DEL CLAIM (mutaciones M3 y M7, que lo comparten). NO es el estado final:
      // el efecto de un evento es un `UPDATE` idempotente, así que aplicarlo dos veces deja
      // exactamente la misma fila y un test del estado final quedaría VERDE con el guard
      // roto. Lo que se asevera es que la segunda entrega NO GANA EL CLAIM, y que por lo
      // tanto no vuelve a pedirle nada a Stripe.
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_dup",
      });
      try {
        fake.subscriptions.set(
          "sub_dup",
          stripeSubscription({
            id: "sub_dup",
            status: "active",
            customer: "cus_dup",
            businessId: seeded.business.id,
          }),
        );
        const spec = {
          id: events.next("dup"),
          type: "customer.subscription.updated",
          object: { id: "sub_dup" },
        };
        await expect((await deliver(spec)).json()).resolves.toEqual({
          received: true,
        });
        const second = await deliver(spec);
        expect(second.status).toBe(200);
        await expect(second.json()).resolves.toEqual({
          received: true,
          duplicate: true,
        });
        expect(fake.calls).toEqual(["subscriptions.retrieve:sub_dup"]);
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("dos entregas SIMULTÁNEAS del mismo evento dejan UNA sola fila y el estado correcto", async () => {
      // [fase C, D12] ESTE COMENTARIO DECLARABA UN LÍMITE QUE YA NO EXISTE, y se reescribe
      // entero en vez de retocarle el número: decía que dos entregas solapadas «pueden ganar
      // las DOS el claim». Con el lease de D12 la segunda NO gana y recibe **409** — no un
      // 2xx, para que Stripe reintente (ADR 0061). El solape en sí, con su aserción de que
      // Stripe se llama UNA sola vez, lo pinnea `billing-webhook-claim.neon.integration.test.ts`
      // (mutaciones M20-M23); acá se conserva lo que este archivo aporta y aquél no: que el
      // estado FINAL del negocio queda correcto y la fila del evento es una sola.
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_race",
      });
      try {
        fake.subscriptions.set(
          "sub_race",
          stripeSubscription({
            id: "sub_race",
            status: "active",
            customer: "cus_race",
            businessId: seeded.business.id,
            items: [{ priceId: MONTHLY_PRICE }],
          }),
        );
        const spec = {
          id: events.next("simultaneo"),
          type: "customer.subscription.created",
          object: { id: "sub_race" },
        };
        const responses = await Promise.all([deliver(spec), deliver(spec)]);
        // `.sort()` y no el orden del `Promise.all`: CUÁL de las dos entregas gana el claim es
        // exactamente la carrera que este test nombra, así que aseverar `[200, 409]` posicional
        // haría que la propiedad («una gana, la otra se retira con 409») dependiera de quién
        // llegó primero. El test hermano de `billing-webhook-claim…` ya ordenaba.
        expect(responses.map((response) => response.status).sort()).toEqual([
          200, 409,
        ]);
        const row = await readWebhookEvent(spec.id);
        expect(row.processedAt).not.toBeNull();
        expect(row.ignoredReason).toBeNull();
        expect((await readSubscriptionRow(seeded.business.id)).plan).toBe(
          "plus",
        );
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("un evento cuyo negocio no se resuelve no escribe nada", async () => {
      // Sin metadata y con un customer que no está en ninguna fila. La versión vieja hacía
      // que esto NO HICIERA NADA EN SILENCIO; ahora queda el motivo escrito.
      const id = events.next("unknown");
      fake.subscriptions.set(
        "sub_huerfana",
        stripeSubscription({ id: "sub_huerfana", customer: "cus_inexistente" }),
      );
      const response = await deliver({
        id,
        type: "customer.subscription.updated",
        object: { id: "sub_huerfana" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        received: true,
        ignored: "unknown_business",
      });
      expect((await readWebhookEvent(id)).ignoredReason).toBe(
        "unknown_business",
      );
    }, 30_000);
  },
);
