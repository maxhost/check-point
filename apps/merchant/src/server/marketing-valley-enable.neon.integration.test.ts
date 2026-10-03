import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { integrationEnabled } from "./locations-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { enableTemplate, listTemplates } from "./marketing/template-store";
import {
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * Spec 0113 — the migration `0058` (the DoD's `\d`, read from the catalog) and `enable` of
 * «Horas valle» (contract H3) against a real base. Apart from `marketing-valley…` only for
 * the size budget.
 */

afterAll(dropCampaignWorlds, 120_000);

describe.skipIf(!integrationEnabled || !campaignKindEnabled("valley"))(
  "valley — migration 0058 and enable",
  () => {
    it("the migration: the three tables, hours_version, the checks and the two partial uniques", async () => {
      const tables = await getDb().execute<{ table_name: string }>(sql`
      select table_name from information_schema.tables
      where table_schema = 'core'
        and table_name in ('location_hours', 'valley_window', 'valley_detection')
      order by table_name`);
      expect(tables.rows.map((r) => r.table_name)).toEqual([
        "location_hours",
        "valley_detection",
        "valley_window",
      ]);
      const column = await getDb().execute<{
        column_default: string;
        is_nullable: string;
      }>(sql`
      select column_default, is_nullable from information_schema.columns
      where table_schema = 'core' and table_name = 'location' and column_name = 'hours_version'`);
      expect(column.rows).toEqual([{ column_default: "0", is_nullable: "NO" }]);
      const indexes = await getDb().execute<{
        indexname: string;
        indexdef: string;
      }>(sql`
      select indexname, indexdef from pg_indexes where schemaname = 'core'
        and indexname in ('core_campaign_coupon_valley_unique', 'core_campaign_coupon_cross_unique')
      order by indexname`);
      expect(indexes.rows.map((r) => r.indexname)).toEqual([
        "core_campaign_coupon_cross_unique",
        "core_campaign_coupon_valley_unique",
      ]);
      expect(indexes.rows[0].indexdef).toMatch(
        /\(campaign_id, consumer_id\) WHERE \(\(cross_claimed_at IS NOT NULL\) AND \(valley_location_id IS NULL\)\)/,
      );
      expect(indexes.rows[1].indexdef).toMatch(
        /UNIQUE INDEX .*\(valley_location_id, consumer_id\) WHERE \(valley_location_id IS NOT NULL\)/,
      );
      const checks = await getDb().execute<{ conname: string }>(sql`
      select conname from pg_constraint where conname in (
        'core_location_hours_step_check', 'core_location_hours_range_check',
        'core_valley_window_hours_check', 'core_valley_window_source_check',
        'core_valley_detection_status_check', 'core_campaign_valley_shape_check',
        'core_campaign_valley_monthly_cap_check', 'core_campaign_coupon_valley_check')
      order by conname`);
      expect(checks.rows).toHaveLength(8);
    }, 60_000);

    it("enable «Horas valle» with a free-text reward → active, no channel, `valley` in the DTO, listed LAST", async () => {
      const seed = await world("plus", "Valle enable");
      const campaign = await enableTemplate(
        seed.business.id,
        seed.userId,
        "valley",
        {
          couponKind: "custom",
          couponLabel: "2x1 en cerveza",
          couponCost: "3.00",
        },
      );
      expect(campaign).toMatchObject({
        templateKey: "valley",
        status: "active",
        channels: [],
        couponKind: "custom",
        couponLabel: "2x1 en cerveza",
        couponMaxRedemptions: null,
        endsAt: null,
        cross: null,
        valley: { monthlyCap: 50 },
      });
      const templates = await listTemplates(seed.business.id);
      expect(templates.at(-1)).toMatchObject({
        key: "valley",
        live: { id: campaign.id },
      });
      // `custom` anywhere else is refused before the base.
      const error = await caught(() =>
        enableTemplate(seed.business.id, seed.userId, "cross", {
          couponKind: "custom",
          couponLabel: "2x1",
          couponCost: "1.00",
        }),
      );
      expect(error).toMatchObject({
        status: 400,
        fields: { couponKind: expect.any(String) },
      });
    }, 180_000);
  },
);
