import { randomUUID } from "node:crypto";
import * as recipeSnapshot from "./recipes/server/model/captured";
import {
  readComposition,
  saveComposition,
} from "./recipes/server/compositions";
import {
  dropPosWorld,
  openOrder,
  pos,
} from "./pos/server/pos-integration-support";
import { scannedCustomer } from "../server/counter/coupon-cycle-support";
import {
  businessModules,
  diningTables,
  locations,
  moduleResourceVersions,
  posOrders,
  products,
  independentRecipeRevisions,
  recipeSaleResolutions,
  stockItems,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import { enableModules } from "./modules-integration-support";
import {
  retryModuleEvents,
  type SaleClosedEvent,
} from "../server/module-events";

import { and, eq } from "drizzle-orm";
import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { modulesIntegrationEnabled } from "./modules-integration-support";
import {
  create,
  close,
  eventOf,
  drain,
  movements,
  resetProduct,
  preparePassWorld,
  expireLeaseForRecovery,
  deliveryOf,
  holdImmediateRetry,
  world,
  localId,
  productId,
  flourId,
  put,
  setupStockLocalWorld,
  cleanupStockLocalWorld,
} from "./stock-local-integration-support";
beforeAll(setupStockLocalWorld, 180_000);
afterAll(cleanupStockLocalWorld, 180_000);
afterEach(() => vi.restoreAllMocks());
describe.skipIf(!modulesIntegrationEnabled)(
  "0227 sale → captured recipe → local stock",
  () => {
    it("atomic revision pointer, normalized250g×3, negative allowed and close/retry unique", async () => {
      holdImmediateRetry();
      expect((await put("250.000")).status).toBe(200);
      const [pointer] = await getDb()
        .select()
        .from(moduleResourceVersions)
        .where(
          and(
            eq(moduleResourceVersions.businessId, world.businessId),
            eq(moduleResourceVersions.resourceId, productId),
            eq(moduleResourceVersions.providerId, "recipes"),
          ),
        );
      const [resolution] = await getDb()
        .select()
        .from(recipeSaleResolutions)
        .where(eq(recipeSaleResolutions.id, pointer.versionId));
      const [revision] = await getDb()
        .select()
        .from(independentRecipeRevisions)
        .where(
          eq(
            independentRecipeRevisions.id,
            resolution.components[0].recipeRevisionId,
          ),
        );
      expect(revision.lines).toEqual([
        { itemId: flourId, itemName: "Harina", unit: "g", quantity: "250.000" },
      ]);
      const expansion = vi
        .spyOn(recipeSnapshot, "capturedConsumption")
        .mockImplementation(() => {
          throw new Error("Revision read unavailable");
        });
      const order = await create();
      expect(order.location.id).toBe(localId);
      const key = randomUUID();
      expect((await close(order, key)).status).toBe(200);
      const event = await eventOf(order.id);
      const payload = event.payload as SaleClosedEvent;
      expect(payload.lines[0].resourceVersions).toContainEqual({
        providerId: "recipes",
        slot: "composition",
        versionId: resolution.id,
      });
      const [stored] = await getDb()
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, order.id));
      expect(stored.status).toBe("closed");
      expect(stored.closedAt!.toISOString()).toBe(payload.closedAt);
      await expireLeaseForRecovery(event.id);
      await drain(event.id);
      expect(expansion).toHaveBeenCalled();
      expect(["pending", "processing"]).toContain(
        (await deliveryOf(event.id)).state,
      );
      // Today's recipe cannot change captured quantities; an archived ingredient still consumes.
      expect((await put("1.000")).status).toBe(200);
      await getDb()
        .update(stockItems)
        .set({ status: "archived" })
        .where(eq(stockItems.id, flourId));
      expect(await movements(order.id)).toEqual([]);
      expansion.mockRestore();
      await expireLeaseForRecovery(event.id);
      const attempts = await Promise.all([drain(event.id), drain(event.id)]);
      expect(attempts.reduce((sum, result) => sum + result.claimed, 0)).toBe(1);
      expect((await close(order, key)).status).toBe(200);
      expect((await close(order)).status).toBe(409);
      await drain(event.id);
      await expect
        .poll(async () => (await movements(order.id)).length, {
          timeout: 10000,
        })
        .toBe(1);
      const rows = await movements(order.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        kind: "consumption",
        locationId: localId,
        quantity: "-750.000",
        productId,
        sourceLineId: payload.lines[0].sourceLineId,
      });
      await getDb()
        .update(stockItems)
        .set({ status: "active" })
        .where(eq(stockItems.id, flourId));
    }, 30_000);
    it("revision expansion failure leaves sale closed and table free; recovery uses exact captured revision after product deletion", async () => {
      holdImmediateRetry();
      expect((await put("250.000")).status).toBe(200);
      const expansion = vi
        .spyOn(recipeSnapshot, "capturedConsumption")
        .mockImplementation(() => {
          throw new Error("Recipe revision expansion unavailable");
        });
      const [table] = await getDb()
        .insert(diningTables)
        .values({
          businessId: world.businessId,
          locationId: localId,
          name: "Mesa prueba",
        })
        .returning({ id: diningTables.id });
      const order = await create(3, table.id);
      // Archived local on an already open order remains the sale's local.
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, localId));
      const closed = await close(order);
      expect(closed.status).toBe(200);
      expect((await closed.json()).status).toBe("closed");
      const event = await eventOf(order.id);
      await expireLeaseForRecovery(event.id);
      await drain(event.id);
      expect(expansion).toHaveBeenCalled();
      const delivery = await deliveryOf(event.id);
      expect(["pending", "processing"]).toContain(delivery.state);
      expect(delivery.attempts).toBeGreaterThan(0);
      const occupied = await getDb()
        .select({ id: posOrders.id })
        .from(posOrders)
        .where(
          and(
            eq(posOrders.diningTableId, table.id),
            eq(posOrders.status, "open"),
          ),
        );
      expect(occupied).toEqual([]);
      expect(await movements(order.id)).toEqual([]);
      const captured = event.payload as SaleClosedEvent;
      const revisionId = captured.lines[0].resourceVersions[0].versionId;
      const [frozenResolution] = await getDb()
        .select()
        .from(recipeSaleResolutions)
        .where(eq(recipeSaleResolutions.id, revisionId));
      const [frozen] = await getDb()
        .select()
        .from(independentRecipeRevisions)
        .where(
          eq(
            independentRecipeRevisions.id,
            frozenResolution.components[0].recipeRevisionId,
          ),
        );
      expect(frozen.lines).toEqual([
        { itemId: flourId, itemName: "Harina", unit: "g", quantity: "250.000" },
      ]);
      expansion.mockRestore();
      // Recover after product deletion without consulting today's recipe or POS.
      await getDb().delete(products).where(eq(products.id, productId));
      await expireLeaseForRecovery(event.id);
      const recovery = await drain(event.id);
      expect(recovery.applied).toBe(1);
      await expect
        .poll(async () => (await movements(order.id)).length, {
          timeout: 10000,
        })
        .toBe(1);
      expect((await movements(order.id)).map((row) => row.quantity)).toEqual([
        "-750.000",
      ]);
      await getDb()
        .update(locations)
        .set({ status: "active" })
        .where(eq(locations.id, localId));
      await resetProduct();
    }, 30_000);
    it("disabled at close stays skipped after reactivation; empty recipe revision remains empty", async () => {
      expect((await put("250.000")).status).toBe(200);
      const order = await create();
      await getDb()
        .update(businessModules)
        .set({ enabled: false })
        .where(
          and(
            eq(businessModules.businessId, world.businessId),
            eq(businessModules.moduleId, "recipes"),
          ),
        );
      expect((await close(order)).status).toBe(200);
      const event = await eventOf(order.id);
      await enableModules(world, ["recipes"]);
      await drain(event.id);
      expect(await movements(order.id)).toEqual([]);
      const delivery = await deliveryOf(event.id);
      expect(delivery.state).toBe("skipped");
      expect(delivery.terminalReason).toBe("modules_disabled");
      const currentComposition = await readComposition(
        world.businessId,
        productId,
      );
      const deleted = await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [],
        expectedRevisionId: currentComposition.revisionId,
      });
      expect(deleted.recipes).toEqual([]);
      const emptyOrder = await create();
      expect((await close(emptyOrder)).status).toBe(200);
      const emptyEvent = await eventOf(emptyOrder.id);
      await drain(emptyEvent.id);
      expect(await movements(emptyOrder.id)).toEqual([]);
      const payload = emptyEvent.payload as SaleClosedEvent;
      const [resolution] = await getDb()
        .select()
        .from(recipeSaleResolutions)
        .where(
          eq(
            recipeSaleResolutions.id,
            payload.lines[0].resourceVersions[0].versionId,
          ),
        );
      expect(resolution.components).toEqual([]);
    }, 30_000);
    it("sale with customer pass accrues normally and consumes normalized recipe once", async () => {
      holdImmediateRetry();
      const withPass = await preparePassWorld();
      try {
        const customer = await scannedCustomer(withPass);
        const order = await openOrder(withPass, [
          { productId: withPass.medialuna, quantity: 3 },
        ]);
        const response = await pos.close(withPass.ownerCookie, order.id, {
          version: order.version,
          clientRequestId: randomUUID(),
          membershipId: customer.membershipId,
        });
        expect(response.status).toBe(200);
        const sale = await response.json();
        expect(sale.status).toBe("closed");
        expect(sale.sale).not.toBeNull();
        const event = await eventOf(order.id, withPass.seed.business.id);
        await expireLeaseForRecovery(event.id);
        const applied = await retryModuleEvents({
          businessId: withPass.seed.business.id,
          eventIds: [event.id],
          force: true,
          budgetMs: 20000,
        });
        expect(applied).toMatchObject({ applied: 1, failed: 0 });
        await expect
          .poll(
            async () =>
              (
                await getDb()
                  .select()
                  .from(stockMovements)
                  .where(eq(stockMovements.sourceOrderId, order.id))
              ).map((row) => row.quantity),
            { timeout: 10000 },
          )
          .toEqual(["-750.000"]);
      } finally {
        await dropPosWorld(withPass);
      }
    }, 30_000);
  },
);
