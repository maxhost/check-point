import { inArray } from "drizzle-orm";
import { consumerAccounts, users, sessions } from "@mi-pasaporte/db/schema";
import { randomUUID } from "node:crypto";
import * as recipeSnapshot from "./recipes/server/model/captured-measured";
import {
  readComposition,
  saveComposition,
} from "./recipes/server/compositions";
import {
  dropPosWorld,
  openOrderV2,
  capturePosScope,
} from "./pos/server/pos-integration-support";
import { closeWithCash } from "./pos/server/pos-payment-integration-support";
import { scannedCustomer } from "../server/counter/coupon-cycle-support";
import {
  businessModules,
  diningTables,
  locations,
  moduleResourceVersions,
  moduleEventDeliveries,
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
  type MeasuredSaleClosedEvent,
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
  create as createFixture,
  close as closeFixture,
  eventOf as eventOfFixture,
  drain as drainFixture,
  movements as movementsFixture,
  resetProduct,
  preparePassWorld,
  expireLeaseForRecovery as expireLeaseForRecoveryFixture,
  deliveryOf,
  holdImmediateRetry,
  world,
  localId,
  productId,
  flourId,
  put as putFixture,
  setupStockLocalWorld,
  cleanupStockLocalWorld,
} from "./stock-local-integration-support";
let pendingCase: Promise<void> | undefined;
const ownedCases = new Set<Promise<void>>();
let caseName = "";
function trackedCase(name: string, run: () => Promise<void>) {
  return () => {
    if (pendingCase !== undefined)
      throw new Error(
        "Previous Stock fixture work is still owned by its lifecycle hook",
      );
    caseName = name;
    const started = performance.now();
    console.info("P6 Stock case begin", { name, businessId: world.businessId });
    const promise = Promise.resolve()
      .then(run)
      .finally(() => {
        console.info("P6 Stock case settled", {
          name,
          businessId: world.businessId,
          elapsedMs: Math.round(performance.now() - started),
        });
      });
    pendingCase = promise;
    ownedCases.add(promise);
    // Vitest can time out before the async callback settles; afterEach owns this promise.
    void promise.catch(() => undefined);
    return promise;
  };
}
async function phase<T>(
  name: string,
  run: () => PromiseLike<T>,
  correlation: Record<string, string> = {},
): Promise<T> {
  const started = performance.now();
  console.info("P6 Stock operation begin", {
    caseName,
    name,
    fixtureBusinessId: world.businessId,
    ...correlation,
  });
  try {
    return await run();
  } finally {
    console.info("P6 Stock operation settled", {
      caseName,
      name,
      fixtureBusinessId: world.businessId,
      ...correlation,
      elapsedMs: Math.round(performance.now() - started),
    });
  }
}
const create = (...args: Parameters<typeof createFixture>) =>
  phase("create", () => createFixture(...args));
const close = (...args: Parameters<typeof closeFixture>) =>
  phase("close", () => closeFixture(...args), { orderId: args[0].id });
const eventOf = (...args: Parameters<typeof eventOfFixture>) =>
  phase("eventOf", () => eventOfFixture(...args), {
    orderId: args[0],
    businessId: args[1] ?? world.businessId,
  });
const drain = (...args: Parameters<typeof drainFixture>) =>
  phase("drain", () => drainFixture(...args), { eventId: args[0] });
const movements = (...args: Parameters<typeof movementsFixture>) =>
  phase("movements", () => movementsFixture(...args), { orderId: args[0] });
const put = (...args: Parameters<typeof putFixture>) =>
  phase("put", () => putFixture(...args));
const expireLeaseForRecovery = (
  ...args: Parameters<typeof expireLeaseForRecoveryFixture>
) =>
  phase(
    "expireLeaseForRecovery",
    () => expireLeaseForRecoveryFixture(...args),
    { eventId: args[0] },
  );

