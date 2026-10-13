import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

/** La cookie que ve `requireBackofficeSession`, que lee `next/headers` y no el `Request`.
 * Esta en un objeto porque la factory de `vi.mock` se hoistea sobre las declaraciones. */
const guard = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(guard.cookie ? { cookie: guard.cookie } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));

import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedMember,
  type Seed,
} from "../../../../server/counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  sessions,
  subscriptions,
  users,
} from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "../../../../server/merchant-session";

import { GET } from "./route";

/**
 * Spec 0074 §D1 — `GET /api/merchant/session` CONTRA NEON.
 *
 * **Por que no alcanza un unit:** la propiedad que esta ruta tiene que cumplir es «ningun
 * caller recibe 401 ni 403, NUNCA», y con `getDb` doblado la fila del join la escribe el
 * propio test — un `orderBy` perdido o un filtro de membresia mal puesto pasarian en verde.
 * Aca la sesion es real (`openMerchantSession`, la misma que abre el login por PIN), la
 * cookie viaja en el `Request` y las filas las pone Postgres.
 */
const sessionRequest = (cookie?: string) =>
  new Request("https://merchant.test/api/merchant/session", {
    method: "GET",
    ...(cookie ? { headers: { cookie } } : {}),
  });

const cookieFor = async (userId: string) =>
  (await openMerchantSession(userId)).split(";")[0];

async function setStatus(
  businessId: string,
  status: string,
  suspensionReason: string | null,
): Promise<void> {
  await getDb()
    .update(businesses)
    .set({ status, suspensionReason, statusChangedAt: new Date() })
    .where(eq(businesses.id, businessId));
}

const TRIAL_END = new Date(
  Math.floor((Date.now() + 10 * 86_400_000 + 3_600_000) / 1000) * 1000,
);

async function setTrialEnd(businessId: string, trialEndsAt: Date) {
  await getDb()
    .update(subscriptions)
    .set({ trialEndsAt })
    .where(eq(subscriptions.businessId, businessId));
}

async function sessionRows(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: count() })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  return row.total;
}

