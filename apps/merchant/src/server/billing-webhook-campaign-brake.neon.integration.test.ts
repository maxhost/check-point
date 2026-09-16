import { eq } from "drizzle-orm";
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
import { seedCampaign, seedLocation } from "./marketing-integration-support";
import { getDb } from "./db";
import { campaigns } from "./schema";

/**
 * Spec 0065, fase D — EL FRENO DEFENSIVO, contra Postgres.
 *
 * El bloqueo duro de la baja vive en NUESTRA ruta; este es el camino que la ruta no ve —
 * una cancelación desde el dashboard de Stripe, o un impago que termina en `deleted`. El
 * DoD pide dos cosas y acá está cada una:
 *
 *  1. que las campañas `active` del negocio queden `paused` / `plan_downgraded`;
 *  2. que sea ATÓMICO, verificado **inyectando un fallo** en ese `update` y aseverando que
 *     el PLAN tampoco quedó escrito. La mutación alternativa —mover el `update` fuera de la
 *     transacción— NO muerde: el estado final es idéntico y el test queda verde con la
 *     atomicidad violada (está escrito así en el plan de pruebas de la spec).
 *
 * El fallo se inyecta envolviendo `pauseCampaignsForDowngrade`, no doblándola: el camino
 * feliz sigue corriendo la función REAL, así que el mismo archivo prueba la escritura y el
 * rollback sin dos implementaciones distintas.
 */

const world = vi.hoisted(() => ({ failPause: false }));

vi.mock("./marketing/plan-brake", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./marketing/plan-brake")>();
  return {
    ...actual,
    pauseCampaignsForDowngrade: async (
      ...args: Parameters<typeof actual.pauseCampaignsForDowngrade>
    ) => {
      if (world.failPause) throw new Error("fallo inyectado en la pausa");
      return actual.pauseCampaignsForDowngrade(...args);
    },
  };
});

let fake: FakeStripe = fakeStripe();

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

const events = eventIdRegistry();

/** Un negocio `plus` con suscripción viva y N campañas `active`. */
async function worldWithCampaigns(tag: string, count: number) {
  const seeded = await seedBillingBusiness("plus", {
    stripeSubscriptionId: `sub_${tag}`,
    stripeCustomerId: `cus_${tag}`,
    interval: "month",
  });
  const locationId = await seedLocation({ businessId: seeded.business.id });
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    ids.push(
      await seedCampaign({
        businessId: seeded.business.id,
        createdByUserId: seeded.userId,
        locationIds: [locationId],
        name: `Campaña ${i + 1}`,
        status: "active",
      }),
    );
  }
  fake.subscriptions.set(
    `sub_${tag}`,
    stripeSubscription({
      id: `sub_${tag}`,
      status: "canceled",
      customer: `cus_${tag}`,
      businessId: seeded.business.id,
      cancelAtPeriodEnd: true,
    }),
  );
  return { seeded, ids };
}

/** Lee `status` y `pause_reason` por SQL: la respuesta HTTP no es el oráculo. */
async function readCampaigns(ids: string[]) {
  const rows = await getDb()
    .select({
      id: campaigns.id,
      status: campaigns.status,
      pauseReason: campaigns.pauseReason,
    })
    .from(campaigns);
  return rows
    .filter((row) => ids.includes(row.id))
    .map(({ status, pauseReason }) => ({ status, pauseReason }));
}

describe.skipIf(!integrationEnabled)(
  "webhook — el freno defensivo de campañas (spec 0065, fase D)",
  () => {
    beforeEach(() => {
      fake = fakeStripe();
      world.failPause = false;
      for (const [name, value] of stripeEnvEntries()) vi.stubEnv(name, value);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    afterAll(async () => {
      await dropWebhookEvents(events.ids);
    }, 30_000);

    it("un plan que aterriza en `none` sin pasar por nuestra ruta pausa LAS DOS campañas", async () => {
      const { seeded, ids } = await worldWithCampaigns("brake", 2);
      try {
        const response = await deliver({
          id: events.next("brake"),
          created: Math.floor(Date.UTC(2026, 8, 12) / 1000),
          type: "customer.subscription.deleted",
          object: { id: "sub_brake" },
        });
        expect(response.status).toBe(200);

        // El plan bajó (es la precondición: sin esto el test pasaría por no haber pasado nada).
        expect((await readSubscriptionRow(seeded.business.id)).plan).toBe(
          "none",
        );
        expect(await readCampaigns(ids)).toEqual([
          { status: "paused", pauseReason: "plan_downgraded" },
          { status: "paused", pauseReason: "plan_downgraded" },
        ]);
      } finally {
        await getDb()
          .delete(campaigns)
          .where(eq(campaigns.businessId, seeded.business.id));
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("pausa SÓLO las campañas del negocio que bajó, no las del vecino", async () => {
      // EL `where` POR NEGOCIO NO TENÍA ORÁCULO (revisión independiente de la fase D): el
      // doble de `tx` implementa `where: () => chain`, o sea que no registra nada, y el
      // caso feliz de acá arriba lee por sus PROPIOS ids — un freno que pausara las
      // campañas de todos los negocios salía verde en los dos.
      const mine = await worldWithCampaigns("scoped", 1);
      const neighbour = await worldWithCampaigns("neighbour", 1);
      try {
        const response = await deliver({
          id: events.next("scoped"),
          created: Math.floor(Date.UTC(2026, 8, 12) / 1000),
          type: "customer.subscription.deleted",
          object: { id: "sub_scoped" },
        });
        expect(response.status).toBe(200);

        expect(await readCampaigns(mine.ids)).toEqual([
          { status: "paused", pauseReason: "plan_downgraded" },
        ]);
        // El vecino no se enteró: mismo tick de webhook, otra suscripción.
        expect(await readCampaigns(neighbour.ids)).toEqual([
          { status: "active", pauseReason: null },
        ]);
      } finally {
        for (const world of [mine, neighbour]) {
          await getDb()
            .delete(campaigns)
            .where(eq(campaigns.businessId, world.seeded.business.id));
          await dropBusiness(world.seeded.business.id);
        }
      }
    }, 60_000);

    it("si la pausa falla, EL PLAN TAMPOCO QUEDA ESCRITO (la transacción es una sola)", async () => {
      const { seeded, ids } = await worldWithCampaigns("atomic", 1);
      try {
        world.failPause = true;
        const response = await deliver({
          id: events.next("atomic"),
          created: Math.floor(Date.UTC(2026, 8, 12) / 1000),
          type: "customer.subscription.deleted",
          object: { id: "sub_atomic" },
        });
        // La ruta contesta 5xx y Stripe reintenta: el evento queda sin procesar.
        expect(response.status).toBeGreaterThanOrEqual(500);

        const row = await readSubscriptionRow(seeded.business.id);
        expect(row.plan).toBe("plus");
        expect(row.status).toBe("active");
        expect(await readCampaigns(ids)).toEqual([
          { status: "active", pauseReason: null },
        ]);
      } finally {
        world.failPause = false;
        await getDb()
          .delete(campaigns)
          .where(eq(campaigns.businessId, seeded.business.id));
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);
  },
);
