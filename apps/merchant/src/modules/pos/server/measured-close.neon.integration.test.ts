import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import * as settlementIO from "./settlement";
import * as measuredPublisher from "../../../server/module-events/publish-measured";
import {
  businesses,
  businessModules,
  campaignCoupons,
  consumerAccounts,
  locations,
  moduleEvents,
  paymentMethods,
  posOrderItems,
  posOrderPayments,
  posOrders,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import { integrationEnabled } from "../../../server/counter-integration-support";
import {
  chooseCoupon,
  dropCouponWorld,
  newCouponCard,
  seedCouponWorld,
  type CouponCard,
  type CouponWorld,
} from "../../../server/counter-coupon-support";
import { initializePaymentMethods } from "../../../server/business/payment-catalog";
import { afterGrant } from "../../../server/counter/after-grant";
import { grantAccrual } from "../../../server/counter/grant";
import * as events from "../../../server/module-events";
import { after } from "next/server";
import { closeMeasuredPosOrder } from "./measured-close";
import { createPosOrderV2 } from "./measured-create";
import { getPosOrderV2 } from "./read";
vi.mock("../../../server/counter/after-grant", () => ({ afterGrant: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
let world: CouponWorld, foreign: CouponWorld;
let productId: string, cash: string, cardMethod: string, foreignMethod: string;
const cards: CouponCard[] = [];
async function card(percent = "25.00") {
  const c = await newCouponCard(world);
  cards.push(c);
  await getDb()
    .update(campaignCoupons)
    .set({
      kindSnapshot: "discount",
      productId: null,
      discountUnitSnapshot: "percent",
      discountValueSnapshot: percent,
    })
    .where(eq(campaignCoupons.id, c.couponId));
  await chooseCoupon(c);
  return c;
}
async function open(quantity = "2", product = productId) {
  return createPosOrderV2(world.seed.business, world.seed.userId, {
    createRequestId: randomUUID(),
    saleType: "pickup",
    orderLabel: "Frozen label",
    locationId: world.seed.locationId,
    tableId: null,
    note: "Frozen note",
    items: [
      {
        productId: product,
        quantity,
        quantityUnit: "unit",
        catalogRevision: "1",
      },
    ],
  });
}
function command(amount = "8.00", c?: CouponCard) {
  return {
    clientRequestId: randomUUID(),
    version: 1,
    ...(c
      ? { membershipId: c.membershipId, coupon: { couponId: c.couponId } }
      : {}),
    payments: amount === "0.00" ? [] : [{ methodId: cash, amount }],
  };
}
const close = (id: string, raw: unknown) =>
  closeMeasuredPosOrder(world.seed.business, world.seed.userId, id, raw);
async function state() {
  return (
    await getDb().execute(sql`
    select
    (select jsonb_agg(to_jsonb(p) order by p.id) from pos.pos_order p where business_id=${world.seed.business.id}::uuid) as pos,
    (select jsonb_agg(to_jsonb(i) order by i.id) from pos.pos_order_item i join pos.pos_order p on p.id=i.pos_order_id where p.business_id=${world.seed.business.id}::uuid) as lines,
    (select jsonb_agg(to_jsonb(p) order by p.id) from pos.order_payment p where business_id=${world.seed.business.id}::uuid) as payments,
    (select jsonb_agg(to_jsonb(o) order by o.id) from core."order" o where business_id=${world.seed.business.id}::uuid) as orders,
    (select jsonb_agg(to_jsonb(i) order by i.id) from core.order_item i join core."order" o on o.id=i.order_id where o.business_id=${world.seed.business.id}::uuid) as items,
    (select jsonb_agg(to_jsonb(m) order by m.id) from consumer.program_membership m where business_id=${world.seed.business.id}::uuid) as memberships,
    (select jsonb_agg(to_jsonb(c) order by c.consumer_id) from core.business_customer c where business_id=${world.seed.business.id}::uuid) as customers,
    (select jsonb_agg(to_jsonb(a) order by a.id) from consumer.consumer_account a where id in (select consumer_id from consumer.program_membership where business_id=${world.seed.business.id}::uuid)) as selections,
    (select jsonb_agg(to_jsonb(q) order by q.id) from consumer.wallet_push_queue q where consumer_id in (select consumer_id from consumer.program_membership where business_id=${world.seed.business.id}::uuid)) as pushes,
    (select jsonb_agg(to_jsonb(r) order by r.id) from core.coupon_redemption r where business_id=${world.seed.business.id}::uuid) as redemptions,
    (select jsonb_agg(to_jsonb(t) order by t.id) from core.campaign_turn t where business_id=${world.seed.business.id}::uuid) as turns,
    (select jsonb_agg(to_jsonb(c) order by c.id) from core.sale_commission c where business_id=${world.seed.business.id}::uuid) as commission,
    (select jsonb_agg(to_jsonb(e) order by e.id) from core.module_event e where business_id=${world.seed.business.id}::uuid) as events,
    (select jsonb_agg(to_jsonb(d) order by d.event_id,d.subscriber_id) from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.business_id=${world.seed.business.id}::uuid) as deliveries
  `)
  ).rows[0];
}
async function rejectedUnchanged(
  id: string,
  raw: unknown,
  code: string,
  status: number,
) {
  const before = await state(),
    grants = vi.mocked(afterGrant).mock.calls.length;
  await expect(close(id, raw)).rejects.toMatchObject({ code, status });
  expect(await state()).toEqual(before);
  expect(vi.mocked(afterGrant).mock.calls.length).toBe(grants);
}
describe.skipIf(!integrationEnabled)(
  "0242 internal close canonical unit transaction",
  { timeout: 120000 },
  () => {
    beforeAll(async () => {
      world = await seedCouponWorld("CP2c close", 1000);
      foreign = await seedCouponWorld("CP2c close outsider", 1000);
      for (const w of [world, foreign]) {
        await getDb().insert(businessModules).values({
          businessId: w.seed.business.id,
          moduleId: "pos",
          enabled: true,
        });
        await withDbTransaction((tx) =>
          initializePaymentMethods(tx, { businessId: w.seed.business.id }),
        );
      }
      productId = (
        await getDb()
          .insert(products)
          .values({
            businessId: world.seed.business.id,
            name: "Frozen product",
            unitPrice: "4.00",
            availableAllLocations: true,
          })
          .returning()
      )[0].id;
      cash = (
        await getDb()
          .select()
          .from(paymentMethods)
          .where(
            and(
              eq(paymentMethods.businessId, world.seed.business.id),
              eq(paymentMethods.isCash, true),
            ),
          )
      )[0].id;
      foreignMethod = (
        await getDb()
          .select()
          .from(paymentMethods)
          .where(eq(paymentMethods.businessId, foreign.seed.business.id))
      )[0].id;
      cardMethod = (
        await getDb()
          .insert(paymentMethods)
          .values({
            businessId: world.seed.business.id,
            name: "Card frozen",
            chargeShape: "none",
            isCash: false,
          })
          .returning()
      )[0].id;
    }, 180000);
    afterAll(async () => {
      vi.restoreAllMocks();
      for (const w of [world, foreign].filter(Boolean)) {
        await getDb()
          .update(posOrders)
          .set({ orderId: null })
          .where(eq(posOrders.businessId, w.seed.business.id));
        await dropCouponWorld(w);
        await getDb().delete(users).where(eq(users.id, w.seed.userId));
        expect(
          (
            await getDb().execute(
              sql`select id from core.business where id=${w.seed.business.id}::uuid union all select business_id from core.business_membership where business_id=${w.seed.business.id}::uuid`,
            )
          ).rows,
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select id from merchant_auth."user" where id=${w.seed.userId} union all select id from merchant_auth.session where user_id=${w.seed.userId}`,
            )
          ).rows,
        ).toEqual([]);
      }
      if (cards.length)
        await getDb()
          .delete(consumerAccounts)
          .where(
            inArray(
              consumerAccounts.id,
              cards.map((c) => c.consumerId),
            ),
          );
      for (const c of cards)
        expect(
          (
            await getDb().execute(
              sql`select id from consumer.consumer_account where id=${c.consumerId}::uuid union all select id from consumer.program_membership where consumer_id=${c.consumerId}::uuid union all select id from consumer.wallet_push_queue where consumer_id=${c.consumerId}::uuid`,
            )
          ).rows,
        ).toEqual([]);
    }, 180000);
    it("anonymous split payments preserve originals, source identities, financial snapshots and V4", async () => {
      const order = await open(),
        raw = {
          ...command(),
          payments: [
            { methodId: cash, amount: "3.00" },
            { methodId: cardMethod, amount: "5.00" },
          ],
        };
      const closed = await close(order.id, raw);
      expect(closed).toMatchObject({
        contractVersion: 2,
        status: "closed",
        orderLabel: "Frozen label",
        note: "Frozen note",
        sale: null,
        total: "8.00",
      });
      expect(closed.settlement!.payments.map((p) => p.originalAmount)).toEqual([
        { numerator: "300", denominator: "1", scale: 2 },
        { numerator: "500", denominator: "1", scale: 2 },
      ]);
      const [event] = await getDb()
        .select()
        .from(moduleEvents)
        .where(eq(moduleEvents.sourceId, order.id));
      expect(event.eventVersion).toBe(4);
      expect(event.payload).toMatchObject({
        sourceOrderId: order.id,
        closedAt: closed.closedAt,
        lines: [
          {
            sourceLineId: order.items[0].lineId,
            quantity: "2",
            productLabel: "Frozen product",
          },
        ],
        payments: [
          { methodName: "Efectivo", methodProviderId: "core" },
          { methodName: "Card frozen", methodProviderId: "core" },
        ],
      });
      const persisted = await getDb()
        .select()
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, order.id));
      expect(persisted[0].financialSnapshot).toEqual(
        closed.settlement!.lines[0],
      );
      expect(
        await getDb()
          .select()
          .from(posOrderPayments)
          .where(eq(posOrderPayments.posOrderId, order.id)),
      ).toHaveLength(2);
      expect(
        (
          await getDb().execute(
            sql`select * from core.sale_commission where source_order_id=${order.id}::uuid`,
          )
        ).rows,
      ).toHaveLength(1);
    });
    it("zero-minor normalization preserves ineffective originals and only effective metadata", async () => {
      await getDb()
        .update(businesses)
        .set({ currencyCode: "JPY" })
        .where(eq(businesses.id, world.seed.business.id));
      try {
        const order = await open();
        const closed = await close(order.id, {
          ...command(),
          payments: [
            { methodId: cash, amount: "0.01" },
            { methodId: cardMethod, amount: "7.99" },
          ],
        });
        expect(closed.settlement!.paymentOriginals).toHaveLength(2);
        expect(closed.settlement!.payments).toEqual([
          expect.objectContaining({ methodId: cardMethod, amount: "8" }),
        ]);
        expect(
          await getDb()
            .select()
            .from(posOrderPayments)
            .where(eq(posOrderPayments.posOrderId, order.id)),
        ).toEqual([
          expect.objectContaining({
            methodId: cardMethod,
            methodName: "Card frozen",
            amount: "8.00",
          }),
        ]);
      } finally {
        await getDb()
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, world.seed.business.id));
      }
    });
    it("anonymous zero-tariff close accepts [] and an empty cart remains open", async () => {
      const [free] = await getDb()
        .insert(products)
        .values({
          businessId: world.seed.business.id,
          name: "Free snapshot",
          unitPrice: "0.00",
          availableAllLocations: true,
        })
        .returning();
      const zero = await open("1", free.id);
      expect(await close(zero.id, command("0.00"))).toMatchObject({
        status: "closed",
        sale: null,
        settlement: { collected: "0.00", payments: [] },
      });
      const empty = await createPosOrderV2(
        world.seed.business,
        world.seed.userId,
        {
          createRequestId: randomUUID(),
          saleType: "pickup",
          orderLabel: "Empty",
          locationId: world.seed.locationId,
          tableId: null,
          note: null,
          items: [],
        },
      );
      await rejectedUnchanged(empty.id, command("0.00"), "empty_cart", 422);
    });
    it.each(["25.00", "100.00"])(
      "one coupon decision %s produces matching accreditation/settlement and zero permits []",
      async (percent) => {
        const c = await card(percent),
          order = await open(),
          amount = percent === "100.00" ? "0.00" : "6.00";
        const before = vi.mocked(afterGrant).mock.calls.length;
        const closed = await close(order.id, command(amount, c));
        expect(closed.settlement!.collected).toBe(amount);
        expect(closed.sale).toMatchObject({
          total: amount,
          unitsGranted: percent === "100.00" ? 0 : 60,
        });
        expect(vi.mocked(afterGrant).mock.calls.length).toBe(before + 1);
        const [header] = await getDb()
          .select()
          .from(posOrders)
          .where(eq(posOrders.id, order.id));
        expect(
          (
            await getDb().execute(
              sql`select total from core."order" where id=${header.orderId}::uuid`,
            )
          ).rows[0].total,
        ).toBe(amount);
        expect(
          (
            await getDb().execute(
              sql`select order_id from core.coupon_redemption where coupon_id=${c.couponId}::uuid`,
            )
          ).rows,
        ).toEqual([{ order_id: header.orderId }]);
        if (amount === "0.00") expect(closed.settlement!.payments).toEqual([]);
      },
    );
    it("membership without a coupon accredits and exclusion preserves selected coupon", async () => {
      const c = await card(),
        order = await open();
      const raw = { ...command("8.00", c), coupon: null };
      const closed = await close(order.id, raw);
      expect(closed.sale).toMatchObject({
        total: "8.00",
        unitsGranted: 80,
        coupon: null,
      });
      expect(
        (
          await getDb()
            .select()
            .from(consumerAccounts)
            .where(eq(consumerAccounts.id, c.consumerId))
        )[0].selectedCouponId,
      ).toBe(c.couponId);
    });
    it("same key race has one close/event/accreditation/after; different key is not_open", async () => {
      const c = await card(),
        order = await open(),
        raw = command("6.00", c);
      const before = vi.mocked(afterGrant).mock.calls.length;
      const results = await Promise.all([
        close(order.id, raw),
        close(order.id, raw),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(vi.mocked(afterGrant).mock.calls.length).toBe(before + 1);
      expect(
        await getDb()
          .select()
          .from(moduleEvents)
          .where(
            and(
              eq(moduleEvents.sourceId, order.id),
              eq(moduleEvents.eventType, "sale.closed"),
            ),
          ),
      ).toHaveLength(1);
      await rejectedUnchanged(
        order.id,
        command("6.00", c),
        "pos_order_not_open",
        409,
      );
      const other = await open();
      await rejectedUnchanged(other.id, raw, "request_reused", 409);
    });
    it("replay precedes retired pointers, activation, coupon and methods, with no new effects", async () => {
      const c = await card(),
        order = await open(),
        raw = command("6.00", c);
      raw.payments = [{ methodId: cardMethod, amount: "6.00" }];
      const closed = await close(order.id, raw);
      try {
        await getDb()
          .update(paymentMethods)
          .set({ status: "archived" })
          .where(eq(paymentMethods.id, cardMethod));
        await getDb()
          .update(businessModules)
          .set({ enabled: false })
          .where(eq(businessModules.businessId, world.seed.business.id));
        const before = await state(),
          grants = vi.mocked(afterGrant).mock.calls.length,
          scheduled = vi.mocked(after).mock.calls.length;
        expect(
          await close(order.id, {
            ...raw,
            version: 999,
            membershipId: randomUUID(),
            coupon: { couponId: randomUUID() },
          }),
        ).toEqual(closed);
        expect(await state()).toEqual(before);
        expect(vi.mocked(afterGrant).mock.calls.length).toBe(grants);
        expect(vi.mocked(after).mock.calls.length).toBe(scheduled);
      } finally {
        await getDb()
          .update(paymentMethods)
          .set({ status: "active" })
          .where(eq(paymentMethods.id, cardMethod));
        await getDb()
          .update(businessModules)
          .set({ enabled: true })
          .where(eq(businessModules.businessId, world.seed.business.id));
      }
    });
    it("stale version reads V2 after rollback; tenant/method/void/payment negatives write nothing", async () => {
      const order = await open();
      const raw = command();
      const error = await close(order.id, { ...raw, version: 2 }).catch(
        (e) => e,
      );
      expect(error).toMatchObject({
        status: 409,
        code: "version_conflict",
        extra: { order: { contractVersion: 2, id: order.id, version: 1 } },
      });
      await rejectedUnchanged(
        order.id,
        { ...raw, payments: [{ methodId: foreignMethod, amount: "8.00" }] },
        "payment_method_not_found",
        404,
      );
      try {
        await getDb()
          .update(paymentMethods)
          .set({ status: "archived" })
          .where(eq(paymentMethods.id, cardMethod));
        await rejectedUnchanged(
          order.id,
          { ...raw, payments: [{ methodId: cardMethod, amount: "8.00" }] },
          "payment_method_archived",
          409,
        );
      } finally {
        await getDb()
          .update(paymentMethods)
          .set({ status: "active" })
          .where(eq(paymentMethods.id, cardMethod));
      }
      await rejectedUnchanged(
        order.id,
        { ...raw, payments: [] },
        "payment_required",
        422,
      );
      await rejectedUnchanged(
        order.id,
        command("7.00"),
        "payment_sum_mismatch",
        422,
      );
      await expect(
        closeMeasuredPosOrder(
          foreign.seed.business,
          foreign.seed.userId,
          order.id,
          raw,
        ),
      ).rejects.toMatchObject({ status: 404 });
      await getDb()
        .update(posOrders)
        .set({
          status: "voided",
          closedAt: new Date(),
          closedByUserId: world.seed.userId,
        })
        .where(eq(posOrders.id, order.id));
      await rejectedUnchanged(order.id, raw, "pos_order_not_open", 409);
    });
    it("core key from another sale is request_reused with and without membership", async () => {
      const c = await card(),
        key = randomUUID();
      await grantAccrual(world.seed.business, world.seed.userId, {
        clientRequestId: key,
        membershipId: c.membershipId,
        locationId: world.seed.locationId,
        mode: "quick",
        total: "1.00",
      });
      for (const membership of [undefined, c.membershipId]) {
        const order = await open();
        await rejectedUnchanged(
          order.id,
          {
            ...command(),
            clientRequestId: key,
            ...(membership ? { membershipId: membership } : {}),
          },
          "request_reused",
          409,
        );
      }
    });
    it.each(["payments", "event"])(
      "real SQL failure after %s rolls back every effect and same attempt recovers",
      async (phase) => {
        const c = await card(),
          order = await open(),
          raw = command("6.00", c),
          before = await state();
        let observed = false;
        const fail = async (
          tx: Parameters<typeof settlementIO.persistPaymentSnapshot>[0],
        ) => {
          observed = true;
          await tx.execute(sql`select 1/0`);
        };
        const persist = settlementIO.persistPaymentSnapshot;
        const publish = measuredPublisher.publishMeasuredSaleClosed;
        const injected =
          phase === "payments"
            ? vi
                .spyOn(settlementIO, "persistPaymentSnapshot")
                .mockImplementation(async (...args) => {
                  await persist(...args);
                  await fail(args[0]);
                })
            : vi
                .spyOn(measuredPublisher, "publishMeasuredSaleClosed")
                .mockImplementation(async (...args) => {
                  const event = await publish(...args);
                  await fail(args[0]);
                  return event;
                });
        const grants = vi.mocked(afterGrant).mock.calls.length;
        try {
          await expect(close(order.id, raw)).rejects.toThrow();
        } finally {
          injected.mockRestore();
        }
        expect(observed).toBe(true);
        expect(await state()).toEqual(before);
        expect(vi.mocked(afterGrant).mock.calls.length).toBe(grants);
        expect((await close(order.id, raw)).status).toBe("closed");
      },
    );
    it("postcommit scheduling/afterGrant failure cannot turn committed close into failure or repeat grant", async () => {
      const c = await card(),
        order = await open(),
        raw = command("6.00", c);
      vi.mocked(afterGrant).mockImplementationOnce(() => {
        throw new Error("afterGrant scheduling failed");
      });
      vi.mocked(after).mockImplementationOnce(() => {
        throw new Error("outside request");
      });
      const retry = vi
        .spyOn(events, "retryModuleEvents")
        .mockRejectedValueOnce(new Error("acceleration unavailable"));
      try {
        const closed = await close(order.id, raw);
        expect(closed.status).toBe("closed");
        expect(retry).toHaveBeenCalledWith(
          expect.objectContaining({
            budgetMs: 20000,
            batchSize: 50,
            businessId: world.seed.business.id,
          }),
        );
        const before = vi.mocked(afterGrant).mock.calls.length;
        expect(await close(order.id, raw)).toEqual(closed);
        expect(vi.mocked(afterGrant).mock.calls.length).toBe(before);
      } finally {
        retry.mockRestore();
      }
    });
    it("historical archived location/catalog and wide unit tariff close from snapshots", async () => {
      const wide = (
        await getDb()
          .insert(products)
          .values({
            businessId: world.seed.business.id,
            name: "Wide tariff",
            unitPrice: "1000000000.00",
            availableAllLocations: true,
          })
          .returning()
      )[0];
      const order = await open("1", wide.id);
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, world.seed.locationId));
      await getDb()
        .update(products)
        .set({ availableAllLocations: false, unitPrice: "1.00" })
        .where(eq(products.id, wide.id));
      try {
        const closed = await close(order.id, command("1000000000.00"));
        expect(closed.items[0].unitPrice).toBe("1000000000");
        expect(closed.total).toBe("1000000000.00");
        expect(await getPosOrderV2(world.seed.business.id, order.id)).toEqual(
          closed,
        );
      } finally {
        await getDb()
          .update(locations)
          .set({ status: "active" })
          .where(eq(locations.id, world.seed.locationId));
      }
    });
  },
);
