import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { publishSaleClosed, retryModuleEvents } from "../server/module-events";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  analyticsDailyMetrics,
  analyticsDimensionLabels,
  analyticsSourceRevisions,
  businesses,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  seedModuleWorld,
  dropModuleWorld,
  type ModuleWorld,
} from "./modules-integration-support";
import { applyAnalyticsEvent } from "../server/analytics/ingestion/apply";
import { appendModuleEvent } from "../server/module-events/append";
import { captureCountCut, validateCountCut } from "./stock/count";
const enabled =
  process.env.NEON_INTEGRATION_ISOLATED === "true" &&
  !!process.env.NEON_INTEGRATION_DATABASE_URL;
describe.runIf(enabled)(
  "AN1 exact transactional metrics",
  { timeout: 30000 },
  () => {
    let world: ModuleWorld;
    beforeAll(async () => {
      world = await seedModuleWorld("AN1 metrics");
      await getDb()
        .update(businesses)
        .set({ timezone: "America/Guayaquil" })
        .where(eq(businesses.id, world.businessId));
    }, 30000);
    afterAll(async () => {
      await dropModuleWorld(world);
    }, 30000);
    const apply = (eventType: string, payload: unknown) =>
      withDbTransaction((tx) =>
        applyAnalyticsEvent(tx, {
          id: randomUUID(),
          businessId: world.businessId,
          eventType,
          eventVersion: 1,
          payload,
        }),
      );
    it("expense replacement moves local/day/concept; deletion preserves revision tombstone", async () => {
      const id = randomUUID(),
        concept = randomUUID();
      const original = {
        eventVersion: 1,
        expenseId: id,
        revision: 1,
        paidOn: "2026-10-01",
        locationId: world.locationId,
        conceptId: concept,
        conceptName: "Alquiler",
        isFixed: true,
        amountMinor: "12345",
        currencyCode: "USD",
        minorUnit: 2,
      };
      await apply("expense.recorded", original);
      const changed = {
        ...original,
        revision: 2,
        paidOn: "2026-10-02",
        locationId: null,
        conceptId: randomUUID(),
        isFixed: false,
        amountMinor: "9876",
      };
      await apply("expense.updated", changed);
      await apply("expense.updated", changed);
      const rows = await getDb()
        .select()
        .from(analyticsDailyMetrics)
        .where(eq(analyticsDailyMetrics.businessId, world.businessId));
      expect(rows.find((r) => r.day === "2026-10-01")?.amountMinor).toBe(0n);
      expect(rows.find((r) => r.day === "2026-10-02")).toMatchObject({
        amountMinor: 9876n,
        locationId: null,
        dimensionId: changed.conceptId,
        metric: "expense_variable",
      });
      await apply("expense.deleted", { ...changed, revision: 3 });
      await apply("expense.updated", changed);
      expect(
        (
          await getDb()
            .select()
            .from(analyticsDailyMetrics)
            .where(eq(analyticsDailyMetrics.businessId, world.businessId))
        ).every((r) => r.amountMinor === 0n),
      ).toBe(true);
      expect(
        (
          await getDb()
            .select()
            .from(analyticsSourceRevisions)
            .where(eq(analyticsSourceRevisions.sourceKey, `expense:${id}`))
        )[0].sourceRevision,
      ).toBe(3);
    });
    it("commission uses business local date; same delivery twice and separate source key are safe", async () => {
      const sourceOrderId = randomUUID(),
        payload = {
          eventVersion: 1,
          sourceOrderId,
          locationId: world.locationId,
          closedAt: "2026-10-03T04:30:00Z",
          amountMinor: "275",
          currencyCode: "USD",
          minorUnit: 2,
        };
      await apply("sale.commission.frozen", payload);
      await apply("sale.commission.frozen", payload);
      expect(
        (
          await getDb()
            .select()
            .from(analyticsDailyMetrics)
            .where(
              and(
                eq(analyticsDailyMetrics.businessId, world.businessId),
                eq(analyticsDailyMetrics.metric, "payment_commission"),
              ),
            )
        )[0],
      ).toMatchObject({ day: "2026-10-02", amountMinor: 275n });
    });
    it("new events create core delivery without switches; core delivery does not block stock count", async () => {
      const sourceId = randomUUID();
      const { eventId } = await withDbTransaction((tx) =>
        appendModuleEvent(tx, {
          businessId: world.businessId,
          eventType: "sale.closed",
          sourceId,
          locationId: world.locationId,
          eventVersion: 1,
          payload: { eventVersion: 1 },
        }),
      );
      expect(
        (
          await getDb()
            .select()
            .from(moduleEventDeliveries)
            .where(
              and(
                eq(moduleEventDeliveries.eventId, eventId),
                eq(moduleEventDeliveries.subscriberId, "core.analytics"),
              ),
            )
        )[0].state,
      ).toBe("pending");
      const cut = await captureCountCut(world.businessId, world.locationId);
      await withDbTransaction((tx) =>
        validateCountCut(tx, world.businessId, world.locationId, cut),
      );
      await getDb()
        .update(moduleEventDeliveries)
        .set({ state: "pending" })
        .where(
          and(
            eq(moduleEventDeliveries.eventId, eventId),
            eq(moduleEventDeliveries.subscriberId, "recipes"),
          ),
        );
      await expect(
        withDbTransaction((tx) =>
          validateCountCut(tx, world.businessId, world.locationId, cut),
        ),
      ).rejects.toMatchObject({ code: "consumption_pending" });
      await getDb().delete(moduleEvents).where(eq(moduleEvents.id, eventId));
    });
    it("sale v2 at 23:30 local aggregates exact money/quantity idempotently", async () => {
      const sourceOrderId = randomUUID(),
        productId = randomUUID(),
        sourceLineId = randomUUID(),
        methodId = randomUUID(),
        paymentId = randomUUID();
      const settlement = buildFinancialSettlement({
        currencyCode: "USD",
        discount: null,
        lines: [{ sourceLineId, position: 0, unitPrice: "3.25", quantity: 2 }],
        payments: [{ methodId, paymentId, amount: "6.50" }],
      });
      const publication = await withDbTransaction((tx) =>
        publishSaleClosed(tx, {
          businessId: world.businessId,
          sourceOrderId,
          locationId: world.locationId,
          userId: world.ownerId,
          closedAt: new Date("2026-10-03T04:30:00Z"),
          capture: {
            captured_at: "2026-10-03T04:30:00Z",
            versions: [],
            enabled: [],
          },
          settlement,
          paymentsMetadata: [
            {
              paymentId,
              methodId,
              methodProviderId: "core",
              methodName: "Efectivo",
              chargeShape: "none",
            },
          ],
          lines: [{ sourceLineId, productId, quantity: 2 }],
        }),
      );
      expect(
        (
          await retryModuleEvents({
            businessId: world.businessId,
            eventIds: [publication.eventId],
            force: true,
          })
        ).failed,
      ).toBe(0);
      await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [publication.eventId],
        force: true,
      });
      const rows = await getDb()
        .select()
        .from(analyticsDailyMetrics)
        .where(
          and(
            eq(analyticsDailyMetrics.businessId, world.businessId),
            eq(analyticsDailyMetrics.day, "2026-10-02"),
          ),
        );
      expect(rows.find((r) => r.metric === "revenue")).toMatchObject({
        amountMinor: 650n,
        count: 1,
      });
      expect(rows.find((r) => r.metric === "product_revenue")).toMatchObject({
        amountMinor: 650n,
        count: 1,
        dimensionId: productId,
      });
      expect(rows.find((r) => r.metric === "units_sold")?.quantity).toMatch(
        /^2(?:\.0+)?$/,
      );
    });
    it("labels follow captured event time, including old accounting days and cross-source delivery order", async () => {
      const conceptId = randomUUID(),
        firstId = randomUUID(),
        secondId = randomUUID();
      const make = (
        expenseId: string,
        revision: number,
        name: string,
        capturedAt: string,
      ) =>
        withDbTransaction((tx) =>
          applyAnalyticsEvent(tx, {
            id: randomUUID(),
            businessId: world.businessId,
            eventType: "expense.updated",
            eventVersion: 1,
            capturedAt,
            payload: {
              expenseId,
              revision,
              paidOn: "2026-01-01",
              locationId: null,
              conceptId,
              conceptName: name,
              isFixed: true,
              amountMinor: "1",
              currencyCode: "USD",
              minorUnit: 2,
            },
          }),
        );
      await make(firstId, 1, "Nombre anterior", "2026-10-01T10:00:00Z");
      await make(firstId, 2, "Nombre actual", "2026-10-17T10:00:00Z");
      await make(secondId, 1, "Nombre intermedio", "2026-10-10T10:00:00Z");
      expect(
        (
          await getDb()
            .select()
            .from(analyticsDimensionLabels)
            .where(
              and(
                eq(analyticsDimensionLabels.businessId, world.businessId),
                eq(analyticsDimensionLabels.id, conceptId),
              ),
            )
        )[0].label,
      ).toBe("Nombre actual");
    });
    it("does not create deliveries or backfill predeploy events", async () => {
      const sourceId = randomUUID();
      const [old] = await getDb()
        .insert(moduleEvents)
        .values({
          businessId: world.businessId,
          eventType: "expense.recorded",
          eventVersion: 1,
          sourceId,
          locationId: null,
          payload: { eventVersion: 1 },
        })
        .returning();
      expect(
        await getDb()
          .select()
          .from(moduleEventDeliveries)
          .where(eq(moduleEventDeliveries.eventId, old.id)),
      ).toEqual([]);
      expect(
        (
          await retryModuleEvents({
            businessId: world.businessId,
            eventIds: [old.id],
            force: true,
          })
        ).claimed,
      ).toBe(0);
    });
    it("append rolls back along with its source transaction", async () => {
      const sourceId = randomUUID();
      await expect(
        withDbTransaction(async (tx) => {
          await appendModuleEvent(tx, {
            businessId: world.businessId,
            eventType: "sale.commission.frozen",
            sourceId,
            locationId: world.locationId,
            eventVersion: 1,
            payload: { eventVersion: 1 },
          });
          throw new Error("rollback");
        }),
      ).rejects.toThrow("rollback");
      expect(
        await getDb()
          .select()
          .from(moduleEvents)
          .where(eq(moduleEvents.sourceId, sourceId)),
      ).toEqual([]);
    });
  },
);
