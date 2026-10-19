import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { getDb } from "@mi-pasaporte/db";
import { paymentMethods, sessions, users } from "@mi-pasaporte/db/schema";
import { dispatchModuleRequest } from "../../dispatch";
import { requireModule, requireModuleAccess } from "../../guard";
import * as legacy from "./orders";
import * as measured from "./measured-void";
import { createPosOrderV2 } from "./measured-create";
import { closeMeasuredPosOrder } from "./measured-close";
import { getPosOrderV2 } from "./read";
import {
  dropPosWorld,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
  setPosModule,
  type PosWorld,
} from "./pos-integration-support";

// Explicit dispatcher/guard harness; this does not certify native Next authentication.
vi.mock("../../guard", async (original) => ({
  ...(await original<typeof import("../../guard")>()),
  requireModuleAccess: vi.fn(),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));

const worlds: PosWorld[] = [];
let a: PosWorld, b: PosWorld, productId: string;
function request(
  id: string,
  body?: string,
  contract: string | null = "2",
  identity = "a",
  scope?: string,
) {
  return new Request(`http://localhost/api/modules/pos/orders/${id}/void`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Test-Identity": identity,
      ...(contract === null ? {} : { "X-Pos-Contract": contract }),
      ...(scope === undefined ? {} : { "X-Backoffice-Scope": scope }),
    },
    ...(body === undefined ? {} : { body }),
  });
}
async function call(req: Request, id: string, status = 200) {
  const response = await dispatchModuleRequest("POST", req, {
    moduleId: "pos",
    path: ["orders", id, "void"],
  });
  const payload = await response.json();
  expect(response.status, JSON.stringify(payload)).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return payload;
}
async function open() {
  return createPosOrderV2(a.seed.business, a.seed.userId, {
    createRequestId: randomUUID(),
    saleType: "pickup",
    orderLabel: "HTTP frozen void",
    locationId: a.seed.locationId,
    tableId: null,
    note: "Frozen note",
    items: [
      {
        productId,
        quantity: "2",
        quantityUnit: "unit",
        catalogRevision: "1",
      },
    ],
  });
}
async function state() {
  return (
    await getDb().execute(sql`
    select
      (select jsonb_agg(to_jsonb(p) order by p.id) from pos.pos_order p where business_id in (${a.seed.business.id}::uuid, ${b.seed.business.id}::uuid)) as preparations,
      (select jsonb_agg(to_jsonb(i) order by i.id) from pos.pos_order_item i join pos.pos_order p on p.id=i.pos_order_id where p.business_id=${a.seed.business.id}::uuid) as lines,
      (select jsonb_agg(to_jsonb(p) order by p.id) from pos.order_payment p where business_id=${a.seed.business.id}::uuid) as payments,
      (select jsonb_agg(to_jsonb(o) order by o.id) from core."order" o where business_id=${a.seed.business.id}::uuid) as sales,
      (select jsonb_agg(to_jsonb(e) order by e.id) from core.module_event e where business_id=${a.seed.business.id}::uuid) as events,
      (select jsonb_agg(to_jsonb(d) order by d.event_id,d.subscriber_id) from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.business_id=${a.seed.business.id}::uuid) as deliveries
  `)
  ).rows[0];
}
async function cleanup() {
  vi.restoreAllMocks();
  const owners = worlds.map((w) => w.seed.userId);
  for (const world of worlds) {
    await dropPosWorld(world);
    expect(
      (
        await getDb().execute(
          sql`select id from core.business where id=${world.seed.business.id}::uuid union all select business_id from core.business_membership where business_id=${world.seed.business.id}::uuid`,
        )
      ).rows,
    ).toEqual([]);
  }
  if (owners.length) {
    await getDb().delete(users).where(inArray(users.id, owners));
    expect(
      await getDb()
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, owners)),
    ).toEqual([]);
    expect(
      await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(inArray(sessions.userId, owners)),
    ).toEqual([]);
  }
  worlds.length = 0;
}

