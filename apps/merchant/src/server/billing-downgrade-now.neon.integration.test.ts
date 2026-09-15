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
  archiveLocation,
  billingRequest,
  custId,
  dropWebhookEvents,
  readSubscriptionRow,
  readWebhookEvent,
  seedLiveSubscription,
  subId,
} from "./billing-integration-support";
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
  seedExtraLocation,
} from "./locations-integration-support";

/**
 * Spec 0064, A-T4 — LA SECUENCIA COMPLETA: upgrade → baja → estado resultante → qué puede
 * hacer el merchant, aseverado POR SQL.
 *
 * ESTE ARCHIVO EXISTE POR UNA RAZÓN ESCRITA ANTES DE IMPLEMENTAR (spec 0064, §Riesgo
 * conocido): la clase de defecto que originó la spec NO LA CAZA UNA MUTACIÓN. No había ningún
 * invariante roto — cada regla cumplía su contrato y la COMPOSICIÓN era incoherente: el
 * merchant pagaba Plus hasta el 13 de octubre y desde el minuto cero sólo podía tener 1 local.
 * Los tests estaban todos en verde. Lo único que caza eso es recorrer la secuencia y aseverar
 * que LO QUE SE COBRA Y LO QUE SE PUEDE USAR COINCIDEN.
 *
 * Y LAS DOS CARRERAS DEL WEBHOOK CONTRA EL PASO 4, que son lo que hace viable la baja
 * inmediata (anexo, premisas verificadas):
 *  - el `deleted` que llega ANTES del paso 4 → `free`, NUNCA `none` (la marca del paso 2 es el
 *    discriminante del ADR 0060);
 *  - el `deleted` que llega DESPUÉS → IGNORADO por `not_adoptable`, la fila no se ensucia.
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };

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

import { POST as CANCEL } from "../app/api/billing/cancel/route";
import { POST as CHECKOUT } from "../app/api/billing/checkout/route";

const events = eventIdRegistry();

const post = (
  handler: (r: NextRequest) => Promise<Response>,
  body: unknown = {},
) => handler(billingRequest(body));

/** Un negocio `free` con su local, el owner resuelto a él, y limpieza garantizada. */
async function withBusiness(
  prefix: string,
  body: (seed: Seed, tag: string) => Promise<void>,
): Promise<void> {
  const tag = `${prefix}${randomUUID().slice(0, 8)}`;
  const seed = await seedBillingBusiness("free");
  world.businessId = seed.business.id;
  try {
    await body(seed, tag);
  } finally {
    await dropBusiness(seed.business.id);
  }
}

