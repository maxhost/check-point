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
  recipeConsumptionSources,
  analyticsMetricContributions,
  analyticsDailyMetrics,
  businessModules,
  locations,
} from "@mi-pasaporte/db/schema";
import { and, eq } from "drizzle-orm";
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
import { appendModuleEvent } from "../../../server/module-events/append";
import { retryModuleEvents } from "../../../server/module-events/retry";
import { recordPurchase } from "../../stock/movements";
import { readSaleConsumptionCost } from "./consumption-cost";
import type { MeasuredConsumptionApplied } from "./consumption-applied";
let world: ModuleWorld, other: ModuleWorld;
beforeAll(async () => {
  world = await seedModuleWorld("Measured delivery");
  other = await seedModuleWorld("Measured outsider");
  await enableModules(world, ["stock", "recipes"]);
}, 120000);
afterAll(async () => {
  await dropModuleWorld(other);
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
function moneySnapshot(
  settlement: ReturnType<typeof buildFinancialSettlementFromSnapshots>,
) {
  return {
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
      commissionMinor: "0",
      resourceVersions: [
        {
          providerId: "recipes",
          slot: "composition",
          versionId: f.resolution.id,
        },
      ],
    })),
    money: moneySnapshot(settlement),
    payments: [],
    paymentOriginals: [],
  };
  decodeMeasuredSaleClosedEvent(payload);
  const { eventId } = await withDbTransaction((tx) =>
    appendModuleEvent(tx, {
      businessId: world.businessId,
      eventType: "sale.closed",
      eventVersion: 4,
      sourceId: payload.sourceOrderId,
      locationId: world.locationId,
      payload,
    }),
  );
  const [event] = await getDb()
    .select()
    .from(moduleEvents)
    .where(eq(moduleEvents.id, eventId));
  return { ...event, payload };
}
type Event = Awaited<ReturnType<typeof rawEvent>>;
const costArgs = (e: Event) => ({
  businessId: e.businessId,
  locationId: e.payload.locationId,
  sourceOrderId: e.sourceId,
});
async function deliveries(id: string) {
  return getDb()
    .select()
    .from(moduleEventDeliveries)
    .where(eq(moduleEventDeliveries.eventId, id));
}
async function derived(e: Event) {
  return getDb()
    .select()
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, e.businessId),
        eq(moduleEvents.sourceId, e.sourceId),
        eq(moduleEvents.eventType, "recipes.consumption.applied"),
      ),
    );
}
async function effects(e: Event) {
  const movements = await getDb()
    .select()
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.businessId, e.businessId),
        eq(stockMovements.sourceOrderId, e.sourceId),
      ),
    );
  const sources = await getDb()
    .select()
    .from(recipeConsumptionSources)
    .where(
      and(
        eq(recipeConsumptionSources.businessId, e.businessId),
        eq(recipeConsumptionSources.sourceOrderId, e.sourceId),
      ),
    );
  const contributions = await getDb()
    .select()
    .from(analyticsMetricContributions)
    .where(eq(analyticsMetricContributions.businessId, e.businessId));
  const daily = await getDb()
    .select()
    .from(analyticsDailyMetrics)
    .where(eq(analyticsDailyMetrics.businessId, e.businessId));
  return {
    movements,
    sources,
    contributions,
    daily,
    derived: await derived(e),
  };
}
async function retry(e: Event, subscriberIds?: string[]) {
  return retryModuleEvents({
    businessId: e.businessId,
    eventIds: [e.id],
    subscriberIds,
    force: true,
  });
}
async function requeue(id: string) {
  await getDb()
    .update(moduleEventDeliveries)
    .set({ state: "pending", appliedAt: null })
    .where(eq(moduleEventDeliveries.eventId, id));
}
async function buy(f: Awaited<ReturnType<typeof fixture>>, totalCost = "20") {
  await recordPurchase(world.businessId, world.ownerId, f.item.id, {
    locationId: world.locationId,
    quantity: "10",
    totalCost,
  });
}
describe.skipIf(!modulesIntegrationEnabled)(
  "0242 measured consumers through durable delivery",
  () => {
    it("ACKs mixed units/mass, ledger3, rational provenance2, derived2 and real analytics; freezes replay", async () => {
      const uf = await fixture("unit"),
        mf = await fixture("lb");
      await buy(uf);
      await buy(mf, "0");
      const e = await rawEvent(uf, "2", UNIT_MEASURE);
      const m = await rawEvent(mf, "1", { ...mass, quantityUnit: "lb" });
      e.payload.lines.push({ ...m.payload.lines[0], position: 1 });
      await getDb()
        .update(moduleEvents)
        .set({ payload: e.payload })
        .where(eq(moduleEvents.id, e.id));
      expect(await deliveries(e.id)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            subscriberId: "recipes",
            state: "pending",
          }),
          expect.objectContaining({
            subscriberId: "core.analytics",
            state: "pending",
          }),
        ]),
      );
      expect(await readSaleConsumptionCost(costArgs(e))).toMatchObject({
        state: "pendiente",
      });
      expect(await retry(e)).toMatchObject({
        claimed: 2,
        applied: 2,
        failed: 0,
        pending: 0,
      });
      expect(
        (await deliveries(e.id)).map((d) => [d.subscriberId, d.state]).sort(),
      ).toEqual([
        ["core.analytics", "applied"],
        ["recipes", "applied"],
      ]);
      const [d] = await derived(e);
      expect(d).toMatchObject({ eventVersion: 2 });
      const p = d.payload as MeasuredConsumptionApplied;
      expect(
        p.lines.map((l) => [
          l.quantity,
          l.cost?.amountMinor,
          l.allocatedCommissionMinor,
        ]),
      ).toEqual([
        ["2", "1200", "0"],
        ["1", "0", "0"],
      ]);
      expect(
        await retryModuleEvents({
          businessId: e.businessId,
          eventIds: [d.id],
          force: true,
        }),
      ).toMatchObject({ claimed: 1, applied: 1, failed: 0 });
      expect(await deliveries(d.id)).toEqual([
        expect.objectContaining({
          subscriberId: "core.analytics",
          state: "applied",
        }),
      ]);
      const before = await effects(e);
      expect(before.movements).toHaveLength(2);
      expect(before.movements.map((r) => r.quantity).sort()).toEqual([
        "-3.000",
        "-6.000",
      ]);
      expect(before.sources).toHaveLength(4);
      expect(before.sources.every((s) => s.quantityVersion === 2)).toBe(true);
      for (const [line, recipes, exact] of [
        [e.payload.lines[0], ["2", "2"], ["2", "4"]],
        [e.payload.lines[1], ["1", "1"], ["1", "2"]],
      ] as const) {
        const rows = before.sources.filter(
          (s) => s.sourceLineId === line.sourceLineId,
        );
        expect(rows).toHaveLength(2);
        expect(rows.map((s) => s.recipeQuantityNumerator).sort()).toEqual(
          [...recipes].sort(),
        );
        expect(rows.map((s) => s.exactQuantityNumerator).sort()).toEqual(
          [...exact].sort(),
        );
        expect(
          rows.map((s) => [
            s.recipeQuantityDenominator,
            s.exactQuantityDenominator,
          ]),
        ).toEqual([
          ["1", "1"],
          ["1", "1"],
        ]);
      }
      for (const [metric, product, quantity] of [
        ["units_sold", uf.productId, "2"],
        ["units_with_cost", uf.productId, "2"],
        ["mass_sold_g", mf.productId, "453.59237"],
        ["mass_with_cost_g", mf.productId, "453.59237"],
      ]) {
        const rows = before.contributions.filter(
          (r) =>
            r.metric === metric &&
            r.dimensionKind === "product" &&
            r.dimensionId === product,
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].quantity).toBe(quantity);
      }
      expect(await readSaleConsumptionCost(costArgs(e))).toMatchObject({
        state: "completo",
        knownCost: "12.00",
        lines: expect.arrayContaining([
          expect.objectContaining({
            sourceLineId: e.payload.lines[1].sourceLineId,
            state: "completo",
            knownCost: "0.00",
          }),
        ]),
      });
      await buy(uf, "100");
      await buy(mf, "70");
      const originalDerivedDeliveries = await deliveries(d.id);
      await requeue(e.id);
      expect(await retry(e)).toMatchObject({
        claimed: 2,
        applied: 2,
        failed: 0,
      });
      expect(await effects(e)).toEqual(before);
      expect(await deliveries(d.id)).toEqual(originalDerivedDeliveries);
      await requeue(d.id);
      expect(
        await retryModuleEvents({
          businessId: e.businessId,
          eventIds: [d.id],
          force: true,
        }),
      ).toMatchObject({ claimed: 1, applied: 1, failed: 0 });
      expect(await effects(e)).toEqual(before);
      expect(await readSaleConsumptionCost(costArgs(e))).toMatchObject({
        state: "completo",
        knownCost: "12.00",
      });
    }, 120000);
    it("keeps tiny positive rational sources incomplete, with no fictitious stock or known mass", async () => {
      const f = await fixture("lb", true);
      await buy(f, "0");
      const e = await rawEvent(f, "0.000000001");
      expect(await retry(e)).toMatchObject({
        claimed: 2,
        applied: 2,
        failed: 0,
      });
      const [d] = await derived(e);
      expect(
        (d.payload as MeasuredConsumptionApplied).lines[0].cost,
      ).toBeNull();
      expect(
        await retryModuleEvents({
          businessId: e.businessId,
          eventIds: [d.id],
          force: true,
        }),
      ).toMatchObject({ claimed: 1, applied: 1, failed: 0 });
      const actual = await effects(e);
      expect(actual.movements).toEqual([]);
      expect(actual.sources).toHaveLength(2);
      expect(
        actual.sources.every(
          (s) =>
            s.quantityVersion === 2 &&
            BigInt(s.exactQuantityNumerator!) > 0n &&
            BigInt(s.exactQuantityDenominator!) > 0n &&
            BigInt(s.recipeQuantityNumerator!) > 0n &&
            BigInt(s.recipeQuantityDenominator!) > 0n &&
            s.allocatedQuantity === "0.000",
        ),
      ).toBe(true);
      expect(
        actual.contributions.filter(
          (r) =>
            r.dimensionId === f.productId && r.metric === "mass_with_cost_g",
        ),
      ).toEqual([]);
      const sold = actual.contributions.filter(
        (r) => r.dimensionId === f.productId && r.metric === "mass_sold_g",
      );
      expect(sold).toHaveLength(1);
      expect(sold[0].quantity).toBe("0.000000001");
      expect(await readSaleConsumptionCost(costArgs(e))).toMatchObject({
        state: "incompleto",
        reasons: expect.arrayContaining(["redondeo_sin_consumo"]),
      });
    }, 60000);
    it("rolls back ledger, provenance and ACK when the derived snapshot conflicts", async () => {
      const f = await fixture("unit");
      await buy(f);
      const e = await rawEvent(f, "1", UNIT_MEASURE);
      await getDb()
        .insert(moduleEvents)
        .values({
          businessId: e.businessId,
          eventType: "recipes.consumption.applied",
          eventVersion: 1,
          sourceId: e.sourceId,
          locationId: world.locationId,
          payload: { eventVersion: 1 },
        });
      const before = await effects(e);
      expect(await retry(e, ["recipes"])).toMatchObject({
        claimed: 1,
        applied: 0,
        failed: 1,
        pending: 1,
      });
      expect(await effects(e)).toEqual(before);
      const recipes = (await deliveries(e.id)).find(
        (d) => d.subscriberId === "recipes",
      );
      expect(recipes).toMatchObject({
        state: "pending",
        attempts: 1,
        diagnostic: "application_failed",
        claimToken: null,
        appliedAt: null,
      });
      expect(await readSaleConsumptionCost(costArgs(e))).toMatchObject({
        state: "pendiente",
      });
    }, 60000);
    it("rejects inconsistent version/location and non-object envelopes in both recipes and core analytics before effects", async () => {
      const f = await fixture("unit");
      await buy(f);
      for (const patch of [
        { eventVersion: 3 },
        { locationId: other.locationId },
        { payload: "invalid" },
        { payload: [] },
        { payload: {} },
      ]) {
        const e = await rawEvent(f, "1", UNIT_MEASURE);
        await getDb()
          .update(moduleEvents)
          .set(patch)
          .where(eq(moduleEvents.id, e.id));
        const before = await effects(e);
        expect(await retry(e)).toMatchObject({
          claimed: 2,
          applied: 0,
          failed: 2,
          pending: 2,
        });
        expect(await effects(e)).toEqual(before);
        const ds = await deliveries(e.id);
        expect(ds).toHaveLength(2);
        expect(
          ds.map((d) => [d.subscriberId, d.state, d.diagnostic]).sort(),
        ).toEqual([
          ["core.analytics", "pending", "application_failed"],
          ["recipes", "pending", "application_failed"],
        ]);
        expect(await readSaleConsumptionCost(costArgs(e))).toMatchObject({
          state: "incompleto",
        });
        expect(
          await readSaleConsumptionCost({
            ...costArgs(e),
            saleContext: { lines: e.payload.lines },
          }),
        ).toMatchObject({
          state: "incompleto",
          lines: expect.arrayContaining([
            expect.objectContaining({
              sourceLineId: e.payload.lines[0].sourceLineId,
              state: "incompleto",
            }),
          ]),
        });
      }
    }, 120000);
    it("preserves skipped modules, foreign tenant/local reads and invalid/unknown context", async () => {
      const f = await fixture("unit");
      await getDb()
        .update(businessModules)
        .set({ enabled: false })
        .where(
          and(
            eq(businessModules.businessId, world.businessId),
            eq(businessModules.moduleId, "stock"),
          ),
        );
      const e = await rawEvent(f, "1", UNIT_MEASURE);
      await enableModules(world, ["stock"]);
      expect(
        (await deliveries(e.id)).find((d) => d.subscriberId === "recipes"),
      ).toMatchObject({
        state: "skipped",
        terminalReason: "modules_disabled",
        attempts: 0,
      });
      expect(await readSaleConsumptionCost(costArgs(e))).toMatchObject({
        state: "incompleto",
        reasons: expect.arrayContaining(["sin_receta"]),
      });
      expect(await retry(e)).toMatchObject({
        claimed: 1,
        applied: 1,
        failed: 0,
      });
      expect((await effects(e)).movements).toEqual([]);
      expect(await derived(e)).toEqual([]);
      expect(
        await readSaleConsumptionCost({
          ...costArgs(e),
          businessId: other.businessId,
          locationId: other.locationId,
        }),
      ).toMatchObject({ state: "incompleto", lines: [], knownCost: null });
      await expect(
        readSaleConsumptionCost({
          ...costArgs(e),
          businessId: other.businessId,
        }),
      ).rejects.toMatchObject({ code: "location_not_found" });
      const [second] = await getDb()
        .insert(locations)
        .values({
          businessId: world.businessId,
          name: "Second",
          countryCode: "EC",
          addressLabel: "Quito",
          addressSnapshot: {},
        })
        .returning();
      expect(
        await readSaleConsumptionCost({
          ...costArgs(e),
          locationId: second.id,
        }),
      ).toMatchObject({ state: "incompleto", lines: [], knownCost: null });
      expect(
        await retryModuleEvents({
          businessId: other.businessId,
          eventIds: [e.id],
          force: true,
        }),
      ).toMatchObject({ claimed: 0, applied: 0, failed: 0 });
      const broken = await rawEvent(f, "1", UNIT_MEASURE);
      await getDb()
        .update(moduleEvents)
        .set({ payload: { ...broken.payload, lines: [null] } })
        .where(eq(moduleEvents.id, broken.id));
      await getDb()
        .update(moduleEventDeliveries)
        .set({ state: "applied" })
        .where(eq(moduleEventDeliveries.eventId, broken.id));
      expect(await readSaleConsumptionCost(costArgs(broken))).toMatchObject({
        state: "incompleto",
        knownCost: null,
      });
    }, 60000);
  },
);
