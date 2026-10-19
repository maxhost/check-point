import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { businesses, posOrders, users } from "@mi-pasaporte/db/schema";
import { dispatchModuleRequest } from "../../dispatch";
import { getBackofficeRequestContext } from "../../../server/backoffice-context";
import { backofficeScopeKey } from "../../../server/backoffice-scope";
import {
  type PosWorld,
  dropPosWorld,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
} from "./pos-integration-support";
import { server } from "./routes";
import { createPosOrderV2 } from "./measured-create";

const inventory = [
  "GET payment-methods",
  "GET catalog",
  "GET orders",
  "POST orders",
  "GET orders/:id",
  "PUT orders/:id",
  "POST orders/:id/close",
  "POST orders/:id/void",
  "POST resolve",
  "GET coupon-state",
  "POST coupon-remove",
  "GET tables",
  "GET ticket",
  "GET ticket-settings",
  "PUT ticket-settings",
];
it("all POS routes, including spread payment routes, require scope and contract2", () => {
  expect(server.routes.map((route) => `${route.method} ${route.path}`)).toEqual(
    inventory,
  );
  expect(
    server.routes.every((route) => route.backofficeScope === "required"),
  ).toBe(true);
});

let a: PosWorld | undefined;
let b: PosWorld | undefined;
const request = (
  cookie: string,
  path: string,
  scope?: string,
  body?: unknown,
) =>
  new Request(`http://localhost:3001/api/modules/pos/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "X-Pos-Contract": "2",
      ...(scope === undefined ? {} : { "X-Backoffice-Scope": scope }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
async function call(
  cookie: string,
  path: string,
  scope?: string,
  body?: unknown,
) {
  const req = request(cookie, path, scope, body);
  const response = await dispatchModuleRequest(req.method, req, {
    moduleId: "pos",
    path: path.split("/"),
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response;
}
async function mark(world: PosWorld) {
  const native = await getBackofficeRequestContext(
    request(world.ownerCookie, "orders"),
  ).readSession();
  expect(native?.user.id).toBe(world.seed.userId);
  return backofficeScopeKey(
    {
      sessionId: native!.session.id,
      userId: native!.user.id,
      businessId: world.seed.business.id,
    },
    process.env.BETTER_AUTH_SECRET,
  );
}
async function snapshot() {
  return getDb()
    .select()
    .from(posOrders)
    .where(
      inArray(posOrders.businessId, [a!.seed.business.id, b!.seed.business.id]),
    )
    .orderBy(posOrders.id);
}

describe.skipIf(!posIntegrationEnabled)(
  "POS scope: real dispatch, native sessions and isolated CI DB",
  () => {
    beforeAll(async () => {
      a = await seedPosWorld("CP1a scope A");
      b = await seedPosWorld("CP1a scope B");
      // Seed through domain; this suite tests the HTTP boundary below, not the old fixture client.
      for (const [world, orderLabel] of [
        [a, "CP1a-A-private"],
        [b, "CP1a-B-private"],
      ] as const) {
        await createPosOrderV2(world.seed.business, world.seed.userId, {
          createRequestId: randomUUID(),
          saleType: "pickup",
          orderLabel,
          locationId: world.seed.locationId,
          tableId: null,
          items: [],
        });
      }
    }, 240_000);
    afterAll(async () => {
      const businessIds = [a, b]
        .filter((world): world is PosWorld => Boolean(world))
        .map((world) => world.seed.business.id);
      const userIds = [a, b]
        .filter((world): world is PosWorld => Boolean(world))
        .flatMap((world) => [world.seed.userId, ...world.extraUsers]);
      await dropPosWorld(a);
      await dropPosWorld(b);
      if (userIds.length)
        await getDb().delete(users).where(inArray(users.id, userIds));
      if (businessIds.length) {
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(inArray(businesses.id, businessIds)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: posOrders.id })
            .from(posOrders)
            .where(inArray(posOrders.businessId, businessIds)),
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, userIds)),
        ).toEqual([]);
      }
    }, 240_000);
    it("intention A + cookie B rejects read and valid write without revealing B or changing either world", async () => {
      const scope = await mark(a!);
      const before = await snapshot();
      for (const response of [
        await call(b!.ownerCookie, "orders", scope),
        await call(b!.ownerCookie, "orders", scope, {
          createRequestId: randomUUID(),
          saleType: "pickup",
          orderLabel: "must-not-exist",
          tableId: null,
          locationId: b!.seed.locationId,
          items: [],
        }),
      ]) {
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({
          code: "backoffice_context_changed",
          error: "Tu sesión cambió. Actualiza el panel para continuar.",
        });
      }
      expect(await snapshot()).toEqual(before);
    }, 60_000);
    it("matching scope preserves reads and permits a real write; missing scope is rejected", async () => {
      const scope = await mark(a!);
      const missing = await call(a!.ownerCookie, "orders");
      expect(missing.status).toBe(409);
      expect((await missing.json()).code).toBe("backoffice_context_changed");
      {
        const response = await call(a!.ownerCookie, "orders", scope);
        expect(response.status).toBe(200);
        const json = await response.json();
        expect(
          json.open.some(
            (order: { orderLabel: string }) =>
              order.orderLabel === "CP1a-A-private",
          ),
        ).toBe(true);
        expect(JSON.stringify(json)).not.toContain("CP1a-B-private");
      }
      const response = await call(a!.ownerCookie, "orders", scope, {
        createRequestId: randomUUID(),
        saleType: "pickup",
        orderLabel: "CP1a-positive",
        tableId: null,
        locationId: a!.seed.locationId,
        items: [],
      });
      expect(response.status).toBe(201);
      const order = await response.json();
      expect(
        await getDb()
          .select({ businessId: posOrders.businessId })
          .from(posOrders)
          .where(eq(posOrders.id, order.id)),
      ).toEqual([{ businessId: a!.seed.business.id }]);
    }, 60_000);
    it("native permission and owner denials precede scope, and malformed headers fail before domain", async () => {
      const staff = await posStaff(b!, ["counter"]);
      const denied = await call(staff.cookie, "orders", await mark(a!));
      expect(denied.status).toBe(403);
      expect((await denied.json()).code).toBe("missing_permission");
      const owner = await call(staff.cookie, "ticket-settings", "bad");
      expect(owner.status).toBe(403);
      expect((await owner.json()).code).toBe("not_owner");
      const before = await snapshot();
      for (const header of ["", "bad", "A".repeat(64)])
        expect((await call(a!.ownerCookie, "orders", header)).status).toBe(409);
      expect(await snapshot()).toEqual(before);
    }, 60_000);
  },
);
