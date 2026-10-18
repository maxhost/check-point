import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  compositionRevisions,
  businesses,
  users,
  recipeSaleResolutions,
  moduleEventDeliveries,
  stockMovements,
  moduleEvents,
} from "@mi-pasaporte/db/schema";
import { eq } from "drizzle-orm";
import { buildFinancialSettlementFromSnapshots } from "@mi-pasaporte/domain/financial";
import { UNIT_MEASURE, type LineMeasure } from "@mi-pasaporte/domain/measures";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  seedProduct,
  newItem,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../../modules-integration-support";
import { publishSaleClosed } from "../../../server/module-events";
import type {
  SaleClosedEvent,
  SaleClosedEventV4,
} from "../../../server/module-events/types";
import { decodeMeasuredSaleClosedEvent } from "../../../server/module-events/decode";
import { createRecipe } from "./library";
import { saveComposition } from "./compositions";
import { capturedMeasuredConsumption } from "./model/captured-measured";
import { persistProvenance } from "./model/provenance";
let world: ModuleWorld;
beforeAll(async () => {
  world = await seedModuleWorld("Measured captured");
  await enableModules(world, ["stock", "recipes"]);
}, 120000);
afterAll(async () => {
  if (world) {
    await dropModuleWorld(world);
    expect(
      await getDb()
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.id, world.businessId)),
    ).toEqual([]);
    expect(
      await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, world.ownerId)),
    ).toEqual([]);
  }
}, 120000);
const mass: LineMeasure = {
  kind: "mass",
  quantityUnit: "g",
  priceUnit: "lb",
  conversionVersion: "mass-si-1",
};
async function fixture(basisUnit: "unit" | "lb" = "lb", tiny = false) {
  const item = await newItem(world, randomUUID());
  const a = await createRecipe(world.businessId, {
    name: randomUUID(),
    lines: [{ itemId: item.id, quantity: tiny ? "0.001" : "1.000" }],
  });
  const b = await createRecipe(world.businessId, {
    name: randomUUID(),
    lines: [{ itemId: item.id, quantity: tiny ? "0.001" : "2.000" }],
  });
  const productId = await seedProduct(world, randomUUID(), "1.00");
  const composition = await saveComposition(world.businessId, productId, {
    isCombo: true,
    recipes: [
      { recipeId: a.id, quantity: tiny ? "0.001" : "1.000" },
      { recipeId: b.id, quantity: tiny ? "0.001" : "1.000" },
    ],
    expectedRevisionId: null,
  });
  const original = await withDbTransaction((tx) =>
    publishSaleClosed(tx, {
      businessId: world.businessId,
      sourceOrderId: randomUUID(),
      locationId: world.locationId,
      closedAt: new Date(),
      userId: world.ownerId,
      lines: [{ sourceLineId: randomUUID(), productId, quantity: 1 }],
    }),
  );
  const [legacyEvent] = await getDb()
    .select()
    .from(moduleEvents)
    .where(eq(moduleEvents.id, original!.eventId));
  const legacy = legacyEvent.payload as SaleClosedEvent;
  const [base] = await getDb()
    .select()
    .from(compositionRevisions)
    .where(eq(compositionRevisions.id, composition.revisionId!));
  const [resolution] = await getDb()
    .select()
    .from(recipeSaleResolutions)
    .where(
      eq(
        recipeSaleResolutions.id,
        legacy.lines[0].resourceVersions.find(
          (r) => r.providerId === "recipes",
        )!.versionId,
      ),
    );
  const [measuredBase] = await getDb()
    .insert(compositionRevisions)
    .values({ ...base, id: randomUUID(), basisUnit })
    .returning();
  const [measuredResolution] = await getDb()
    .insert(recipeSaleResolutions)
    .values({
      ...resolution,
      id: randomUUID(),
      compositionRevisionId: measuredBase.id,
      basisUnit,
    })
    .returning();
  return {
    item,
    a,
    b,
    productId,
    legacy,
    legacyEvent,
    resolution: measuredResolution,
  };
}
async function rawEvent(
  f: Awaited<ReturnType<typeof fixture>>,
  quantity = "1",
  measure = mass,
  count = 1,
) {
  const lines = Array.from({ length: count }, (_, position) => ({
    sourceLineId: randomUUID(),
    position,
    quantity,
    unitPrice: "0",
    measure,
  }));
  const settlement = buildFinancialSettlementFromSnapshots({
    currencyCode: "USD",
    lines,
    discount: null,
    payments: [],
  });
  const payload: SaleClosedEventV4 = {
    eventVersion: 4,
    sourceOrderId: randomUUID(),
    locationId: world.locationId,
    closedAt: new Date().toISOString(),
    userId: world.ownerId,
    lines: settlement.lines.map((l) => ({
      ...l,
      productId: f.productId,
      quantity,
      measure,
      productLabel: "Measured",
      commissionMinor: null,
      resourceVersions: [
        {
          providerId: "recipes",
          slot: "composition",
          versionId: f.resolution.id,
        },
      ],
    })),
    money: {
      gross: settlement.gross,
      discount: settlement.discount,
      roundingAdjustment: settlement.roundingAdjustment,
      collected: settlement.collected,
      currencyCode: settlement.currencyCode,
      minorUnit: settlement.minorUnit,
      originalGross: settlement.originals.gross,
      originalDiscount: settlement.originals.discount,
      originalNet: settlement.originals.net,
      normalizationAdjustments: settlement.normalizationAdjustments,
    },
    payments: [],
    paymentOriginals: [],
  };
  decodeMeasuredSaleClosedEvent(payload);
  const [event] = await getDb()
    .insert(moduleEvents)
    .values({
      businessId: world.businessId,
      eventType: "sale.closed",
      eventVersion: 4,
      sourceId: payload.sourceOrderId,
      locationId: world.locationId,
      payload,
    })
    .returning();
  return { ...event, payload };
}

