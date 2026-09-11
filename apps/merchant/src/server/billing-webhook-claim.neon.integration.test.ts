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
import { LEASE_WINDOW_SECONDS } from "./billing";
import {
  ageEventRow,
  deliver,
  eventIdRegistry,
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D12 (ADR 0061) — LOS TRES RESULTADOS DEL CLAIM, contra Neon y por la RUTA REAL.
 *
 * Archivo propio porque `billing-webhook.neon.integration.test.ts` está en 260 líneas y este
 * bloque no entra bajo el límite de 300 (hook `file-size`: dividir, no extender). Reusa su
 * preámbulo desde `billing-webhook-support.ts`.
 *
 * LA PROPIEDAD QUE ESTE ARCHIVO EXISTE PARA PINNEAR, y que no es «el claim funciona»: un 2xx
 * le promete a Stripe que el evento está terminado y lo hace dejar de reintentar, así que
 * retirarse porque OTRO lo tiene tomado no puede contestar 2xx. Si el caso `in_flight`
 * devolviera 200, un evento cuya primera entrega murió no se procesaría NUNCA — el bug del
 * §Problema-4 — y el lease sería PEOR que no haber hecho nada (sin lease las dos entregas
 * escriben y el estado final queda correcto, porque el `UPDATE` es idempotente).
 *
 * El oráculo es siempre el status HTTP más la fila leída por SQL, nunca sólo el cuerpo.
 *
 * LO QUE ESTOS TESTS NO PUEDEN VER (declarado, no escondido): que Stripe efectivamente deje
 * de reintentar ante un 2xx y sí reintente ante un 409. Es la semántica documentada de sus
 * webhooks y es de lo que cuelga D12 entero, pero ningún oráculo de nuestro árbol observa la
 * decisión de reintentar de Stripe. Lo que sí se pinnea acá —y es la parte bajo nuestro
 * control, la que una mutación puede romper— es EL STATUS QUE DEVOLVEMOS en cada uno de los
 * tres casos.
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
  "stripe webhook — los tres resultados del claim (spec 0063, D12)",
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

    it("dos entregas SOLAPADAS: una sola gana el claim, la otra recibe 409 y NO llama a Stripe", async () => {
      // Mutaciones M20 y M23. El observable NO es el estado final: el efecto de un evento es
      // un `UPDATE` idempotente, así que aplicarlo dos veces deja la misma fila y un test de
      // estado final quedaría VERDE sin el lease. Lo que se asevera es el PAR DE STATUS
      // (200 + 409) y que hubo UN SOLO `retrieve` contra Stripe.
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_solape",
      });
      try {
        fake.subscriptions.set(
          "sub_solape",
          stripeSubscription({
            id: "sub_solape",
            status: "active",
            customer: "cus_solape",
            businessId: seeded.business.id,
            items: [{ priceId: MONTHLY_PRICE }],
          }),
        );
        const spec = {
          id: events.next("solape"),
          type: "customer.subscription.created",
          object: { id: "sub_solape" },
        };
        const responses = await Promise.all([deliver(spec), deliver(spec)]);
        // EL ORDEN DE ESTAS DOS ASEVERACIONES ES DELIBERADO, Y ES LO QUE LAS HACE ATRIBUIR
        // BIEN. Corridas al revés, M20 (sacar el lease del `setWhere`) y M21 (contestar 2xx
        // en `in_flight`) dan EL MISMO rojo con la MISMA aserción literal, y desde afuera son
        // indistinguibles — un rojo que no dice qué propiedad se rompió. El contador del fake
        // sí las separa: sin lease las DOS entregas ganan el claim y llaman a Stripe (2
        // `retrieve`), mientras que con el lease puesto y el status mal sigue habiendo UNO.
        expect(fake.calls).toEqual(["subscriptions.retrieve:sub_solape"]);
        const statuses = responses.map((response) => response.status).sort();
        expect(statuses).toEqual([200, 409]);
        const rejected = responses.find(
          (response) => response.status === 409,
        ) as Response;
        await expect(rejected.text()).resolves.toBe("Evento en proceso.");
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

    it("un evento cuya primera entrega MURIÓ: el reintento DENTRO de la ventana recibe 409, nunca un 2xx", async () => {
      // EL TEST MÁS IMPORTANTE DE LA FASE (mutación M21). La primera entrega gana el claim y
      // muere en el `retrieve` (500): queda fila con `processed_at IS NULL` y `received_at`
      // recién puesto. Si el reintento in-window contestara 200 `{duplicate:true}`, Stripe
      // daría el evento por entregado y NO LO MANDARÍA NUNCA MÁS: el evento se perdería.
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_muerta",
      });
      try {
        fake.subscriptions.set(
          "sub_muerta",
          stripeSubscription({
            id: "sub_muerta",
            status: "active",
            customer: "cus_muerta",
            businessId: seeded.business.id,
            items: [{ priceId: MONTHLY_PRICE }],
          }),
        );
        fake.retrieveError = new Error("la lambda se cortó");
        const spec = {
          id: events.next("muerta"),
          type: "customer.subscription.created",
          object: { id: "sub_muerta" },
        };
        expect((await deliver(spec)).status).toBe(500);
        expect((await readWebhookEvent(spec.id)).processedAt).toBeNull();

        fake.retrieveError = null;
        const inWindow = await deliver(spec);
        expect(inWindow.status).toBe(409);
        await expect(inWindow.text()).resolves.toBe("Evento en proceso.");
        // Y el 409 no es un 2xx disfrazado: el evento sigue SIN procesar y nada se escribió.
        expect((await readWebhookEvent(spec.id)).processedAt).toBeNull();
        expect((await readSubscriptionRow(seeded.business.id)).plan).toBe(
          "free",
        );
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("el reintento FUERA de la ventana gana el claim y procesa el evento", async () => {
      // La otra mitad de M21/M23: el lease VENCE. Sin esto, «nunca dar el claim» pasaría el
      // test de arriba y el evento quedaría clavado hasta que Stripe se rinda y desactive el
      // endpoint. La fila se envejece por SQL (D12.f), que es el estado real de un evento
      // viejo.
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_vencido",
      });
      try {
        fake.subscriptions.set(
          "sub_vencido",
          stripeSubscription({
            id: "sub_vencido",
            status: "active",
            customer: "cus_vencido",
            businessId: seeded.business.id,
            items: [{ priceId: MONTHLY_PRICE }],
          }),
        );
        fake.retrieveError = new Error("la lambda se cortó");
        const spec = {
          id: events.next("vencido"),
          type: "customer.subscription.created",
          object: { id: "sub_vencido" },
        };
        expect((await deliver(spec)).status).toBe(500);
        expect((await readWebhookEvent(spec.id)).processedAt).toBeNull();

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
          "sub_vencido",
        ]);
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("una reentrega de un evento YA PROCESADO sigue contestando 200 `{duplicate:true}`", async () => {
      // Mutación M22: el lease NO puede cambiar este status. Un 409 acá dejaría a Stripe
      // reintentando para siempre un evento que ya terminó, hasta desactivar el endpoint —
      // el espejo del riesgo que D5.a documenta para `resource_missing`.
      //
      // Se envejece la fila a propósito ANTES de la reentrega: así el único predicado que
      // puede rechazar el claim es `processed_at IS NULL`, y el 200 no puede venir «de
      // rebote» por el lease. Sin esto, este test quedaría verde aunque el clasificador
      // confundiera los dos motivos de rechazo.
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_reentrega",
      });
      try {
        fake.subscriptions.set(
          "sub_reentrega",
          stripeSubscription({
            id: "sub_reentrega",
            status: "active",
            customer: "cus_reentrega",
            businessId: seeded.business.id,
            items: [{ priceId: MONTHLY_PRICE }],
          }),
        );
        const spec = {
          id: events.next("reentrega"),
          type: "customer.subscription.created",
          object: { id: "sub_reentrega" },
        };
        expect((await deliver(spec)).status).toBe(200);
        await ageEventRow(spec.id, LEASE_WINDOW_SECONDS * 2);

        const second = await deliver(spec);
        expect(second.status).toBe(200);
        await expect(second.json()).resolves.toEqual({
          received: true,
          duplicate: true,
        });
        expect(fake.calls).toEqual(["subscriptions.retrieve:sub_reentrega"]);
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);
  },
);
