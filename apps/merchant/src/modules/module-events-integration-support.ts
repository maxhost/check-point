import { initializePaymentMethods } from "../server/business/payment-catalog";
import { randomUUID } from "node:crypto";
import {
  capturePosScope,
  scopedPos,
} from "./pos/server/pos-integration-support";
import { vi } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { and, eq, inArray } from "drizzle-orm";
import {
  products,
  users,
  sessions,
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
export const state = { closedId: "" };
const posScopes = new Map<string, string>();
export function moduleEventPos(owner = world) {
  const scope = posScopes.get(owner.businessId);
  if (!scope)
    throw new Error("Module event POS fixture requires explicit V2 setup");
  return scopedPos(owner.cookie, scope);
}
export async function setupModuleEventWorld(options?: { posContract: 2 }) {
  posScopes.clear();
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
  if (options?.posContract === 2)
    for (const owner of [world, other]) {
      posScopes.set(
        owner.businessId,
        await capturePosScope(owner.cookie, owner.businessId),
      );
      console.info("P6 event fixture identity", {
        businessId: owner.businessId,
        userIds: owner.users,
      });
    }
}
export async function cleanupModuleEventWorld() {
  const identities = [world, other]
    .filter(Boolean)
    .flatMap((owner) => owner.users);
  await dropModuleWorld(world);
  await dropModuleWorld(other);
  if (posScopes.size && identities.length) {
    const remainingUsers = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, identities));
    const remainingSessions = await getDb()
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.userId, identities));
    if (remainingUsers.length || remainingSessions.length)
      throw new Error("Owned event fixture identities were not retired");
  }
}
export const post = (path: string, body: unknown, owner = world) =>
  callModuleRoute("POST", "/api/modules/pos/" + path, owner.cookie, body);
export async function open(id = productId, quantity = 1, owner = world) {
  let response: Response;
  if (posScopes.has(owner.businessId)) {
    const [product] = await getDb()
      .select({ revision: products.salesRevision })
      .from(products)
      .where(
        and(eq(products.id, id), eq(products.businessId, owner.businessId)),
      );
    if (!product)
      throw new Error("Module event fixture requires its own product");
    response = await moduleEventPos(owner).create({
      createRequestId: randomUUID(),
      saleType: "pickup",
      orderLabel: "P1 event",
      locationId: owner.locationId,
      tableId: null,
      note: null,
      items: [
        {
          productId: id,
          quantity: String(quantity),
          quantityUnit: "unit",
          catalogRevision: String(product.revision),
        },
      ],
    });
  } else
    response = await post(
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
