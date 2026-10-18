import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { businesses, products, users } from "@mi-pasaporte/db/schema";
import {
  listCatalog,
  ownerBusiness,
} from "@mi-pasaporte/domain/server/catalog";
import {
  dropPosWorld,
  openOrder,
  pos,
  posIntegrationEnabled,
  seedPosWorld,
  type PosWorld,
} from "./pos-integration-support";

const migrationName = "0102_catalog_legacy_storage_expand";
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
const cloneSchema = `catalog_expand_${randomUUID().replaceAll("-", "")}`;
const cloneTable = `"${cloneSchema}"."product"`;
let world: PosWorld | undefined;

// Run only via tools/neon-test.sh, in a serial invocation with CI reserved through teardown.
describe.skipIf(!posIntegrationEnabled)(
  "0242 catalog storage expand (isolated DDL)",
  () => {
    beforeAll(async () => {
      world = await seedPosWorld("CP1b catalog storage");
    }, 180_000);

    afterAll(async () => {
      await getDb().execute(
        sql.raw(`DROP SCHEMA IF EXISTS "${cloneSchema}" CASCADE`),
      );
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

    it("verifies canonical migration hash and actual nullable numeric(24,9) string storage", async () => {
      const entry = journal.entries.find(
        (entry) => entry.tag === migrationName,
      )!;
      expect(entry).toBeDefined();
      const applied = await getDb().execute(
        sql`select hash from drizzle.__drizzle_migrations where created_at = ${entry.when}`,
      );
      expect(applied.rows).toEqual([
        { hash: createHash("sha256").update(migration).digest("hex") },
      ]);
      const types = await getDb().execute(
        sql`select column_name, data_type, numeric_precision, numeric_scale, is_nullable from information_schema.columns where table_schema = 'core' and table_name = 'product' and column_name in ('unit_price', 'unit_cost') order by column_name`,
      );
      expect(types.rows).toEqual(
        ["unit_cost", "unit_price"].map((column_name) => ({
          column_name,
          data_type: "numeric",
          numeric_precision: 24,
          numeric_scale: 9,
          is_nullable: "YES",
        })),
      );
    });

    it("migrates an own old-definition table without loss or ID changes using only strict table substitution", async () => {
      await getDb().execute(sql.raw(`CREATE SCHEMA "${cloneSchema}"`));
      await getDb().execute(
        sql.raw(
          `CREATE TABLE ${cloneTable} (id uuid PRIMARY KEY, unit_price numeric(12,2), unit_cost numeric(12,2), CONSTRAINT product_unit_price_check CHECK (unit_price IS NULL OR unit_price >= 0), CONSTRAINT product_unit_cost_check CHECK (unit_cost IS NULL OR unit_cost >= 0))`,
        ),
      );
      const ids = [randomUUID(), randomUUID(), randomUUID()];
      for (const [index, value] of [null, "0.00", "9999999999.99"].entries())
        await getDb().execute(
          sql`insert into ${sql.raw(cloneTable)} (id, unit_price, unit_cost) values (${ids[index]}::uuid, ${value}::numeric, ${value}::numeric)`,
        );
      const before = await getDb().execute(
        sql.raw(
          `SELECT id, unit_price::text, unit_cost::text FROM ${cloneTable} ORDER BY id`,
        ),
      );
      expect(before.rows).toEqual(
        ids
          .map((id, index) => ({
            id,
            unit_price: [null, "0.00", "9999999999.99"][index],
            unit_cost: [null, "0.00", "9999999999.99"][index],
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      );
      const statements = migration
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);
      expect(statements).toHaveLength(4);
      for (const statement of statements) {
        expect(statement.startsWith('ALTER TABLE "core"."product" ')).toBe(
          true,
        );
        const isolated = statement.replaceAll('"core"."product"', cloneTable);
        expect(isolated).not.toContain('"core".');
        await getDb().execute(sql.raw(isolated));
      }
      const after = await getDb().execute(
        sql.raw(
          `SELECT id, unit_price::text, unit_cost::text FROM ${cloneTable} ORDER BY id`,
        ),
      );
      expect(after.rows).toEqual(
        ids
          .map((id, index) => ({
            id,
            unit_price: [null, "0.000000000", "9999999999.990000000"][index],
            unit_cost: [null, "0.000000000", "9999999999.990000000"][index],
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      );
    }, 60_000);

    it("rejects negative, non-cent and out-of-legacy-range tariffs on both actual columns without rounding", async () => {
      const [product] = await getDb()
        .insert(products)
        .values({
          businessId: world!.seed.business.id,
          name: "Barrier",
          unitPrice: "0",
          unitCost: null,
        })
        .returning();
      for (const field of ["unitPrice", "unitCost"] as const) {
        for (const value of [
          "-0.01",
          "10000000000.00",
          "0.001",
          "1.000000001",
          "NaN",
        ]) {
          await expect(
            getDb()
              .update(products)
              .set({ [field]: value })
              .where(eq(products.id, product.id)),
          ).rejects.toMatchObject({ cause: { code: "23514" } });
          const [unchanged] = await getDb()
            .select({ price: products.unitPrice, cost: products.unitCost })
            .from(products)
            .where(eq(products.id, product.id));
          expect(unchanged).toEqual({ price: "0.000000000", cost: null });
        }
      }
    }, 60_000);

    it("projects padded maximum/zero/null through current catalog/POS and adds at the authoritative legacy maximum", async () => {
      const w = world!;
      const rows = await getDb()
        .insert(products)
        .values(
          [null, "0.00", "9999999999.99"].map((value, index) => ({
            businessId: w.seed.business.id,
            name: `Legacy ${index}`,
            unitPrice: value,
            unitCost: value,
          })),
        )
        .returning();
      expect(rows.map((row) => [row.unitPrice, row.unitCost])).toEqual([
        [null, null],
        ["0.000000000", "0.000000000"],
        ["9999999999.990000000", "9999999999.990000000"],
      ]);
      const owner = (await ownerBusiness(w.seed.userId))!;
      const catalog = await listCatalog(owner);
      const response = await pos.catalog(w.ownerCookie, w.seed.locationId);
      expect(response.status).toBe(200);
      const posCatalog = await response.json();
      for (const [index, row] of rows.entries()) {
        const expected = [null, 0, 9999999999.99][index];
        expect(
          catalog.products.find((product) => product.id === row.id),
        ).toMatchObject({ unitPrice: expected, unitCost: expected });
        const posProduct = posCatalog.products.find(
          (product: { id: string }) => product.id === row.id,
        );
        if (expected === null) expect(posProduct).toBeUndefined();
        else expect(posProduct).toMatchObject({ unitPrice: expected });
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
