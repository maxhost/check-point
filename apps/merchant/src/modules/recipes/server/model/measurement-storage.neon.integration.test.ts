import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  moduleEvents,
  businesses,
  users,
  compositionRevisions,
  recipeSaleResolutions,
  recipeConsumptionSources,
  stockItems,
  stockMovements,
} from "@mi-pasaporte/db/schema";
import {
  seedModuleWorld,
  dropModuleWorld,
  enableModules,
  seedProduct,
  modulesIntegrationEnabled,
  type ModuleWorld,
} from "../../../modules-integration-support";
import { buildFinancialSettlementFromSnapshots } from "@mi-pasaporte/domain/financial";
import type { SaleClosedEventV4 } from "../../../../server/module-events/types";
import { decodeMeasuredSaleClosedEvent } from "../../../../server/module-events/decode";
import { createRecipe } from "../library";
import { saveComposition } from "../compositions";
import {
  publishSaleClosed,
  retryModuleEvents,
} from "../../../../server/module-events";

const migrationName = "0104_recipes_measurement_storage_expand";
const migration = readFileSync(
  new URL(
    `../../../../../../../packages/db/drizzle/${migrationName}.sql`,
    import.meta.url,
  ),
  "utf8",
);
const previous = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../../../packages/db/drizzle/meta/0103_snapshot.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const journal = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../../../packages/db/drizzle/meta/_journal.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const cloneSchema = `recipes_measure_${randomUUID().replaceAll("-", "")}`;
const tableNames = [
  "composition_revision",
  "sale_resolution",
  "consumption_source",
] as const;
let world: ModuleWorld | undefined;

async function catalogMetadata(schema: string, name: string) {
  const relation = `${schema}.${name}`;
  return {
    constraints: (
      await getDb().execute(
        sql`select conname, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=${relation}::regclass and contype in ('f','p','u') order by conname`,
      )
    ).rows,
    indexes: (
      await getDb().execute(
        sql`select indexname, indexdef from pg_indexes where schemaname=${schema} and tablename=${name} order by indexname`,
      )
    ).rows,
    triggers: (
      await getDb().execute(
        sql`select tgname, pg_get_triggerdef(oid) as definition from pg_trigger where tgrelid=${relation}::regclass and not tgisinternal order by tgname`,
      )
    ).rows,
  };
}

