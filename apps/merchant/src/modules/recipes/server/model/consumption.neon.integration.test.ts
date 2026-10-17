import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  moduleEvents,
  recipeConsumptionSources,
  stockMovements,
  stockItemLocations,
  locations,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  seedProduct,
  newItem,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../../../modules-integration-support";
import {
  publishSaleClosed,
  retryModuleEvents,
  type SaleClosedEvent,
} from "../../../../server/module-events";
import { createRecipe, updateRecipe } from "../library";
import { saveComposition } from "../compositions";
import { readSaleConsumptionCost } from "../consumption-cost";
import { eventSubscriptions } from "../consumption";
import * as provenance from "./provenance";
let world: ModuleWorld;
beforeAll(async () => {
  world = await seedModuleWorld("R1 consumption");
  await enableModules(world, ["stock", "recipes"]);
}, 120_000);
afterAll(async () => {
  await dropModuleWorld(world);
}, 120_000);
const rows = (sourceOrderId: string) =>
  getDb()
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, world.businessId),
        eq(stockMovements.sourceOrderId, sourceOrderId),
      ),
    );
const sources = (sourceOrderId: string) =>
  getDb()
    .select()
    .from(recipeConsumptionSources)
    .where(
      and(
        eq(recipeConsumptionSources.businessId, world.businessId),
        eq(recipeConsumptionSources.sourceOrderId, sourceOrderId),
      ),
    );
async function publish(
  productId: string,
  locationId = world.locationId,
  quantity = 1,
) {
  const sourceOrderId = randomUUID();
  const event = await withDbTransaction((tx) =>
    publishSaleClosed(tx, {
      businessId: world.businessId,
      sourceOrderId,
      locationId,
      closedAt: new Date(),
      userId: world.ownerId,
      lines: [{ sourceLineId: randomUUID(), productId, quantity }],
    }),
  );
  return { sourceOrderId, eventId: event!.eventId, locationId };
}
const drain = (eventId: string) =>
  retryModuleEvents({
    businessId: world.businessId,
    eventIds: [eventId],
    force: true,
    budgetMs: 20000,
  });
