import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  diningTables,
  posOrderItems,
  posOrders,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import { buildFinancialAmountsFromSnapshots } from "@mi-pasaporte/domain/financial";
import { CONVERSION_VERSION, MASS_UNITS } from "@mi-pasaporte/domain/measures";
import { listPosOrders } from "./list";
import {
  measuredSummaryColumns,
  summaryAmounts,
  type MeasuredSummary,
} from "./measured-summary";
import {
  dropPosWorld,
  openOrder,
  posIntegrationEnabled,
  posStaff,
  seedPosWorld,
  seedProduct,
  type PosWorld,
} from "./pos-integration-support";
import { closeWithCash } from "./pos-payment-integration-support";

const worlds: PosWorld[] = [];
const now = new Date("2026-11-01T06:30:00.000Z"); // New York fall DST day, second 01:30.
let staffId: string;
let productId: string;
let tableId: string;
const ids: Record<string, string> = {};
const measure = {
  kind: "unit" as const,
  quantityUnit: "unit" as const,
  priceUnit: "unit" as const,
  conversionVersion: CONVERSION_VERSION,
};

describe.skipIf(!posIntegrationEnabled)(
  "0242 list exact SQL/domain (not HTTP V2 activation)",
  () => {
    beforeAll(async () => {
      worlds.push(await seedPosWorld("Summary A"));
      worlds.push(await seedPosWorld("Summary B"));
      staffId = (await posStaff(worlds[0], ["pos"])).userId;
      productId = await seedProduct(
        worlds[0],
        "Deleted summary product",
        "3.25",
      );
      await getDb()
        .update(businesses)
        .set({ timezone: "America/New_York" })
        .where(eq(businesses.id, worlds[0].seed.business.id));
      const [table] = await getDb()
        .insert(diningTables)
        .values({
          businessId: worlds[0].seed.business.id,
          locationId: worlds[0].seed.locationId,
          name: "Pickup / no table",
        })
        .returning();
      tableId = table.id;
      for (const [name, status, created, closed] of [
        ["old-empty", "open", "2020-01-01T00:00:00Z", null],
        ["unit", "open", "2026-10-30T00:00:00Z", null],
        ["table", "open", "2026-10-31T00:00:00Z", null],
        ["net", "closed", "2026-11-01T04:30:00Z", "2026-11-01T05:30:00Z"],
        ["legacy", "closed", "2026-11-01T04:30:00Z", "2026-11-01T06:00:00Z"],
        [
          "previous-day",
          "closed",
          "2026-10-31T00:00:00Z",
          "2026-11-01T03:59:59Z",
        ],
        [
          "today-void",
          "voided",
          "2026-11-01T04:00:00Z",
          "2026-11-01T06:15:00Z",
        ],
        [
          "90d",
          "voided",
          "2026-08-01T00:00:00Z",
          new Date(now.getTime() - 90 * 86400000).toISOString(),
        ],
        [
          "outside-90d",
          "voided",
          "2026-08-01T00:00:00Z",
          new Date(now.getTime() - 90 * 86400000 - 1).toISOString(),
        ],
      ] as const) {
        if (name === "net") continue;
        const [row] = await getDb()
          .insert(posOrders)
          .values({
            businessId: worlds[0].seed.business.id,
            locationId: worlds[0].seed.locationId,
            tableLabel: name === "table" ? "Sin mesa" : name,
            diningTableId: name === "table" ? tableId : null,
            saleType: name === "unit" ? "pickup" : null,
            status,
            createdByUserId: staffId,
            createdAt: new Date(created),
            closedAt: closed ? new Date(closed) : null,
            closedByUserId: closed ? staffId : null,
            settlement: null,
            totalSnapshot: name === "legacy" ? "6.50" : null,
          })
          .returning();
        ids[name] = row.id;
        if (name !== "old-empty")
          await getDb().insert(posOrderItems).values({
            posOrderId: row.id,
            productId,
            nameSnapshot: "Frozen deleted product",
            quantity: "2",
            unitPriceSnapshot: "3.25",
            position: 0,
          });
      }
      // A real paid close without a customer; no fabricated payment rows or discount.
      const netOrder = await openOrder(
        worlds[0],
        [{ productId, quantity: 2 }],
        "Cash without customer",
      );
      const closedResponse = await closeWithCash(
        worlds[0].ownerCookie,
        netOrder.id,
        { clientRequestId: randomUUID(), version: netOrder.version },
      );
      expect(closedResponse.status).toBe(200);
      const closedBody = await closedResponse.json();
      expect(closedBody.sale).toBeNull();
      expect(closedBody.settlement.collected).toBe("6.50");
      ids.net = netOrder.id;
      await getDb()
        .update(posOrders)
        .set({
          createdAt: new Date("2026-11-01T04:30:00Z"),
          closedAt: new Date("2026-11-01T05:30:00Z"),
        })
        .where(eq(posOrders.id, netOrder.id));
      // Currency-normalized real close: V1 must retain the original historical cents.
      const copProduct = await seedProduct(
        worlds[0],
        "COP historical cents",
        "0.49",
      );
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, worlds[0].seed.business.id));
      try {
        const copOrder = await openOrder(
          worlds[0],
          [{ productId: copProduct, quantity: 2 }],
          "COP without customer",
        );
        const response = await closeWithCash(
          worlds[0].ownerCookie,
          copOrder.id,
          { clientRequestId: randomUUID(), version: copOrder.version },
        );
        expect(response.status).toBe(200);
        expect((await response.json()).settlement).toMatchObject({
          gross: "1",
          collected: "1",
          currencyCode: "COP",
        });
        ids["net-cop"] = copOrder.id;
        await getDb()
          .update(posOrders)
          .set({ closedAt: new Date("2026-11-01T06:10:00Z") })
          .where(eq(posOrders.id, copOrder.id));
      } finally {
        await getDb()
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, worlds[0].seed.business.id));
      }
      await getDb().insert(posOrders).values({
        businessId: worlds[1].seed.business.id,
        tableLabel: "Other tenant",
        createdByUserId: worlds[1].seed.userId,
      });
      await getDb().delete(products).where(eq(products.id, productId));
    }, 180000);

    afterAll(async () => {
      for (const world of worlds) {
        const userIds = [world.seed.userId, ...world.extraUsers];
        await dropPosWorld(world);
        await getDb().delete(users).where(inArray(users.id, userIds));
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.id, world.seed.business.id)),
        ).toEqual([]);
        expect(
          (
            await getDb().execute(
              sql`select id from merchant_auth.session where user_id in (${sql.join(
                userIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            )
          ).rows,
        ).toEqual([]);
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, userIds)),
        ).toEqual([]);
      }
    }, 180000);

    it("returns every open including empty/old, actual FK type, lineCount, isolated tenant and deleted snapshots", async () => {
      const result = await listPosOrders(
        worlds[0].seed.business.id,
        now,
        undefined,
        2,
      );
      expect(result.open.map((o) => o.id)).toEqual([
        ids["old-empty"],
        ids.unit,
        ids.table,
      ]);
      expect(result.open[0]).toMatchObject({
        total: "0.00",
        lineCount: 0,
        saleType: "legacy",
      });
      expect(result.open[1]).toMatchObject({
        total: "6.50",
        lineCount: 1,
        saleType: "pickup",
        version: 1,
      });
      expect(result.open[2]).toMatchObject({
        saleType: "table",
        orderLabel: "Sin mesa",
        tableId,
      });
      const legacy = await listPosOrders(worlds[0].seed.business.id, now);
      expect(legacy.open[1]).toMatchObject({ total: "6.50", itemCount: 2 });
      expect(result.closedToday.map((o) => o.id)).toEqual([
        ids["today-void"],
        ids["net-cop"],
        ids.legacy,
        ids.net,
      ]);
      expect(result.closedToday.find((o) => o.id === ids.net)).toMatchObject({
        total: "6.50",
        saleTotal: "6.50",
      });
      expect(result.closedToday.find((o) => o.id === ids.legacy)).toMatchObject(
        { total: "6.50", saleTotal: "6.50" },
      );
      expect(legacy.closedToday.find((o) => o.id === ids.net)).toMatchObject({
        total: "6.50",
        saleTotal: null,
      });
      expect(
        legacy.closedToday.find((o) => o.id === ids["net-cop"]),
      ).toMatchObject({ total: "0.98", saleTotal: null });
      expect(
        result.closedToday.find((o) => o.id === ids["net-cop"]),
      ).toMatchObject({ total: "1", saleTotal: "1" });
      expect(result.closedToday[0]).toMatchObject({
        total: "6.50",
        saleTotal: null,
      });
      expect(
        (await listPosOrders(worlds[1].seed.business.id, now, undefined, 2))
          .open,
      ).toHaveLength(1);
    });

    it("retains exact 90-day boundaries and uses local dates across both DST hours", async () => {
      const result = await listPosOrders(
        worlds[0].seed.business.id,
        now,
        "voided",
        2,
      );
      expect(result.open).toEqual([]);
      expect(result.closedToday.map((o) => o.id)).toEqual([
        ids["today-void"],
        ids["90d"],
      ]);
      const midnight = await listPosOrders(
        worlds[0].seed.business.id,
        new Date("2026-11-01T03:59:59Z"),
        undefined,
        2,
      );
      expect(midnight.closedToday.map((o) => o.id)).toEqual([
        ids["previous-day"],
      ]);
    });

    it("uses current open currency but frozen closed currency; V1 retains historical cents", async () => {
      await getDb()
        .update(posOrderItems)
        .set({ unitPriceSnapshot: "0.49" })
        .where(eq(posOrderItems.posOrderId, ids.unit));
      await getDb()
        .update(businesses)
        .set({ currencyCode: "COP" })
        .where(eq(businesses.id, worlds[0].seed.business.id));
      try {
        const result = await listPosOrders(
          worlds[0].seed.business.id,
          now,
          undefined,
          2,
        );
        expect(result.open.find((o) => o.id === ids.unit)).toMatchObject({
          total: "1",
          lineCount: 1,
        });
        expect(result.closedToday.find((o) => o.id === ids.net)).toMatchObject({
          total: "6.50",
        });
        expect(
          (await listPosOrders(worlds[0].seed.business.id, now)).open.find(
            (o) => o.id === ids.unit,
          ),
        ).toMatchObject({ total: "0.98", itemCount: 2 });
      } finally {
        await getDb()
          .update(posOrderItems)
          .set({ unitPriceSnapshot: "3.25" })
          .where(eq(posOrderItems.posOrderId, ids.unit));
        await getDb()
          .update(businesses)
          .set({ currencyCode: "USD" })
          .where(eq(businesses.id, worlds[0].seed.business.id));
      }
    });

    it("aggregates measured VALUES exactly with the shared financial oracle, without canonical mass inserts", async () => {
      const cases = [
        { quantity: "1", unitPrice: "0.499", measure },
        ...MASS_UNITS.flatMap((quantityUnit) =>
          MASS_UNITS.map((priceUnit) => ({
            quantity: "1.123456789",
            unitPrice: "0.123456789",
            measure: {
              kind: "mass" as const,
              quantityUnit,
              priceUnit,
              conversionVersion: CONVERSION_VERSION,
            },
          })),
        ),
        {
          quantity: "0.000000001",
          unitPrice: "999999999.999999999",
          measure: {
            kind: "mass" as const,
            quantityUnit: "lb" as const,
            priceUnit: "g" as const,
            conversionVersion: CONVERSION_VERSION,
          },
        },
      ];
      const aggregate = async (lines: typeof cases) => {
        const c = measuredSummaryColumns({
          quantity: sql`q`,
          price: sql`p`,
          kind: sql`kind`,
          quantityUnit: sql`qu`,
          priceUnit: sql`pu`,
          conversionVersion: sql`cv`,
        });
        const rows = await getDb().execute(
          sql`select ${sql.join(
            Object.entries(c).map(
              ([name, expression]) =>
                sql`${expression.sql} as ${sql.identifier(name)}`,
            ),
            sql`, `,
          )} from (values ${sql.join(
            lines.map(
              (l) =>
                sql`(${l.quantity}::numeric, ${l.unitPrice}::numeric, ${l.measure.kind}::text, ${l.measure.quantityUnit}::text, ${l.measure.priceUnit}::text, ${l.measure.conversionVersion}::text)`,
            ),
            sql`, `,
          )}) as source(q,p,kind,qu,pu,cv)`,
        );
        return rows.rows[0] as MeasuredSummary;
      };
      for (const currencyCode of ["USD", "COP"]) {
        for (const lines of [cases, ...cases.map((c) => [c])]) {
          const result = await aggregate(lines);
          expect(summaryAmounts(result, currencyCode, 2).total).toBe(
            buildFinancialAmountsFromSnapshots({
              currencyCode,
              discount: null,
              lines: lines.map((l, position) => ({
                ...l,
                sourceLineId: String(position),
                position,
              })),
            }).gross,
          );
          expect(Number(result.lineCount)).toBe(lines.length);
        }
      }
      expect(summaryAmounts(await aggregate([cases[0]]), "COP", 2).total).toBe(
        "0",
      );
      const precise = await aggregate([cases[0]]);
      expect(() => summaryAmounts(precise, "USD", 1)).toThrow(
        expect.objectContaining({ code: "pos_client_upgrade_required" }),
      );
      for (const quantity of ["0", "1000000000", "0.0000000001"]) {
        const bad = await aggregate([{ ...cases[1], quantity }]);
        expect(() => summaryAmounts(bad, "USD", 2)).toThrow();
      }
      const overflow = await aggregate([
        { ...cases[1], quantity: "999999999", unitPrice: "999999999" },
      ]);
      expect(() => summaryAmounts(overflow, "USD", 2)).toThrow();
      const zero = await aggregate([{ ...cases[1], unitPrice: "0" }]);
      expect(summaryAmounts(zero, "USD", 2).total).toBe("0.00");
      const invalid = await aggregate([
        {
          ...cases[0],
          measure: {
            ...measure,
            conversionVersion: "invalid" as typeof CONVERSION_VERSION,
          },
        },
      ]);
      expect(() => summaryAmounts(invalid, "USD", 2)).toThrow();
    });

    it("lists bounded volume without truncating orders or materializing individual lines", async () => {
      const orderIds: string[] = Array.from({ length: 200 }, () =>
        randomUUID(),
      );
      await getDb()
        .insert(posOrders)
        .values(
          orderIds.map((id) => ({
            id,
            businessId: worlds[0].seed.business.id,
            tableLabel: "Volume",
            createdByUserId: staffId,
          })),
        );
      try {
        await getDb()
          .insert(posOrderItems)
          .values(
            orderIds.flatMap((posOrderId) =>
              Array.from({ length: 30 }, (_, position) => ({
                posOrderId,
                nameSnapshot: "Volume",
                unitPriceSnapshot: "0.01",
                quantity: "2",
                position,
              })),
            ),
          );
        const result = await listPosOrders(
          worlds[0].seed.business.id,
          now,
          undefined,
          2,
        );
        expect(result.open).toHaveLength(203);
        for (const row of result.open.filter((o) => orderIds.includes(o.id)))
          expect(row).toMatchObject({ total: "0.60", lineCount: 30 });
      } finally {
        await getDb()
          .delete(posOrders)
          .where(
            and(
              eq(posOrders.businessId, worlds[0].seed.business.id),
              inArray(posOrders.id, orderIds),
            ),
          );
      }
    }, 120000);
  },
);
