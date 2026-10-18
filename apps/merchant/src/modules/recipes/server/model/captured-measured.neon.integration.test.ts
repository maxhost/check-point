import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  compositionRevisions,
  businesses,
  users,
  recipeSaleResolutions,
  recipeConsumptionSources,
  moduleEvents,
  recipeRevisions,
  independentRecipeRevisions,
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
} from "../../../modules-integration-support";
import { publishSaleClosed } from "../../../../server/module-events";
import type {
  SaleClosedEvent,
  SaleClosedEventV4,
} from "../../../../server/module-events/types";
import { decodeMeasuredSaleClosedEvent } from "../../../../server/module-events/decode";
import { createRecipe, updateRecipe } from "../library";
import { saveComposition } from "../compositions";
import { capturedConsumption, type CapturedSource } from "./captured";
import { capturedMeasuredConsumption } from "./captured-measured";
import { persistProvenance } from "./provenance";
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
const expand = (payload: SaleClosedEventV4, businessId = world.businessId) =>
  withDbTransaction((tx) =>
    capturedMeasuredConsumption(tx, businessId, payload),
  );
const readSources = (order: string) =>
  getDb()
    .select()
    .from(recipeConsumptionSources)
    .where(eq(recipeConsumptionSources.sourceOrderId, order));
