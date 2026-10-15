import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  moduleEventDeliveries,
  stockItemLocations,
} from "@mi-pasaporte/db/schema";
import {
  dropModuleWorld,
  enableModules,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../../modules-integration-support";
import { retryModuleEvents } from "../../../server/module-events";
import { applyConsumption } from "../../stock/consumption";
import { recordAdjustment, recordPurchase } from "../../stock/movements";
import { readSaleConsumptionCost } from "./consumption-cost";
import { setupCostWorld } from "./consumption-cost-integration-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;

run("0230 frozen cost and captured sale coverage", { timeout: 60000 }, () => {
  type Fixture = Awaited<ReturnType<typeof setupCostWorld>>;
  let world: ModuleWorld, other: ModuleWorld, second: string;
  let item: Fixture["item"],
    average: Fixture["average"],
    currency: Fixture["currency"],
    sale: Fixture["sale"],
    rows: Fixture["rows"],
    clearRecipe: Fixture["clearRecipe"];
  const previous = process.env.MODULE_EVENTS_ENABLED;
  beforeAll(async () => {
    ({
      world,
      other,
      second,
      item,
      average,
      currency,
      sale,
      rows,
      clearRecipe,
    } = await setupCostWorld());
    process.env.MODULE_EVENTS_ENABLED = "true";
  });
  afterAll(async () => {
    if (previous === undefined) delete process.env.MODULE_EVENTS_ENABLED;
    else process.env.MODULE_EVENTS_ENABLED = previous;
    await dropModuleWorld(world);
    await dropModuleWorld(other);
  });
  async function apply(s: Awaited<ReturnType<typeof sale>>) {
    const result = await retryModuleEvents({
      businessId: s.businessId,
      eventIds: [s.eventId!],
      force: true,
    });
    expect(result).toMatchObject({ applied: 1, failed: 0 });
  }

  it("freezes average/factor at application; purchases, counts, recipe changes and replay preserve snapshot", async () => {
    const id = await item();
    await currency("USD");
    await recordPurchase(world.businessId, world.ownerId, id, {
      locationId: world.locationId,
      quantity: "10",
      totalCost: "20",
    });
    await recordPurchase(world.businessId, world.ownerId, id, {
      locationId: world.locationId,
      quantity: "5",
      totalCost: "20",
    });
    const s = await sale([{ itemId: id, quantity: "1.000" }], { sold: 3 });
    await apply(s);
    const [before] = await rows(s.sourceOrderId);
    expect(before).toMatchObject({
      quantity: "-3.000",
      totalCost: null,
      consumptionUnitCost: "2.666667",
      consumptionLossFactor: "1.000000",
      consumptionCurrencyCode: "USD",
      consumptionMinorUnits: 2,
    });
    expect(await readSaleConsumptionCost(s)).toMatchObject({
      state: "completo",
      knownCost: "8.00",
    });
    await recordPurchase(world.businessId, world.ownerId, id, {
      locationId: world.locationId,
      quantity: "10",
      totalCost: "100",
    });
    await recordAdjustment(world.businessId, world.ownerId, id, {
      locationId: world.locationId,
      countedQuantity: "2",
    });
    await clearRecipe(s.productId);
    await currency("ZZZ");
    const args = {
      businessId: world.businessId,
      locationId: world.locationId,
      sourceOrderId: s.sourceOrderId,
      closedAt: before.occurredAt,
      userId: world.ownerId,
      lines: [
        {
          sourceLineId: s.sourceLineId,
          productId: s.productId,
          itemId: id,
          quantity: "3.000",
        },
      ],
    };
    await withDbTransaction((tx) => applyConsumption(tx, args));
    expect(await rows(s.sourceOrderId)).toEqual([before]);
    expect(
      await readSaleConsumptionCost({ ...s, saleContext: { lines: [] } }),
    ).toMatchObject({
      state: "completo",
      knownCost: "8.00",
      currencyCode: "USD",
    });
    await expect(
      withDbTransaction((tx) =>
        applyConsumption(tx, {
          ...args,
          lines: [{ ...args.lines[0], quantity: "4.000" }],
        }),
      ),
    ).rejects.toThrow("snapshot conflict");
    await currency("USD");
  });

  it("unknown stays null after a later purchase, while a known zero contributes a zero partial", async () => {
    const unknown = await item(),
      zero = await item();
    await average(zero, "0.000000");
    const s = await sale([
      { itemId: unknown, quantity: "1.000" },
      { itemId: zero, quantity: "1.000" },
    ]);
    await apply(s);
    expect(await readSaleConsumptionCost(s)).toMatchObject({
      state: "incompleto",
      knownCost: "0.00",
      missingPrices: [{ itemId: unknown, sourceLineIds: [s.sourceLineId] }],
    });
    const [pair] = await getDb()
      .select()
      .from(stockItemLocations)
      .where(eq(stockItemLocations.itemId, unknown));
    expect(pair.weightedAverageInitializedAt).toBeNull();
    await recordPurchase(world.businessId, world.ownerId, unknown, {
      locationId: world.locationId,
      quantity: "3",
      totalCost: "6",
    });
    expect(
      (await rows(s.sourceOrderId)).find((r) => r.itemId === unknown)
        ?.consumptionUnitCost,
    ).toBeNull();
    const allUnknown = await item();
    const u = await sale([{ itemId: allUnknown, quantity: "1.000" }]);
    await apply(u);
    expect(await readSaleConsumptionCost(u)).toMatchObject({
      state: "incompleto",
      knownCost: null,
    });
  });

  it("uses a purchase committed after close but before application and rounds COP positives to complete zero", async () => {
    const id = await item();
    await currency("COP");
    const s = await sale([{ itemId: id, quantity: "1.000" }]);
    // A live claim makes the existing purchase pre-drain leave this sale unapplied.
    await getDb()
      .update(moduleEventDeliveries)
      .set({
        state: "processing",
        claimToken: randomUUID(),
        claimUntil: new Date("2099-01-01"),
      })
      .where(
        and(
          eq(moduleEventDeliveries.eventId, s.eventId!),
          eq(moduleEventDeliveries.subscriberId, "recipes"),
        ),
      );
    await recordPurchase(world.businessId, world.ownerId, id, {
      locationId: world.locationId,
      quantity: "4",
      totalCost: "1",
    });
    expect(await rows(s.sourceOrderId)).toHaveLength(0);
    await getDb()
      .update(moduleEventDeliveries)
      .set({ state: "pending", claimToken: null, claimUntil: null })
      .where(
        and(
          eq(moduleEventDeliveries.eventId, s.eventId!),
          eq(moduleEventDeliveries.subscriberId, "recipes"),
        ),
      );
    await apply(s);
    expect(
      await getDb()
        .select({ state: moduleEventDeliveries.state })
        .from(moduleEventDeliveries)
        .where(
          and(
            eq(moduleEventDeliveries.eventId, s.eventId!),
            ne(moduleEventDeliveries.subscriberId, "recipes"),
          ),
        ),
    ).toEqual([{ state: "skipped" }]);
    expect(await readSaleConsumptionCost(s)).toMatchObject({
      state: "completo",
      knownCost: "0",
      currencyCode: "COP",
      minorUnits: 0,
    });
    await currency("USD");
  });

  it("marks skipped/no recipe/empty revision incomplete; mixed recoverable failures stay pending without abandoning retries", async () => {
    const id = await item();
    await average(id, "1");
    const s = await sale([{ itemId: id, quantity: "1.000" }], {
      missingLine: true,
    });
    expect(await readSaleConsumptionCost(s)).toMatchObject({
      state: "pendiente",
      knownCost: null,
      missingRecipes: [
        { productId: expect.any(String), sourceLineId: expect.any(String) },
      ],
    });
    await currency("ZZZ");
    const retry = await retryModuleEvents({
      businessId: world.businessId,
      eventIds: [s.eventId!],
      force: true,
    });
    expect(retry.failed).toBe(1);
    expect(await rows(s.sourceOrderId)).toHaveLength(0);
    expect((await readSaleConsumptionCost(s)).state).toBe("pendiente");
    await currency("USD");
    await apply(s);
    expect(await readSaleConsumptionCost(s)).toMatchObject({
      state: "incompleto",
      knownCost: "1.00",
    });
    const empty = await sale([]);
    await apply(empty);
    expect(await readSaleConsumptionCost(empty)).toMatchObject({
      state: "incompleto",
      knownCost: null,
      missingRecipes: [
        { sourceLineId: empty.sourceLineId, productId: empty.productId },
      ],
    });
    await enableModules(other, []);
    await getDb().execute(
      sql`update core.business_module set enabled=false where business_id=${other.businessId}::uuid and module_id='stock'`,
    );
    const skipped = await sale(null, { owner: other });
    expect(await readSaleConsumptionCost(skipped)).toMatchObject({
      state: "incompleto",
      knownCost: null,
      missingRecipes: [
        { sourceLineId: skipped.sourceLineId, productId: skipped.productId },
      ],
    });
  });

  it("isolates local/tenant costs and keeps archived local reads; absent events never produce zero", async () => {
    const id = await item();
    await average(id, "2", world.locationId);
    await average(id, "9", second);
    const first = await sale([{ itemId: id, quantity: "1.000" }]);
    const next = await sale([{ itemId: id, quantity: "1.000" }], {
      locationId: second,
    });
    await apply(first);
    await apply(next);
    expect((await readSaleConsumptionCost(first)).knownCost).toBe("2.00");
    expect((await readSaleConsumptionCost(next)).knownCost).toBe("9.00");
    expect(
      await readSaleConsumptionCost({
        ...first,
        businessId: other.businessId,
        locationId: other.locationId,
      }),
    ).toMatchObject({ state: "incompleto", knownCost: null, lines: [] });
    await expect(
      readSaleConsumptionCost({ ...first, locationId: other.locationId }),
    ).rejects.toMatchObject({ code: "location_not_found" });
    await getDb()
      .update(locations)
      .set({ status: "archived" })
      .where(eq(locations.id, second));
    expect((await readSaleConsumptionCost(next)).knownCost).toBe("9.00");
    process.env.MODULE_EVENTS_ENABLED = "false";
    const absent = await sale(null);
    const noContext = await readSaleConsumptionCost(absent);
    expect(noContext).toMatchObject({
      state: "incompleto",
      knownCost: null,
      lines: [],
    });
    expect(
      await readSaleConsumptionCost({
        ...absent,
        saleContext: {
          lines: [
            { sourceLineId: absent.sourceLineId, productId: absent.productId },
          ],
        },
      }),
    ).toMatchObject({
      state: "incompleto",
      knownCost: null,
      lines: [{ state: "incompleto", sourceLineId: absent.sourceLineId }],
    });
    process.env.MODULE_EVENTS_ENABLED = "true";
  });
});
