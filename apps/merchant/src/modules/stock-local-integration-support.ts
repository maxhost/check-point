import {
  createRecipe,
  updateRecipe,
  readLibraryRecipe,
} from "./recipes/server/library";
import {
  readComposition,
  saveComposition,
} from "./recipes/server/compositions";
import { vi } from "vitest";
import * as eventRetry from "../server/module-events/retry";
import {
  seedPosWorld,
  setModuleRow,
  dropPosWorld,
} from "./pos/server/pos-integration-support";
import { closeWithCash } from "./pos/server/pos-payment-integration-support";
import { initializePaymentMethods } from "./pos/server/payment-catalog";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  moduleEvents,
  moduleEventDeliveries,
  stockItems,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import {
  callModuleRoute,
  enableModules,
  seedModuleWorld,
  seedProduct,
  dropModuleWorld,
  type ModuleWorld,
} from "./modules-integration-support";
import { retryModuleEvents } from "../server/module-events";
export let world: ModuleWorld;
export let other: ModuleWorld;
export let localId: string;
export let productId: string;
export let flourId: string;
const originalFlag = process.env.MODULE_EVENTS_ENABLED;
export const route = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  cookie = world.cookie,
) => callModuleRoute(method, `/api/modules/${path}`, cookie, body);
export async function put(quantity: string, id = productId) {
  const composition = await readComposition(world.businessId, id);
  if (composition.recipes.length) {
    const recipe = await readLibraryRecipe(
      world.businessId,
      composition.recipes[0].recipeId,
    );
    const updated = await updateRecipe(world.businessId, recipe.id, {
      name: recipe.name,
      lines: [{ itemId: flourId, quantity, unit: "g" }],
      expectedRevisionId: recipe.revisionId,
    });
    return Response.json({ recipe: updated });
  }
  const recipe = await createRecipe(world.businessId, {
    name: `Receta ${id}`,
    lines: [{ itemId: flourId, quantity, unit: "g" }],
  });
  await saveComposition(world.businessId, id, {
    isCombo: false,
    recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
    expectedRevisionId: composition.revisionId,
  });
  return Response.json({ recipe });
}
export const create = async (
  quantity = 3,
  tableId?: string,
  id = productId,
) => {
  const response = await route("POST", "pos/orders", {
    tableLabel: "Mesa de prueba",
    items: [{ productId: id, quantity }],
    ...(tableId ? { tableId } : {}),
  });
  if (response.status !== 201)
    throw new Error(`create: ${response.status} ${await response.text()}`);
  return response.json();
};
export const close = (
  order: { id: string; version: number },
  key = randomUUID(),
) =>
  closeWithCash(world.cookie, order.id, {
    version: order.version,
    clientRequestId: key,
  });
export const eventOf = async (
  orderId: string,
  businessId = world.businessId,
) => {
  const [event] = await getDb()
    .select()
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, businessId),
        eq(moduleEvents.sourceId, orderId),
      ),
    );
  if (!event) throw new Error("Sale event not persisted");
  return event;
};
export const drain = (eventId: string) =>
  retryModuleEvents({
    businessId: world.businessId,
    eventIds: [eventId],
    force: true,
    budgetMs: 20000,
  });
export const movements = (orderId: string) =>
  getDb()
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, world.businessId),
        eq(stockMovements.sourceOrderId, orderId),
      ),
    );

export async function setupStockLocalWorld() {
  process.env.MODULE_EVENTS_ENABLED = "true";
  world = await seedModuleWorld("0227 integration");
  other = await seedModuleWorld("0227 foreign");
  await enableModules(world, ["stock", "recipes", "pos", "tables"]);
  await withDbTransaction((tx) =>
    initializePaymentMethods(tx, { businessId: world.businessId }),
  );
  const [local] = await getDb()
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.businessId, world.businessId));
  localId = local.id;
  productId = await seedProduct(world, "Pizza", "10.00");
  const [flour] = await getDb()
    .insert(stockItems)
    .values({ businessId: world.businessId, name: "Harina", unit: "g" })
    .returning({ id: stockItems.id });
  flourId = flour.id;
}
export async function cleanupStockLocalWorld() {
  if (originalFlag === undefined) delete process.env.MODULE_EVENTS_ENABLED;
  else process.env.MODULE_EVENTS_ENABLED = originalFlag;
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}
export async function resetProduct() {
  productId = await seedProduct(world, "Pizza posterior", "10.00");
}

export async function preparePassWorld() {
  const fixture = await seedPosWorld("0227 pass");
  try {
    await setModuleRow(fixture.seed.business.id, "stock", true);
    await setModuleRow(fixture.seed.business.id, "recipes", true);
    const [item] = await getDb()
      .insert(stockItems)
      .values({
        businessId: fixture.seed.business.id,
        name: "Harina pase",
        unit: "g",
      })
      .returning({ id: stockItems.id });
    const recipe = await createRecipe(fixture.seed.business.id, {
      name: "Pase receta",
      lines: [{ itemId: item.id, quantity: "250.000", unit: "g" }],
    });
    await saveComposition(fixture.seed.business.id, fixture.medialuna, {
      isCombo: false,
      recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
      expectedRevisionId: null,
    });
    return fixture;
  } catch (error) {
    await dropPosWorld(fixture);
    throw error;
  }
}

/** Test-only clock advance: a processing lease counts as durable pending; make it eligible for recovery without a30s wall-clock sleep. */
export async function expireLeaseForRecovery(eventId: string) {
  await getDb()
    .update(moduleEventDeliveries)
    .set({ claimUntil: new Date(0) })
    .where(
      and(
        eq(moduleEventDeliveries.eventId, eventId),
        eq(moduleEventDeliveries.state, "processing"),
      ),
    );
}

export async function deliveryOf(eventId: string) {
  const [delivery] = await getDb()
    .select()
    .from(moduleEventDeliveries)
    .where(eq(moduleEventDeliveries.eventId, eventId));
  return delivery;
}

/** Hold only post-close acceleration; forced cron retries remain the real DB actor in fault tests. */
export function holdImmediateRetry() {
  const actual = eventRetry.retryModuleEvents;
  return vi
    .spyOn(eventRetry, "retryModuleEvents")
    .mockImplementation((options = {}) =>
      options.force === true
        ? actual(options)
        : Promise.resolve({ claimed: 0, applied: 0, pending: 0, failed: 0 }),
    );
}
