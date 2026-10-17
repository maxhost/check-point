import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
describe.skipIf(
  !permisosIntegrationEnabled || process.env.ANALYTICS_PERF_PREPARE !== "1",
)("AN-1 stopped seed preflight for first cold observation", () => {
  it("cancels only residual synthetic statements, completes target and reports no writers", async () => {
    const db = getDb();
    const cancelled = await db.execute(
      sql`select pg_cancel_backend(pid) cancelled from pg_stat_activity where pid<>pg_backend_pid() and state='active' and query like '%analytics-perf-business:%'`,
    );
    console.log("PERF_CANCELLED_SEED_STATEMENTS", cancelled.rows.length);
    await db.execute(sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,dimension_id,amount_minor,quantity,currency_code,minor_unit)
      select md5('analytics-perf-business:1')::uuid,('2026-10-19'::date-d),m.metric,'product',md5('analytics-perf-product:'||p)::uuid,m.amount,m.quantity,m.currency,m.unit
      from generate_series(0,729) d cross join generate_series(1,40) p cross join (values ('units_sold',0::bigint,10::numeric,''::text,0),('units_with_cost',0::bigint,10::numeric,''::text,0),('cost_of_goods',400::bigint,0::numeric,'USD'::text,2)) m(metric,amount,quantity,currency,unit) on conflict do nothing`);
    await db.execute(sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,amount_minor,currency_code,minor_unit,count)
      select md5('analytics-perf-business:1')::uuid,('2026-10-19'::date-d),m.metric,'none',m.amount,'USD',2,m.tickets from generate_series(0,729) d cross join(values('revenue',40000::bigint,400),('payment_commission',2000::bigint,0))m(metric,amount,tickets) on conflict do nothing`);
    await db.execute(
      sql`insert into analytics.dimension_label(business_id,kind,id,label,updated_at) select md5('analytics-perf-business:1')::uuid,'product',md5('analytics-perf-product:'||p)::uuid,'Producto '||p,now() from generate_series(1,40)p on conflict do nothing`,
    );
    const target = await db.execute(
      sql`select metric,count(*)::int rows,min(day)::text first,max(day)::text last from analytics.daily_metric where business_id=md5('analytics-perf-business:1')::uuid group by metric order by metric`,
    );
    console.log("PERF_TARGET_CARDINALITY", JSON.stringify(target.rows));
    const size = await db.execute(
      sql`select pg_total_relation_size('analytics.daily_metric')::text bytes`,
    );
    console.log("PERF_TABLE_BYTES", size.rows[0]?.bytes);
    const writers = await db.execute(
      sql`select pid from pg_stat_activity where pid<>pg_backend_pid() and state='active' and query like '%analytics.daily_metric%' and query ~* '(insert|update|delete|copy)'`,
    );
    console.log("PERF_ACTIVE_WRITERS", writers.rows.length);
    expect(writers.rows).toHaveLength(0);
    expect(target.rows.find((r) => r.metric === "product_revenue")?.rows).toBe(
      29200,
    );
  }, 120000);
});

describe.skipIf(
  !permisosIntegrationEnabled ||
    process.env.ANALYTICS_PERF_FINAL_PREPARE !== "1",
)("AN-1 final exact-contract fixture, target only", () => {
  it("adds only28days of auxiliary summaries, coherent counts and one closed fixed expense", async () => {
    const db = getDb();
    const inserted =
      await db.execute(sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,dimension_id,amount_minor,currency_code,minor_unit,count)
      select md5('analytics-perf-business:1')::uuid,('2026-10-19'::date-d),m.metric,'product',md5('analytics-perf-product:'||p)::uuid,m.amount,'USD',2,10
      from generate_series(0,27)d cross join generate_series(1,40)p cross join(values('revenue_with_cost',1000::bigint),('payment_commission_with_cost',50::bigint))m(metric,amount) on conflict do nothing returning metric`);
    const updated = await db.execute(
      sql`update analytics.daily_metric set count=10 where business_id=md5('analytics-perf-business:1')::uuid and metric='cost_of_goods' and day between '2026-09-22'::date and '2026-10-19'::date returning day`,
    );
    const fixed =
      await db.execute(sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,dimension_id,amount_minor,currency_code,minor_unit)
      values(md5('analytics-perf-business:1')::uuid,'2026-09-01','expense_fixed','concept',md5('analytics-perf-fixed:1')::uuid,1000000,'USD',2) on conflict do nothing returning metric`);
    console.log(
      "PERF_FINAL_TARGET_ADDITIONS",
      JSON.stringify({
        auxiliaryRows: inserted.rows.length,
        updatedCogsCounts: updated.rows.length,
        closedFixedRows: fixed.rows.length,
      }),
    );
    expect(inserted.rows).toHaveLength(2240);
    expect(updated.rows).toHaveLength(1120);
    expect(fixed.rows).toHaveLength(1);
  }, 30000);
});

