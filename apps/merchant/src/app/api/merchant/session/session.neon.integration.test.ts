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
import { getDb } from "../../../../server/db";
import {
  businesses,
  memberships,
  sessions,
  users,
} from "../../../../server/schema";
import { openMerchantSession } from "../../../../server/merchant-session";
import { requireBackofficeSession } from "../../../../server/auth-guards";

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
    /** El mundo del caso M2: un usuario con DOS membresias. Vive aparte para no
     * contaminar los otros casos. */
    const twin = { userId: "", oldBusiness: "", newBusiness: "" };

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
    }, 120_000);

    afterAll(async () => {
      await dropBusiness(seed.business.id);
      if (twin.oldBusiness) await dropBusiness(twin.oldBusiness);
      if (twin.newBusiness) await dropBusiness(twin.newBusiness);
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
        },
        membership: { role: "owner", status: "active" },
      });
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
      const staffId = await seedMember({ businessId: seed.business.id });
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
        expect(body.membership).toEqual({ role: "staff", status: "active" });
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

    it("con DOS membresias devuelve el negocio mas VIEJO, el mismo que `requireBackofficeSession`", async () => {
      twin.userId = `session-int-${randomUUID()}`;
      await getDb()
        .insert(users)
        .values({
          id: twin.userId,
          name: "Dos negocios",
          email: `${twin.userId}@example.test`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      // EL ORDEN DE INSERCION ES EL CONTRARIO AL DE `created_at`, y es lo que hace que la
      // mutacion M2 muerda: con el `orderBy` quitado, un `limit(1)` sobre un seq scan
      // devuelve la fila FISICAMENTE primera, que aca es la del negocio MAS NUEVO.
      twin.newBusiness = await seedTwin(twin.userId, "Nuevo", new Date());
      twin.oldBusiness = await seedTwin(
        twin.userId,
        "Viejo",
        new Date(Date.now() - 86_400_000),
      );

      const cookie = await cookieFor(twin.userId);
      const response = await GET(sessionRequest(cookie));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.business.id).toBe(twin.oldBusiness);

      // Y EL ORACULO QUE IMPORTA: el guard del backoffice resuelve EL MISMO negocio. Si las
      // dos superficies divergieran, la UI y el servidor hablarian de negocios distintos.
      guard.cookie = cookie;
      const context = await requireBackofficeSession();
      expect(body.business.id).toBe(context.business.id);
    }, 120_000);
  },
);

/** Un negocio con su membresia `owner`, con el `created_at` que el caso necesita. */
async function seedTwin(
  userId: string,
  label: string,
  createdAt: Date,
): Promise<string> {
  const businessId = randomUUID();
  await getDb()
    .insert(businesses)
    .values({
      id: businessId,
      name: `${label} ${businessId.slice(0, 8)}`,
      slug: `int-${businessId.slice(0, 20)}`,
      countryCode: "EC",
      timezone: "America/Guayaquil",
      currencyCode: "USD",
      createdAt,
    });
  await getDb()
    .insert(memberships)
    .values({ businessId, userId, role: "owner" });
  return businessId;
}
