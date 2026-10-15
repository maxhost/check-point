import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  locations,
  stockItems,
  stockItemLocations,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import {
  dropModuleWorld,
  seedModuleWorld,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "./modules-integration-support";
import { initializeAverageCosts } from "../../../../tools/stock-average/rollout";
const run = modulesIntegrationEnabled ? describe : describe.skip;
const migration = readFileSync(
  new URL(
    "../../../../packages/db/drizzle/0084_costo_promedio_y_datos_fiscales.sql",
    import.meta.url,
  ),
  "utf8",
);
const confirmation = { deployedSha: "a".repeat(40), oldWritersStopped: true };
run(
  "0228/0229 additive 0084 and resumable local initialization (isolated DDL)",
  { timeout: 60000 },
  () => {
    let world: ModuleWorld;
    beforeAll(async () => {
      world = await seedModuleWorld("average-migration");
    });
    afterAll(async () => dropModuleWorld(world));
    it("actual CI hash matches 0084 and old/new businesses get explicit fiscal defaults", async () => {
      const journal = JSON.parse(
        readFileSync(
          new URL(
            "../../../../packages/db/drizzle/meta/_journal.json",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const entry = journal.entries.find((e: { idx: number }) => e.idx === 84);
      const result = await getDb().execute(
        sql`select hash from drizzle.__drizzle_migrations where created_at=${entry.when}`,
      );
      expect(result.rows[0]?.hash).toBe(
        createHash("sha256").update(migration).digest("hex"),
      );
      const rollback = new Error("rollback-ddl");
      await expect(
        withDbTransaction(async (tx) => {
          await tx.execute(
            sql`alter table core.business drop column charges_vat,drop column sale_vat_rate,drop column recovers_purchase_vat; alter table stock.item_location drop column weighted_average_unit_cost,drop column weighted_average_initialized_at`,
          );
          for (const statement of migration.split("--> statement-breakpoint"))
            await tx.execute(sql.raw(statement));
          const old = await tx
            .select({
              chargesVat: businesses.chargesVat,
              saleVatRate: businesses.saleVatRate,
              recoversPurchaseVat: businesses.recoversPurchaseVat,
            })
            .from(businesses)
            .where(eq(businesses.id, world.businessId));
          expect(old).toEqual([
            {
              chargesVat: false,
              saleVatRate: null,
              recoversPurchaseVat: false,
            },
          ]);
          const [fresh] = await tx
            .insert(businesses)
            .values({
              name: "New fiscal defaults",
              countryCode: "AR",
              timezone: "America/Argentina/Buenos_Aires",
            })
            .returning({
              chargesVat: businesses.chargesVat,
              saleVatRate: businesses.saleVatRate,
              recoversPurchaseVat: businesses.recoversPurchaseVat,
            });
          expect(fresh).toEqual({
            chargesVat: false,
            saleVatRate: null,
            recoversPurchaseVat: false,
          });
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
    it("DB rejects out-of-range/nonfinite rates and charging without a rate, but accepts 0 and 100", async () => {
      for (const saleVatRate of ["-0.01", "100.01", "NaN", "Infinity"])
        await expect(
          getDb()
            .update(businesses)
            .set({ saleVatRate })
            .where(eq(businesses.id, world.businessId)),
        ).rejects.toBeDefined();
      await expect(
        getDb()
          .update(businesses)
          .set({ chargesVat: true, saleVatRate: null })
          .where(eq(businesses.id, world.businessId)),
      ).rejects.toBeDefined();
      for (const saleVatRate of ["0.00", "100.00"]) {
        await getDb()
          .update(businesses)
          .set({ chargesVat: true, saleVatRate, recoversPurchaseVat: false })
          .where(eq(businesses.id, world.businessId));
        const [row] = await getDb()
          .select()
          .from(businesses)
          .where(eq(businesses.id, world.businessId));
        expect(row.saleVatRate).toBe(saleVatRate);
      }
    });
    it("verified cut seeds each local exactly once, copies null/zero and preserves ledger/last costs", async () => {
      const rollback = new Error("rollback-seed");
      await expect(
        withDbTransaction(async (tx) => {
          const [other] = await tx
            .insert(locations)
            .values({
              businessId: world.businessId,
              name: "Other",
              addressLabel: "Quito",
              countryCode: "EC",
              addressSnapshot: {},
            })
            .returning({ id: locations.id });
          const [item] = await tx
            .insert(stockItems)
            .values({
              businessId: world.businessId,
              name: randomUUID(),
              unit: "unit",
              lastUnitCost: "99",
            })
            .returning({ id: stockItems.id });
          const [unknown] = await tx
            .insert(stockItems)
            .values({
              businessId: world.businessId,
              name: randomUUID(),
              unit: "unit",
              lastUnitCost: "99",
            })
            .returning({ id: stockItems.id });
          await tx.insert(stockItemLocations).values([
            {
              businessId: world.businessId,
              itemId: item.id,
              locationId: world.locationId,
              lastUnitCost: "0",
            },
            {
              businessId: world.businessId,
              itemId: item.id,
              locationId: other.id,
              lastUnitCost: "7.123456",
            },
            {
              businessId: world.businessId,
              itemId: unknown.id,
              locationId: world.locationId,
              lastUnitCost: null,
            },
          ]);
          await tx.insert(stockMovements).values({
            businessId: world.businessId,
            itemId: item.id,
            locationId: world.locationId,
            kind: "purchase",
            quantity: "10",
            totalCost: null,
          });
          const ledgerBefore = await tx
            .select()
            .from(stockMovements)
            .where(eq(stockMovements.businessId, world.businessId));
          await expect(
            initializeAverageCosts(
              tx,
              { deployedSha: "invalid", oldWritersStopped: false },
              world.businessId,
            ),
          ).rejects.toThrow("Require verified");
          expect(
            (await initializeAverageCosts(tx, confirmation, world.businessId))
              .seeded,
          ).toBe(3);
          const pairs = await tx
            .select()
            .from(stockItemLocations)
            .where(eq(stockItemLocations.businessId, world.businessId));
          expect(
            pairs.every((p) => p.weightedAverageInitializedAt !== null),
          ).toBe(true);
          expect(
            pairs.find(
              (p) => p.itemId === item.id && p.locationId === world.locationId,
            )?.weightedAverageUnitCost,
          ).toBe("0.000000");
          expect(
            pairs.find((p) => p.locationId === other.id)
              ?.weightedAverageUnitCost,
          ).toBe("7.123456");
          expect(
            pairs.find((p) => p.itemId === unknown.id)?.weightedAverageUnitCost,
          ).toBeNull();
          await tx
            .update(stockItemLocations)
            .set({ lastUnitCost: "42" })
            .where(eq(stockItemLocations.businessId, world.businessId));
          expect(
            (await initializeAverageCosts(tx, confirmation, world.businessId))
              .seeded,
          ).toBe(0);
          const resumed = await tx
            .select()
            .from(stockItemLocations)
            .where(eq(stockItemLocations.businessId, world.businessId));
          expect(
            resumed.map((p) => [
              p.itemId,
              p.locationId,
              p.weightedAverageUnitCost,
              p.weightedAverageInitializedAt,
            ]),
          ).toEqual(
            pairs.map((p) => [
              p.itemId,
              p.locationId,
              p.weightedAverageUnitCost,
              p.weightedAverageInitializedAt,
            ]),
          );
          expect(
            await tx
              .select()
              .from(stockMovements)
              .where(eq(stockMovements.businessId, world.businessId)),
          ).toEqual(ledgerBefore);
          await expect(
            tx.insert(stockItemLocations).values({
              businessId: world.businessId,
              itemId: unknown.id,
              locationId: other.id,
              weightedAverageUnitCost: "-1",
            }),
          ).rejects.toBeDefined();
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    });
  },
);