beforeAll(() => setupStockLocalWorld({ posContract: 2 }), 180_000);
afterAll(async () => {
  const owned = pendingCase;
  await Promise.allSettled([...ownedCases]);
  if (pendingCase === owned) {
    pendingCase = undefined;
    vi.restoreAllMocks();
  }
  await cleanupStockLocalWorld();
}, 180_000);
afterEach(async () => {
  const owned = pendingCase;
  // A timed-out hook can resume later. It must neither clear a newer owner nor
  // restore its mocks; all callbacks remain retained for the final teardown.
  await Promise.allSettled([...ownedCases]);
  if (owned !== undefined && pendingCase === owned) {
    pendingCase = undefined;
    vi.restoreAllMocks();
  }
  // Keep callback rejection visible even when Vitest already reported a timeout.
  if (owned) await owned;
});
describe.skipIf(!modulesIntegrationEnabled)(
  "0227 sale → captured recipe → local stock",
  () => {
    it(
      "atomic revision pointer, normalized250g×3, negative allowed and close/retry unique",
      trackedCase("atomic", async () => {
        holdImmediateRetry();
        expect((await put("250.000")).status).toBe(200);
        const [pointer] = await phase("read-pointer", () =>
          getDb()
            .select()
            .from(moduleResourceVersions)
            .where(
              and(
                eq(moduleResourceVersions.businessId, world.businessId),
                eq(moduleResourceVersions.resourceId, productId),
                eq(moduleResourceVersions.providerId, "recipes"),
              ),
            ),
        );
        const [resolution] = await phase("read-resolution", () =>
          getDb()
            .select()
            .from(recipeSaleResolutions)
            .where(eq(recipeSaleResolutions.id, pointer.versionId)),
        );
        const [revision] = await phase("read-revision", () =>
          getDb()
            .select()
            .from(independentRecipeRevisions)
            .where(
              eq(
                independentRecipeRevisions.id,
                resolution.components[0].recipeRevisionId,
              ),
            ),
        );
        expect(revision.lines).toEqual([
          {
            itemId: flourId,
            itemName: "Harina",
            unit: "g",
            quantity: "250.000",
          },
        ]);
        const expansion = vi
          .spyOn(recipeSnapshot, "capturedMeasuredConsumption")
          .mockImplementation(() => {
            throw new Error("Revision read unavailable");
          });
        try {
          const order = await create();
          expect(order.location.id).toBe(localId);
          const key = randomUUID();
          expect((await close(order, key)).status).toBe(200);
          const event = await eventOf(order.id);
          const payload = event.payload as MeasuredSaleClosedEvent;
          expect(payload.eventVersion).toBe(4);
          if (payload.eventVersion !== 4)
            throw new Error("Expected the current POS financial writer");
          expect(payload.money.collected).toBe("30.00");
          expect(payload.lines[0]).toMatchObject({
            quantity: "3",
            measure: {
              kind: "unit",
              quantityUnit: "unit",
              priceUnit: "unit",
              conversionVersion: "mass-si-1",
            },
          });
          expect(payload.payments).toHaveLength(1);
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
          const attempts = await Promise.all([
            drain(event.id),
            drain(event.id),
          ]);
          expect(
            attempts.reduce((sum, result) => sum + result.claimed, 0),
          ).toBe(1);
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
        } finally {
          expansion.mockRestore();
          await getDb()
            .update(stockItems)
            .set({ status: "active" })
            .where(eq(stockItems.id, flourId));
        }
      }),
      // Measured complete callback exceeds30s; DB operations/polls retain their own limits.
      45_000,
    );
    it(
      "revision expansion failure leaves sale closed and table free; recovery uses exact captured revision after product deletion",
      trackedCase("recovery", async () => {
        holdImmediateRetry();
        expect((await put("250.000")).status).toBe(200);
        const expansion = vi
          .spyOn(recipeSnapshot, "capturedMeasuredConsumption")
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
        try {
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
          const captured = event.payload as MeasuredSaleClosedEvent;
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
            {
              itemId: flourId,
              itemName: "Harina",
              unit: "g",
              quantity: "250.000",
            },
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
          expect(
            (await movements(order.id)).map((row) => row.quantity),
          ).toEqual(["-750.000"]);
        } finally {
          expansion.mockRestore();
          await getDb()
            .update(locations)
            .set({ status: "active" })
            .where(eq(locations.id, localId));
          await resetProduct();
        }
      }),
      30_000,
    );
    it(
      "disabled at close stays skipped after reactivation; empty recipe revision remains empty",
      trackedCase("disabled-empty", async () => {
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
        try {
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
          const payload = emptyEvent.payload as MeasuredSaleClosedEvent;
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
        } finally {
          await enableModules(world, ["recipes"]);
        }
      }),
      // Measured complete callback exceeds30s; DB operations/polls retain their own limits.
      45_000,
    );
    it(
      "sale with customer pass accrues normally and consumes normalized recipe once",
      trackedCase("customer-pass", async () => {
        holdImmediateRetry();
        const withPass = await phase("prepare-pass-world", () =>
          preparePassWorld(),
        );
        console.info("P6 Stock pass identities", {
          businessId: withPass.seed.business.id,
          ownerId: withPass.seed.userId,
        });
        const consumerIds: string[] = [];
        const scope = await capturePosScope(
          withPass.ownerCookie,
          withPass.seed.business.id,
        );
        try {
          const customer = await scannedCustomer(withPass);
          consumerIds.push(customer.consumerId);
          console.info("P6 Stock consumer identity", {
            businessId: withPass.seed.business.id,
            consumerId: customer.consumerId,
          });
          const order = await openOrderV2(withPass, scope, [
            { productId: withPass.medialuna, quantity: 3 },
          ]);
          const response = await closeWithCash(
            withPass.ownerCookie,
            order.id,
            {
              version: order.version,
              clientRequestId: randomUUID(),
              membershipId: customer.membershipId,
            },
            { scope: scope },
          );
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
          // Current V4 has both the recipe and analytics subscriber; prove each identity/state.
          expect(applied).toMatchObject({ claimed: 2, applied: 2, failed: 0 });
          const deliveries = await getDb()
            .select({
              subscriberId: moduleEventDeliveries.subscriberId,
              state: moduleEventDeliveries.state,
            })
            .from(moduleEventDeliveries)
            .where(eq(moduleEventDeliveries.eventId, event.id));
          expect(
            deliveries.sort((a, b) =>
              a.subscriberId.localeCompare(b.subscriberId),
            ),
          ).toEqual([
            { subscriberId: "core.analytics", state: "applied" },
            { subscriberId: "recipes", state: "applied" },
          ]);
          expect(event).toMatchObject({
            eventVersion: 4,
            sourceId: order.id,
            businessId: withPass.seed.business.id,
          });
          expect(event.payload).toMatchObject({
            eventVersion: 4,
            lines: [{ productId: withPass.medialuna, quantity: "3" }],
          });
          expect(
            await retryModuleEvents({
              businessId: withPass.seed.business.id,
              eventIds: [event.id],
              force: true,
              budgetMs: 20000,
            }),
          ).toMatchObject({ claimed: 0, applied: 0, failed: 0 });
          expect(
            (await eventOf(order.id, withPass.seed.business.id)).payload,
          ).toEqual(event.payload);
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
          await retireFixtureIdentities([withPass], consumerIds);
        }
      }),
      30_000,
    );
  },
);

/** Retire only identities created by these fixtures, after their business roots are gone. */
async function retireFixtureIdentities(
  targets: { seed: { userId: string }; extraUsers: string[] }[],
  consumers: string[] = [],
) {
  if (consumers.length) {
    await getDb()
      .delete(consumerAccounts)
      .where(inArray(consumerAccounts.id, consumers));
    expect(
      await getDb()
        .select({ id: consumerAccounts.id })
        .from(consumerAccounts)
        .where(inArray(consumerAccounts.id, consumers)),
    ).toEqual([]);
  }
  const owners = targets.flatMap((target) => [
    target.seed.userId,
    ...target.extraUsers,
  ]);
  if (owners.length) {
    await getDb().delete(users).where(inArray(users.id, owners));
    expect(
      await getDb()
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, owners)),
    ).toEqual([]);
    expect(
      await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(inArray(sessions.userId, owners)),
    ).toEqual([]);
  }
}
