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
  PRICE_IDS,
  YEARLY_PRICE,
  dropWebhookEvents,
  fakeStripe,
  readSubscriptionRow,
  stripeSubscription,
  type FakeStripe,
} from "./billing-integration-support";
import {
  deliver,
  eventIdRegistry,
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import {
  clearPendingPlan,
  readSubscription,
  reconcileFromStripe,
  scheduleDowngrade,
  settleToFree,
} from "./billing";
import { dropBusiness } from "./counter-integration-support";
import { withDbTransaction } from "./db";
import { lockBusiness } from "./locations/shared";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063, D6 / D8 / D10 — `billing/store.ts` contra Postgres de verdad: lo que el unit
 * (`billing-store.test.ts`) NO puede cubrir con su doble del `tx`. El `coalesce` que conserva
 * la marca, el `where` por `businessId`, la reconciliación completa (abre su propia
 * transacción) y la CARRERA contra el webhook, oráculo de la mutación M4.
 */

let fake: FakeStripe = fakeStripe();

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

const events = eventIdRegistry();

/**
 * OJO: `core_subscription_stripe_unique` es un unique GLOBAL y vitest corre los ARCHIVOS en
 * paralelo: dos con el mismo literal chocan con un `23505` que PARECE un bug del producto —
 * pasó con `sub_viva`, que este archivo escribe al reconciliar y el de `-writes` siembra.
 */

/** El paso 1-2 del `cancel` de D6 (lock, leer, escribir la intención): los mismos statements de
 * la ruta de la fase C. Se invoca directo porque la propiedad es del store, no del HTTP. */
async function cancelStep(businessId: string, now: Date, gate?: Promise<void>) {
  return withDbTransaction(async (tx) => {
    await lockBusiness(tx, businessId);
    await readSubscription(tx, businessId);
    const result = await scheduleDowngrade(tx, businessId, { now });
    if (gate) await gate;
    return result;
  });
}

describe.skipIf(!integrationEnabled)(
  "billing store against Neon (spec 0063)",
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

    it("`scheduleDowngrade` CONSERVA `downgrade_requested_at` entre pedidos repetidos", async () => {
      // De esto cuelga la `idempotencyKey` de D6
      // (`billing:cancel:${id}:${downgradeRequestedAt}`): el segundo `cancel` tiene que reusar
      // la MISMA clave para que Stripe reconozca el reintento — es el camino de reparación. Con
      // una asignación en vez del `coalesce`, cada reintento estrenaría clave.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: "sub_idem",
        stripeCustomerId: "cus_idem",
      });
      try {
        const first = await cancelStep(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 11)),
        );
        const second = await cancelStep(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 12)),
        );
        expect(second.downgradeRequestedAt).toEqual(first.downgradeRequestedAt);
        const row = await readSubscriptionRow(seeded.business.id);
        expect(row.pendingPlan).toBe("free");
        expect(row.downgradeRequestedAt).toEqual(
          new Date(Date.UTC(2026, 8, 11)),
        );

        // `cancel → resume → cancel`: `resume` limpia la marca, así que la tercera cancelación
        // SÍ estrena clave y por lo tanto SÍ llega a Stripe (ítem del DoD).
        await withDbTransaction((tx) =>
          clearPendingPlan(tx, seeded.business.id),
        );
        const third = await cancelStep(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 13)),
        );
        expect(third.downgradeRequestedAt).toEqual(
          new Date(Date.UTC(2026, 8, 13)),
        );
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("`settleToFree` escribe el `SET` de D10 y CONSERVA el customer", async () => {
      // Si dejara el `stripe_subscription_id` puesto, `hasLiveSubscription` sería true y el
      // negocio recibiría `subscription_live` 409 PARA SIEMPRE. Y si borrara el customer, D8 se
      // quedaría sin llave para detectar deriva.
      const seeded = await seedBillingBusiness("none", {
        status: "canceled",
        interval: "month",
        stripeSubscriptionId: "sub_muerta",
        stripeCustomerId: "cus_conservado",
        pendingPlan: "free",
        downgradeRequestedAt: new Date(Date.UTC(2026, 8, 11)),
      });
      const otro = await seedBillingBusiness("plus", {
        stripeSubscriptionId: "sub_del_otro",
        stripeCustomerId: "cus_del_otro",
      });
      try {
        await withDbTransaction((tx) => settleToFree(tx, seeded.business.id));
        const row = await readSubscriptionRow(seeded.business.id);
        expect([row.plan, row.status, row.interval]).toEqual([
          "free",
          "active",
          null,
        ]);
        expect(row.stripeSubscriptionId).toBeNull();
        expect(row.stripeCustomerId).toBe("cus_conservado");
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
        // El `where` por `businessId`, que el doble del unit no puede ver: el otro negocio
        // quedó intacto.
        const vecino = await readSubscriptionRow(otro.business.id);
        expect([vecino.plan, vecino.stripeSubscriptionId]).toEqual([
          "plus",
          "sub_del_otro",
        ]);
      } finally {
        await dropBusiness(seeded.business.id);
        await dropBusiness(otro.business.id);
      }
    }, 60_000);

    it("`reconcileFromStripe` con la lista VACÍA no escribe NADA", async () => {
      // Mutación M16. Vacío con `status:"all"` significa «este customer nunca tuvo suscripción»,
      // que no alcanza para degradar un plan desde el render de una página.
      const seeded = await seedBillingBusiness("plus", {
        stripeCustomerId: "cus_vacio",
        stripeSubscriptionId: "sub_vieja",
        interval: "month",
      });
      try {
        const before = await readSubscriptionRow(seeded.business.id);
        const outcome = await reconcileFromStripe(fake.gateway, {
          businessId: seeded.business.id,
          stripeCustomerId: "cus_vacio",
          priceIds: PRICE_IDS,
        });
        // LA FILA PRIMERO: es la propiedad que da nombre al test. Con el `outcome` antes, su
        // rojo TAPA el de la fila y M16 queda atribuida al valor de retorno, no a la escritura.
        expect(await readSubscriptionRow(seeded.business.id)).toEqual(before);
        expect(outcome).toEqual({
          reconciled: false,
          reason: "no_subscriptions",
        });
        expect(fake.calls).toEqual(["subscriptions.list"]);
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("`reconcileFromStripe` arregla una fila divergente y elige la NO MUERTA más reciente", async () => {
      // El caso motivador de D8: el webhook se perdió el evento, la DB dice `free` sin id y
      // Stripe tiene una suscripción viva — con esa divergencia, `checkout` crearía una SEGUNDA
      // suscripción viva (doble cobro).
      const seeded = await seedBillingBusiness("free", {
        stripeCustomerId: "cus_deriva",
      });
      try {
        fake.list = [
          // La más reciente, pero MUERTA: no se elige.
          stripeSubscription({
            id: "sub_muerta_reciente",
            status: "canceled",
            customer: "cus_deriva",
            created: Math.floor(Date.UTC(2026, 8, 9) / 1000),
            items: [{ priceId: MONTHLY_PRICE }],
          }),
          stripeSubscription({
            id: "sub_viva_reconciliada",
            status: "active",
            customer: "cus_deriva",
            created: Math.floor(Date.UTC(2026, 8, 5) / 1000),
            items: [{ priceId: YEARLY_PRICE }],
          }),
        ];
        const outcome = await reconcileFromStripe(fake.gateway, {
          businessId: seeded.business.id,
          stripeCustomerId: "cus_deriva",
          priceIds: PRICE_IDS,
        });
        expect(outcome).toEqual({ reconciled: true });
        const row = await readSubscriptionRow(seeded.business.id);
        expect([row.plan, row.interval, row.stripeSubscriptionId]).toEqual([
          "plus",
          "year",
          "sub_viva_reconciliada",
        ]);
        // La reconciliación NO mueve el guard de orden: si lo adelantara a `now`, un evento
        // legítimo posterior con `created` anterior quedaría `stale_event` y se perdería.
        expect(row.lastEventAt).toBeNull();
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("un `cancel` concurrente con el webhook NO pierde ninguna de las dos escrituras", async () => {
      // MUTACIÓN M4, y el motivo REAL del `lockBusiness` del webhook ([R2-B4]): no es el tope de
      // locales (el lock serializa, no ordena) sino el READ-MODIFY-WRITE de `core.subscription`.
      // `planFromSubscription` decide `free` vs `none` leyendo `downgrade_requested_at` DE LA
      // FILA; sin el lock, el webhook lee ANTES de que el `cancel` commitee, ve NULL, y escribe
      // `plan='none'` además de LIMPIAR la marca — la baja que el owner sí pidió se pierde. El
      // entrelazado se fuerza a mano para que sea determinista: el `cancel` toma el lock y
      // retiene el commit; el webhook llega después y tiene que esperarlo.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: "sub_carrera",
        stripeCustomerId: "cus_carrera",
        interval: "month",
      });
      try {
        fake.subscriptions.set(
          "sub_carrera",
          stripeSubscription({
            id: "sub_carrera",
            status: "canceled",
            customer: "cus_carrera",
            businessId: seeded.business.id,
            cancelAtPeriodEnd: true,
          }),
        );
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const cancel = cancelStep(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 11)),
          gate,
        );
        // El webhook arranca con el lock ya tomado por el `cancel`.
        const webhook = deliver({
          id: events.next("carrera"),
          type: "customer.subscription.deleted",
          object: { id: "sub_carrera" },
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        release();
        await cancel;
        expect((await webhook).status).toBe(200);

        const row = await readSubscriptionRow(seeded.business.id);
        // El webhook vio la marca del `cancel`: la baja fue NUESTRA, así que `free` y no `none`.
        expect(row.plan).toBe("free");
        expect(row.status).toBe("canceled");
        expect(row.pendingPlan).toBeNull();
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 90_000);
  },
);
