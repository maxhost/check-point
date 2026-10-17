import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  analyticsDailyGauges,
  analyticsDailyMetrics,
  moduleEvents,
  moduleEventDeliveries,
  stockMovements,
  businesses,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  seedProduct,
  modulesIntegrationEnabled,
  type ModuleWorld,
  callModuleRoute,
  moduleStaff,
} from "./modules-integration-support";
import { createItem, lockItem } from "./stock/items";
import {
  applyPurchase,
  recordPurchase,
  recordAdjustment,
} from "./stock/movements";
import { recordEntry, countDetail } from "./stock/entries";
import { captureCountCut, validateCountCut } from "./stock/count";
import { createRecipe } from "./recipes/server/library";
import { saveComposition } from "./recipes/server/compositions";
import { purchaseSubscription } from "./recipes/server/purchase-cost-event";
import { applyAnalyticsEvent } from "../server/analytics/ingestion/apply";
import * as append from "../server/module-events/append";
import type { PurchaseRecorded } from "./stock/server/analytics-facts";
let world: ModuleWorld, other: ModuleWorld;
const eventFor = async (sourceId: string, type: string) => {
  const [event] = await getDb()
    .select()
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.sourceId, sourceId),
        eq(moduleEvents.eventType, type),
      ),
    );
  if (!event) throw new Error("Missing expected event");
  return event;
};
const apply = async (event: Awaited<ReturnType<typeof eventFor>>) =>
  withDbTransaction((tx) =>
    applyAnalyticsEvent(tx, {
      ...event,
      capturedAt: event.createdAt.toISOString(),
    }),
  );
