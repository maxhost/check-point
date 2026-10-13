import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth necesita estas dos para construirse; valores de test sobre la rama aislada.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
} from "../../../server/counter-integration-support";
import { createStaff } from "../../../server/staff-create";
import { POST as LOGIN } from "../../../app/api/merchant/auth/staff/route";
import { setPosModule } from "./pos-integration-support";

/**
 * Spec 0218 → 0220 — EL INGRESO DEL INTEGRANTE QUE SOLO OPERA EL POS, contra Neon: el login con
 * permisos efectivos `{pos}` y el POS encendido devuelve `landing: "/backoffice/pos"` (la
 * `startPage` del modulo, ADR 0141 §2) y la cookie queda atada al host; con el POS apagado, `pos`
 * no tiene efecto y va al panel. Mudado de `server/staff-entry.neon.integration.test.ts` (el core no
 * nombra el POS). La regla pura, con todas sus ramas: `modules/start-page.test.ts`.
 */

const loginRequest = (identifier: string, pin: string) =>
  new Request("http://localhost:3001/api/merchant/auth/staff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, pin }),
  });

describe.skipIf(!integrationEnabled)(
  "ingreso del integrante del POS (spec 0218 / 0220)",
  () => {
    let a: Seed;

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Equipo POS",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      // `pos` solo se otorga con el POS encendido (regla generica de los modulos).
      await setPosModule(a.business.id, true);
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(a.business.id);
    }, 30_000);

    it("login con solo {pos} y el POS encendido → landing /backoffice/pos; la cookie no lleva Domain", async () => {
      const { staff, pin } = await createStaff(
        { id: a.business.id, slug: a.slug },
        { name: "Solo Caja", permissions: ["pos"] },
        "owner",
      );
      const response = await LOGIN(loginRequest(staff.identifier, pin));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.staff.landing).toBe("/backoffice/pos");
      expect(body.staff.mustChangePin).toBe(true);
      const cookie = response.headers.get("set-cookie") ?? "";
      expect(cookie).toContain("HttpOnly");
      // ADR 0140 §4: la sesion queda atada al host que la abrio (`staff.`), no viaja a `business.`.
      expect(cookie.toLowerCase()).not.toContain("domain=");

      // Con el POS apagado, el mismo integrante no tiene ningun permiso efectivo → el panel.
      await setPosModule(a.business.id, false);
      try {
        const off = await LOGIN(loginRequest(staff.identifier, pin));
        expect(off.status).toBe(200);
        expect((await off.json()).staff.landing).toBe("/backoffice");
      } finally {
        await setPosModule(a.business.id, true);
      }
    }, 60_000);
  },
);