describe.skipIf(!posIntegrationEnabled)(
  "0242 void HTTP V2 assembly",
  { timeout: 120000 },
  () => {
    beforeAll(async () => {
      try {
        a = await seedPosWorld("void HTTP A");
        worlds.push(a);
        b = await seedPosWorld("void HTTP B");
        worlds.push(b);
        productId = await seedProduct(a, "HTTP frozen product", "3.25");
        vi.mocked(requireModuleAccess).mockImplementation(
          async (req, moduleId, permission) => {
            expect(moduleId).toBe("pos");
            expect(permission).toBe("pos");
            const identity = req.headers.get("X-Test-Identity");
            if (identity === "anonymous" || identity === "denied")
              return {
                response: NextResponse.json(
                  {
                    code:
                      identity === "anonymous"
                        ? "unauthorized"
                        : "missing_permission",
                  },
                  { status: identity === "anonymous" ? 401 : 403 },
                ),
              };
            const world = identity === "b" ? b : a;
            await requireModule(world.seed.business.id, moduleId);
            return { business: world.seed.business, userId: world.seed.userId };
          },
        );
      } catch (error) {
        await cleanup();
        throw error;
      }
    }, 240000);
    afterAll(cleanup, 240000);

    it("guard/scope precede negotiation, and unknown contract never consumes body or calls domain", async () => {
      const order = await open();
      const before = await state();
      const legacySpy = vi.spyOn(legacy, "voidPosOrder");
      const measuredSpy = vi.spyOn(measured, "voidMeasuredPosOrder");
      try {
        for (const [identity, scope, status, code] of [
          ["anonymous", undefined, 401, "unauthorized"],
          ["denied", undefined, 403, "missing_permission"],
          ["a", "stale-scope", 409, "backoffice_context_changed"],
          ["a", undefined, 409, "pos_client_upgrade_required"],
        ] as const) {
          const req = request(order.id, "{", "99", identity, scope);
          const json = vi.spyOn(req, "json");
          expect((await call(req, order.id, status)).code).toBe(code);
          expect(json).not.toHaveBeenCalled();
          expect(req.bodyUsed).toBe(false);
        }
        await setPosModule(a.seed.business.id, false);
        try {
          const req = request(order.id, "{", "99");
          expect((await call(req, order.id, 403)).code).toBe("module_disabled");
          expect(req.bodyUsed).toBe(false);
        } finally {
          await setPosModule(a.seed.business.id, true);
        }
        expect(legacySpy).not.toHaveBeenCalled();
        expect(measuredSpy).not.toHaveBeenCalled();
        expect(await state()).toEqual(before);
      } finally {
        legacySpy.mockRestore();
        measuredSpy.mockRestore();
      }
    });

    it("V2 optional body and version return canonical frozen DTO, with one event on replay", async () => {
      const legacySpy = vi.spyOn(legacy, "voidPosOrder");
      try {
        for (const body of [undefined, "{}", '{"version":1}']) {
          const order = await open();
          const req = request(order.id, body);
          expect(req.body === null).toBe(body === undefined);
          const json = vi.spyOn(req, "json");
          const voided = await call(req, order.id);
          expect(json).toHaveBeenCalledTimes(body === undefined ? 0 : 1);
          expect(voided).toEqual(
            await getPosOrderV2(a.seed.business.id, order.id),
          );
          expect(voided).toMatchObject({
            contractVersion: 2,
            status: "voided",
            saleType: "pickup",
            orderLabel: "HTTP frozen void",
            note: "Frozen note",
            total: "6.50",
            items: [
              {
                quantity: "2",
                unitPrice: "3.25",
                lineTotal: "6.50",
                measure: { kind: "unit" },
              },
            ],
          });
          expect(voided.items[0].lineId).toBe(order.items[0].lineId);
          const beforeReplay = await state();
          expect(
            await call(request(order.id, '{"version":99}'), order.id),
          ).toEqual(voided);
          expect(await state()).toEqual(beforeReplay);
          expect(
            (
              await getDb().execute(
                sql`select event_version from core.module_event where source_id=${order.id}::uuid and event_type='pos.order.voided'`,
              )
            ).rows,
          ).toEqual([{ event_version: 2 }]);
        }
        expect(legacySpy).not.toHaveBeenCalled();
      } finally {
        legacySpy.mockRestore();
      }
    });

    it("absent/1 keep legacy writer/DTO and ignore even malformed bodies", async () => {
      const measuredSpy = vi.spyOn(measured, "voidMeasuredPosOrder");
      try {
        for (const contract of [null, "1"]) {
          const order = await open();
          const req = request(order.id, "{", contract);
          const voided = await call(req, order.id);
          expect(req.bodyUsed).toBe(false);
          expect(voided).toMatchObject({
            id: order.id,
            status: "voided",
            tableLabel: "HTTP frozen void",
            total: "6.50",
            items: [{ quantity: 2, unitPrice: "3.25" }],
          });
          expect(voided).not.toHaveProperty("contractVersion");
        }
        expect(measuredSpy).not.toHaveBeenCalled();
      } finally {
        measuredSpy.mockRestore();
      }
    });

    it("rejects present invalid JSON/shape/version, stale version, invalid UUID and foreign tenant without effects", async () => {
      const order = await open();
      const before = await state();
      for (const body of ["", " ", "{", "null", "[]", "1"]) {
        expect((await call(request(order.id, body), order.id, 400)).code).toBe(
          "invalid_body",
        );
      }
      for (const version of [null, 0, -1, 1.5, "1", 2147483648]) {
        expect(
          (
            await call(
              request(order.id, JSON.stringify({ version })),
              order.id,
              422,
            )
          ).code,
        ).toBe("invalid_input");
      }
      const stale = await call(
        request(order.id, '{"version":2}'),
        order.id,
        409,
      );
      expect(stale.code).toBe("version_conflict");
      expect(stale.order).toEqual(order);
      const foreign = await call(
        request(order.id, undefined, "2", "b"),
        order.id,
        404,
      );
      expect(foreign.code).toBe("unknown_pos_order");
      expect(foreign).not.toHaveProperty("order");
      const invalid = request("invalid-id", "{");
      expect((await call(invalid, "invalid-id", 422)).code).toBe(
        "invalid_input",
      );
      expect(invalid.bodyUsed).toBe(false);
      expect(await state()).toEqual(before);
    });

    it("closed preparation rejects void without changing payments or sale", async () => {
      const order = await open();
      const { paymentMethods } = await import("@mi-pasaporte/db/schema");
      const methods = await getDb().select().from(paymentMethods);
      const cash = methods.find(
        (m) => m.businessId === a.seed.business.id && m.isCash,
      )!;
      await closeMeasuredPosOrder(a.seed.business, a.seed.userId, order.id, {
        clientRequestId: randomUUID(),
        version: order.version,
        payments: [{ methodId: cash.id, amount: "6.50" }],
      });
      const before = await state();
      expect((await call(request(order.id), order.id, 409)).code).toBe(
        "not_open",
      );
      expect(await state()).toEqual(before);
    });
  },
);
