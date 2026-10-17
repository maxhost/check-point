import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
describe.skipIf(
  !permisosIntegrationEnabled || process.env.ANALYTICS_PERF_RESET !== "1",
)("AN-1 explicit target-only observation reset", () => {
  it("removes only the prepared target day and confirms no active writers", async () => {
    const result = await getDb()
      .execute(sql`with removed as(delete from analytics.card_candidate where business_id=md5('analytics-perf-business:1')::uuid and day='2026-10-20'::date returning id), reset as(delete from analytics.evaluation_run where business_id=md5('analytics-perf-business:1')::uuid and day='2026-10-20'::date returning business_id)
      select (select count(*)::int from removed) candidates,(select count(*)::int from reset) runs`);
    console.log("PERF_TARGET_RESET", JSON.stringify(result.rows));
    expect(result.rows[0]?.runs).toBe(1);
    const writers = await getDb().execute(
      sql`select pid from pg_stat_activity where pid<>pg_backend_pid() and state='active' and query like '%analytics.%' and query ~* '(insert|update|delete|copy)'`,
    );
    console.log("PERF_ACTIVE_WRITERS", writers.rows.length);
    expect(writers.rows).toHaveLength(0);
  }, 30000);
});
