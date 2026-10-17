import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
/** Explicit synthetic load from ADR0152§7: 29.2M product-revenue rows globally;
 * target commerce has all four product metrics, daily revenue and commission.
 * Other businesses intentionally lack those extra metrics: documented benchmark variant.
 * Only run through the isolated wrapper, ANALYTICS_PERF_SEED=1. Kept for cold measurement. */
describe.skipIf(
  !permisosIntegrationEnabled || process.env.ANALYTICS_PERF_SEED !== "1",
)("AN-1 explicit isolated performance seed", () => {
  it("seeds 1000 businesses × 730 days × 40 products and complete target summaries", async () => {
    const db = getDb();
    await db.execute(sql`insert into core.business(id,name,slug,country_code,timezone,currency_code)
      select md5('analytics-perf-business:'||n)::uuid,'Analytics synthetic '||n,'analytics-an1-perf-'||n,'EC','America/Guayaquil','USD' from generate_series(1,1000) n on conflict(id) do nothing`);
    for (let first = 1; first <= 1000; first += 10) {
      const last = first + 9;
      await db.execute(sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,dimension_id,amount_minor,currency_code,minor_unit,count)
        select md5('analytics-perf-business:'||b)::uuid,('2026-10-19'::date-d),'product_revenue','product',md5('analytics-perf-product:'||p)::uuid,1000,'USD',2,10
        from generate_series(${first}::int,${last}::int) b cross join generate_series(0,729) d cross join generate_series(1,40) p on conflict do nothing`);
      if (first === 1 || last % 100 === 0)
        console.log(`analytics perf seeded businesses ${last}/1000`);
    }
    await db.execute(sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,dimension_id,amount_minor,quantity,currency_code,minor_unit)
      select md5('analytics-perf-business:1')::uuid,('2026-10-19'::date-d),m.metric,'product',md5('analytics-perf-product:'||p)::uuid,m.amount,m.quantity,m.currency,m.unit
      from generate_series(0,729) d cross join generate_series(1,40) p cross join (values ('units_sold',0::bigint,10::numeric,''::text,0),('units_with_cost',0::bigint,10::numeric,''::text,0),('cost_of_goods',400::bigint,0::numeric,'USD'::text,2)) m(metric,amount,quantity,currency,unit) on conflict do nothing`);
    await db.execute(sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,amount_minor,currency_code,minor_unit,count)
      select md5('analytics-perf-business:1')::uuid,('2026-10-19'::date-d),m.metric,'none',m.amount,'USD',2,m.tickets from generate_series(0,729) d cross join(values('revenue',40000::bigint,400),('payment_commission',2000::bigint,0))m(metric,amount,tickets) on conflict do nothing`);
    await db.execute(
      sql`insert into analytics.dimension_label(business_id,kind,id,label,updated_at) select md5('analytics-perf-business:1')::uuid,'product',md5('analytics-perf-product:'||p)::uuid,'Producto '||p,now() from generate_series(1,40)p on conflict do nothing`,
    );
    await db.execute(sql`analyze analytics.daily_metric`);
    const stats = await db.execute(
      sql`select metric,count(*)::text rows from analytics.daily_metric where business_id in(select md5('analytics-perf-business:'||n)::uuid from generate_series(1,1000)n) group by metric order by metric`,
    );
    console.log("analytics perf cardinality", JSON.stringify(stats.rows));
    const size = await db.execute(
      sql`select pg_total_relation_size('analytics.daily_metric')::text bytes`,
    );
    console.log("analytics perf table bytes", size.rows[0]?.bytes);
    expect(
      Number(stats.rows.find((r) => r.metric === "product_revenue")?.rows),
    ).toBe(29_200_000);
  }, 1_200_000);
});
