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
  dropWebhookEvents,
  fakeStripe,
  readSubscriptionRow,
  stripeSession,
  type FakeStripe,
} from "./billing-integration-support";
import {
  deliver,
  eventIdRegistry,
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D5.a + m1-b — EL BINDING DE `checkout.session.completed`, contra Neon.
 *
 * Archivo propio (y no dentro de `billing-webhook-writes.neon.integration.test.ts`) por el
 * límite de 300 líneas del repo: ese archivo llegó al tope con el bloqueante R2-1 y los dos
 * casos de m1. Es además otro guard — `canBindSubscriptionId`, no `assessEventApplicability`—
 * porque acá no hay una `Subscription` recuperada que mirar: el único dato es el id que trae
 * la sesión.
 */

let fake: FakeStripe = fakeStripe();

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

const events = eventIdRegistry();

describe.skipIf(!integrationEnabled)(
  "stripe webhook — binding de la sesión (spec 0063, m1-b)",
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

    it("[m1-b] un `checkout.session.completed` tardío NO repunta una suscripción VIVA", async () => {
      // Una sesión vieja que se completa tarde dejaría la fila apuntando a otra suscripción,
      // no a la que está facturando. Mutación M19.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: "sub_viva",
        stripeCustomerId: "cus_viva",
        interval: "month",
      });
      try {
        fake.sessions.set(
          "cs_tardia",
          stripeSession({
            id: "cs_tardia",
            businessId: seeded.business.id,
            subscriptionId: "sub_de_la_sesion_vieja",
            customer: "cus_otro",
          }),
        );
        const id = events.next("m1b_tardia");
        const response = await deliver({
          id,
          type: "checkout.session.completed",
          object: { id: "cs_tardia" },
        });
        expect(response.status).toBe(200);
        // LA FILA PRIMERO: es la propiedad del título («no repunta»). Con el cuerpo aseverado
        // antes, su rojo taparía el de la fila y M19 quedaría atribuida a la RESPUESTA.
        const row = await readSubscriptionRow(seeded.business.id);
        expect([row.stripeSubscriptionId, row.stripeCustomerId]).toEqual([
          "sub_viva",
          "cus_viva",
        ]);
        await expect(response.json()).resolves.toEqual({
          received: true,
          ignored: "foreign_subscription",
        });
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("[m1-b] sobre una fila adoptable el binding escribe los ids y NO el plan", async () => {
      // Una sesión puede completarse con `payment_status: 'unpaid'`: el plan lo otorga el
      // evento de suscripción, nunca este camino.
      const seeded = await seedBillingBusiness("free");
      try {
        fake.sessions.set(
          "cs_nueva",
          stripeSession({
            id: "cs_nueva",
            businessId: seeded.business.id,
            subscriptionId: "sub_recien_creada",
            customer: "cus_nuevo",
          }),
        );
        await deliver({
          id: events.next("m1b_ok"),
          type: "checkout.session.completed",
          object: { id: "cs_nueva" },
        });
        const row = await readSubscriptionRow(seeded.business.id);
        const bound = [
          row.stripeSubscriptionId,
          row.stripeCustomerId,
          row.plan,
        ];
        expect(bound).toEqual(["sub_recien_creada", "cus_nuevo", "free"]);
        // Y este camino no mueve el guard de orden: `checkout.session.completed` y
        // `customer.subscription.created` llegan casi juntos y sin orden garantizado entre sus
        // `created`, así que moverlo dejaría al segundo como `stale_event` y sin plan.
        expect(row.lastEventAt).toBeNull();
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);
  },
);
