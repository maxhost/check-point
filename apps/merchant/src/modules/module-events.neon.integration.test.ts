import { createPaymentMethod } from "../server/business/payment-methods";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { and, eq } from "drizzle-orm";
import {
  moduleEvents,
  posOrderItems,
  posOrderPayments,
  posOrders,
  paymentMethods,
  recipeConsumptionSources,
  recipeRevisions,
  stockItemLocations,
} from "@mi-pasaporte/db/schema";
import { pgErrorCode } from "@mi-pasaporte/domain/server/counter/core";
import { setModuleEnabled } from "./activation";
import {
  callModuleRoute,
  moduleStaff,
  modulesIntegrationEnabled,
  seedProduct,
} from "./modules-integration-support";
import { createRecipe, updateRecipe } from "./recipes/server/library";
import { saveComposition } from "./recipes/server/compositions";
import { readSaleConsumptionCost } from "./recipes/server/consumption-cost";
import { saveCommission } from "../server/business/commission-config";
import { readSaleCommissions as readCoreSaleCommissions } from "../server/business/commission-read";
const readSaleCommissions = (
  businessId: string,
  id: unknown,
  location: unknown,
) => readCoreSaleCommissions(businessId, id, location, "pos");
import { businessHttp } from "../server/business/http";
import {
  publishSaleClosed,
  setResourceVersion,
  type SaleClosedEvent,
} from "../server/module-events";
import {
  setupModuleEventWorld,
  cleanupModuleEventWorld,
  world,
  other,
  itemId,
  productId,
  cashId,
  foreignCashId,
  state,
  post,
  open,
  eventOf,
  movements,
  drain,
  holdAcceleration,
} from "./module-events-integration-support";
beforeAll(setupModuleEventWorld, 120000);
afterAll(cleanupModuleEventWorld, 120000);
afterEach(() => vi.restoreAllMocks());
async function sqlState(query: Promise<unknown>, code: string) {
  let actual: string | null = null;
  try {
    await query;
  } catch (error) {
    actual = pgErrorCode(error);
  }
  expect(actual).toBe(code);
}
describe.skipIf(!modulesIntegrationEnabled)(
  "P1 actual POS provider, R1 compatibility and schema negatives",
  () => {
    it("real v2 freezes composition/rate in one close while Stock keeps its own application valuation", async () => {
      holdAcceleration();
      const a = await createRecipe(world.businessId, {
          name: "Actual recipe A",
          lines: [{ itemId, quantity: "1.000" }],
        }),
        b = await createRecipe(world.businessId, {
          name: "Actual recipe B",
          lines: [{ itemId, quantity: "2.000" }],
        });
      const composition = await saveComposition(world.businessId, productId, {
        isCombo: true,
        recipes: [
          { recipeId: a.id, quantity: "1.000" },
          { recipeId: b.id, quantity: "0.500" },
        ],
        expectedRevisionId: null,
      });
      const method = await createPaymentMethod(world.businessId, {
        name: "Actual card",
        chargeShape: "percent_and_fixed",
      });
      const configured = await saveCommission(
        world.businessId,
        method.id.toUpperCase(),
        { expectedRevisionId: null, percent: "2.5", fixed: "0.10" },
      );
      const order = await open(productId, 2);
      state.closedId = order.id;
      const response = await post(`orders/${order.id}/close`, {
        version: order.version,
        clientRequestId: randomUUID(),
        payments: [{ methodId: method.id, amount: "18.00" }],
      });
      expect(response.status).toBe(200);
      const event = await eventOf(order.id),
        payload = event.payload as SaleClosedEvent;
      expect(payload.eventVersion).toBe(2);
      if (payload.eventVersion !== 2)
        throw new Error("expected financial event");
      expect(payload.money.collected).toBe("18.00");
      expect(payload.lines[0].resourceVersions).toContainEqual({
        providerId: "recipes",
        slot: "composition",
        versionId: composition.resolutionId,
      });
      expect(payload.payments[0].resourceVersions).toContainEqual({
        providerId: "core",
        slot: "commission",
        versionId: configured.revisionId,
      });
      expect(await movements(order.id)).toEqual([]);
      await updateRecipe(world.businessId, a.id, {
        expectedRevisionId: a.revisionId,
        name: a.name,
        lines: [{ itemId, quantity: "99.000" }],
      });
      await saveCommission(world.businessId, ` ${method.id.toUpperCase()} `, {
        expectedRevisionId: configured.revisionId!.toUpperCase(),
        percent: "50",
        fixed: "1.00",
      });
      expect(
        await readSaleCommissions(
          world.businessId,
          order.id.toUpperCase(),
          world.locationId.toUpperCase(),
        ),
      ).toMatchObject({ state: "completo", total: "0.55" });
      expect(await drain(event.id)).toMatchObject({ applied: 1, failed: 0 });
      expect(await movements(order.id)).toMatchObject([
        { quantity: "-4.000", consumptionUnitCost: "3.000000" },
      ]);
      const sources = await getDb()
        .select()
        .from(recipeConsumptionSources)
        .where(eq(recipeConsumptionSources.sourceOrderId, order.id));
      expect(sources.map((s) => s.allocatedQuantity)).toEqual([
        "2.000",
        "2.000",
      ]);
      expect(
        await readSaleConsumptionCost({
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: order.id,
        }),
      ).toMatchObject({ state: "completo", knownCost: "12.00" });
      expect(
        await readSaleCommissions(
          world.businessId,
          ` ${order.id.toUpperCase()} `,
          ` ${world.locationId.toUpperCase()} `,
        ),
      ).toMatchObject({ state: "completo", total: "0.55" });
      await getDb()
        .update(stockItemLocations)
        .set({ weightedAverageUnitCost: "7.000000" })
        .where(
          and(
            eq(stockItemLocations.businessId, world.businessId),
            eq(stockItemLocations.itemId, itemId),
          ),
        );
      expect(
        await readSaleConsumptionCost({
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId: order.id,
        }),
      ).toMatchObject({ knownCost: "12.00" });
    }, 60000);
    it("legacy v1 still applies its captured recipe and never fabricates commission data", async () => {
      const legacyProduct = await seedProduct(
          world,
          "Legacy event recipe",
          "1.00",
        ),
        sourceOrderId = randomUUID(),
        sourceLineId = randomUUID();
      const event = await withDbTransaction(async (tx) => {
        const [revision] = await tx
          .insert(recipeRevisions)
          .values({
            businessId: world.businessId,
            productId: legacyProduct,
            lines: [{ itemId, unit: "g", quantity: "0.250" }],
          })
          .returning();
        await setResourceVersion(tx, {
          businessId: world.businessId,
          resourceType: "product",
          resourceId: legacyProduct,
          providerId: "recipes",
          slot: "recipe",
          versionId: revision.id,
        });
        return publishSaleClosed(tx, {
          businessId: world.businessId,
          sourceOrderId,
          locationId: world.locationId,
          closedAt: new Date(),
          userId: world.ownerId,
          lines: [{ sourceLineId, productId: legacyProduct, quantity: 2 }],
        });
      });
      expect((await eventOf(sourceOrderId)).eventVersion).toBe(1);
      expect(await drain(event!.eventId)).toMatchObject({
        applied: 2,
        failed: 0,
      });
      expect(await movements(sourceOrderId)).toMatchObject([
        { quantity: "-0.500" },
      ]);
      expect(
        await readSaleConsumptionCost({
          businessId: world.businessId,
          locationId: world.locationId,
          sourceOrderId,
        }),
      ).toMatchObject({ state: "completo", knownCost: "3.50" });
      expect(
        await getDb()
          .select()
          .from(recipeConsumptionSources)
          .where(eq(recipeConsumptionSources.sourceOrderId, sourceOrderId)),
      ).toEqual([]);
      expect(
        await readSaleCommissions(
          world.businessId,
          sourceOrderId,
          world.locationId,
        ),
      ).toMatchObject({
        state: "incompleto",
        total: null,
        reasons: ["commission_legacy_event"],
      });
    }, 30000);
    it("real persisted zero is readable with POS off and without its permission; positive absence stays unknown", async () => {
      const free = await seedProduct(world, "Actual zero sale", "0.00"),
        zero = await open(free),
        positive = await open();
      process.env.MODULE_EVENTS_ENABLED = "false";
      try {
        expect(
          (
            await post(`orders/${zero.id}/close`, {
              version: zero.version,
              clientRequestId: randomUUID(),
              payments: [],
            })
          ).status,
        ).toBe(200);
        expect(
          (
            await post(`orders/${positive.id}/close`, {
              version: positive.version,
              clientRequestId: randomUUID(),
              payments: [{ methodId: cashId, amount: "9.00" }],
            })
          ).status,
        ).toBe(200);
        expect(await eventOf(zero.id)).toBeUndefined();
        expect(await eventOf(positive.id)).toBeUndefined();
        await setModuleEnabled(world.businessId, "pos", { enabled: false });
        const staff = await moduleStaff(world, ["business"]);
        const response = await businessHttp(
          new Request(
            `http://localhost:3001/api/business/sale-commissions/pos/${zero.id.toUpperCase()}?locationId=${world.locationId.toUpperCase()}`,
            { headers: { cookie: staff } },
          ),
          ["sale-commissions", "pos", zero.id.toUpperCase()],
        );
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          state: "completo",
          total: "0.00",
        });
        expect(
          await readSaleCommissions(
            world.businessId,
            positive.id,
            world.locationId,
          ),
        ).toMatchObject({
          state: "completo",
          total: "0.00",
          reasons: [],
        });
        expect(
          (
            await businessHttp(
              new Request(
                "http://localhost:3001/api/business/payment-methods",
                { headers: { cookie: staff } },
              ),
              ["payment-methods"],
            )
          ).status,
        ).toBe(200);
        expect(
          (
            await callModuleRoute(
              "GET",
              "/api/modules/pos/payment-methods",
              staff,
            )
          ).status,
        ).toBe(403);
        await expect(
          readSaleCommissions(world.businessId, zero.id, other.locationId),
        ).rejects.toMatchObject({ status: 404 });
      } finally {
        process.env.MODULE_EVENTS_ENABLED = "true";
        await setModuleEnabled(world.businessId, "pos", { enabled: true });
      }
    }, 40000);
    it("schema rejects cross-business payment/order references, cash archival and mutable financial history", async () => {
      const foreignProduct = await seedProduct(
          other,
          "Foreign schema product",
          "1.00",
        ),
        foreignOrder = await open(foreignProduct, 1, other),
        audit = { numerator: "100", denominator: "1", scale: 2 as const },
        delta = { numerator: "0", denominator: "1", scale: 2 as const };
      const payment = {
        businessId: world.businessId,
        posOrderId: state.closedId,
        methodId: cashId,
        position: 99,
        methodName: "Audit",
        chargeShape: "none",
        amount: "1.00",
        originalAmount: audit,
        normalizationAdjustment: delta,
      };
      await sqlState(
        getDb()
          .insert(posOrderPayments)
          .values({ ...payment, id: randomUUID(), methodId: foreignCashId }),
        "23503",
      );
      await sqlState(
        getDb()
          .insert(posOrderPayments)
          .values({
            ...payment,
            id: randomUUID(),
            posOrderId: foreignOrder.id,
          }),
        "23503",
      );
      await sqlState(
        getDb()
          .update(paymentMethods)
          .set({ status: "archived" })
          .where(eq(paymentMethods.id, cashId)),
        "23514",
      );
      await sqlState(
        getDb()
          .update(posOrders)
          .set({ settlement: null })
          .where(eq(posOrders.id, state.closedId)),
        "23514",
      );
      await sqlState(
        getDb()
          .update(posOrderItems)
          .set({ financialSnapshot: null })
          .where(eq(posOrderItems.posOrderId, state.closedId)),
        "23514",
      );
      await sqlState(
        getDb()
          .delete(posOrderPayments)
          .where(eq(posOrderPayments.posOrderId, state.closedId)),
        "23514",
      );
    }, 30000);
    it("a persisted contradictory zero never becomes known commission zero", async () => {
      const real = await eventOf(state.closedId),
        payload = structuredClone(real.payload) as SaleClosedEvent;
      if (payload.eventVersion !== 2)
        throw new Error("expected financial event");
      const sourceOrderId = randomUUID();
      payload.sourceOrderId = sourceOrderId;
      payload.money.collected = "0.00";
      payload.money.roundingAdjustment = "-18.00";
      payload.money.normalizationAdjustments.net = {
        numerator: "-1800",
        denominator: "1",
        scale: 2,
      };
      payload.lines[0].money.net = "0.00";
      payload.lines[0].money.roundingAdjustment = "-18.00";
      payload.lines[0].money.normalizationAdjustments.net = {
        numerator: "-1800",
        denominator: "1",
        scale: 2,
      };
      payload.payments = [];
      payload.paymentOriginals = [];
      await getDb().insert(moduleEvents).values({
        businessId: world.businessId,
        eventType: "sale.closed",
        eventVersion: 2,
        sourceId: sourceOrderId,
        locationId: world.locationId,
        payload,
      });
      expect(
        await readSaleCommissions(
          world.businessId,
          sourceOrderId,
          world.locationId,
        ),
      ).toMatchObject({
        state: "incompleto",
        total: null,
        reasons: ["commission_invalid_event"],
      });
    }, 15000);
  },
);
