import {
  capturePosScope,
  scopedPos,
} from "./pos/server/pos-integration-support";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  businessModules,
  memberships,
  users,
  sessions,
  moduleEvents,
  moduleEventDeliveries,
  paymentMethods,
  posOrderItems,
  products,
  recipeSaleResolutions,
} from "@mi-pasaporte/db/schema";
import {
  buildFinancialAmountsFromSnapshots,
  buildFinancialSettlementFromSnapshots,
} from "@mi-pasaporte/domain/financial";
import { parseMeasure } from "@mi-pasaporte/domain/measures";
import {
  seedModuleWorld,
  dropModuleWorld,
  modulesIntegrationEnabled,
  enableModules,
  seedProduct,
  newItem,
  type ModuleWorld,
} from "./modules-integration-support";
import { createRecipe } from "./recipes/server/library";
import { saveComposition } from "./recipes/server/compositions";
import { initializePaymentMethods } from "../server/business/payment-catalog";
import {
  captureSaleResources,
  publishSaleClosed,
  setResourceVersion,
} from "../server/module-events/publish";
import {
  publishMeasuredSaleClosed,
  type MeasuredSaleClosedInput,
} from "../server/module-events/publish-measured";
import { decodeMeasuredSaleClosedEvent } from "../server/module-events/decode";

let world: ModuleWorld;
let productId: string;
let posScope: string;
let method: typeof paymentMethods.$inferSelect;
let resolutionId: string;
let revisionId: string;
const eventIds: string[] = [];

beforeAll(async () => {
  if (!modulesIntegrationEnabled) return;
  world = await seedModuleWorld("0242 sale publisher V4");
  await enableModules(world, ["pos", "stock", "recipes"]);
  posScope = await capturePosScope(world.cookie, world.businessId);
  await withDbTransaction((tx) =>
    initializePaymentMethods(tx, { businessId: world.businessId }),
  );
  [method] = await getDb()
    .select()
    .from(paymentMethods)
    .where(
      and(
        eq(paymentMethods.businessId, world.businessId),
        eq(paymentMethods.isCash, true),
      ),
    );
  productId = await seedProduct(world, "Producto unit canónico", "1.00");
  const item = await newItem(world, "Ingrediente V4");
  const recipe = await createRecipe(world.businessId, {
    name: "Receta V4",
    lines: [{ itemId: item.id, quantity: "1.000" }],
  });
  const composition = await saveComposition(world.businessId, productId, {
    isCombo: false,
    recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
    expectedRevisionId: null,
  });
  resolutionId = composition.resolutionId!;
  revisionId = composition.revisionId!;
}, 120000);

afterAll(async () => {
  if (!world) return;
  await dropModuleWorld(world);
  expect(
    await getDb()
      .select()
      .from(businesses)
      .where(eq(businesses.id, world.businessId)),
  ).toEqual([]);
  expect(
    await getDb()
      .select()
      .from(memberships)
      .where(eq(memberships.businessId, world.businessId)),
  ).toEqual([]);
  expect(
    await getDb().select().from(users).where(inArray(users.id, world.users)),
  ).toEqual([]);
  expect(
    await getDb()
      .select()
      .from(sessions)
      .where(inArray(sessions.userId, world.users)),
  ).toEqual([]);
  expect(
    await getDb()
      .select()
      .from(moduleEvents)
      .where(eq(moduleEvents.businessId, world.businessId)),
  ).toEqual([]);
  if (eventIds.length)
    expect(
      await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(inArray(moduleEventDeliveries.eventId, eventIds)),
    ).toEqual([]);
  console.log(
    "0242 publisher teardown: business/memberships/owners+staff/sessions/events/deliveries = 0",
  );
}, 120000);

