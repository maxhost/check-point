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
  deliver,
  eventIdRegistry,
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { dropBusiness } from "./counter-integration-support";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D5.c-h — LO QUE EL WEBHOOK ESCRIBE sobre `core.subscription`, por SQL. Sibling de
 * `billing-webhook.neon.integration.test.ts` (claim y allow-list) por el límite de 300 líneas.
 *
 * Acá están el bloqueante R2-1 y el CABLEADO de los guards de m1 / m1-b: los units pinnean la
 * decisión, estos tests pinnean que el webhook la CONSULTE antes de escribir — el hueco que
 * `choosePushPromptView` dejó en la tarea 38.
 */

let fake: FakeStripe = fakeStripe();

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

const events = eventIdRegistry();
const AJENO = "price_de_otra_cuenta";

describe.skipIf(!integrationEnabled)(
  "stripe webhook — qué escribe (spec 0063)",
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

    it("una cancelación hecha desde el DASHBOARD termina en `none`, no en `free`", async () => {
      // EL BLOQUEANTE R2-1, por SQL. Stripe setea `cancel_at_period_end` igual que nuestra
      // ruta, así que `pending_plan` NO sirve de discriminante: lo que decide es
      // `downgrade_requested_at`, que sólo escribe nuestro código y acá está en NULL.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: "sub_dash",
        stripeCustomerId: "cus_dash",
        interval: "month",
      });
      try {
        fake.subscriptions.set(
          "sub_dash",
          stripeSubscription({
            id: "sub_dash",
            status: "canceled",
            customer: "cus_dash",
            businessId: seeded.business.id,
            cancelAtPeriodEnd: true,
          }),
        );
        const created = Math.floor(Date.UTC(2026, 8, 12) / 1000);
        const response = await deliver({
          id: events.next("dashboard"),
          created,
          type: "customer.subscription.deleted",
          object: { id: "sub_dash" },
        });
        expect(response.status).toBe(200);
        const row = await readSubscriptionRow(seeded.business.id);
        expect(row.plan).toBe("none");
        expect(row.status).toBe("canceled");
        // La rama 1 de la jerarquía es INCONDICIONAL: en un `deleted`
        // `cancel_at_period_end` sigue en `true` («will … or DID cancel»), y sin ella la fila
        // quedaba `plan='free'` Y `pending_plan='free'` a la vez, con la UI ofreciendo
        // un botón «Reanudar» (que existía entonces) sobre una suscripción muerta.
        expect(row.pendingPlan).toBeNull();
        expect(row.pendingPlanAt).toBeNull();
        expect(row.lastEventAt).toEqual(new Date(created * 1000));
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("un `deleted` CON `downgrade_requested_at` deja `free` y limpia la marca", async () => {
      // La otra mitad del par: el owner que canceló bien no termina en `none`.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: "sub_ok",
        stripeCustomerId: "cus_ok",
        interval: "month",
        pendingPlan: "free",
        pendingPlanAt: new Date(Date.UTC(2026, 9, 1)),
        downgradeRequestedAt: new Date(Date.UTC(2026, 8, 11)),
      });
      try {
        fake.subscriptions.set(
          "sub_ok",
          stripeSubscription({
            id: "sub_ok",
            status: "canceled",
            customer: "cus_ok",
            businessId: seeded.business.id,
            cancelAtPeriodEnd: true,
          }),
        );
        await deliver({
          id: events.next("deleted_ok"),
          type: "customer.subscription.deleted",
          object: { id: "sub_ok" },
        });
        const row = await readSubscriptionRow(seeded.business.id);
        expect(row.plan).toBe("free");
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("[m1] una fila ADOPTABLE no acepta un `deleted` AJENO con price ajeno", async () => {
      // EL CASO DE A1 EN PROD: `plus` sin `stripe_subscription_id`. Sin el guard de adopción,
      // la precedencia «lo terminal gana» escribía `plan='none'` — un negocio VIVO apagado
      // por un evento que nunca fue suyo. Mutación M18.
      const seeded = await seedBillingBusiness("plus", {
        stripeCustomerId: "cus_a1",
        stripeSubscriptionId: null,
        interval: null,
      });
      try {
        fake.subscriptions.set(
          "sub_ajena",
          stripeSubscription({
            id: "sub_ajena",
            status: "canceled",
            customer: "cus_a1",
            businessId: seeded.business.id,
            items: [{ priceId: AJENO }],
          }),
        );
        const id = events.next("m1_ajeno");
        const response = await deliver({
          id,
          type: "customer.subscription.deleted",
          object: { id: "sub_ajena" },
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
          received: true,
          ignored: "not_adoptable",
        });
        const event = await readWebhookEvent(id);
        const row = await readSubscriptionRow(seeded.business.id);
        expect(event.ignoredReason).toBe("not_adoptable");
        // NADA se tocó: ni el plan, ni el status, ni el id, ni el guard de orden.
        expect([row.plan, row.status, row.stripeSubscriptionId]).toEqual([
          "plus",
          "active",
          null,
        ]);
        expect(row.lastEventAt).toBeNull();
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("[m1] la misma fila SÍ adopta una suscripción nuestra y viva", async () => {
      // La mitad positiva, que es lo que hace que el guard no sea «no adoptar nunca»: price
      // nuestro + status vivo, y con `updated` (no `created`) — el tipo de evento es un
      // disparador, no un hecho.
      const seeded = await seedBillingBusiness("plus", {
        stripeCustomerId: "cus_a1b",
        stripeSubscriptionId: null,
        interval: null,
      });
      try {
        fake.subscriptions.set(
          "sub_nuestra",
          stripeSubscription({
            id: "sub_nuestra",
            status: "active",
            customer: "cus_a1b",
            businessId: seeded.business.id,
            items: [{ priceId: MONTHLY_PRICE }],
          }),
        );
        await deliver({
          id: events.next("m1_propio"),
          type: "customer.subscription.updated",
          object: { id: "sub_nuestra" },
        });
        const row = await readSubscriptionRow(seeded.business.id);
        expect([row.plan, row.interval, row.stripeSubscriptionId]).toEqual([
          "plus",
          "month",
          "sub_nuestra",
        ]);
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);
  },
);
