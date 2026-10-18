import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  businessConfiguration,
  products,
  users,
} from "@mi-pasaporte/db/schema";
import {
  createProduct,
  updateProduct,
  listCatalog,
  ownerBusiness,
} from "@mi-pasaporte/domain/server/catalog";
import {
  readConfiguration,
  saveConfiguration,
} from "../../../server/business/configuration";
import {
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  seedPosWorld,
  type PosWorld,
} from "./pos-integration-support";

const migrationName = "0105_catalog_measure_storage_expand";
const migration = readFileSync(
  new URL(
    `../../../../../../packages/db/drizzle/${migrationName}.sql`,
    import.meta.url,
  ),
  "utf8",
);
const journal = JSON.parse(
  readFileSync(
    new URL(
      "../../../../../../packages/db/drizzle/meta/_journal.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { entries: { tag: string; when: number }[] };
const cloneSchema = `catalog_measure_${randomUUID().replaceAll("-", "")}`;
const productTable = `"${cloneSchema}"."product"`;
const configTable = `"${cloneSchema}"."business_configuration"`;
let world: PosWorld | undefined;

async function execute(statement: string) {
  return getDb().execute(sql.raw(statement));
}

// CI reservation includes isolated DDL and complete teardown. Run through neon-test.sh serially.
describe.skipIf(!posIntegrationEnabled)(
  "0242 CP2a catalog measure storage",
  () => {
    beforeAll(async () => {
      world = await seedPosWorld("CP2a catalog measure storage");
    }, 180_000);

    afterAll(async () => {
      await execute(`DROP SCHEMA IF EXISTS "${cloneSchema}" CASCADE`);
      const ownerId = world?.seed.userId;
      const businessId = world?.seed.business.id;
      await dropPosWorld(world);
      if (ownerId) {
        await getDb().delete(users).where(eq(users.id, ownerId));
        expect(
          await getDb()
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, ownerId)),
        ).toEqual([]);
      }
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
            sql`select nspname from pg_namespace where nspname = ${cloneSchema}`,
          )
        ).rows,
      ).toEqual([]);
    }, 180_000);

    it("verifies the canonical migration hash, actual types/defaults and permanent plus temporary checks", async () => {
      const entry = journal.entries.find(
        (entry) => entry.tag === migrationName,
      )!;
      expect(entry).toBeDefined();
      expect(
        (
          await getDb().execute(
            sql`select hash from drizzle.__drizzle_migrations where created_at = ${entry.when}`,
          )
        ).rows,
      ).toEqual([
        { hash: createHash("sha256").update(migration).digest("hex") },
      ]);
      const columns = await getDb().execute(
        sql`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'core' and ((table_name = 'product' and column_name in ('sold_by_weight', 'pricing_unit', 'sales_revision')) or (table_name = 'business_configuration' and column_name = 'sales_mass_units')) order by table_name, column_name`,
      );
      expect(columns.rows).toEqual([
        {
          table_name: "business_configuration",
          column_name: "sales_mass_units",
          data_type: "ARRAY",
          is_nullable: "NO",
          column_default: "ARRAY['kg'::text]",
        },
        {
          table_name: "product",
          column_name: "pricing_unit",
          data_type: "text",
          is_nullable: "NO",
          column_default: "'unit'::text",
        },
        {
          table_name: "product",
          column_name: "sales_revision",
          data_type: "integer",
          is_nullable: "NO",
          column_default: "1",
        },
        {
          table_name: "product",
          column_name: "sold_by_weight",
          data_type: "boolean",
          is_nullable: "NO",
          column_default: "false",
        },
      ]);
      const checks = await getDb().execute(
        sql`select conname from pg_constraint where conrelid in ('core.product'::regclass, 'core.business_configuration'::regclass) and contype = 'c' order by conname`,
      );
      for (const conname of [
        "product_sale_measure_check",
        "product_sale_measure_legacy_check",
        "product_sales_revision_check",
        "product_unit_price_legacy_check",
        "product_unit_cost_legacy_check",
        "business_configuration_sales_mass_units_check",
        "business_configuration_revision_check",
      ])
        expect(checks.rows).toContainEqual({ conname });
    });

    it("applies only canonical table-identifier substitutions to own old-definition tables, preserving complete rows and absence", async () => {
      await execute(`CREATE SCHEMA "${cloneSchema}"`);
      // LIKE copies every historical column/default/check/index, without copying foreign keys.
      // Only these own clones lose the new columns to reconstruct the immediately preceding definition.
      await execute(
        `CREATE TABLE ${productTable} (LIKE core.product INCLUDING ALL)`,
      );
      await execute(
        `ALTER TABLE ${productTable} DROP COLUMN sold_by_weight CASCADE, DROP COLUMN pricing_unit CASCADE, DROP COLUMN sales_revision CASCADE`,
      );
      await execute(
        `CREATE TABLE ${configTable} (LIKE core.business_configuration INCLUDING ALL)`,
      );
      await execute(
        `ALTER TABLE ${configTable} DROP COLUMN sales_mass_units CASCADE`,
      );
      const configId = randomUUID();
      const absentConfigId = randomUUID();
      await getDb().execute(
        sql`insert into ${sql.raw(configTable)} (business_id, revision) values (${configId}::uuid, 17)`,
      );
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      for (const [index, tariff] of [null, "0", "9999999999.99"].entries()) {
        await getDb().execute(
          sql`insert into ${sql.raw(productTable)} (id, business_id, category_id, name, unit_price, unit_cost, image_object_key, image_version, image_source, image_author, image_author_url, image_source_url, available_all_locations, created_at, updated_at) values (${ids[index]}::uuid, ${configId}::uuid, ${randomUUID()}::uuid, ${`Historical ${index}`}, ${tariff}::numeric, ${tariff}::numeric, 'private/image', 8, 'unsplash', 'Author', 'https://example.test/author', 'https://example.test/source', false, '2020-01-02T03:04:05.123456Z', '2021-06-07T08:09:10.654321Z')`,
        );
      }
      const before = (
        await execute(
          `SELECT to_jsonb(p) || jsonb_build_object('unit_price', p.unit_price::text, 'unit_cost', p.unit_cost::text) AS row FROM ${productTable} p ORDER BY id`,
        )
      ).rows;
      const configBefore = (
        await execute(
          `SELECT to_jsonb(c) AS row FROM ${configTable} c ORDER BY business_id`,
        )
      ).rows;
      const statements = migration
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      expect(statements).toHaveLength(8);
      for (const statement of statements) {
        expect(statement).toMatch(
          /^ALTER TABLE "core"\."(product|business_configuration)" ADD (COLUMN|CONSTRAINT) /,
        );
        const isolated = statement
          .replaceAll('"core"."product"', productTable)
          .replaceAll('"core"."business_configuration"', configTable);
        expect(isolated).not.toContain('"core".');
        await execute(isolated);
      }
      expect(
        (
          await execute(
            `SELECT (to_jsonb(p) - 'sold_by_weight' - 'pricing_unit' - 'sales_revision') || jsonb_build_object('unit_price', p.unit_price::text, 'unit_cost', p.unit_cost::text) AS row FROM ${productTable} p ORDER BY id`,
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await execute(
            `SELECT to_jsonb(c) - 'sales_mass_units' AS row FROM ${configTable} c ORDER BY business_id`,
          )
        ).rows,
      ).toEqual(configBefore);
      expect(
        (
          await getDb().execute(
            sql`select business_id from ${sql.raw(configTable)} where business_id = ${absentConfigId}::uuid`,
          )
        ).rows,
      ).toEqual([]);
      expect(
        (
          await execute(
            `SELECT sold_by_weight, pricing_unit, sales_revision FROM ${productTable}`,
          )
        ).rows,
      ).toEqual(
        ids.map(() => ({
          sold_by_weight: false,
          pricing_unit: "unit",
          sales_revision: 1,
        })),
      );
      expect(
        (await execute(`SELECT sales_mass_units, revision FROM ${configTable}`))
          .rows,
      ).toEqual([{ sales_mass_units: ["kg"], revision: 17 }]);
      await getDb().execute(
        sql`insert into ${sql.raw(productTable)} (business_id, name) values (${configId}::uuid, 'New legacy insert')`,
      );
      expect(
        (
          await execute(
            `SELECT sold_by_weight, pricing_unit, sales_revision FROM ${productTable} WHERE name = 'New legacy insert'`,
          )
        ).rows,
      ).toEqual([
        { sold_by_weight: false, pricing_unit: "unit", sales_revision: 1 },
      ]);

      // The real core barrier stays installed. Only this own table exercises the final model.
      await execute(
        `ALTER TABLE ${productTable} DROP CONSTRAINT product_sale_measure_legacy_check`,
      );
      for (const unit of ["kg", "lb", "g"])
        await execute(
          `UPDATE ${productTable} SET sold_by_weight = true, pricing_unit = '${unit}'`,
        );
      await execute(
        `UPDATE ${productTable} SET sold_by_weight = false, pricing_unit = 'unit'`,
      );
      for (const patch of [
        "sold_by_weight = true, pricing_unit = 'unit'",
        "sold_by_weight = false, pricing_unit = 'kg'",
        "sold_by_weight = false, pricing_unit = 'lb'",
        "sold_by_weight = false, pricing_unit = 'g'",
        "sold_by_weight = true, pricing_unit = 'oz'",
        "sold_by_weight = false, pricing_unit = 'oz'",
      ])
        await expect(
          execute(`UPDATE ${productTable} SET ${patch}`),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
    }, 120_000);

    it("keeps mass dormant, rejects nonpositive revisions/nulls and preserves tariff barriers in real core", async () => {
      const [product] = await getDb()
        .insert(products)
        .values({
          businessId: world!.seed.business.id,
          name: "Real barriers",
          unitPrice: "0",
          unitCost: null,
        })
        .returning();
      expect(product).toMatchObject({
        soldByWeight: false,
        pricingUnit: "unit",
        salesRevision: 1,
      });
      for (const unit of ["kg", "lb", "g"])
        await expect(
          getDb()
            .update(products)
            .set({ soldByWeight: true, pricingUnit: unit })
            .where(eq(products.id, product.id)),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      for (const revision of [0, -1])
        await expect(
          getDb()
            .update(products)
            .set({ salesRevision: revision })
            .where(eq(products.id, product.id)),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      for (const column of ["sold_by_weight", "pricing_unit", "sales_revision"])
        await expect(
          getDb().execute(
            sql`update core.product set ${sql.raw(column)} = null where id = ${product.id}::uuid`,
          ),
        ).rejects.toMatchObject({ cause: { code: "23502" } });
      for (const column of ["unitPrice", "unitCost"] as const)
        for (const value of ["-0.01", "10000000000", "0.001", "NaN"])
          await expect(
            getDb()
              .update(products)
              .set({ [column]: value })
              .where(eq(products.id, product.id)),
          ).rejects.toMatchObject({ cause: { code: "23514" } });
      expect(
        (
          await getDb()
            .select()
            .from(products)
            .where(eq(products.id, product.id))
        )[0],
      ).toEqual(product);
    }, 60_000);

    it("accepts all ordered nonempty unique mass subsets and rejects empty/duplicate/unknown/null configuration without revision changes", async () => {
      const businessId = world!.seed.business.id;
      expect(
        await getDb()
          .select()
          .from(businessConfiguration)
          .where(eq(businessConfiguration.businessId, businessId)),
      ).toEqual([]);
      expect(await readConfiguration(businessId, "regional")).toMatchObject({
        revision: 1,
      });
      expect(
        await getDb()
          .select()
          .from(businessConfiguration)
          .where(eq(businessConfiguration.businessId, businessId)),
      ).toEqual([]);
      const [initial] = await getDb()
        .insert(businessConfiguration)
        .values({ businessId, revision: 17 })
        .returning();
      expect(initial).toEqual({
        businessId,
        revision: 17,
        salesMassUnits: ["kg"],
      });
      const permutations = (
        remaining: string[],
        prefix: string[] = [],
      ): string[][] =>
        remaining.flatMap((unit, index) => [
          [...prefix, unit],
          ...permutations(
            remaining.filter((_, i) => i !== index),
            [...prefix, unit],
          ),
        ]);
      for (const units of permutations(["kg", "lb", "g"])) {
        const [saved] = await getDb()
          .update(businessConfiguration)
          .set({ salesMassUnits: units })
          .where(eq(businessConfiguration.businessId, businessId))
          .returning();
        expect(saved).toEqual({
          businessId,
          revision: 17,
          salesMassUnits: units,
        });
      }
      for (const literal of [
        "ARRAY[]::text[]",
        "ARRAY['kg','kg']",
        "ARRAY['lb','lb']",
        "ARRAY['g','g']",
        "ARRAY['kg','oz']",
        "ARRAY[NULL]::text[]",
        "ARRAY['kg',NULL]",
      ])
        await expect(
          getDb().execute(
            sql`update core.business_configuration set sales_mass_units = ${sql.raw(literal)} where business_id = ${businessId}::uuid`,
          ),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      await expect(
        getDb().execute(
          sql`update core.business_configuration set sales_mass_units = null where business_id = ${businessId}::uuid`,
        ),
      ).rejects.toMatchObject({ cause: { code: "23502" } });
      for (const revision of [0, -1])
        await expect(
          getDb()
            .update(businessConfiguration)
            .set({ revision })
            .where(eq(businessConfiguration.businessId, businessId)),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
      await getDb()
        .update(businessConfiguration)
        .set({ salesMassUnits: ["lb", "kg"] })
        .where(eq(businessConfiguration.businessId, businessId));
      const regional = await readConfiguration(businessId, "regional");
      expect(
        await saveConfiguration(businessId, "regional", {
          ...regional,
          revision: 17,
        }),
      ).toMatchObject({ revision: 18 });
      expect(
        (
          await getDb()
            .select()
            .from(businessConfiguration)
            .where(eq(businessConfiguration.businessId, businessId))
        )[0],
      ).toEqual({ businessId, revision: 18, salesMassUnits: ["lb", "kg"] });
    }, 120_000);

    it("keeps legacy catalog/POS reads and order writes exact for null, zero and the historical tariff maximum", async () => {
      const w = world!;
      const rows = await getDb()
        .insert(products)
        .values(
          [null, "0", "9999999999.99"].map((unitPrice, index) => ({
            businessId: w.seed.business.id,
            name: `Compatible ${index}`,
            unitPrice,
            unitCost: unitPrice,
          })),
        )
        .returning();
      const owner = (await ownerBusiness(w.seed.userId))!;
      const created = await createProduct(owner, {
        name: "Legacy writer",
        unitPrice: "0",
        unitCost: null,
        availableAllLocations: true,
      });
      expect(
        (
          await getDb()
            .select()
            .from(products)
            .where(eq(products.id, created.id))
        )[0],
      ).toMatchObject({
        soldByWeight: false,
        pricingUnit: "unit",
        salesRevision: 1,
      });
      await updateProduct(owner, rows[2].id, {
        name: "Edited legacy maximum",
        unitPrice: "9999999999.99",
        unitCost: "9999999999.99",
        availableAllLocations: true,
      });
      expect(
        (
          await getDb()
            .select()
            .from(products)
            .where(eq(products.id, rows[2].id))
        )[0],
      ).toMatchObject({
        unitPrice: "9999999999.990000000",
        unitCost: "9999999999.990000000",
        soldByWeight: false,
        pricingUnit: "unit",
        salesRevision: 1,
      });
      const catalog = await listCatalog(owner);
      const response = await pos.catalog(w.ownerCookie, w.seed.locationId);
      expect(response.status).toBe(200);
      const posCatalog = await response.json();
      for (const [index, row] of rows.entries()) {
        const expected = [null, 0, 9999999999.99][index];
        expect(catalog.products.find((p) => p.id === row.id)).toMatchObject({
          unitPrice: expected,
          unitCost: expected,
        });
        const projected = posCatalog.products.find(
          (p: { id: string }) => p.id === row.id,
        );
        if (expected === null) expect(projected).toBeUndefined();
        else expect(projected).toMatchObject({ unitPrice: expected });
      }
      const order = await openOrder(w, [
        { productId: rows[2].id, quantity: 1 },
      ]);
      expect(order).toMatchObject({
        total: "9999999999.99",
        items: [
          {
            productId: rows[2].id,
            quantity: 1,
            unitPrice: "9999999999.99",
            lineTotal: "9999999999.99",
          },
        ],
      });
      expect(await (await pos.read(w.ownerCookie, order.id)).json()).toEqual(
        order,
      );
    }, 120_000);
  },
);
