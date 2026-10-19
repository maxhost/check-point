import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  businessConfiguration,
  products,
  posOrders,
  diningTables,
  users,
} from "@mi-pasaporte/db/schema";
import { dispatchModuleRequest } from "../../dispatch";
import { backofficeScopeKey } from "../../../server/backoffice-scope";
import { getBackofficeRequestContext } from "../../../server/backoffice-context";
import {
  scannedCustomer,
  welcomeCoupon,
  choose,
} from "../../../server/counter/coupon-cycle-support";
import {
  dropPosWorld,
  capturePosScope,
  scopedPos,
  seedLegacyOrder,
  posStaff,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
  type PosWorld,
} from "./pos-integration-support";
import { getPosOrder } from "./read";
import { readPosCatalog } from "./measured-catalog";
import { closeWithCash } from "./pos-payment-integration-support";
const scopes = new Map<string, string>();
let a: PosWorld, b: PosWorld;
let allowed: string, denied: string, scope: string;
function request(
  cookie: string,
  path: string,
  version: string | null = "2",
  scope?: string,
) {
  return new Request(`http://localhost:3001/api/modules/pos/${path}`, {
    headers: {
      cookie,
      ...(version === null ? {} : { "X-Pos-Contract": version }),
      ...(scope === undefined ? {} : { "X-Backoffice-Scope": scope }),
    },
  });
}
async function call(
  cookie: string,
  path: string,
  version: string | null = "2",
  scope?: string | null,
) {
  const req = request(
    cookie,
    path,
    version,
    scope === undefined ? scopes.get(cookie) : (scope ?? undefined),
  );
  const response = await dispatchModuleRequest("GET", req, {
    moduleId: "pos",
    path: path.split("?")[0].split("/"),
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response;
}
async function body(response: Response, status = 200) {
  const json = await response.json();
  expect(response.status, JSON.stringify(json)).toBe(status);
  return json;
}
async function closed(
  items: { productId: string; quantity: number }[],
  membershipId?: string,
) {
  const order = await seedLegacyOrder(a, items);
  return body(
    await closeWithCash(
      a.ownerCookie,
      order.id,
      {
        version: order.version,
        clientRequestId: randomUUID(),
        ...(membershipId ? { membershipId } : {}),
      },
      { scope: scopes.get(a.ownerCookie)! },
    ),
  );
}
describe.skipIf(!posIntegrationEnabled)(
  "0242 POS catalog and detail V2 real guarded GET",
  () => {
    beforeAll(async () => {
      a = await seedPosWorld("CP2b readers A");
      b = await seedPosWorld("CP2b readers B");
      allowed = (await posStaff(a, ["pos"])).cookie;
      denied = (await posStaff(a, ["counter"])).cookie;
      const session = await getBackofficeRequestContext(
        request(a.ownerCookie, "catalog"),
      ).readSession();
      scope = backofficeScopeKey(
        {
          sessionId: session!.session.id,
          userId: session!.user.id,
          businessId: a.seed.business.id,
        },
        process.env.BETTER_AUTH_SECRET,
      );
      for (const [cookie, businessId] of [
        [a.ownerCookie, a.seed.business.id],
        [b.ownerCookie, b.seed.business.id],
        [allowed, a.seed.business.id],
        [denied, a.seed.business.id],
      ]) {
        scopes.set(cookie, await capturePosScope(cookie, businessId));
      }
    }, 240000);
    afterAll(async () => {
      const worlds = [a, b].filter(Boolean);
      await dropPosWorld(a);
      await dropPosWorld(b);
      const ids = worlds.flatMap((world) => [
        world.seed.userId,
        ...world.extraUsers,
      ]);
      if (ids.length) await getDb().delete(users).where(inArray(users.id, ids));
      expect(
        await getDb()
          .select({ id: businesses.id })
          .from(businesses)
          .where(
            inArray(
              businesses.id,
              worlds.map((world) => world.seed.business.id),
            ),
          ),
      ).toEqual([]);
    }, 240000);
    it("guard and scope precede unknown contracts on both GETs; no effects", async () => {
      const order = await seedLegacyOrder(a, [
        { productId: a.cafe, quantity: 1 },
      ]);
      const before = await getDb()
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, order.id));
      for (const path of ["catalog", `orders/${order.id}`]) {
        expect((await call("", path, "99")).status).toBe(401);
        expect((await call(denied, path, "99")).status).toBe(403);
        expect(
          await body(await call(a.ownerCookie, path, "99", "wrong"), 409),
        ).toHaveProperty("code", "backoffice_context_changed");
        expect(
          await body(await call(a.ownerCookie, path, "99", scope), 409),
        ).toHaveProperty("code", "pos_client_upgrade_required");
        expect(
          (await body(await call(a.ownerCookie, path, "2", null), 409)).code,
        ).toBe("backoffice_context_changed");
        expect((await call(allowed, path)).status).toBe(200);
      }
      expect(
        await getDb()
          .select()
          .from(posOrders)
          .where(eq(posOrders.id, order.id)),
      ).toEqual(before);
      expect(
        await body(await call(b.ownerCookie, `orders/${order.id}`), 404),
      ).toHaveProperty("code", "unknown_pos_order");
      expect(
        (await call(b.ownerCookie, `catalog?locationId=${a.seed.locationId}`))
          .status,
      ).toBe(422);
    }, 120000);
    it("minimum catalog retains zero, excludes null/local foreign, revision and units configuration/default", async () => {
      const free = await seedProduct(a, "Gratis V2", "0.00");
      const absent = await seedProduct(a, "Sin tarifa V2", null);
      const hidden = await seedProduct(a, "Oculto V2", "3.00");
      await getDb()
        .update(products)
        .set({
          salesRevision: 7,
          unitCost: "12.00",
          imageObjectKey: "private-object",
          imageVersion: 3,
        })
        .where(eq(products.id, free));
      await getDb()
        .update(products)
        .set({ availableAllLocations: false })
        .where(eq(products.id, hidden));
      await getDb()
        .delete(businessConfiguration)
        .where(eq(businessConfiguration.businessId, a.seed.business.id));
      const catalog = await body(await call(allowed, "catalog"));
      expect(catalog.salesMassUnits).toEqual(["kg"]);
      expect(
        catalog.products.find((p: { id: string }) => p.id === free),
      ).toEqual({
        id: free,
        name: "Gratis V2",
        categoryId: null,
        soldByWeight: false,
        pricingUnit: "unit",
        unitPrice: "0",
        catalogRevision: "7",
        imagePath: `/api/public/catalog/${free}/image?v=3`,
      });
      expect(catalog.products.map((p: { id: string }) => p.id)).not.toContain(
        absent,
      );
      expect(catalog.products.map((p: { id: string }) => p.id)).not.toContain(
        hidden,
      );
      await getDb()
        .insert(businessConfiguration)
        .values({
          businessId: a.seed.business.id,
          salesMassUnits: ["lb", "g"],
        });
      expect(
        (await body(await call(allowed, "catalog"))).salesMassUnits,
      ).toEqual(["lb", "g"]);
      // The internal legacy projection remains covered; HTTP V1 is retired.
      const legacyCatalog = await readPosCatalog(a.seed.business.id, null, 1);
      expect(legacyCatalog).not.toHaveProperty("salesMassUnits");
      expect(legacyCatalog).toHaveProperty("bestSellingProductIds");
      expect(legacyCatalog.products.find((p) => p.id === free)!.unitPrice).toBe(
        0,
      );
      for (const contract of [null, "1"]) {
        expect(
          (await body(await call(allowed, "catalog", contract), 409)).code,
        ).toBe("pos_client_upgrade_required");
      }
    }, 120000);
    it("detail keeps stored sale type, aliases, exact legacy high snapshots, deleted product and empty/voided orders", async () => {
      const high = await seedProduct(a, "Tarifa antigua", "9999999999.99");
      const order = await seedLegacyOrder(
        a,
        [{ productId: high, quantity: 1 }],
        "Mesa literal no FK",
      );
      await getDb().delete(products).where(eq(products.id, high));
      const detail = await body(
        await call(a.ownerCookie, `orders/${order.id}`),
      );
      expect(detail).toMatchObject({
        contractVersion: 2,
        saleType: "legacy",
        orderLabel: "Mesa literal no FK",
        tableLabel: "Mesa literal no FK",
        tableId: null,
        total: "9999999999.99",
        business: { name: expect.any(String), currencyCode: "USD" },
        items: [
          {
            productId: null,
            name: "Tarifa antigua",
            quantity: "1",
            unitPrice: "9999999999.99",
            financialSnapshot: null,
            measure: {
              kind: "unit",
              quantityUnit: "unit",
              priceUnit: "unit",
              conversionVersion: "mass-si-1",
            },
          },
        ],
      });
      expect(Object.keys(detail).sort()).toEqual(
        [
          "contractVersion",
          "id",
          "status",
          "version",
          "saleType",
          "orderLabel",
          "tableLabel",
          "tableId",
          "location",
          "note",
          "business",
          "items",
          "total",
          "createdAt",
          "createdBy",
          "closedAt",
          "closedBy",
          "sale",
          "settlement",
        ].sort(),
      );
      expect(Object.keys(detail.items[0]).sort()).toEqual(
        [
          "lineId",
          "productId",
          "name",
          "quantity",
          "unitPrice",
          "measure",
          "lineTotal",
          "financialSnapshot",
        ].sort(),
      );
      expect(Object.keys(detail.items[0].measure).sort()).toEqual(
        ["kind", "quantityUnit", "priceUnit", "conversionVersion"].sort(),
      );
      expect(Object.keys(detail.business).sort()).toEqual(
        ["name", "currencyCode"].sort(),
      );
      expect(detail).not.toHaveProperty("lines");
      expect(detail).not.toHaveProperty("createRequestId");
      const beforeLegacyRead = await getDb()
        .select()
        .from(posOrders)
        .where(eq(posOrders.id, order.id));
      for (const contract of [null, "1"]) {
        expect(
          (
            await body(
              await call(a.ownerCookie, `orders/${order.id}`, contract),
              409,
            )
          ).code,
        ).toBe("pos_client_upgrade_required");
      }
      expect(
        await getDb()
          .select()
          .from(posOrders)
          .where(eq(posOrders.id, order.id)),
      ).toEqual(beforeLegacyRead);
      await getDb()
        .update(posOrders)
        .set({ saleType: "pickup" })
        .where(eq(posOrders.id, order.id));
      expect(
        (await body(await call(a.ownerCookie, `orders/${order.id}`))).saleType,
      ).toBe("pickup");
      const [table] = await getDb()
        .insert(diningTables)
        .values({
          businessId: a.seed.business.id,
          locationId: a.seed.locationId,
          name: "Mesa real",
        })
        .returning({ id: diningTables.id });
      await getDb()
        .update(posOrders)
        .set({ saleType: null, diningTableId: table.id })
        .where(eq(posOrders.id, order.id));
      expect(
        await body(await call(a.ownerCookie, `orders/${order.id}`)),
      ).toMatchObject({
        saleType: "table",
        tableId: table.id,
        orderLabel: "Mesa literal no FK",
      });
      const zero = await seedProduct(a, "Cantidad antigua", "0.00");
      const many = await seedLegacyOrder(a, [
        { productId: zero, quantity: 2147483647 },
      ]);
      expect(
        await body(await call(a.ownerCookie, `orders/${many.id}`)),
      ).toMatchObject({
        total: "0.00",
        items: [
          { quantity: "2147483647", unitPrice: "0", financialSnapshot: null },
        ],
      });
      const empty = await seedLegacyOrder(a, []);
      expect(
        await body(await call(a.ownerCookie, `orders/${empty.id}`)),
      ).toMatchObject({ total: "0.00", items: [] });
      expect(
        (
          await scopedPos(a.ownerCookie, scopes.get(a.ownerCookie)!).void(
            empty.id,
          )
        ).status,
      ).toBe(200);
      expect(
        (await body(await call(a.ownerCookie, `orders/${empty.id}`))).status,
      ).toBe("voided");
    }, 120000);
    it("freezes financial snapshots/settlement with and without a customer after catalog and business changes", async () => {
      const customer = await scannedCustomer(a);
      for (const membershipId of [undefined, customer.membershipId]) {
        const stored = await closed(
          [{ productId: a.cafe, quantity: 1 }],
          membershipId,
        );
        await getDb()
          .update(products)
          .set({ unitPrice: "123.00" })
          .where(eq(products.id, a.cafe));
        const detail = await body(
          await call(a.ownerCookie, `orders/${stored.id}`),
        );
        expect(detail.total).toBe(stored.settlement.gross);
        expect(detail.items[0].financialSnapshot).toEqual(
          stored.items[0].financialSnapshot,
        );
        expect(detail.settlement).toEqual(stored.settlement);
        expect(detail.sale).toEqual(stored.sale);
        if (detail.sale)
          expect(detail.sale.total).toBe(stored.settlement.collected);
        await getDb()
          .update(products)
          .set({ unitPrice: "2.00" })
          .where(eq(products.id, a.cafe));
      }
    }, 180000);
    it("closed net and discounts remain frozen after business currency and catalog change", async () => {
      const customer = await scannedCustomer(a);
      const couponId = await welcomeCoupon(a, customer, {
        kind: "discount",
        label: "Mitad V2",
        discountUnit: "percent",
        discountValue: "50",
      });
      await choose(customer, couponId);
      const order = await seedLegacyOrder(a, [
        { productId: a.cafe, quantity: 1 },
      ]);
      const stored = await body(
        await closeWithCash(
          a.ownerCookie,
          order.id,
          {
            clientRequestId: randomUUID(),
            version: order.version,
            membershipId: customer.membershipId,
            coupon: { couponId },
          },
          { scope: scopes.get(a.ownerCookie)! },
        ),
      );
      expect(stored.settlement).toMatchObject({
        gross: "2.00",
        collected: "1.00",
        discount: "1.00",
      });
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, a.seed.business.id));
      try {
        const detail = await body(
          await call(a.ownerCookie, `orders/${order.id}`),
        );
        expect(detail).toMatchObject({
          total: "2.00",
          business: { currencyCode: "USD" },
          sale: {
            total: "1.00",
            grossTotal: "2.00",
            coupon: { discountAmount: "1.00" },
          },
        });
        expect(detail.settlement).toEqual(stored.settlement);
        expect(detail.items[0].financialSnapshot).toEqual(
          stored.items[0].financialSnapshot,
        );
      } finally {
        await getDb()
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, a.seed.business.id));
      }
    }, 180000);
    it("preserves closed and voided legacy COP cents without financial captures", async () => {
      const product = await seedProduct(a, "Centavos históricos", "0.49");
      const historicalOrders = [
        await seedLegacyOrder(a, [{ productId: product, quantity: 2 }]),
        await seedLegacyOrder(a, [{ productId: product, quantity: 2 }]),
      ];
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, a.seed.business.id));
      try {
        for (const [index, status] of ["closed", "voided"].entries()) {
          const order = historicalOrders[index];
          await getDb()
            .update(posOrders)
            .set({
              status,
              closedAt: new Date(),
              closedByUserId: a.seed.userId,
            })
            .where(eq(posOrders.id, order.id));
          // SQL fixture and internal historical reader preserve exact cents.
          const legacy = await getPosOrder(a.seed.business.id, order.id);
          expect(
            (
              await body(
                await call(a.ownerCookie, `orders/${order.id}`, "1"),
                409,
              )
            ).code,
          ).toBe("pos_client_upgrade_required");
          const measured = await body(
            await call(a.ownerCookie, `orders/${order.id}`),
          );
          expect(measured).toMatchObject({
            status,
            settlement: null,
            total: "0.98",
            items: [{ lineTotal: "0.98", financialSnapshot: null }],
          });
          expect(measured.total).toBe(legacy.total);
        }
      } finally {
        await getDb()
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, a.seed.business.id));
      }
    }, 120000);
    it("frequency counts distinct closed orders, not duplicate lines or units; excludes old/local/hidden/null products", async () => {
      const first = await seedProduct(a, "Frecuente A", "1.00"),
        second = await seedProduct(a, "Frecuente B", "1.00");
      await closed([{ productId: second, quantity: 1 }]);
      await closed([{ productId: second, quantity: 1 }]);
      // Most recent duplicated product would win a faulty COUNT(*) tie.
      const duplicate = await closed([
        { productId: first, quantity: 20 },
        { productId: first, quantity: 20 },
      ]);
      expect(duplicate.items).toHaveLength(2);
      const ids = (
        await body(
          await call(a.ownerCookie, `catalog?locationId=${a.seed.locationId}`),
        )
      ).frequentProductIds;
      expect(ids.indexOf(second)).toBeLessThan(ids.indexOf(first));
      const legacyCatalogAtLocation = await readPosCatalog(
        a.seed.business.id,
        a.seed.locationId,
        1,
      );
      if (!("bestSellingProductIds" in legacyCatalogAtLocation))
        throw new Error("Expected internal legacy catalog projection");
      const legacy = legacyCatalogAtLocation.bestSellingProductIds;
      expect(legacy.indexOf(first)).toBeLessThan(legacy.indexOf(second));
      const old = await closed([{ productId: first, quantity: 1 }]);
      await getDb()
        .update(posOrders)
        .set({ closedAt: sql`now() - interval '31 days'` })
        .where(eq(posOrders.id, old.id));
      await getDb()
        .update(products)
        .set({ unitPrice: null })
        .where(eq(products.id, first));
      expect(
        (await body(await call(a.ownerCookie, "catalog"))).frequentProductIds,
      ).not.toContain(first);
    }, 240000);
  },
);
