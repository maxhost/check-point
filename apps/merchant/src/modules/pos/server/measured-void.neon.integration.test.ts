import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  businessModules,
  locations,
  memberships,
  moduleEvents,
  moduleEventDeliveries,
  posOrderItems,
  posOrders,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import { integrationEnabled } from "../../../server/counter-integration-support";
import * as append from "../../../server/module-events/append";
import { retryModuleEvents } from "../../../server/module-events/retry";
import { createPosOrderV2 } from "./measured-create";
import { voidMeasuredPosOrder } from "./measured-void";
import { getPosOrderV2 } from "./read";
import { listPosOrders } from "./list";
import { voidPosOrder } from "./orders";

// Every fixture identity is allocated before setup, so finally also cleans partial setup.
describe.skipIf(!integrationEnabled)(
  "0242 internal V2 void canonical transaction",
  () => {
    it("freezes unit snapshots, races/replays once, rolls back postappend, and delivers only void metrics", async () => {
      const business = {
        id: randomUUID(),
        currencyCode: "USD",
        status: "active",
      };
      const outsider = {
        id: randomUUID(),
        currencyCode: "USD",
        status: "active",
      };
      const userId = `void-${randomUUID()}`,
        locationId = randomUUID(),
        productId = randomUUID();
      const now = new Date();
      const db = getDb();
      const open = (empty = false) =>
        createPosOrderV2(business, userId, {
          createRequestId: randomUUID(),
          saleType: "pickup",
          orderLabel: "Frozen void",
          locationId,
          tableId: null,
          note: "Original",
          items: empty
            ? []
            : [
                {
                  productId,
                  quantity: "2",
                  quantityUnit: "unit",
                  catalogRevision: "1",
                },
              ],
        });
      const cancel = (id: string, raw?: unknown) =>
        voidMeasuredPosOrder(business, userId, id, raw, now);
      const events = () =>
        db
          .select()
          .from(moduleEvents)
          .where(eq(moduleEvents.businessId, business.id));
      const snapshot = async () =>
        (
          await db.execute(sql`
      select
      (select jsonb_agg(to_jsonb(p) order by p.id) from pos.pos_order p where business_id=${business.id}::uuid) as pos,
      (select jsonb_agg(to_jsonb(i) order by i.id) from pos.pos_order_item i join pos.pos_order p on p.id=i.pos_order_id where p.business_id=${business.id}::uuid) as lines,
      (select jsonb_agg(to_jsonb(e) order by e.id) from core.module_event e where business_id=${business.id}::uuid) as events,
      (select jsonb_agg(to_jsonb(d) order by d.event_id,d.subscriber_id) from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.business_id=${business.id}::uuid) as deliveries
    `)
        ).rows[0];
      const noSales = async () => {
        const tables = [
          "pos.order_payment",
          'core."order"',
          "core.coupon_redemption",
          "core.sale_commission",
          "core.payment_commission",
          "core.business_customer",
          "consumer.program_membership",
          "stock.movement",
        ];
        for (const table of tables)
          expect(
            (
              await db.execute(
                sql.raw(
                  `select count(*)::int as n from ${table} where business_id='${business.id}'::uuid`,
                ),
              )
            ).rows,
          ).toEqual([{ n: 0 }]);
        expect(
          (await events()).every((e) => e.eventType === "pos.order.voided"),
        ).toBe(true);
      };
      try {
        await withDbTransaction(async (tx) => {
          await tx.insert(users).values({
            id: userId,
            name: "Void owner",
            email: `${userId}@example.test`,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
          for (const b of [business, outsider])
            await tx.insert(businesses).values({
              id: b.id,
              name: "Void isolated",
              slug: `void-${b.id.slice(0, 20)}`,
              countryCode: "EC",
              timezone: "America/Guayaquil",
              currencyCode: "USD",
            });
          await tx
            .insert(memberships)
            .values({ businessId: business.id, userId, role: "owner" });
          await tx.insert(locations).values({
            id: locationId,
            businessId: business.id,
            name: "Original local",
            addressLabel: "Test",
            countryCode: "EC",
            addressSnapshot: {},
          });
          await tx.insert(businessModules).values({
            businessId: business.id,
            moduleId: "pos",
            enabled: true,
          });
          await tx.insert(products).values({
            id: productId,
            businessId: business.id,
            name: "Frozen product",
            unitPrice: "4.00",
            availableAllLocations: true,
          });
        });
        const order = await open();
        const [first, second] = await Promise.all([
          cancel(order.id, { version: 1 }),
          cancel(order.id, { version: 1 }),
        ]);
        expect(first).toEqual(second);
        expect(first).toMatchObject({
          contractVersion: 2,
          status: "voided",
          total: "8.00",
          settlement: null,
          sale: null,
          closedAt: now.toISOString(),
          items: [
            {
              name: "Frozen product",
              quantity: "2",
              unitPrice: "4",
              lineTotal: "8.00",
              measure: { kind: "unit" },
            },
          ],
        });
        const [event] = await events();
        expect(event).toMatchObject({
          eventVersion: 2,
          eventType: "pos.order.voided",
          sourceId: order.id,
          locationId,
          payload: {
            eventVersion: 2,
            amountMinor: "800",
            currencyCode: "USD",
            minorUnit: 2,
            lines: [
              {
                sourceLineId: order.items[0].lineId,
                position: 0,
                quantity: "2",
                productLabel: "Frozen product",
                money: {
                  originals: {
                    gross: { numerator: "800", denominator: "1", scale: 2 },
                  },
                },
              },
            ],
          },
        });
        expect(
          (
            await db
              .select()
              .from(posOrderItems)
              .where(eq(posOrderItems.posOrderId, order.id))
          )[0].financialSnapshot,
        ).toEqual(first.items[0].financialSnapshot);
        expect((await events()).length).toBe(1);
        expect(
          await db
            .select()
            .from(moduleEventDeliveries)
            .where(eq(moduleEventDeliveries.eventId, event.id)),
        ).toMatchObject([{ subscriberId: "core.analytics", state: "pending" }]);
        expect(
          await retryModuleEvents({
            businessId: business.id,
            eventIds: [event.id],
            force: true,
          }),
        ).toMatchObject({ applied: 1, failed: 0, pending: 0 });
        expect(
          (
            await db.execute(
              sql`select metric, amount_minor::text, currency_code, minor_unit, count from analytics.metric_contribution where business_id=${business.id}::uuid`,
            )
          ).rows,
        ).toEqual([
          {
            metric: "voided_tickets",
            amount_minor: "800",
            currency_code: "USD",
            minor_unit: 2,
            count: 1,
          },
        ]);
        const beforeReplay = await snapshot();
        await db
          .update(businesses)
          .set({ currencyCode: "JPY" })
          .where(eq(businesses.id, business.id));
        await db
          .update(products)
          .set({ name: "Changed", unitPrice: "99.00" })
          .where(eq(products.id, productId));
        await db
          .update(businessModules)
          .set({ enabled: false })
          .where(eq(businessModules.businessId, business.id));
        expect(await cancel(order.id, { version: 999 })).toEqual(first);
        expect(await snapshot()).toEqual(beforeReplay);
        expect(await getPosOrderV2(business.id, order.id)).toEqual(first);
        expect(
          (await listPosOrders(business.id, now, undefined, 2)).closedToday,
        ).toContainEqual(
          expect.objectContaining({
            id: order.id,
            total: "8.00",
            lineCount: 1,
            saleTotal: null,
          }),
        );
        await db
          .update(businessModules)
          .set({ enabled: true })
          .where(eq(businessModules.businessId, business.id));
        await db
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, business.id));
        await db
          .update(products)
          .set({ name: "Frozen product", unitPrice: "4.00" })
          .where(eq(products.id, productId));
        const stale = await open(),
          beforeStale = await snapshot();
        await expect(cancel(stale.id, { version: 2 })).rejects.toMatchObject({
          status: 409,
          code: "version_conflict",
          extra: { order: { contractVersion: 2, version: 1, id: stale.id } },
        });
        await expect(
          voidMeasuredPosOrder(outsider, userId, stale.id),
        ).rejects.toMatchObject({ status: 404, code: "unknown_pos_order" });
        expect(await snapshot()).toEqual(beforeStale);
        await db
          .update(businessModules)
          .set({ enabled: false })
          .where(eq(businessModules.businessId, business.id));
        await expect(cancel(stale.id)).rejects.toThrow();
        expect(await snapshot()).toEqual(beforeStale);
        await db
          .update(businessModules)
          .set({ enabled: true })
          .where(eq(businessModules.businessId, business.id));
        const closed = await open();
        // A closed historical POS without accreditation is a valid state; no fabricated sale.
        await db
          .update(posOrders)
          .set({ status: "closed", closedAt: now, closedByUserId: userId })
          .where(eq(posOrders.id, closed.id));
        await expect(cancel(closed.id)).rejects.toMatchObject({
          status: 409,
          code: "pos_order_not_open",
        });
        const beforeFailure = await snapshot(),
          appendReal = append.appendModuleEvent;
        let observed = false;
        const injected = vi
          .spyOn(append, "appendModuleEvent")
          .mockImplementation(async (...args) => {
            const result = await appendReal(...args);
            observed = true;
            await args[0].execute(sql`select 1/0`);
            return result;
          });
        try {
          await expect(cancel(stale.id)).rejects.toThrow();
        } finally {
          injected.mockRestore();
        }
        expect(observed).toBe(true);
        expect(await snapshot()).toEqual(beforeFailure);
        expect((await cancel(stale.id)).status).toBe("voided");
        const empty = await open(true);
        await db
          .update(businesses)
          .set({ currencyCode: "JPY" })
          .where(eq(businesses.id, business.id));
        expect(await cancel(empty.id)).toMatchObject({
          status: "voided",
          total: "0",
          business: { currencyCode: "JPY" },
          items: [],
          settlement: null,
        });
        await db
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, business.id));
        expect((await cancel(empty.id)).total).toBe("0");
        const wide = await open();
        await db
          .update(posOrderItems)
          .set({ quantity: "1", unitPriceSnapshot: "1000000000.00" })
          .where(eq(posOrderItems.posOrderId, wide.id));
        expect(await cancel(wide.id)).toMatchObject({
          total: "1000000000.00",
          items: [{ quantity: "1", unitPrice: "1000000000" }],
        });
        const zeroMinor = await open();
        await db
          .update(businesses)
          .set({ currencyCode: "JPY" })
          .where(eq(businesses.id, business.id));
        const frozenJPY = await cancel(zeroMinor.id);
        expect(frozenJPY).toMatchObject({
          total: "8",
          business: { currencyCode: "JPY" },
          items: [{ lineTotal: "8" }],
        });
        await db
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, business.id));
        expect(await cancel(zeroMinor.id)).toEqual(frozenJPY);
        expect(
          (await listPosOrders(business.id, now, "voided", 2)).closedToday,
        ).toContainEqual(
          expect.objectContaining({ id: zeroMinor.id, total: "8" }),
        );
        const legacy = await open();
        const legacyVoided = await voidPosOrder(business, userId, legacy.id);
        expect(legacyVoided).toMatchObject({ status: "voided", total: "8.00" });
        const [legacyEvent] = (await events()).filter(
          (e) => e.sourceId === legacy.id,
        );
        expect(legacyEvent.eventVersion).toBe(1);
        expect(
          await retryModuleEvents({
            businessId: business.id,
            eventIds: [legacyEvent.id],
            force: true,
          }),
        ).toMatchObject({ applied: 1, failed: 0, pending: 0 });
        expect(
          (
            await db.execute(
              sql`select metric, amount_minor::text from analytics.metric_contribution where business_id=${business.id}::uuid order by source_key`,
            )
          ).rows,
        ).toEqual([
          { metric: "voided_tickets", amount_minor: "800" },
          { metric: "voided_tickets", amount_minor: "800" },
        ]);
        await noSales();
      } finally {
        vi.restoreAllMocks();
        await db
          .delete(businesses)
          .where(inArray(businesses.id, [business.id, outsider.id]));
        await db.delete(users).where(eq(users.id, userId));
        expect(
          (
            await db.execute(
              sql`select id from core.business where id in (${business.id}::uuid, ${outsider.id}::uuid) union all select business_id from core.business_membership where business_id=${business.id}::uuid`,
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await db.execute(
              sql`select id from merchant_auth."user" where id=${userId} union all select id from merchant_auth.session where user_id=${userId}`,
            )
          ).rows,
        ).toEqual([]);
      }
    }, 180000);
  },
);
