import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
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
import { dispatchModuleRequest } from "../../dispatch";
import { backofficeScopeKey } from "../../../server/backoffice-scope";
import { getBackofficeRequestContext } from "../../../server/backoffice-context";
import { closeWithCash } from "./pos-payment-integration-support";
import {
  dropPosWorld,
  pos,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  seedProduct,
  setModuleRow,
  type PosWorld,
} from "./pos-integration-support";
let a: PosWorld, b: PosWorld, denied: string, allowed: string, scope: string;
function request(
  id: string,
  value: unknown,
  cookie = a.ownerCookie,
  contract: string | null = "2",
  scopeKey?: string,
) {
  return new Request(`http://localhost:3001/api/modules/pos/orders/${id}`, {
    method: "PUT",
    headers: {
      cookie,
      "content-type": "application/json",
      ...(contract === null ? {} : { "X-Pos-Contract": contract }),
      ...(scopeKey ? { "X-Backoffice-Scope": scopeKey } : {}),
    },
    body: JSON.stringify(value),
  });
}
async function call(
  id: string,
  value: unknown,
  cookie = a.ownerCookie,
  contract: string | null = "2",
  scopeKey?: string,
) {
  const response = await dispatchModuleRequest(
    "PUT",
    request(id, value, cookie, contract, scopeKey),
    { moduleId: "pos", path: ["orders", id] },
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  return response;
}
async function body(response: Response, status = 200) {
  const value = await response.json();
  expect(response.status, JSON.stringify(value)).toBe(status);
  return value;
}
async function open(productId = a.cafe, quantity = 2) {
  return body(
    await pos.create(a.ownerCookie, {
      tableLabel: "Histórica",
      locationId: a.seed.locationId,
      items: [{ productId, quantity }],
    }),
    201,
  );
}
type ReadLine = {
  lineId: string;
  productId: string | null;
  quantity: string | number;
  name?: string;
  unitPrice?: string;
  lineTotal?: string;
  measure?: { quantityUnit: string };
};
type ReadOrder = {
  version: number;
  saleType?: string;
  orderLabel?: string;
  tableLabel?: string;
  location: { id: string } | null;
  tableId: string | null;
  note: string | null;
  items: ReadLine[];
};
function command(order: ReadOrder, overrides: Record<string, unknown> = {}) {
  return {
    version: order.version,
    saleType: order.saleType ?? "legacy",
    orderLabel: order.orderLabel ?? order.tableLabel,
    locationId: order.location?.id ?? null,
    tableId: order.tableId,
    note: order.note,
    items: order.items.map((line: ReadLine) => ({
      lineId: line.lineId,
      productId: line.productId,
      quantity: String(line.quantity),
      quantityUnit: line.measure?.quantityUnit ?? "unit",
    })),
    ...overrides,
  };
}
const lines = (id: string) =>
  getDb().select().from(posOrderItems).where(eq(posOrderItems.posOrderId, id));
const row = (id: string) =>
  getDb().select().from(posOrders).where(eq(posOrders.id, id));
describe.skipIf(!posIntegrationEnabled)(
  "0242 CP2b update V2 canonical unit transactions",
  { timeout: 60000 },
  () => {
    beforeAll(async () => {
      a = await seedPosWorld("CP2b update A");
      b = await seedPosWorld("CP2b update B");
      denied = (await posStaff(a, ["business"])).cookie;
      allowed = (await posStaff(a, ["pos"])).cookie;
      const session = await getBackofficeRequestContext(
        request(randomUUID(), {}),
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
      const ids = worlds.flatMap((w) => [w.seed.userId, ...w.extraUsers]);
      for (const world of worlds) await dropPosWorld(world);
      if (ids.length) await getDb().delete(users).where(inArray(users.id, ids));
      expect(
        await getDb()
          .select({ id: businesses.id })
          .from(businesses)
          .where(
            inArray(
              businesses.id,
              worlds.map((w) => w.seed.business.id),
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
    it("guard/scope precede contract, tenant and status stay private; V1 remains available", async () => {
      const order = await open();
      const input = command(order);
      const before = await row(order.id);
      expect((await call(order.id, {}, "", "99")).status).toBe(401);
      expect((await call(order.id, {}, denied, "99")).status).toBe(403);
      expect(
        (await body(await call(order.id, {}, b.ownerCookie, "99", scope), 409))
          .code,
      ).toBe("backoffice_context_changed");
      expect(
        (await body(await call(order.id, {}, a.ownerCookie, "99", scope), 409))
          .code,
      ).toBe("pos_client_upgrade_required");
      expect(
        (await body(await call(order.id, input, b.ownerCookie), 404)).code,
      ).toBe("unknown_pos_order");
      expect(await row(order.id)).toEqual(before);
      expect(
        (await body(await call(order.id, input, allowed))).contractVersion,
      ).toBe(2);
      const v1 = await open();
      expect(
        (
          await body(
            await call(
              v1.id,
              {
                version: v1.version,
                tableLabel: v1.tableLabel,
                items: v1.items.map((line: ReadLine) => ({
                  lineId: line.lineId,
                  productId: line.productId,
                  quantity: line.quantity,
                })),
              },
              a.ownerCookie,
              null,
            ),
          )
        ).items[0].quantity,
      ).toBe(2);
      await pos.void(a.ownerCookie, order.id);
      expect((await body(await call(order.id, input), 409)).code).toBe(
        "pos_order_not_open",
      );
      const closed = await open();
      await body(
        await closeWithCash(a.ownerCookie, closed.id, {
          version: closed.version,
          clientRequestId: randomUUID(),
        }),
      );
      expect(
        (await body(await call(closed.id, command(closed)), 409)).code,
      ).toBe("pos_order_not_open");
    });
    it("concurrent versions have one winner and conflict DTO V2 after rollback", async () => {
      const order = await open();
      const input = command(order, { note: "ganadora" });
      const responses = await Promise.all([
        call(order.id, input),
        call(order.id, input),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
      const winner = await body(responses.find((r) => r.status === 200)!);
      const conflict = await body(
        responses.find((r) => r.status === 409)!,
        409,
      );
      expect(conflict.code).toBe("version_conflict");
      expect(conflict.order).toEqual(winner);
      expect(winner.version).toBe(order.version + 1);
    });
    it("last invalid source or stale new revision rolls back all header and line changes", async () => {
      const order = await open();
      const input = command(order);
      const before = await row(order.id),
        snapshots = await lines(order.id);
      for (const invalid of [
        {
          lineId: randomUUID(),
          productId: a.cafe,
          quantity: "1",
          quantityUnit: "unit",
        },
        {
          productId: a.cafe,
          quantity: "1",
          quantityUnit: "unit",
          catalogRevision: "999",
        },
      ]) {
        const response = await call(order.id, {
          ...input,
          note: "no guardar",
          saleType: "pickup",
          orderLabel: "no guardar",
          items: [{ ...input.items[0], quantity: "3" }, invalid],
        });
        const failure = await body(response, invalid.lineId ? 422 : 409);
        if (!invalid.lineId) {
          expect(failure).not.toHaveProperty("product");
          expect(failure.products).toHaveLength(1);
          expect(Object.keys(failure.products[0]).sort()).toEqual([
            "catalogRevision",
            "categoryId",
            "id",
            "imagePath",
            "name",
            "pricingUnit",
            "soldByWeight",
            "unitPrice",
          ]);
          expect(failure.products[0]).toMatchObject({
            id: a.cafe,
            catalogRevision: "1",
            pricingUnit: "unit",
            soldByWeight: false,
          });
        }
        expect(await row(order.id)).toEqual(before);
        expect(await lines(order.id)).toEqual(snapshots);
      }
    });
    it("SQL failure after real header, removal, update and insertion rolls back the full list", async () => {
      const initial = await open();
      const initialCommand = command(initial);
      const order = await body(
        await call(initial.id, {
          ...initialCommand,
          items: [
            ...initialCommand.items,
            {
              productId: a.cafe,
              quantity: "1",
              quantityUnit: "unit",
              catalogRevision: "1",
            },
          ],
        }),
      );
      const before = await row(order.id),
        snapshots = await lines(order.id);
      let sawWrites = false;
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
                            values: typeof posOrderItems.$inferInsert,
                          ) => {
                            await target.insert(posOrderItems).values(values);
                            const [header] = await target
                              .select()
                              .from(posOrders)
                              .where(eq(posOrders.id, order.id));
                            const current = await target
                              .select()
                              .from(posOrderItems)
                              .where(eq(posOrderItems.posOrderId, order.id));
                            sawWrites =
                              header.note === "rollback SQL" &&
                              header.version === order.version + 1 &&
                              current.length === 2 &&
                              current.some(
                                (line) =>
                                  line.id === order.items[0].lineId &&
                                  BigInt(line.quantity.split(".")[0]) === 3n,
                              ) &&
                              !current.some(
                                (line) => line.id === order.items[1].lineId,
                              ) &&
                              current.some((line) => line.id === values.id);
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
        await body(
          await call(
            order.id,
            command(order, {
              note: "rollback SQL",
              saleType: "pickup",
              orderLabel: "Cambio revertido",
              items: [
                { ...command(order).items[0], quantity: "3" },
                {
                  productId: a.cafe,
                  quantity: "1",
                  quantityUnit: "unit",
                  catalogRevision: "1",
                },
              ],
            }),
          ),
          503,
        );
      } finally {
        injected.mockRestore();
      }
      expect(sawWrites).toBe(true);
      expect(await row(order.id)).toEqual(before);
      expect(await lines(order.id)).toEqual(snapshots);
    });
    it("keeps old and fresh same-product snapshots distinct, reorder/delete preserve identity", async () => {
      const product = await seedProduct(a, "Antiguo", "2.00");
      const order = await open(product);
      await getDb()
        .update(products)
        .set({ name: "Nuevo", unitPrice: "3.00", salesRevision: 2 })
        .where(eq(products.id, product));
      const input = command(order);
      const updated = await body(
        await call(order.id, {
          ...input,
          items: [
            {
              productId: product,
              quantity: "1",
              quantityUnit: "unit",
              catalogRevision: "2",
            },
            input.items[0],
          ],
        }),
      );
      expect(
        updated.items.map((l: ReadLine) => [l.name, l.unitPrice, l.lineTotal]),
      ).toEqual([
        ["Nuevo", "3", "3.00"],
        ["Antiguo", "2", "4.00"],
      ]);
      expect(updated.items[1].lineId).toBe(order.items[0].lineId);
      const reduced = await body(
        await call(
          order.id,
          command(updated, { items: [command(updated).items[1]] }),
        ),
      );
      expect(reduced.items.map((l: ReadLine) => l.lineId)).toEqual([
        order.items[0].lineId,
      ]);
      expect((await lines(order.id))[0].position).toBe(0);
    });
    it("deleted product and high legacy quantity survive notes without repricing, changed high capture fails", async () => {
      const product = await seedProduct(a, "Borrado", "0.00");
      const order = await open(product, 1000000000);
      await getDb().delete(products).where(eq(products.id, product));
      const read = await body(
        await dispatchModuleRequest(
          "GET",
          new Request(
            `http://localhost:3001/api/modules/pos/orders/${order.id}`,
            { headers: { cookie: a.ownerCookie, "X-Pos-Contract": "2" } },
          ),
          { moduleId: "pos", path: ["orders", order.id] },
        ),
      );
      const updated = await body(
        await call(order.id, command(read, { note: "conservada" })),
      );
      expect(updated.items[0]).toMatchObject({
        productId: null,
        name: "Borrado",
        quantity: "1000000000",
        unitPrice: "0",
      });
      const bad = command(updated);
      bad.items[0].quantity = "1000000001";
      expect((await call(order.id, bad)).status).toBe(422);
      expect(
        (await body(await pos.read(a.ownerCookie, order.id))).version,
      ).toBe(updated.version);
    });
    it("editing has no core order, payment, event or consumption effects", async () => {
      const inspect = async () => ({
        core: await getDb()
          .select({ id: orders.id })
          .from(orders)
          .where(eq(orders.businessId, a.seed.business.id)),
        effects: (
          await getDb().execute(
            sql`select (select count(*) from core.module_event where business_id=${a.seed.business.id})::int as events, (select count(*) from pos.order_payment where business_id=${a.seed.business.id})::int as payments, (select count(*) from recipes.consumption_source where business_id=${a.seed.business.id})::int as consumption, (select count(*) from stock.movement where business_id=${a.seed.business.id})::int as movements`,
          )
        ).rows,
      });
      const order = await open();
      const before = await inspect();
      await body(
        await call(order.id, command(order, { note: "solo edición" })),
      );
      expect(await inspect()).toEqual(before);
    });
    it("moves only to owned active local/table and preserves archived context; no sale side effects", async () => {
      const [destination] = await getDb()
        .insert(locations)
        .values({
          ...(
            await getDb()
              .select()
              .from(locations)
              .where(eq(locations.id, a.seed.locationId))
          )[0],
          id: randomUUID(),
          name: "Destino",
        })
        .returning();
      const [foreign] = await getDb()
        .insert(diningTables)
        .values({
          businessId: b.seed.business.id,
          locationId: b.seed.locationId,
          name: "Ajena",
        })
        .returning();
      await setModuleRow(a.seed.business.id, "tables", true);
      const [table] = await getDb()
        .insert(diningTables)
        .values({
          businessId: a.seed.business.id,
          locationId: destination.id,
          name: "Mesa destino",
        })
        .returning();
      const first = await open(),
        second = await open();
      const moved = await body(
        await call(
          first.id,
          command(first, {
            saleType: "table",
            tableId: table.id,
            locationId: destination.id,
          }),
        ),
      );
      expect(moved.location.id).toBe(destination.id);
      expect(moved.orderLabel).toBe(table.name);
      const before = await row(second.id);
      expect(
        (
          await body(
            await call(
              second.id,
              command(second, {
                saleType: "table",
                tableId: table.id,
                locationId: destination.id,
              }),
            ),
            409,
          )
        ).code,
      ).toBe("table_occupied");
      expect(
        (
          await call(
            second.id,
            command(second, {
              saleType: "table",
              tableId: foreign.id,
              locationId: b.seed.locationId,
            }),
          )
        ).status,
      ).toBe(422);
      expect(await row(second.id)).toEqual(before);
      await getDb()
        .update(locations)
        .set({ status: "archived" })
        .where(eq(locations.id, destination.id));
      const kept = await body(
        await call(first.id, command(moved, { note: "historia" })),
      );
      expect(kept.location.id).toBe(destination.id);
      expect(
        (await call(second.id, command(second, { locationId: destination.id })))
          .status,
      ).toBe(409);
    });
  },
);