describe.skipIf(!modulesIntegrationEnabled)(
  "0242 recipes measurement storage (exclusive isolated DDL)",
  () => {
    beforeAll(async () => {
      world = await seedModuleWorld("recipes-measurement");
      await enableModules(world, ["stock", "recipes"]);
    }, 120_000);
    afterAll(async () => {
      await getDb().execute(
        sql.raw(`DROP SCHEMA IF EXISTS "${cloneSchema}" CASCADE`),
      );
      const ownerId = world?.ownerId,
        businessId = world?.businessId;
      await dropModuleWorld(world);
      if (ownerId)
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, ownerId)),
        ).toEqual([]);
      if (businessId)
        expect(
          await getDb()
            .select({ id: businesses.id })
            .from(businesses)
            .where(eq(businesses.id, businessId)),
        ).toEqual([]);
      expect(
        (
          await getDb().execute(
            sql`select nspname from pg_namespace where nspname=${cloneSchema}`,
          )
        ).rows,
      ).toEqual([]);
    }, 120_000);

    it("applies the exact canonical journal migration, preserves metadata and historical rows on private pre-expand clones", async () => {
      const entry = journal.entries.find(
        (e: { tag: string }) => e.tag === migrationName,
      );
      expect(entry.idx).toBe(104);
      expect(
        (
          await getDb().execute(
            sql`select hash from drizzle.__drizzle_migrations where created_at=${entry.when}`,
          )
        ).rows,
      ).toEqual([
        { hash: createHash("sha256").update(migration).digest("hex") },
      ]);
      await getDb().execute(sql.raw(`CREATE SCHEMA "${cloneSchema}"`));
      for (const name of tableNames) {
        const columns = (
          await getDb().execute(
            sql`select column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default from information_schema.columns where table_schema='recipes' and table_name=${name}`,
          )
        ).rows;
        if (name !== "consumption_source") {
          expect(columns).toContainEqual({
            column_name: "basis_quantity",
            data_type: "numeric",
            numeric_precision: 24,
            numeric_scale: 9,
            is_nullable: "NO",
            column_default: "'1'::numeric",
          });
          for (const [column_name, value] of [
            ["basis_unit", "unit"],
            ["conversion_version", "mass-si-1"],
          ])
            expect(columns).toContainEqual(
              expect.objectContaining({
                column_name,
                data_type: "text",
                is_nullable: "NO",
                column_default: `'${value}'::text`,
              }),
            );
        } else {
          expect(columns).toContainEqual(
            expect.objectContaining({
              column_name: "quantity_version",
              data_type: "integer",
              is_nullable: "NO",
              column_default: "1",
            }),
          );
          for (const column_name of [
            "exact_quantity_numerator",
            "exact_quantity_denominator",
            "recipe_quantity_numerator",
            "recipe_quantity_denominator",
          ])
            expect(columns).toContainEqual(
              expect.objectContaining({
                column_name,
                data_type: "text",
                is_nullable: "YES",
                column_default: null,
              }),
            );
          for (const [column_name, numeric_precision, numeric_scale] of [
            ["exact_quantity", 20, 6],
            ["recipe_quantity", 30, 3],
            ["allocated_quantity", 14, 3],
          ])
            expect(columns).toContainEqual(
              expect.objectContaining({
                column_name,
                data_type: "numeric",
                numeric_precision,
                numeric_scale,
              }),
            );
        }
      }
      const before = new Map();
      const metadata = new Map();
      for (const name of tableNames) {
        metadata.set(name, await catalogMetadata("recipes", name));
        const old = previous.tables[`recipes.${name}`];
        const columns = Object.values(old.columns).map((c: unknown) => {
          const column = c as {
            name: string;
            type: string;
            notNull: boolean;
            default?: string;
          };
          return `"${column.name}" ${column.type}${column.notNull ? " NOT NULL" : ""}${column.default === undefined ? "" : ` DEFAULT ${column.default}`}`;
        });
        const target = `"${cloneSchema}"."${name}"`,
          source = `"recipes"."${name}"`;
        const checks = Object.values(old.checkConstraints).map((c: unknown) => {
          const constraint = c as { name: string; value: string };
          return `CONSTRAINT "${constraint.name}" CHECK (${constraint.value.replaceAll(source, target)})`;
        });
        await getDb().execute(
          sql.raw(
            `CREATE TABLE ${target} (${[...columns, ...checks].join(",")})`,
          ),
        );
        // Clone rows come from coherent live legacy fixtures, not fabricated cross-resource IDs.
      }
      const fixture = await legacyFixture();
      for (const name of tableNames) {
        const oldColumns = Object.keys(
          previous.tables[`recipes.${name}`].columns,
        )
          .map((c) => `"${c}"`)
          .join(",");
        await getDb().execute(
          sql.raw(
            `INSERT INTO "${cloneSchema}"."${name}" (${oldColumns}) SELECT ${oldColumns} FROM "recipes"."${name}" WHERE business_id='${world!.businessId}'`,
          ),
        );
        before.set(
          name,
          (
            await getDb().execute(
              sql.raw(
                `SELECT ${oldColumns} FROM "${cloneSchema}"."${name}" ORDER BY id`,
              ),
            )
          ).rows,
        );
      }
      const statements = migration
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      expect(statements).toHaveLength(15);
      for (const statement of statements) {
        expect(
          tableNames.some((name) =>
            statement.startsWith(`ALTER TABLE "recipes"."${name}" `),
          ),
        ).toBe(true);
        let isolated = statement;
        for (const name of tableNames)
          isolated = isolated.replaceAll(
            `"recipes"."${name}"`,
            `"${cloneSchema}"."${name}"`,
          );
        expect(isolated).not.toContain('"recipes".');
        await getDb().execute(sql.raw(isolated));
      }
      for (const name of tableNames) {
        const oldColumns = Object.keys(
          previous.tables[`recipes.${name}`].columns,
        )
          .map((c) => `"${c}"`)
          .join(",");
        expect(
          (
            await getDb().execute(
              sql.raw(
                `SELECT ${oldColumns} FROM "${cloneSchema}"."${name}" ORDER BY id`,
              ),
            )
          ).rows,
        ).toEqual(before.get(name));
        expect(await catalogMetadata("recipes", name)).toEqual(
          metadata.get(name),
        );
        expect(metadata.get(name).triggers).toHaveLength(1);
        const defaults =
          name === "consumption_source"
            ? "quantity_version, exact_quantity_numerator, exact_quantity_denominator, recipe_quantity_numerator, recipe_quantity_denominator"
            : "basis_quantity::text, basis_unit, conversion_version";
        const rows = (
          await getDb().execute(
            sql.raw(`SELECT ${defaults} FROM "${cloneSchema}"."${name}"`),
          )
        ).rows;
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows)
          expect(row).toEqual(
            name === "consumption_source"
              ? {
                  quantity_version: 1,
                  exact_quantity_numerator: null,
                  exact_quantity_denominator: null,
                  recipe_quantity_numerator: null,
                  recipe_quantity_denominator: null,
                }
              : {
                  basis_quantity: "1.000000000",
                  basis_unit: "unit",
                  conversion_version: "mass-si-1",
                },
          );
      }
      expect(fixture.source.quantityVersion).toBe(1);
    }, 120_000);

    it("retains legacy writer/consumer behavior and rejects invalid bases on both real immutable tables", async () => {
      const { source } = await legacyFixture();
      expect(source).toMatchObject({
        quantityVersion: 1,
        exactQuantity: "0.001000",
        recipeQuantity: "1.000",
        exactQuantityNumerator: null,
        exactQuantityDenominator: null,
        recipeQuantityNumerator: null,
        recipeQuantityDenominator: null,
      });
      for (const table of [compositionRevisions, recipeSaleResolutions]) {
        const [original] = await getDb()
          .select()
          .from(table)
          .where(
            eq(
              table.id,
              table === compositionRevisions
                ? source.compositionRevisionId
                : source.resolutionId,
            ),
          );
        expect(original).toMatchObject({
          basisQuantity: "1.000000000",
          basisUnit: "unit",
          conversionVersion: "mass-si-1",
        });
        for (const patch of [
          { basisQuantity: "0" },
          { basisQuantity: "-1" },
          { basisQuantity: "NaN" },
          { basisQuantity: "1000000000" },
          { basisQuantity: "1.5" },
          { basisUnit: "oz" },
          { conversionVersion: "unknown" },
        ]) {
          await expect(
            getDb()
              .insert(table)
              .values({ ...original, id: randomUUID(), ...patch }),
          ).rejects.toMatchObject({ cause: { code: "23514" } });
        }
        for (const basisUnit of ["g", "kg", "lb"])
          await getDb()
            .insert(table)
            .values({
              ...original,
              id: randomUUID(),
              basisUnit,
              basisQuantity: "0.000000001",
            });
        await expect(
          getDb()
            .update(table)
            .set({ basisQuantity: "2" })
            .where(eq(table.id, original.id)),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      }
    }, 120_000);
    it("stores both nonterminating rational authorities as exact strings, permits zero projections and rejects incomplete/invalid sources", async () => {
      const { source: legacy } = await legacyFixture();
      const [composition] = await getDb()
        .select()
        .from(compositionRevisions)
        .where(eq(compositionRevisions.id, legacy.compositionRevisionId));
      const [resolution] = await getDb()
        .select()
        .from(recipeSaleResolutions)
        .where(eq(recipeSaleResolutions.id, legacy.resolutionId));
      const [measuredComposition] = await getDb()
        .insert(compositionRevisions)
        .values({
          ...composition,
          id: randomUUID(),
          basisQuantity: "1",
          basisUnit: "lb",
          recipes: composition.recipes.map((c) => ({
            ...c,
            quantity: "0.001",
          })),
        })
        .returning();
      const [measuredResolution] = await getDb()
        .insert(recipeSaleResolutions)
        .values({
          ...resolution,
          id: randomUUID(),
          compositionRevisionId: measuredComposition.id,
          basisQuantity: "1",
          basisUnit: "lb",
          components: resolution.components.map((c) => ({
            ...c,
            quantity: "0.001",
          })),
        })
        .returning();
      // Raw V4 exists only as a coherent storage fixture; no publisher/subscriber is connected.
      const sourceOrderId = randomUUID(),
        sourceLineId = randomUUID();
      const measure = {
        kind: "mass",
        quantityUnit: "g",
        priceUnit: "g",
        conversionVersion: "mass-si-1",
      } as const;
      const settlement = buildFinancialSettlementFromSnapshots({
        currencyCode: "USD",
        lines: [
          { sourceLineId, position: 0, quantity: "1", unitPrice: "0", measure },
        ],
        discount: null,
        payments: [],
      });
      const payload: SaleClosedEventV4 = {
        eventVersion: 4,
        sourceOrderId,
        locationId: world!.locationId,
        closedAt: new Date().toISOString(),
        userId: world!.ownerId,
        lines: [
          {
            ...settlement.lines[0],
            productId: legacy.productId,
            quantity: "1",
            measure,
            productLabel: composition.productNameAtComposition,
            commissionMinor: null,
            resourceVersions: [
              {
                providerId: "recipes",
                slot: "composition",
                versionId: measuredResolution.id,
              },
            ],
          },
        ],
        money: {
          gross: settlement.gross,
          discount: settlement.discount,
          roundingAdjustment: settlement.roundingAdjustment,
          collected: settlement.collected,
          currencyCode: settlement.currencyCode,
          minorUnit: settlement.minorUnit,
          originalGross: settlement.originals.gross,
          originalDiscount: settlement.originals.discount,
          originalNet: settlement.originals.net,
          normalizationAdjustments: settlement.normalizationAdjustments,
        },
        payments: [],
        paymentOriginals: [],
      };
      expect(decodeMeasuredSaleClosedEvent(payload)).toEqual(payload);
      const [event] = await getDb()
        .insert(moduleEvents)
        .values({
          businessId: world!.businessId,
          eventType: "sale.closed",
          eventVersion: 4,
          sourceId: sourceOrderId,
          locationId: world!.locationId,
          payload,
        })
        .returning();
      // 1 g / (45359237/100000 g) * .001 recipe * .001 ingredient.
      const valid = {
        ...legacy,
        id: randomUUID(),
        sourceOrderId,
        sourceLineId,
        eventId: event.id,
        compositionRevisionId: measuredComposition.id,
        resolutionId: measuredResolution.id,
        quantityVersion: 2,
        exactQuantity: "0",
        recipeQuantity: "0",
        allocatedQuantity: "0",
        exactQuantityNumerator: "1",
        exactQuantityDenominator: "453592370",
        recipeQuantityNumerator: "100",
        recipeQuantityDenominator: "45359237",
      };
      const ratioFields = [
        "exactQuantityNumerator",
        "exactQuantityDenominator",
        "recipeQuantityNumerator",
        "recipeQuantityDenominator",
      ] as const;
      const patches: Partial<typeof valid>[] = [
        { quantityVersion: 0 },
        { quantityVersion: 3 },
        { quantityVersion: 1 },
        { exactQuantity: "-0.000001" },
        { recipeQuantity: "-0.001" },
        { allocatedQuantity: "-0.001" },
        { exactQuantity: "NaN" },
        { recipeQuantity: "NaN" },
        { allocatedQuantity: "NaN" },
      ];
      for (const field of ratioFields)
        for (const invalid of [null, "0", "-1", "01", "+1", "NaN", "1.5", ""])
          patches.push({ [field]: invalid });
      for (const patch of patches)
        await expect(
          getDb()
            .insert(recipeConsumptionSources)
            .values({ ...valid, ...patch }),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      const legacyPatch = {
        ...valid,
        quantityVersion: 1,
        exactQuantity: "1",
        recipeQuantity: "1",
        exactQuantityNumerator: null,
        exactQuantityDenominator: null,
        recipeQuantityNumerator: null,
        recipeQuantityDenominator: null,
      };
      for (const patch of [
        { exactQuantity: "0" },
        { recipeQuantity: "0" },
        ...ratioFields.map((field) => ({ [field]: "1" })),
      ])
        await expect(
          getDb()
            .insert(recipeConsumptionSources)
            .values({ ...legacyPatch, ...patch }),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      const [stored] = await getDb()
        .insert(recipeConsumptionSources)
        .values(valid)
        .returning();
      expect(stored).toMatchObject({
        ...valid,
        exactQuantity: "0.000000",
        recipeQuantity: "0.000",
        allocatedQuantity: "0.000",
      });
      const [read] = await getDb()
        .select()
        .from(recipeConsumptionSources)
        .where(eq(recipeConsumptionSources.id, stored.id));
      for (const field of ratioFields) {
        expect(typeof read[field]).toBe("string");
        expect(read[field]).toBe(valid[field]);
      }
      expect(
        await getDb()
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.sourceOrderId, sourceOrderId)),
      ).toEqual([]);
      await expect(
        getDb()
          .update(recipeConsumptionSources)
          .set({ allocatedQuantity: "1" })
          .where(eq(recipeConsumptionSources.id, stored.id)),
      ).rejects.toMatchObject({ cause: { code: "23514" } });
    }, 120_000);
  },
);

