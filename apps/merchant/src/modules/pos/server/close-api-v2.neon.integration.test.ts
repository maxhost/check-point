import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextResponse, after } from "next/server";
import { getDb } from "@mi-pasaporte/db";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import {
  consumerAccounts,
  paymentMethods,
  sessions,
  users,
} from "@mi-pasaporte/db/schema";
import { seedConsumer } from "../../../server/counter-integration-support";
import { afterGrant } from "../../../server/counter/after-grant";
import { dispatchModuleRequest } from "../../dispatch";
import { requireModule, requireModuleAccess } from "../../guard";
import * as legacy from "./close";
import * as measured from "./measured-close";
import { createPosOrderV2 } from "./measured-create";
import { resolveMeasuredScan } from "./measured-resolve";
import { getPosOrderV2 } from "./read";
import {
  dropPosWorld,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
  setPosModule,
  type PosWorld,
} from "./pos-integration-support";

// Explicit dispatcher/guard harness: native Next authentication is not certified here.
// Preserve real module locks, scope validation, handlers and transactional domain code.
vi.mock("../../guard", async (original) => ({
  ...(await original<typeof import("../../guard")>()),
  requireModuleAccess: vi.fn(),
}));
vi.mock("../../../server/counter/after-grant", () => ({ afterGrant: vi.fn() }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: vi.fn(),
}));

const worlds: PosWorld[] = [];
const consumers: string[] = [];
let a: PosWorld, b: PosWorld, productId: string, cash: string;
function request(
  id: string,
  value: unknown,
  contract: string | null = "2",
  identity = "a",
  scope?: string,
) {
  return new Request(`http://localhost/api/modules/pos/orders/${id}/close`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Test-Identity": identity,
      ...(contract === null ? {} : { "X-Pos-Contract": contract }),
      ...(scope === undefined ? {} : { "X-Backoffice-Scope": scope }),
    },
    body: value === "malformed" ? "{" : JSON.stringify(value),
  });
}
async function call(req: Request, id: string, status = 200) {
  const response = await dispatchModuleRequest("POST", req, {
    moduleId: "pos",
    path: ["orders", id, "close"],
  });
  const payload = await response.json();
  expect(response.status, JSON.stringify(payload)).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return payload;
}
async function open(world = a) {
  return createPosOrderV2(world.seed.business, world.seed.userId, {
    createRequestId: randomUUID(),
    saleType: "pickup",
    orderLabel: "HTTP exact unit",
    locationId: world.seed.locationId,
    tableId: null,
    note: "Frozen HTTP note",
    items: [
      {
        productId: world === a ? productId : world.cafe,
        quantity: "2",
        quantityUnit: "unit",
        catalogRevision: "1",
      },
    ],
  });
}
function command(version = 1) {
  return {
    clientRequestId: randomUUID(),
    version,
    payments: [{ methodId: cash, amount: "6.50" }],
  };
}
async function state() {
  return (
    await getDb().execute(sql`
    select
      (select jsonb_agg(to_jsonb(p) order by p.id) from pos.pos_order p where business_id in (${a.seed.business.id}::uuid, ${b.seed.business.id}::uuid)) as preparations,
      (select jsonb_agg(to_jsonb(p) order by p.id) from pos.order_payment p where business_id=${a.seed.business.id}::uuid) as payments,
      (select jsonb_agg(to_jsonb(o) order by o.id) from core."order" o where business_id=${a.seed.business.id}::uuid) as sales,
      (select jsonb_agg(to_jsonb(e) order by e.id) from core.module_event e where business_id=${a.seed.business.id}::uuid) as events,
      (select jsonb_agg(to_jsonb(d) order by d.event_id,d.subscriber_id) from core.module_event_delivery d join core.module_event e on e.id=d.event_id where e.business_id=${a.seed.business.id}::uuid) as deliveries,
      (select jsonb_agg(to_jsonb(c) order by c.consumer_id) from core.business_customer c where business_id=${a.seed.business.id}::uuid) as customers,
      (select jsonb_agg(to_jsonb(m) order by m.id) from consumer.program_membership m where business_id=${a.seed.business.id}::uuid) as memberships,
      (select jsonb_agg(to_jsonb(c) order by c.id) from core.sale_commission c where business_id=${a.seed.business.id}::uuid) as commissions,
      (select jsonb_agg(to_jsonb(q) order by q.id) from consumer.wallet_push_queue q where consumer_id in (select consumer_id from consumer.program_membership where business_id=${a.seed.business.id}::uuid)) as pushes
  `)
  ).rows[0];
}
async function cleanup() {
  vi.restoreAllMocks();
  const ownerIds = worlds.map((w) => w.seed.userId);
  for (const w of worlds) {
    await dropPosWorld(w);
    expect(
      (
        await getDb().execute(
          sql`select id from core.business where id=${w.seed.business.id}::uuid union all select business_id from core.business_membership where business_id=${w.seed.business.id}::uuid`,
        )
      ).rows,
    ).toEqual([]);
  }
  if (consumers.length) {
    await getDb()
      .delete(consumerAccounts)
      .where(inArray(consumerAccounts.id, consumers));
    for (const id of consumers)
      expect(
        (
          await getDb().execute(
            sql`select id from consumer.consumer_account where id=${id}::uuid union all select id from consumer.program_membership where consumer_id=${id}::uuid union all select id from consumer.wallet_push_queue where consumer_id=${id}::uuid union all select consumer_id from core.business_customer where consumer_id=${id}::uuid`,
          )
        ).rows,
      ).toEqual([]);
  }
  if (ownerIds.length) {
    await getDb().delete(users).where(inArray(users.id, ownerIds));
    expect(
      await getDb()
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, ownerIds)),
    ).toEqual([]);
    expect(
      await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(inArray(sessions.userId, ownerIds)),
    ).toEqual([]);
  }
  worlds.length = 0;
  consumers.length = 0;
}

