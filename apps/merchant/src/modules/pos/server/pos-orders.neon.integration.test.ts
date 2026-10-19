import { consumerAccounts, sessions } from "@mi-pasaporte/db/schema";
import { closeWithCash } from "./pos-payment-integration-support";
import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type PosWorld,
  dropPosWorld,
  openOrderV2,
  capturePosScope,
  scopedPos,
  ordersWithItems,
  posIntegrationEnabled,
  posRow,
  seedPosWorld,
  seedProduct,
} from "./pos-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  posOrders,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import { scannedCustomer as seedScannedCustomer } from "../../../server/counter/coupon-cycle-support";

/**
 * Spec 0169 — LA ORDEN ABIERTA del POS contra Neon, por las rutas y con sesion real: precio
 * fijo al agregar (caso 1), version optimista (caso 2), producto borrado con la orden abierta
 * (caso 11), anular, el historial y la forma exacta de `PosOrder`. Lo que pesa se lee por SQL.
 */

let world: PosWorld;
let scope: string;

beforeAll(async () => {
  world = await seedPosWorld("POS ordenes");
  scope = await capturePosScope(world.ownerCookie, world.seed.business.id);
}, 180_000);

afterAll(async () => {
  if (!world) return;
  const userIds = [world.seed.userId, ...world.extraUsers];
  await dropPosWorld(world);
  await retireFixtureIdentities([world], consumerIds);
  await getDb().delete(users).where(inArray(users.id, userIds));
  expect(
    await getDb()
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.id, world.seed.business.id)),
  ).toEqual([]);
  expect(
    await getDb()
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, userIds)),
  ).toEqual([]);
  expect(
    (
      await getDb().execute(
        sql`select id from merchant_auth.session where user_id in (${sql.join(
          userIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
    ).rows,
  ).toEqual([]);
}, 180_000);

describe.skipIf(!posIntegrationEnabled)(
  "POS: la orden abierta (spec 0169)",
  () => {
    it("la forma de `PosOrder` es EXACTAMENTE la del contrato (ninguna clave interna)", async () => {
      const order = await openOrderV2(world, scope, [
        { productId: world.medialuna, quantity: 2 },
      ]);
      expect(Object.keys(order).sort()).toEqual([
        "business",
        "closedAt",
        "closedBy",
        "contractVersion",
        "createdAt",
        "createdBy",
        "id",
        "items",
        "location",
        "note",
        "orderLabel",
        "sale",
        "saleType",
        "settlement",
        "status",
        "tableId",
        "tableLabel",
        "total",
        "version",
      ]);
      expect(Object.keys(order.items[0]).sort()).toEqual([
        "financialSnapshot",
        "lineId",
        "lineTotal",
        "measure",
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
        settlement: null,
        items: [expect.objectContaining({ financialSnapshot: null })],
      });
    }, 120_000);

    it("CASO 1 / ORACULO DE M1 — precio fijo: la linea existente sigue a 10.00, una NUEVA entra a 15.00", async () => {
      const product = await seedProduct(world, "Pizza fija", "10.00");
      const order = await openOrderV2(world, scope, [
        { productId: product, quantity: 1 },
      ]);
      await getDb()
        .update(products)
        .set({ unitPrice: "15.00", salesRevision: 2 })
        .where(eq(products.id, product));

      const response = await scopedPos(world.ownerCookie, scope).update(
        order.id,
        {
          version: order.version,
          saleType: order.saleType,
          orderLabel: order.orderLabel,
          tableId: null,
          locationId: world.seed.locationId,
          note: order.note,
          items: [
            {
              lineId: order.items[0].lineId,
              productId: product,
              quantity: "3",
              quantityUnit: "unit",
            },
            {
              productId: product,
              quantity: "1",
              quantityUnit: "unit",
              catalogRevision: "2",
            },
          ],
        },
      );
      expect(response.status).toBe(200);
      const edited = await response.json();
      expect(edited.version).toBe(2);
      expect(edited.items).toEqual([
        expect.objectContaining({
          lineId: order.items[0].lineId,
          unitPrice: "10",
          quantity: "3",
          lineTotal: "30.00",
        }),
        expect.objectContaining({ unitPrice: "15", quantity: "1" }),
      ]);
      expect(edited.total).toBe("45.00");
      // Y releida por la ruta de lectura, no solo la respuesta del PUT.
      const reread = await (
        await scopedPos(world.ownerCookie, scope).read(order.id)
      ).json();
      expect(
        reread.items.map((i: { unitPrice: string }) => i.unitPrice),
      ).toEqual(["10", "15"]);
    }, 120_000);

    it("CASO 2 — dos PUT con la misma version: el segundo 409 `version_conflict` con la orden actual", async () => {
      const order = await openOrderV2(world, scope, [
        { productId: world.cafe, quantity: 1 },
      ]);
      const body = (quantity: number) => ({
        version: order.version,
        saleType: order.saleType,
        orderLabel: order.orderLabel,
        tableId: null,
        locationId: world.seed.locationId,
        note: order.note,
        items: [
          {
            lineId: order.items[0].lineId,
            productId: world.cafe,
            quantity: String(quantity),
            quantityUnit: "unit",
          },
        ],
      });
      expect(
        (await scopedPos(world.ownerCookie, scope).update(order.id, body(2)))
          .status,
      ).toBe(200);
      const second = await scopedPos(world.ownerCookie, scope).update(
        order.id,
        body(5),
      );
      expect(second.status).toBe(409);
      const conflict = await second.json();
      expect(conflict.code).toBe("version_conflict");
      expect(conflict.order).toMatchObject({
        id: order.id,
        version: 2,
        items: [expect.objectContaining({ quantity: "2" })],
      });
      expect(await posRow(order.id)).toMatchObject({ version: 2 });
    }, 120_000);

    it("un `lineId` que no es de la orden → 422 `invalid_input` V2, y la orden no cambia", async () => {
      const order = await openOrderV2(world, scope, [
        { productId: world.cafe, quantity: 1 },
      ]);
      const response = await scopedPos(world.ownerCookie, scope).update(
        order.id,
        {
          version: order.version,
          saleType: order.saleType,
          orderLabel: order.orderLabel,
          tableId: null,
          locationId: world.seed.locationId,
          note: order.note,
          items: [
            {
              lineId: randomUUID(),
              productId: world.cafe,
              quantity: "1",
              quantityUnit: "unit",
            },
          ],
        },
      );
      expect(response.status).toBe(422);
      // V2 rejects an unmatched authoritative line with the input error family.
      expect((await response.json()).code).toBe("invalid_input");
      expect(await posRow(order.id)).toMatchObject({ version: 1 });
    }, 120_000);

    it("anular: open → voided; otra vez → 200 idempotente; editarla → 409 `pos_order_not_open`", async () => {
      const order = await openOrderV2(world, scope, []);
      const first = await scopedPos(world.ownerCookie, scope).void(order.id);
      expect(first.status).toBe(200);
      expect((await first.json()).status).toBe("voided");
      expect(
        (await scopedPos(world.ownerCookie, scope).void(order.id)).status,
      ).toBe(200);
      expect(await posRow(order.id)).toMatchObject({ status: "voided" });
      const edit = await scopedPos(world.ownerCookie, scope).update(order.id, {
        version: 1,
        saleType: order.saleType,
        orderLabel: "x",
        tableId: null,
        locationId: world.seed.locationId,
        note: null,
        items: [],
      });
      expect(edit.status).toBe(409);
      expect((await edit.json()).code).toBe("pos_order_not_open");
    }, 120_000);

    it("la nota: se crea, el PUT exige `note` explícita y puede conservarla, se cambia, se borra con espacios; > 1000 → 422; anulada → 409 y no cambia", async () => {
      const noteOf = async (id: string) =>
        (
          await getDb()
            .select({ note: posOrders.note })
            .from(posOrders)
            .where(eq(posOrders.id, id))
        )[0].note;
      const created = await scopedPos(world.ownerCookie, scope).create({
        createRequestId: randomUUID(),
        saleType: "pickup",
        orderLabel: "Mesa nota",
        tableId: null,
        locationId: world.seed.locationId,
        items: [],
        note: "  Factura: Ana Paz\nCI 123  ",
      });
      expect(created.status).toBe(201);
      const order = await created.json();
      expect(order.note).toBe("Factura: Ana Paz\nCI 123");

      const put = (version: number, extra: Record<string, unknown>) =>
        scopedPos(world.ownerCookie, scope).update(order.id, {
          version,
          saleType: order.saleType,
          orderLabel: order.orderLabel,
          tableId: null,
          locationId: world.seed.locationId,
          note: order.note,
          items: [],
          ...extra,
        });
      // Explicit carry-forward preserves the note; omitted note is not silently repaired.
      const missingNote = await scopedPos(world.ownerCookie, scope).update(
        order.id,
        {
          version: 1,
          saleType: order.saleType,
          orderLabel: order.orderLabel,
          locationId: world.seed.locationId,
          tableId: null,
          items: [],
        },
      );
      expect(missingNote.status).toBe(422);
      expect(await noteOf(order.id)).toBe(order.note);
      expect((await (await put(1, { note: order.note })).json()).note).toBe(
        "Factura: Ana Paz\nCI 123",
      );
      expect(
        (await (await put(2, { note: "Factura: Ana Paz, a@b.c" })).json()).note,
      ).toBe("Factura: Ana Paz, a@b.c");
      const tooLong = await put(3, { note: "x".repeat(1001) });
      expect(tooLong.status).toBe(422);
      expect(await noteOf(order.id)).toBe("Factura: Ana Paz, a@b.c");
      expect((await (await put(3, { note: "   " })).json()).note).toBeNull();
      expect(await noteOf(order.id)).toBeNull();

      await put(4, { note: "antes de anular" });
      expect(
        (await scopedPos(world.ownerCookie, scope).void(order.id)).status,
      ).toBe(200);
      const late = await put(5, { note: "despues" });
      expect(late.status).toBe(409);
      expect((await late.json()).code).toBe("pos_order_not_open");
      expect(await noteOf(order.id)).toBe("antes de anular");
    }, 120_000);

    it("el historial: abiertas mas viejas primero; la anulada en `closedToday`", async () => {
      const older = await openOrderV2(world, scope, [
        { productId: world.cafe, quantity: 2 },
      ]);
      const newer = await openOrderV2(world, scope, []);
      const voided = await openOrderV2(world, scope, []);
      await scopedPos(world.ownerCookie, scope).void(voided.id);
      const response = await scopedPos(world.ownerCookie, scope).list();
      expect(response.status).toBe(200);
      const { open, closedToday } = await response.json();
      const openIds = open.map((o: { id: string }) => o.id);
      expect(openIds.indexOf(older.id)).toBeLessThan(openIds.indexOf(newer.id));
      expect(openIds).not.toContain(voided.id);
      expect(open.find((o: { id: string }) => o.id === older.id)).toMatchObject(
        {
          total: "4.00",
          lineCount: 1,
          saleTotal: null,
        },
      );
      expect(closedToday.map((o: { id: string }) => o.id)).toContain(voided.id);
    }, 120_000);

    it("CASO 11 — producto borrado con la orden abierta: se cierra con pase y el `order_item` queda con `product_id` null", async () => {
      const product = await seedProduct(world, "Plato del dia", "8.00");
      const order = await openOrderV2(world, scope, [
        { productId: product, quantity: 1 },
      ]);
      await getDb().delete(products).where(eq(products.id, product));
      const customer = await scannedCustomer(world);

      const response = await closeWithCash(
        world.ownerCookie,
        order.id,
        {
          clientRequestId: randomUUID(),
          version: order.version,
          membershipId: customer.membershipId,
        },
        { scope: scope },
      );
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
          unitPrice: "8.000000000",
        }),
      ]);
      expect(sale.unitsGranted).toBe(80);
    }, 120_000);
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
