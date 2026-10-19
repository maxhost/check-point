import { inArray, and, eq } from "drizzle-orm";
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
  consumerAccounts,
  memberships,
  programMemberships,
} from "@mi-pasaporte/db/schema";
import { createStaff } from "./staff-create";
import { openMerchantSession } from "./merchant-session";
import { POST as LOGIN } from "../app/api/merchant/auth/staff/route";
import { POST as CHANGE_PIN } from "../app/api/staff/[userId]/pin/route";
import { GET as MODULES } from "../app/api/modules/route";
import { GET as COUPON_STATE } from "../app/api/counter/coupon-state/route";
import { GET as SESSION } from "../app/api/merchant/session/route";

/**
 * Spec 0218 — el ingreso del equipo contra Neon: el login devuelve `landing`, la compuerta del
 * PIN temporal corta la API del integrante con 403 `pin_change_required` hasta que lo cambia, y el
 * owner nunca la recibe (su fila nace con `pin_must_change = true`, leido por SQL).
 *
 * Las dos rutas cubren las dos escaleras de API que alcanzan al integrante: `GET /api/modules`
 * (`requireApiMember` → `memberLadder`) y `GET /api/counter/coupon-state` (`requireOperator` →
 * `resolveOperator`). Ninguna de las dos tiene una compuerta propia: si el 403 aparece, lo puso la
 * escalera.
 *
 * Spec 0220 (2026-10-13): hasta aca la segunda ruta era la de mesas del POS, que usaba
 * `resolveOperator`; el POS paso a ser un modulo (escalera del despachador, `memberLadder`) y el core
 * no lo nombra, asi que la escalera del operador se mide con el mostrador. El caso del integrante que
 * solo opera el POS se mudo al modulo (`pos-staff-entry.neon.integration.test.ts`).
 */

const loginRequest = (identifier: string, pin: string) =>
  new Request("http://localhost:3001/api/merchant/auth/staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, pin }),
  });

const get = (path: string, cookie: string) =>
  new Request(`http://localhost:3001${path}`, { headers: { cookie } });

const otherPin = (pin: string) => (pin === "135790" ? "246801" : "135790");

describe.skipIf(!integrationEnabled)(
  "ingreso del equipo y PIN temporal obligatorio (spec 0218)",
  () => {
    let a: Seed;
    const ownedUsers: string[] = [];
    let consumerId: string;
    let couponUrl: string;

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Equipo Bar",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      ownedUsers.push(a.userId);
      console.info("P6 staff fixture identity", {
        businessId: a.business.id,
        userId: a.userId,
      });
      // Un pase real del negocio; el endpoint retirado conserva primero la escalera.
      consumerId = (await seedConsumer()).id;
      console.info("P6 staff consumer identity", { consumerId });
      const [membership] = await getDb()
        .insert(programMemberships)
        .values({
          consumerId,
          programId: a.programId,
          businessId: a.business.id,
        })
        .returning({ id: programMemberships.id });
      couponUrl = `/api/counter/coupon-state?membershipId=${membership.id}`;
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(a.business.id);
      await getDb()
        .delete(consumerAccounts)
        .where(eq(consumerAccounts.id, consumerId));
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
          .where(eq(consumerAccounts.id, consumerId)),
      ).toEqual([]);
    }, 30_000);

    const newStaff = async (name: string, permissions: string[]) => {
      const result = await createStaff(
        { id: a.business.id, slug: a.slug },
        { name, permissions },
        "owner",
      );
      ownedUsers.push(result.staff.userId);
      console.info("P6 staff identity", { userId: result.staff.userId });
      return result;
    };

    const routes = (cookie: string) =>
      Promise.all([
        MODULES(get("/api/modules", cookie)),
        COUPON_STATE(get(couponUrl, cookie)),
      ]);

    it("con pin_must_change: la API da 403 pin_change_required; despues del cambio, API200 y Counter410", async () => {
      const { staff, pin } = await newStaff("Caja y Mostrador", [
        "counter",
        "catalog",
      ]);
      const login = await LOGIN(loginRequest(staff.identifier, pin));
      expect(login.status).toBe(200);
      expect((await login.json()).staff.landing).toBe("/backoffice");
      const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

      for (const response of await routes(cookie)) {
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({
          error: "Cambia tu PIN temporal para continuar.",
          code: "pin_change_required",
        });
      }

      // Las excepciones: la sesion se lee (reportero) y el propio cambio se hace.
      const session = await SESSION(get("/api/merchant/session", cookie));
      expect(session.status).toBe(200);

      const change = await CHANGE_PIN(
        new Request(`http://localhost:3001/api/staff/${staff.userId}/pin`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie },
          body: JSON.stringify({ currentPin: pin, newPin: otherPin(pin) }),
        }),
        { params: Promise.resolve({ userId: staff.userId }) },
      );
      expect(change.status).toBe(200);
      expect(await change.json()).toEqual({ ok: true, mustChangePin: false });

      const [modulesResponse, counterResponse] = await routes(cookie);
      expect(modulesResponse.status).toBe(200);
      expect(counterResponse.status).toBe(410);
      expect(await counterResponse.json()).toEqual({
        code: "feature_retired",
        error: "Esta función ya no está disponible.",
      });
    }, 90_000);

    it("el owner nunca recibe el 403, aunque su fila diga pin_must_change = true", async () => {
      const [row] = await getDb()
        .select({ pinMustChange: memberships.pinMustChange })
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, a.business.id),
            eq(memberships.userId, a.userId),
          ),
        );
      // El default de la columna: el oraculo solo vale si la fila del owner dice `true`.
      expect(row.pinMustChange).toBe(true);

      const cookie = (await openMerchantSession(a.userId)).split(";")[0];
      const [modulesResponse, counterResponse] = await routes(cookie);
      expect(modulesResponse.status).toBe(200);
      expect(counterResponse.status).toBe(410);
      expect(await counterResponse.json()).toEqual({
        code: "feature_retired",
        error: "Esta función ya no está disponible.",
      });
    }, 60_000);
  },
);
