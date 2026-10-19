import { sessions } from "@mi-pasaporte/db/schema";
import { dispatchModuleRequest } from "../../dispatch";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  consumerAccounts,
  moduleEvents,
  posOrderItems,
  posOrders,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import { listPosOrders } from "./list";
import { unitPriceOf, unitQuantityOf, lineTotalOf } from "./lines";
import {
  type PosWorld,
  dropPosWorld,
  seedLegacyOrder,
  capturePosScope,
  scopedPos,
  ordersWithItems,
  posIntegrationEnabled,
  posRow,
  seedPosWorld,
  seedProduct,
} from "./pos-integration-support";
import { closeWithCash } from "./pos-payment-integration-support";
import {
  scannedCustomer,
  welcomeCoupon,
  choose,
  redemptionsOf,
} from "../../../server/counter/coupon-cycle-support";
import {
  businessCatalog,
  purchaseShortcuts,
} from "../../../server/counter/resolve-catalog";

// Own world only. No persistent measurement fixtures, ALTERs or future-format writes.
let world: PosWorld | undefined;
let scope: string;
const consumers: string[] = [];
const own = () => world!;

describe.skipIf(!posIntegrationEnabled)(
  "0242 CP1b.1 protected unit readers",
  () => {
    beforeAll(async () => {
      world = await seedPosWorld("CP1b unit readers");
      scope = await capturePosScope(world.ownerCookie, world.seed.business.id);
    }, 180_000);
    afterAll(async () => {
      const ownerId = world?.seed.userId;
      const businessId = world?.seed.business.id;
      await dropPosWorld(world);
      if (consumers.length)
        await getDb()
          .delete(consumerAccounts)
          .where(inArray(consumerAccounts.id, consumers));
      if (ownerId) await getDb().delete(users).where(eq(users.id, ownerId));
      if (ownerId)
        expect(
          await getDb()
            .select({ id: sessions.id })
            .from(sessions)
            .where(eq(sessions.userId, ownerId)),
        ).toEqual([]);
      if (businessId)
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.id, businessId)),
        ).toEqual([]);
      if (ownerId)
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, ownerId)),
        ).toEqual([]);
      if (consumers.length)
        expect(
          await getDb()
            .select({ id: consumerAccounts.id })
            .from(consumerAccounts)
            .where(inArray(consumerAccounts.id, consumers)),
        ).toEqual([]);
    }, 180_000);

    it("uses SQL numeric(24,9) projections without changing schema and rejects incompatible precision", async () => {
      const [row] = await getDb()
        .select({
          quantity: sql<string>`2::numeric(24,9)::text`,
          maximum: sql<string>`2147483647::numeric(24,9)::text`,
          price: sql<string>`9999999999.99::numeric(24,9)::text`,
          fractional: sql<string>`1.000000001::numeric(24,9)::text`,
          zero: sql<string>`0::numeric(24,9)::text`,
        })
        .from(businesses)
        .where(eq(businesses.id, own().seed.business.id));
      expect(row.quantity).toBe("2.000000000");
      expect(unitQuantityOf(row.quantity)).toBe(2);
      expect(unitPriceOf(row.price)).toBe("9999999999.99");
      expect(lineTotalOf(row.zero, row.maximum)).toBe("0.00");
      expect(() => unitQuantityOf(row.fractional)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "pos_client_upgrade_required",
        }),
      );
      expect(() => unitPriceOf(row.fractional)).toThrow(
        expect.objectContaining({
          status: 409,
          code: "pos_client_upgrade_required",
        }),
      );
    });

    it("reads/lists extreme legacy snapshots, preserves them on note edit and adds at current legacy tariff", async () => {
      const w = own();
      const productId = await seedProduct(w, "Legacy maximum", "9999999999.99");
      const order = await seedLegacyOrder(w, [{ productId, quantity: 1 }]);
      expect(order).toMatchObject({
        total: "9999999999.99",
        items: [{ quantity: "1", unitPrice: "9999999999.99" }],
      });
      await getDb()
        .update(products)
        .set({ unitPrice: "0.00", salesRevision: 2 })
        .where(eq(products.id, productId));
      // New captures retain the V2 limit; historical 2^31−1 snapshots are mounted separately.
      const invalidCapture = await scopedPos(w.ownerCookie, scope).update(
        order.id,
        {
          version: order.version,
          saleType: order.saleType,
          orderLabel: order.orderLabel,
          tableId: null,
          locationId: w.seed.locationId,
          note: order.note,
          items: [
            {
              lineId: order.items[0].lineId,
              productId,
              quantity: "1",
              quantityUnit: "unit",
            },
            {
              productId,
              quantity: "2147483647",
              quantityUnit: "unit",
              catalogRevision: "2",
            },
          ],
        },
      );
      expect(invalidCapture.status).toBe(422);
      expect(await posRow(order.id)).toMatchObject({ version: 1 });
      const [historicalSecond] = await getDb()
        .insert(posOrderItems)
        .values({
          posOrderId: order.id,
          productId,
          nameSnapshot: "Legacy maximum",
          unitPriceSnapshot: "0",
          quantity: "2147483647",
          position: 1,
        })
        .returning();
      const response = await scopedPos(w.ownerCookie, scope).update(order.id, {
        version: order.version,
        saleType: order.saleType,
        orderLabel: order.orderLabel,
        tableId: null,
        locationId: w.seed.locationId,
        note: "Snapshot unchanged",
        items: [
          {
            lineId: order.items[0].lineId,
            productId,
            quantity: "1",
            quantityUnit: "unit",
          },
          {
            lineId: historicalSecond.id,
            productId,
            quantity: "2147483647",
            quantityUnit: "unit",
          },
        ],
      });
      expect(response.status).toBe(200);
      const edited = await response.json();
      expect(edited).toMatchObject({
        total: "9999999999.99",
        note: "Snapshot unchanged",
        items: [
          { unitPrice: "9999999999.99", quantity: "1" },
          { unitPrice: "0", quantity: "2147483647" },
        ],
      });
      expect(
        await (await scopedPos(w.ownerCookie, scope).read(order.id)).json(),
      ).toEqual(edited);
      const list = await (await scopedPos(w.ownerCookie, scope).list()).json();
      expect(list.open).toContainEqual(
        expect.objectContaining({
          id: order.id,
          total: "9999999999.99",
          lineCount: 2,
          saleTotal: null,
        }),
      );
      const legacyList = await listPosOrders(w.seed.business.id);
      expect(legacyList.open).toContainEqual(
        expect.objectContaining({
          id: order.id,
          itemCount: 2147483648,
          saleTotal: null,
        }),
      );
      const stored = await getDb()
        .select({
          price: posOrderItems.unitPriceSnapshot,
          quantity: posOrderItems.quantity,
        })
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, order.id))
        .orderBy(posOrderItems.position);
      expect(stored).toEqual([
        { price: "9999999999.990000000", quantity: "1.000000000" },
        { price: "0.000000000", quantity: "2147483647.000000000" },
      ]);
    }, 120_000);

    it("rejects actual line/aggregate creation overflow and HTTP DB-only quantity without creating orders", async () => {
      const w = own();
      const productId = await seedProduct(w, "Overflow", "9999999999.99");
      const before = await getDb()
        .select({ id: posOrders.id })
        .from(posOrders)
        .where(eq(posOrders.businessId, w.seed.business.id));
      // Preserve the exact retired V1 DB-formatted-string negative as a raw caller.
      const retired = await dispatchModuleRequest(
        "POST",
        new Request("http://localhost/api/modules/pos/orders", {
          method: "POST",
          headers: {
            cookie: w.ownerCookie,
            "X-Backoffice-Scope": scope,
            "X-Pos-Contract": "1",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            tableLabel: "Rejected",
            locationId: w.seed.locationId,
            items: [{ productId, quantity: "1.000000000" }],
          }),
        }),
        { moduleId: "pos", path: ["orders"] },
      );
      expect(retired.status).toBe(409);
      expect((await retired.json()).code).toBe("pos_client_upgrade_required");
      for (const [items, expected] of [
        [
          [
            {
              productId,
              quantity: "2",
              quantityUnit: "unit",
              catalogRevision: "1",
            },
          ],
          {
            code: "amount_out_of_range",
            error: "La cantidad, medida o tarifa no es válida.",
          },
        ],
        [
          [
            {
              productId,
              quantity: "1",
              quantityUnit: "unit",
              catalogRevision: "1",
            },
            {
              productId,
              quantity: "1",
              quantityUnit: "unit",
              catalogRevision: "1",
            },
          ],
          {
            code: "amount_out_of_range",
            error: "La cantidad, medida o tarifa no es válida.",
          },
        ],
        [
          [
            {
              productId,
              quantity: 1,
              quantityUnit: "unit",
              catalogRevision: "1",
            },
          ],
          {
            code: "invalid_quantity",
            error: "La cantidad o la unidad no es válida.",
          },
        ],
        [
          [
            {
              productId,
              quantity: "1.0000000000",
              quantityUnit: "unit",
              catalogRevision: "1",
            },
          ],
          {
            code: "invalid_quantity",
            error: "La cantidad o la unidad no es válida.",
          },
        ],
      ] as const) {
        const response = await scopedPos(w.ownerCookie, scope).create({
          createRequestId: randomUUID(),
          saleType: "pickup",
          orderLabel: "Rejected",
          locationId: w.seed.locationId,
          tableId: null,
          note: null,
          items,
        });
        expect(response.status).toBe(422);
        expect(await response.json()).toEqual(expected);
      }
      expect(
        await getDb()
          .select({ id: posOrders.id })
          .from(posOrders)
          .where(eq(posOrders.businessId, w.seed.business.id)),
      ).toEqual(before);
    }, 120_000);

    it("rolls back existing-quantity and combined-new-line overflow including header/version", async () => {
      const w = own();
      const productId = await seedProduct(w, "Legal snapshot", "5000000000.00");
      const order = await seedLegacyOrder(w, [{ productId, quantity: 1 }]);
      const before = await getDb()
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, order.id));
      const lines = await getDb()
        .select()
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, order.id));
      for (const items of [
        [
          {
            lineId: order.items[0].lineId,
            productId,
            quantity: "2",
            quantityUnit: "unit",
          },
        ],
        [
          {
            lineId: order.items[0].lineId,
            productId,
            quantity: "1",
            quantityUnit: "unit",
          },
          {
            productId,
            quantity: "1",
            quantityUnit: "unit",
            catalogRevision: "1",
          },
        ],
      ]) {
        const response = await scopedPos(w.ownerCookie, scope).update(
          order.id,
          {
            version: 1,
            saleType: order.saleType,
            orderLabel: "Must roll back",
            tableId: null,
            locationId: w.seed.locationId,
            note: "Must roll back",
            items,
          },
        );
        expect(response.status).toBe(422);
        // V2 capture/update preserves the exact measured range error family.
        expect(await response.json()).toEqual({
          code: "amount_out_of_range",
          error: "La cantidad, medida o tarifa no es válida.",
        });
        expect(
          await getDb()
            .select()
            .from(posOrders)
            .where(eq(posOrders.id, order.id)),
        ).toEqual(before);
        expect(
          await getDb()
            .select()
            .from(posOrderItems)
            .where(eq(posOrderItems.posOrderId, order.id)),
        ).toEqual(lines);
      }
    }, 120_000);

    it.each([false, true])(
      "closes exact cart, replays without duplication, pass=%s",
      async (withPass) => {
        const w = own();
        const productId = await seedProduct(w, "Exact cents", "0.10");
        const order = await seedLegacyOrder(w, [{ productId, quantity: 3 }]);
        const customer = withPass ? await scannedCustomer(w) : null;
        if (customer) consumers.push(customer.consumerId);
        const couponId = customer
          ? await welcomeCoupon(w, customer, {
              kind: "discount",
              label: "Exact cent",
              discountUnit: "amount",
              discountValue: "0.10",
            })
          : null;
        if (customer && couponId) await choose(customer, couponId);
        const body = {
          clientRequestId: randomUUID(),
          version: order.version,
          ...(customer
            ? { membershipId: customer.membershipId, coupon: { couponId } }
            : {}),
        };
        const first = await closeWithCash(w.ownerCookie, order.id, body, {
          scope,
        });
        expect(first.status).toBe(200);
        const closed = await first.json();
        expect(closed).toMatchObject({
          status: "closed",
          total: "0.30",
          items: [{ unitPrice: "0.1", quantity: "3", lineTotal: "0.30" }],
          settlement: { gross: "0.30", collected: withPass ? "0.20" : "0.30" },
        });
        const replay = await closeWithCash(w.ownerCookie, order.id, body, {
          scope,
        });
        expect(replay.status).toBe(200);
        expect(await replay.json()).toEqual(closed);
        expect(await posRow(order.id)).toMatchObject({ status: "closed" });
        const events = await getDb()
          .select({
            version: moduleEvents.eventVersion,
            payload: moduleEvents.payload,
          })
          .from(moduleEvents)
          .where(eq(moduleEvents.sourceId, order.id));
        expect(events).toHaveLength(1);
        expect(events[0].version).toBe(4);
        expect(events[0].payload).toMatchObject({ lines: [{ quantity: "3" }] });
        if (customer && couponId) {
          const sales = await ordersWithItems(
            w.seed.business.id,
            customer.consumerId,
          );
          expect(sales).toHaveLength(1);
          expect(sales[0]).toMatchObject({
            total: "0.20",
            items: [
              {
                quantity: "3.000000000",
                unitPrice: "0.100000000",
                lineTotal: "0.30",
              },
            ],
          });
          expect(await redemptionsOf(couponId)).toHaveLength(1);
          const catalog = await businessCatalog(
            w.seed.business.id,
            w.seed.locationId,
          );
          expect(
            await purchaseShortcuts(
              w.seed.business.id,
              customer.consumerId,
              w.seed.locationId,
              catalog,
            ),
          ).toMatchObject({
            lastPurchase: { items: [{ productId, quantity: 3 }] },
          });
        }
      },
      180_000,
    );
  },
);