describe.skipIf(!integrationEnabled)(
  "la baja inmediata, de punta a punta (spec 0064, A-T4)",
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

    it("upgrade → 3 locales → baja: queda `free` con Stripe cancelado, y el tope cae a 1", async () => {
      await withBusiness("seq", async (seed, tag) => {
        // ——— 1. UPGRADE. El Checkout persiste el customer; el plan lo otorga el webhook.
        fake.nextCustomerId = custId(tag);
        expect((await post(CHECKOUT, { interval: "month" })).status).toBe(200);
        seedLiveSubscription(fake, seed.business.id, tag);
        expect(
          (
            await deliver({
              id: events.next("seq_alta"),
              type: "customer.subscription.created",
              object: { id: subId(tag) },
            })
          ).status,
        ).toBe(200);

        const conPlus = await readSubscriptionRow(seed.business.id);
        expect([
          conPlus.plan,
          conPlus.interval,
          conPlus.status,
          conPlus.stripeSubscriptionId,
        ]).toEqual(["plus", "month", "active", subId(tag)]);

        // ——— 2. LO QUE PUEDE USAR con Plus: tres locales activos.
        const segunda = await seedExtraLocation(seed.business.id, "Sucursal 2");
        const tercera = await seedExtraLocation(seed.business.id, "Sucursal 3");

        // ——— 3. LA BAJA con 3 activos está bloqueada, y no toca Stripe.
        const bloqueada = await post(CANCEL);
        expect(bloqueada.status).toBe(409);
        expect(await bloqueada.json()).toMatchObject({
          code: "downgrade_blocked",
          archiveCount: 2,
        });
        expect(fake.calls).not.toContain(`subscriptions.cancel:${subId(tag)}`);

        // ——— 4. Archiva y baja: INMEDIATA.
        await archiveLocation(segunda);
        await archiveLocation(tercera);
        expect((await post(CANCEL)).status).toBe(200);

        // LO QUE SE PUEDE USAR: la fila dice `free`, sin suscripción, y sin ninguna baja
        // pendiente colgada. El `stripe_customer_id` SE CONSERVA (es la llave de D8).
        const despues = await readSubscriptionRow(seed.business.id);
        expect([
          despues.plan,
          despues.status,
          despues.interval,
          despues.stripeSubscriptionId,
          despues.pendingPlan,
          despues.pendingPlanAt,
          despues.downgradeRequestedAt,
          despues.stripeCustomerId,
        ]).toEqual([
          "free",
          "active",
          null,
          null,
          null,
          null,
          null,
          custId(tag),
        ]);

        // LO QUE SE COBRA: la suscripción está MUERTA en Stripe, en el mismo instante. Es la
        // aserción que la spec pide y que ninguna mutación habría encontrado: antes de la 0064
        // esta línea decía `active` con la fila diciendo «tu plan baja el 13/10».
        expect(fake.subscriptions.get(subId(tag))!.status).toBe("canceled");
        expect(fake.cancelParams).toEqual([undefined]);

        // ——— 5. QUÉ PUEDE HACER AHORA. Reactivar el 2.º local es 409: el tope de `free` es 1
        // y ya lo usa el original.
        const { setLocationStatus } = await import("./locations");
        await expect(
          setLocationStatus(seed.business, segunda, "active"),
        ).rejects.toMatchObject({ status: 409, code: "location_limit" });

        // Y NO queda atrapado: con el id limpio, volver a Plus procede.
        expect((await post(CHECKOUT, { interval: "month" })).status).toBe(200);
      });
    }, 90_000);

    /**
     * CARRERA 1 — el `deleted` ANTES del paso 4. Es el motivo (b) de O-4: sin la marca del
     * paso 2, este evento ve `plan='plus'` + `downgradeRequestedAt=null` y aterriza en `none`
     * —el estado que BLOQUEA el backoffice— por haber cancelado bien.
     */
    it("un `deleted` que llega ANTES del paso 4 aterriza en `free`, nunca en `none`", async () => {
      await withBusiness("antes", async (seed, tag) => {
        await seedBillingPlus(seed, tag);
        let duranteStripe: string | null = null;
        fake.beforeCancel = async () => {
          // Stripe ya la mató; el evento sale en el mismo instante que nuestra llamada.
          fake.subscriptions.get(subId(tag))!.status = "canceled";
          await deliver({
            id: events.next("carrera_antes"),
            type: "customer.subscription.deleted",
            object: { id: subId(tag) },
          });
          duranteStripe = (await readSubscriptionRow(seed.business.id)).plan;
        };

        expect((await post(CANCEL)).status).toBe(200);
        // EL PUNTO DEL TEST: en la ventana, el webhook ya escribió `free` — NO `none`.
        expect(duranteStripe).toBe("free");
        const row = await readSubscriptionRow(seed.business.id);
        expect([row.plan, row.status, row.stripeSubscriptionId]).toEqual([
          "free",
          "active",
          null,
        ]);
      });
    }, 90_000);

    /**
     * CARRERA 2 — el `deleted` DESPUÉS del paso 4. `settleToFree` dejó
     * `stripe_subscription_id=null`, así que la fila es ADOPTABLE; el guard de adopción (m1)
     * la salva: la suscripción recuperada está `canceled` ∈ `DEAD_STRIPE_STATUS`, y un evento
     * puede CREAR o CONFIRMAR una adopción, nunca TERMINARLA.
     */
    it("un `deleted` que llega DESPUÉS del paso 4 se IGNORA y no ensucia la fila", async () => {
      await withBusiness("despues", async (seed, tag) => {
        await seedBillingPlus(seed, tag);
        expect((await post(CANCEL)).status).toBe(200);
        const antes = await readSubscriptionRow(seed.business.id);

        const id = events.next("carrera_despues");
        const response = await deliver({
          id,
          type: "customer.subscription.deleted",
          object: { id: subId(tag) },
        });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
          received: true,
          ignored: "not_adoptable",
        });
        expect((await readWebhookEvent(id)).ignoredReason).toBe(
          "not_adoptable",
        );

        // LA FILA NO SE ENSUCIÓ. El observable que distingue «ignorado» de «aplicado» es el
        // `status`: aplicarlo lo habría puesto en `canceled` y habría repuesto el sub id.
        const row = await readSubscriptionRow(seed.business.id);
        expect([row.plan, row.status, row.stripeSubscriptionId]).toEqual([
          "free",
          "active",
          null,
        ]);
        // [R2-M3] UN EVENTO IGNORADO NO MUEVE `last_event_at`: si lo moviera, el guard de
        // orden podría tapar un evento legítimo posterior con `created` menor. No es `null` —
        // el alta de este mismo negocio ya lo escribió— sino EL MISMO de antes.
        expect(row.lastEventAt).toEqual(antes.lastEventAt);
      });
    }, 90_000);
  },
);

/** Deja el negocio en `plus` con una suscripción viva, por el webhook real: sembrar la fila a
 * mano y la suscripción en el fake por separado es cómo las dos mitades se desincronizan. */
async function seedBillingPlus(seed: Seed, tag: string): Promise<void> {
  fake.nextCustomerId = custId(tag);
  expect((await post(CHECKOUT, { interval: "month" })).status).toBe(200);
  seedLiveSubscription(fake, seed.business.id, tag);
  await deliver({
    id: events.next(`alta_${tag}`),
    type: "customer.subscription.created",
    object: { id: subId(tag) },
  });
  expect((await readSubscriptionRow(seed.business.id)).plan).toBe("plus");
}
