import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { stockItems, stockMovements } from "@mi-pasaporte/db/schema";
import {
  dropModuleWorld,
  seedModuleWorld,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "./modules-integration-support";
const run = modulesIntegrationEnabled ? describe : describe.skip;
const migration = readFileSync(
  new URL(
    "../../../../packages/db/drizzle/0085_costo_de_lo_vendido.sql",
    import.meta.url,
  ),
  "utf8",
);

run("0230 additive cost migration (isolated DDL)", { timeout: 60000 }, () => {
  let world: ModuleWorld, itemId: string, movementId: string;
  beforeAll(async () => {
    world = await seedModuleWorld("0230-migration");
    const [item] = await getDb()
      .insert(stockItems)
      .values({
        businessId: world.businessId,
        name: randomUUID(),
        unit: "unit",
      })
      .returning();
    itemId = item.id;
    const [movement] = await getDb()
      .insert(stockMovements)
      .values({
        businessId: world.businessId,
        itemId,
        locationId: world.locationId,
        kind: "consumption",
        quantity: "-3.000",
        sourceOrderId: randomUUID(),
        sourceLineId: randomUUID(),
        productId: randomUUID(),
      })
      .returning();
    movementId = movement.id;
  });
  afterAll(async () => dropModuleWorld(world));

  it("applied journal hash matches generated SQL and expansion preserves legacy without backfill", async () => {
    const journal = JSON.parse(
      readFileSync(
        new URL(
          "../../../../packages/db/drizzle/meta/_journal.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const entry = journal.entries.find((e: { idx: number }) => e.idx === 85);
    const applied = await getDb().execute(
      sql`select hash from drizzle.__drizzle_migrations where created_at=${entry.when}`,
    );
    expect(applied.rows[0]?.hash).toBe(
      createHash("sha256").update(migration).digest("hex"),
    );
    const rollback = new Error("rollback-cost-ddl");
    await expect(
      withDbTransaction(async (tx) => {
        await tx.execute(
          sql`alter table stock.movement drop column consumption_unit_cost, drop column consumption_loss_factor, drop column consumption_currency_code, drop column consumption_minor_units`,
        );
        for (const statement of migration.split("--> statement-breakpoint"))
          await tx.execute(sql.raw(statement));
        const [row] = await tx
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.id, movementId));
        expect(row).toMatchObject({
          quantity: "-3.000",
          totalCost: null,
          consumptionUnitCost: null,
          consumptionLossFactor: null,
          consumptionCurrencyCode: null,
          consumptionMinorUnits: null,
        });
        const column = await tx.execute(
          sql`select is_nullable from information_schema.columns where table_schema='stock' and table_name='movement' and column_name='location_id'`,
        );
        expect(column.rows[0]?.is_nullable).toBe("YES");
        throw rollback;
      }),
    ).rejects.toBe(rollback);
  });

  it("rejects partial, nonfinite, negative and nonconsumption snapshots; accepts unknown, zero and max finite", async () => {
    const fresh = {
      consumptionUnitCost: "0.000000",
      consumptionLossFactor: "1.000000",
      consumptionCurrencyCode: "USD",
      consumptionMinorUnits: 2,
    };
    const invalid = [
      { ...fresh, consumptionUnitCost: "-0.000001" },
      { ...fresh, consumptionUnitCost: "NaN" },
      { ...fresh, consumptionUnitCost: "Infinity" },
      { ...fresh, consumptionUnitCost: "100000000" },
      { ...fresh, consumptionLossFactor: "0.999999" },
      { ...fresh, consumptionLossFactor: "NaN" },
      { ...fresh, consumptionLossFactor: "Infinity" },
      { ...fresh, consumptionLossFactor: null },
      { ...fresh, consumptionCurrencyCode: null },
      { ...fresh, consumptionMinorUnits: null },
      { ...fresh, consumptionMinorUnits: 3 },
      { ...fresh, consumptionCurrencyCode: "usd" },
      { ...fresh, kind: "purchase", quantity: "3" },
      { ...fresh, kind: "adjustment", countedQuantity: "1" },
    ];
    for (const change of invalid)
      await expect(
        getDb()
          .update(stockMovements)
          .set(change)
          .where(eq(stockMovements.id, movementId)),
      ).rejects.toBeDefined();
    for (const consumptionUnitCost of [null, "0.000000", "99999999.999999"]) {
      await getDb()
        .update(stockMovements)
        .set({ ...fresh, consumptionUnitCost })
        .where(eq(stockMovements.id, movementId));
      const [row] = await getDb()
        .select()
        .from(stockMovements)
        .where(eq(stockMovements.id, movementId));
      expect(row.consumptionUnitCost).toBe(consumptionUnitCost);
    }
  });
});
