import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  locations,
  posOrders,
  recipeLines,
  recipeRevisions,
  stockItems,
  stockMovements,
  stockItemLocations,
  moduleEvents,
} from "@mi-pasaporte/db/schema";
import {
  dropModuleWorld,
  seedModuleWorld,
  seedProduct,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "./modules-integration-support";
import {
  backfill,
  contract,
  preflight,
  preflightLegacy,
} from "../../../../tools/stock-local/rollout";
import { itemColumns } from "./stock/items";
import { applyPurchase } from "./stock/movements";
const run = modulesIntegrationEnabled ? describe : describe.skip;
run(
  "0227 expand bridge/backfill/contract (isolated DDL)",
  { timeout: 60000 },
  () => {
    let world: ModuleWorld;
    beforeAll(async () => {
      world = await seedModuleWorld("migration");
    });
    afterAll(async () => dropModuleWorld(world));
    const rollback = new Error("rollback-test");
    async function historical(tx: Parameters<typeof backfill>[0]) {
      const [item] = await tx
        .insert(stockItems)
        .values({
          businessId: world.businessId,
          name: `Legacy-${randomUUID()}`,
          unit: "g",
          lastUnitCost: "0.250000",
        })
        .returning({ id: stockItems.id });
      await tx.execute(
        sql`alter table stock.movement disable trigger stock_legacy_location; alter table stock.movement disable trigger stock_bridge_cost`,
      );
      await tx.insert(stockMovements).values([
        {
          businessId: world.businessId,
          itemId: item.id,
          kind: "purchase",
          quantity: "10",
          totalCost: "2.50",
        },
        {
          businessId: world.businessId,
          itemId: item.id,
          kind: "adjustment",
          quantity: "-10",
          countedQuantity: "0",
        },
      ]);
      await tx.execute(
        sql`alter table stock.movement enable trigger stock_legacy_location; alter table stock.movement enable trigger stock_bridge_cost`,
      );
      await tx.execute(
        sql`alter table pos.pos_order disable trigger pos_legacy_location`,
      );
      await tx.insert(posOrders).values({
        businessId: world.businessId,
        tableLabel: "Histórico",
        createdByUserId: world.ownerId,
      });
      await tx.execute(
        sql`alter table pos.pos_order enable trigger pos_legacy_location`,
      );
      return item.id;
    }
    it("CI migration hashes match actual expand SQL artifacts and final schema constraints", async () => {
      const journal = JSON.parse(
        readFileSync(
          new URL(
            "../../../../packages/db/drizzle/meta/_journal.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      for (const entry of journal.entries.filter(
        (e: { idx: number }) => e.idx >= 82,
      )) {
        const expected = createHash("sha256")
          .update(
            readFileSync(
              new URL(
                `../../../../packages/db/drizzle/${entry.tag}.sql`,
                import.meta.url,
              ),
            ),
          )
          .digest("hex");
        const row = await getDb().execute(
          sql`select hash from drizzle.__drizzle_migrations where created_at=${entry.when}`,
        );
        expect(row.rows[0]?.hash).toBe(expected);
      }
      const fk = await getDb().execute(
        sql`select conname from pg_constraint where conname in ('stock_movement_business_item_fk','stock_movement_business_location_fk','recipes_line_business_item_fk','recipes_line_business_product_fk','pos_order_business_location_fk')`,
      );
      expect(fk.rows).toHaveLength(5);
    });
    it("legacy preflight works when expanded tables and movement.local are absent", async () => {
      await expect(
        withDbTransaction(async (tx) => {
          await tx.execute(
            sql`drop table core.module_event_delivery,core.module_event,core.module_resource_version,stock.item_location,recipes.revision cascade`,
          );
          await tx.execute(
            sql`alter table stock.movement drop column location_id cascade`,
          );
          const report = await preflightLegacy(tx);
          expect(report.invalidReferences).toBe(0);
          expect(Array.isArray(report.items)).toBe(true);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
    it("bridge assigns unique active old writes and revision pointer is immutable snapshot", async () => {
      const [item] = await getDb()
        .insert(stockItems)
        .values({ businessId: world.businessId, name: "Bridge", unit: "g" })
        .returning({ id: stockItems.id });
      const [move] = await getDb()
        .insert(stockMovements)
        .values({
          businessId: world.businessId,
          itemId: item.id,
          kind: "purchase",
          quantity: "10",
          totalCost: "5",
        })
        .returning();
      expect(move.locationId).toBe(world.locationId);
      const [pair] = await getDb()
        .select()
        .from(stockItemLocations)
        .where(eq(stockItemLocations.itemId, item.id));
      expect(pair.lastUnitCost).toBe("0.500000");
      const [order] = await getDb()
        .insert(posOrders)
        .values({
          businessId: world.businessId,
          createdByUserId: world.ownerId,
          tableLabel: "Legacy POS",
        })
        .returning();
      expect(order.locationId).toBe(world.locationId);
      const productId = await seedProduct(world, "Recipe", null);
      await getDb().insert(recipeLines).values({
        businessId: world.businessId,
        productId,
        itemId: item.id,
        quantity: "250",
      });
      const [revision] = await getDb()
        .select()
        .from(recipeRevisions)
        .where(eq(recipeRevisions.productId, productId));
      expect(revision.lines).toEqual([
        { itemId: item.id, unit: "g", quantity: "250.000" },
      ]);
      await expect(
        getDb()
          .update(recipeRevisions)
          .set({ lines: [] })
          .where(eq(recipeRevisions.id, revision.id)),
      ).rejects.toBeDefined();
      await expect(
        getDb()
          .delete(recipeRevisions)
          .where(eq(recipeRevisions.id, revision.id)),
      ).rejects.toBeDefined();
    });
    it("zero-sum history is backfilled with count/cost/amount intact and no sale reconstruction", async () => {
      await expect(
        withDbTransaction(async (tx) => {
          const itemId = await historical(tx);
          const legacy = await preflightLegacy(tx);
          expect(
            legacy.businesses.find((b) => b.business_id === world.businessId)
              ?.movements,
          ).toBe(3);
          const report = await preflight(tx);
          const before = report.businesses.find(
            (b) => b.business_id === world.businessId,
          )!;
          expect(before.unassigned_movements).toBe(2);
          const after = await backfill(tx);
          const next = after.businesses.find(
            (b) => b.business_id === world.businessId,
          )!;
          expect(next.movements).toBe(before.movements);
          expect(next.quantity).toBe(before.quantity);
          expect(next.total_cost).toBe(before.total_cost);
          expect(next.unassigned_movements).toBe(0);
          expect(next.unassigned_orders).toBe(0);
          const [pair] = await tx
            .select()
            .from(stockItemLocations)
            .where(eq(stockItemLocations.itemId, itemId));
          expect(pair.lastUnitCost).toBe("0.250000");
          expect(after.items.find((i) => i.item_id === itemId)).toMatchObject({
            movements: 2,
            quantity: "0.000",
            total_cost: "2.50",
            legacy_cost: "0.250000",
          });
          expect(
            await tx
              .select()
              .from(moduleEvents)
              .where(eq(moduleEvents.businessId, world.businessId)),
          ).toHaveLength(0);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
    it("multi-local requires explicit real destination and never guesses", async () => {
      await expect(
        withDbTransaction(async (tx) => {
          await historical(tx);
          await tx.insert(locations).values({
            businessId: world.businessId,
            name: "Multi",
            addressLabel: "Quito",
            countryCode: "EC",
            addressSnapshot: {},
          });
          await backfill(tx);
        }),
      ).rejects.toThrow("Explicit location mapping required");
      await expect(
        withDbTransaction(async (tx) => {
          const itemId = await historical(tx);
          await tx.insert(locations).values({
            businessId: world.businessId,
            name: "Multi",
            addressLabel: "Quito",
            countryCode: "EC",
            addressSnapshot: {},
          });
          await backfill(tx, { [world.businessId]: world.locationId });
          const movements = await tx
            .select()
            .from(stockMovements)
            .where(eq(stockMovements.itemId, itemId));
          expect(
            movements.every((m) => m.locationId === world.locationId),
          ).toBe(true);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
    it("no active destination with data fails; empty catalogue does not invent a local", async () => {
      await expect(
        withDbTransaction(async (tx) => {
          await historical(tx);
          await tx
            .update(locations)
            .set({ status: "archived" })
            .where(eq(locations.businessId, world.businessId));
          await backfill(tx);
        }),
      ).rejects.toThrow("Explicit location mapping required");
    });
    it("empty catalogue without active local preserves absence of localized data", async () => {
      const empty = await seedModuleWorld("empty-migration");
      try {
        await getDb()
          .update(locations)
          .set({ status: "archived" })
          .where(eq(locations.businessId, empty.businessId));
        await getDb().insert(stockItems).values({
          businessId: empty.businessId,
          name: "Empty",
          unit: "unit",
        });
        await withDbTransaction(async (tx) => {
          await backfill(tx);
        });
        expect(
          await getDb()
            .select()
            .from(stockItemLocations)
            .where(eq(stockItemLocations.businessId, empty.businessId)),
        ).toHaveLength(0);
        expect(
          await getDb()
            .select()
            .from(stockMovements)
            .where(eq(stockMovements.businessId, empty.businessId)),
        ).toHaveLength(0);
      } finally {
        await dropModuleWorld(empty);
      }
    });
    it("contract explicitly verifies deployment/writers and new read/write survives dropped legacy cost", async () => {
      await expect(
        withDbTransaction((tx) =>
          contract(tx, { writersRetired: false, deployedSha: "a".repeat(40) }),
        ),
      ).rejects.toThrow("Require verified deployed SHA");
      await expect(
        withDbTransaction(async (tx) => {
          const id = await historical(tx);
          await backfill(tx);
          await contract(tx, {
            writersRetired: true,
            deployedSha: "a".repeat(40),
          });
          const [item] = await tx
            .select(itemColumns)
            .from(stockItems)
            .where(eq(stockItems.id, id));
          expect(item.lastUnitCost).toBeNull();
          const applied = await applyPurchase(tx, {
            businessId: world.businessId,
            locationId: world.locationId,
            userId: world.ownerId,
            item,
            quantity: 1000n,
            cost: { totalCost: 200n, unitCost: 2000000n },
            occurredAt: new Date(),
            note: null,
            entryId: null,
          });
          expect(applied.item.lastUnitCost).toBe("2.000000");
          const nullable = await tx.execute(
            sql`select is_nullable from information_schema.columns where table_schema='stock' and table_name='movement' and column_name='location_id'`,
          );
          expect(nullable.rows[0].is_nullable).toBe("NO");
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
  },
);