describe.skipIf(!modulesIntegrationEnabled)(
  "dormant measured captured recipes",
  () => {
    it("keeps legacy versions untouched and V4 unit projections equivalent", async () => {
      const f = await fixture("unit");
      for (const eventVersion of [1, 2, 3] as const) {
        const supported = { ...f.legacy, eventVersion } as SaleClosedEvent;
        await withDbTransaction(async (tx) =>
          expect(
            await capturedMeasuredConsumption(tx, world.businessId, supported),
          ).toEqual(await capturedConsumption(tx, world.businessId, supported)),
        );
        // Quantity-only legacy resolution does not inspect financial metadata.
        const payload = {
          ...f.legacy,
          eventVersion,
          lines: f.legacy.lines.map((l) => ({
            ...l,
            quantity: Number.MAX_SAFE_INTEGER,
          })),
        } as SaleClosedEvent;
        // Use tiny quantity for the projection comparison; huge legacy remains outside the V4 parser.
        const withoutRef = {
          ...payload,
          lines: payload.lines.map((l) => ({ ...l, resourceVersions: [] })),
        } as SaleClosedEvent;
        await withDbTransaction(async (tx) =>
          expect(
            await capturedMeasuredConsumption(tx, world.businessId, withoutRef),
          ).toEqual(
            await capturedConsumption(tx, world.businessId, withoutRef),
          ),
        );
      }
      const legacy = await withDbTransaction((tx) =>
        capturedConsumption(tx, world.businessId, f.legacy),
      );
      const event = await rawEvent(f, "1", UNIT_MEASURE);
      const measured = await expand(event.payload);
      expect(
        measured.movements.map((m) => ({ ...m, sourceLineId: "line" })),
      ).toEqual(legacy.movements.map((m) => ({ ...m, sourceLineId: "line" })));
      expect(measured.sources.every((s) => s.quantityVersion === 2)).toBe(true);
      await withDbTransaction((tx) =>
        persistProvenance(tx, f.legacyEvent as typeof event, legacy.sources),
      );
      await withDbTransaction((tx) =>
        persistProvenance(tx, f.legacyEvent as typeof event, legacy.sources),
      );
      const legacyStored = await readSources(f.legacy.sourceOrderId);
      expect(legacyStored).toHaveLength(2);
      expect(new Set(legacyStored.map((s) => s.recipeId))).toEqual(
        new Set([f.a.id, f.b.id]),
      );
      for (const source of legacyStored)
        expect(source).toMatchObject({
          quantityVersion: 1,
          recipeQuantityNumerator: null,
          recipeQuantityDenominator: null,
          exactQuantityNumerator: null,
          exactQuantityDenominator: null,
        });
    }, 60000);
    it("consolidates within each line, preserves captured authorities, persists exact texts and replays without duplication", async () => {
      const f = await fixture();
      const event = await rawEvent(f, "1", mass, 2);
      const before = await expand(event.payload);
      expect(before.movements).toHaveLength(2);
      expect(before.sources).toHaveLength(4);
      expect(before.sources[0]).toMatchObject({
        recipeQuantityNumerator: "100000",
        recipeQuantityDenominator: "45359237",
        exactQuantityNumerator: "100000",
        exactQuantityDenominator: "45359237",
      });
      await updateRecipe(world.businessId, f.a.id, {
        name: "Changed current",
        lines: [{ itemId: f.item.id, quantity: "99.000" }],
        expectedRevisionId: f.a.revisionId,
      });
      expect(await expand(event.payload)).toEqual(before);
      await withDbTransaction((tx) =>
        persistProvenance(tx, event, before.sources),
      );
      const stored = await readSources(event.payload.sourceOrderId);
      await withDbTransaction((tx) =>
        persistProvenance(tx, event, before.sources),
      );
      expect(await readSources(event.payload.sourceOrderId)).toEqual(stored);
      for (const s of before.sources)
        expect(
          stored.find(
            (r) =>
              r.sourceLineId === s.sourceLineId &&
              r.recipeRevisionId === s.recipeRevisionId,
          ),
        ).toMatchObject(s);
      for (const field of [
        "exactQuantityNumerator",
        "exactQuantityDenominator",
        "recipeQuantityNumerator",
        "recipeQuantityDenominator",
        "exactQuantity",
        "allocatedQuantity",
        "recipeQuantity",
        "resolutionId",
        "compositionRevisionId",
        "recipeId",
        "productId",
        "recipeRevisionId",
        "itemId",
        "sourceLineId",
        "quantityVersion",
      ] as const) {
        const changed = {
          ...before.sources[0],
          [field]:
            field === "quantityVersion"
              ? 1
              : field.endsWith("Id")
                ? randomUUID()
                : field.includes("Quantity") &&
                    !field.endsWith("Numerator") &&
                    !field.endsWith("Denominator")
                  ? "1.000"
                  : "7",
        } as CapturedSource;
        await expect(
          withDbTransaction((tx) =>
            persistProvenance(tx, event, [changed, ...before.sources.slice(1)]),
          ),
        ).rejects.toThrow();
        expect(await readSources(event.payload.sourceOrderId)).toEqual(stored);
      }
    }, 60000);
    it("rejects adding sources to an existing immutable provenance snapshot", async () => {
      const f = await fixture();
      const event = await rawEvent(f, "1", mass, 2);
      const captured = await expand(event.payload);
      // An existing snapshot cannot be completed or extended on a later invocation.
      await withDbTransaction((tx) =>
        persistProvenance(tx, event, captured.sources.slice(0, 2)),
      );
      const stored = await readSources(event.payload.sourceOrderId);
      await expect(
        withDbTransaction((tx) =>
          persistProvenance(tx, event, captured.sources),
        ),
      ).rejects.toThrow("conflict");
      expect(await readSources(event.payload.sourceOrderId)).toEqual(stored);
    }, 60000);
    it("keeps mixed unit and mass captures separate even for the same ingredient", async () => {
      const f = await fixture();
      const massEvent = await rawEvent(f);
      const unitLine = {
        ...massEvent.payload.lines[0],
        resourceVersions: f.legacy.lines[0].resourceVersions,
        sourceLineId: randomUUID(),
        quantity: "2",
        measure: UNIT_MEASURE,
      };
      const payload = {
        ...massEvent.payload,
        lines: [...massEvent.payload.lines, unitLine],
      };
      const mixed = await expand(payload);
      expect(mixed.movements).toHaveLength(2);
      expect(mixed.movements.map((m) => m.quantity)).toEqual([
        "0.007",
        "6.000",
      ]);
      expect(mixed.sources).toHaveLength(4);
      expect(new Set(mixed.sources.map((s) => s.sourceLineId)).size).toBe(2);
      expect(
        mixed.sources
          .filter((s) => s.sourceLineId === unitLine.sourceLineId)
          .map((s) => s.exactQuantityDenominator),
      ).toEqual(["1", "1"]);
    }, 60000);
    it("retains tiny positive sources with zero projections and no movement or complete cost", async () => {
      const f = await fixture("lb", true);
      const event = await rawEvent(f, "0.000000001");
      const result = await expand(event.payload);
      expect(result.movements).toEqual([]);
      expect(result.expectedLines[0]).toMatchObject({
        recipe: "present",
        roundingOmissions: true,
        consumptions: [],
      });
      expect(result.sources[0]).toMatchObject({
        recipeQuantity: "0.000",
        exactQuantity: "0.000000",
        allocatedQuantity: "0.000",
        quantityVersion: 2,
      });
      await withDbTransaction((tx) =>
        persistProvenance(tx, event, result.sources),
      );
      const stored = await readSources(event.payload.sourceOrderId);
      expect(stored).toHaveLength(2);
      const changed = {
        ...result.sources[0],
        exactQuantityNumerator: "3",
      } as CapturedSource;
      await expect(
        withDbTransaction((tx) =>
          persistProvenance(tx, event, [changed, result.sources[1]]),
        ),
      ).rejects.toThrow("conflict");
      expect(await readSources(event.payload.sourceOrderId)).toEqual(stored);
      for (const prefix of ["recipeQuantity", "exactQuantity"] as const) {
        for (const value of ["0", "-1", "01", "1.5", "2"]) {
          const invalid = {
            ...result.sources[0],
            [`${prefix}Numerator`]: value,
            [`${prefix}Denominator`]: "2",
          } as CapturedSource;
          await expect(
            withDbTransaction((tx) => persistProvenance(tx, event, [invalid])),
          ).rejects.toThrow("ratio");
        }
        for (const denominator of ["0", "-1", "01", "1.5"]) {
          const invalid = {
            ...result.sources[0],
            [`${prefix}Numerator`]: "1",
            [`${prefix}Denominator`]: denominator,
          } as CapturedSource;
          await expect(
            withDbTransaction((tx) => persistProvenance(tx, event, [invalid])),
          ).rejects.toThrow("ratio");
        }
      }
      expect(await readSources(event.payload.sourceOrderId)).toEqual(stored);
    }, 60000);
    it("rejects conflicting, foreign, missing, incompatible and legacy mass captures before persistence", async () => {
      const f = await fixture();
      const event = await rawEvent(f);
      const line = event.payload.lines[0];
      const bad = (patch: Partial<typeof line>) => ({
        ...event.payload,
        lines: [{ ...line, ...patch }],
      });
      await expect(expand(event.payload, randomUUID())).rejects.toThrow(
        "unavailable",
      );
      for (const patch of [
        { productId: randomUUID() },
        { productId: null },
        {
          resourceVersions: [
            ...line.resourceVersions,
            ...line.resourceVersions,
          ],
        },
        {
          resourceVersions: [
            {
              providerId: "recipes",
              slot: "composition",
              versionId: randomUUID(),
            },
          ],
        },
        {
          resourceVersions: [
            { providerId: "recipes", slot: "recipe", versionId: randomUUID() },
          ],
        },
        { measure: UNIT_MEASURE },
      ])
        await expect(expand(bad(patch))).rejects.toThrow();
      const absent = await expand(bad({ resourceVersions: [] }));
      expect(absent).toMatchObject({
        movements: [],
        sources: [],
        expectedLines: [{ recipe: "absent" }],
      });
      const [legacyRevision] = await getDb()
        .insert(recipeRevisions)
        .values({
          businessId: world.businessId,
          productId: f.productId,
          lines: [{ itemId: f.item.id, quantity: "1.000", unit: "g" }],
        })
        .returning();
      const unit = bad({
        measure: UNIT_MEASURE,
        quantity: "2147483647",
        resourceVersions: [
          {
            providerId: "recipes",
            slot: "recipe",
            versionId: legacyRevision.id,
          },
        ],
      });
      expect((await expand(unit)).movements[0].quantity).toBe("2147483647.000");
      await expect(
        expand({
          ...unit,
          lines: [{ ...unit.lines[0], quantity: "2147483648" }],
        }),
      ).rejects.toThrow();
      const [foreignRecipe] = await getDb()
        .select()
        .from(independentRecipeRevisions)
        .where(eq(independentRecipeRevisions.id, f.b.revisionId));
      const [invalidResolution] = await getDb()
        .insert(recipeSaleResolutions)
        .values({
          ...f.resolution,
          id: randomUUID(),
          components: [
            {
              ...f.resolution.components[0],
              recipeRevisionId: foreignRecipe.id,
            },
          ],
        })
        .returning();
      await expect(
        expand(
          bad({
            resourceVersions: [
              {
                providerId: "recipes",
                slot: "composition",
                versionId: invalidResolution.id,
              },
            ],
          }),
        ),
      ).rejects.toThrow("unavailable");
      expect(await readSources(event.payload.sourceOrderId)).toEqual([]);
    }, 60000);
  },
);
