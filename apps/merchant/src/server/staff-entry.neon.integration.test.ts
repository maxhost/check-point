import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
} from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businesses, memberships } from "@mi-pasaporte/db/schema";
import { createStaff } from "./staff-create";
import { openMerchantSession } from "./merchant-session";
import { POST as LOGIN } from "../app/api/merchant/auth/staff/route";
import { POST as CHANGE_PIN } from "../app/api/staff/[userId]/pin/route";
import { GET as MODULES } from "../app/api/modules/route";
import { GET as POS_TABLES } from "../app/api/pos/tables/route";
import { GET as SESSION } from "../app/api/merchant/session/route";

/**
 * Spec 0218 — el ingreso del equipo contra Neon: el login devuelve `landing`, la compuerta del
 * PIN temporal corta la API del integrante con 403 `pin_change_required` hasta que lo cambia, y el
 * owner nunca la recibe (su fila nace con `pin_must_change = true`, leido por SQL).
 *
 * Las dos rutas cubren las dos escaleras de API que alcanzan al integrante: `GET /api/modules`
 * (`requireApiMember` → `memberLadder`) y `GET /api/pos/tables` (`requirePosOperator` →
 * `resolveOperator`). Ninguna de las dos tiene una compuerta propia: si el 403 aparece, lo puso la
 * escalera.
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

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Equipo Bar",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      // `pos` solo se otorga con el POS encendido (spec 0169).
      await getDb()
        .update(businesses)
        .set({ posEnabled: true })
        .where(eq(businesses.id, a.business.id));
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(a.business.id);
    }, 30_000);

    const newStaff = (name: string, permissions: string[]) =>
      createStaff(
        { id: a.business.id, slug: a.slug },
        { name, permissions },
        "owner",
      );

    const routes = (cookie: string) =>
      Promise.all([
        MODULES(get("/api/modules", cookie)),
        POS_TABLES(get(`/api/pos/tables?locationId=${a.locationId}`, cookie)),
      ]);

    it("login con solo {pos} y el POS encendido → landing /backoffice/pos; la cookie no lleva Domain", async () => {
      const { staff, pin } = await newStaff("Solo Caja", ["pos"]);
      const response = await LOGIN(loginRequest(staff.identifier, pin));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.staff.landing).toBe("/backoffice/pos");
      expect(body.staff.mustChangePin).toBe(true);
      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("HttpOnly");
      // ADR 0140 §4: la sesion queda atada al host que la abrio (`staff.`), no viaja a `business.`.
      expect(cookie.toLowerCase()).not.toContain("domain=");
    }, 60_000);

    it("con pin_must_change: la API da 403 pin_change_required; despues del cambio, 200", async () => {
      const { staff, pin } = await newStaff("Caja y Mostrador", [
        "pos",
        "counter",
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

      for (const response of await routes(cookie)) {
        expect(response.status).toBe(200);
      }
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
      for (const response of await routes(cookie)) {
        expect(response.status).toBe(200);
      }
    }, 60_000);
  },
);
