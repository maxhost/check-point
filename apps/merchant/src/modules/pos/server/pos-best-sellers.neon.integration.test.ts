import { inArray } from "drizzle-orm";
import { consumerAccounts, users, sessions } from "@mi-pasaporte/db/schema";
import { readPosCatalog } from "./measured-catalog";
import { products } from "@mi-pasaporte/db/schema";
import { closeWithCash } from "./pos-payment-integration-support";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { locations, posOrders } from "@mi-pasaporte/db/schema";
import { scannedCustomer as seedScannedCustomer } from "../../../server/counter/coupon-cycle-support";
import {
  type PosWorld,
  dropPosWorld,
  openOrderV2,
  capturePosScope,
  scopedPos,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
} from "./pos-integration-support";

/**
 * Spec 0169 §Contrato — `bestSellingProductIds` de `GET /api/modules/pos/catalog`: unidades de las
 * ordenes CERRADAS (con y sin pase) del local en los ultimos 30 dias, de mayor a menor. Cada
 * orden que NO debe contar trae mas unidades que el ganador: si el filtro se cae, el orden cambia.
 */
let a: PosWorld;
let scope: string;
beforeAll(async () => {
  a = await seedPosWorld("POS BEST");
  scope = await capturePosScope(a.ownerCookie, a.seed.business.id);
}, 240_000);
afterAll(async () => {
  await dropPosWorld(a);
  await retireFixtureIdentities([a], consumerIds);
}, 240_000);

async function closeOrder(
  items: { productId: string; quantity: number; unitPrice?: string }[],
  membershipId?: string,
): Promise<string> {
  const order = await openOrderV2(a, scope, items);
  const response = await closeWithCash(
    a.ownerCookie,
    order.id,
    {
      clientRequestId: randomUUID(),
      version: order.version,
      ...(membershipId ? { membershipId } : {}),
    },
    { scope: scope },
  );
  if (response.status !== 200)
    throw new Error(`close: ${response.status} ${await response.text()}`);
  return order.id;
}

// Preserve the historical unit-sales ranking through its internal reader after HTTP V1 retirement.
async function catalog() {
  const projection = await readPosCatalog(
    a.seed.business.id,
    a.seed.locationId,
    1,
  );
  if (!("bestSellingProductIds" in projection))
    throw new Error("Expected historical unit ranking");
  return projection;
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
      const voided = await openOrderV2(a, scope, [
        { productId: torta, quantity: 9 },
      ]);
      expect(
        (await scopedPos(a.ownerCookie, scope).void(voided.id)).status,
      ).toBe(200);
      await openOrderV2(a, scope, [{ productId: torta, quantity: 9 }]);
      const old = await closeOrder([{ productId: vieja, quantity: 9 }]);
      await getDb()
        .update(posOrders)
        .set({ closedAt: sql`now() - interval '31 days'` })
        .where(eq(posOrders.id, old));
      const elsewhere = await closeOrder([
        { productId: otroLocal, quantity: 9 },
      ]);
      // 0083 assigns a legacy null location to the only active local; use a real second local.
      const [otherLocation] = await getDb()
        .insert(locations)
        .values({
          businessId: a.seed.business.id,
          name: "Otro local ranking",
          addressLabel: "Quito",
          countryCode: "EC",
          addressSnapshot: {},
        })
        .returning({ id: locations.id });
      const [relocated] = await getDb()
        .update(posOrders)
        .set({ locationId: otherLocation.id })
        .where(eq(posOrders.id, elsewhere))
        .returning({ locationId: posOrders.locationId });
      expect(relocated.locationId).toBe(otherLocation.id);

      const body = await catalog();
      expect(body.bestSellingProductIds).toEqual([a.medialuna, a.cafe]);
      expect(body.products.length).toBeGreaterThanOrEqual(5);
      expect(Array.isArray(body.categories)).toBe(true);
    }, 240_000);

    it("sin precio (null) no llega al POS ni al ranking; precio 0 si", async () => {
      const sinPrecio = await seedProduct(a, "Sin precio", null);
      const gratis = await seedProduct(a, "Gratis", "0.00");
      // A real captured tariff remains historical after the catalog price is withdrawn.
      await getDb()
        .update(products)
        .set({ unitPrice: "2.00", salesRevision: 2 })
        .where(eq(products.id, sinPrecio));
      await closeOrder([
        { productId: sinPrecio, quantity: 20 },
        { productId: gratis, quantity: 1 },
      ]);

      await getDb()
        .update(products)
        .set({ unitPrice: null, salesRevision: 3 })
        .where(eq(products.id, sinPrecio));
      const body = await catalog();
      const ids = body.products.map((p: { id: string }) => p.id);
      expect(ids).not.toContain(sinPrecio);
      expect(ids).toContain(gratis);
      expect(
        body.products.find((p: { id: string }) => p.id === gratis)!.unitPrice,
      ).toBe(0);
      expect(
        body.products.every(
          (p: { unitPrice: unknown }) => p.unitPrice !== null,
        ),
      ).toBe(true);
      expect(body.bestSellingProductIds).not.toContain(sinPrecio);
      expect(body.bestSellingProductIds).toContain(gratis);
      expect(
        body.bestSellingProductIds.every((id: string) => ids.includes(id)),
      ).toBe(true);
    }, 240_000);
  },
);

const consumerIds: string[] = [];
async function scannedCustomer(
  target: Parameters<typeof seedScannedCustomer>[0],
) {
  const customer = await seedScannedCustomer(target);
  consumerIds.push(customer.consumerId);
  return customer;
}

/** Retire only identities created by these fixtures, after their business roots are gone. */
async function retireFixtureIdentities(
  targets: { seed: { userId: string }; extraUsers: string[] }[],
  consumers: string[] = [],
) {
  if (consumers.length) {
    await getDb()
      .delete(consumerAccounts)
      .where(inArray(consumerAccounts.id, consumers));
    expect(
      await getDb()
        .select({ id: consumerAccounts.id })
        .from(consumerAccounts)
        .where(inArray(consumerAccounts.id, consumers)),
    ).toEqual([]);
  }
  const owners = targets.flatMap((target) => [
    target.seed.userId,
    ...target.extraUsers,
  ]);
  if (owners.length) {
    await getDb().delete(users).where(inArray(users.id, owners));
    expect(
      await getDb()
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, owners)),
    ).toEqual([]);
    expect(
      await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(inArray(sessions.userId, owners)),
    ).toEqual([]);
  }
}
