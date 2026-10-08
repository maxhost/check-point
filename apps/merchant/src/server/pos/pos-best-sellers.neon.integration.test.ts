import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { posOrders } from "@mi-pasaporte/db/schema";
import { conCookie } from "../permissions-integration-support";
import { scannedCustomer } from "../counter/coupon-cycle-support";
import { GET as CATALOG } from "../../app/api/pos/catalog/route";
import {
  type PosWorld,
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
} from "./pos-integration-support";

/**
 * Spec 0169 §Contrato — `bestSellingProductIds` de `GET /api/pos/catalog`: unidades de las
 * ordenes CERRADAS (con y sin pase) del local en los ultimos 30 dias, de mayor a menor. Cada
 * orden que NO debe contar trae mas unidades que el ganador: si el filtro se cae, el orden cambia.
 */
let a: PosWorld;
beforeAll(async () => {
  a = await seedPosWorld("POS BEST");
}, 240_000);
afterAll(async () => {
  await dropPosWorld(a);
}, 240_000);

async function closeOrder(
  items: { productId: string; quantity: number }[],
  membershipId?: string,
): Promise<string> {
  const order = await openOrder(a, items);
  const response = await pos.close(a.ownerCookie, order.id, {
    clientRequestId: randomUUID(),
    version: order.version,
    ...(membershipId ? { membershipId } : {}),
  });
  if (response.status !== 200)
    throw new Error(`close: ${response.status} ${await response.text()}`);
  return order.id;
}

async function catalog() {
  const response = await CATALOG(
    conCookie(
      `/api/pos/catalog?locationId=${a.seed.locationId}`,
      "GET",
      a.ownerCookie,
    ),
  );
  expect(response.status).toBe(200);
  return response.json();
}

describe.skipIf(!posIntegrationEnabled)(
  "POS: mas vendidos del catalogo",
  () => {
    it("cerradas con y sin pase, sin anuladas, abiertas, viejas ni de otro local", async () => {
      const torta = await seedProduct(a, "Torta", "5.00");
      const vieja = await seedProduct(a, "Vieja", "1.00");
      const otroLocal = await seedProduct(a, "Otro local", "1.00");

      expect((await catalog()).bestSellingProductIds).toEqual([]);

      // Medialuna 4 (sin pase 1 + con pase 3), cafe 3 (sin pase).
      await closeOrder([
        { productId: a.medialuna, quantity: 1 },
        { productId: a.cafe, quantity: 3 },
      ]);
      const c = await scannedCustomer(a);
      await closeOrder(
        [{ productId: a.medialuna, quantity: 3 }],
        c.membershipId,
      );

      // Lo que no cuenta: anulada, abierta, cerrada hace 31 dias, cerrada en otro local.
      const voided = await openOrder(a, [{ productId: torta, quantity: 9 }]);
      expect((await pos.void(a.ownerCookie, voided.id)).status).toBe(200);
      await openOrder(a, [{ productId: torta, quantity: 9 }]);
      const old = await closeOrder([{ productId: vieja, quantity: 9 }]);
      await getDb()
        .update(posOrders)
        .set({ closedAt: sql`now() - interval '31 days'` })
        .where(eq(posOrders.id, old));
      const elsewhere = await closeOrder([
        { productId: otroLocal, quantity: 9 },
      ]);
      await getDb()
        .update(posOrders)
        .set({ locationId: null })
        .where(eq(posOrders.id, elsewhere));

      const body = await catalog();
      expect(body.bestSellingProductIds).toEqual([a.medialuna, a.cafe]);
      expect(body.products.length).toBeGreaterThanOrEqual(5);
      expect(Array.isArray(body.categories)).toBe(true);
    }, 240_000);
  },
);