async function legacyFixture() {
  const owner = world!;
  const [item] = await getDb()
    .insert(stockItems)
    .values({ businessId: owner.businessId, name: randomUUID(), unit: "g" })
    .returning();
  const recipe = await createRecipe(owner.businessId, {
    name: randomUUID(),
    lines: [{ itemId: item.id, quantity: "0.001" }],
  });
  const productId = await seedProduct(owner, randomUUID(), "1.00");
  await saveComposition(owner.businessId, productId, {
    isCombo: false,
    recipes: [{ recipeId: recipe.id, quantity: "1.000" }],
    expectedRevisionId: null,
  });
  const sourceOrderId = randomUUID(),
    sourceLineId = randomUUID();
  const event = await withDbTransaction((tx) =>
    publishSaleClosed(tx, {
      businessId: owner.businessId,
      sourceOrderId,
      locationId: owner.locationId,
      closedAt: new Date(),
      userId: owner.ownerId,
      lines: [{ sourceLineId, productId, quantity: 1 }],
    }),
  );
  expect(
    (
      await retryModuleEvents({
        businessId: owner.businessId,
        eventIds: [event!.eventId],
        force: true,
        budgetMs: 20000,
      })
    ).applied,
  ).toBe(1);
  const [source] = await getDb()
    .select()
    .from(recipeConsumptionSources)
    .where(eq(recipeConsumptionSources.sourceOrderId, sourceOrderId));
  expect(source).toBeDefined();
  expect(
    await getDb()
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.sourceOrderId, sourceOrderId)),
  ).toHaveLength(1);
  return { source };
}
