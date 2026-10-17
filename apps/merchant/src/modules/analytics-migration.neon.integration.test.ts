import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { beforeAll, describe, expect, it } from "vitest";
import { permisosIntegrationEnabled } from "../server/permissions-integration-support";

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
const ciReplay = process.env.ANALYTICS_MIGRATION_CI_REPLAY === "true";
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
const analyticsTables = [
  "calendar_event",
  "card_candidate",
  "card_state",
  "city",
  "city_zone",
  "daily_metric",
  "dimension_label",
  "evaluation_run",
  "metric_contribution",
  "source_revision",
  "weather",
  "zone",
];

async function replayOriginalCiMigration() {
  if (bootstrapPatch)
    throw new Error("CI replay and performance patch conflict");
  const isolatedUrl = process.env.NEON_INTEGRATION_DATABASE_URL;
  if (!permisosIntegrationEnabled || !isolatedUrl)
    throw new Error("CI replay requires the isolated wrapper");
  let endpoint = new URL(isolatedUrl).hostname.split(".")[0].toLowerCase();
  while (/-pooler$|-rvr$/.test(endpoint))
    endpoint = endpoint.replace(/-pooler$|-rvr$/, "");
  const fingerprint = createHash("sha256")
    .update(endpoint)
    .digest("hex")
    .slice(0, 12);
  if (fingerprint !== "4e09cdfbd634")
    throw new Error("CI replay endpoint is outside the assigned allowlist");
  if (
    migrationHash !==
    "0836fdec3b0dcbde56eab184faed958f599a237532d9d23b0856aea9f5f7feac"
  )
    throw new Error("CI replay requires the frozen amended 0097");
  const journal = JSON.parse(
    readFileSync(
      new URL(
        "../../../../packages/db/drizzle/meta/_journal.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  expect(journal.entries.at(-1)).toMatchObject({
    idx: 97,
    when: journalTime,
    tag: "0097_analytics_an1",
  });

  const originalLedger = await withDbTransaction(async (tx) => {
    await tx.execute(
      sql`lock table drizzle.__drizzle_migrations,core.location in access exclusive mode`,
    );
    const before = await tx.execute(ledger);
    const applied = before.rows.filter(
      (row) => row.created_at === String(journalTime),
    );
    expect(applied).toHaveLength(1);
    expect(applied[0].hash).toBe(bootstrapHash);
    expect(before.rows.at(-1)).toEqual(applied[0]);
    const inventory = await tx.execute(sql`
      select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='analytics' and c.relkind='r' order by c.relname
    `);
    expect(inventory.rows.map((row) => row.relname)).toEqual(analyticsTables);
    const unexpectedObjects = await tx.execute(sql`
      select c.relname as name from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='analytics' and c.relkind not in ('r','i')
      union all select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='analytics'
    `);
    expect(unexpectedObjects.rows).toEqual([]);
    const cityForeignKey = await tx.execute(sql`
      select c.oid::text as oid from pg_constraint c
      where c.conname='location_city_id_city_id_fk'
        and c.conrelid='core.location'::regclass and c.contype='f'
        and c.connamespace='core'::regnamespace
        and c.confrelid='analytics.city'::regclass
        and c.conkey=array[(select attnum from pg_attribute
          where attrelid='core.location'::regclass and attname='city_id')]
        and c.confkey=array[(select attnum from pg_attribute
          where attrelid='analytics.city'::regclass and attname='id')]
    `);
    expect(cityForeignKey.rows).toHaveLength(1);
    const dependencies = await tx.execute(sql`
      with owned(classid,objid) as (
        select 'pg_class'::regclass,c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='analytics'
        union all select 'pg_type'::regclass,t.oid from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='analytics'
        union all select 'pg_namespace'::regclass,n.oid from pg_namespace n where n.nspname='analytics'
        union all select 'pg_constraint'::regclass,c.oid from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='analytics'
        union all select 'pg_attrdef'::regclass,a.oid from pg_attrdef a join pg_class c on c.oid=a.adrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='analytics'
        union all select 'pg_trigger'::regclass,t.oid from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='analytics'
        union all select 'pg_rewrite'::regclass,r.oid from pg_rewrite r join pg_class c on c.oid=r.ev_class join pg_namespace n on n.oid=c.relnamespace where n.nspname='analytics'
        union all select 'pg_policy'::regclass,p.oid from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='analytics'
      )
      select distinct d.classid::regclass::text as class,d.objid::text as oid,d.objsubid,
        identified.type,identified.schema,identified.identity
      from pg_depend d join owned o on o.classid=d.refclassid and o.objid=d.refobjid
      cross join lateral pg_identify_object(d.classid,d.objid,d.objsubid) identified
      where not exists (select 1 from owned own where own.classid=d.classid and own.objid=d.objid)
        and not (identified.schema is not distinct from 'pg_toast' and d.deptype='i')
      order by class,oid,d.objsubid
    `);
    expect(dependencies.rows).toHaveLength(1);
    expect(dependencies.rows[0]).toMatchObject({
      class: "pg_constraint",
      oid: cityForeignKey.rows[0].oid,
      objsubid: 0,
    });
    const columnDependencies = await tx.execute(sql`
      select distinct d.classid::regclass::text as class,d.objid::text as oid
      from pg_depend d where d.refclassid='pg_class'::regclass
        and d.refobjid='core.location'::regclass
        and d.refobjsubid=(select attnum from pg_attribute
          where attrelid='core.location'::regclass and attname='city_id')
    `);
    expect(columnDependencies.rows).toEqual([
      { class: "pg_constraint", oid: cityForeignKey.rows[0].oid },
    ]);
    console.info("AN1 CI replay preflight passed", {
      fingerprint,
      tables: inventory.rows,
      externalDependencies: dependencies.rows,
      originalMigration: applied[0],
    });
    // Every destructive statement is inside this transaction, without CASCADE.
    await tx.execute(
      sql`alter table core.location drop constraint location_city_id_city_id_fk`,
    );
    await tx.execute(sql`alter table core.location drop column city_id`);
    for (const name of [
      "city_zone",
      "weather",
      "calendar_event",
      "card_candidate",
      "card_state",
      "daily_metric",
      "dimension_label",
      "evaluation_run",
      "metric_contribution",
      "source_revision",
      "city",
      "zone",
    ])
      await tx.execute(sql`drop table analytics.${sql.identifier(name)}`);
    await tx.execute(sql`drop schema analytics`);
    const removed = await tx.execute(sql`
      delete from drizzle.__drizzle_migrations
      where id=${applied[0].id} and hash=${bootstrapHash} and created_at=${journalTime}
      returning id
    `);
    expect(removed.rows).toHaveLength(1);
    return before.rows;
  });

  // Reapply through the same official command used by tools/neon-test.sh.
  // The URL comes only from that wrapper's already-validated isolated target.
  const result = await promisify(execFile)(
    "pnpm",
    ["--filter", "@mi-pasaporte/db", "db:migrate"],
    {
      cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
      env: { ...process.env, DATABASE_URL_UNPOOLED: isolatedUrl },
      timeout: 60000,
    },
  );
  console.info("AN1 CI official migration replay", result.stdout);
  const after = await getDb().execute(ledger);
  expect(
    after.rows.filter((row) => row.created_at !== String(journalTime)),
  ).toEqual(
    originalLedger.filter((row) => row.created_at !== String(journalTime)),
  );
  expect(after.rows.at(-1)).toMatchObject({
    hash: migrationHash,
    created_at: String(journalTime),
  });
}

describe.runIf(permisosIntegrationEnabled)(
  bootstrapPatch
    ? "AN1 original bootstrap + exact account-index patch (performance DB)"
    : ciReplay
      ? "AN1 guarded CI reset and official 0097 replay"
      : "AN1 official migration from an empty isolated database",
  { timeout: 60000 },
  () => {
    beforeAll(
      async () => {
        if (ciReplay) await replayOriginalCiMigration();
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
        identity: bootstrapPatch
          ? "bootstrap0097original+patch"
          : ciReplay
            ? "0097ciOfficialReplay"
            : "0097replay",
        definition: row.definition,
      });
    });
  },
);
