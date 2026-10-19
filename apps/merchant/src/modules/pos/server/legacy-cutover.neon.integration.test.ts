import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businessCustomers,
  campaignCoupons,
  consumerAccounts,
  couponRedemptions,
  memberships,
  orders,
  posOrders,
  programMemberships,
  rewardRedemptions,
} from "@mi-pasaporte/db/schema";
import { dispatchModuleRequest } from "../../dispatch";
import { getBackofficeRequestContext } from "../../../server/backoffice-context";
import { backofficeScopeKey } from "../../../server/backoffice-scope";
import { seedConsumer } from "../../../server/counter-integration-support";
import {
  choose,
  scannedCustomer,
  welcomeCoupon,
  type Customer,
} from "../../../server/counter/coupon-cycle-support";
import {
  dropPosWorld,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  setPosModule,
  type PosWorld,
} from "./pos-integration-support";
import { POST as resolve } from "../../../app/api/counter/resolve/route";
import { POST as grant } from "../../../app/api/counter/grant/route";
import { POST as redeem } from "../../../app/api/counter/redeem/route";
import { GET as couponState } from "../../../app/api/counter/coupon-state/route";
import { POST as couponRemove } from "../../../app/api/counter/coupon-remove/route";

// No guard/domain doubles: isolated CI DB + native sessions. Never use the legacy pos.* client.
const counterRoutes = [
  ["resolve", resolve],
  ["grant", grant],
  ["redeem", redeem],
  ["coupon-state", couponState],
  ["coupon-remove", couponRemove],
] as const;
const worlds: PosWorld[] = [];
const consumerIds: string[] = [];
let a: PosWorld, b: PosWorld, customer: Customer;
let freshQr: string, scope: string;
let staff: Awaited<ReturnType<typeof posStaff>>;
let onlyPos: Awaited<ReturnType<typeof posStaff>>;
function request(
  path: string,
  cookie: string,
  method = "GET",
  body?: unknown,
  contract: string | null = "2",
  mark: string | null = scope,
) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      cookie,
      ...(contract === null ? {} : { "X-Pos-Contract": contract }),
      ...(mark === null ? {} : { "X-Backoffice-Scope": mark }),
      "content-type": "application/json",
    },
    ...(body === undefined
      ? {}
      : { body: body === "malformed" ? "{" : JSON.stringify(body) }),
  });
}
async function mark(cookie: string, world: PosWorld) {
  const native = await getBackofficeRequestContext(
    request("/api/modules/pos/orders", cookie),
  ).readSession();
  expect(native).not.toBeNull();
  return backofficeScopeKey(
    {
      sessionId: native!.session.id,
      userId: native!.user.id,
      businessId: world.seed.business.id,
    },
    process.env.BETTER_AUTH_SECRET,
  );
}
async function posCall(req: Request, path: string) {
  return dispatchModuleRequest(req.method, req, {
    moduleId: "pos",
    path: path.split("/"),
  });
}
async function expectCode(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect((await response.json()).code).toBe(code);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("location")).toBeNull();
}
async function snapshot() {
  const db = getDb();
  const ids = worlds.map((world) => world.seed.business.id);
  return Promise.all([
    db
      .select()
      .from(posOrders)
      .where(inArray(posOrders.businessId, ids))
      .orderBy(posOrders.id),
    db
      .select()
      .from(orders)
      .where(inArray(orders.businessId, ids))
      .orderBy(orders.id),
    db
      .select()
      .from(programMemberships)
      .where(inArray(programMemberships.businessId, ids))
      .orderBy(programMemberships.id),
    db
      .select()
      .from(businessCustomers)
      .where(inArray(businessCustomers.businessId, ids))
      .orderBy(businessCustomers.consumerId, businessCustomers.businessId),
    db
      .select()
      .from(rewardRedemptions)
      .where(inArray(rewardRedemptions.businessId, ids))
      .orderBy(rewardRedemptions.id),
    db
      .select()
      .from(campaignCoupons)
      .where(inArray(campaignCoupons.businessId, ids))
      .orderBy(campaignCoupons.id),
    db
      .select()
      .from(couponRedemptions)
      .where(inArray(couponRedemptions.businessId, ids))
      .orderBy(couponRedemptions.id),
    db
      .select({
        id: consumerAccounts.id,
        selectedCouponId: consumerAccounts.selectedCouponId,
        couponSelectedAt: consumerAccounts.couponSelectedAt,
      })
      .from(consumerAccounts)
      .where(inArray(consumerAccounts.id, consumerIds))
      .orderBy(consumerAccounts.id),
  ]);
}
async function cleanup() {
  while (worlds.length) await dropPosWorld(worlds.pop());
  if (consumerIds.length)
    await getDb()
      .delete(consumerAccounts)
      .where(inArray(consumerAccounts.id, consumerIds));
}
describe.skipIf(!posIntegrationEnabled)(
  "P3a cutover: native guards, scope and no legacy effects",
  { timeout: 120000 },
  () => {
    beforeAll(async () => {
      try {
        a = await seedPosWorld("P3a cutover A");
        worlds.push(a);
        b = await seedPosWorld("P3a cutover B");
        worlds.push(b);
        staff = await posStaff(a, ["counter", "pos"]);
        onlyPos = await posStaff(a, ["pos"]);
        customer = await scannedCustomer(a);
        consumerIds.push(customer.consumerId);
        const couponId = await welcomeCoupon(a, customer, {
          kind: "free_product",
          label: "Cutover coupon",
          productId: a.cafe,
        });
        await choose(customer, couponId);
        const fresh = await seedConsumer();
        consumerIds.push(fresh.id);
        freshQr = fresh.qrToken;
        scope = await mark(a.ownerCookie, a);
      } catch (error) {
        await cleanup();
        throw error;
      }
    }, 240000);
    afterAll(cleanup, 240000);
    it("absent/1/unknown contract rejects before malformed body and never enrols or writes", async () => {
      const before = await snapshot();
      for (const contract of [null, "1", "99"]) {
        for (const path of [
          "orders",
          "resolve",
          `orders/${randomUUID()}/close`,
          `orders/${randomUUID()}/void`,
          "coupon-remove",
        ]) {
          const req = request(
            `/api/modules/pos/${path}`,
            a.ownerCookie,
            "POST",
            "malformed",
            contract,
          );
          const json = vi.spyOn(req, "json");
          await expectCode(
            await posCall(req, path),
            409,
            "pos_client_upgrade_required",
          );
          expect(json).not.toHaveBeenCalled();
        }
      }
      expect(await snapshot()).toEqual(before);
    });
    it("required scope and tenant mismatch reject before contract; matching contract2 still reads", async () => {
      const before = await snapshot();
      for (const [cookie, token] of [
        [a.ownerCookie, null],
        [b.ownerCookie, scope],
      ] as const) {
        await expectCode(
          await posCall(
            request(
              "/api/modules/pos/orders",
              cookie,
              "GET",
              undefined,
              null,
              token,
            ),
            "orders",
          ),
          409,
          "backoffice_context_changed",
        );
      }
      const response = await posCall(
        request("/api/modules/pos/orders", a.ownerCookie),
        "orders",
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await snapshot()).toEqual(before);
    });
    it("Counter five endpoints retire after native guard, preserving membership/balance/coupon/last_scan", async () => {
      const before = await snapshot();
      for (const [path, handler] of counterRoutes) {
        const body =
          path === "resolve"
            ? { qrToken: freshQr }
            : {
                membershipId: customer.membershipId,
                clientRequestId: randomUUID(),
                mode: "detailed",
                items: [{ productId: a.cafe, quantity: 1 }],
                rewardId: randomUUID(),
              };
        const url = `/api/counter/${path}?membershipId=${customer.membershipId}`;
        for (const cookie of [a.ownerCookie, staff.cookie]) {
          const req = request(
            url,
            cookie,
            path === "coupon-state" ? "GET" : "POST",
            path === "coupon-state" ? undefined : body,
          );
          const json = vi.spyOn(req, "json");
          await expectCode(await handler(req), 410, "feature_retired");
          expect(json).not.toHaveBeenCalled();
        }
        // Retiring resolve must neither enrol a new consumer nor refresh an existing last_scan.
        if (path === "resolve")
          await expectCode(
            await handler(
              request(url, a.ownerCookie, "POST", {
                qrToken: customer.qrToken,
              }),
            ),
            410,
            "feature_retired",
          );
        const anonymous = await handler(
          request(url, "", path === "coupon-state" ? "GET" : "POST"),
        );
        expect(anonymous.status).toBe(401);
        expect((await anonymous.json()).code).not.toBe("feature_retired");
        expect(anonymous.headers.get("cache-control")).toBe(
          "private, no-store",
        );
        const denied = await handler(
          request(
            url,
            onlyPos.cookie,
            path === "coupon-state" ? "GET" : "POST",
          ),
        );
        await expectCode(denied, 403, "missing_permission");
      }
      expect(await snapshot()).toEqual(before);
    });
    it("module off and permission revoked stay before scope/contract", async () => {
      const before = await snapshot();
      await setPosModule(a.seed.business.id, false);
      try {
        await expectCode(
          await posCall(
            request(
              "/api/modules/pos/orders",
              a.ownerCookie,
              "GET",
              undefined,
              null,
              "bad",
            ),
            "orders",
          ),
          403,
          "module_disabled",
        );
      } finally {
        await setPosModule(a.seed.business.id, true);
      }
      const captured = await mark(staff.cookie, a);
      await getDb()
        .update(memberships)
        .set({ permissions: ["counter"] })
        .where(
          and(
            eq(memberships.businessId, a.seed.business.id),
            eq(memberships.userId, staff.userId),
          ),
        );
      try {
        await expectCode(
          await posCall(
            request(
              "/api/modules/pos/orders",
              staff.cookie,
              "GET",
              undefined,
              "2",
              captured,
            ),
            "orders",
          ),
          403,
          "missing_permission",
        );
      } finally {
        await getDb()
          .update(memberships)
          .set({ permissions: ["counter", "pos"] })
          .where(
            and(
              eq(memberships.businessId, a.seed.business.id),
              eq(memberships.userId, staff.userId),
            ),
          );
      }
      expect(await snapshot()).toEqual(before);
    });
  },
);
