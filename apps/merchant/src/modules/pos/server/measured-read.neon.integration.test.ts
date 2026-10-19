import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  businessConfiguration,
  products,
  posOrders,
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
  openOrder,
  pos,
  posStaff,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
  type PosWorld,
} from "./pos-integration-support";
import { closeWithCash } from "./pos-payment-integration-support";
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
  scope?: string,
) {
  const req = request(cookie, path, version, scope);
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
  const order = await openOrder(a, items);
  return body(
    await closeWithCash(a.ownerCookie, order.id, {
      version: order.version,
      clientRequestId: randomUUID(),
      ...(membershipId ? { membershipId } : {}),
    }),
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
      const order = await openOrder(a, [{ productId: a.cafe, quantity: 1 }]);
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
      const legacy = await body(await call(allowed, "catalog", null));
      expect(legacy).not.toHaveProperty("salesMassUnits");
      expect(legacy).toHaveProperty("bestSellingProductIds");
      expect(
        legacy.products.find((p: { id: string }) => p.id === free).unitPrice,
      ).toBe(0);
    }, 120000);
    it("detail keeps stored sale type, aliases, exact legacy high snapshots, deleted product and empty/voided orders", async () => {
      const high = await seedProduct(a, "Tarifa antigua", "9999999999.99");
      const order = await openOrder(
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
            measure: {
              kind: "unit",
              quantityUnit: "unit",
              priceUnit: "unit",
              conversionVersion: "mass-si-1",
            },
          },
        ],
      });
      expect(detail).not.toHaveProperty("lines");
      expect(detail).not.toHaveProperty("createRequestId");
      const legacy = await body(
        await call(a.ownerCookie, `orders/${order.id}`, "1"),
      );
      expect(legacy.items[0].quantity).toBe(1);
      expect(legacy.total).toBe(detail.total);
      await getDb()
        .update(posOrders)
        .set({ saleType: "pickup" })
        .where(eq(posOrders.id, order.id));
      expect(
        (await body(await call(a.ownerCookie, `orders/${order.id}`))).saleType,
      ).toBe("pickup");
      const empty = await openOrder(a, []);
      expect(
        await body(await call(a.ownerCookie, `orders/${empty.id}`)),
      ).toMatchObject({ total: "0.00", items: [] });
      expect((await pos.void(a.ownerCookie, empty.id)).status).toBe(200);
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
      const order = await openOrder(a, [{ productId: a.cafe, quantity: 1 }]);
      const stored = await body(
        await closeWithCash(a.ownerCookie, order.id, {
          clientRequestId: randomUUID(),
          version: order.version,
          membershipId: customer.membershipId,
          coupon: { couponId },
        }),
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
    it("frequency counts distinct closed orders, not duplicate lines or units; excludes old/local/hidden/null products", async () => {
      const first = await seedProduct(a, "Frecuente A", "1.00"),
        second = await seedProduct(a, "Frecuente B", "1.00");
      await closed([
        { productId: first, quantity: 20 },
        { productId: first, quantity: 20 },
      ]);
      await closed([{ productId: second, quantity: 1 }]);
      await closed([{ productId: second, quantity: 1 }]);
      const ids = (
        await body(
          await call(a.ownerCookie, `catalog?locationId=${a.seed.locationId}`),
        )
      ).frequentProductIds;
      expect(ids.indexOf(second)).toBeLessThan(ids.indexOf(first));
      const legacy = (
        await body(
          await call(
            a.ownerCookie,
            `catalog?locationId=${a.seed.locationId}`,
            "1",
          ),
        )
      ).bestSellingProductIds;
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