/** Unit uses a real open POS order. Mass is payload-only: no mass POS/core row is fabricated. */
async function fixture(
  massPayloadOnly = false,
): Promise<Omit<MeasuredSaleClosedInput, "capture">> {
  let sourceOrderId = randomUUID();
  let lines: MeasuredSaleClosedInput["lines"];
  if (massPayloadOnly) {
    lines = [
      {
        sourceLineId: randomUUID(),
        position: 0,
        productId,
        productLabel: "Payload de masa, sin fila POS/core",
        quantity: "250.000000001",
        unitPrice: "4.000000001",
        measure: {
          kind: "mass",
          quantityUnit: "g",
          priceUnit: "lb",
          conversionVersion: "mass-si-1",
        },
      },
    ];
  } else {
    const [product] = await getDb()
      .select({ revision: products.salesRevision })
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.businessId, world.businessId),
        ),
      );
    if (!product) throw new Error("Publisher fixture requires its own product");
    const response = await scopedPos(world.cookie, posScope).create({
      locationId: world.locationId,
      createRequestId: randomUUID(),
      saleType: "pickup",
      orderLabel: "Publisher interno",
      tableId: null,
      note: null,
      items: [
        {
          productId,
          quantity: "1",
          quantityUnit: "unit",
          catalogRevision: String(product.revision),
        },
      ],
    });
    expect(response.status).toBe(201);
    sourceOrderId = (await response.json()).id;
    const rows = await getDb()
      .select()
      .from(posOrderItems)
      .where(eq(posOrderItems.posOrderId, sourceOrderId));
    lines = rows.map((row) => ({
      sourceLineId: row.id,
      position: row.position,
      productId: row.productId,
      productLabel: row.nameSnapshot,
      quantity: row.quantity,
      unitPrice: row.unitPriceSnapshot,
      measure: parseMeasure({
        kind: row.measureKind,
        quantityUnit: row.quantityUnit,
        priceUnit: row.priceUnit,
        conversionVersion: row.conversionVersion,
      }),
    }));
  }
  const financial = { currencyCode: "USD", lines, discount: null };
  const amounts = buildFinancialAmountsFromSnapshots(financial);
  const settlement = buildFinancialSettlementFromSnapshots({
    ...financial,
    payments: [
      {
        paymentId: randomUUID(),
        methodId: method.id,
        amount: amounts.collected,
      },
    ],
  });
  return {
    businessId: world.businessId,
    sourceOrderId,
    locationId: world.locationId,
    userId: world.ownerId,
    lines,
    settlement,
    commissionByLine: Object.fromEntries(
      lines.map((line) => [line.sourceLineId, "12"]),
    ),
    paymentsMetadata: settlement.payments.map((p) => ({
      paymentId: p.paymentId,
      methodId: method.id,
      methodProviderId: "payments",
      methodName: method.name,
      chargeShape: method.chargeShape as "none",
    })),
  };
}
async function stored(sourceId: string) {
  const events = await getDb()
    .select()
    .from(moduleEvents)
    .where(
      and(
        eq(moduleEvents.businessId, world.businessId),
        eq(moduleEvents.sourceId, sourceId),
      ),
    );
  const deliveries = events.length
    ? await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(eq(moduleEventDeliveries.eventId, events[0].id))
        .orderBy(moduleEventDeliveries.subscriberId)
    : [];
  return { events, deliveries };
}
async function publish(input: Omit<MeasuredSaleClosedInput, "capture">) {
  return withDbTransaction(async (tx) =>
    publishMeasuredSaleClosed(tx, {
      ...input,
      capture: await captureSaleResources(tx, input),
    }),
  );
}

