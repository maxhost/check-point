import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  moduleEventDeliveries,
  stockItemLocations,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import { SERVER_MODULES } from "../server-registry";
import type { ModuleServer } from "../route-table";
import {
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  seedModuleWorld,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../modules-integration-support";
import {
  publishSaleClosed,
  retryModuleEvents,
} from "../../server/module-events";
import * as moduleEvents from "../../server/module-events";
import { createItem, listItems } from "./items";
import { recordPurchase, recordAdjustment } from "./movements";
import { recordEntry } from "./entries";
import { applyConsumption } from "./consumption";
import { lockItemLocation } from "./local";
const run = modulesIntegrationEnabled ? describe : describe.skip;
const subscriber = "average-integration";
run(
  "0228 average purchases, locks and durable pending",
  { timeout: 60000 },
  () => {
    let world: ModuleWorld,
      other: ModuleWorld,
      second: string,
      pendingItem: string;
    let mode: "ok" | "fail" | "timeout" = "ok",
      attempts = 0;
    const previous = process.env.MODULE_EVENTS_ENABLED;
    beforeAll(async () => {
      world = await seedModuleWorld("average");
      other = await seedModuleWorld("average-other");
      await enableModules(world, ["stock", subscriber]);
      await enableModules(other, ["stock"]);
      const [local] = await getDb()
        .insert(locations)
        .values({
          businessId: world.businessId,
          name: "Segundo",
          addressLabel: "Quito",
          countryCode: "EC",
          addressSnapshot: {},
        })
        .returning({ id: locations.id });
      second = local.id;
      process.env.MODULE_EVENTS_ENABLED = "true";
      (SERVER_MODULES as Record<string, ModuleServer>)[subscriber] = {
        routes: [],
        eventSubscriptions: [
          {
            eventType: "sale.closed",
            resourceType: "product",
            slot: "average-test",
            requiredModules: ["stock"],
            handler: async (tx, event) => {
              attempts++;
              await consume(
                pendingItem,
                "3.000",
                tx,
                event.payload.sourceOrderId,
                event.payload.lines[0].sourceLineId,
              );
              if (mode === "fail") throw new Error("applicator failure");
              if (mode === "timeout") await tx.execute(sql`select pg_sleep(3)`);
            },
          },
        ],
      };
    });
    afterAll(async () => {
      delete (SERVER_MODULES as Record<string, ModuleServer>)[subscriber];
      if (previous === undefined) delete process.env.MODULE_EVENTS_ENABLED;
      else process.env.MODULE_EVENTS_ENABLED = previous;
      await dropModuleWorld(world);
      await dropModuleWorld(other);
    });
    async function item(unit = "unit") {
      return (
        await createItem(world.businessId, {
          name: randomUUID(),
          unit,
          locationId: world.locationId,
        })
      ).id;
    }
    function purchase(
      id: string,
      quantity: string,
      totalCost?: string | null,
      extra: Record<string, unknown> = {},
    ) {
      return recordPurchase(world.businessId, world.ownerId, id, {
        locationId: world.locationId,
        quantity,
        totalCost,
        ...extra,
      });
    }
    async function pair(id: string, locationId = world.locationId) {
      const [p] = await getDb()
        .select()
        .from(stockItemLocations)
        .where(
          and(
            eq(stockItemLocations.itemId, id),
            eq(stockItemLocations.locationId, locationId),
          ),
        );
      return p;
    }
    async function consume(
      id: string,
      quantity: string,
      tx: Parameters<typeof applyConsumption>[0],
      order: string = randomUUID(),
      line: string = randomUUID(),
    ) {
      await applyConsumption(tx, {
        businessId: world.businessId,
        locationId: world.locationId,
        sourceOrderId: order,
        closedAt: new Date(),
        userId: world.ownerId,
        lines: [
          { itemId: id, quantity, sourceLineId: line, productId: randomUUID() },
        ],
      });
    }
    async function pending(id: string) {
      pendingItem = id;
      return withDbTransaction((tx) =>
        publishSaleClosed(tx, {
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: randomUUID(),
          closedAt: new Date(),
          userId: world.ownerId,
          lines: [
            {
              sourceLineId: randomUUID(),
              productId: randomUUID(),
              quantity: 1,
            },
          ],
        }),
      );
    }
    async function recoverPending(id: string, eventId: string) {
      const [delivery] = await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(
          and(
            eq(moduleEventDeliveries.eventId, eventId),
            eq(moduleEventDeliveries.subscriberId, subscriber),
          ),
        );
      expect(["pending", "processing"]).toContain(delivery.state);
      await getDb()
        .update(moduleEventDeliveries)
        .set({ claimUntil: new Date(0) })
        .where(eq(moduleEventDeliveries.id, delivery.id));
      mode = "ok";
      expect(
        (
          await retryModuleEvents({
            businessId: world.businessId,
            locationId: world.locationId,
            force: true,
          })
        ).applied,
      ).toBe(1);
      const current = (
        await listItems(world.businessId, null, world.locationId)
      ).find((x) => x.id === id)!;
      expect(current).toMatchObject({
        onHand: "12.000",
        weightedAverageUnitCost: "2.666667",
      });
      const consumed = await getDb()
        .select({ quantity: stockMovements.quantity })
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.itemId, id),
            eq(stockMovements.kind, "consumption"),
          ),
        );
      expect(consumed).toEqual([{ quantity: "-3.000" }]);
      expect(
        (await retryModuleEvents({ businessId: world.businessId, force: true }))
          .applied,
      ).toBe(0);
      expect((await pair(id)).weightedAverageUnitCost).toBe("2.666667");
    }
    it("uses prior balance and registration order, preserving last cost date and count/consumption", async () => {
      const id = await item();
      await purchase(id, "10", "20", { occurredAt: "2026-01-03T00:00:00Z" });
      const result = await purchase(id, "5", "20", {
        occurredAt: "2026-01-01T00:00:00Z",
      });
      expect(result.item).toMatchObject({
        onHand: "15.000",
        lastUnitCost: "2.000000",
        weightedAverageUnitCost: "2.666667",
      });
      await withDbTransaction((tx) => consume(id, "3.000", tx));
      const counted = await recordAdjustment(
        world.businessId,
        world.ownerId,
        id,
        { locationId: world.locationId, countedQuantity: "8" },
      );
      expect(counted.item).toMatchObject({
        onHand: "8.000",
        weightedAverageUnitCost: "2.666667",
      });
      expect((await purchase(id, "1")).item.weightedAverageUnitCost).toBe(
        "2.666667",
      );
      expect(
        (await listItems(world.businessId, null, world.locationId)).find(
          (x) => x.id === id,
        )?.weightedAverageUnitCost,
      ).toBe("2.666667");
    });
    it("null, zero, unknown positive stock and negative final balance remain distinct", async () => {
      const id = await item();
      expect((await purchase(id, "5")).item.weightedAverageUnitCost).toBeNull();
      expect((await purchase(id, "1", "4")).item.weightedAverageUnitCost).toBe(
        "4.000000",
      );
      await withDbTransaction((tx) => consume(id, "20.000", tx));
      expect((await purchase(id, "1", "0")).item).toMatchObject({
        onHand: "-13.000",
        weightedAverageUnitCost: "0.000000",
      });
      expect((await purchase(id, "1")).item.weightedAverageUnitCost).toBe(
        "0.000000",
      );
    });
    it("repeated entry lines see preceding state, conversions and exact total without intermediate rounding", async () => {
      const id = await item();
      await purchase(id, "0.001", "0");
      const result = await recordEntry(world.businessId, world.ownerId, {
        locationId: world.locationId,
        lines: [
          { itemId: id, unit: "unit", quantity: "0.006", totalCost: "0.01" },
          { itemId: id, unit: "unit", quantity: "0.007", totalCost: "0.01" },
        ],
      });
      expect(result.items[0]).toMatchObject({
        onHand: "0.014",
        weightedAverageUnitCost: "1.428571",
      });
      for (const [unit, input] of [
        ["g", "kg"],
        ["ml", "l"],
      ]) {
        const converted = await item(unit);
        const entry = await recordEntry(world.businessId, world.ownerId, {
          locationId: world.locationId,
          lines: [
            { itemId: converted, unit: input, quantity: "2", totalCost: "4" },
          ],
        });
        expect(entry.items[0]).toMatchObject({
          onHand: "2000.000",
          weightedAverageUnitCost: "0.002000",
        });
      }
    });
    it("late invalid entry line rolls back ledger and existing average", async () => {
      const id = await item();
      await purchase(id, "10", "20");
      const before = await pair(id);
      await expect(
        recordEntry(world.businessId, world.ownerId, {
          locationId: world.locationId,
          lines: [
            { itemId: id, unit: "unit", quantity: "5", totalCost: "20" },
            { itemId: id, unit: "g", quantity: "1", totalCost: "1" },
          ],
        }),
      ).rejects.toMatchObject({ code: "unit_mismatch" });
      expect(await pair(id)).toEqual(before);
      const movements = await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.itemId, id));
      expect(movements).toHaveLength(1);
    });
    it("initializes exactly once from local cost, never global, even unknown and zero", async () => {
      const id = await item();
      await getDb()
        .insert(stockItemLocations)
        .values([
          {
            businessId: world.businessId,
            itemId: id,
            locationId: world.locationId,
            lastUnitCost: "0",
          },
          {
            businessId: world.businessId,
            itemId: id,
            locationId: second,
            lastUnitCost: null,
          },
        ]);
      await withDbTransaction((tx) =>
        lockItemLocation(tx, world.businessId, id, world.locationId),
      );
      await withDbTransaction((tx) =>
        lockItemLocation(tx, world.businessId, id, second),
      );
      expect((await pair(id)).weightedAverageUnitCost).toBe("0.000000");
      expect((await pair(id, second)).weightedAverageUnitCost).toBeNull();
      expect(
        (await pair(id, second)).weightedAverageInitializedAt,
      ).not.toBeNull();
      const before = await pair(id);
      await getDb()
        .update(stockItemLocations)
        .set({ lastUnitCost: "7" })
        .where(
          and(
            eq(stockItemLocations.itemId, id),
            eq(stockItemLocations.locationId, world.locationId),
          ),
        );
      await withDbTransaction((tx) =>
        lockItemLocation(tx, world.businessId, id, world.locationId),
      );
      expect((await pair(id)).weightedAverageUnitCost).toBe("0.000000");
      expect((await pair(id)).weightedAverageInitializedAt).toEqual(
        before.weightedAverageInitializedAt,
      );
    });
    it("serializes concurrent purchases and purchase against consumption", async () => {
      const id = await item();
      await purchase(id, "10", "20");
      await Promise.all([purchase(id, "5", "20"), purchase(id, "5", "10")]);
      const current = (
        await listItems(world.businessId, null, world.locationId)
      ).find((x) => x.id === id)!;
      expect(current.onHand).toBe("20.000");
      expect(current.weightedAverageUnitCost).toBe("2.500000");
      await Promise.all([
        purchase(id, "10", "40"),
        withDbTransaction((tx) => consume(id, "10.000", tx)),
      ]);
      const after = (
        await listItems(world.businessId, null, world.locationId)
      ).find((x) => x.id === id)!;
      expect(after.onHand).toBe("20.000");
      expect(["3.000000", "3.250000"]).toContain(after.weightedAverageUnitCost);
    });
    it("bounded drain values the committed ledger and does not mix locals/tenants", async () => {
      const id = await item();
      await purchase(id, "10", "20");
      const event = await pending(id);
      mode = "ok";
      const originalRetry = retryModuleEvents;
      const observations: {
        options: Parameters<typeof retryModuleEvents>[0];
        result?: Awaited<ReturnType<typeof retryModuleEvents>>;
        error?: unknown;
      }[] = [];
      const observer = vi
        .spyOn(moduleEvents, "retryModuleEvents")
        .mockImplementation(async (options) => {
          try {
            const result = await originalRetry(options);
            observations.push({ options, result });
            return result;
          } catch (error) {
            observations.push({ options, error });
            throw error;
          }
        });
      const attemptsBefore = attempts;
      let result: Awaited<ReturnType<typeof purchase>>;
      try {
        result = await purchase(id, "5", "20");
      } finally {
        observer.mockRestore();
      }
      expect(observations).toHaveLength(1);
      const drain = observations[0];
      expect(drain.options).toEqual({
        businessId: world.businessId,
        locationId: world.locationId,
        budgetMs: 2000,
        force: true,
      });
      const [delivery] = await getDb()
        .select({
          state: moduleEventDeliveries.state,
          attempts: moduleEventDeliveries.attempts,
          diagnostic: moduleEventDeliveries.diagnostic,
        })
        .from(moduleEventDeliveries)
        .where(
          and(
            eq(moduleEventDeliveries.eventId, event!.eventId),
            eq(moduleEventDeliveries.subscriberId, subscriber),
          ),
        );
      const ledger = await getDb()
        .select({
          kind: stockMovements.kind,
          quantity: stockMovements.quantity,
        })
        .from(stockMovements)
        .where(eq(stockMovements.itemId, id));
      expect(
        ledger
          .filter((m) => m.kind === "purchase")
          .map((m) => m.quantity)
          .sort(),
      ).toEqual(["10.000", "5.000"]);
      const consumed = ledger.filter((m) => m.kind === "consumption");
      if (delivery.state === "applied") {
        expect(delivery).toMatchObject({ attempts: 1, diagnostic: null });
        expect(drain.error).toBeUndefined();
        expect(drain.result).toEqual({
          claimed: 1,
          applied: 1,
          pending: 0,
          failed: 0,
        });
        expect(attempts - attemptsBefore).toBe(1);
        expect(consumed).toEqual([{ kind: "consumption", quantity: "-3.000" }]);
        // Applied delivery and consumption are atomic; this average proves the drain preceded purchase.
        expect(result.item).toMatchObject({
          onHand: "12.000",
          weightedAverageUnitCost: "2.833333",
        });
      } else {
        expect(["pending", "processing"]).toContain(delivery.state);
        expect(delivery.attempts).toBeLessThanOrEqual(1);
        if (drain.result) expect(drain.result.applied).toBe(0);
        else expect(drain.error).toBeDefined();
        expect(consumed).toEqual([]);
        expect(result.item).toMatchObject({
          onHand: "15.000",
          weightedAverageUnitCost: "2.666667",
        });
        await recoverPending(id, event!.eventId);
      }
      const average = delivery.state === "applied" ? "2.833333" : "2.666667";
      await purchase(id, "1", "9", { locationId: second });
      expect((await pair(id, second)).weightedAverageUnitCost).toBe("9.000000");
      expect((await pair(id)).weightedAverageUnitCost).toBe(average);
      const foreign = await callModuleRoute(
        "POST",
        `/api/modules/stock/items/${id}/purchases`,
        other.cookie,
        { locationId: other.locationId, quantity: "1", totalCost: "1" },
      );
      expect(foreign.status).toBe(404);
    });
    for (const failure of ["fail", "timeout"] as const)
      it(`${failure} preserves durable pending and valid purchase; recovery does not reweight`, async () => {
        const id = await item();
        await purchase(id, "10", "20");
        const event = await pending(id);
        mode = failure;
        const start = Date.now();
        const result = await purchase(id, "5", "20");
        expect(Date.now() - start).toBeLessThan(6500);
        expect(result.item).toMatchObject({
          onHand: "15.000",
          weightedAverageUnitCost: "2.666667",
        });
        await recoverPending(id, event!.eventId);
      });
    it("one failed drain for an entire repeated multi-line entry, preserving all purchases", async () => {
      const id = await item();
      await purchase(id, "10", "20");
      await pending(id);
      mode = "fail";
      const before = attempts;
      const result = await recordEntry(world.businessId, world.ownerId, {
        locationId: world.locationId,
        lines: [
          { itemId: id, unit: "unit", quantity: "5", totalCost: "20" },
          { itemId: id, unit: "unit", quantity: "5", totalCost: "10" },
        ],
      });
      expect(attempts - before).toBe(1);
      expect(result.items[0]).toMatchObject({
        onHand: "20.000",
        weightedAverageUnitCost: "2.500000",
      });
      mode = "ok";
      await retryModuleEvents({ businessId: world.businessId, force: true });
      expect((await pair(id)).weightedAverageUnitCost).toBe("2.500000");
    });
  },
);
