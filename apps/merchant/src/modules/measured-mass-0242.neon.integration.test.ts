import { randomUUID, createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  products,
  posOrderItems,
  moduleEvents,
  moduleEventDeliveries,
  paymentMethods,
  stockMovements,
  recipeConsumptionSources,
  orderItems,
  posOrders,
  campaignCoupons,
  consumerAccounts,
  users,
} from "@mi-pasaporte/db/schema";
import {
  neonEndpointId,
  PROD_DB_ENDPOINT_SHA12,
} from "../../../../packages/db/src/local";
import {
  createProduct,
  updateProduct,
} from "@mi-pasaporte/domain/server/catalog";
import { saveSalesUnits } from "../server/business/configuration";
import { saveCommission } from "../server/business/commission-config";
import { retryModuleEvents } from "../server/module-events/retry";
import type { SaleClosedEventV4 } from "../server/module-events/types";
import { createPosOrderV2 } from "./pos/server/measured-create";
import { updatePosOrderV2 } from "./pos/server/measured-update";
import { closeMeasuredPosOrder } from "./pos/server/measured-close";
import { createRecipe } from "./recipes/server/library";
import { saveComposition } from "./recipes/server/compositions";
import { recordPurchase } from "./stock/movements";
import {
  enableModules,
  newItem,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "./modules-integration-support";
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));
import {
  seedCouponWorld,
  dropCouponWorld,
  newCouponCard,
  chooseCoupon,
  type CouponWorld,
  type CouponCard,
} from "../server/counter-coupon-support";
import { cookieDe } from "../server/permissions-integration-support";
let world: ModuleWorld, couponWorld: CouponWorld;
const cards: CouponCard[] = [];
const business = () => ({
  id: world.businessId,
  currencyCode: "USD",
  status: "active" as const,
});
const catalog = () => ({ id: world.businessId, currencyCode: "USD" });
const input = (
  name: string,
  unitPrice: string,
  soldByWeight = true,
  pricingUnit = "lb",
) => ({
  name,
  unitPrice,
  unitCost: null,
  soldByWeight,
  pricingUnit,
  availableAllLocations: true,
  locationIds: [],
  categoryId: null,
});
const open = (items: unknown[]) =>
  createPosOrderV2(business(), world.ownerId, {
    createRequestId: randomUUID(),
    saleType: "counter",
    orderLabel: "",
    locationId: world.locationId,
    tableId: null,
    note: null,
    items,
  });
