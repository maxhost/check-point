import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type PosWorld,
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  posRow,
  posStaff,
  seedPosWorld,
  setPosModule,
} from "./pos-integration-support";
import { conCookie } from "../permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { businesses } from "@mi-pasaporte/db/schema";
import { scannedCustomer } from "../counter/coupon-cycle-support";
import { PATCH as SET_PERMISSIONS } from "../../app/api/staff/[userId]/permissions/route";
import { POST as CREATE_STAFF } from "../../app/api/staff/route";

/**
 * Spec 0169 casos 8, 9 y 10 — AISLAMIENTO, PERMISOS y el MODULO, contra Neon con sesiones
 * reales. Dos mundos: `a` (el que opera) y `b` (el ajeno).
 *
 * El caso 9 del modulo apagado le pega a una LECTURA (`GET /api/pos/orders`) y no solo a crear:
 * crear relee el modulo bajo `FOR SHARE` (`module.ts`), un guard HERMANO que por si solo daria el
 * mismo 403 aunque `requirePosOperator` no mirara el modulo. La lectura solo la corta el guard.
 */

let a: PosWorld;
let b: PosWorld;

beforeAll(async () => {
  a = await seedPosWorld("POS acceso A");
  b = await seedPosWorld("POS acceso B");
}, 240_000);

afterAll(async () => {
  await dropPosWorld(a);
  await dropPosWorld(b);
}, 240_000);

const posEnabledOf = async (businessId: string) =>
  (
    await getDb()
      .select({ posEnabled: businesses.posEnabled })
      .from(businesses)
      .where(eq(businesses.id, businessId))
  )[0].posEnabled;

describe.skipIf(!posIntegrationEnabled)(
  "POS: aislamiento, permisos y modulo (spec 0169)",
  () => {
    it("CASO 8 — una orden de OTRO negocio: leer/editar/anular/cerrar → 404 `unknown_pos_order`", async () => {
      const order = await openOrder(a, [{ productId: a.cafe, quantity: 1 }]);
      const calls = [
        pos.read(b.ownerCookie, order.id),
        pos.update(b.ownerCookie, order.id, {
          version: 1,
          tableLabel: "x",
          items: [],
        }),
        pos.void(b.ownerCookie, order.id),
        pos.close(b.ownerCookie, order.id, {
          clientRequestId: randomUUID(),
          version: 1,
        }),
      ];
      for (const response of await Promise.all(calls)) {
        expect(response.status).toBe(404);
        expect((await response.json()).code).toBe("unknown_pos_order");
      }
      expect(await posRow(order.id)).toMatchObject({
        status: "open",
        version: 1,
      });
    }, 120_000);

    it("CASO 8 — cerrar con la membresia de OTRO negocio → 403 `foreign_membership`, la orden sigue abierta", async () => {
      const order = await openOrder(a, [{ productId: a.cafe, quantity: 1 }]);
      const foreign = await scannedCustomer(b);
      const response = await pos.close(a.ownerCookie, order.id, {
        clientRequestId: randomUUID(),
        version: order.version,
        membershipId: foreign.membershipId,
      });
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe("foreign_membership");
      expect(await posRow(order.id)).toMatchObject({ status: "open" });
    }, 120_000);

    it("CASO 9 — un STAFF sin `pos` → 403 `missing_permission` (leer y crear)", async () => {
      const cajero = await posStaff(a, ["counter"]);
      for (const response of [
        await pos.list(cajero.cookie),
        await pos.create(cajero.cookie, { tableLabel: "Mesa 1", items: [] }),
      ]) {
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe("missing_permission");
      }
      // Control positivo: con `pos`, el mismo integrante lee.
      const mozo = await posStaff(a, ["pos"]);
      expect((await pos.list(mozo.cookie)).status).toBe(200);
    }, 120_000);

    it("CASO 9 / ORACULO DE M3 — modulo apagado → 403 `pos_disabled` para el owner y el staff, tambien al LEER", async () => {
      const mozo = await posStaff(b, ["pos"]);
      await setPosModule(b.seed.business.id, false);
      try {
        for (const cookie of [b.ownerCookie, mozo.cookie]) {
          for (const response of [
            await pos.list(cookie),
            await pos.create(cookie, { tableLabel: "Mesa 1", items: [] }),
          ]) {
            expect(response.status).toBe(403);
            expect((await response.json()).code).toBe("pos_disabled");
          }
        }
      } finally {
        await setPosModule(b.seed.business.id, true);
      }
    }, 120_000);

    it("CASO 9 — DAR `pos` con el modulo apagado → 422 `pos_disabled` (editar permisos y alta)", async () => {
      const cajero = await posStaff(b, ["counter"]);
      await setPosModule(b.seed.business.id, false);
      try {
        const patch = await SET_PERMISSIONS(
          conCookie(
            `/api/staff/${cajero.userId}/permissions`,
            "PATCH",
            b.ownerCookie,
            {
              permissions: ["counter", "pos"],
            },
          ),
          { params: Promise.resolve({ userId: cajero.userId }) },
        );
        expect(patch.status).toBe(422);
        expect((await patch.json()).code).toBe("pos_disabled");
        const alta = await CREATE_STAFF(
          conCookie("/api/staff", "POST", b.ownerCookie, {
            name: "Mozo nuevo",
            permissions: ["pos"],
          }),
        );
        expect(alta.status).toBe(422);
        expect((await alta.json()).code).toBe("pos_disabled");
      } finally {
        await setPosModule(b.seed.business.id, true);
      }
      // Con el modulo encendido, el mismo PATCH pasa.
      const ok = await SET_PERMISSIONS(
        conCookie(
          `/api/staff/${cajero.userId}/permissions`,
          "PATCH",
          b.ownerCookie,
          {
            permissions: ["counter", "pos"],
          },
        ),
        { params: Promise.resolve({ userId: cajero.userId }) },
      );
      expect(ok.status).toBe(200);
    }, 120_000);

    it("CASO 10 / ORACULO DE M4 — apagar con abiertas → 409 `pos_has_open_orders` con `openCount`; cerradas todas, apaga", async () => {
      const one = await openOrder(b, [{ productId: b.cafe, quantity: 1 }]);
      const two = await openOrder(b, []);
      const { open } = await (await pos.list(b.ownerCookie)).json();
      const blocked = await pos.setModule(b.ownerCookie, false);
      expect(blocked.status).toBe(409);
      expect(await blocked.json()).toMatchObject({
        code: "pos_has_open_orders",
        openCount: open.length,
      });
      expect(open.length).toBeGreaterThanOrEqual(2);
      expect(await posEnabledOf(b.seed.business.id)).toBe(true);

      await pos.close(b.ownerCookie, one.id, {
        clientRequestId: randomUUID(),
        version: one.version,
      });
      for (const order of open.filter((o: { id: string }) => o.id !== one.id))
        await pos.void(b.ownerCookie, order.id);
      expect(await posRow(two.id)).toMatchObject({ status: "voided" });

      const off = await pos.setModule(b.ownerCookie, false);
      expect(off.status).toBe(200);
      expect(await off.json()).toEqual({ enabled: false });
      expect(await posEnabledOf(b.seed.business.id)).toBe(false);
      const on = await pos.setModule(b.ownerCookie, true);
      expect(await on.json()).toEqual({ enabled: true });
    }, 180_000);
  },
);
