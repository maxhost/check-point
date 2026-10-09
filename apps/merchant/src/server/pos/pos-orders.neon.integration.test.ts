import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type PosWorld,
  dropPosWorld,
  openOrder,
  ordersWithItems,
  pos,
  posIntegrationEnabled,
  posRow,
  seedPosWorld,
  seedProduct,
} from "./pos-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { products } from "@mi-pasaporte/db/schema";
import { scannedCustomer } from "../counter/coupon-cycle-support";

/**
 * Spec 0169 — LA ORDEN ABIERTA del POS contra Neon, por las rutas y con sesion real: precio
 * fijo al agregar (caso 1), version optimista (caso 2), producto borrado con la orden abierta
 * (caso 11), anular, el historial y la forma exacta de `PosOrder`. Lo que pesa se lee por SQL.
 */

let world: PosWorld;

beforeAll(async () => {
  world = await seedPosWorld("POS ordenes");
}, 180_000);

afterAll(async () => {
  await dropPosWorld(world);
}, 180_000);

describe.skipIf(!posIntegrationEnabled)(
  "POS: la orden abierta (spec 0169)",
  () => {
    it("la forma de `PosOrder` es EXACTAMENTE la del contrato (ninguna clave interna)", async () => {
      const order = await openOrder(world, [
        { productId: world.medialuna, quantity: 2 },
      ]);
      expect(Object.keys(order).sort()).toEqual([
        "business",
        "closedAt",
        "closedBy",
        "createdAt",
        "createdBy",
        "id",
        "items",
        "location",
        "sale",
        "status",
        "tableId",
        "tableLabel",
        "total",
        "version",
      ]);
      expect(Object.keys(order.items[0]).sort()).toEqual([
        "lineId",
        "lineTotal",
        "name",
        "productId",
        "quantity",
        "unitPrice",
      ]);
      expect(order).toMatchObject({
        status: "open",
        version: 1,
        total: "7.00",
        location: { id: world.seed.locationId },
        business: { currencyCode: "USD" },
        closedAt: null,
        closedBy: null,
        sale: null,
      });
    }, 120_000);

    it("CASO 1 / ORACULO DE M1 — precio fijo: la linea existente sigue a 10.00, una NUEVA entra a 15.00", async () => {
      const product = await seedProduct(world, "Pizza fija", "10.00");
      const order = await openOrder(world, [
        { productId: product, quantity: 1 },
      ]);
      await getDb()
        .update(products)
        .set({ unitPrice: "15.00" })
        .where(eq(products.id, product));

      const response = await pos.update(world.ownerCookie, order.id, {
        version: order.version,
        tableLabel: order.tableLabel,
        items: [
          { lineId: order.items[0].lineId, productId: product, quantity: 3 },
          { productId: product, quantity: 1 },
        ],
      });
      expect(response.status).toBe(200);
      const edited = await response.json();
      expect(edited.version).toBe(2);
      expect(edited.items).toEqual([
        expect.objectContaining({
          lineId: order.items[0].lineId,
          unitPrice: "10.00",
          quantity: 3,
          lineTotal: "30.00",
        }),
        expect.objectContaining({ unitPrice: "15.00", quantity: 1 }),
      ]);
      expect(edited.total).toBe("45.00");
      // Y releida por la ruta de lectura, no solo la respuesta del PUT.
      const reread = await (await pos.read(world.ownerCookie, order.id)).json();
      expect(
        reread.items.map((i: { unitPrice: string }) => i.unitPrice),
      ).toEqual(["10.00", "15.00"]);
    }, 120_000);

    it("CASO 2 — dos PUT con la misma version: el segundo 409 `version_conflict` con la orden actual", async () => {
      const order = await openOrder(world, [
        { productId: world.cafe, quantity: 1 },
      ]);
      const body = (quantity: number) => ({
        version: order.version,
        tableLabel: order.tableLabel,
        items: [
          { lineId: order.items[0].lineId, productId: world.cafe, quantity },
        ],
      });
      expect(
        (await pos.update(world.ownerCookie, order.id, body(2))).status,
      ).toBe(200);
      const second = await pos.update(world.ownerCookie, order.id, body(5));
      expect(second.status).toBe(409);
      const conflict = await second.json();
      expect(conflict.code).toBe("version_conflict");
      expect(conflict.order).toMatchObject({
        id: order.id,
        version: 2,
        items: [expect.objectContaining({ quantity: 2 })],
      });
      expect(await posRow(order.id)).toMatchObject({ version: 2 });
    }, 120_000);

    it("un `lineId` que no es de la orden → 422 `unknown_line`, y la orden no cambia", async () => {
      const order = await openOrder(world, [
        { productId: world.cafe, quantity: 1 },
      ]);
      const response = await pos.update(world.ownerCookie, order.id, {
        version: order.version,
        tableLabel: order.tableLabel,
        items: [{ lineId: randomUUID(), productId: world.cafe, quantity: 1 }],
      });
      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("unknown_line");
      expect(await posRow(order.id)).toMatchObject({ version: 1 });
    }, 120_000);

    it("anular: open → voided; otra vez → 200 idempotente; editarla → 409 `pos_order_not_open`", async () => {
      const order = await openOrder(world, []);
      const first = await pos.void(world.ownerCookie, order.id);
      expect(first.status).toBe(200);
      expect((await first.json()).status).toBe("voided");
      expect((await pos.void(world.ownerCookie, order.id)).status).toBe(200);
      expect(await posRow(order.id)).toMatchObject({ status: "voided" });
      const edit = await pos.update(world.ownerCookie, order.id, {
        version: 1,
        tableLabel: "x",
        items: [],
      });
      expect(edit.status).toBe(409);
      expect((await edit.json()).code).toBe("pos_order_not_open");
    }, 120_000);

    it("el historial: abiertas mas viejas primero; la anulada en `closedToday`", async () => {
      const older = await openOrder(world, [
        { productId: world.cafe, quantity: 2 },
      ]);
      const newer = await openOrder(world, []);
      const voided = await openOrder(world, []);
      await pos.void(world.ownerCookie, voided.id);
      const response = await pos.list(world.ownerCookie);
      expect(response.status).toBe(200);
      const { open, closedToday } = await response.json();
      const openIds = open.map((o: { id: string }) => o.id);
      expect(openIds.indexOf(older.id)).toBeLessThan(openIds.indexOf(newer.id));
      expect(openIds).not.toContain(voided.id);
      expect(open.find((o: { id: string }) => o.id === older.id)).toMatchObject(
        {
          total: "4.00",
          itemCount: 2,
          saleTotal: null,
        },
      );
      expect(closedToday.map((o: { id: string }) => o.id)).toContain(voided.id);
    }, 120_000);

    it("CASO 11 — producto borrado con la orden abierta: se cierra con pase y el `order_item` queda con `product_id` null", async () => {
      const product = await seedProduct(world, "Plato del dia", "8.00");
      const order = await openOrder(world, [
        { productId: product, quantity: 1 },
      ]);
      await getDb().delete(products).where(eq(products.id, product));
      const customer = await scannedCustomer(world);

      const response = await pos.close(world.ownerCookie, order.id, {
        clientRequestId: randomUUID(),
        version: order.version,
        membershipId: customer.membershipId,
      });
      expect(response.status).toBe(200);
      const closed = await response.json();
      expect(closed.items[0]).toMatchObject({
        productId: null,
        name: "Plato del dia",
      });
      const [sale] = await ordersWithItems(
        world.seed.business.id,
        customer.consumerId,
      );
      expect(sale.items).toEqual([
        expect.objectContaining({
          productId: null,
          nameSnapshot: "Plato del dia",
          unitPrice: "8.00",
        }),
      ]);
      expect(sale.unitsGranted).toBe(80);
    }, 120_000);
  },
);
