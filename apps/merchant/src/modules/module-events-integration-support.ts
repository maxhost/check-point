import { initializePaymentMethods } from "../server/business/payment-catalog";
import { vi } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { and, eq } from "drizzle-orm";
import {
  moduleEvents,
  paymentMethods,
  stockItems,
  stockItemLocations,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import { setModuleEnabled } from "./activation";
import {
  callModuleRoute,
  dropModuleWorld,
  seedModuleWorld,
  seedProduct,
  type ModuleWorld,
} from "./modules-integration-support";
import { retryModuleEvents } from "../server/module-events";
import * as retry from "../server/module-events/retry";
export let world: ModuleWorld,
  other: ModuleWorld,
  itemId: string,
  productId: string,
  cashId: string,
  foreignCashId: string;
const flag = process.env.MODULE_EVENTS_ENABLED;
export const state = { closedId: "" };
export async function setupModuleEventWorld() {
  world = await seedModuleWorld("P1 real event");
  other = await seedModuleWorld("P1 schema foreign");
  for (const owner of [world, other]) {
    await withDbTransaction((tx) =>
      initializePaymentMethods(tx, { businessId: owner.businessId }),
    );
    await setModuleEnabled(owner.businessId, "pos", { enabled: true });
  }
  for (const id of ["stock", "recipes", "expenses"])
    await setModuleEnabled(world.businessId, id, { enabled: true });
  const [cash] = await getDb()
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.businessId, world.businessId),
        eq(paymentMethods.isCash, true),
      ),
    );
  cashId = cash.id;
  const [foreign] = await getDb()
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.businessId, other.businessId),
        eq(paymentMethods.isCash, true),
      ),
    );
  foreignCashId = foreign.id;
  const [item] = await getDb()
    .insert(stockItems)
    .values({
      businessId: world.businessId,
      name: "Shared actual ingredient",
      unit: "g",
    })
    .returning();
  itemId = item.id;
  await getDb().insert(stockItemLocations).values({
    businessId: world.businessId,
    itemId,
    locationId: world.locationId,
    weightedAverageUnitCost: "3.000000",
    weightedAverageInitializedAt: new Date(),
  });
  productId = await seedProduct(world, "Actual combo", "9.00");
  process.env.MODULE_EVENTS_ENABLED = "true";
}
export async function cleanupModuleEventWorld() {
  if (flag === undefined) delete process.env.MODULE_EVENTS_ENABLED;
  else process.env.MODULE_EVENTS_ENABLED = flag;
  await dropModuleWorld(world);
  await dropModuleWorld(other);
}
export const post = (path: string, body: unknown, owner = world) =>
  callModuleRoute("POST", "/api/modules/pos/" + path, owner.cookie, body);
export async function open(id = productId, quantity = 1, owner = world) {
  const response = await post(
    "orders",
    {
      locationId: owner.locationId,
      tableLabel: "P1 event",
      items: [{ productId: id, quantity }],
    },
    owner,
  );
  if (response.status !== 201)
    throw new Error(`open actual POS:${response.status}`);
  return response.json();
}
export async function eventOf(id: string) {
  const [event] = await getDb()
    .select()
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, world.businessId),
        eq(moduleEvents.sourceId, id),
      ),
    );
  return event;
}
export const movements = (id: string) =>
  getDb()
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, world.businessId),
        eq(stockMovements.sourceOrderId, id),
      ),
    );
export const drain = (eventId: string) =>
  retryModuleEvents({
    businessId: world.businessId,
    eventIds: [eventId],
    force: true,
    budgetMs: 20000,
  });
export function holdAcceleration() {
  const actual = retry.retryModuleEvents;
  vi.spyOn(retry, "retryModuleEvents").mockImplementation((options) =>
    options?.force === true
      ? actual(options)
      : Promise.resolve({ claimed: 0, applied: 0, pending: 0, failed: 0 }),
  );
}
