import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { beforeAll, describe, expect, it } from "vitest";

const enabled =
  process.env.NEON_INTEGRATION_ISOLATED === "true" &&
  !!process.env.NEON_INTEGRATION_DATABASE_URL;
const migration = readFileSync(
  new URL(
    "../../../../packages/db/drizzle/0097_analytics_an1.sql",
    import.meta.url,
  ),
  "utf8",
);
const migrationHash = createHash("sha256").update(migration).digest("hex");
// The seeded, disposable performance DB retains its truthful original ledger.
// Opt-in applies only the additive index DDL; it never claims a full replay.
const bootstrapPatch =
  process.env.ANALYTICS_MIGRATION_BOOTSTRAP_PATCH === "true";
const bootstrapHash =
  "247e7e684054f9ec462dd1a32f3dde9f96ec52ec6db23dac50ace032c03bf6d1";
const journalTime = 1792213123591;
const indexName = "analytics_daily_metric_account_idx";
const indexDdl = migration
  .split("--> statement-breakpoint")
  .find((statement) =>
    statement.trim().startsWith(`CREATE INDEX "${indexName}" `),
  );
const ledger = sql`select id,hash,created_at::text from drizzle.__drizzle_migrations order by created_at,id`;

describe.runIf(enabled)(
  bootstrapPatch
    ? "AN1 original bootstrap + exact account-index patch (performance DB)"
    : "AN1 official migration from an empty isolated database",
  { timeout: 60000 },
  () => {
    beforeAll(
      async () => {
        if (!bootstrapPatch) return;
        if (!indexDdl) throw new Error("0097 account index DDL is missing");
        await withDbTransaction(async (tx) => {
          const before = await tx.execute(ledger);
          const applied = before.rows.filter(
            (row) => row.created_at === String(journalTime),
          );
          expect(applied).toHaveLength(1);
          expect(applied[0].hash).toBe(bootstrapHash);
          expect(before.rows.at(-1)?.created_at).toBe(String(journalTime));
          const existing = await tx.execute(
            sql`select to_regclass('analytics.analytics_daily_metric_account_idx')::text as name`,
          );
          expect(existing.rows[0].name).toBeNull();
          await tx.execute(sql.raw(indexDdl));
          expect((await tx.execute(ledger)).rows).toEqual(before.rows);
        });
        console.info("AN1 bootstrap0097original+patch índice", {
          bootstrapHash,
          amendedMigrationHash: migrationHash,
          indexDdl: indexDdl.trim(),
        });
        // Building the partial index still scans the seeded 29M-row relation once.
      },
      bootstrapPatch ? 180000 : 60000,
    );

    it("retains the actual bootstrap hash or records the actual amended migration hash", async () => {
      const applied = await getDb().execute(
        sql`select hash from drizzle.__drizzle_migrations where created_at=${journalTime}`,
      );
      expect(applied.rows).toHaveLength(1);
      expect(applied.rows[0].hash).toBe(
        bootstrapPatch ? bootstrapHash : migrationHash,
      );
    });

    it("has the valid partial covering index with exactly the declared columns", async () => {
      const actual = await getDb().execute(sql`
        select i.indisvalid,i.indisready,i.indisunique,am.amname,
          i.indnkeyatts,i.indnatts,
          pg_get_expr(i.indpred,i.indrelid) as predicate,
          pg_get_indexdef(i.indexrelid) as definition,
          (select json_agg(a.attname order by k.position)
           from unnest(i.indkey) with ordinality k(attnum,position)
           join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum) as columns
        from pg_index i
        join pg_class c on c.oid=i.indexrelid
        join pg_namespace n on n.oid=c.relnamespace
        join pg_class t on t.oid=i.indrelid
        join pg_am am on am.oid=c.relam
        where n.nspname='analytics' and t.relname='daily_metric'
          and c.relname=${indexName}
      `);
      expect(actual.rows).toHaveLength(1);
      const row = actual.rows[0];
      expect(row).toMatchObject({
        indisvalid: true,
        indisready: true,
        indisunique: false,
        amname: "btree",
        indnkeyatts: 10,
        indnatts: 10,
        columns: [
          "business_id",
          "metric",
          "day",
          "location_id",
          "dimension_kind",
          "dimension_id",
          "currency_code",
          "minor_unit",
          "amount_minor",
          "count",
        ],
      });
      expect(row.predicate).toBe(
        "(metric = ANY (ARRAY['revenue'::text, 'expense_fixed'::text, 'expense_variable'::text]))",
      );
      console.info("AN1 account index verified", {
        identity: bootstrapPatch ? "bootstrap0097original+patch" : "0097replay",
        definition: row.definition,
      });
    });
  },
);
