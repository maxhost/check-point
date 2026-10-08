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
  pushesOf,
  seedPosWorld,
} from "./pos-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { campaignCoupons } from "@mi-pasaporte/db/schema";
import { readBalances } from "../counter-integration-support";
import {
  type Customer,
  type Reward,
  choose,
  redemptionsOf,
  scannedCustomer,
  selectionOf,
  sell,
  welcomeCoupon,
} from "../counter/coupon-cycle-support";

/**
 * Spec 0169 — CERRAR una orden del POS contra Neon (casos 3 a 6). El oraculo de «la MISMA
 * acreditacion del mostrador» es comparativo: un cliente compra en el MOSTRADOR (`grantAccrual`
 * detallado) y otro, con el mismo carrito y el mismo cupon, cierra una orden del POS; las dos
 * `core.order` (unidades, saldo, lineas, total), el `coupon_redemption` y la cola de push tienen
 * que coincidir, leidas por SQL.
 */

let world: PosWorld;

beforeAll(async () => {
  world = await seedPosWorld("POS cierre");
}, 180_000);

afterAll(async () => {
  await dropPosWorld(world);
}, 180_000);

/** 2 medialunas (7.00) + 1 cafe (2.00) = 9.00 bruto. */
const cart = () => [
  { productId: world.medialuna, quantity: 2 },
  { productId: world.cafe, quantity: 1 },
];

async function closeWithPass(
  customer: Customer,
  coupon?: { couponId: string },
) {
  const order = await openOrder(world, cart(), "Mesa 4");
  const response = await pos.close(world.ownerCookie, order.id, {
    clientRequestId: randomUUID(),
    version: order.version,
    membershipId: customer.membershipId,
    ...(coupon ? { coupon } : {}),
  });
  return { order, response };
}

/** La `core.order` sin lo que naturalmente difiere entre las dos ventas (id, nota). */
const comparable = (rows: Awaited<ReturnType<typeof ordersWithItems>>) =>
  rows.map((row) => ({
    mode: row.mode,
    total: row.total,
    locationId: row.locationId,
    unitsGranted: row.unitsGranted,
    balanceAfter: row.balanceAfter,
    items: row.items,
  }));

