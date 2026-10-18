import { appendModuleEvent } from "../server/module-events/append";
import { freezeSaleCommission } from "../server/business/commission-close";
import { eventSubscriptions as recipeSubscriptions } from "./recipes/server/consumption";
import { metricTranslators as recipeMetrics } from "./recipes/server/metrics";
import type { SaleClosedEventV1 } from "../server/module-events/types";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { publishSaleClosed, retryModuleEvents } from "../server/module-events";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  stockItems,
  stockItemLocations,
  stockMovements,
  recipeRevisions,
  commissionRevisions,
  paymentCommissions,
  saleCommissions,
  moduleEvents,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  enableModules,
  seedModuleWorld,
  dropModuleWorld,
  seedProduct,
  type ModuleWorld,
} from "./modules-integration-support";
const enabled =
  process.env.NEON_INTEGRATION_ISOLATED === "true" &&
  !!process.env.NEON_INTEGRATION_DATABASE_URL;
describe.runIf(enabled)("AN1 atomic real producers", { timeout: 30000 }, () => {
  let world: ModuleWorld;
  beforeAll(async () => {
    world = await seedModuleWorld("AN1 origins");
    await enableModules(world, ["stock", "recipes"]);
  }, 30000);
  afterAll(async () => {
    await dropModuleWorld(world);
  }, 30000);
  const parentEvent = (payload: SaleClosedEventV1) =>
    withDbTransaction((tx) =>
      appendModuleEvent(tx, {
        businessId: world.businessId,
        eventType: "sale.closed",
        eventVersion: payload.eventVersion,
        sourceId: payload.sourceOrderId,
        locationId: payload.locationId,
        payload,
      }),
    );
  it("real commission producer omits unconfigured totals and rolls its event back with frozen origin", async () => {
    const methodId = randomUUID(),
      paymentId = randomUUID(),
      sourceLineId = randomUUID();
    const settlement = buildFinancialSettlement({
      currencyCode: "USD",
      discount: null,
      lines: [{ sourceLineId, position: 0, unitPrice: "10.00", quantity: 1 }],
      payments: [{ methodId, paymentId, amount: "10.00" }],
    });
    const metadata = {
      paymentId,
      methodId,
      methodProviderId: "core",
      methodName: "Tarjeta",
      chargeShape: "percent" as const,
    };
    const make = (
      sourceOrderId: string,
      capture: Parameters<typeof freezeSaleCommission>[1]["capture"],
    ) => ({
      businessId: world.businessId,
      sourceOrderId,
      sourceProviderId: "pos",
      locationId: world.locationId,
      settlement,
      paymentsMetadata: [metadata],
      capture,
      eventId: null,
    });
    const unconfigured = randomUUID();
    await withDbTransaction((tx) =>
      freezeSaleCommission(
        tx,
        make(unconfigured, {
          captured_at: "2026-10-17T15:00:00Z",
          enabled: [],
          versions: [],
        }),
      ),
    );
    expect(
      await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, unconfigured),
            eq(moduleEvents.eventType, "sale.commission.frozen"),
          ),
        ),
    ).toEqual([]);
    const [revision] = await getDb()
      .insert(commissionRevisions)
      .values({
        businessId: world.businessId,
        methodProviderId: "core",
        methodId,
        chargeShape: "percent",
        percent: "2.5",
      })
      .returning();
    const sourceOrderId = randomUUID();
    await expect(
      withDbTransaction(async (tx) => {
        await freezeSaleCommission(
          tx,
          make(sourceOrderId, {
            captured_at: "2026-10-17T15:00:00Z",
            enabled: [],
            versions: [
              {
                resourceType: "payment_method",
                resourceId: methodId,
                providerId: "core",
                slot: "commission",
                versionId: revision.id,
              },
            ],
          }),
        );
        expect(
          (
            await tx
              .select()
              .from(moduleEvents)
              .where(
                and(
                  eq(moduleEvents.sourceId, sourceOrderId),
                  eq(moduleEvents.eventType, "sale.commission.frozen"),
                ),
              )
          )[0].payload,
        ).toMatchObject({ amountMinor: "25" });
        throw new Error("rollback origin");
      }),
    ).rejects.toThrow("rollback origin");
    expect(
      await getDb()
        .select()
        .from(moduleEvents)
        .where(eq(moduleEvents.sourceId, sourceOrderId)),
    ).toEqual([]);
    expect(
      await getDb()
        .select()
        .from(paymentCommissions)
        .where(eq(paymentCommissions.sourceOrderId, sourceOrderId)),
    ).toEqual([]);
    expect(
      await getDb()
        .select()
        .from(saleCommissions)
        .where(eq(saleCommissions.sourceOrderId, sourceOrderId)),
    ).toEqual([]);
  });
  it("real recipe handler rolls event and movements back; missing recipe stays null and disabled modules emit no consumption", async () => {
    const productId = await seedProduct(world, "Producto con receta", "3.00");
    const [item] = await getDb()
      .insert(stockItems)
      .values({
        businessId: world.businessId,
        name: "Ingrediente real",
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
      closedAt: "2026-10-17T15:00:00Z",
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
    const parent = await parentEvent(payload);
    await expect(
      withDbTransaction(async (tx) => {
        await recipeSubscriptions[0].dispatch(tx, {
          id: parent.eventId,
          eventVersion: payload.eventVersion,
          businessId: world.businessId,
          payload,
        });
        expect(
          (
            await tx
              .select()
              .from(moduleEvents)
              .where(
                and(
                  eq(moduleEvents.sourceId, payload.sourceOrderId),
                  eq(moduleEvents.eventType, "recipes.consumption.applied"),
                ),
              )
          )[0].payload,
        ).toMatchObject({ lines: [{ cost: { amountMinor: "200" } }] });
        throw new Error("rollback recipe origin");
      }),
    ).rejects.toThrow("rollback recipe origin");
    expect(
      await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, payload.sourceOrderId),
            eq(moduleEvents.eventType, "recipes.consumption.applied"),
          ),
        ),
    ).toEqual([]);
    expect(
      await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, payload.sourceOrderId)),
    ).toEqual([]);
    const missing = {
      ...payload,
      sourceOrderId: randomUUID(),
      lines: payload.lines.map((l) => ({ ...l, resourceVersions: [] })),
    };
    const missingParent = await parentEvent(missing);
    await withDbTransaction((tx) =>
      recipeSubscriptions[0].dispatch(tx, {
        id: missingParent.eventId,
        eventVersion: missing.eventVersion,
        businessId: world.businessId,
        payload: missing,
      }),
    );
    const [consumption] = await getDb()
      .select()
      .from(moduleEvents)
      .where(
        and(
          eq(moduleEvents.sourceId, missing.sourceOrderId),
          eq(moduleEvents.eventType, "recipes.consumption.applied"),
        ),
      );
    expect(consumption.payload).toMatchObject({ lines: [{ cost: null }] });
    const consumptionTranslator = recipeMetrics.find(
      (translator) => translator.eventType === "recipes.consumption.applied",
    );
    expect(consumptionTranslator).toBeDefined();
    expect(
      consumptionTranslator!.translate({
        ...consumption,
        capturedAt: consumption.createdAt.toISOString(),
      }).rows,
    ).toEqual([]);
    const disabledId = randomUUID();
    const publication = await withDbTransaction((tx) =>
      publishSaleClosed(tx, {
        businessId: world.businessId,
        sourceOrderId: disabledId,
        locationId: world.locationId,
        userId: world.ownerId,
        closedAt: new Date(),
        capture: { captured_at: new Date(), enabled: [], versions: [] },
        lines: [{ sourceLineId: randomUUID(), productId, quantity: 1 }],
      }),
    );
    await retryModuleEvents({
      businessId: world.businessId,
      eventIds: [publication.eventId],
      force: true,
    });
    expect(
      (
        await getDb()
          .select()
          .from(moduleEventDeliveries)
          .where(
            and(
              eq(moduleEventDeliveries.eventId, publication.eventId),
              eq(moduleEventDeliveries.subscriberId, "recipes"),
            ),
          )
      )[0],
    ).toMatchObject({ state: "skipped", terminalReason: "modules_disabled" });
    expect(
      await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, disabledId),
            eq(moduleEvents.eventType, "recipes.consumption.applied"),
          ),
        ),
    ).toEqual([]);
  });
});
