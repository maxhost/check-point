import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@mi-pasaporte/db";
import { businesses, posOrderItems, users } from "@mi-pasaporte/db/schema";
import {
  dropPosWorld,
  openOrder,
  posIntegrationEnabled,
  seedPosWorld,
  seedProduct,
  type PosWorld,
} from "./pos-integration-support";

const migrationName = "0103_quantity_legacy_storage_expand";
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
const cloneSchema = `quantity_expand_${randomUUID().replaceAll("-", "")}`;
const tables = [
  { schema: "core", name: "order_item", prefix: "order_item" },
  { schema: "pos", name: "pos_order_item", prefix: "pos_order_item" },
] as const;
let world: PosWorld | undefined;

// Exclusive CI reservation; no global type rollback, shared fixture mutation or truncation.
describe.skipIf(!posIntegrationEnabled)(
  "0242 quantity/snapshot expand (isolated DDL)",
  () => {
    beforeAll(async () => {
      world = await seedPosWorld("CP1b quantity storage");
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

    it("verifies canonical migration, numeric types, historical defaults and retained constraints/FKs/indexes", async () => {
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
      for (const table of tables) {
        const columns = (
          await getDb().execute(
            sql`select column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default from information_schema.columns where table_schema = ${table.schema} and table_name = ${table.name}`,
          )
        ).rows;
        for (const column_name of ["quantity", "unit_price_snapshot"])
          expect(columns).toContainEqual({
            column_name,
            data_type: "numeric",
            numeric_precision: 24,
            numeric_scale: 9,
            is_nullable: "NO",
            column_default: null,
          });
        for (const column_name of [
          "measure_kind",
          "quantity_unit",
          "price_unit",
          "conversion_version",
        ])
          expect(columns).toContainEqual(
            expect.objectContaining({
              column_name,
              data_type: "text",
              is_nullable: "NO",
              column_default: `'${column_name === "conversion_version" ? "mass-si-1" : "unit"}'::text`,
            }),
          );
        const constraints = (
          await getDb().execute(
            sql`select conname, contype, pg_get_constraintdef(oid) as definition from pg_constraint where conrelid = ${`${table.schema}.${table.name}`}::regclass`,
          )
        ).rows;
        for (const suffix of ["quantity", "price", "measure"])
          expect(constraints).toContainEqual(
            expect.objectContaining({
              conname: `${table.prefix}_${suffix}_legacy_check`,
              contype: "c",
            }),
          );
        expect(constraints).toContainEqual(
          expect.objectContaining({
            conname: `core_${table.name}_quantity_check`,
            contype: "c",
          }),
        );
        expect(constraints.filter((c) => c.contype === "f")).toHaveLength(2);
        if (table.schema === "core")
          expect(
            constraints
              .filter((c) => c.contype === "f")
              .every((c) => !String(c.definition).includes("REFERENCES pos.")),
          ).toBe(true);
        expect(
          (
            await getDb().execute(
              sql`select indexname from pg_indexes where schemaname = ${table.schema} and tablename = ${table.name}`,
            )
          ).rows,
        ).toContainEqual({ indexname: `core_${table.name}_order_idx` });
      }
    });

    it("preserves old IDs, monetary/JSON snapshots and complete legacy ranges by strict identifier-only SQL substitution", async () => {
      await getDb().execute(sql.raw(`CREATE SCHEMA "${cloneSchema}"`));
      const statements = migration
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      expect(statements).toHaveLength(18);
      for (const table of tables) {
        const target = `"${cloneSchema}"."${table.name}"`;
        const source = `"${table.schema}"."${table.name}"`;
        // The minimal clone carries exactly the old affected columns/checks, plus unchanged financial data.
        await getDb().execute(
          sql.raw(
            `CREATE TABLE ${target} (id uuid PRIMARY KEY, quantity integer NOT NULL CHECK (quantity > 0), unit_price_snapshot numeric(12,2) NOT NULL ${table.schema === "pos" ? "CHECK (unit_price_snapshot >= 0)" : ""}, line_total numeric(12,2), financial_snapshot jsonb)`,
          ),
        );
        const values = [
          { q: "1", p: "9999999999.99" },
          { q: "2147483647", p: "0.00" },
          ...(table.schema === "core" ? [{ q: "1", p: "-9999999999.99" }] : []),
        ];
        const ids: string[] = [];
        for (const v of values) {
          const id = randomUUID();
          ids.push(id);
          await getDb().execute(
            sql`insert into ${sql.raw(target)} (id, quantity, unit_price_snapshot, line_total, financial_snapshot) values (${id}::uuid, ${v.q}::integer, ${v.p}::numeric, '0.00', '{"gross":"0.00","original":"frozen"}'::jsonb)`,
          );
        }
        const select = `SELECT id, quantity::text, unit_price_snapshot::text, line_total::text, financial_snapshot FROM ${target} ORDER BY id`;
        const before = (await getDb().execute(sql.raw(select))).rows;
        const ownStatements = statements.filter((s) =>
          s.startsWith(`ALTER TABLE ${source} `),
        );
        expect(ownStatements).toHaveLength(9);
        for (const statement of ownStatements) {
          const isolated = statement.replaceAll(source, target);
          expect(isolated).not.toContain(source);
          await getDb().execute(sql.raw(isolated));
        }
        const after = (await getDb().execute(sql.raw(select))).rows;
        expect(after).toEqual(
          before.map((row) => ({
            ...row,
            quantity: `${row.quantity}.000000000`,
            unit_price_snapshot: `${row.unit_price_snapshot}0000000`,
          })),
        );
        const metadata = (
          await getDb().execute(
            sql.raw(
              `SELECT measure_kind, quantity_unit, price_unit, conversion_version FROM ${target}`,
            ),
          )
        ).rows;
        expect(metadata).toEqual(
          ids.map(() => ({
            measure_kind: "unit",
            quantity_unit: "unit",
            price_unit: "unit",
            conversion_version: "mass-si-1",
          })),
        );
        // Both canonical table definitions reject premature representations; no rounding is used by these cases.
        for (const assignment of [
          "quantity = 0",
          "quantity = -1",
          "quantity = 1.000000001",
          "quantity = 2147483648",
          "quantity = 'NaN'",
          "unit_price_snapshot = 0.001",
          "unit_price_snapshot = 10000000000",
          "unit_price_snapshot = 'NaN'",
          "measure_kind = 'mass'",
          "quantity_unit = 'kg'",
          "price_unit = 'lb'",
          "conversion_version = 'mass-si-2'",
        ]) {
          await expect(
            getDb().execute(
              sql.raw(
                `UPDATE ${target} SET ${assignment} WHERE id = '${ids[0]}'`,
              ),
            ),
          ).rejects.toMatchObject({ cause: { code: "23514" } });
          expect((await getDb().execute(sql.raw(select))).rows).toEqual(after);
        }
      }
    }, 120_000);

    it("writes string quantities on the actual migrated POS table, supplies coherent defaults and preserves rows after rejected updates", async () => {
      const productId = await seedProduct(world!, "Unit barrier", "0.00");
      const order = await openOrder(world!, [
        { productId, quantity: 2147483647 },
      ]);
      expect(order).toMatchObject({
        total: "0.00",
        items: [{ quantity: 2147483647, unitPrice: "0.00" }],
      });
      const before = await getDb()
        .select()
        .from(posOrderItems)
        .where(eq(posOrderItems.posOrderId, order.id));
      expect(before[0]).toMatchObject({
        quantity: "2147483647.000000000",
        unitPriceSnapshot: "0.000000000",
        measureKind: "unit",
        quantityUnit: "unit",
        priceUnit: "unit",
        conversionVersion: "mass-si-1",
      });
      for (const patch of [
        { quantity: "1.1" },
        { quantity: "2147483648" },
        { unitPriceSnapshot: "0.001" },
        { unitPriceSnapshot: "-0.01" },
        { measureKind: "mass" },
        { quantityUnit: "g" },
        { priceUnit: "kg" },
        { conversionVersion: "unknown" },
      ]) {
        await expect(
          getDb()
            .update(posOrderItems)
            .set(patch)
            .where(eq(posOrderItems.posOrderId, order.id)),
        ).rejects.toMatchObject({ cause: { code: "23514" } });
        expect(
          await getDb()
            .select()
            .from(posOrderItems)
            .where(eq(posOrderItems.posOrderId, order.id)),
        ).toEqual(before);
      }
    }, 120_000);
  },
);
