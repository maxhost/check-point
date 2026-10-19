import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import * as database from "@mi-pasaporte/db";
import {
  businesses,
  diningTables,
  locations,
  orders,
  posOrderItems,
  posOrders,
  products,
  sessions,
  users,
} from "@mi-pasaporte/db/schema";
import { lockBusiness } from "@mi-pasaporte/domain/server/catalog/measured-contract";
import { dispatchModuleRequest } from "../../dispatch";
import { backofficeScopeKey } from "../../../server/backoffice-scope";
import { getBackofficeRequestContext } from "../../../server/backoffice-context";
import { closeWithCash } from "./pos-payment-integration-support";
import {
  dropPosWorld,
  capturePosScope,
  scopedPos,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  seedProduct,
  setModuleRow,
  type PosWorld,
} from "./pos-integration-support";

const scopes = new Map<string, string>();
let a: PosWorld, b: PosWorld;
let allowed: string, denied: string, scope: string;
function command(overrides: Record<string, unknown> = {}) {
  return {
    createRequestId: randomUUID(),
    saleType: "pickup",
    orderLabel: "Pedido",
    locationId: a.seed.locationId,
    tableId: null,
    note: null,
    items: [
      {
        productId: a.cafe,
        quantity: "2",
        quantityUnit: "unit",
        catalogRevision: "1",
      },
    ],
    ...overrides,
  };
}
function request(
  value: unknown,
  cookie = a.ownerCookie,
  contract: string | null = "2",
  scopeKey?: string,
) {
  return new Request("http://localhost:3001/api/modules/pos/orders", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      ...(contract === null ? {} : { "X-Pos-Contract": contract }),
      ...(scopeKey === undefined ? {} : { "X-Backoffice-Scope": scopeKey }),
    },
    body: JSON.stringify(value),
  });
}
async function call(
  value: unknown,
  cookie = a.ownerCookie,
  contract: string | null = "2",
  scopeKey?: string | null,
) {
  const response = await dispatchModuleRequest(
    "POST",
    request(
      value,
      cookie,
      contract,
      scopeKey === undefined ? scopes.get(cookie) : (scopeKey ?? undefined),
    ),
    { moduleId: "pos", path: ["orders"] },
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response;
}
async function body(response: Response, status = 201) {
  const value = await response.json();
  expect(response.status, JSON.stringify(value)).toBe(status);
  return value;
}
const rows = () =>
  getDb()
    .select()
    .from(posOrders)
    .where(eq(posOrders.businessId, a.seed.business.id));
const lines = (id: string) =>
  getDb().select().from(posOrderItems).where(eq(posOrderItems.posOrderId, id));

describe.skipIf(!posIntegrationEnabled)(
  "0242 CP2b creation V2 guarded transactions",
  { timeout: 60000 },
  () => {
    beforeAll(async () => {
      a = await seedPosWorld("CP2b create A");
      b = await seedPosWorld("CP2b create B");
      allowed = (await posStaff(a, ["pos"])).cookie;
      denied = (await posStaff(a, ["business"])).cookie;
      const session = await getBackofficeRequestContext(
        request({}),
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
      for (const world of worlds) await dropPosWorld(world);
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
      expect(
        await getDb()
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, ids)),
      ).toEqual([]);
      expect(
        await getDb()
          .select({ id: sessions.id })
          .from(sessions)
          .where(inArray(sessions.userId, ids)),
      ).toEqual([]);
    }, 240000);
    it("guard/scope precede invalid contract/body; denied calls have no writes", async () => {
      const before = await rows();
      expect((await call({}, "", "99")).status).toBe(401);
      expect((await call({}, denied, "99")).status).toBe(403);
      expect(
        (await body(await call({}, b.ownerCookie, "99", scope), 409)).code,
      ).toBe("backoffice_context_changed");
      expect(
        (await body(await call({}, a.ownerCookie, "99", scope), 409)).code,
      ).toBe("pos_client_upgrade_required");
      expect(
        (await body(await call(command(), a.ownerCookie, "2", null), 409)).code,
      ).toBe("backoffice_context_changed");
      expect(await rows()).toEqual(before);
      expect((await body(await call(command(), allowed))).contractVersion).toBe(
        2,
      );
    });
    it("serial/concurrent identical intentions keep exactly one order and individual lines", async () => {
      const value = command();
      value.items.push({ ...value.items[0], quantity: "1" });
      const [first, second] = await Promise.all([
        body(await call(value)),
        body(await call(value)),
      ]);
      expect(second).toEqual(first);
      expect(await body(await call(value))).toEqual(first);
      expect(first.items).toHaveLength(2);
      expect(
        new Set(first.items.map((line: { lineId: string }) => line.lineId))
          .size,
      ).toBe(2);
      expect(await lines(first.id)).toHaveLength(2);
      expect(
        (await rows()).filter(
          (row) => row.createRequestId === value.createRequestId,
        ),
      ).toHaveLength(1);
      const before = await lines(first.id);
      expect(
        (await body(await call({ ...value, note: "Cambio" }), 409)).code,
      ).toBe("create_request_reused");
      expect(await lines(first.id)).toEqual(before);
      expect(
        (await body(await call({ ...value, createRequestId: randomUUID() })))
          .id,
      ).not.toBe(first.id);
      expect(
        (
          await body(
            await call(
              {
                ...value,
                locationId: b.seed.locationId,
                items: [{ ...value.items[0], productId: b.cafe }],
              },
              b.ownerCookie,
            ),
          )
        ).id,
      ).not.toBe(first.id);
    });
    it("actual simultaneous POSTs serialize the same intent", async () => {
      const value = command();
      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          call(value).then((response) => body(response)),
        ),
      );
      expect(new Set(results.map((result) => result.id)).size).toBe(1);
      expect(
        results.every(
          (result) => JSON.stringify(result) === JSON.stringify(results[0]),
        ),
      ).toBe(true);
      expect(await lines(results[0].id)).toHaveLength(1);
    });
    it("replay returns current edited, closed and voided resources without mutations", async () => {
      const value = command();
      const created = await body(await call(value));
      const updated = await body(
        await scopedPos(a.ownerCookie, scopes.get(a.ownerCookie)!).update(
          created.id,
          {
            version: 1,
            saleType: created.saleType,
            orderLabel: "Editado",
            tableId: null,
            note: created.note,
            locationId: a.seed.locationId,
            items: created.items.map(
              (line: { lineId: string; productId: string }) => ({
                lineId: line.lineId,
                productId: line.productId,
                quantity: "3",
                quantityUnit: "unit",
              }),
            ),
          },
        ),
        200,
      );
      const edited = await body(await call(value));
      expect(edited.version).toBe(updated.version);
      expect(edited.items[0].quantity).toBe("3");
      const closed = await body(
        await closeWithCash(
          a.ownerCookie,
          created.id,
          {
            version: updated.version,
            clientRequestId: randomUUID(),
          },
          { scope: scopes.get(a.ownerCookie)! },
        ),
        200,
      );
      const before = await lines(created.id);
      const replay = await body(await call(value));
      expect(replay.id).toBe(closed.id);
      expect(replay.status).toBe("closed");
      expect(await lines(created.id)).toEqual(before);
      const voidValue = command();
      const open = await body(await call(voidValue));
      await body(
        await scopedPos(a.ownerCookie, scopes.get(a.ownerCookie)!).void(
          open.id,
        ),
        200,
      );
      expect((await body(await call(voidValue))).status).toBe("voided");
    });
    it("all sale types, empty items, zero tariff and V1 rejection preserve the cutover contract", async () => {
      for (const saleType of ["pickup", "delivery", "table", "counter"]) {
        const value = command({ saleType, items: [], locationId: null });
        const created = await body(await call(value));
        expect(created.saleType).toBe(saleType);
        expect(created.items).toEqual([]);
        expect(created.total).toBe("0.00");
        expect(created.orderLabel.length).toBeGreaterThan(0);
        expect(await body(await call(value))).toEqual(created);
      }
      const free = await seedProduct(a, "Gratis", "0.00");
      const created = await body(
        await call(
          command({
            items: [
              {
                productId: free,
                quantity: "1",
                quantityUnit: "unit",
                catalogRevision: "1",
              },
            ],
          }),
        ),
      );
      expect(created.total).toBe("0.00");
      const beforeLegacy = await rows();
      for (const contract of [null, "1"]) {
        const legacy = await body(
          await call(
            {
              tableLabel: "Legacy",
              locationId: a.seed.locationId,
              items: [{ productId: a.cafe, quantity: 1 }],
            },
            a.ownerCookie,
            contract,
          ),
          409,
        );
        expect(legacy.code).toBe("pos_client_upgrade_required");
        expect(await rows()).toEqual(beforeLegacy);
      }
    });
    it("captures valid legacy-wide unit tariffs with strict new quantities", async () => {
      const productId = await seedProduct(
        a,
        "Tarifa histórica",
        "1000000000.00",
      );
      const created = await body(
        await call(
          command({
            items: [
              {
                productId,
                quantity: "1",
                quantityUnit: "unit",
                catalogRevision: "1",
              },
            ],
          }),
        ),
      );
      expect(created.items[0].unitPrice).toBe("1000000000");
      expect(
        (
          await call(
            command({
              items: [
                {
                  productId,
                  quantity: "1000000000",
                  quantityUnit: "unit",
                  catalogRevision: "1",
                },
              ],
            }),
          )
        ).status,
      ).toBe(422);
    });
    it("real table is authoritative and replay survives catalog/local/table archival", async () => {
      await setModuleRow(a.seed.business.id, "tables", true);
      const [table] = await getDb()
        .insert(diningTables)
        .values({
          businessId: a.seed.business.id,
          locationId: a.seed.locationId,
          name: "Mesa real",
        })
        .returning();
      const value = command({
        saleType: "table",
        tableId: table.id,
        locationId: null,
        orderLabel: "Ignorado",
      });
      const created = await body(await call(value));
      expect(created.orderLabel).toBe("Mesa real");
      expect(created.location.id).toBe(a.seed.locationId);
      expect(
        (
          await body(
            await call({ ...value, createRequestId: randomUUID() }),
            409,
          )
        ).code,
      ).toBe("table_occupied");
      await getDb()
        .update(diningTables)
        .set({ status: "archived" })
        .where(eq(diningTables.id, table.id));
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, a.seed.locationId));
      await getDb()
        .update(products)
        .set({ unitPrice: "9.00", salesRevision: 2 })
        .where(eq(products.id, a.cafe));
      expect(await body(await call(value))).toEqual(created);
      await getDb()
        .update(locations)
        .set({ status: "active" })
        .where(eq(locations.id, a.seed.locationId));
      await getDb()
        .update(products)
        .set({ unitPrice: created.items[0].unitPrice, salesRevision: 1 })
        .where(eq(products.id, a.cafe));
      await setModuleRow(a.seed.business.id, "tables", false);
      expect(
        (
          await body(
            await call({ ...value, createRequestId: randomUUID() }),
            422,
          )
        ).code,
      ).toBe("tables_disabled");
    });
    it("rejects tenant/local/table failures and a stale final line with no partial writes", async () => {
      const noPrice = await seedProduct(a, "Sin tarifa", null);
      const unavailable = await seedProduct(a, "No local", "1.00");
      await getDb()
        .update(products)
        .set({ availableAllLocations: false })
        .where(eq(products.id, unavailable));
      const before = await rows();
      for (const productId of [b.cafe, noPrice, unavailable, randomUUID()]) {
        expect(
          (
            await body(
              await call(
                command({
                  items: [
                    {
                      productId,
                      quantity: "1",
                      quantityUnit: "unit",
                      catalogRevision: "1",
                    },
                  ],
                }),
              ),
              422,
            )
          ).code,
        ).toBe("unknown_product");
      }
      const stale = command();
      stale.items.push({ ...stale.items[0], catalogRevision: "2" });
      const conflict = await body(await call(stale), 409);
      expect(conflict.code).toBe("catalog_changed");
      expect(conflict).not.toHaveProperty("product");
      expect(conflict.products).toHaveLength(1);
      expect(Object.keys(conflict.products[0]).sort()).toEqual([
        "catalogRevision",
        "categoryId",
        "id",
        "imagePath",
        "name",
        "pricingUnit",
        "soldByWeight",
        "unitPrice",
      ]);
      expect(
        (
          await body(
            await call(command({ locationId: b.seed.locationId })),
            404,
          )
        ).code,
      ).toBe("location_not_found");
      await setModuleRow(a.seed.business.id, "tables", true);
      expect(
        (
          await body(
            await call(command({ saleType: "table", tableId: randomUUID() })),
            422,
          )
        ).code,
      ).toBe("unknown_table");
      expect(await rows()).toEqual(before);
    });
    it("new preparation creates no core orders or financial/event/consumption effects", async () => {
      const inspect = async () => {
        const core = await getDb()
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.businessId, a.seed.business.id));
        const effects = await getDb().execute(
          sql`select (select count(*) from core.module_event where business_id=${a.seed.business.id})::int as events,
            (select count(*) from pos.order_payment where business_id=${a.seed.business.id})::int as payments,
            (select count(*) from recipes.consumption_source where business_id=${a.seed.business.id})::int as consumption,
            (select count(*) from stock.movement where business_id=${a.seed.business.id})::int as movements`,
        );
        return { core, effects: effects.rows };
      };
      const before = await inspect();
      await body(await call(command()));
      expect(await inspect()).toEqual(before);
    });
    it("rolls back an injected SQL failure after a real header and first line INSERT", async () => {
      const value = command();
      value.items.push({ ...value.items[0], quantity: "1" });
      const before = await rows();
      let insertedLine: string | undefined;
      let headerSeen = false;
      const original = database.withDbTransaction;
      const injected = vi
        .spyOn(database, "withDbTransaction")
        .mockImplementation((work, options) =>
          original(
            async (tx) =>
              work(
                new Proxy(tx, {
                  get(target, property, receiver) {
                    if (property === "insert")
                      return (table: unknown) => {
                        if (table !== posOrderItems)
                          return Reflect.apply(target.insert, target, [table]);
                        return {
                          values: async (
                            values: (typeof posOrderItems.$inferInsert)[],
                          ) => {
                            const [header] = await target
                              .select({ id: posOrders.id })
                              .from(posOrders)
                              .where(
                                and(
                                  eq(posOrders.businessId, a.seed.business.id),
                                  eq(
                                    posOrders.createRequestId,
                                    value.createRequestId,
                                  ),
                                ),
                              );
                            headerSeen = Boolean(header);
                            await target
                              .insert(posOrderItems)
                              .values(values[0]);
                            insertedLine = values[0].id as string;
                            // Fault injection is real SQL on the same connection, without DDL,
                            // impossible rows or changing the production implementation.
                            await target.execute(sql`select 1 / 0`);
                          },
                        };
                      };
                    const member = Reflect.get(target, property, receiver);
                    return typeof member === "function"
                      ? member.bind(target)
                      : member;
                  },
                }),
              ),
            options,
          ),
        );
      try {
        expect((await call(value)).status).toBe(503);
      } finally {
        injected.mockRestore();
      }
      expect(headerSeen).toBe(true);
      expect(insertedLine).toBeDefined();
      expect(await rows()).toEqual(before);
      expect(
        await getDb()
          .select({ id: posOrderItems.id })
          .from(posOrderItems)
          .where(eq(posOrderItems.id, insertedLine!)),
      ).toEqual([]);
      const recovered = await body(await call(value));
      expect(recovered.items).toHaveLength(2);
      expect(await body(await call(value))).toEqual(recovered);
    });
    it("commercial lock waits deterministically and cannot mix old revision with new price", async () => {
      let release!: () => void;
      let locked!: () => void;
      const held = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const writer = withDbTransaction(async (tx) => {
        await lockBusiness(tx, a.seed.business.id);
        await tx
          .update(products)
          .set({ unitPrice: "7.00", salesRevision: 2 })
          .where(eq(products.id, a.cafe));
        locked();
        await gate;
      });
      await held;
      let completed = false;
      const pending = call(command()).finally(() => {
        completed = true;
      });
      let waiting = false;
      try {
        const deadline = Date.now() + 10000;
        while (!completed && Date.now() < deadline) {
          const result = await getDb().execute(
            sql`select count(*)::int as n from pg_locks where locktype='advisory' and not granted`,
          );
          if (Number(result.rows[0].n) > 0) {
            waiting = true;
            break;
          }
        }
      } finally {
        release();
      }
      await writer;
      expect(waiting).toBe(true);
      expect((await body(await pending, 409)).code).toBe("catalog_changed");
      const fresh = command({
        items: [
          {
            productId: a.cafe,
            quantity: "2",
            quantityUnit: "unit",
            catalogRevision: "2",
          },
        ],
      });
      const created = await body(await call(fresh));
      expect(created.items[0].unitPrice).toBe("7");
      expect(created.total).toBe("14.00");
      expect(
        await getDb()
          .select()
          .from(posOrders)
          .where(
            and(
              eq(posOrders.businessId, a.seed.business.id),
              eq(posOrders.createRequestId, fresh.createRequestId),
            ),
          ),
      ).toHaveLength(1);
    });
  },
);
