import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  consumerAccounts,
  diningTables,
  locations,
  posOrders,
  products,
  programMemberships,
  sessions,
  users,
} from "@mi-pasaporte/db/schema";
import * as rewards from "@mi-pasaporte/domain/server/loyalty-program/persistence";
import * as catalog from "../../../server/counter/resolve-catalog";
import { seedConsumer } from "../../../server/counter-integration-support";
import {
  choose,
  scannedCustomer,
  welcomeCoupon,
} from "../../../server/counter/coupon-cycle-support";
import { getBackofficeRequestContext } from "../../../server/backoffice-context";
import { backofficeScopeKey } from "../../../server/backoffice-scope";
import { dispatchModuleRequest } from "../../dispatch";
import { closeWithCash } from "./pos-payment-integration-support";
import {
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  seedProduct,
  setPosModule,
  type PosWorld,
} from "./pos-integration-support";

let a: PosWorld, b: PosWorld;
let allowed: string, denied: string, scope: string;
const consumers: string[] = [];
function request(
  path: "orders" | "resolve",
  cookie: string,
  contract: string | null,
  value?: unknown,
  scopeKey?: string,
  suffix = "",
) {
  return new Request(`http://localhost:3001/api/modules/pos/${path}${suffix}`, {
    method: path === "orders" ? "GET" : "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      ...(contract === null ? {} : { "X-Pos-Contract": contract }),
      ...(scopeKey === undefined ? {} : { "X-Backoffice-Scope": scopeKey }),
    },
    ...(path === "resolve"
      ? {
          body:
            value === "malformed"
              ? "{"
              : JSON.stringify(value === undefined ? {} : value),
        }
      : {}),
  });
}
async function call(
  path: "orders" | "resolve",
  cookie = a.ownerCookie,
  contract: string | null = "2",
  value?: unknown,
  scopeKey?: string,
  suffix = "",
) {
  const response = await dispatchModuleRequest(
    path === "orders" ? "GET" : "POST",
    request(path, cookie, contract, value, scopeKey, suffix),
    { moduleId: "pos", path: [path] },
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response;
}
async function body(response: Response, status = 200) {
  const value = await response.json();
  expect(response.status, JSON.stringify(value)).toBe(status);
  return value;
}
async function effects() {
  return (
    await getDb().execute(sql`
    select
      (select count(*) from core."order" where business_id=${a.seed.business.id})::int as orders,
      (select count(*) from core.module_event where business_id=${a.seed.business.id})::int as events,
      (select count(*) from core.coupon_redemption where business_id=${a.seed.business.id})::int as redemptions,
      (select count(*) from pos.pos_order where business_id=${a.seed.business.id})::int as preparations
  `)
  ).rows;
}
async function identity(consumerId: string) {
  return (
    await getDb().execute(sql`
    select business_id, last_scan_at is not null as scanned, last_visit_at is not null as visited
    from core.business_customer where consumer_id=${consumerId} order by business_id
  `)
  ).rows;
}
async function memberships(consumerId: string) {
  return getDb()
    .select()
    .from(programMemberships)
    .where(eq(programMemberships.consumerId, consumerId));
}

describe.skipIf(!posIntegrationEnabled)(
  "0242 CP2b.7 HTTP read assembly",
  { timeout: 120000 },
  () => {
    beforeAll(async () => {
      a = await seedPosWorld("read HTTP A");
      b = await seedPosWorld("read HTTP B");
      allowed = (await posStaff(a, ["pos"])).cookie;
      denied = (await posStaff(a, ["business"])).cookie;
      const session = await getBackofficeRequestContext(
        request("orders", a.ownerCookie, "2"),
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
      vi.restoreAllMocks();
      const worlds = [a, b].filter(Boolean);
      const ownerStaffIds = worlds.flatMap((w) => [
        w.seed.userId,
        ...w.extraUsers,
      ]);
      const businessIds = worlds.map((w) => w.seed.business.id);
      for (const world of worlds) await dropPosWorld(world);
      if (consumers.length)
        await getDb()
          .delete(consumerAccounts)
          .where(inArray(consumerAccounts.id, consumers));
      if (ownerStaffIds.length)
        await getDb().delete(users).where(inArray(users.id, ownerStaffIds));
      if (businessIds.length)
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(inArray(businesses.id, businessIds)),
        ).toEqual([]);
      if (consumers.length) {
        expect(
          await getDb()
            .select({ id: consumerAccounts.id })
            .from(consumerAccounts)
            .where(inArray(consumerAccounts.id, consumers)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: programMemberships.id })
            .from(programMemberships)
            .where(inArray(programMemberships.consumerId, consumers)),
        ).toEqual([]);
        for (const id of consumers) expect(await identity(id)).toEqual([]);
      }
      if (ownerStaffIds.length) {
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, ownerStaffIds)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: sessions.id })
            .from(sessions)
            .where(inArray(sessions.userId, ownerStaffIds)),
        ).toEqual([]);
      }
    }, 240000);

    it("guards and optional scope precede contract/body, including disabled module, without identity effects", async () => {
      const c = await seedConsumer();
      consumers.push(c.id);
      const before = await effects();
      for (const path of ["orders", "resolve"] as const) {
        expect((await call(path, "", "99", "malformed")).status).toBe(401);
        expect((await call(path, denied, "99", "malformed")).status).toBe(403);
        expect(
          (
            await body(
              await call(path, b.ownerCookie, "99", "malformed", scope),
              409,
            )
          ).code,
        ).toBe("backoffice_context_changed");
        await setPosModule(a.seed.business.id, false);
        try {
          expect(
            (
              await body(
                await call(path, a.ownerCookie, "99", "malformed"),
                403,
              )
            ).code,
          ).toBe("module_disabled");
        } finally {
          await setPosModule(a.seed.business.id, true);
        }
        expect(
          (
            await body(
              await call(
                path,
                a.ownerCookie,
                "99",
                { qrToken: c.qrToken },
                scope,
              ),
              409,
            )
          ).code,
        ).toBe("pos_client_upgrade_required");
      }
      expect(await effects()).toEqual(before);
      expect(await memberships(c.id)).toEqual([]);
      expect(await identity(c.id)).toEqual([]);
      expect((await call("orders", allowed)).status).toBe(200);
    });

    it("negotiates exact V2 summaries, V1 shape, void query and tenant isolation through HTTP", async () => {
      const productId = await seedProduct(a, "HTTP price", "3.25");
      const pickup = await openOrder(
        a,
        [{ productId, quantity: 2 }],
        "Recoger Ana",
      );
      await getDb()
        .update(posOrders)
        .set({ saleType: "pickup" })
        .where(eq(posOrders.id, pickup.id));
      const [table] = await getDb()
        .insert(diningTables)
        .values({
          businessId: a.seed.business.id,
          locationId: a.seed.locationId,
          name: "Real table",
        })
        .returning();
      const tableOrder = await openOrder(
        a,
        [{ productId, quantity: 1 }],
        "Mesa congelada",
      );
      await getDb()
        .update(posOrders)
        .set({ diningTableId: table.id })
        .where(eq(posOrders.id, tableOrder.id));
      const closed = await openOrder(a, [{ productId, quantity: 2 }]);
      await body(
        await closeWithCash(a.ownerCookie, closed.id, {
          clientRequestId: randomUUID(),
          version: closed.version,
        }),
      );
      const voided = await openOrder(a, [{ productId, quantity: 3 }]);
      await body(await pos.void(a.ownerCookie, voided.id));
      const foreign = await openOrder(b, [{ productId: b.cafe, quantity: 1 }]);
      const v2 = await body(await call("orders", allowed));
      expect(
        v2.open.find((o: { id: string }) => o.id === pickup.id),
      ).toMatchObject({
        lineCount: 1,
        total: "6.50",
        saleType: "pickup",
        orderLabel: "Recoger Ana",
        version: 1,
      });
      expect(
        v2.open.find((o: { id: string }) => o.id === tableOrder.id),
      ).toMatchObject({
        lineCount: 1,
        total: "3.25",
        saleType: "table",
        orderLabel: "Mesa congelada",
        tableId: table.id,
      });
      expect(
        v2.closedToday.find((o: { id: string }) => o.id === closed.id),
      ).toMatchObject({ total: "6.50", saleTotal: "6.50", lineCount: 1 });
      expect(
        v2.closedToday.find((o: { id: string }) => o.id === voided.id),
      ).toMatchObject({ status: "voided", total: "9.75", saleTotal: null });
      expect(JSON.stringify(v2)).not.toContain(foreign.id);
      expect(v2.open[0]).not.toHaveProperty("items");
      expect(v2.open[0]).not.toHaveProperty("itemCount");
      const v1 = await body(await call("orders", a.ownerCookie, null));
      expect(await body(await call("orders", a.ownerCookie, "1"))).toEqual(v1);
      expect(
        v1.open.find((o: { id: string }) => o.id === pickup.id),
      ).toMatchObject({
        itemCount: 2,
        tableLabel: "Recoger Ana",
        total: "6.50",
      });
      expect(v1.open[0]).not.toHaveProperty("lineCount");
      expect(v1.open[0]).not.toHaveProperty("saleType");
      const history = await body(
        await call(
          "orders",
          a.ownerCookie,
          "2",
          undefined,
          undefined,
          "?status=voided",
        ),
      );
      expect(history.open).toEqual([]);
      expect(history.closedToday.map((o: { id: string }) => o.id)).toEqual([
        voided.id,
      ]);
      for (const contract of [null, "1", "2"])
        expect(
          (
            await body(
              await call(
                "orders",
                a.ownerCookie,
                contract,
                undefined,
                undefined,
                "?status=closed",
              ),
              422,
            )
          ).code,
        ).toBe("invalid_input");
      expect(
        (
          await body(
            await call(
              "orders",
              a.ownerCookie,
              "99",
              undefined,
              undefined,
              "?status=closed",
            ),
            409,
          )
        ).code,
      ).toBe("pos_client_upgrade_required");
    });

    it("rejects malformed body/token/local before enrolment and scan", async () => {
      const c = await seedConsumer();
      consumers.push(c.id);
      const before = await effects();
      expect(
        (
          await body(
            await call("resolve", a.ownerCookie, "2", "malformed"),
            400,
          )
        ).code,
      ).toBe("invalid_body");
      for (const value of [null, [], 42])
        expect((await call("resolve", a.ownerCookie, "2", value)).status).toBe(
          400,
        );
      for (const value of [
        {},
        { qrToken: "" },
        { qrToken: "unknown" },
        { qrToken: 42 },
      ])
        expect(
          (await body(await call("resolve", a.ownerCookie, "2", value), 422))
            .code,
        ).toBe("qr_unresolved");
      for (const locationId of [b.seed.locationId, randomUUID()])
        expect(
          (
            await body(
              await call("resolve", a.ownerCookie, "2", {
                qrToken: c.qrToken,
                locationId,
              }),
              422,
            )
          ).code,
        ).toBe("unknown_location");
      expect(
        (
          await call("resolve", a.ownerCookie, "2", {
            qrToken: c.qrToken,
            locationId: 42,
          })
        ).status,
      ).toBe(422);
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, a.seed.locationId));
      try {
        expect(
          (
            await body(
              await call("resolve", a.ownerCookie, "2", {
                qrToken: c.qrToken,
                locationId: a.seed.locationId,
              }),
              422,
            )
          ).code,
        ).toBe("unknown_location");
      } finally {
        await getDb()
          .update(locations)
          .set({ status: "active" })
          .where(eq(locations.id, a.seed.locationId));
      }
      expect(await memberships(c.id)).toEqual([]);
      expect(await identity(c.id)).toEqual([]);
      expect(await effects()).toEqual(before);
    });

    it("minimal QR enrols once, updates last_scan, never loads legacy data, and preserves legacy shape", async () => {
      const c = await seedConsumer();
      consumers.push(c.id);
      const before = await effects();
      const catalogSpy = vi.spyOn(catalog, "businessCatalog");
      const shortcutSpy = vi.spyOn(catalog, "purchaseShortcuts");
      const rewardSpy = vi.spyOn(rewards, "loadProgramRewards");
      try {
        const first = await body(
          await call("resolve", allowed, "2", {
            qrToken: ` ${c.qrToken} `,
            locationId: a.seed.locationId,
          }),
        );
        expect(Object.keys(first).sort()).toEqual([
          "consumer",
          "couponState",
          "membership",
          "program",
        ]);
        expect(Object.keys(first.program).sort()).toEqual([
          "accrual",
          "id",
          "kind",
        ]);
        expect(Object.keys(first.consumer)).toEqual(["displayName"]);
        expect(first.membership).toMatchObject({
          justEnrolled: true,
          pointsBalance: 0,
          stampsCount: 0,
        });
        expect(first.couponState).toEqual({ status: "none" });
        expect(await identity(c.id)).toEqual([
          { business_id: a.seed.business.id, scanned: true, visited: false },
        ]);
        await getDb().execute(
          sql`update core.business_customer set last_scan_at=null where business_id=${a.seed.business.id} and consumer_id=${c.id}`,
        );
        const again = await body(
          await call("resolve", a.ownerCookie, "2", { qrToken: c.qrToken }),
        );
        expect(again.membership).toEqual({
          ...first.membership,
          justEnrolled: false,
        });
        expect(await memberships(c.id)).toHaveLength(1);
        expect(await identity(c.id)).toEqual([
          { business_id: a.seed.business.id, scanned: true, visited: false },
        ]);
        // Valid unit product precision is representable in expanded storage, incompatible with legacy cents.
        const precise = await seedProduct(a, "Three decimals", "0.499");
        try {
          expect(
            (await call("resolve", allowed, "2", { qrToken: c.qrToken }))
              .status,
          ).toBe(200);
          expect(catalogSpy).not.toHaveBeenCalled();
          expect(shortcutSpy).not.toHaveBeenCalled();
          expect(rewardSpy).not.toHaveBeenCalled();
          expect(
            (
              await body(
                await call("resolve", a.ownerCookie, "1", {
                  qrToken: c.qrToken,
                }),
                409,
              )
            ).code,
          ).toBe("pos_client_upgrade_required");
        } finally {
          await getDb().delete(products).where(eq(products.id, precise));
        }
      } finally {
        vi.restoreAllMocks();
      }
      const legacy = await body(
        await call("resolve", a.ownerCookie, null, { qrToken: c.qrToken }),
      );
      expect(Object.keys(legacy).sort()).toEqual([
        "catalog",
        "consumer",
        "couponState",
        "membership",
        "program",
        "rewards",
      ]);
      expect(
        await body(
          await call("resolve", a.ownerCookie, "1", { qrToken: c.qrToken }),
        ),
      ).toEqual(legacy);
      expect(await effects()).toEqual(before);
    });

    it("returns selected coupon identity and verdict without selecting/redeeming or crossing tenants", async () => {
      const customer = await scannedCustomer(a);
      consumers.push(customer.consumerId);
      const couponId = await welcomeCoupon(a, customer, {
        kind: "free_product",
        label: "Café HTTP",
        productId: a.cafe,
      });
      await choose(customer, couponId);
      const before = await effects();
      const result = await body(
        await call("resolve", allowed, "2", { qrToken: customer.qrToken }),
      );
      expect(result.couponState).toMatchObject({
        status: "selected",
        coupon: { couponId, label: "Café HTTP", kind: "free_product" },
        verdict: { valid: true },
      });
      expect(
        (
          await body(
            await call("resolve", b.ownerCookie, "2", {
              qrToken: customer.qrToken,
            }),
          )
        ).couponState,
      ).toEqual({ status: "none" });
      const [account] = await getDb()
        .select({ selected: consumerAccounts.selectedCouponId })
        .from(consumerAccounts)
        .where(eq(consumerAccounts.id, customer.consumerId));
      expect(account.selected).toBe(couponId);
      expect(await effects()).toEqual(before);
    });
  },
);