describe.skipIf(!modulesIntegrationEnabled)(
  "0242 internal sale.closed V4 publisher (no close E2E)",
  () => {
    it("persists complete V4 from canonical unit snapshots and real capture; replay preserves every durable field after pointer/activation change", async () => {
      const input = await fixture();
      const result = await publish(input);
      eventIds.push(result.eventId);
      if (result.payload.eventVersion !== 4) throw new Error("Expected new V4");
      const before = await stored(input.sourceOrderId);
      expect(before.events).toHaveLength(1);
      expect(before.events[0]).toMatchObject({
        eventVersion: 4,
        payload: result.payload,
      });
      expect(decodeMeasuredSaleClosedEvent(result.payload, 4)).toEqual(
        result.payload,
      );
      const [resolution] = await getDb()
        .select()
        .from(recipeSaleResolutions)
        .where(eq(recipeSaleResolutions.id, resolutionId));
      expect(resolution).toMatchObject({
        businessId: world.businessId,
        productId,
        compositionRevisionId: revisionId,
      });
      expect(result.payload.lines[0].resourceVersions).toContainEqual({
        providerId: "recipes",
        slot: "composition",
        versionId: resolutionId,
      });
      expect(result.payload.lines[0]).not.toHaveProperty("unitPrice");
      expect(result.payload.lines[0].money).toEqual(
        input.settlement.lines[0].money,
      );
      expect(result.payload.payments[0]).toMatchObject({
        methodId: method.id,
        methodName: method.name,
        methodProviderId: "payments",
      });
      expect(before.deliveries.length).toBeGreaterThan(0);
      expect(before.deliveries).toContainEqual(
        expect.objectContaining({ subscriberId: "recipes", state: "pending" }),
      );
      try {
        await withDbTransaction((tx) =>
          setResourceVersion(tx, {
            businessId: world.businessId,
            resourceType: "product",
            resourceId: productId,
            providerId: "recipes",
            slot: "composition",
            versionId: randomUUID(),
          }),
        );
        await getDb()
          .update(businessModules)
          .set({ enabled: false })
          .where(eq(businessModules.businessId, world.businessId));
        // Poisoned capture proves replay never observes new inputs or calls capture again.
        const replay = await withDbTransaction((tx) =>
          publishMeasuredSaleClosed(tx, {
            ...input,
            lines: [],
            capture: undefined as never,
          }),
        );
        expect(replay).toEqual(result);
        expect(await stored(input.sourceOrderId)).toEqual(before);
      } finally {
        await enableModules(world, ["pos", "stock", "recipes"]);
        posScope = await capturePosScope(world.cookie, world.businessId);
        await withDbTransaction((tx) =>
          setResourceVersion(tx, {
            businessId: world.businessId,
            resourceType: "product",
            resourceId: productId,
            providerId: "recipes",
            slot: "composition",
            versionId: resolutionId,
          }),
        );
      }
    }, 120000);
    it("serializes cooperative READ COMMITTED V4 writers and returns one frozen event/delivery set", async () => {
      const input = await fixture();
      const [first, second] = await Promise.all([
        publish(input),
        publish(input),
      ]);
      expect(first).toEqual(second);
      eventIds.push(first.eventId);
      const rows = await stored(input.sourceOrderId);
      expect(rows.events).toHaveLength(1);
      expect(new Set(rows.deliveries.map((d) => d.subscriberId)).size).toBe(
        rows.deliveries.length,
      );
      expect(rows.deliveries.length).toBeGreaterThan(0);
    }, 120000);
    it("rolls back append plus deliveries on a later caller failure", async () => {
      const input = await fixture();
      await expect(
        withDbTransaction(async (tx) => {
          const result = await publishMeasuredSaleClosed(tx, {
            ...input,
            capture: await captureSaleResources(tx, input),
          });
          eventIds.push(result.eventId);
          if (result.payload.eventVersion !== 4)
            throw new Error("Expected new V4");
          const rows = await tx
            .select()
            .from(moduleEventDeliveries)
            .where(eq(moduleEventDeliveries.eventId, result.eventId));
          expect(rows.length).toBeGreaterThan(0);
          throw new Error("later caller failure");
        }),
      ).rejects.toThrow("later caller failure");
      expect(await stored(input.sourceOrderId)).toEqual({
        events: [],
        deliveries: [],
      });
    }, 120000);
    it("rejects same-normalized-money original mismatch and incomplete metadata without partial append", async () => {
      const input = await fixture();
      input.lines[0].unitPrice = "1.000000001";
      await expect(publish(input)).rejects.toThrow("original mismatch");
      expect(await stored(input.sourceOrderId)).toEqual({
        events: [],
        deliveries: [],
      });
      input.lines[0].unitPrice = "1";
      input.paymentsMetadata = [];
      await expect(publish(input)).rejects.toThrow();
      expect(await stored(input.sourceOrderId)).toEqual({
        events: [],
        deliveries: [],
      });
    }, 120000);
    it("publishes exact mass payload internally without inventing mass POS/core rows", async () => {
      const input = await fixture(true);
      const result = await publish(input);
      eventIds.push(result.eventId);
      if (result.payload.eventVersion !== 4) throw new Error("Expected new V4");
      expect(result.payload.lines[0]).toMatchObject({
        quantity: "250.000000001",
        measure: { kind: "mass", quantityUnit: "g", priceUnit: "lb" },
      });
      expect(result.payload.lines[0].money).toEqual(
        input.settlement.lines[0].money,
      );
      expect((await stored(input.sourceOrderId)).events[0].payload).toEqual(
        result.payload,
      );
      expect(
        await getDb()
          .select()
          .from(posOrderItems)
          .where(eq(posOrderItems.posOrderId, input.sourceOrderId)),
      ).toEqual([]);
    }, 120000);
    it("returns an existing legacy event without promotion or adding deliveries", async () => {
      const input = await fixture();
      const legacy = await withDbTransaction((tx) =>
        publishSaleClosed(tx, {
          businessId: input.businessId,
          sourceOrderId: input.sourceOrderId,
          locationId: input.locationId,
          userId: input.userId,
          closedAt: new Date(),
          lines: input.lines.map((line) => ({
            sourceLineId: line.sourceLineId,
            productId: line.productId,
            quantity: 1,
          })),
        }),
      );
      eventIds.push(legacy.eventId);
      const before = await stored(input.sourceOrderId);
      const replay = await withDbTransaction((tx) =>
        publishMeasuredSaleClosed(tx, {
          ...input,
          capture: undefined as never,
        }),
      );
      expect(replay.eventId).toBe(legacy.eventId);
      expect(replay.payload.eventVersion).toBe(1);
      expect(await stored(input.sourceOrderId)).toEqual(before);
    }, 120000);
  },
);
