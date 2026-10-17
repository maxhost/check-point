import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  analyticsDailyMetrics,
  analyticsCardCandidates,
  analyticsEvaluationRuns,
  analyticsCampaignSnapshots,
  analyticsDimensionLabels,
  moduleEvents,
  moduleEventDeliveries,
  orders,
  posOrders,
  programMemberships,
  campaigns,
  couponRedemptions,
} from "@mi-pasaporte/db/schema";
import {
  posIntegrationEnabled,
  seedPosWorld,
  dropPosWorld,
  openOrder,
  pos,
  seedProduct,
  type PosWorld,
} from "./pos/server/pos-integration-support";
import { closeWithCash } from "./pos/server/pos-payment-integration-support";
import {
  scannedCustomer,
  welcomeCoupon,
  choose,
} from "../server/counter/coupon-cycle-support";
import { analyticsCustomerId } from "../server/counter/analytics-events";
import { persistGrant, type PersistGrantInput } from "../server/counter/orders";
import { publishCampaignSnapshot } from "../server/marketing/analytics-events";
import { transitionCampaign } from "../server/marketing/campaign-actions";
import { enableTemplate } from "../server/marketing/template-store";
import { pauseCampaignsForBilling } from "../server/marketing/plan-brake";
import { appendModuleEvent } from "../server/module-events/append";
import {
  applyAnalyticsEvent,
  localMetricDay,
} from "../server/analytics/ingestion/apply";
import { retryModuleEvents } from "../server/module-events";
import { captureCountCut, validateCountCut } from "./stock/count";
import { callModuleRoute } from "./modules-integration-support";

