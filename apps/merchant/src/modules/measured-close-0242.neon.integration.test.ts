import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  businessModules,
  moduleEventDeliveries,
  moduleEvents,
  paymentMethods,
  recipeConsumptionSources,
  stockMovements,
  users,
} from "@mi-pasaporte/db/schema";
import { createPosOrderV2 } from "./pos/server/measured-create";
import { closeMeasuredPosOrder } from "./pos/server/measured-close";
import { createRecipe } from "./recipes/server/library";
import { saveComposition } from "./recipes/server/compositions";
import { recordPurchase } from "./stock/movements";
import { saveCommission } from "../server/business/commission-config";
import { retryModuleEvents } from "../server/module-events/retry";
import type { SaleClosedEventV4 } from "../server/module-events/types";
import {
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  newItem,
  seedModuleWorld,
  seedProduct,
  type ModuleWorld,
} from "./modules-integration-support";
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
let world: ModuleWorld;
describe.skipIf(!modulesIntegrationEnabled)(
  "0242 canonical POS V2 unit close through actual Recipes/Stock/commission",
  () => {
    beforeAll(async () => {
      world = await seedModuleWorld("0242 close assembly");
      await enableModules(world, ["pos", "stock", "recipes"]);
    }, 180000);
    afterAll(async () => {
      await dropModuleWorld(world);
      if (!world) return;
      expect(
        await getDb()
          .select({ id: businesses.id })
          .from(businesses)
          .where(eq(businesses.id, world.businessId)),
      ).toEqual([]);
      expect(
        await getDb()
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, world.ownerId)),
      ).toEqual([]);
      expect(
        (
          await getDb().execute(
            sql`select id from merchant_auth.session where user_id=${world.ownerId} union all select business_id::text from core.business_membership where business_id=${world.businessId}::uuid`,
          )
        ).rows,
      ).toEqual([]);
    }, 180000);
    it("captures actual pointers, freezes commission, applies consumers once and replays after pointer/activation changes", async () => {
      const item = await newItem(world, "Actual close ingredient");
      await recordPurchase(world.businessId, world.ownerId, item.id, {
        locationId: world.locationId,
        quantity: "10",
        totalCost: "20.00",
      });
      const recipe = await createRecipe(world.businessId, {
        name: "Actual close recipe",
        lines: [{ itemId: item.id, quantity: "1.000" }],
      });
      const productId = await seedProduct(world, "Actual unit close", "10.00");
      const composition = await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
      });
      const [method] = await getDb()
        .insert(paymentMethods)
        .values({
          businessId: world.businessId,
          name: "Configured percent",
          chargeShape: "percent",
          isCash: false,
        })
        .returning();
      const commission = await saveCommission(world.businessId, method.id, {
        expectedRevisionId: null,
        percent: "2.50",
      });
      const business = {
        id: world.businessId,
        currencyCode: "USD",
        status: "active" as const,
      };
      const order = await createPosOrderV2(business, world.ownerId, {
        createRequestId: randomUUID(),
        saleType: "counter",
        orderLabel: "",
        locationId: world.locationId,
        tableId: null,
        note: null,
        items: [
          {
            productId,
            quantity: "2",
            quantityUnit: "unit",
            catalogRevision: "1",
          },
        ],
      });
      const raw = {
        clientRequestId: randomUUID(),
        version: 1,
        payments: [{ methodId: method.id, amount: "20.00" }],
      };
      const closed = await closeMeasuredPosOrder(
        business,
        world.ownerId,
        order.id,
        raw,
      );
      expect(closed).toMatchObject({
        contractVersion: 2,
        saleType: "counter",
        status: "closed",
        total: "20.00",
        orderLabel: order.orderLabel,
      });
      const [sale] = await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, order.id),
            eq(moduleEvents.eventType, "sale.closed"),
          ),
        );
      const payload = sale.payload as SaleClosedEventV4;
      expect(sale.eventVersion).toBe(4);
      expect(payload.lines[0]).toMatchObject({
        sourceLineId: order.items[0].lineId,
        quantity: "2",
        commissionMinor: "50",
        resourceVersions: [
          {
            providerId: "recipes",
            slot: "composition",
            versionId: composition.resolutionId,
          },
        ],
      });
      expect(payload.payments[0].resourceVersions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ providerId: "core", slot: "commission" }),
        ]),
      );
      expect(
        (
          await getDb().execute(
            sql`select total, state, collected_total from core.sale_commission where source_order_id=${order.id}::uuid`,
          )
        ).rows,
      ).toEqual([
        { total: "0.50", state: "completo", collected_total: "20.00" },
      ]);
      expect(
        (
          await getDb().execute(
            sql`select amount, method_name, event_id from core.payment_commission where source_order_id=${order.id}::uuid`,
          )
        ).rows,
      ).toEqual([
        { amount: "20.00", method_name: method.name, event_id: sale.id },
      ]);
      const pending = await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(eq(moduleEventDeliveries.eventId, sale.id));
      expect(pending).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subscriberId: "recipes",
            state: "pending",
          }),
          expect.objectContaining({
            subscriberId: "core.analytics",
            state: "pending",
          }),
        ]),
      );
      const retry = await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [sale.id],
        force: true,
      });
      expect(retry).toMatchObject({ applied: 2, failed: 0, pending: 0 });
      const movements = () =>
        getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.sourceOrderId, order.id));
      const sources = () =>
        getDb()
          .select()
          .from(recipeConsumptionSources)
          .where(eq(recipeConsumptionSources.sourceOrderId, order.id));
      expect(await movements()).toEqual([
        expect.objectContaining({
          kind: "consumption",
          quantity: "-2.000",
          sourceLineId: order.items[0].lineId,
          itemId: item.id,
          productId,
        }),
      ]);
      expect(await sources()).toHaveLength(1);
      const [applied] = await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, order.id),
            eq(moduleEvents.eventType, "recipes.consumption.applied"),
          ),
        );
      expect(applied).toMatchObject({
        eventVersion: 2,
      });
      await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [applied.id],
        force: true,
      });
      const beforeMovements = await movements(),
        beforeSources = await sources();
      await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "3.000" }],
        expectedRevisionId: composition.revisionId,
      });
      await saveCommission(world.businessId, method.id, {
        expectedRevisionId: commission.revisionId,
        percent: "9.00",
      });
      await getDb()
        .update(paymentMethods)
        .set({ status: "archived" })
        .where(eq(paymentMethods.id, method.id));
      await getDb()
        .update(businessModules)
        .set({ enabled: false })
        .where(eq(businessModules.businessId, world.businessId));
      const beforeDeliveries = await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(eq(moduleEventDeliveries.eventId, sale.id));
      expect(
        await closeMeasuredPosOrder(business, world.ownerId, order.id, raw),
      ).toEqual(closed);
      expect(
        (
          await getDb()
            .select()
            .from(moduleEvents)
            .where(eq(moduleEvents.id, sale.id))
        )[0],
      ).toEqual(sale);
      expect(
        await getDb()
          .select()
          .from(moduleEventDeliveries)
          .where(eq(moduleEventDeliveries.eventId, sale.id)),
      ).toEqual(beforeDeliveries);
      expect(await movements()).toEqual(beforeMovements);
      expect(await sources()).toEqual(beforeSources);
      await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [sale.id],
        force: true,
      });
      expect(await movements()).toEqual(beforeMovements);
      expect(await sources()).toEqual(beforeSources);
    }, 180000);
  },
);