describe.skipIf(
  !permisosIntegrationEnabled || process.env.ANALYTICS_PERF_INVENTORY !== "1",
)("AN-3 performance inventory without changing fixtures", () => {
  it("records the truthful ledger, indexes, target cardinality and exact payload size", async () => {
    const { createHash } = await import("node:crypto");
    const { readFileSync } = await import("node:fs");
    const { inputStatement } = await import("../queries");
    const db = getDb();
    const writers = await db.execute(
      sql`select pid from pg_stat_activity where pid<>pg_backend_pid() and state='active' and query like '%analytics.%' and query ~* '(insert|update|delete|copy|create index)'`,
    );
    console.log("PERF_ACTIVE_WRITERS", writers.rows.length);
    expect(writers.rows).toHaveLength(0);
    const ledger = await db.execute(
      sql`select hash,created_at::text from drizzle.__drizzle_migrations order by created_at`,
    );
    const journal = JSON.parse(
      readFileSync(
        new URL(
          "../../../../../../packages/db/drizzle/meta/_journal.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const entry of journal.entries.filter(
      (e: { idx: number }) => e.idx >= 97,
    )) {
      const expected =
        entry.idx === 97
          ? "247e7e684054f9ec462dd1a32f3dde9f96ec52ec6db23dac50ace032c03bf6d1"
          : createHash("sha256")
              .update(
                readFileSync(
                  new URL(
                    `../../../../../../packages/db/drizzle/${entry.tag}.sql`,
                    import.meta.url,
                  ),
                ),
              )
              .digest("hex");
      expect(
        ledger.rows.find((r) => r.created_at === String(entry.when))?.hash,
      ).toBe(expected);
    }
    console.log("PERF_LEDGER_TAIL", JSON.stringify(ledger.rows.slice(-3)));
    const indexes = await db.execute(
      sql`select c.relname,pg_get_indexdef(i.indexrelid) definition,i.indisvalid,i.indisready from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid='analytics.daily_metric'::regclass order by c.relname`,
    );
    console.log("PERF_INDEX_INVENTORY", JSON.stringify(indexes.rows));
    expect(
      indexes.rows.find(
        (r) => r.relname === "analytics_daily_metric_account_idx",
      ),
    ).toMatchObject({ indisvalid: true, indisready: true });
    const cardinality = await db.execute(
      sql`select metric,count(*)::int rows,min(day)::text first,max(day)::text last from analytics.daily_metric where business_id=md5('analytics-perf-business:1')::uuid group by metric order by metric`,
    );
    console.log("PERF_TARGET_CARDINALITY", JSON.stringify(cardinality.rows));
    expect(
      cardinality.rows.find((r) => r.metric === "product_revenue")?.rows,
    ).toBe(29200);
    const h = createHash("md5")
      .update("analytics-perf-business:1")
      .digest("hex");
    const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    const payload = await db.execute(
      sql`select octet_length(row_to_json(snapshot)::text) bytes,(select sum(jsonb_array_length(g->5)) from jsonb_array_elements(to_jsonb(snapshot)->'metricGroups') g) metric_rows from (${inputStatement(id, new Date("2026-10-20T08:00:00Z"))}) snapshot`,
    );
    console.log("PERF_PAYLOAD", JSON.stringify(payload.rows));
  }, 60000);
});
