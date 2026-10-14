import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  locations,
  stockItemLocations,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import {
  api,
  callModuleRoute,
  dropModuleWorld,
  enableModules,
  moduleStaff,
  newItem,
  seedModuleWorld,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../modules-integration-support";
import { recordPurchase, recordAdjustment } from "./movements";
import { listItems } from "./items";
import { listLocations } from "./local";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run("0227 stock local isolation", { timeout: 60000 }, () => {
  let world: ModuleWorld, other: ModuleWorld, itemId: string, second: string;
  beforeAll(async () => {
    world = await seedModuleWorld("local-a");
    other = await seedModuleWorld("local-b");
    await enableModules(world, ["stock"]);
    itemId = (await newItem(world, "Harina")).id;
    const [local] = await getDb()
      .insert(locations)
      .values({
        businessId: world.businessId,
        name: "Segundo",
        addressLabel: "Guayaquil",
        countryCode: "EC",
        addressSnapshot: {},
      })
      .returning({ id: locations.id });
    second = local.id;
  });
  afterAll(async () => {
    await dropModuleWorld(world);
    await dropModuleWorld(other);
  });
  it("separates balances, newest priced purchase and history by local", async () => {
    await recordPurchase(world.businessId, world.ownerId, itemId, {
      locationId: world.locationId,
      quantity: "1000",
      totalCost: "10",
      occurredAt: "2026-01-03T00:00:00Z",
    });
    await recordPurchase(world.businessId, world.ownerId, itemId, {
      locationId: second,
      quantity: "100",
      totalCost: "2",
      occurredAt: "2026-01-03T00:00:00Z",
    });
    await recordPurchase(world.businessId, world.ownerId, itemId, {
      locationId: world.locationId,
      quantity: "100",
      totalCost: "9",
      occurredAt: "2026-01-01T00:00:00Z",
    });
    await recordPurchase(world.businessId, world.ownerId, itemId, {
      locationId: world.locationId,
      quantity: "50",
    });
    expect(
      (await listItems(world.businessId, null, world.locationId))[0],
    ).toMatchObject({
      locationId: world.locationId,
      onHand: "1150.000",
      lastUnitCost: "0.010000",
    });
    expect((await listItems(world.businessId, null, second))[0]).toMatchObject({
      locationId: second,
      onHand: "100.000",
      lastUnitCost: "0.020000",
    });
    const log = await callModuleRoute(
      "GET",
      `/api/modules/stock/movements?locationId=${second}`,
      world.cookie,
    );
    expect(log.status).toBe(200);
    const payload = await log.json();
    expect(payload.locationId).toBe(second);
    expect(payload.pending).toEqual({ count: 0, failed: 0 });
    expect(payload.movements).toHaveLength(1);
    const pairs = await getDb()
      .select()
      .from(stockItemLocations)
      .where(eq(stockItemLocations.itemId, itemId));
    expect(pairs).toHaveLength(2);
  });
  it("rejects foreign/missing and requires selection with multiple active", async () => {
    expect((await api.items(world.cookie)).status).toBe(422);
    for (const id of [other.locationId, randomUUID()]) {
      const response = await callModuleRoute(
        "GET",
        `/api/modules/stock/items?locationId=${id}`,
        world.cookie,
      );
      expect(response.status).toBe(404);
      expect((await response.json()).code).toBe("location_not_found");
    }
    await expect(
      recordPurchase(world.businessId, world.ownerId, itemId, {
        locationId: other.locationId,
        quantity: "1",
      }),
    ).rejects.toMatchObject({ code: "location_not_found" });
  });
  it("stock staff needs no locations permission; default first active", async () => {
    const staff = await moduleStaff(world, ["stock"]);
    const response = await callModuleRoute(
      "GET",
      "/api/modules/stock/locations",
      staff,
    );
    expect(response.status).toBe(200);
    expect((await response.json()).defaultLocationId).toBe(world.locationId);
  });
  it("archived local accepts count and retains history but rejects purchase", async () => {
    await getDb()
      .update(locations)
      .set({ status: "archived" })
      .where(eq(locations.id, second));
    await expect(
      recordPurchase(world.businessId, world.ownerId, itemId, {
        locationId: second,
        quantity: "1",
      }),
    ).rejects.toMatchObject({ code: "location_archived" });
    const counted = await recordAdjustment(
      world.businessId,
      world.ownerId,
      itemId,
      { locationId: second, countedQuantity: "4" },
    );
    expect(counted.item.onHand).toBe("4.000");
    expect(
      (await listLocations(world.businessId)).locations.find(
        (l) => l.id === second,
      )?.status,
    ).toBe("archived");
    expect(
      (await listItems(world.businessId, null, world.locationId))[0].onHand,
    ).toBe("1150.000");
  });
  it("composite FK rejects cross business item/location even direct SQL", async () => {
    await expect(
      getDb().insert(stockMovements).values({
        businessId: other.businessId,
        itemId,
        locationId: other.locationId,
        kind: "purchase",
        quantity: "1",
      }),
    ).rejects.toBeDefined();
    await expect(
      getDb().insert(stockItemLocations).values({
        businessId: world.businessId,
        itemId,
        locationId: other.locationId,
      }),
    ).rejects.toBeDefined();
    const rows = await getDb()
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.businessId, other.businessId),
          eq(stockMovements.itemId, itemId),
        ),
      );
    expect(rows).toHaveLength(0);
  });
});