describe.skipIf(!modulesIntegrationEnabled)(
  "AN2 atomic stock and derived facts",
  { timeout: 30000 },
  () => {
    beforeAll(async () => {
      world = await seedModuleWorld("AN2 events");
      other = await seedModuleWorld("AN2 foreign");
      await enableModules(world, ["stock", "recipes"]);
      await enableModules(other, ["stock"]);
      await getDb()
        .update(businesses)
        .set({ timezone: "America/Guayaquil" })
        .where(eq(businesses.id, world.businessId));
    }, 30000);
    afterAll(async () => {
      vi.restoreAllMocks();
      await dropModuleWorld(world);
      await dropModuleWorld(other);
    }, 30000);
    it("purchase and batched lines append atomically with correct local, snapshot and unchanged count cut", async () => {
      const item = await createItem(world.businessId, {
        name: "Harina",
        unit: "g",
        locationId: world.locationId,
      });
      const cut = await captureCountCut(world.businessId, world.locationId);
      let rolledId = "";
      await expect(
        withDbTransaction(async (tx) => {
          const locked = await lockItem(tx, world.businessId, item.id);
          const result = await applyPurchase(tx, {
            businessId: world.businessId,
            locationId: world.locationId,
            userId: world.ownerId,
            item: locked,
            quantity: 1000n,
            cost: { totalCost: 1n, unitCost: 10000n },
            occurredAt: new Date("2026-10-15T04:30:00Z"),
            note: null,
            entryId: null,
          });
          rolledId = result.movement.id;
          expect(
            await tx
              .select()
              .from(moduleEvents)
              .where(eq(moduleEvents.sourceId, rolledId)),
          ).toHaveLength(1);
          throw new Error("rollback purchase");
        }),
      ).rejects.toThrow("rollback purchase");
      expect(
        await getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.id, rolledId)),
      ).toEqual([]);
      expect(
        await getDb()
          .select()
          .from(moduleEvents)
          .where(eq(moduleEvents.sourceId, rolledId)),
      ).toEqual([]);
      const batch = await recordEntry(world.businessId, world.ownerId, {
        locationId: world.locationId,
        occurredAt: "2026-10-15T04:30:00Z",
        lines: [
          { itemId: item.id, unit: "g", quantity: "1", totalCost: "0.01" },
          { itemId: item.id, unit: "g", quantity: "1", totalCost: "0.03" },
        ],
      });
      expect(batch.movements).toHaveLength(2);
      for (const movement of batch.movements) {
        const event = await eventFor(movement.id, "stock.purchase.recorded");
        expect(event.locationId).toBe(world.locationId);
        expect(event.payload).toMatchObject({
          movementId: movement.id,
          itemLabel: "Harina",
          itemUnit: "g",
          locationId: world.locationId,
        });
        await apply(event);
        await apply(event);
      }
      const [daily] = await getDb()
        .select()
        .from(analyticsDailyMetrics)
        .where(
          and(
            eq(analyticsDailyMetrics.businessId, world.businessId),
            eq(analyticsDailyMetrics.metric, "stock_purchase"),
          ),
        );
      expect(daily).toMatchObject({
        day: "2026-10-14",
        locationId: world.locationId,
        amountMinor: 4n,
        quantity: "2.000",
        count: 2,
      });
      expect(await captureCountCut(world.businessId, world.locationId)).toEqual(
        cut,
      );
      await withDbTransaction((tx) =>
        validateCountCut(tx, world.businessId, world.locationId, cut),
      );
      const gauges = await getDb()
        .select()
        .from(analyticsDailyGauges)
        .where(
          and(
            eq(analyticsDailyGauges.businessId, world.businessId),
            eq(analyticsDailyGauges.dimensionId, item.id),
          ),
        );
      expect(
        gauges.find((g) => g.metric === "stock_unit_cost")?.amountMinor,
      ).toBe("2.000000");
    });
    it("adjustment rolls back on append failure, emits signed gap and serves an isolated specific count", async () => {
      const item = await createItem(world.businessId, {
        name: "Conteo",
        unit: "unit",
        locationId: world.locationId,
      });
      await recordPurchase(world.businessId, world.ownerId, item.id, {
        locationId: world.locationId,
        quantity: "10",
        totalCost: "20",
      });
      const before = await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.itemId, item.id));
      const spy = vi
        .spyOn(append, "appendModuleEvent")
        .mockRejectedValueOnce(new Error("append failure"));
      await expect(
        recordAdjustment(world.businessId, world.ownerId, item.id, {
          locationId: world.locationId,
          countedQuantity: "7",
        }),
      ).rejects.toThrow("append failure");
      spy.mockRestore();
      expect(
        await getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.itemId, item.id)),
      ).toEqual(before);
      const result = await recordAdjustment(
        world.businessId,
        world.ownerId,
        item.id,
        { locationId: world.locationId, countedQuantity: "7" },
      );
      const event = await eventFor(
        result.movement.id,
        "stock.adjustment.recorded",
      );
      expect(event.payload).toMatchObject({
        locationId: world.locationId,
        countedQuantity: "7.000",
        theoreticalQuantity: "10.000",
        quantity: "-3.000",
        gapAmountMinor: "-600",
        onHandAfter: "7.000",
      });
      await apply(event);
      await apply(event);
      const [gap] = await getDb()
        .select()
        .from(analyticsDailyMetrics)
        .where(
          and(
            eq(analyticsDailyMetrics.businessId, world.businessId),
            eq(analyticsDailyMetrics.metric, "stock_count_gap"),
            eq(analyticsDailyMetrics.dimensionId, item.id),
          ),
        );
      expect(gap).toMatchObject({
        locationId: world.locationId,
        amountMinor: -600n,
        quantity: "-3.000",
      });
      expect(
        await countDetail(
          world.businessId,
          result.movement.id,
          world.locationId,
        ),
      ).toMatchObject({
        theoreticalQuantity: "10.000",
        countedQuantity: "7.000",
        quantity: "-3.000",
      });
      await expect(
        countDetail(other.businessId, result.movement.id, other.locationId),
      ).rejects.toMatchObject({ code: "count_not_found" });
      const staff = await moduleStaff(world, ["analytics"]);
      expect(
        (
          await callModuleRoute(
            "GET",
            `/api/modules/stock/counts/${result.movement.id}?locationId=${world.locationId}`,
            staff,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await callModuleRoute(
            "GET",
            `/api/modules/stock/counts/${result.movement.id}?locationId=${world.locationId}`,
            world.cookie,
          )
        ).status,
      ).toBe(200);
      await withDbTransaction((tx) =>
        validateCountCut(tx, world.businessId, world.locationId, []),
      );
    });
    it("purchase subscriber snapshots exact product costs, inherits parent and rolls derived event back with delivery transaction", async () => {
      const item = await createItem(world.businessId, {
        name: "Derivado",
        unit: "g",
        locationId: world.locationId,
      });
      await recordPurchase(world.businessId, world.ownerId, item.id, {
        locationId: world.locationId,
        quantity: "1000",
        totalCost: "1",
      });
      const recipe = await createRecipe(world.businessId, {
        name: "Masa",
        lines: [{ itemId: item.id, quantity: "200" }],
      });
      const productId = await seedProduct(world, "Muzza", "8.00");
      await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1" }],
        expectedRevisionId: null,
      });
      const result = await recordPurchase(
        world.businessId,
        world.ownerId,
        item.id,
        { locationId: world.locationId, quantity: "1000", totalCost: "2" },
      );
      const event = await eventFor(
        result.movement.id,
        "stock.purchase.recorded",
      );
      const dispatch = (
        tx: Parameters<typeof purchaseSubscription.dispatch>[0],
      ) => purchaseSubscription.dispatch(tx, event);
      await expect(
        withDbTransaction(async (tx) => {
          await dispatch(tx);
          expect(
            await tx
              .select()
              .from(moduleEvents)
              .where(
                and(
                  eq(moduleEvents.sourceId, result.movement.id),
                  eq(moduleEvents.eventType, "recipes.product_cost.changed"),
                ),
              ),
          ).toHaveLength(1);
          throw new Error("rollback derivative");
        }),
      ).rejects.toThrow("rollback derivative");
      expect(
        await getDb()
          .select()
          .from(moduleEvents)
          .where(
            and(
              eq(moduleEvents.sourceId, result.movement.id),
              eq(moduleEvents.eventType, "recipes.product_cost.changed"),
            ),
          ),
      ).toEqual([]);
      await withDbTransaction(dispatch);
      const derived = await eventFor(
        result.movement.id,
        "recipes.product_cost.changed",
      );
      expect(derived.payload).toMatchObject({
        locationId: world.locationId,
        itemUnitCostBefore: "0.001000",
        itemUnitCostAfter: "0.001500",
        products: [
          {
            productId,
            productLabel: "Muzza",
            unitCostBefore: "0.200000",
            unitCostAfter: "0.300000",
          },
        ],
      });
      expect(
        await getDb()
          .select()
          .from(moduleEventDeliveries)
          .where(
            and(
              eq(moduleEventDeliveries.eventId, derived.id),
              eq(moduleEventDeliveries.subscriberId, "core.analytics"),
            ),
          ),
      ).toHaveLength(1);
      await apply(derived);
      await apply(derived);
      const [daily] = await getDb()
        .select()
        .from(analyticsDailyMetrics)
        .where(
          and(
            eq(analyticsDailyMetrics.businessId, world.businessId),
            eq(analyticsDailyMetrics.metric, "product_unit_cost_change"),
            eq(analyticsDailyMetrics.dimensionId, productId),
          ),
        );
      expect(daily).toMatchObject({
        amountMinor: 10n,
        count: 1,
        locationId: world.locationId,
      });
      await withDbTransaction((tx) =>
        validateCountCut(tx, world.businessId, world.locationId, []),
      );
    });
    it("unknown to known product cost emits nullable snapshot without a delta or card; both unknown emits nothing", async () => {
      const item = await createItem(world.businessId, {
        name: "Primer costo",
        unit: "g",
        locationId: world.locationId,
      });
      const recipe = await createRecipe(world.businessId, {
        name: "Primera receta",
        lines: [{ itemId: item.id, quantity: "100" }],
      });
      const productId = await seedProduct(world, "Primera masa", "5.00");
      await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1" }],
        expectedRevisionId: null,
      });
      const noPrice = await recordPurchase(
        world.businessId,
        world.ownerId,
        item.id,
        { locationId: world.locationId, quantity: "1000" },
      );
      const noPriceEvent = await eventFor(
        noPrice.movement.id,
        "stock.purchase.recorded",
      );
      await withDbTransaction((tx) =>
        purchaseSubscription.dispatch(tx, noPriceEvent),
      );
      expect(
        await getDb()
          .select()
          .from(moduleEvents)
          .where(
            and(
              eq(moduleEvents.sourceId, noPrice.movement.id),
              eq(moduleEvents.eventType, "recipes.product_cost.changed"),
            ),
          ),
      ).toEqual([]);
      const first = await recordPurchase(
        world.businessId,
        world.ownerId,
        item.id,
        { locationId: world.locationId, quantity: "1000", totalCost: "2.00" },
      );
      const event = await eventFor(
        first.movement.id,
        "stock.purchase.recorded",
      );
      await withDbTransaction((tx) => purchaseSubscription.dispatch(tx, event));
      const derived = await eventFor(
        first.movement.id,
        "recipes.product_cost.changed",
      );
      expect(derived.payload).toMatchObject({
        itemUnitCostBefore: null,
        itemUnitCostAfter: "0.002000",
        products: [
          { productId, unitCostBefore: null, unitCostAfter: "0.200000" },
        ],
      });
      await apply(derived);
      expect(
        await getDb()
          .select()
          .from(analyticsDailyMetrics)
          .where(
            and(
              eq(analyticsDailyMetrics.businessId, world.businessId),
              eq(analyticsDailyMetrics.metric, "product_unit_cost_change"),
              eq(analyticsDailyMetrics.dimensionId, productId),
            ),
          ),
      ).toEqual([]);
    });
    it("gauge ignores late delivery and ties deterministically without rounding tiny zero-minor currency cost", async () => {
      const item = await createItem(world.businessId, {
        name: "Orden gauge",
        unit: "g",
        locationId: world.locationId,
      });
      const base: PurchaseRecorded = {
        eventVersion: 1,
        movementId: randomUUID(),
        itemId: item.id,
        itemLabel: "Orden gauge",
        itemUnit: "g",
        locationId: world.locationId,
        occurredAt: "2026-10-14T04:30:00Z",
        observedAt: "2026-10-17T15:00:00Z",
        quantity: "0.001",
        onHandAfter: "7.001",
        currencyCode: "COP",
        minorUnit: 0,
        totalCost: "0",
        unitCostBefore: "0.000200",
        unitCostAfter: "0.000220",
      };
      const publish = async (p: PurchaseRecorded) => {
        await withDbTransaction((tx) =>
          append.appendModuleEvent(tx, {
            businessId: world.businessId,
            eventType: "stock.purchase.recorded",
            eventVersion: 1,
            sourceId: p.movementId,
            locationId: p.locationId,
            payload: p,
          }),
        );
        return eventFor(p.movementId, "stock.purchase.recorded");
      };
      const first = await publish(base),
        second = await publish({
          ...base,
          movementId: randomUUID(),
          onHandAfter: "2.001",
          unitCostAfter: "0.000100",
        });
      const ordered = [first, second].sort((a, b) => a.id.localeCompare(b.id));
      await apply(ordered[1]);
      await apply(ordered[0]);
      await apply(
        await publish({
          ...base,
          movementId: randomUUID(),
          observedAt: "2026-10-17T14:00:00Z",
          onHandAfter: "1",
          unitCostAfter: "0.000001",
        }),
      );
      const winning = ordered[1].payload as PurchaseRecorded;
      const gauges = await getDb()
        .select()
        .from(analyticsDailyGauges)
        .where(
          and(
            eq(analyticsDailyGauges.businessId, world.businessId),
            eq(analyticsDailyGauges.dimensionId, item.id),
          ),
        );
      expect(gauges.find((g) => g.metric === "stock_on_hand")).toMatchObject({
        quantity: winning.onHandAfter,
        day: "2026-10-17",
      });
      expect(gauges.find((g) => g.metric === "stock_unit_cost")).toMatchObject({
        amountMinor: winning.unitCostAfter,
        currencyCode: "COP",
      });
    });
  },
);
