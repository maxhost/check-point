import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../counter/after-grant", () => ({ afterGrant: vi.fn() }));

import { afterGrant } from "../counter/after-grant";
import {
  type PosWorld,
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  posRow,
  seedPosWorld,
} from "./pos-integration-support";
import { readBalances } from "../counter-integration-support";
import {
  choose,
  redemptionsOf,
  scannedCustomer,
  selectionOf,
  welcomeCoupon,
} from "../counter/coupon-cycle-support";

/**
 * Spec 0169, del revisor (PASS 2026-10-08): los dos bordes del cierre que las otras suites no
 * pinnean. (1) `afterGrant` corre una vez, solo cuando el cierre CREO la venta. (2) Una clave
 * ya usada por otra venta es 409 `request_reused` y la mesa no se enlaza a esa venta ajena: con
 * cupon, el unico guard que lo corta es `pushQueueId === null` en `close.ts` (medido: sin el,
 * este caso da 503 y las demas suites siguen verdes).
 */
let a: PosWorld;
beforeAll(async () => {
  a = await seedPosWorld("POS REUSE");
}, 240_000);
afterAll(async () => {
  await dropPosWorld(a);
}, 240_000);

const cart = () => [{ productId: a.cafe, quantity: 1 }];
const spy = afterGrant as unknown as ReturnType<typeof vi.fn>;

describe.skipIf(!posIntegrationEnabled)(
  "cierre del POS: afterGrant y clave reusada",
  () => {
    it("afterGrant: una vez al crear la venta, nunca en el reintento ni sin pase", async () => {
      spy.mockClear();
      const c = await scannedCustomer(a);
      const order = await openOrder(a, cart());
      const body = {
        clientRequestId: randomUUID(),
        version: order.version,
        membershipId: c.membershipId,
      };
      expect((await pos.close(a.ownerCookie, order.id, body)).status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].id).toBe((await posRow(order.id)).orderId);
      expect(spy.mock.calls[0][0].pushQueueId).not.toBeNull();
      expect((await pos.close(a.ownerCookie, order.id, body)).status).toBe(200);
      const plain = await openOrder(a, cart());
      const noPass = { clientRequestId: randomUUID(), version: plain.version };
      expect((await pos.close(a.ownerCookie, plain.id, noPass)).status).toBe(
        200,
      );
      expect(spy).toHaveBeenCalledTimes(1);
    }, 180_000);

    it("clave ya usada por otra venta (sin y con cupon) → 409 `request_reused`; la mesa sigue abierta", async () => {
      const c1 = await scannedCustomer(a);
      const first = await openOrder(a, cart());
      const key = randomUUID();
      const firstClose = await pos.close(a.ownerCookie, first.id, {
        clientRequestId: key,
        version: first.version,
        membershipId: c1.membershipId,
      });
      expect(firstClose.status).toBe(200);

      const c2 = await scannedCustomer(a);
      const noCoupon = await openOrder(a, cart());
      const r1 = await pos.close(a.ownerCookie, noCoupon.id, {
        clientRequestId: key,
        version: noCoupon.version,
        membershipId: c2.membershipId,
      });
      expect(r1.status).toBe(409);
      expect((await r1.json()).code).toBe("request_reused");
      expect(await posRow(noCoupon.id)).toMatchObject({
        status: "open",
        orderId: null,
      });

      const couponId = await welcomeCoupon(a, c2, {
        kind: "discount",
        label: "1 off",
        discountUnit: "amount",
        discountValue: "1.00",
      });
      await choose(c2, couponId);
      const withCoupon = await openOrder(a, cart());
      const r2 = await pos.close(a.ownerCookie, withCoupon.id, {
        clientRequestId: key,
        version: withCoupon.version,
        membershipId: c2.membershipId,
        coupon: { couponId },
      });
      expect(r2.status).toBe(409);
      expect((await r2.json()).code).toBe("request_reused");
      expect(await posRow(withCoupon.id)).toMatchObject({
        status: "open",
        orderId: null,
      });
      expect(await redemptionsOf(couponId)).toEqual([]);
      expect(await selectionOf(c2)).toBe(couponId);
      expect((await readBalances(c2.membershipId)).points).toBe(0);
    }, 180_000);
  },
);
