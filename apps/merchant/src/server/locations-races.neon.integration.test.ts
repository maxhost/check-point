import { randomUUID } from "node:crypto";
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
import { dropBusiness } from "./counter-integration-support";
import {
  activeLocationCountSql,
  integrationEnabled,
  liveVerificationCountSql,
  readLocationRow,
  readVerifications,
  seedExtraLocation,
  seedLocationsBusiness,
} from "./locations-integration-support";
import {
  billingRequest,
  custId,
  dropWebhookEvents,
  livePlusState,
  readSubscriptionRow,
  subId,
} from "./billing-integration-support";
import { fakeStripe, type FakeStripe } from "./billing-stripe-fake";
import {
  deliver,
  eventIdRegistry,
  stripeEnvEntries,
} from "./billing-webhook-support";
import { getDb } from "@mi-pasaporte/db";
import { locations } from "@mi-pasaporte/db/schema";
import { createLocation, setLocationStatus, updateLocation } from "./locations";

/**
 * Spec 0063 — las dos carreras que la fase D agrega. El negocio bajo prueba se resuelve por
 * `ownerContext` doblado; lo que NO va doblado es nada de lo que decide (el tope efectivo, el
 * claim del webhook y el store son los reales, contra Postgres).
 */
let fake: FakeStripe = fakeStripe();
const world = { businessId: "" };
const events = eventIdRegistry();

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: {
      // Spec 0072: el doble declara `emailVerified` porque `requireApiOwner` corre el
      // gate de email en las 10 superficies del owner. Edicion del DOBLE.
      getSession: async () => ({
        user: { id: "owner", emailVerified: true },
      }),
    },
  }),
}));

vi.mock("./staff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./staff")>()),
  // Spec 0072: `ownerContext` selecciona ademas el eje `status`, y `requireApiOwner` es
  // fail-closed — una fila sin `status` NO opera. Edicion del DOBLE, no de una asercion.
  ownerContext: async () =>
    world.businessId
      ? {
          id: world.businessId,
          slug: "int",
          currencyCode: "USD",
          status: "active",
          suspensionReason: null,
        }
      : null,
}));

vi.mock("./stripe-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stripe-config")>();
  const { stripeConfigDouble } = await import("./billing-integration-support");
  return stripeConfigDouble(actual, () => fake);
});

import { POST as CANCEL } from "../app/api/billing/cancel/route";

/**
 * Spec 0061 — the two invariants this domain claims to hold UNDER CONCURRENCY, each
 * asserted by reading the final state with SQL (ADR 0054 §4).
 *
 * They exist because `CLAUDE.md` forbids claiming «atomic/idempotent» from a code read:
 * `createLocation`'s cap and `updateLocation`'s supersede are both guards that a plain
 * pre-check evaluates once, before anybody blocks. The mutation results are transcribed
 * in the spec 0061 handoff.
 */