describe.skipIf(!posIntegrationEnabled)(
  "0242 close HTTP V2 assembly",
  { timeout: 120000 },
  () => {
    beforeAll(async () => {
      try {
        a = await seedPosWorld("close HTTP A");
        worlds.push(a);
        b = await seedPosWorld("close HTTP B");
        worlds.push(b);
        productId = await seedProduct(a, "HTTP frozen product", "3.25");
        cash = (
          await getDb()
            .select()
            .from(paymentMethods)
            .where(
              and(
                eq(paymentMethods.businessId, a.seed.business.id),
                eq(paymentMethods.isCash, true),
              ),
            )
        )[0].id;
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

    it("negotiates before body/domain, with guard and scope first and no effects", async () => {
      const order = await open();
      const before = await state();
      const legacySpy = vi.spyOn(legacy, "closePosOrder");
      const measuredSpy = vi.spyOn(measured, "closeMeasuredPosOrder");
      try {
        for (const [identity, scope, status, code] of [
          ["anonymous", undefined, 401, "unauthorized"],
          ["denied", undefined, 403, "missing_permission"],
          ["a", "stale-scope", 409, "backoffice_context_changed"],
          ["a", undefined, 409, "pos_client_upgrade_required"],
        ] as const) {
          const req = request(order.id, "malformed", "99", identity, scope);
          const json = vi.spyOn(req, "json");
          expect((await call(req, order.id, status)).code).toBe(code);
          expect(json).not.toHaveBeenCalled();
        }
        await setPosModule(a.seed.business.id, false);
        try {
          const req = request(order.id, "malformed", "99");
          const json = vi.spyOn(req, "json");
          expect((await call(req, order.id, 403)).code).toBe("module_disabled");
          expect(json).not.toHaveBeenCalled();
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

    it("header2 returns canonical DTO2 and replay preserves one accreditation/event/payment/after", async () => {
      const consumer = await seedConsumer();
      consumers.push(consumer.id);
      const resolved = await resolveMeasuredScan(
        a.seed.business,
        consumer.qrToken,
      );
      const order = await open();
      const raw = {
        ...command(),
        membershipId: resolved.membership.id,
        coupon: null,
      };
      const grants = vi.mocked(afterGrant).mock.calls.length;
      const legacySpy = vi.spyOn(legacy, "closePosOrder");
      try {
        const closed = await call(request(order.id, raw), order.id);
        expect(closed).toEqual(
          await getPosOrderV2(a.seed.business.id, order.id),
        );
        expect(closed).toMatchObject({
          contractVersion: 2,
          status: "closed",
          total: "6.50",
          orderLabel: "HTTP exact unit",
          items: [{ quantity: "2", unitPrice: "3.25", lineTotal: "6.50" }],
          sale: { total: "6.50" },
          settlement: {
            payments: [
              {
                amount: "6.50",
                originalAmount: {
                  numerator: "650",
                  denominator: "1",
                  scale: 2,
                },
              },
            ],
          },
        });
        expect(closed.closedAt).toBeTruthy();
        expect(closed.items[0].lineId).toBe(order.items[0].lineId);
        expect(vi.mocked(afterGrant).mock.calls.length).toBe(grants + 1);
        const scheduled = vi.mocked(after).mock.calls.length;
        const beforeReplay = await state();
        expect(await call(request(order.id, raw), order.id)).toEqual(closed);
        expect(await state()).toEqual(beforeReplay);
        expect(vi.mocked(afterGrant).mock.calls.length).toBe(grants + 1);
        expect(vi.mocked(after).mock.calls.length).toBe(scheduled);
        expect(legacySpy).not.toHaveBeenCalled();
        expect(
          (
            await getDb().execute(
              sql`select id from core."order" where business_id=${a.seed.business.id}::uuid and consumer_id=${consumer.id}::uuid`,
            )
          ).rows,
        ).toHaveLength(1);
        expect(
          (
            await getDb().execute(
              sql`select id,event_version from core.module_event where source_id=${order.id}::uuid and event_type='sale.closed'`,
            )
          ).rows,
        ).toEqual([{ id: expect.any(String), event_version: 4 }]);
        expect(
          (
            await getDb().execute(
              sql`select id from pos.order_payment where pos_order_id=${order.id}::uuid`,
            )
          ).rows,
        ).toHaveLength(1);
      } finally {
        legacySpy.mockRestore();
      }
    });

    it("absent and explicit1 retain legacy DTO and writer on own compatible orders", async () => {
      const measuredSpy = vi.spyOn(measured, "closeMeasuredPosOrder");
      try {
        for (const contract of [null, "1"]) {
          const order = await open();
          const closed = await call(
            request(order.id, command(), contract),
            order.id,
          );
          expect(closed).toMatchObject({
            id: order.id,
            status: "closed",
            tableLabel: "HTTP exact unit",
            total: "6.50",
            items: [{ quantity: 2, unitPrice: "3.25" }],
          });
          expect(closed).not.toHaveProperty("contractVersion");
        }
        expect(measuredSpy).not.toHaveBeenCalled();
      } finally {
        measuredSpy.mockRestore();
      }
    });

    it("tenant isolation, financial422 and stale409 preserve exact authorized DTO2 without effects", async () => {
      const order = await open();
      const before = await state();
      const unknown = await call(
        request(order.id, command(), "2", "b"),
        order.id,
        404,
      );
      expect(unknown.code).toBe("unknown_pos_order");
      expect(unknown).not.toHaveProperty("order");
      const stale = await call(request(order.id, command(2)), order.id, 409);
      expect(stale.code).toBe("version_conflict");
      expect(stale.order).toEqual(order);
      expect(stale.order.items[0]).toMatchObject({
        quantity: "2",
        unitPrice: "3.25",
        lineTotal: "6.50",
      });
      const invalid = await call(
        request(order.id, {
          ...command(),
          payments: [{ methodId: cash, amount: "6.00" }],
        }),
        order.id,
        422,
      );
      expect(invalid).toEqual({
        code: "payment_sum_mismatch",
        error:
          "El importe cambió o los pagos no coinciden. Revisa el cobro y vuelve a confirmar.",
        settlement: buildFinancialAmountsFromSnapshots({
          currencyCode: "USD",
          discount: null,
          lines: order.items.map((line, position) => ({
            sourceLineId: line.lineId,
            position,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            measure: line.measure,
          })),
        }),
      });
      expect(await state()).toEqual(before);
    });
  },
);
