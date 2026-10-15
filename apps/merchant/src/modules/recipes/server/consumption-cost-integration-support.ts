import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  recipeRevisions,
  stockItemLocations,
  stockItems,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import {
  enableModules,
  seedModuleWorld,
  seedProduct,
  type ModuleWorld,
} from "../../modules-integration-support";
import { publishSaleClosed } from "../../../server/module-events";
import { setResourceVersion } from "../../../server/module-events/publish";

/** Isolated fixture only; assertions stay in the integration suite. */
export async function setupCostWorld() {
  const world = await seedModuleWorld("0230-cost");
  const other = await seedModuleWorld("0230-other");
  await enableModules(world, ["stock", "recipes"]);
  await enableModules(other, ["stock", "recipes"]);
  const [location] = await getDb()
    .insert(locations)
    .values({
      businessId: world.businessId,
      name: "Segundo",
      addressLabel: "Quito",
      countryCode: "EC",
      addressSnapshot: {},
    })
    .returning();
  const second = location.id;
  async function item(owner = world) {
    const [row] = await getDb()
      .insert(stockItems)
      .values({
        businessId: owner.businessId,
        name: randomUUID(),
        unit: "unit",
      })
      .returning();
    return row.id;
  }
  async function average(
    itemId: string,
    cost: string,
    locationId = world.locationId,
    owner = world,
  ) {
    await getDb().insert(stockItemLocations).values({
      businessId: owner.businessId,
      itemId,
      locationId,
      weightedAverageUnitCost: cost,
      weightedAverageInitializedAt: new Date(),
    });
  }
  async function currency(code: string) {
    await getDb()
      .update(businesses)
      .set({ currencyCode: code })
      .where(eq(businesses.id, world.businessId));
  }
  async function sale(
    ingredients: { itemId: string; quantity: string }[] | null,
    opts: {
      owner?: ModuleWorld;
      locationId?: string;
      sold?: number;
      missingLine?: boolean;
    } = {},
  ) {
    const owner = opts.owner ?? world,
      locationId = opts.locationId ?? owner.locationId;
    const sourceOrderId = randomUUID(),
      sourceLineId = randomUUID();
    const productId = await seedProduct(owner, randomUUID(), "10.00");
    if (ingredients !== null)
      await withDbTransaction(async (tx) => {
        const [revision] = await tx
          .insert(recipeRevisions)
          .values({
            businessId: owner.businessId,
            productId,
            lines: ingredients.map((i) => ({ ...i, unit: "unit" })),
          })
          .returning();
        await setResourceVersion(tx, {
          businessId: owner.businessId,
          resourceType: "product",
          resourceId: productId,
          providerId: "recipes",
          slot: "recipe",
          versionId: revision.id,
        });
      });
    const lines = [{ sourceLineId, productId, quantity: opts.sold ?? 1 }];
    if (opts.missingLine)
      lines.push({
        sourceLineId: randomUUID(),
        productId: await seedProduct(owner, randomUUID(), "1.00"),
        quantity: 1,
      });
    const event = await withDbTransaction((tx) =>
      publishSaleClosed(tx, {
        businessId: owner.businessId,
        locationId,
        sourceOrderId,
        closedAt: new Date(),
        userId: owner.ownerId,
        lines,
      }),
    );
    return {
      businessId: owner.businessId,
      locationId,
      sourceOrderId,
      sourceLineId,
      productId,
      eventId: event?.eventId,
    };
  }
  async function rows(sourceOrderId: string) {
    return getDb()
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.sourceOrderId, sourceOrderId));
  }
  async function clearRecipe(productId: string) {
    await withDbTransaction(async (tx) => {
      const [revision] = await tx
        .insert(recipeRevisions)
        .values({
          businessId: world.businessId,
          productId: productId,
          lines: [],
        })
        .returning();
      await setResourceVersion(tx, {
        businessId: world.businessId,
        resourceType: "product",
        resourceId: productId,
        providerId: "recipes",
        slot: "recipe",
        versionId: revision.id,
      });
    });
  }
  return {
    world,
    other,
    second,
    item,
    average,
    currency,
    sale,
    rows,
    clearRecipe,
  };
}
