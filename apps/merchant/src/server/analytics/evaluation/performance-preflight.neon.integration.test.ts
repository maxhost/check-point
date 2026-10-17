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
