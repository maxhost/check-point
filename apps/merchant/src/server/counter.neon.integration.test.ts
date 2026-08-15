import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "./db";
import { orderItems, orders, products } from "./schema";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";

describe.skipIf(!integrationEnabled)(
  "counter service against Neon (spec 0030)",
  () => {
    let points: Seed;

    beforeAll(async () => {
      points = await seedBusiness({
        name: "Café Puntos",
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "3.00",
      });
    }, 30_000);

    afterAll(async () => {
      await dropBusiness(points.business.id);
    });

    it("auto-enrolls a scanned non-member and never leaks the qr_token", async () => {
      const consumer = await seedConsumer();
      const first = await resolveScan(points.business, consumer.qrToken);
      expect(first.membership.justEnrolled).toBe(true);
      expect(first.membership.pointsBalance).toBe(0);
      expect(first.consumer.displayName).toBe("Marcos Pérez");

      const serialized = JSON.stringify(first);
      expect(serialized).not.toContain(consumer.qrToken);
      expect(serialized).not.toContain("qrToken");
      expect(serialized).not.toContain("webViewToken");
      expect(serialized).not.toContain("tokenHash");

      const second = await resolveScan(points.business, consumer.qrToken);
      expect(second.membership.justEnrolled).toBe(false);
      expect(second.membership.id).toBe(first.membership.id);
    }, 30_000);

    it("rejects an unknown qr_token with 422", async () => {
      await expect(
        resolveScan(points.business, "does-not-exist"),
      ).rejects.toMatchObject({ status: 422, code: "qr_unresolved" });
    });

    it("grants a detailed sale: order + items + snapshot + balance", async () => {
      const consumer = await seedConsumer();
      const resolved = await resolveScan(points.business, consumer.qrToken);
      const coffee = randomUUID();
      const bun = randomUUID();
      await getDb()
        .insert(products)
        .values([
          {
            id: coffee,
            businessId: points.business.id,
            name: "Café",
            unitPrice: "2.50",
          },
          {
            id: bun,
            businessId: points.business.id,
            name: "Medialuna",
            unitPrice: "1.25",
          },
        ]);

      const result = await grantAccrual(points.business, points.userId, {
        clientRequestId: randomUUID(),
        membershipId: resolved.membership.id,
        mode: "detailed",
        locationId: points.locationId,
        items: [
          { productId: coffee, quantity: 2 }, // 5.00
          { productId: bun, quantity: 1 }, // 1.25
        ],
      });
      // total 6.25 → floor(6.25/3)*10 = 20 pts
      expect(result.order.kind).toBe("points");
      expect(result.order.unitsGranted).toBe(20);
      expect(result.order.balanceAfter).toBe(20);

      const [order] = await getDb()
        .select()
        .from(orders)
        .where(eq(orders.membershipId, resolved.membership.id));
      expect(order.mode).toBe("detailed");
      expect(Number(order.total)).toBeCloseTo(6.25, 2);
      expect(order.locationId).toBe(points.locationId);
      const items = await getDb()
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.nameSnapshot).sort()).toEqual([
        "Café",
        "Medialuna",
      ]);
    }, 30_000);

    it("grants a quick sale: order without items, balance up", async () => {
      const consumer = await seedConsumer();
      const resolved = await resolveScan(points.business, consumer.qrToken);
      const result = await grantAccrual(points.business, points.userId, {
        clientRequestId: randomUUID(),
        membershipId: resolved.membership.id,
        mode: "quick",
        total: "9.00",
        note: "ticket 0423",
      });
      expect(result.order.unitsGranted).toBe(30); // floor(9/3)*10
      expect(result.order.balanceAfter).toBe(30);
      const [order] = await getDb()
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.membershipId, resolved.membership.id),
            eq(orders.mode, "quick"),
          ),
        );
      expect(order.note).toBe("ticket 0423");
      const items = await getDb()
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      expect(items).toHaveLength(0);
    }, 30_000);

    it("is idempotent by client_request_id: one grant, one order", async () => {
      const consumer = await seedConsumer();
      const resolved = await resolveScan(points.business, consumer.qrToken);
      const clientRequestId = randomUUID();
      const body = {
        clientRequestId,
        membershipId: resolved.membership.id,
        mode: "quick" as const,
        total: "6.00",
      };
      const first = await grantAccrual(points.business, points.userId, body);
      const second = await grantAccrual(points.business, points.userId, body);
      expect(first.order.balanceAfter).toBe(20); // floor(6/3)*10
      expect(second.order.balanceAfter).toBe(20); // NOT double-counted
      const rows = await getDb()
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.businessId, points.business.id),
            eq(orders.clientRequestId, clientRequestId),
          ),
        );
      expect(rows).toHaveLength(1);
    }, 30_000);
  },
);
