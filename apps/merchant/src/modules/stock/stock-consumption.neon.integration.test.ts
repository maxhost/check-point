import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businessModules,
  moduleEvents,
  moduleEventDeliveries,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import { SERVER_MODULES } from "../server-registry";
import type { ModuleServer } from "../route-table";
import {
  dropModuleWorld,
  enableModules,
  newItem,
  seedModuleWorld,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../modules-integration-support";
import { applyConsumption } from "./consumption";
import { recordAdjustment } from "./movements";
import {
  publishSaleClosed,
  retryModuleEvents,
  type CapturedModuleEvent,
} from "../../server/module-events";
import { onHandSql, waitForLockWaiters } from "./stock-integration-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;
const subscriber = "integration-consumer";
run("0227 durable consumption and count cut", { timeout: 60000 }, () => {
  let world: ModuleWorld, itemId: string;
  const previous = process.env.MODULE_EVENTS_ENABLED;
  let handler: (
    tx: Parameters<typeof applyConsumption>[0],
    event: CapturedModuleEvent,
  ) => Promise<void>;
  beforeAll(async () => {
    world = await seedModuleWorld("consumption");
    await enableModules(world, ["stock", subscriber]);
    itemId = (await newItem(world, "Harina")).id;
    process.env.MODULE_EVENTS_ENABLED = "true";
    (SERVER_MODULES as Record<string, ModuleServer>)[subscriber] = {
      routes: [],
      eventSubscriptions: [
        {
          eventType: "sale.closed",
          resourceType: "product",
          slot: "test",
          requiredModules: ["stock"],
          handler: (tx, event) => handler(tx, event),
        },
      ],
    };
    resetHandler();
  });
  afterAll(async () => {
    delete (SERVER_MODULES as Record<string, ModuleServer>)[subscriber];
    if (previous === undefined) delete process.env.MODULE_EVENTS_ENABLED;
    else process.env.MODULE_EVENTS_ENABLED = previous;
    await dropModuleWorld(world);
  });
  function resetHandler() {
    handler = async (tx, event) =>
      applyConsumption(tx, {
        businessId: event.businessId,
        locationId: event.payload.locationId,
        sourceOrderId: event.payload.sourceOrderId,
        closedAt: new Date(event.payload.closedAt),
        userId: event.payload.userId,
        lines: event.payload.lines
          .filter((l) => l.productId)
          .map((l) => ({
            sourceLineId: l.sourceLineId,
            productId: l.productId!,
            itemId,
            quantity: (250 * l.quantity).toFixed(3),
          })),
      });
  }
  async function publish(quantity = 3) {
    const order = randomUUID();
    const event = await withDbTransaction((tx) =>
      publishSaleClosed(tx, {
        businessId: world.businessId,
        sourceOrderId: order,
        locationId: world.locationId,
        closedAt: new Date(),
        userId: world.ownerId,
        lines: [
          { sourceLineId: randomUUID(), productId: randomUUID(), quantity },
        ],
      }),
    );
    return { order, eventId: event!.eventId };
  }
  it("3 sold units consume stored 250 each exactly once under concurrent retries", async () => {
    const e = await publish();
    await Promise.all([
      retryModuleEvents({ businessId: world.businessId, force: true }),
      retryModuleEvents({ businessId: world.businessId, force: true }),
    ]);
    await retryModuleEvents({ businessId: world.businessId, force: true });
    const rows = await getDb()
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.sourceOrderId, e.order));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "consumption",
      quantity: "-750.000",
      locationId: world.locationId,
    });
    expect(await onHandSql(itemId)).toBe("-750.000");
    const snapshot = {
      businessId: world.businessId,
      locationId: world.locationId,
      sourceOrderId: e.order,
      closedAt: rows[0].occurredAt,
      userId: world.ownerId,
      lines: [
        {
          sourceLineId: rows[0].sourceLineId!,
          productId: rows[0].productId!,
          itemId,
          quantity: "750.000",
        },
      ],
    };
    await withDbTransaction((tx) => applyConsumption(tx, snapshot));
    await expect(
      withDbTransaction((tx) =>
        applyConsumption(tx, {
          ...snapshot,
          lines: [{ ...snapshot.lines[0], quantity: "751.000" }],
        }),
      ),
    ).rejects.toThrow("Consumption snapshot conflict");
    expect(
      await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, e.order)),
    ).toHaveLength(1);
  });
  it("partial applicator error rolls back movement and preserves pending/backoff for retry", async () => {
    const e = await publish();
    const apply = handler;
    handler = async (tx, event) => {
      await apply(tx, event);
      throw new Error("secret diagnostic should never leak");
    };
    const first = await retryModuleEvents({
      businessId: world.businessId,
      eventIds: [e.eventId],
      force: true,
    });
    expect(first.failed).toBe(1);
    expect(
      await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, e.order)),
    ).toHaveLength(0);
    const [delivery] = await getDb()
      .select()
      .from(moduleEventDeliveries)
      .where(
        and(
          eq(moduleEventDeliveries.eventId, e.eventId),
          eq(moduleEventDeliveries.subscriberId, subscriber),
        ),
      );
    expect(delivery).toMatchObject({
      state: "pending",
      attempts: 1,
      diagnostic: "application_failed",
    });
    expect(delivery.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    handler = apply;
    expect(
      (
        await retryModuleEvents({
          businessId: world.businessId,
          eventIds: [e.eventId],
          force: true,
        })
      ).applied,
    ).toBe(1);
  });
  it("disabled snapshot stays terminal across reactivation; OFF emits no retroactive event", async () => {
    await getDb()
      .update(businessModules)
      .set({ enabled: false })
      .where(
        and(
          eq(businessModules.businessId, world.businessId),
          eq(businessModules.moduleId, "stock"),
        ),
      );
    const e = await publish();
    await getDb()
      .update(businessModules)
      .set({ enabled: true })
      .where(
        and(
          eq(businessModules.businessId, world.businessId),
          eq(businessModules.moduleId, "stock"),
        ),
      );
    await retryModuleEvents({ businessId: world.businessId, force: true });
    const [delivery] = await getDb()
      .select()
      .from(moduleEventDeliveries)
      .where(
        and(
          eq(moduleEventDeliveries.eventId, e.eventId),
          eq(moduleEventDeliveries.subscriberId, subscriber),
        ),
      );
    expect(delivery).toMatchObject({
      state: "skipped",
      terminalReason: "modules_disabled",
    });
    expect(
      await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, e.order)),
    ).toHaveLength(0);
    process.env.MODULE_EVENTS_ENABLED = "false";
    const order = randomUUID();
    expect(
      await withDbTransaction((tx) =>
        publishSaleClosed(tx, {
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: order,
          userId: world.ownerId,
          closedAt: new Date(),
          lines: [],
        }),
      ),
    ).toBeNull();
    process.env.MODULE_EVENTS_ENABLED = "true";
    expect(
      await getDb()
        .select()
        .from(moduleEvents)
        .where(eq(moduleEvents.sourceId, order)),
    ).toHaveLength(0);
  });
  it("expired claim recovers; live claim blocks only count with consumption_pending", async () => {
    const e = await publish(1);
    await getDb()
      .update(moduleEventDeliveries)
      .set({
        state: "processing",
        claimToken: randomUUID(),
        claimUntil: new Date(Date.now() + 60000),
      })
      .where(eq(moduleEventDeliveries.eventId, e.eventId));
    await expect(
      recordAdjustment(world.businessId, world.ownerId, itemId, {
        countedQuantity: "10",
      }),
    ).rejects.toMatchObject({ code: "consumption_pending" });
    await getDb()
      .update(moduleEventDeliveries)
      .set({ claimUntil: new Date(0) })
      .where(eq(moduleEventDeliveries.eventId, e.eventId));
    expect(
      (
        await retryModuleEvents({
          businessId: world.businessId,
          eventIds: [e.eventId],
          force: true,
        })
      ).applied,
    ).toBe(1);
  });
  it("new confirmed close during drain invalidates only count; no POS lock held", async () => {
    const e = await publish(1);
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      seen = new Promise<void>((r) => (entered = r));
    const apply = handler;
    handler = async (tx, event) => {
      entered();
      await gate;
      await apply(tx, event);
    };
    const count = recordAdjustment(world.businessId, world.ownerId, itemId, {
      countedQuantity: "1000",
    });
    const outcome = count.then(
      (value) => ({ value, error: null }),
      (error) => ({ value: null, error }),
    );
    await seen;
    const newer = await publish(1);
    release();
    const result = await outcome;
    expect(result.error).toMatchObject({ code: "count_changed" });
    handler = apply;
    // A deadline can leave the claim abandoned: simulate lease expiry and recover it.
    await getDb()
      .update(moduleEventDeliveries)
      .set({ claimUntil: new Date(0) })
      .where(eq(moduleEventDeliveries.eventId, e.eventId));
    await retryModuleEvents({
      businessId: world.businessId,
      eventIds: [e.eventId, newer.eventId],
      force: true,
    });
    expect(
      await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, e.order)),
    ).toHaveLength(1);
    expect(
      await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, newer.order)),
    ).toHaveLength(1);
  });
  it("close overlapping final SERIALIZABLE predicate is ordered before/after count without lost consumption", async () => {
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      seen = new Promise<void>((r) => (entered = r));
    const blocker = withDbTransaction(async (tx) => {
      await tx.execute(
        sql`select id from stock.item where id=${itemId}::uuid for update`,
      );
      entered();
      await gate;
    });
    await seen;
    const count = recordAdjustment(world.businessId, world.ownerId, itemId, {
      countedQuantity: "1000",
    }).then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error }),
    );
    const beforeMovements = await getDb()
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.itemId, itemId));
    const beforeBalance = await onHandSql(itemId);
    try {
      await waitForLockWaiters(1);
      const newer = await publish(1);
      release();
      await blocker;
      const result = await count;
      await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [newer.eventId],
        force: true,
      });
      const consumption = await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, newer.order));
      expect(consumption).toHaveLength(1);
      expect(consumption[0].quantity).toBe("-250.000");
      if (result.ok) expect(await onHandSql(itemId)).toBe("750.000");
      else {
        expect((result as { error: { code: string } }).error.code).toBe(
          "count_changed",
        );
        const afterMovements = await getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.itemId, itemId));
        expect(
          afterMovements.filter((m) => m.kind === "adjustment"),
        ).toHaveLength(
          beforeMovements.filter((m) => m.kind === "adjustment").length,
        );
        expect(await onHandSql(itemId)).toBe(
          (Number(beforeBalance) - 250).toFixed(3),
        );
      }
    } finally {
      release();
      await blocker;
      await count;
    }
  });

  it("slow DB applicator is canceled within retry budget and never applied partially", async () => {
    const version = await getDb().execute(sql`show server_version_num`);
    expect(Number(version.rows[0].server_version_num)).toBeGreaterThanOrEqual(
      170000,
    );
    const e = await publish(1);
    let completed = 0;
    handler = async (tx) => {
      for (let step = 0; step < 10; step++) {
        await tx.execute(sql`select pg_sleep(0.1)`);
        completed++;
      }
    };
    const started = Date.now();
    const result = await retryModuleEvents({
      businessId: world.businessId,
      eventIds: [e.eventId],
      budgetMs: 2000,
      force: true,
    });
    expect(Date.now() - started).toBeLessThan(2500);
    expect(completed).toBeGreaterThanOrEqual(1);
    expect(completed).toBeLessThan(10);
    expect(result.failed).toBe(1);
    expect(result.applied).toBe(0);
    expect(
      await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.sourceOrderId, e.order)),
    ).toHaveLength(0);
    resetHandler();
    await getDb()
      .update(moduleEventDeliveries)
      .set({ state: "pending", claimToken: null, claimUntil: null })
      .where(eq(moduleEventDeliveries.eventId, e.eventId));
    await retryModuleEvents({
      businessId: world.businessId,
      eventIds: [e.eventId],
      force: true,
    });
  });
});