import { publishConsumptionApplied } from "./consumption-event";
import type { MeasuredConsumptionApplied } from "./consumption-applied";
import { applyConsumption } from "../../stock/consumption";
import { recordPurchase } from "../../stock/movements";
import { metricTranslators } from "./metrics";
async function publish(event: Awaited<ReturnType<typeof rawEvent>>) {
  await withDbTransaction(async (tx) => {
    const captured = await capturedMeasuredConsumption(
      tx,
      event.businessId,
      event.payload,
    );
    await persistProvenance(tx, event, captured.sources);
    await applyConsumption(tx, {
      businessId: event.businessId,
      locationId: event.payload.locationId,
      sourceOrderId: event.payload.sourceOrderId,
      closedAt: new Date(event.payload.closedAt),
      userId: world.ownerId,
      lines: captured.movements,
    });
    await publishConsumptionApplied(tx, event, captured.expectedLines);
  });
}
async function derived(order: string) {
  const events = await getDb()
    .select()
    .from(moduleEvents)
    .where(eq(moduleEvents.sourceId, order));
  return events.filter((e) => e.eventType === "recipes.consumption.applied");
}
async function deliveries(id: string) {
  return getDb()
    .select()
    .from(moduleEventDeliveries)
    .where(eq(moduleEventDeliveries.eventId, id));
}
describe.skipIf(!modulesIntegrationEnabled)(
  "measured consumption publisher (dormant V4)",
  () => {
    it("persists mixed V2 lines, exact money, ledger quantities and frozen replay/deliveries", async () => {
      const f = await fixture("unit");
      await recordPurchase(world.businessId, world.ownerId, f.item.id, {
        locationId: world.locationId,
        quantity: "10",
        totalCost: "20",
      });
      const event = await rawEvent(f, "2", UNIT_MEASURE);
      // A real captured same-business mass resolution; order and line UUIDs are captured identifiers, not POS rows.
      const mf = await fixture("lb");
      await recordPurchase(world.businessId, world.ownerId, mf.item.id, {
        locationId: world.locationId,
        quantity: "10",
        totalCost: "0",
      });
      const massEvent = await rawEvent(mf, "1", {
        ...mass,
        quantityUnit: "lb",
      });
      const massLine = { ...massEvent.payload.lines[0], position: 1 };
      event.payload.lines.push(massLine);
      await getDb()
        .update(moduleEvents)
        .set({ payload: event.payload })
        .where(eq(moduleEvents.id, event.id));
      decodeMeasuredSaleClosedEvent(event.payload, 4);
      await expect(
        withDbTransaction((tx) =>
          publishConsumptionApplied(tx, { ...event, eventVersion: 3 }, []),
        ),
      ).rejects.toThrow("version mismatch");
      expect(await derived(event.payload.sourceOrderId)).toEqual([]);
      await publish(event);
      const [stored] = await derived(event.payload.sourceOrderId);
      const p = stored.payload as MeasuredConsumptionApplied;
      expect(stored.eventVersion).toBe(2);
      expect(p.eventVersion).toBe(2);
      expect(p.lines).toEqual(
        event.payload.lines.map((l) =>
          expect.objectContaining({
            sourceLineId: l.sourceLineId,
            quantity: l.quantity,
            measure: l.measure,
            revenueMinor: "0",
            allocatedCommissionMinor: null,
          }),
        ),
      );
      expect(p.lines.map((l) => l.cost?.amountMinor)).toEqual(["1200", "0"]);
      expect(p.items.map((i) => i.quantity).sort()).toEqual(["3.000", "6.000"]);
      const metrics = metricTranslators[1].translate({
        ...stored,
        capturedAt: stored.createdAt.toISOString(),
      });
      expect(
        metrics.rows.find((r) => r.metric === "units_with_cost")?.quantity,
      ).toBe("2");
      expect(
        metrics.rows.find((r) => r.metric === "mass_with_cost_g")?.quantity,
      ).toBe("453.59237");
      expect(metrics.gauges?.map((g) => g.unit)).toEqual(
        p.items.map((i) => i.itemUnit),
      );
      const ds = await deliveries(stored.id);
      await recordPurchase(world.businessId, world.ownerId, f.item.id, {
        locationId: world.locationId,
        quantity: "20",
        totalCost: "100",
      });
      // Publisher alone must not re-observe costs or inventory, regardless of a new expected-cost projection.
      await withDbTransaction((tx) => publishConsumptionApplied(tx, event, []));
      expect(await derived(event.payload.sourceOrderId)).toEqual([stored]);
      expect(await deliveries(stored.id)).toEqual(ds);
      for (const patch of [
        { quantity: "3" },
        { measure: { ...UNIT_MEASURE, conversionVersion: "future" } },
        { productLabel: "Changed" },
        { commissionMinor: "1" },
        { measure: { ...mass, quantityUnit: "lb" } },
        {
          money: {
            ...event.payload.lines[0].money,
            net: { numerator: "1", denominator: "1" },
          },
        },
      ]) {
        const changed = {
          ...event,
          payload: {
            ...event.payload,
            lines: [
              { ...event.payload.lines[0], ...patch },
              ...event.payload.lines.slice(1),
            ],
          },
        } as typeof event;
        await expect(
          withDbTransaction((tx) => publishConsumptionApplied(tx, changed, [])),
        ).rejects.toThrow();
        expect(await derived(event.payload.sourceOrderId)).toEqual([stored]);
        expect(await deliveries(stored.id)).toEqual(ds);
      }
      const changedPrice = {
        ...event,
        payload: {
          ...event.payload,
          lines: [
            event.payload.lines[0],
            { ...massLine, measure: { ...massLine.measure, priceUnit: "g" } },
          ],
        },
      } as typeof event;
      await expect(
        withDbTransaction((tx) =>
          publishConsumptionApplied(tx, changedPrice, []),
        ),
      ).rejects.toThrow("conflict");
      expect(await derived(event.payload.sourceOrderId)).toEqual([stored]);
    }, 60000);
    it("does not fabricate coverage for incomplete or tiny positive sources without ledger", async () => {
      for (const tiny of [false, true]) {
        const f = await fixture("lb", tiny);
        const event = await rawEvent(f, tiny ? "0.000000001" : "1");
        await publish(event);
        const [stored] = await derived(event.payload.sourceOrderId);
        const p = stored.payload as MeasuredConsumptionApplied;
        expect(p.lines[0].cost).toBeNull();
        expect(
          metricTranslators[1]
            .translate(stored)
            .rows.filter((r) => r.dimensionKind === "product"),
        ).toEqual([]);
        const movements = await getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.sourceOrderId, event.payload.sourceOrderId));
        expect(movements).toHaveLength(tiny ? 0 : 1);
      }
    }, 60000);
    it("retains exact historical V1 wire contract for sale1-3 and never replaces it by V2", async () => {
      for (const eventVersion of [1, 2, 3] as const) {
        const f = await fixture("unit");
        const measured = await rawEvent(f, "1", UNIT_MEASURE);
        const unitLine = measured.payload.lines[0];
        const legacy = {
          ...measured,
          payload: {
            ...measured.payload,
            eventVersion,
            lines: [{ ...unitLine, quantity: 1 }],
          },
        };
        await withDbTransaction((tx) =>
          publishConsumptionApplied(
            tx,
            legacy as Parameters<typeof publishConsumptionApplied>[1],
            [],
          ),
        );
        const [stored] = await derived(measured.payload.sourceOrderId);
        expect(stored.eventVersion).toBe(1);
        const p = stored.payload as MeasuredConsumptionApplied;
        expect(p.lines[0]).not.toHaveProperty("measure");
        expect(p.lines[0].quantity).toBe("1");
        await expect(
          withDbTransaction((tx) =>
            publishConsumptionApplied(tx, measured, []),
          ),
        ).rejects.toThrow("conflict");
        expect(await derived(measured.payload.sourceOrderId)).toEqual([stored]);
      }
    }, 60000);
  },
);
