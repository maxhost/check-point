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
  cancelStepUnderLock,
  custId,
  dropWebhookEvents,
  fakeStripe,
  readSubscriptionRow,
  stripeSubscription,
  subId,
  type FakeStripe,
} from "./billing-integration-support";
import {
  deliver,
  eventIdRegistry,
  seedBillingBusiness,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { clearPendingPlan, reconcileFromStripe } from "./billing";
import { dropBusiness } from "./counter-integration-support";
import { withDbTransaction } from "@mi-pasaporte/db";
import { integrationEnabled } from "./locations-integration-support";

/**
 * Spec 0063 D6/D8 + spec 0189 §D7 — `billing/store.ts` contra Postgres de verdad: lo que el unit
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

/** Residual R2 de la D1: los ids salen de `subId`/`custId` (sufijo único por módulo y corrida)
 * y NO de literales. Los uniques de Stripe son GLOBALES y vitest paraleliza ARCHIVOS, así que
 * un literal compartido revienta con un `23505` EN EL SEED, indistinguible de un bug. */

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

    it("`scheduleCancel` CONSERVA `downgrade_requested_at` entre pedidos repetidos", async () => {
      // El `coalesce`: la marca de auditoría dice CUÁNDO pidió el owner la primera vez. Un
      // `resume` la limpia, y la cancelación siguiente estrena marca.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: subId("idem"),
        stripeCustomerId: custId("idem"),
      });
      try {
        await cancelStepUnderLock(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 11)),
        );
        await cancelStepUnderLock(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 12)),
        );
        const row = await readSubscriptionRow(seeded.business.id);
        expect(row.pendingPlan).toBe("none");
        expect(row.downgradeRequestedAt).toEqual(
          new Date(Date.UTC(2026, 8, 11)),
        );

        await withDbTransaction((tx) =>
          clearPendingPlan(tx, seeded.business.id),
        );
        await cancelStepUnderLock(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 13)),
        );
        expect(
          (await readSubscriptionRow(seeded.business.id)).downgradeRequestedAt,
        ).toEqual(new Date(Date.UTC(2026, 8, 13)));
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("`scheduleCancel` y `clearPendingPlan` escriben SÓLO la fila de su negocio", async () => {
      // El `where` por `businessId`, que el doble del unit no puede ver.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: subId("mio"),
        stripeCustomerId: custId("mio"),
      });
      const otro = await seedBillingBusiness("plus", {
        stripeSubscriptionId: subId("del_otro"),
        stripeCustomerId: custId("del_otro"),
        pendingPlan: "none",
        downgradeRequestedAt: new Date(Date.UTC(2026, 8, 1)),
      });
      try {
        await cancelStepUnderLock(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 11)),
        );
        await withDbTransaction((tx) =>
          clearPendingPlan(tx, seeded.business.id),
        );
        const vecino = await readSubscriptionRow(otro.business.id);
        expect([vecino.pendingPlan, vecino.downgradeRequestedAt]).toEqual([
          "none",
          new Date(Date.UTC(2026, 8, 1)),
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
        stripeCustomerId: custId("vacio"),
        stripeSubscriptionId: subId("vieja"),
        interval: "month",
      });
      try {
        const before = await readSubscriptionRow(seeded.business.id);
        const outcome = await reconcileFromStripe(fake.gateway, {
          businessId: seeded.business.id,
          stripeCustomerId: custId("vacio"),
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
      // El caso motivador de D8: el webhook se perdió el evento, la DB dice `trial` sin id y
      // Stripe tiene una suscripción viva — con esa divergencia, `checkout` crearía una SEGUNDA
      // suscripción viva (doble cobro).
      const seeded = await seedBillingBusiness("trial", {
        stripeCustomerId: custId("deriva"),
      });
      try {
        fake.list = [
          // La más reciente, pero MUERTA: no se elige.
          stripeSubscription({
            id: subId("muerta_reciente"),
            status: "canceled",
            customer: custId("deriva"),
            created: Math.floor(Date.UTC(2026, 8, 9) / 1000),
            items: [{ priceId: MONTHLY_PRICE }],
          }),
          stripeSubscription({
            id: subId("viva_reconciliada"),
            status: "active",
            customer: custId("deriva"),
            created: Math.floor(Date.UTC(2026, 8, 5) / 1000),
            items: [{ priceId: YEARLY_PRICE }],
          }),
        ];
        const outcome = await reconcileFromStripe(fake.gateway, {
          businessId: seeded.business.id,
          stripeCustomerId: custId("deriva"),
          priceIds: PRICE_IDS,
        });
        expect(outcome).toEqual({ reconciled: true });
        const row = await readSubscriptionRow(seeded.business.id);
        expect([row.plan, row.interval, row.stripeSubscriptionId]).toEqual([
          "plus",
          "year",
          subId("viva_reconciliada"),
        ]);
        // La reconciliación NO mueve el guard de orden: si lo adelantara a `now`, un evento
        // legítimo posterior con `created` anterior quedaría `stale_event` y se perdería.
        expect(row.lastEventAt).toBeNull();
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("un `cancel` concurrente con el webhook NO pierde ninguna de las dos escrituras", async () => {
      // MUTACIÓN M4, y el motivo REAL del `lockBusiness` del webhook ([R2-B4]): el
      // READ-MODIFY-WRITE de `core.subscription`. Sin el lock, el `deleted` escribe ANTES de que
      // el `cancel` commitee y el `cancel` deja después `pending_plan='none'` sobre una
      // suscripción MUERTA (una cancelación «programada» de algo que ya terminó). El entrelazado
      // se fuerza a mano: el `cancel` toma el lock y retiene el commit; el webhook espera.
      const seeded = await seedBillingBusiness("plus", {
        stripeSubscriptionId: subId("carrera"),
        stripeCustomerId: custId("carrera"),
        interval: "month",
      });
      try {
        fake.subscriptions.set(
          subId("carrera"),
          stripeSubscription({
            id: subId("carrera"),
            status: "canceled",
            customer: custId("carrera"),
            businessId: seeded.business.id,
            cancelAtPeriodEnd: true,
          }),
        );
        let release = () => {};
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const cancel = cancelStepUnderLock(
          seeded.business.id,
          new Date(Date.UTC(2026, 8, 11)),
          gate,
        );
        // El webhook arranca con el lock ya tomado por el `cancel`.
        const webhook = deliver({
          id: events.next("carrera"),
          type: "customer.subscription.deleted",
          object: { id: subId("carrera") },
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
        release();
        await cancel;
        expect((await webhook).status).toBe(200);

        const row = await readSubscriptionRow(seeded.business.id);
        // El webhook escribió DESPUÉS del `cancel`: plan pago muerto → `none`, sin pendiente.
        expect(row.plan).toBe("none");
        expect(row.status).toBe("canceled");
        expect(row.pendingPlan).toBeNull();
        expect(row.downgradeRequestedAt).toBeNull();
      } finally {
        await dropBusiness(seeded.business.id);
      }
    }, 90_000);
  },
);