describe.runIf(posIntegrationEnabled)(
  "AN3 atomic real producers and generic dedup",
  { timeout: 120_000 },
  () => {
    let world: PosWorld, cop: PosWorld;
    beforeAll(async () => {
      world = await seedPosWorld("AN3 events");
      cop = await seedPosWorld("AN3 COP", "CO", "COP");
    }, 240_000);
    afterAll(async () => {
      await dropPosWorld(world);
      await dropPosWorld(cop);
    }, 240_000);
    const events = (w = world) =>
      getDb()
        .select()
        .from(moduleEvents)
        .where(eq(moduleEvents.businessId, w.seed.business.id));
    const apply = (event: typeof moduleEvents.$inferSelect) =>
      withDbTransaction((tx) =>
        applyAnalyticsEvent(tx, {
          ...event,
          capturedAt: event.createdAt.toISOString(),
        }),
      );
    const metrics = (w = world) =>
      getDb()
        .select()
        .from(analyticsDailyMetrics)
        .where(eq(analyticsDailyMetrics.businessId, w.seed.business.id));
    it("new accreditation publishes one tenant UUIDv5 visit in the CTE; retries, welcome and rollback do not add visits", async () => {
      const customer = await scannedCustomer(world);
      expect(
        (await events()).filter((e) => e.eventType === "visit.recorded"),
      ).toHaveLength(0);
      const input: PersistGrantInput = {
        businessId: world.seed.business.id,
        locationId: null,
        programId: world.seed.programId,
        membershipId: customer.membershipId,
        consumerId: customer.consumerId,
        mode: "quick",
        total: "12.01",
        currencyCode: "USD",
        note: null,
        accrualKind: "points",
        units: 120,
        createdByUserId: world.seed.userId,
        clientRequestId: randomUUID(),
        items: [],
      };
      const granted = await persistGrant(input);
      expect(granted).toBeTruthy();
      expect(await persistGrant(input)).toBeNull();
      const [event] = (await events()).filter(
        (e) => e.eventType === "visit.recorded",
      );
      expect(event.sourceId).toBe(granted!.id);
      expect(event.locationId).toBeNull();
      expect(event.payload).toMatchObject({
        customerId: analyticsCustomerId(
          world.seed.business.id,
          customer.consumerId,
        ),
        customerLabel: expect.any(String),
        amountMinor: "1201",
        minorUnit: 2,
        locationId: null,
      });
      expect(JSON.stringify(event.payload)).not.toContain(customer.consumerId);
      expect(
        await getDb()
          .select()
          .from(moduleEventDeliveries)
          .where(eq(moduleEventDeliveries.eventId, event.id)),
      ).toMatchObject([{ subscriberId: "core.analytics", state: "pending" }]);
      const before = (
        await getDb()
          .select()
          .from(programMemberships)
          .where(eq(programMemberships.id, customer.membershipId))
      )[0].pointsBalance;
      const rollbackKey = randomUUID();
      let rollbackOrder = "";
      await expect(
        withDbTransaction(async (tx) => {
          const result = await persistGrant(
            {
              ...input,
              clientRequestId: rollbackKey,
              locationId: world.seed.locationId,
            },
            tx,
          );
          rollbackOrder = result!.id;
          expect(
            await tx
              .select()
              .from(moduleEvents)
              .where(eq(moduleEvents.sourceId, rollbackOrder)),
          ).toHaveLength(1);
          throw new Error("rollback visit");
        }),
      ).rejects.toThrow("rollback visit");
      expect(
        await getDb()
          .select()
          .from(orders)
          .where(eq(orders.clientRequestId, rollbackKey)),
      ).toHaveLength(0);
      expect(
        await getDb()
          .select()
          .from(moduleEvents)
          .where(eq(moduleEvents.sourceId, rollbackOrder)),
      ).toHaveLength(0);
      expect(
        (
          await getDb()
            .select()
            .from(programMemberships)
            .where(eq(programMemberships.id, customer.membershipId))
        )[0].pointsBalance,
      ).toBe(before);
      await apply(event);
      await apply(event);
      const rows = (await metrics()).filter((r) => r.metric === "visits");
      expect(rows).toMatchObject([
        {
          locationId: null,
          count: 1,
          amountMinor: 1201n,
          dimensionId: analyticsCustomerId(
            world.seed.business.id,
            customer.consumerId,
          ),
        },
      ]);
    });
    it("void is atomic, idempotent and captured with user/lines; the authenticated destination filters historical voids and tenants", async () => {
      const order = await openOrder(world, [
        { productId: world.cafe, quantity: 2 },
      ]);
      // Force append failure using the real unique source invariant: the status update must roll back.
      const planted = await withDbTransaction((tx) =>
        appendModuleEvent(tx, {
          businessId: world.seed.business.id,
          eventType: "pos.order.voided",
          eventVersion: 1,
          sourceId: order.id,
          locationId: world.seed.locationId,
          payload: { eventVersion: 1 },
        }),
      );
      expect((await pos.void(world.ownerCookie, order.id)).status).toBe(503);
      expect(
        (
          await getDb()
            .select()
            .from(posOrders)
            .where(eq(posOrders.id, order.id))
        )[0].status,
      ).toBe("open");
      await getDb()
        .delete(moduleEvents)
        .where(eq(moduleEvents.id, planted.eventId));
      expect((await pos.void(cop.ownerCookie, order.id)).status).toBe(404);
      expect((await pos.void(world.ownerCookie, order.id)).status).toBe(200);
      expect((await pos.void(world.ownerCookie, order.id)).status).toBe(200);
      const [event] = (await events()).filter(
        (e) => e.eventType === "pos.order.voided" && e.sourceId === order.id,
      );
      expect(event.payload).toMatchObject({
        sourceOrderId: order.id,
        userId: world.seed.userId,
        voidedAt: expect.any(String),
        amountMinor: "400",
        locationId: world.seed.locationId,
        lines: [
          {
            productId: world.cafe,
            productLabel: "Café",
            quantity: 2,
            unitPrice: "2.00",
          },
        ],
      });
      expect(
        (await events()).filter((e) => e.sourceId === order.id),
      ).toHaveLength(1);
      const cut = await captureCountCut(
        world.seed.business.id,
        world.seed.locationId,
      );
      await withDbTransaction((tx) =>
        validateCountCut(
          tx,
          world.seed.business.id,
          world.seed.locationId,
          cut,
        ),
      );
      await apply(event);
      await apply(event);
      expect(
        (await metrics()).find((r) => r.metric === "voided_tickets"),
      ).toMatchObject({
        count: 1,
        amountMinor: 400n,
        locationId: world.seed.locationId,
      });
      await getDb()
        .update(posOrders)
        .set({ closedAt: new Date(Date.now() - 2 * 86400000) })
        .where(eq(posOrders.id, order.id));
      const response = await callModuleRoute(
        "GET",
        "/api/modules/pos/orders?status=voided",
        world.ownerCookie,
      );
      expect(response.status).toBe(200);
      const history = await response.json();
      expect(history.open).toEqual([]);
      expect(
        history.closedToday.map((row: { id: string }) => row.id),
      ).toContain(order.id);
      const other = await callModuleRoute(
        "GET",
        "/api/modules/pos/orders?status=voided",
        cop.ownerCookie,
      );
      expect((await other.json()).closedToday).toEqual([]);
    });
    it("coupon and POS preserve atomic rollback and count full ticket once in both delivery orders, including line-only discounts", async () => {
      for (const first of ["sale.closed", "coupon.redeemed"]) {
        const customer = await scannedCustomer(world),
          couponId = await welcomeCoupon(world, customer, {
            kind: "free_product",
            label: "Un café gratis",
            productId: world.cafe,
          });
        await choose(customer, couponId);
        const order = await openOrder(world, [
          { productId: world.cafe, quantity: 1 },
          { productId: world.medialuna, quantity: 2 },
        ]);
        const failed = await pos.close(world.ownerCookie, order.id, {
          clientRequestId: randomUUID(),
          version: order.version,
          membershipId: customer.membershipId,
          coupon: { couponId },
          payments: [],
        });
        expect(failed.status).toBe(422);
        expect(
          (await events()).filter((e) => e.sourceId === couponId),
        ).toHaveLength(0);
        expect(
          await getDb()
            .select()
            .from(couponRedemptions)
            .where(eq(couponRedemptions.couponId, couponId)),
        ).toHaveLength(0);
        const response = await closeWithCash(world.ownerCookie, order.id, {
          clientRequestId: randomUUID(),
          version: order.version,
          membershipId: customer.membershipId,
          coupon: { couponId },
        });
        expect(response.status).toBe(200);
        const captured = await events(),
          sale = captured.find(
            (e) => e.eventType === "sale.closed" && e.sourceId === order.id,
          )!,
          coupon = captured.find(
            (e) => e.eventType === "coupon.redeemed" && e.sourceId === couponId,
          )!;
        const [redemption] = await getDb()
          .select()
          .from(couponRedemptions)
          .where(eq(couponRedemptions.couponId, couponId));
        expect(coupon.sourceId).toBe(couponId);
        expect(coupon.sourceId).not.toBe(redemption.id);
        expect(coupon.payload).toMatchObject({
          orderId: redemption.orderId,
          campaignId: world.welcomeId,
          campaignLabel: expect.any(String),
          discountMinor: "200",
          salesMinor: "700",
        });
        const sources =
          first === "sale.closed" ? [sale, coupon] : [coupon, sale];
        for (const event of [...sources, ...sources]) await apply(event);
      }
      const rows = (await metrics()).filter(
        (r) => r.dimensionId === world.welcomeId,
      );
      expect(rows.find((r) => r.metric === "promo_discount")).toMatchObject({
        amountMinor: 400n,
        count: 2,
      });
      expect(rows.find((r) => r.metric === "promo_sales")).toMatchObject({
        amountMinor: 1400n,
        count: 2,
      });
      expect(rows.find((r) => r.metric === "promo_cost")?.count).toBe(2);
      expect(
        (
          await getDb()
            .select()
            .from(analyticsDimensionLabels)
            .where(
              and(
                eq(analyticsDimensionLabels.businessId, world.seed.business.id),
                eq(analyticsDimensionLabels.id, world.welcomeId),
              ),
            )
        )[0].label,
      ).toBeTruthy();
      expect(
        (await metrics(cop)).filter((r) => r.metric.startsWith("promo")),
      ).toEqual([]);
    });
    it("COP snapshots use zero minor units and keep visits/redemption separate from POS association", async () => {
      const customer = await scannedCustomer(cop),
        product = await seedProduct(cop, "Servicio COP", "10.40"),
        couponId = await welcomeCoupon(cop, customer, {
          kind: "discount",
          label: "0.60 COP",
          discountUnit: "amount",
          discountValue: "0.60",
        });
      await choose(customer, couponId);
      const order = await openOrder(cop, [{ productId: product, quantity: 1 }]);
      const response = await closeWithCash(cop.ownerCookie, order.id, {
        clientRequestId: randomUUID(),
        version: order.version,
        membershipId: customer.membershipId,
        coupon: { couponId },
      });
      expect(response.status).toBe(200);
      const captured = await events(cop),
        coupon = captured.find(
          (e) => e.eventType === "coupon.redeemed" && e.sourceId === couponId,
        )!,
        sale = captured.find(
          (e) => e.eventType === "sale.closed" && e.sourceId === order.id,
        )!,
        visit = captured.find((e) => e.eventType === "visit.recorded")!;
      expect(coupon.payload).toMatchObject({
        discountMinor: "1",
        salesMinor: "10",
        currencyCode: "COP",
        minorUnit: 0,
      });
      expect(visit.payload).toMatchObject({ amountMinor: "10", minorUnit: 0 });
      for (const event of [coupon, sale, visit]) await apply(event);
      expect(
        (await metrics(cop)).find((r) => r.metric === "promo_sales"),
      ).toMatchObject({
        amountMinor: 10n,
        count: 1,
        minorUnit: 0,
        currencyCode: "COP",
      });
    });
    it("campaign lifecycle snapshots publish on real transitions, billing and template creation; rollback and late snapshots preserve latest", async () => {
      await transitionCampaign(
        world.seed.business.id,
        world.welcomeId,
        "pause",
      );
      await withDbTransaction((tx) =>
        pauseCampaignsForBilling(tx, cop.seed.business.id, new Date()),
      );
      const billing = (await events(cop)).find(
        (e) => e.eventType === "campaign.snapshot",
      )!;
      expect(billing.payload).toMatchObject({
        status: "paused",
        campaignId: cop.welcomeId,
      });
      const before = (await events()).length;
      await expect(
        withDbTransaction(async (tx) => {
          await tx
            .update(campaigns)
            .set({ status: "ended", endedAt: new Date() })
            .where(eq(campaigns.id, world.welcomeId));
          await publishCampaignSnapshot(
            tx,
            world.seed.business.id,
            world.welcomeId,
          );
          throw new Error("rollback campaign");
        }),
      ).rejects.toThrow("rollback campaign");
      expect((await events()).length).toBe(before);
      expect(
        (
          await getDb()
            .select()
            .from(campaigns)
            .where(eq(campaigns.id, world.welcomeId))
        )[0].status,
      ).toBe("paused");
      await transitionCampaign(world.seed.business.id, world.welcomeId, "end");
      const end = (await events()).filter(
        (e) =>
          e.eventType === "campaign.snapshot" &&
          (e.payload as { status: string }).status === "ended",
      )[0];
      expect(end.payload).toMatchObject({
        campaignId: world.welcomeId,
        status: "ended",
        endedAt: expect.any(String),
        endsAt: null,
      });
      const created = await enableTemplate(
        world.seed.business.id,
        world.seed.userId,
        "welcome",
        { couponLabel: "Otro café", couponCost: "1.23" },
      );
      expect(
        (await events()).find(
          (e) =>
            e.eventType === "campaign.snapshot" &&
            (e.payload as { campaignId: string }).campaignId === created.id,
        )?.payload,
      ).toMatchObject({ label: "Bienvenida", status: "active", endsAt: null });
      const snapshots = (await events()).filter(
        (e) =>
          e.eventType === "campaign.snapshot" &&
          (e.payload as { campaignId: string }).campaignId === world.welcomeId,
      );
      for (const event of snapshots.toReversed()) await apply(event);
      const [stored] = await getDb()
        .select()
        .from(analyticsCampaignSnapshots)
        .where(
          and(
            eq(analyticsCampaignSnapshots.businessId, world.seed.business.id),
            eq(analyticsCampaignSnapshots.campaignId, world.welcomeId),
          ),
        );
      expect(stored.status).toBe("ended");
      expect(stored.endedAt).toBeInstanceOf(Date);
      expect(
        (
          await retryModuleEvents({
            businessId: world.seed.business.id,
            eventIds: [end.id],
            force: true,
          })
        ).failed,
      ).toBe(0);
    });
    it("local day comes from the captured instant and duplicate visits on one date retain every operation and amount", async () => {
      const customerId = randomUUID();
      for (let index = 0; index < 4; index++)
        await withDbTransaction((tx) =>
          applyAnalyticsEvent(tx, {
            id: randomUUID(),
            businessId: world.seed.business.id,
            eventType: "visit.recorded",
            eventVersion: 1,
            payload: {
              eventVersion: 1,
              orderId: randomUUID(),
              customerId,
              customerLabel: "Ana",
              locationId: world.seed.locationId,
              occurredAt: "2026-10-18T04:30:00Z",
              amountMinor: "101",
              currencyCode: "USD",
              minorUnit: 2,
            },
          }),
        );
      expect(
        (await metrics()).find(
          (r) => r.metric === "visits" && r.dimensionId === customerId,
        ),
      ).toMatchObject({
        day: "2026-10-17",
        count: 4,
        quantity: "4",
        amountMinor: 404n,
        locationId: world.seed.locationId,
      });
    });
    it("late campaign delivery reconciles a ready day, sees all promo groups in the same tx and withdraws an edited finish", async () => {
      const now = new Date(),
        today = localMetricDay(now.toISOString(), "America/Guayaquil"),
        yesterdayDate = new Date(`${today}T15:00:00Z`);
      yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
      const occurredAt = yesterdayDate.toISOString(),
        campaignId = randomUUID(),
        couponId = randomUUID();
      const startsAt = new Date(
        yesterdayDate.getTime() - 7 * 86400000,
      ).toISOString();
      await getDb()
        .insert(analyticsEvaluationRuns)
        .values({
          businessId: world.seed.business.id,
          day: today,
          status: "ready",
          preparedAt: now,
        });
      const read = () =>
        getDb()
          .select()
          .from(analyticsCardCandidates)
          .where(
            and(
              eq(analyticsCardCandidates.businessId, world.seed.business.id),
              eq(analyticsCardCandidates.day, today),
              eq(analyticsCardCandidates.cardKey, "12"),
            ),
          );
      const publish = (eventType: string, payload: { eventVersion: 1 }) =>
        withDbTransaction(async (tx) => {
          const { eventId } = await appendModuleEvent(tx, {
            businessId: world.seed.business.id,
            eventType,
            eventVersion: 1,
            sourceId: randomUUID(),
            locationId: world.seed.locationId,
            payload,
          });
          const [event] = await tx
            .select()
            .from(moduleEvents)
            .where(eq(moduleEvents.id, eventId));
          await applyAnalyticsEvent(tx, {
            ...event,
            capturedAt: event.createdAt.toISOString(),
          });
          return event;
        });
      const snapshot = {
        eventVersion: 1 as const,
        campaignId,
        label: "Promo que terminó ayer",
        status: "ended",
        startsAt,
        endsAt: occurredAt,
        endedAt: occurredAt,
        capturedAt: new Date().toISOString(),
      };
      const ended = await publish("campaign.snapshot", snapshot);
      const [first] = await read();
      expect(first).toBeDefined();
      expect(first.amountMinor).toBe(0n);
      // The coupon produces its main and cost source groups before reconciliation reads this same transaction.
      const redeemed = {
        eventVersion: 1 as const,
        couponId,
        orderId: randomUUID(),
        campaignId,
        campaignLabel: snapshot.label,
        locationId: world.seed.locationId,
        occurredAt,
        discountMinor: "123",
        salesMinor: "999",
        costMinor: "45",
        currencyCode: "USD",
        minorUnit: 2,
      };
      await withDbTransaction(async (tx) => {
        const { eventId } = await appendModuleEvent(tx, {
          businessId: world.seed.business.id,
          eventType: "coupon.redeemed",
          eventVersion: 1,
          sourceId: couponId,
          locationId: world.seed.locationId,
          payload: redeemed,
        });
        const [event] = await tx
          .select()
          .from(moduleEvents)
          .where(eq(moduleEvents.id, eventId));
        await applyAnalyticsEvent(tx, {
          ...event,
          capturedAt: event.createdAt.toISOString(),
        });
        const [inside] = await tx
          .select()
          .from(analyticsCardCandidates)
          .where(eq(analyticsCardCandidates.id, first.id));
        expect(inside.amountMinor).toBe(123n);
        expect(JSON.stringify(inside.parameters)).toContain("9,99");
        expect(
          (
            await tx
              .select()
              .from(analyticsDailyMetrics)
              .where(
                and(
                  eq(analyticsDailyMetrics.businessId, world.seed.business.id),
                  eq(analyticsDailyMetrics.metric, "promo_cost"),
                  eq(analyticsDailyMetrics.dimensionId, campaignId),
                ),
              )
          )[0].amountMinor,
        ).toBe(45n);
        await applyAnalyticsEvent(tx, {
          ...event,
          capturedAt: event.createdAt.toISOString(),
        });
      });
      expect(await read()).toMatchObject([{ id: first.id, amountMinor: 123n }]);
      expect(
        (
          await getDb()
            .select()
            .from(analyticsEvaluationRuns)
            .where(
              eq(analyticsEvaluationRuns.businessId, world.seed.business.id),
            )
        )[0].status,
      ).toBe("ready");
      const edited = {
        ...snapshot,
        status: "paused",
        endedAt: null,
        endsAt: new Date(now.getTime() + 2 * 86400000).toISOString(),
        capturedAt: new Date().toISOString(),
      };
      await publish("campaign.snapshot", edited);
      expect(await read()).toHaveLength(0);
      // Late replay of the old snapshot is stale by source cursor and cannot resurrect the card.
      await apply(ended);
      expect(await read()).toHaveLength(0);
    });
  },
);
