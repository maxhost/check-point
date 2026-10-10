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
import { seedWelcomeCampaign } from "./marketing-welcome-support";
import { getDb } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";

/**
 * Spec 0065 fase D + spec 0189 §D4 — LAS CAMPAÑAS SIGUEN AL ACCESO EN EL ACTO, contra Postgres.
 *
 * Cuando el webhook escribe la fila y el negocio queda SIN acceso (suscripción muerta y la
 * prueba vencida), TODAS sus campañas `active` —Bienvenida incluida, ADR 0134 §7— quedan
 * `paused` / `billing_blocked`, en la MISMA transacción. Y es ATÓMICO, verificado **inyectando
 * un fallo** en la sincronización y aseverando que el PLAN tampoco quedó escrito.
 *
 * El fallo se inyecta envolviendo `syncCampaignsWithAccess` (lo que `billing/store.ts` llama),
 * no doblándola: el camino feliz sigue corriendo la función REAL.
 */

const world = vi.hoisted(() => ({ failPause: false }));

vi.mock("./marketing/plan-brake", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./marketing/plan-brake")>();
  return {
    ...actual,
    syncCampaignsWithAccess: async (
      ...args: Parameters<typeof actual.syncCampaignsWithAccess>
    ) => {
      if (world.failPause) throw new Error("fallo inyectado en la pausa");
      return actual.syncCampaignsWithAccess(...args);
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

/** Un negocio `plus` con suscripción viva, la prueba VENCIDA (salvo `trialEndsAt`) y N
 * campañas `active`. */
async function worldWithCampaigns(
  tag: string,
  count: number,
  trialEndsAt = new Date(Date.now() - 86_400_000),
) {
  const seeded = await seedBillingBusiness("plus", {
    stripeSubscriptionId: `sub_${tag}`,
    stripeCustomerId: `cus_${tag}`,
    interval: "month",
    trialEndsAt,
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
  "webhook — las campañas siguen al acceso (spec 0189 §D4)",
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

    it("una suscripción que muere con la prueba vencida pausa LAS DOS campañas con `billing_blocked`", async () => {
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
          { status: "paused", pauseReason: "billing_blocked" },
          { status: "paused", pauseReason: "billing_blocked" },
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
          { status: "paused", pauseReason: "billing_blocked" },
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

    it("ADR 0134 §7: sin acceso también se pausa la Bienvenida", async () => {
      const { seeded, ids } = await worldWithCampaigns("welcome", 1);
      const welcome = await seedWelcomeCampaign(seeded, {
        activatedAt: new Date("2026-09-01T12:00:00.000Z"),
      });
      try {
        const response = await deliver({
          id: events.next("welcome"),
          created: Math.floor(Date.UTC(2026, 8, 12) / 1000),
          type: "customer.subscription.deleted",
          object: { id: "sub_welcome" },
        });
        expect(response.status).toBe(200);
        expect((await readSubscriptionRow(seeded.business.id)).plan).toBe(
          "none",
        );
        expect(await readCampaigns([...ids, welcome])).toEqual([
          { status: "paused", pauseReason: "billing_blocked" },
          { status: "paused", pauseReason: "billing_blocked" },
        ]);
      } finally {
        await getDb()
          .delete(campaigns)
          .where(eq(campaigns.businessId, seeded.business.id));
        await dropBusiness(seeded.business.id);
      }
    }, 60_000);

    it("si la suscripción muere con la prueba VIGENTE, el negocio sigue con acceso y nada se pausa", async () => {
      const { seeded, ids } = await worldWithCampaigns(
        "vigente",
        1,
        new Date(Date.now() + 86_400_000),
      );
      try {
        const response = await deliver({
          id: events.next("vigente"),
          created: Math.floor(Date.UTC(2026, 8, 12) / 1000),
          type: "customer.subscription.deleted",
          object: { id: "sub_vigente" },
        });
        expect(response.status).toBe(200);
        expect((await readSubscriptionRow(seeded.business.id)).plan).toBe(
          "none",
        );
        expect(await readCampaigns(ids)).toEqual([
          { status: "active", pauseReason: null },
        ]);
      } finally {
        await getDb()
          .delete(campaigns)
          .where(eq(campaigns.businessId, seeded.business.id));
        await dropBusiness(seeded.business.id);
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
