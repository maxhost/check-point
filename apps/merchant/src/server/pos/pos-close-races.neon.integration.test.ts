import { randomUUID } from "node:crypto";
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
} from "./pos-integration-support";
import { readBalances } from "../counter-integration-support";
import { scannedCustomer } from "../counter/coupon-cycle-support";

/**
 * Spec 0169 caso 7 — REINTENTO y CONCURRENCIA del cierre, contra Neon. Un solo grant, leido por
 * SQL (saldo y `core.order`), nunca por la respuesta.
 *
 * QUE SOSTIENE «UN SOLO GRANT» (medido, ver el handoff de la spec): hay dos guards hermanos.
 * (a) el `SELECT … FOR UPDATE` de la `pos_order` al abrir la transaccion del cierre, y (b) el
 * `UPDATE … WHERE status = 'open'` del final, que con 0 filas aborta la transaccion. Para dos
 * cierres con claves DISTINTAS cualquiera de los dos alcanza (el perdedor de (b) revierte su
 * grant). Para dos cierres con la MISMA clave en paralelo solo (a) da el resultado del contrato
 * —los dos 200 con la misma venta—: sin el lock, el segundo no ve el cierre del primero, intenta
 * acreditar con la misma clave y su transaccion falla con 503 (medido: `[503, 200]`). Ese es el
 * caso que distingue (a); ORACULO DE M2. Sin (a) NI (b), las claves distintas acreditan dos veces
 * (medido: `[200, 200]`).
 */

let world: PosWorld;

beforeAll(async () => {
  world = await seedPosWorld("POS carreras");
}, 180_000);

afterAll(async () => {
  await dropPosWorld(world);
}, 180_000);

/** 1 medialuna (3.50) + 1 cafe (2.00) = 5.50 → 50 puntos. */
const cart = () => [
  { productId: world.medialuna, quantity: 1 },
  { productId: world.cafe, quantity: 1 },
];

describe.skipIf(!posIntegrationEnabled)(
  "POS: reintento y carrera del cierre (spec 0169 caso 7)",
  () => {
    it("reintento secuencial con la misma clave: el mismo resultado y un solo grant", async () => {
      const customer = await scannedCustomer(world);
      const order = await openOrder(world, cart());
      const body = {
        clientRequestId: randomUUID(),
        version: order.version,
        membershipId: customer.membershipId,
      };
      const first = await pos.close(world.ownerCookie, order.id, body);
      const again = await pos.close(world.ownerCookie, order.id, body);
      expect(first.status).toBe(200);
      expect(again.status).toBe(200);
      expect(await again.json()).toEqual(await first.json());
      expect(
        await ordersWithItems(world.seed.business.id, customer.consumerId),
      ).toHaveLength(1);
      expect((await readBalances(customer.membershipId)).points).toBe(50);
    }, 120_000);

    it("ORACULO DE M2 — la MISMA clave en paralelo: los dos 200 con la misma venta, un solo grant", async () => {
      for (let round = 0; round < 3; round += 1) {
        const customer = await scannedCustomer(world);
        const order = await openOrder(world, cart());
        const body = {
          clientRequestId: randomUUID(),
          version: order.version,
          membershipId: customer.membershipId,
        };
        const [a, b] = await Promise.all([
          pos.close(world.ownerCookie, order.id, body),
          pos.close(world.ownerCookie, order.id, body),
        ]);
        expect([a.status, b.status]).toEqual([200, 200]);
        const [bodyA, bodyB] = [await a.json(), await b.json()];
        expect(bodyB.sale).toEqual(bodyA.sale);
        expect(
          await ordersWithItems(world.seed.business.id, customer.consumerId),
        ).toHaveLength(1);
        expect((await readBalances(customer.membershipId)).points).toBe(50);
      }
    }, 240_000);

    it("claves DISTINTAS en paralelo: una cierra, la otra 409 `pos_order_not_open`; el saldo sube una vez", async () => {
      for (let round = 0; round < 3; round += 1) {
        const customer = await scannedCustomer(world);
        const order = await openOrder(world, cart());
        const body = () => ({
          clientRequestId: randomUUID(),
          version: order.version,
          membershipId: customer.membershipId,
        });
        const responses = await Promise.all([
          pos.close(world.ownerCookie, order.id, body()),
          pos.close(world.ownerCookie, order.id, body()),
        ]);
        const statuses = responses.map((r) => r.status).sort();
        expect(statuses).toEqual([200, 409]);
        const loser = responses.find((r) => r.status === 409)!;
        expect((await loser.json()).code).toBe("pos_order_not_open");
        expect(
          await ordersWithItems(world.seed.business.id, customer.consumerId),
        ).toHaveLength(1);
        expect((await readBalances(customer.membershipId)).points).toBe(50);
        expect(await posRow(order.id)).toMatchObject({ status: "closed" });
      }
    }, 240_000);
  },
);
