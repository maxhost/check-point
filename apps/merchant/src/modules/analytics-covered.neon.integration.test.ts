import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { and, eq } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  products,
  stockItemLocations,
  moduleEvents,
  paymentCommissions,
  saleCommissions,
  analyticsDailyMetrics,
  moduleEventDeliveries,
} from "@mi-pasaporte/db/schema";
import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import {
  prepareSaleCommission,
  freezeSaleCommission,
} from "../server/business/commission-close";
import { createPaymentMethod } from "../server/business/payment-methods";
import { saveCommission } from "../server/business/commission-config";
import { retryModuleEvents } from "../server/module-events";
import { setModuleEnabled } from "./activation";
import { createRecipe } from "./recipes/server/library";
import { saveComposition } from "./recipes/server/compositions";
import { modulesIntegrationEnabled } from "./modules-integration-support";
import {
  setupModuleEventWorld,
  moduleEventPos,
  cleanupModuleEventWorld,
  world,
  itemId,
  productId,
  open,
  holdAcceleration,
} from "./module-events-integration-support";
beforeAll(() => setupModuleEventWorld({ posContract: 2 }), 120000);
afterAll(cleanupModuleEventWorld, 120000);
afterEach(() => vi.restoreAllMocks());
describe.skipIf(!modulesIntegrationEnabled)("AN1 exact event snapshots", () => {
  it("preparation performs no persistence and cannot be reused with another origin or settlement", async () => {
    const methodId = randomUUID(),
      paymentId = randomUUID(),
      sourceLineId = randomUUID(),
      sourceOrderId = randomUUID();
    const args = {
      businessId: world.businessId,
      sourceProviderId: "pos",
      sourceOrderId,
      locationId: world.locationId,
      settlement: buildFinancialSettlement({
        currencyCode: "USD",
        discount: null,
        lines: [{ sourceLineId, position: 0, unitPrice: "1.00", quantity: 1 }],
        payments: [{ methodId, paymentId, amount: "1.00" }],
      }),
      paymentsMetadata: [
        {
          paymentId,
          methodId,
          methodProviderId: "core",
          methodName: "Efectivo",
          chargeShape: "none" as const,
        },
      ],
      capture: {
        captured_at: "2026-10-17T15:00:00Z",
        versions: [],
        enabled: [],
      },
    };
    const prepared = await withDbTransaction((tx) =>
      prepareSaleCommission(tx, args),
    );
    expect(prepared.lineCommissions).toEqual({ [sourceLineId]: "0" });
    expect(
      await getDb()
        .select()
        .from(saleCommissions)
        .where(eq(saleCommissions.sourceOrderId, sourceOrderId)),
    ).toEqual([]);
    await expect(
      withDbTransaction((tx) =>
        freezeSaleCommission(
          tx,
          { ...args, sourceOrderId: randomUUID(), eventId: null },
          prepared,
        ),
      ),
    ).rejects.toThrow("Prepared commission does not match origin");
    await expect(
      withDbTransaction((tx) =>
        freezeSaleCommission(
          tx,
          {
            ...args,
            settlement: { ...args.settlement, collected: "2.00" },
            eventId: null,
          },
          prepared,
        ),
      ),
    ).rejects.toThrow("Prepared commission does not match origin");
    await expect(
      withDbTransaction((tx) =>
        freezeSaleCommission(
          tx,
          { ...args, eventId: null },
          { lineCommissions: prepared.lineCommissions },
        ),
      ),
    ).rejects.toThrow("Prepared commission does not match origin");
  }, 30000);
  it("real POS price changes retain exact covered net and fee instead of a daily average", async () => {
    holdAcceleration();
    await getDb()
      .update(stockItemLocations)
      .set({ weightedAverageUnitCost: "0.400000" })
      .where(
        and(
          eq(stockItemLocations.businessId, world.businessId),
          eq(stockItemLocations.itemId, itemId),
          eq(stockItemLocations.locationId, world.locationId),
        ),
      );
    const recipe = await createRecipe(world.businessId, {
      name: "Receta exacta",
      lines: [{ itemId, quantity: "1.000" }],
    });
    await saveComposition(world.businessId, productId, {
      isCombo: false,
      recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
      expectedRevisionId: null,
    });
    const method = await createPaymentMethod(world.businessId, {
      name: "Tarjeta exacta",
      chargeShape: "percent",
    });
    await saveCommission(world.businessId, method.id, {
      expectedRevisionId: null,
      percent: "2",
    });
    const sell = async (price: string) => {
      await getDb()
        .update(products)
        .set({ unitPrice: price })
        .where(eq(products.id, productId));
      const order = await open(productId, 1);
      const response = await moduleEventPos().close(order.id, {
        version: order.version,
        clientRequestId: randomUUID(),
        payments: [{ methodId: method.id, amount: price }],
      });
      expect(response.status).toBe(200);
      const [event] = await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, order.id),
            eq(moduleEvents.eventType, "sale.closed"),
          ),
        );
      return { order, event };
    };
    const first = await sell("1.00");
    await setModuleEnabled(world.businessId, "recipes", { enabled: false });
    const second = await sell("9.00");
    expect(first.event.payload).toMatchObject({
      eventVersion: 4,
      lines: [{ commissionMinor: "2" }],
    });
    expect(second.event.payload).toMatchObject({
      eventVersion: 4,
      lines: [{ commissionMinor: "18" }],
    });
    const result = await retryModuleEvents({
      businessId: world.businessId,
      force: true,
      budgetMs: 20000,
    });
    expect(result.failed).toBe(0);
    expect(
      await getDb()
        .select()
        .from(moduleEventDeliveries)
        .where(
          and(
            eq(moduleEventDeliveries.eventId, second.event.id),
            eq(moduleEventDeliveries.subscriberId, "recipes"),
          ),
        ),
    ).toMatchObject([{ state: "skipped", terminalReason: "modules_disabled" }]);
    const metrics = await getDb()
      .select()
      .from(analyticsDailyMetrics)
      .where(eq(analyticsDailyMetrics.businessId, world.businessId));
    const amount = (metric: string) =>
      metrics
        .filter((r) => r.metric === metric)
        .reduce((sum, r) => sum + r.amountMinor, 0n);
    expect(amount("revenue")).toBe(1000n);
    expect(amount("payment_commission")).toBe(20n);
    expect(amount("product_revenue")).toBe(1000n);
    expect(amount("revenue_with_cost")).toBe(100n);
    expect(amount("cost_of_goods")).toBe(40n);
    expect(amount("payment_commission_with_cost")).toBe(2n);
    for (const metric of [
      "cost_of_goods",
      "revenue_with_cost",
      "payment_commission_with_cost",
    ])
      expect(
        metrics
          .filter((r) => r.metric === metric)
          .reduce((sum, r) => sum + r.count, 0),
      ).toBe(1);
    expect((100 - 40 - 2) / 100).toBe(0.58);
    expect(
      (
        await getDb()
          .select()
          .from(paymentCommissions)
          .where(eq(paymentCommissions.sourceOrderId, first.order.id))
      )[0].eventId,
    ).toBe(first.event.id);
  }, 60000);
});