describe.skipIf(!integrationEnabled)(
  "GET /api/merchant/session — el reportero de estado (spec 0074 §D1)",
  () => {
    let seed: Seed;
    let ownerCookie: string;
    let ownerName: string;

    beforeAll(async () => {
      ownerName = `Sesion ${randomUUID().slice(0, 8)}`;
      seed = await seedBusiness({
        name: ownerName,
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "1.00",
      });
      ownerCookie = await cookieFor(seed.userId);
      // Spec 0189 §D10: la prueba vence en 10 días y una hora → `trialDaysLeft` = 11.
      await setTrialEnd(seed.business.id, TRIAL_END);
    }, 120_000);

    afterAll(async () => {
      await dropBusiness(seed.business.id);
    }, 60_000);

    it("SIN SESION: 200 con `{authenticated:false}` — ni 401 ni 403", async () => {
      const response = await GET(sessionRequest());
      // El caso «no logueado» es el NORMAL de `/login` y de la landing, que consultan esta
      // ruta en cada carga. Es la mutacion M1.
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ authenticated: false });
    }, 60_000);

    it("con sesion y SIN negocio: 200, `business: null` y `membership: null`", async () => {
      const userId = `session-int-${randomUUID()}`;
      await getDb()
        .insert(users)
        .values({
          id: userId,
          name: "Recien registrado",
          email: `${userId}@example.test`,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      const response = await GET(sessionRequest(await cookieFor(userId)));
      expect(response.status).toBe(200);
      // `authenticated: true` + `business: null` es EL dato que manda al wizard, y la unica
      // forma de distinguirlo de «tiene que verificar el email» sin inferirlo de un 403.
      expect(await response.json()).toEqual({
        authenticated: true,
        user: {
          id: userId,
          name: "Recien registrado",
          email: `${userId}@example.test`,
          emailVerified: false,
        },
        business: null,
        membership: null,
        billing: null,
      });
    }, 60_000);

    it("con sesion y negocio `active`: el cuerpo literal del anexo, campo por campo", async () => {
      const response = await GET(sessionRequest(ownerCookie));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        authenticated: true,
        user: {
          id: seed.userId,
          name: ownerName,
          email: `${seed.userId}@example.test`,
          emailVerified: true,
        },
        business: {
          id: seed.business.id,
          name: ownerName,
          slug: seed.slug,
          status: "active",
          suspensionReason: null,
          currencyCode: "USD",
          timezone: "America/Guayaquil",
          // Spec 0220: ningun modulo encendido (el POS tambien nace apagado); `posEnabled` es el
          // paso transitorio hasta la 2b.
          enabledModules: [],
          posEnabled: false,
        },
        // Spec 0086 §8 / contrato §6: para un OWNER son **los SIETE**, aunque su fila en la
        // base los tenga en `'{}'` (el `CHECK 2` lo exige). La API no expone la columna,
        // expone la CAPACIDAD — y acá la diferencia se ve contra la base de verdad.
        membership: {
          role: "owner",
          status: "active",
          permissions: [
            "brand",
            "catalog",
            "counter",
            "locations",
            "loyalty",
            "marketing",
            "staff",
            // Spec 0216 / ADR 0139 §5: el owner tiene tambien los permisos de modulo. Spec 0220:
            // `pos` salio del core y lo declara el modulo POS (despues de los de la Fase 1).
            "stock",
            "recipes",
            "pos",
          ],
        },
        // Spec 0189 §D10: el estado de cobro, SIN datos de Stripe.
        billing: {
          access: "trial",
          trialEndsAt: TRIAL_END.toISOString(),
          trialDaysLeft: 11,
        },
      });
    }, 60_000);

    it("T7 — prueba VENCIDA: 200 (NO 402) con `billing.access: blocked`", async () => {
      await setTrialEnd(seed.business.id, new Date(Date.now() - 1000));
      try {
        const response = await GET(sessionRequest(ownerCookie));
        expect(response.status).toBe(200);
        expect((await response.json()).billing).toMatchObject({
          access: "blocked",
          trialDaysLeft: null,
        });
      } finally {
        await setTrialEnd(seed.business.id, TRIAL_END);
      }
    }, 60_000);

    it("negocio `suspended`: 200 (NO 403) y el OWNER lee el motivo", async () => {
      await setStatus(
        seed.business.id,
        "suspended",
        "Reclamos de consumidores.",
      );
      try {
        const response = await GET(sessionRequest(ownerCookie));
        // Si esto fuera 403, la UI no podria renderizar NUNCA la pantalla de cuenta
        // suspendida: el endpoint que reporta el estado no puede estar gateado por el.
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.business.status).toBe("suspended");
        expect(body.business.suspensionReason).toBe(
          "Reclamos de consumidores.",
        );
      } finally {
        await setStatus(seed.business.id, "active", null);
      }
    }, 60_000);

    it("negocio `suspended`: el INTEGRANTE recibe `suspensionReason: null`", async () => {
      const staffId = await seedMember({
        businessId: seed.business.id,
        permissions: ["catalog", "counter"],
      });
      const staffCookie = await cookieFor(staffId);
      await setStatus(seed.business.id, "suspended", "Nota interna del caso.");
      try {
        const response = await GET(sessionRequest(staffCookie));
        expect(response.status).toBe(200);
        const body = await response.json();
        // El staff SI ve el `status` —lo necesita para saber que no puede operar— pero no
        // la nota interna de por que se suspendio la cuenta. Es la mutacion M3.
        expect(body.business.status).toBe("suspended");
        expect(body.business.suspensionReason).toBeNull();
        // Spec 0086 §8: el integrante recibe **su conjunto exacto**, no los siete. Junto con
        // el caso del owner de arriba, es el par que distingue «devuelve la capacidad» de
        // «devuelve la columna» y de «devuelve siempre lo mismo».
        expect(body.membership).toEqual({
          role: "staff",
          status: "active",
          permissions: ["catalog", "counter"],
        });
      } finally {
        await setStatus(seed.business.id, "active", null);
        await getDb()
          .delete(memberships)
          .where(eq(memberships.userId, staffId));
      }
    }, 120_000);

    it("membresia NO `active`: `business: null` y CERO sesiones borradas", async () => {
      const disabledId = await seedMember({
        businessId: seed.business.id,
        status: "disabled",
      });
      const cookie = await cookieFor(disabledId);
      const before = await sessionRows(disabledId);
      expect(before).toBe(1);
      const response = await GET(sessionRequest(cookie));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.business).toBeNull();
      expect(body.membership).toBeNull();
      // UN `GET` NO TIENE EFECTO LATERAL. `requireBackofficeSession` en este caso BORRA las
      // sesiones del usuario; aca un prefetch del navegador desloguearia a la persona.
      expect(await sessionRows(disabledId)).toBe(before);
      await getDb()
        .delete(memberships)
        .where(eq(memberships.userId, disabledId));
    }, 120_000);
  },
);