describe.skipIf(!integrationEnabled)(
  "locations under concurrency (spec 0061)",
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

    it("four simultaneous creates never walk a plus business past three active", async () => {
      const seed = await seedLocationsBusiness("Carrera", "plus");
      try {
        expect(await activeLocationCountSql(seed.business.id)).toBe(1);

        const attempts = await Promise.allSettled(
          ["A", "B", "C", "D"].map((tag) =>
            createLocation(seed.business, {
              name: `Sucursal ${tag}`,
              address: { label: `Calle ${tag} 1` },
            }),
          ),
        );
        const created = attempts.filter((a) => a.status === "fulfilled");
        const refused = attempts.filter((a) => a.status === "rejected");

        // Two slots were free (limit 3, one taken), so exactly two may win.
        expect(created).toHaveLength(2);
        expect(refused).toHaveLength(2);
        for (const attempt of refused) {
          expect((attempt as PromiseRejectedResult).reason).toMatchObject({
            status: 409,
            code: "location_limit",
          });
        }
        // The oracle is the table, not the count of resolved promises.
        expect(await activeLocationCountSql(seed.business.id)).toBe(3);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    it("two simultaneous address edits leave exactly one live verification", async () => {
      const seed = await seedLocationsBusiness("Mudanzas", "plus");
      try {
        expect(await liveVerificationCountSql(seed.locationId)).toBe(1);

        await Promise.all([
          updateLocation(seed.business, seed.locationId, {
            address: { label: "Calle Primera 1" },
          }),
          updateLocation(seed.business, seed.locationId, {
            address: { label: "Calle Segunda 2" },
          }),
        ]);

        // The invariant of the DoD: exactly ONE row with `superseded_at IS NULL`.
        expect(await liveVerificationCountSql(seed.locationId)).toBe(1);

        // …and it is the one the location points at, with the address the location shows.
        const all = await readVerifications(seed.locationId);
        expect(all).toHaveLength(3);
        const live = all.find((v) => v.supersededAt === null);
        const row = await readLocationRow(seed.locationId);
        expect(row.activeVerificationId).toBe(live?.id);
        expect(row.addressLabel).toBe(live?.normalizedAddress);
        // Nothing was destroyed: the seed's verification and the loser both survive.
        expect(all.filter((v) => v.supersededAt !== null)).toHaveLength(2);
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    /**
     * Spec 0063 D2 + spec 0189 §D2 — EL TOPE EFECTIVO BAJO CONCURRENCIA. Un negocio que paga
     * el plan BASE (1 local) recibe ocho desarchivados simultáneos: sin el tope leído bajo el
     * lock del negocio, caminarían el negocio a 3 activos.
     *
     * EL ORÁCULO ES EL `count`, NO «cero éxitos»: `setLocationStatus` tiene un early-return
     * idempotente (`locations/store.ts:59`) que devuelve ÉXITO sin cambiar el conteo, así que
     * contar promesas resueltas mediría otra cosa.
     */
    it("eight simultaneous reactivations on the BASE plan leave ONE active", async () => {
      // Los ids de Stripe son UNIQUE GLOBALES (`schema/business.ts:250`) y vitest paraleliza
      // ARCHIVOS: un literal compartido con otro archivo revienta con un `23505` EN EL SEED,
      // que se lee como un bug del producto y encima es no determinista (falla un test u otro
      // según quién llegue primero). Ya pasó en la fase B con `sub_viva`; acá el par fue
      // `cus_race`/`sub_race` contra `billing-webhook.neon.integration.test.ts:213`. Por eso
      // el tag es único por corrida.
      const tag = randomUUID().slice(0, 8);
      const seed = await seedLocationsBusiness("Plan base", "base", {
        stripeCustomerId: custId(tag),
        stripeSubscriptionId: subId(tag),
        trialEndsAt: new Date(Date.now() - 86_400_000),
      });
      try {
        const segunda = await seedExtraLocation(seed.business.id, "Sucursal 2");
        const tercera = await seedExtraLocation(seed.business.id, "Sucursal 3");
        await getDb()
          .update(locations)
          .set({ status: "archived" })
          .where(eq(locations.businessId, seed.business.id));
        await getDb()
          .update(locations)
          .set({ status: "active" })
          .where(eq(locations.id, seed.locationId));
        expect(await activeLocationCountSql(seed.business.id)).toBe(1);

        const attempts = await Promise.allSettled(
          [
            segunda,
            tercera,
            segunda,
            tercera,
            segunda,
            tercera,
            segunda,
            tercera,
          ].map((id) => setLocationStatus(seed.business, id, "active")),
        );
        // La tabla es el oráculo: el tope efectivo es 1, así que NINGUNO puede entrar.
        expect(await activeLocationCountSql(seed.business.id)).toBe(1);
        const refused = attempts.filter((a) => a.status === "rejected");
        expect(refused).toHaveLength(8);
        expect((refused[0] as PromiseRejectedResult).reason).toMatchObject({
          status: 409,
          code: "location_limit",
          message:
            "Tu plan permite 1 local activo. Mejora tu plan para abrir otro.",
        });
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);

    /**
     * Spec 0189 §D7 — `cancel` CONCURRENTE CON EL WEBHOOK. Los dos escriben `core.subscription`
     * bajo `lockBusiness`, así que el lock los serializa y ninguna de las dos escrituras se
     * pierde: la de la RUTA (la marca de auditoría) y la del WEBHOOK (el status crudo). Las dos
     * coinciden en la cancelación programada, derivada de la MISMA suscripción.
     */
    it("a cancel concurrent with the webhook loses NEITHER write", async () => {
      const periodEnd = Math.floor(Date.UTC(2026, 9, 1) / 1000);
      // Tag único por corrida: ver el comentario del test de arriba (`23505` global).
      const tag = randomUUID().slice(0, 8);
      const seed = await seedLocationsBusiness("Carrera webhook", "plus", {
        ...livePlusState(fake, tag),
      });
      world.businessId = seed.business.id;
      try {
        const subscription = fake.subscriptions.get(subId(tag))!;
        subscription.status = "trialing";
        subscription.cancel_at = periodEnd;
        subscription.cancel_at_period_end = true;
        subscription.metadata = { businessId: seed.business.id };

        const [cancelled] = await Promise.all([
          CANCEL(billingRequest({})),
          deliver({
            id: events.next("carrera"),
            type: "customer.subscription.updated",
            object: { id: subId(tag) },
          }),
        ]);
        expect(cancelled.status).toBe(200);

        const row = await readSubscriptionRow(seed.business.id);
        // La escritura de la RUTA: la marca «esta baja la pedimos nosotros».
        expect(row.downgradeRequestedAt).not.toBeNull();
        // La escritura del WEBHOOK: el status crudo del evento aplicado (D5.e).
        expect(row.status).toBe("trialing");
        expect(row.lastEventAt).not.toBeNull();
        // Y las dos coinciden en la cancelación programada.
        expect(row.pendingPlan).toBe("none");
      } finally {
        await dropBusiness(seed.business.id);
      }
    }, 60_000);
  },
);
