import { inArray, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  users,
  sessions,
  businesses,
  consumerAccounts,
  subscriptions,
} from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "./merchant-session";
import { createStaff } from "./staff-create";
import { PUT as MODULE_TOGGLE } from "../app/api/modules/[moduleId]/[[...path]]/route";
import { MODULES } from "../modules/registry";
import { GET as LOCATIONS } from "../app/api/locations/route";
import { GET as BILLING_STATE } from "../app/api/billing/state/route";
import { GET as SESSION } from "../app/api/merchant/session/route";
import { POST as RESOLVE } from "../app/api/counter/resolve/route";
import { POST as STAFF_LOGIN } from "../app/api/merchant/auth/staff/route";

/**
 * Spec 0189 §Plan de pruebas, T7 — LOS GUARDS DEL EJE DE ACCESO, con sesiones REALES contra
 * Neon. Un negocio sin suscripción viva y con la prueba vencida recibe 402 `payment_required`
 * en cada superficie (owner, permiso, mostrador, login del personal), MENOS en las dos que
 * existen para que pague: el estado de cobro y la sesión. Y el mismo negocio con la prueba
 * vigente pasa en todas.
 *
 * ORÁCULO DE M2: el toggle de un módulo (`PUT /api/modules/:id`) pasa SOLO por `requireApiOwner`
 * (ningún guard hermano la cubre), así que sacar la llamada al eje de acceso de ese guard la deja en
 * 200. Spec 0220 (2026-10-13): hasta acá esta superficie era la lectura del ajuste del ticket del
 * owner, que se mudó al módulo POS; la reemplaza el toggle, la otra superficie del core que es
 * solo del owner. Apagar un módulo apagado es idempotente: el caso no cambia nada.
 */
const DAY = 86_400_000;

/** `PUT /api/modules/<id>` `{ enabled: false }` sobre el primer módulo del registro (apagado). */
const toggleOff = (cookie: string) => {
  const moduleId = MODULES[0].id;
  return MODULE_TOGGLE(
    new Request(`https://merchant.test/api/modules/${moduleId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ enabled: false }),
    }),
    { params: Promise.resolve({ moduleId }) },
  );
};

const get = (path: string, cookie: string) =>
  new Request(`https://merchant.test${path}`, {
    method: "GET",
    headers: { cookie },
  });

const post = (path: string, body: unknown, cookie?: string) =>
  new Request(`https://merchant.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

describe.skipIf(!integrationEnabled)(
  "el eje de acceso en los guards (spec 0189, T7)",
  () => {
    let seed: Seed;
    const ownedUsers: string[] = [];
    let ownerCookie: string;
    let staff: { identifier: string; pin: string };
    let consumer: { id: string; qrToken: string };

    async function setTrialEnd(trialEndsAt: Date) {
      await getDb()
        .update(subscriptions)
        .set({ trialEndsAt })
        .where(eq(subscriptions.businessId, seed.business.id));
    }

    beforeAll(async () => {
      seed = await seedBusiness({
        name: "Guardia de cobro",
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "1.00",
      });
      ownedUsers.push(seed.userId);
      ownerCookie = (await openMerchantSession(seed.userId)).split(";")[0];
      const created = await createStaff(
        { id: seed.business.id, slug: seed.slug },
        { name: "Cajera Cobro", permissions: ["counter"] },
        "owner",
      );
      ownedUsers.push(created.staff.userId);
      console.info("P6 billing fixture identities", {
        businessId: seed.business.id,
        userIds: ownedUsers,
      });
      staff = { identifier: created.staff.identifier, pin: created.pin };
      consumer = await seedConsumer();
      console.info("P6 billing consumer identity", { consumerId: consumer.id });
    }, 120_000);

    afterAll(async () => {
      await dropBusiness(seed.business.id);
      await getDb()
        .delete(consumerAccounts)
        .where(eq(consumerAccounts.id, consumer.id));
      await getDb().delete(users).where(inArray(users.id, ownedUsers));
      expect(
        await getDb()
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, ownedUsers)),
      ).toEqual([]);
      expect(
        await getDb()
          .select({ id: sessions.id })
          .from(sessions)
          .where(inArray(sessions.userId, ownedUsers)),
      ).toEqual([]);
      expect(
        await getDb()
          .select({ id: consumerAccounts.id })
          .from(consumerAccounts)
          .where(eq(consumerAccounts.id, consumer.id)),
      ).toEqual([]);
    }, 60_000);

    /** Las superficies que cortan, con su desenlace. */
    async function guarded() {
      return {
        toggle: await toggleOff(ownerCookie),
        locations: await LOCATIONS(get("/api/locations", ownerCookie)),
        counter: await RESOLVE(
          post(
            "/api/counter/resolve",
            { qrToken: consumer.qrToken },
            ownerCookie,
          ),
        ),
        staffLogin: await STAFF_LOGIN(
          post("/api/merchant/auth/staff", {
            identifier: staff.identifier,
            pin: staff.pin,
          }),
        ),
      };
    }

    it("prueba VENCIDA sin suscripción: 402 `payment_required` en owner, permiso, mostrador y login", async () => {
      await setTrialEnd(new Date(Date.now() - 1000));
      try {
        for (const [name, response] of Object.entries(await guarded())) {
          expect(response.status, name).toBe(402);
          expect(await response.json(), name).toEqual({
            error: "Tu prueba terminó. Elige un plan para seguir.",
            code: "payment_required",
          });
        }
      } finally {
        await setTrialEnd(new Date(Date.now() + 30 * DAY));
      }
    }, 120_000);

    it("bloqueado, el estado de cobro y la sesión SIGUEN contestando 200 (es donde paga)", async () => {
      await setTrialEnd(new Date(Date.now() - 1000));
      try {
        const state = await BILLING_STATE(
          get("/api/billing/state", ownerCookie),
        );
        expect(state.status).toBe(200);
        expect(await state.json()).toMatchObject({ access: "blocked" });
        const session = await SESSION(
          get("/api/merchant/session", ownerCookie),
        );
        expect(session.status).toBe(200);
        expect((await session.json()).billing).toMatchObject({
          access: "blocked",
        });
      } finally {
        await setTrialEnd(new Date(Date.now() + 30 * DAY));
      }
    }, 60_000);

    it("suspendido Y sin acceso sigue diciendo `business_suspended` (el eje `status` va antes)", async () => {
      await setTrialEnd(new Date(Date.now() - 1000));
      await getDb()
        .update(businesses)
        .set({ status: "suspended", suspensionReason: "Prueba de orden." })
        .where(eq(businesses.id, seed.business.id));
      try {
        const response = await toggleOff(ownerCookie);
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({
          code: "business_suspended",
        });
      } finally {
        await getDb()
          .update(businesses)
          .set({ status: "active", suspensionReason: null })
          .where(eq(businesses.id, seed.business.id));
        await setTrialEnd(new Date(Date.now() + 30 * DAY));
      }
    }, 60_000);

    it("el MISMO negocio con prueba vigente pasa los guards: APIs200 y Counter410", async () => {
      for (const [name, response] of Object.entries(await guarded())) {
        expect(response.status, name).toBe(name === "counter" ? 410 : 200);
        if (name === "counter")
          expect(await response.json()).toEqual({
            code: "feature_retired",
            error: "Esta función ya no está disponible.",
          });
      }
    }, 120_000);
  },
);
