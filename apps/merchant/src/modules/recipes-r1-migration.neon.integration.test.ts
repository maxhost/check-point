import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  products,
  productCategories,
  recipeLines,
  stockItems,
  recipeMigrationMappings,
  recipeEntities,
  moduleResourceVersions,
  independentRecipeLines,
  recipeSaleResolutions,
  recipeRevisions,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  seedModuleWorld,
  dropModuleWorld,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "./modules-integration-support";
import { preflightR1, cutoverR1 } from "./recipes/server/model/migration";
import { listMigrationRenames } from "./recipes/server/library";
let world: ModuleWorld;
beforeAll(async () => {
  world = await seedModuleWorld("R1 migration");
}, 120_000);
afterAll(async () => {
  await dropModuleWorld(world);
}, 120_000);
describe.skipIf(!modulesIntegrationEnabled)(
  "R1 data migration and verified cut",
  () => {
    it("measures actual duplicates, maps quantities x1, disambiguates reserved names and preserves corrections on replay", async () => {
      const [category] = await getDb()
        .insert(productCategories)
        .values({ businessId: world.businessId, name: "Bebidas" })
        .returning();
      const [item] = await getDb()
        .insert(stockItems)
        .values({
          businessId: world.businessId,
          name: "Carne migración",
          unit: "g",
        })
        .returning();
      const ids = Array.from({ length: 6 }, () => randomUUID()).sort();
      await getDb()
        .insert(products)
        .values(
          ids.map((id, i) => ({
            id,
            businessId: world.businessId,
            name: i < 3 ? "Pizza" : i < 5 ? "Empanada" : "Pizza (Bebidas)",
            categoryId: i < 3 ? category.id : null,
          })),
        );
      await getDb()
        .insert(recipeLines)
        .values(
          ids.slice(0, 5).map((productId) => ({
            businessId: world.businessId,
            productId,
            itemId: item.id,
            quantity: "125.250",
            position: 0,
          })),
        );
      const [legacy] = await getDb()
        .insert(recipeRevisions)
        .values({
          businessId: world.businessId,
          productId: ids[0],
          lines: [{ itemId: item.id, unit: "g", quantity: "125.250" }],
        })
        .returning();
      const rollback = new Error("ROLLBACK_R1_PROBE");
      try {
        await withDbTransaction(async (tx) => {
          const measured = await preflightR1(tx);
          expect(
            measured.duplicates.find((r) => r.scope === "recipes")!.groups,
          ).toBeGreaterThanOrEqual(2);
          const result = await cutoverR1(tx, { writersDrained: true });
          expect(result.migrated).toBeGreaterThanOrEqual(5);
          const mapping = await tx
            .select()
            .from(recipeMigrationMappings)
            .where(eq(recipeMigrationMappings.businessId, world.businessId));
          expect(mapping).toHaveLength(5);
          const assigned = new Map(
            mapping.map((m) => [m.productId, m.assignedName]),
          );
          expect(ids.slice(0, 3).map((id) => assigned.get(id))).toEqual([
            "Pizza",
            "Pizza (Bebidas) (2)",
            "Pizza (Bebidas) (3)",
          ]);
          expect(ids.slice(3, 5).map((id) => assigned.get(id))).toEqual([
            "Empanada",
            "Empanada (2)",
          ]);
          const lines = await tx
            .select()
            .from(independentRecipeLines)
            .where(eq(independentRecipeLines.businessId, world.businessId));
          expect(lines.map((l) => l.quantity)).toEqual(
            Array(5).fill("125.250"),
          );
          const resolutions = await tx
            .select()
            .from(recipeSaleResolutions)
            .where(eq(recipeSaleResolutions.businessId, world.businessId));
          expect(
            resolutions.every((r) => r.components[0].quantity === "1.000"),
          ).toBe(true);
          const pointers = await tx
            .select()
            .from(moduleResourceVersions)
            .where(
              and(
                eq(moduleResourceVersions.businessId, world.businessId),
                eq(moduleResourceVersions.providerId, "recipes"),
              ),
            );
          expect(pointers).toHaveLength(5);
          expect(pointers.every((p) => p.slot === "composition")).toBe(true);
          expect(
            (
              await tx
                .select()
                .from(recipeRevisions)
                .where(eq(recipeRevisions.id, legacy.id))
            )[0],
          ).toEqual(legacy);
          await tx
            .update(recipeEntities)
            .set({ name: "Corregido por el comercio" })
            .where(eq(recipeEntities.id, mapping[0].recipeId));
          expect((await cutoverR1(tx, { writersDrained: true })).migrated).toBe(
            0,
          );
          expect(
            await tx
              .select()
              .from(recipeMigrationMappings)
              .where(eq(recipeMigrationMappings.businessId, world.businessId)),
          ).toEqual(mapping);
          expect(
            (
              await tx
                .select()
                .from(recipeEntities)
                .where(eq(recipeEntities.id, mapping[0].recipeId))
            )[0].name,
          ).toBe("Corregido por el comercio");
          const bridge = await tx.execute(
            sql`select 1 from pg_trigger where tgname='recipes_bridge_revision'`,
          );
          expect(bridge.rows).toEqual([]);
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
      expect(
        (await listMigrationRenames(world.businessId, new URLSearchParams()))
          .renames,
      ).toEqual([]);
      expect(
        (
          await getDb().select().from(products).where(eq(products.id, ids[0]))
        )[0].name,
      ).toBe("Pizza");
    }, 120_000);
  },
);