describe.skipIf(!modulesIntegrationEnabled)(
  "R1 captured composition consumption and frozen Stock costs",
  () => {
    it("a combo with an empty recipe retains the other recipe's frozen cost and incomplete coverage", async () => {
      const item = await newItem(world, "Insumo combo mixto");
      await getDb().insert(stockItemLocations).values({
        businessId: world.businessId,
        itemId: item.id,
        locationId: world.locationId,
        weightedAverageUnitCost: "3.000000",
        weightedAverageInitializedAt: new Date(),
      });
      const empty = await createRecipe(world.businessId, {
        name: "Receta vacía combo",
        lines: [],
      });
      const full = await createRecipe(world.businessId, {
        name: "Receta completa combo",
        lines: [{ itemId: item.id, quantity: "2.000" }],
      });
      const productId = await seedProduct(
        world,
        "Combo vacío y completo",
        "10.00",
      );
      await saveComposition(world.businessId, productId, {
        isCombo: true,
        recipes: [
          { recipeId: empty.id, quantity: "1.000" },
          { recipeId: full.id, quantity: "1.000" },
        ],
        expectedRevisionId: null,
      });
      const sale = await publish(productId);
      expect((await drain(sale.eventId)).applied).toBe(1);
      expect(await rows(sale.sourceOrderId)).toMatchObject([
        { quantity: "-2.000", consumptionUnitCost: "3.000000" },
      ]);
      expect(await sources(sale.sourceOrderId)).toMatchObject([
        { recipeId: full.id, allocatedQuantity: "2.000" },
      ]);
      expect(
        await readSaleConsumptionCost({
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: sale.sourceOrderId,
        }),
      ).toMatchObject({
        state: "incompleto",
        knownCost: "6.00",
        reasons: ["sin_receta"],
        missingRecipes: [{ productId }],
      });
    }, 30_000);
    it("shared ingredient creates one ledger row and two immutable sources from versions at close", async () => {
      const item = await newItem(world, "Carne combo");
      await getDb().insert(stockItemLocations).values({
        businessId: world.businessId,
        itemId: item.id,
        locationId: world.locationId,
        weightedAverageUnitCost: "2.000000",
        weightedAverageInitializedAt: new Date(),
      });
      const a = await createRecipe(world.businessId, {
          name: "Pizza consumo",
          lines: [{ itemId: item.id, quantity: "1.000" }],
        }),
        b = await createRecipe(world.businessId, {
          name: "Salsa consumo",
          lines: [{ itemId: item.id, quantity: "2.000" }],
        }),
        productId = await seedProduct(world, "Combo consumo", "10.00");
      const composition = await saveComposition(world.businessId, productId, {
        isCombo: true,
        recipes: [
          { recipeId: a.id, quantity: "0.500" },
          { recipeId: b.id, quantity: "2.000" },
        ],
        expectedRevisionId: null,
      });
      const sale = await publish(productId, world.locationId, 2);
      await updateRecipe(world.businessId, a.id, {
        name: "Pizza nueva",
        lines: [{ itemId: item.id, quantity: "99.000" }],
        expectedRevisionId: a.revisionId,
      });
      expect((await drain(sale.eventId)).applied).toBe(1);
      expect(await rows(sale.sourceOrderId)).toMatchObject([
        { quantity: "-9.000", consumptionUnitCost: "2.000000" },
      ]);
      const before = await sources(sale.sourceOrderId);
      expect(before).toHaveLength(2);
      expect(before.find((s) => s.recipeId === a.id)).toMatchObject({
        recipeRevisionId: a.revisionId,
        compositionRevisionId: composition.revisionId,
        exactQuantity: "1.000000",
        allocatedQuantity: "1.000",
      });
      expect(before.find((s) => s.recipeId === b.id)).toMatchObject({
        exactQuantity: "8.000000",
        allocatedQuantity: "8.000",
      });
      await getDb()
        .update(stockItemLocations)
        .set({ weightedAverageUnitCost: "7.000000" })
        .where(
          and(
            eq(stockItemLocations.businessId, world.businessId),
            eq(stockItemLocations.itemId, item.id),
            eq(stockItemLocations.locationId, world.locationId),
          ),
        );
      const [event] = await getDb()
        .select()
        .from(moduleEvents)
        .where(eq(moduleEvents.id, sale.eventId));
      await withDbTransaction((tx) =>
        eventSubscriptions[0].handler(tx, {
          id: event.id,
          businessId: world.businessId,
          payload: event.payload as SaleClosedEvent,
        }),
      );
      expect(await sources(sale.sourceOrderId)).toEqual(before);
      expect((await rows(sale.sourceOrderId))[0].consumptionUnitCost).toBe(
        "2.000000",
      );
      expect(
        await readSaleConsumptionCost({
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: sale.sourceOrderId,
        }),
      ).toMatchObject({ state: "completo", knownCost: "18.00" });
    }, 45_000);
    it("a provenance failure rolls back ledger and acknowledgment, then retry values only its successful application", async () => {
      const item = await newItem(world, "Atómico consumo"),
        recipe = await createRecipe(world.businessId, {
          name: "Atómica consumo receta",
          lines: [{ itemId: item.id, quantity: "1.000" }],
        }),
        productId = await seedProduct(
          world,
          "Atómico consumo producto",
          "2.00",
        );
      await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
      });
      const sale = await publish(productId),
        failure = vi
          .spyOn(provenance, "persistProvenance")
          .mockRejectedValueOnce(new Error("provenance unavailable"));
      try {
        expect((await drain(sale.eventId)).failed).toBe(1);
      } finally {
        failure.mockRestore();
      }
      expect(await rows(sale.sourceOrderId)).toEqual([]);
      expect(await sources(sale.sourceOrderId)).toEqual([]);
      expect(
        await readSaleConsumptionCost({
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: sale.sourceOrderId,
        }),
      ).toMatchObject({ state: "pendiente", knownCost: null });
      expect((await drain(sale.eventId)).applied).toBe(1);
      expect(await sources(sale.sourceOrderId)).toHaveLength(1);
    }, 30_000);
    it("round-to-zero retains exact source, omits ledger and never claims complete zero cost", async () => {
      const item = await newItem(world, "Micro insumo"),
        recipe = await createRecipe(world.businessId, {
          name: "Micro receta",
          lines: [{ itemId: item.id, quantity: "0.001" }],
        }),
        productId = await seedProduct(world, "Micro producto", "1.00");
      await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "0.100" }],
        expectedRevisionId: null,
      });
      const sale = await publish(productId);
      expect((await drain(sale.eventId)).applied).toBe(1);
      expect(await rows(sale.sourceOrderId)).toEqual([]);
      expect(await sources(sale.sourceOrderId)).toMatchObject([
        { exactQuantity: "0.000100", allocatedQuantity: "0.000" },
      ]);
      expect(
        await readSaleConsumptionCost({
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: sale.sourceOrderId,
        }),
      ).toMatchObject({
        state: "incompleto",
        knownCost: null,
        reasons: ["redondeo_sin_consumo"],
        missingRecipes: [],
      });
    }, 30_000);
    it("the same shared recipe uses distinct local cost and inventory", async () => {
      const [local] = await getDb()
        .insert(locations)
        .values({
          businessId: world.businessId,
          name: "Segundo R1",
          countryCode: "EC",
          addressLabel: "Centro",
          addressSnapshot: {},
        })
        .returning();
      const item = await newItem(world, "Local insumo"),
        recipe = await createRecipe(world.businessId, {
          name: "Local receta",
          lines: [{ itemId: item.id, quantity: "1.000" }],
        }),
        productId = await seedProduct(world, "Local producto", "4.00");
      await getDb()
        .insert(stockItemLocations)
        .values([
          {
            businessId: world.businessId,
            itemId: item.id,
            locationId: world.locationId,
            weightedAverageUnitCost: "1.000000",
            weightedAverageInitializedAt: new Date(),
          },
          {
            businessId: world.businessId,
            itemId: item.id,
            locationId: local.id,
            weightedAverageUnitCost: "3.000000",
            weightedAverageInitializedAt: new Date(),
          },
        ]);
      await saveComposition(world.businessId, productId, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
      });
      const a = await publish(productId),
        b = await publish(productId, local.id);
      await drain(a.eventId);
      await drain(b.eventId);
      expect((await rows(a.sourceOrderId))[0]).toMatchObject({
        locationId: world.locationId,
        consumptionUnitCost: "1.000000",
      });
      expect((await rows(b.sourceOrderId))[0]).toMatchObject({
        locationId: local.id,
        consumptionUnitCost: "3.000000",
      });
    }, 30_000);
  },
);
