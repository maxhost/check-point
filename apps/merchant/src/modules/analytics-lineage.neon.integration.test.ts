import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { publishSaleClosed, retryModuleEvents } from "../server/module-events";
import type { SaleClosedEventV1 } from "../server/module-events/types";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  stockItems,
  stockItemLocations,
  stockMovements,
  recipeRevisions,
  moduleEvents,
  moduleEventDeliveries,
  analyticsMetricContributions,
  analyticsDailyMetrics,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  seedModuleWorld,
  dropModuleWorld,
  seedProduct,
  enableModules,
  type ModuleWorld,
} from "./modules-integration-support";
const enabled =
  process.env.NEON_INTEGRATION_ISOLATED === "true" &&
  !!process.env.NEON_INTEGRATION_DATABASE_URL;
describe.runIf(enabled)(
  "AN1 causal deployment cutoff",
  { timeout: 30000 },
  () => {
    let world: ModuleWorld;
    beforeAll(async () => {
      world = await seedModuleWorld("AN1 lineage");
      await enableModules(world, ["stock", "recipes"]);
    }, 30000);
    afterAll(async () => {
      await dropModuleWorld(world);
    }, 30000);
    it("H2 historical sale drains Stock without analytics while a new v2 parent pending analytics remains eligible", async () => {
      const productId = await seedProduct(world, "H2 producto", "5.00");
      const [item] = await getDb()
        .insert(stockItems)
        .values({
          businessId: world.businessId,
          name: "H2 ingrediente",
          unit: "g",
        })
        .returning();
      await getDb().insert(stockItemLocations).values({
        businessId: world.businessId,
        itemId: item.id,
        locationId: world.locationId,
        weightedAverageUnitCost: "1.000000",
        weightedAverageInitializedAt: new Date(),
      });
      const [revision] = await getDb()
        .insert(recipeRevisions)
        .values({
          businessId: world.businessId,
          productId,
          lines: [{ itemId: item.id, unit: "g", quantity: "1.000" }],
        })
        .returning();
      const payload: SaleClosedEventV1 = {
        eventVersion: 1,
        sourceOrderId: randomUUID(),
        locationId: world.locationId,
        closedAt: "2026-09-01T15:00:00Z",
        userId: world.ownerId,
        lines: [
          {
            sourceLineId: randomUUID(),
            productId,
            quantity: 2,
            resourceVersions: [
              { providerId: "recipes", slot: "recipe", versionId: revision.id },
            ],
          },
        ],
      };
      const [old] = await getDb()
        .insert(moduleEvents)
        .values({
          businessId: world.businessId,
          eventType: "sale.closed",
          eventVersion: 1,
          sourceId: payload.sourceOrderId,
          locationId: world.locationId,
          payload,
        })
        .returning();
      await getDb()
        .insert(moduleEventDeliveries)
        .values({ eventId: old.id, subscriberId: "recipes", state: "pending" });
      expect(
        (
          await retryModuleEvents({
            businessId: world.businessId,
            eventIds: [old.id],
            subscriberIds: ["recipes"],
            force: true,
          })
        ).applied,
      ).toBe(1);
      const [child] = await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, payload.sourceOrderId),
            eq(moduleEvents.eventType, "recipes.consumption.applied"),
          ),
        );
      expect(
        await getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.sourceOrderId, payload.sourceOrderId)),
      ).toHaveLength(1);
      await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [child.id],
        subscriberIds: ["core.analytics"],
        force: true,
      });
      expect(
        await getDb()
          .select()
          .from(analyticsMetricContributions)
          .where(
            and(
              eq(analyticsMetricContributions.businessId, world.businessId),
              eq(
                analyticsMetricContributions.sourceKey,
                `recipes.consumption.applied:${payload.sourceOrderId}`,
              ),
            ),
          ),
      ).toEqual([]);
      expect(
        await getDb()
          .select()
          .from(moduleEventDeliveries)
          .where(
            and(
              eq(moduleEventDeliveries.eventId, child.id),
              eq(moduleEventDeliveries.subscriberId, "core.analytics"),
            ),
          ),
      ).toEqual([]);
      const sourceOrderId = randomUUID(),
        sourceLineId = randomUUID(),
        methodId = randomUUID(),
        paymentId = randomUUID();
      const settlement = buildFinancialSettlement({
        currencyCode: "USD",
        discount: null,
        lines: [{ sourceLineId, position: 0, unitPrice: "5.00", quantity: 2 }],
        payments: [{ methodId, paymentId, amount: "10.00" }],
      });
      const parent = await withDbTransaction((tx) =>
        publishSaleClosed(tx, {
          businessId: world.businessId,
          sourceOrderId,
          locationId: world.locationId,
          userId: world.ownerId,
          closedAt: new Date("2026-10-17T15:00:00Z"),
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
          capture: {
            captured_at: "2026-10-17T15:00:00Z",
            enabled: ["recipes", "stock"],
            versions: [
              {
                resourceType: "product",
                resourceId: productId,
                providerId: "recipes",
                slot: "recipe",
                versionId: revision.id,
              },
            ],
          },
          lines: [{ sourceLineId, productId, quantity: 2 }],
        }),
      );
      expect(
        (
          await retryModuleEvents({
            businessId: world.businessId,
            eventIds: [parent.eventId],
            subscriberIds: ["recipes"],
            force: true,
          })
        ).applied,
      ).toBe(1);
      expect(
        (
          await getDb()
            .select()
            .from(moduleEventDeliveries)
            .where(
              and(
                eq(moduleEventDeliveries.eventId, parent.eventId),
                eq(moduleEventDeliveries.subscriberId, "core.analytics"),
              ),
            )
        )[0].state,
      ).toBe("pending");
      const [eligibleChild] = await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, sourceOrderId),
            eq(moduleEvents.eventType, "recipes.consumption.applied"),
          ),
        );
      expect(
        (
          await retryModuleEvents({
            businessId: world.businessId,
            eventIds: [eligibleChild.id],
            subscriberIds: ["core.analytics"],
            force: true,
          })
        ).applied,
      ).toBe(1);
      expect(
        (
          await getDb()
            .select()
            .from(analyticsMetricContributions)
            .where(
              and(
                eq(analyticsMetricContributions.businessId, world.businessId),
                eq(
                  analyticsMetricContributions.sourceKey,
                  `recipes.consumption.applied:${sourceOrderId}`,
                ),
              ),
            )
        )[0].amountMinor,
      ).toBe(200n);
      expect(
        await getDb()
          .select()
          .from(analyticsDailyMetrics)
          .where(
            and(
              eq(analyticsDailyMetrics.businessId, world.businessId),
              eq(analyticsDailyMetrics.metric, "revenue"),
            ),
          ),
      ).toEqual([]);
    });
  },
);
