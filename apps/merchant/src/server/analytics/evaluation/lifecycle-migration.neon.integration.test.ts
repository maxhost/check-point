import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { permisosIntegrationEnabled } from "../../permissions-integration-support";
const uuid = (s: string) => {
  const h = createHash("md5").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const business = uuid("analytics-lifecycle-legacy-business");
const row = (id: string) => uuid("analytics-lifecycle-legacy:" + id);
const prepare = process.env.ANALYTICS_LIFECYCLE_LEGACY_PREPARE === "1";
const verify = process.env.ANALYTICS_LIFECYCLE_LEGACY_VERIFY === "1";
// Explicit recovery oracle: the first post run executed global cleanup before this file.
const afterCleanup =
  process.env.ANALYTICS_LIFECYCLE_VERIFY_AFTER_CLEANUP === "1";
describe.skipIf(!permisosIntegrationEnabled || (!prepare && !verify))(
  "0101 controlled legacy transition, two explicit wrapper phases",
  () => {
    it.runIf(prepare)(
      "prepares only its synthetic legacy commerce before the pending migration",
      async () => {
        const db = getDb();
        const shape = await db.execute(
          sql`select exists(select 1 from information_schema.columns where table_schema='analytics' and table_name='card_candidate' and column_name='policy_version') migrated`,
        );
        expect(shape.rows[0].migrated).toBe(false);
        const ledger = await db.execute(
          sql`select hash from drizzle.__drizzle_migrations order by created_at desc limit 1`,
        );
        expect(ledger.rows[0].hash).toBe(
          "d7be0529f9325bb3dbaa6d3517e10ad3ac9b59a677034f849c258289e5fcfe5a",
        );
        await db.execute(
          sql`insert into core.business(id,name,slug,country_code,timezone,currency_code) values(${business},'Analytics lifecycle legacy','analytics-lifecycle-legacy-fixture','EC','America/Guayaquil','USD')`,
        );
        const entries = [
          ["stock-old", "8", "stock-subject", "2026-10-13"],
          ["stock-new", "8", "stock-subject", "2026-10-16"],
          ["summary-old", "1", "2026-10-13", "2026-10-14"],
          ["summary-new", "1", "2026-10-16", "2026-10-17"],
          ["count", "9", "count-event:item", "2026-10-16"],
          ["customer", "11", "customer:old", "2026-10-16"],
          ["margin-new", "6", "product", "2026-10-16"],
          ["cost-unknown", "5", "cost-subject", "2026-10-16"],
          ["cost-origin-only", "5", "origin-only", "2026-10-16"],
          ["cost-invalid-origin", "5", "invalid-origin", "2026-10-16"],
        ];
        for (const [id, key, subject, day] of entries)
          await db.execute(
            sql`insert into analytics.card_candidate(id,business_id,card_key,subject_key,day,weight,amount_minor,currency_code,minor_unit,parameters,fingerprint) values(${row(id)},${business},${key},${subject},${day}::date,1,100,'USD',2,${JSON.stringify({ cardKey: key, subjectKey: subject, title: "LEGACY-CONTENT", body: "NEVER-COPY-TO-CONTROL", originDay: id === "cost-origin-only" ? "2026-01-01" : id === "cost-invalid-origin" ? "2026-02-31" : undefined })}::jsonb,${key === "6" ? "new-fingerprint" : "legacy-fingerprint"})`,
          );
        for (const [key, subject, status] of [
          ["8", "stock-subject", "accepted"],
          ["1", "2026-10-16", "dismissed"],
          ["9", "count-event:item", "dismissed"],
          ["6", "product", "dismissed"],
          ["5", "cost-subject", "dismissed"],
        ])
          await db.execute(
            sql`insert into analytics.card_state(business_id,card_key,subject_key,fingerprint,status,shown_days,last_shown_day) values(${business},${key},${subject},'legacy-fingerprint',${status},2,'2026-10-17')`,
          );
        await db.execute(
          sql`insert into analytics.daily_metric(business_id,day,metric,dimension_kind,amount_minor,currency_code,minor_unit,count) values(${business},'2026-10-16','revenue','none',1234,'USD',2,1)`,
        );
        console.log(
          "LIFECYCLE_LEGACY_PREPARED",
          JSON.stringify({
            business,
            candidates: 10,
            states: 5,
            metricAmountMinor: 1234,
          }),
        );
      },
      30000,
    );
    it.runIf(verify)(
      afterCleanup
        ? "verifies the existing post-transition state after the recorded cleanup interference"
        : "preserves identity/age/ignored periods and money without inventing resolution",
      async () => {
        const db = getDb();
        const contents = await db.execute(
          sql`select id,card_key,subject_key,day::text,episode_started_at,expires_at,policy_version,period from analytics.card_candidate where business_id=${business} order by card_key`,
        );
        expect(contents.rows).toHaveLength(afterCleanup ? 5 : 6);
        expect(contents.rows.find((c) => c.card_key === "8")).toMatchObject({
          id: row("stock-new"),
          card_key: "8",
          subject_key: "stock-subject",
          policy_version: "legacy",
        });
        expect(
          new Date(
            String(
              contents.rows.find((c) => c.card_key === "8")!.episode_started_at,
            ),
          ).toISOString(),
        ).toBe("2026-10-13T05:00:00.000Z");
        const oldOrigin = afterCleanup
          ? (
              await db.execute(
                sql`select status,episode_started_at,expires_at from analytics.card_state where business_id=${business} and candidate_id=${row("cost-origin-only")}`,
              )
            ).rows[0]
          : contents.rows.find((c) => c.id === row("cost-origin-only"))!;
        if (afterCleanup) {
          expect(oldOrigin.status).toBe("expired");
          expect(
            contents.rows.some((c) => c.id === row("cost-origin-only")),
          ).toBe(false);
        }
        expect(
          new Date(String(oldOrigin.episode_started_at)).toISOString(),
        ).toBe("2026-01-01T05:00:00.000Z");
        expect(new Date(String(oldOrigin.expires_at)).toISOString()).toBe(
          "2026-04-01T05:00:00.000Z",
        );
        const invalidOrigin = contents.rows.find(
          (c) => c.id === row("cost-invalid-origin"),
        )!;
        expect(
          new Date(String(invalidOrigin.episode_started_at)).toISOString(),
        ).toBe("2026-10-16T05:00:00.000Z");
        const controls = await db.execute(
          sql`select card_key,subject_key,candidate_id,status,context from analytics.card_state where business_id=${business} order by card_key`,
        );
        expect(controls.rows.find((c) => c.card_key === "1")).toMatchObject({
          subject_key: "summary",
          candidate_id: row("summary-new"),
          status: "ignored",
          context: {
            legacyOriginalStatus: "dismissed",
            legacyDecisionPeriod: "2026-10-16",
          },
        });
        expect(controls.rows.find((c) => c.card_key === "8")).toMatchObject({
          candidate_id: row("stock-new"),
          status: "open",
          context: { legacyOriginalStatus: "accepted" },
        });
        for (const key of ["5", "6", "9"])
          expect(controls.rows.find((c) => c.card_key === key)?.status).toBe(
            "open",
          );
        expect(JSON.stringify(controls.rows)).not.toContain("LEGACY-CONTENT");
        expect(JSON.stringify(controls.rows)).not.toContain(
          "NEVER-COPY-TO-CONTROL",
        );
        const money = await db.execute(
          sql`select amount_minor::text,count from analytics.daily_metric where business_id=${business}`,
        );
        expect(money.rows).toEqual([{ amount_minor: "1234", count: 1 }]);
        console.log(
          "LIFECYCLE_LEGACY_VERIFIED",
          JSON.stringify({
            business,
            remainingContent: afterCleanup ? 5 : 6,
            afterRecordedCleanup: afterCleanup,
            controls: controls.rows.length,
            metricAmountMinor: 1234,
          }),
        );
        await db.execute(sql`delete from core.business where id=${business}`);
      },
      30000,
    );
  },
);