describe.skipIf(!posIntegrationEnabled)(
  "POS: cerrar la venta (spec 0169)",
  () => {
    it("CASO 3 — sin pase: `closed`, `order_id` null, ninguna `core.order`", async () => {
      const order = await openOrder(world, cart());
      const response = await pos.close(world.ownerCookie, order.id, {
        clientRequestId: randomUUID(),
        version: order.version,
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        status: "closed",
        sale: null,
        total: "9.00",
      });
      expect(body.closedAt).not.toBeNull();
      expect(await posRow(order.id)).toMatchObject({
        status: "closed",
        orderId: null,
      });
      const { closedToday } = await (await pos.list(world.ownerCookie)).json();
      expect(closedToday).toContainEqual(
        expect.objectContaining({ id: order.id, saleTotal: null }),
      );
    }, 120_000);

    it("un cupon SIN pase → 422 `invalid_input`, y la orden sigue abierta", async () => {
      const order = await openOrder(world, cart());
      const response = await pos.close(world.ownerCookie, order.id, {
        clientRequestId: randomUUID(),
        version: order.version,
        coupon: { couponId: randomUUID() },
      });
      expect(response.status).toBe(422);
      expect((await response.json()).code).toBe("invalid_input");
      expect(await posRow(order.id)).toMatchObject({ status: "open" });
    }, 120_000);

    it("CASO 4 — con pase sin cupon: la MISMA `core.order` que el mostrador con el mismo carrito", async () => {
      const counter = await scannedCustomer(world);
      const table = await scannedCustomer(world);
      await sell(world, counter, { mode: "detailed", items: cart() }, null);

      const { order, response } = await closeWithPass(table);
      expect(response.status).toBe(200);
      const body = await response.json();

      const viaCounter = await ordersWithItems(
        world.seed.business.id,
        counter.consumerId,
      );
      const viaPos = await ordersWithItems(
        world.seed.business.id,
        table.consumerId,
      );
      expect(viaPos).toHaveLength(1);
      expect(comparable(viaPos)).toEqual(comparable(viaCounter));
      expect(viaPos[0]).toMatchObject({
        mode: "detailed",
        total: "9.00",
        unitsGranted: 90,
        note: "Mesa: Mesa 4",
        locationId: world.seed.locationId,
      });
      expect(await posRow(order.id)).toMatchObject({
        status: "closed",
        orderId: viaPos[0].id,
      });
      expect((await readBalances(table.membershipId)).points).toBe(90);
      expect(body.sale).toMatchObject({
        total: "9.00",
        grossTotal: "9.00",
        unitsGranted: 90,
        balanceAfter: 90,
        kind: "points",
        coupon: null,
      });
      // La cola de push: la misma que deja el mostrador (un `transactional` por venta).
      const kinds = async (consumerId: string) =>
        (await pushesOf(consumerId)).map((p) => p.class).sort();
      expect(await kinds(table.consumerId)).toEqual(
        await kinds(counter.consumerId),
      );
      expect(await kinds(table.consumerId)).toContain("transactional");
    }, 180_000);

    it.each<[string, Reward]>([
      [
        "descuento por monto",
        {
          kind: "discount",
          label: "2 de regalo",
          discountUnit: "amount",
          discountValue: "2.00",
        },
      ],
      [
        "extra de puntos",
        { kind: "extra_points", label: "5 puntos extra", extraUnits: 5 },
      ],
    ])(
      "CASO 5 — con cupon (%s): neto, unidades sobre el neto y `coupon_redemption.order_id` como el mostrador",
      async (_name, reward) => {
        const counter = await scannedCustomer(world);
        const table = await scannedCustomer(world);
        const counterCoupon = await welcomeCoupon(world, counter, reward);
        const tableCoupon = await welcomeCoupon(world, table, reward);
        await choose(counter, counterCoupon);
        await choose(table, tableCoupon);

        const sold = await sell(
          world,
          counter,
          { mode: "detailed", items: cart() },
          { couponId: counterCoupon },
        );
        const { order, response } = await closeWithPass(table, {
          couponId: tableCoupon,
        });
        expect(response.status).toBe(200);
        const body = await response.json();

        const viaCounter = await ordersWithItems(
          world.seed.business.id,
          counter.consumerId,
        );
        const viaPos = await ordersWithItems(
          world.seed.business.id,
          table.consumerId,
        );
        expect(comparable(viaPos)).toEqual(comparable(viaCounter));
        const [posRedemption] = await redemptionsOf(tableCoupon);
        const [counterRedemption] = await redemptionsOf(counterCoupon);
        expect(posRedemption.orderId).toBe(viaPos[0].id);
        expect(posRedemption.discountAmount).toBe(
          counterRedemption.discountAmount,
        );
        expect(await readBalances(table.membershipId)).toEqual(
          await readBalances(counter.membershipId),
        );
        expect(await selectionOf(table)).toBeNull();
        expect(await posRow(order.id)).toMatchObject({ orderId: viaPos[0].id });
        expect(body.sale).toMatchObject({
          total: sold.order.total,
          grossTotal: "9.00",
          unitsGranted: sold.order.unitsGranted,
          balanceAfter: sold.order.balanceAfter,
          coupon: sold.order.coupon,
        });
      },
      180_000,
    );

    it("CASO 6 — cupon invalido al cerrar: 409 con el codigo del veredicto; la orden sigue `open` y el saldo no se mueve", async () => {
      const table = await scannedCustomer(world);
      const couponId = await welcomeCoupon(world, table, {
        kind: "discount",
        label: "Vencido",
        discountUnit: "percent",
        discountValue: "50",
      });
      await choose(table, couponId);
      await getDb()
        .update(campaignCoupons)
        .set({
          validFrom: new Date("2026-09-01T12:00:00.000Z"),
          validUntil: new Date("2026-10-01T12:00:00.000Z"),
        })
        .where(eq(campaignCoupons.id, couponId));
      const before = await readBalances(table.membershipId);

      const { order, response } = await closeWithPass(table, { couponId });
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("coupon_expired");
      expect(await posRow(order.id)).toMatchObject({
        status: "open",
        orderId: null,
        closeRequestId: null,
        version: order.version,
      });
      expect(await readBalances(table.membershipId)).toEqual(before);
      expect(
        await ordersWithItems(world.seed.business.id, table.consumerId),
      ).toEqual([]);
      expect(await redemptionsOf(couponId)).toEqual([]);
    }, 180_000);
  },
);