describe.skipIf(!modulesIntegrationEnabled)(
  "0242 activated mass canonical chain",
  () => {
    beforeAll(async () => {
      expect(process.env.NEON_INTEGRATION_ISOLATED).toBe("true");
      const endpoint = neonEndpointId(
        process.env.NEON_INTEGRATION_DATABASE_URL!,
      );
      expect(endpoint).toMatch(/^ep-[a-z0-9-]+$/);
      expect(
        createHash("sha256").update(endpoint).digest("hex").slice(0, 12),
      ).not.toBe(PROD_DB_ENDPOINT_SHA12);
      couponWorld = await seedCouponWorld("0242 mass canonical");
      world = {
        businessId: couponWorld.seed.business.id,
        locationId: couponWorld.seed.locationId,
        ownerId: couponWorld.seed.userId,
        cookie: await cookieDe(couponWorld.seed.userId),
        users: [couponWorld.seed.userId],
      };
      await enableModules(world, ["pos", "stock", "recipes"]);
      await saveSalesUnits(world.businessId, {
        revision: 1,
        salesMassUnits: ["kg", "lb", "g"],
      });
    }, 180000);
    afterAll(async () => {
      if (!world) return;
      await getDb()
        .update(posOrders)
        .set({ orderId: null })
        .where(eq(posOrders.businessId, world.businessId));
      await dropCouponWorld(couponWorld);
      for (const card of cards)
        await getDb()
          .delete(consumerAccounts)
          .where(eq(consumerAccounts.id, card.consumerId));
      await getDb().delete(users).where(eq(users.id, world.ownerId));
    }, 180000);
    it("creates and edits mixed equivalent kg/g/lb captures, closes real settlement and consumes frozen Recipes/Stock/cost/analytics once", async () => {
      const ingredient = await newItem(world, "Mass canonical ingredient");
      await recordPurchase(world.businessId, world.ownerId, ingredient.id, {
        locationId: world.locationId,
        quantity: "1000",
        totalCost: "20.00",
      });
      const recipe = await createRecipe(world.businessId, {
        name: "Mass canonical recipe",
        lines: [{ itemId: ingredient.id, quantity: "100.000" }],
      });
      const mass = await createProduct(
        catalog(),
        input("Mass canonical lb", "4.000000001"),
        { contract: 2 },
      );
      const unit = await createProduct(
        catalog(),
        input("Mass canonical unit", "1", false, "unit"),
        { contract: 2 },
      );
      const composition = await saveComposition(world.businessId, mass.id, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
        basisQuantity: "1",
        basisUnit: "kg",
      });
      await saveComposition(world.businessId, unit.id, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
        expectedRevisionId: null,
      });
      const [method] = await getDb()
        .insert(paymentMethods)
        .values({
          businessId: world.businessId,
          name: "Mass percent",
          chargeShape: "percent",
          isCash: false,
        })
        .returning();
      const commission = await saveCommission(world.businessId, method.id, {
        expectedRevisionId: null,
        percent: "2.50",
      });
      const order = await open([
        {
          productId: mass.id,
          quantity: "0.226796185",
          quantityUnit: "kg",
          catalogRevision: "1",
        },
        {
          productId: mass.id,
          quantity: "453.59237",
          quantityUnit: "g",
          catalogRevision: "1",
        },
        {
          productId: mass.id,
          quantity: "1",
          quantityUnit: "lb",
          catalogRevision: "1",
        },
        {
          productId: unit.id,
          quantity: "2",
          quantityUnit: "unit",
          catalogRevision: "1",
        },
      ]);
      await updateProduct(
        catalog(),
        mass.id,
        { ...input("Changed catalog", "99"), expectedSalesRevision: "1" },
        { contract: 2 },
      );
      const edited = await updatePosOrderV2(business(), order.id, {
        version: order.version,
        saleType: "counter",
        orderLabel: order.orderLabel,
        locationId: world.locationId,
        tableId: null,
        note: "edited measured capture",
        items: order.items.map((line, index) => ({
          lineId: line.lineId,
          productId: line.productId,
          quantity: index === 0 ? "0.45359237" : line.quantity,
          quantityUnit: line.measure.quantityUnit,
        })),
      });
      expect(
        edited.items
          .slice(0, 3)
          .map((line) => [line.unitPrice, line.lineTotal]),
      ).toEqual(Array.from({ length: 3 }, () => ["4.000000001", "4.00"]));
      expect(edited.total).toBe("14.00");
      const member = await newCouponCard(couponWorld);
      cards.push(member);
      const raw = {
        membershipId: member.membershipId,
        clientRequestId: randomUUID(),
        version: edited.version,
        payments: [{ methodId: method.id, amount: "14.00" }],
      };
      const closed = await closeMeasuredPosOrder(
        business(),
        world.ownerId,
        order.id,
        raw,
      );
      expect(closed).toMatchObject({ status: "closed", total: "14.00" });
      const [sale] = await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, order.id),
            eq(moduleEvents.eventType, "sale.closed"),
          ),
        );
      expect(sale.eventVersion).toBe(4);
      const payload = sale.payload as SaleClosedEventV4;
      expect(
        payload.lines.slice(0, 3).map((line) => line.measure.kind),
      ).toEqual(["mass", "mass", "mass"]);
      expect(payload.lines[0].resourceVersions).toContainEqual({
        providerId: "recipes",
        slot: "composition",
        versionId: composition.resolutionId,
      });
      expect(
        (
          await getDb().execute(
            sql`select total, collected_total from core.sale_commission where source_order_id=${order.id}::uuid`,
          )
        ).rows,
      ).toEqual([{ total: "0.35", collected_total: "14.00" }]);
      expect(
        (
          await getDb()
            .select()
            .from(moduleEventDeliveries)
            .where(eq(moduleEventDeliveries.eventId, sale.id))
        ).map((d) => [d.subscriberId, d.state]),
      ).toEqual(
        expect.arrayContaining([
          ["recipes", "pending"],
          ["core.analytics", "pending"],
        ]),
      );
      // Consumers must use the captured composition even when current base and tariffs change.
      await saveComposition(world.businessId, mass.id, {
        isCombo: false,
        recipes: [{ recipeId: recipe.id, quantity: "9.000" }],
        expectedRevisionId: composition.revisionId,
        basisQuantity: "1",
        basisUnit: "lb",
      });
      await saveCommission(world.businessId, method.id, {
        expectedRevisionId: commission.revisionId,
        percent: "9.00",
      });
      expect(
        await retryModuleEvents({
          businessId: world.businessId,
          eventIds: [sale.id],
          force: true,
        }),
      ).toMatchObject({ applied: 2, failed: 0, pending: 0 });
      const movements = () =>
        getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.sourceOrderId, order.id));
      const sources = () =>
        getDb()
          .select()
          .from(recipeConsumptionSources)
          .where(eq(recipeConsumptionSources.sourceOrderId, order.id));
      expect((await movements()).map((m) => m.quantity).sort()).toEqual([
        "-200.000",
        "-45.359",
        "-45.359",
        "-45.359",
      ]);
      expect(await sources()).toHaveLength(4);
      const [consumed] = await getDb()
        .select()
        .from(moduleEvents)
        .where(
          and(
            eq(moduleEvents.sourceId, order.id),
            eq(moduleEvents.eventType, "recipes.consumption.applied"),
          ),
        );
      expect(consumed).toMatchObject({ eventVersion: 2 });
      expect(
        (consumed.payload as { lines: { cost: unknown }[] }).lines.every(
          (l) => l.cost !== null,
        ),
      ).toBe(true);
      await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [consumed.id],
        force: true,
      });
      const metrics = () =>
        getDb().execute(
          sql`select metric,sum(quantity)::text as quantity,sum(amount_minor)::text as amount from analytics.metric_contribution where business_id=${world.businessId}::uuid and dimension_kind='product' group by metric order by metric`,
        );
      const rows = (await metrics()).rows;
      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            metric: "mass_sold_g",
            quantity: "1360.77711",
          }),
          expect.objectContaining({ metric: "units_sold", quantity: "2" }),
          expect.objectContaining({ metric: "cost_of_goods" }),
        ]),
      );
      const before = {
        movements: await movements(),
        sources: await sources(),
        metrics: rows,
      };
      expect(
        await closeMeasuredPosOrder(business(), world.ownerId, order.id, raw),
      ).toEqual(closed);
      await retryModuleEvents({
        businessId: world.businessId,
        eventIds: [sale.id, consumed.id],
        force: true,
      });
      expect({
        movements: await movements(),
        sources: await sources(),
        metrics: (await metrics()).rows,
      }).toEqual(before);
    }, 180000);
    it("uses real coupons for mass percentage/amount/zero and mixed free/2x1 eligibility", async () => {
      const [cash] = await getDb()
        .insert(paymentMethods)
        .values({
          businessId: world.businessId,
          name: "Mass loyalty cash",
          isCash: true,
          chargeShape: "none",
        })
        .returning();
      for (const [discountUnitSnapshot, discountValueSnapshot, net] of [
        ["percent", "10", "1.80"],
        ["amount", "0.50", "1.50"],
        ["percent", "100", "0.00"],
      ]) {
        const p = await createProduct(
          catalog(),
          input("Mass loyalty discount", "4", true, "kg"),
          { contract: 2 },
        );
        const c = await newCouponCard(couponWorld);
        cards.push(c);
        await getDb()
          .update(campaignCoupons)
          .set({
            kindSnapshot: "discount",
            productId: null,
            discountUnitSnapshot,
            discountValueSnapshot,
            currencyCodeSnapshot:
              discountUnitSnapshot === "amount" ? "USD" : null,
          })
          .where(eq(campaignCoupons.id, c.couponId));
        await chooseCoupon(c);
        const order = await open([
          {
            productId: p.id,
            quantity: "0.5",
            quantityUnit: "kg",
            catalogRevision: "1",
          },
        ]);
        const raw = {
          clientRequestId: randomUUID(),
          version: 1,
          membershipId: c.membershipId,
          coupon: { couponId: c.couponId },
          payments: net === "0.00" ? [] : [{ methodId: cash.id, amount: net }],
        };
        const closed = await closeMeasuredPosOrder(
          business(),
          world.ownerId,
          order.id,
          raw,
        );
        expect(closed.sale?.total).toBe(net);
        expect(
          (
            await getDb().execute(
              sql`select o.total::text,o.units_granted,(select count(*)::int from core.coupon_redemption where order_id=o.id) as redemptions,(select count(*)::int from pos.order_payment where pos_order_id=${order.id}::uuid) as payments from core."order" o join pos.pos_order p on p.order_id=o.id where p.id=${order.id}::uuid`,
            )
          ).rows,
        ).toEqual([
          {
            total: net,
            units_granted: net === "0.00" ? 0 : 10,
            redemptions: 1,
            payments: net === "0.00" ? 0 : 1,
          },
        ]);
        expect(
          await closeMeasuredPosOrder(business(), world.ownerId, order.id, raw),
        ).toEqual(closed);
      }
      for (const kindSnapshot of ["free_product", "two_for_one"] as const) {
        const p = await createProduct(
          catalog(),
          input("Mixed historical unit and mass", "1", false, "unit"),
          { contract: 2 },
        );
        const order = await open([
          {
            productId: p.id,
            quantity: "2",
            quantityUnit: "unit",
            catalogRevision: "1",
          },
        ]);
        await updateProduct(
          catalog(),
          p.id,
          {
            ...input("Now sold by mass", "4", true, "kg"),
            expectedSalesRevision: "1",
          },
          { contract: 2 },
        );
        const mixed = await updatePosOrderV2(business(), order.id, {
          version: 1,
          saleType: "counter",
          orderLabel: order.orderLabel,
          locationId: world.locationId,
          tableId: null,
          note: null,
          items: [
            {
              lineId: order.items[0].lineId,
              productId: p.id,
              quantity: "2",
              quantityUnit: "unit",
            },
            {
              productId: p.id,
              quantity: "0.5",
              quantityUnit: "kg",
              catalogRevision: "2",
            },
          ],
        });
        const c = await newCouponCard(couponWorld);
        cards.push(c);
        await getDb()
          .update(campaignCoupons)
          .set({
            kindSnapshot,
            productId: p.id,
            discountUnitSnapshot: null,
            discountValueSnapshot: null,
          })
          .where(eq(campaignCoupons.id, c.couponId));
        await chooseCoupon(c);
        const state = async () =>
          (
            await getDb().execute(
              sql`select (select to_jsonb(c) from core.campaign_coupon c where id=${c.couponId}::uuid) as coupon,(select to_jsonb(m) from consumer.program_membership m where id=${c.membershipId}::uuid) as member,(select count(*)::int from core.coupon_redemption where coupon_id=${c.couponId}::uuid) as redemptions,(select to_jsonb(p) from pos.pos_order p where id=${order.id}::uuid) as pos`,
            )
          ).rows;
        const before = await state();
        const raw = {
          clientRequestId: randomUUID(),
          version: mixed.version,
          membershipId: c.membershipId,
          coupon: {
            couponId: c.couponId,
            targetSourceLineId: mixed.items[1].lineId,
          },
          payments: [{ methodId: cash.id, amount: "3.00" }],
        };
        await expect(
          closeMeasuredPosOrder(business(), world.ownerId, order.id, raw),
        ).rejects.toMatchObject({
          code: "coupon_measure_not_supported",
          status: 409,
        });
        expect(await state()).toEqual(before);
        const closed = await closeMeasuredPosOrder(
          business(),
          world.ownerId,
          order.id,
          { ...raw, coupon: { couponId: c.couponId } },
        );
        expect(closed.sale?.total).toBe("3.00");
        expect((await state())[0].redemptions).toBe(1);
      }
    }, 180000);
    it("retains historical unit extremes and signed core snapshots; rejects malformed, nonfinite and incompatible canonical rows", async () => {
      const historical = await getDb()
        .insert(products)
        .values({
          businessId: world.businessId,
          name: "Historical numeric12",
          unitPrice: "9999999999.99",
          unitCost: "9999999999.99",
        })
        .returning();
      expect(historical[0].unitPrice).toBe("9999999999.990000000");
      const order = await open([]);
      const good = {
        posOrderId: order.id,
        productId: historical[0].id,
        nameSnapshot: "Historical",
        quantity: "2147483647",
        unitPriceSnapshot: "9999999999.99",
        position: 0,
      };
      await getDb().insert(posOrderItems).values(good);
      const rejects = [
        { quantity: "1.1" },
        {
          measureKind: "mass",
          quantityUnit: "kg",
          priceUnit: "kg",
          quantity: "1",
          unitPriceSnapshot: "-1",
        },
        { quantity: "NaN" },
        { quantity: "Infinity" },
        { quantity: "0" },
        { measureKind: "mass", quantityUnit: "kg", priceUnit: "unit" },
        {
          measureKind: "mass",
          quantityUnit: "kg",
          priceUnit: "kg",
          quantity: "1000000000",
        },
        { conversionVersion: "other" },
        { unitPriceSnapshot: "NaN" },
        { unitPriceSnapshot: "Infinity" },
        { unitPriceSnapshot: "9999999999.991" },
      ];
      for (const invalid of rejects)
        await expect(
          getDb()
            .insert(posOrderItems)
            .values({ ...good, ...invalid }),
        ).rejects.toThrow();
      for (const invalid of [
        { unitPrice: "NaN" },
        { unitCost: "Infinity" },
        { soldByWeight: true, pricingUnit: "unit" },
        { soldByWeight: false, pricingUnit: "kg" },
      ])
        await expect(
          getDb()
            .insert(products)
            .values({
              businessId: world.businessId,
              name: "Invalid canonical",
              ...invalid,
            }),
        ).rejects.toThrow();
      // A canonical core order created by the measured writer is the actual historical parent.
      const [parent] = (
        await getDb().execute(
          sql`select id from core."order" where business_id=${world.businessId}::uuid limit 1`,
        )
      ).rows;
      expect(parent).toBeDefined();
      await getDb()
        .insert(orderItems)
        .values({
          orderId: parent.id as string,
          productId: historical[0].id,
          nameSnapshot: "Historical signed",
          quantity: "2147483647",
          unitPriceSnapshot: "-9999999999.99",
          lineTotal: "-1.00",
        });
      for (const invalid of rejects) {
        const base = {
          productId: good.productId,
          nameSnapshot: good.nameSnapshot,
          quantity: good.quantity,
          unitPriceSnapshot: good.unitPriceSnapshot,
        };
        await expect(
          getDb()
            .insert(orderItems)
            .values({
              ...base,
              orderId: parent.id as string,
              lineTotal: "0.00",
              ...invalid,
            }),
        ).rejects.toThrow();
      }
    }, 180000);
  },
);
