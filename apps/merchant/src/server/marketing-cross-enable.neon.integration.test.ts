import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { seedConsumer } from "./counter-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { campaignCoupons, campaigns } from "@mi-pasaporte/db/schema";
import { enableTemplate, listTemplates } from "./marketing/template-store";
import { getCampaign } from "./marketing/campaign-store";
import {
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * «Oferta cruzada» — the template (contract M1) and the migration `0057` against a real
 * base: `enable` with a coupon alone creates non_members/15/50 with no channel and `cross`
 * in the DTO; the checks refuse the shapes the API refuses; `membership_id` is nullable
 * ONLY for a claimed cross coupon, and the one-per-consumer unique is PARTIAL. Every state
 * is READ BY SQL (ADR 0054).
 */

afterAll(dropCampaignWorlds, 120_000);

const GIFT = { couponLabel: "10% en tu clase", couponCost: "2.00" };

function violated(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const pg = current as { code?: unknown; constraint?: unknown };
    if (pg.code === "23514" || pg.code === "23505")
      return String(pg.constraint);
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

async function attempt(work: () => Promise<unknown>): Promise<string | null> {
  try {
    await work();
    return null;
  } catch (error) {
    const constraint = violated(error);
    if (constraint === null) throw error;
    return constraint;
  }
}

describe.skipIf(!integrationEnabled)(
  "cross template — M1 and migration 0057",
  () => {
    it("the migration: membership_id nullable, cross_claimed_at, the checks and the PARTIAL unique", async () => {
      const column = await getDb().execute<{ is_nullable: string }>(sql`
      select is_nullable from information_schema.columns
      where table_schema = 'core' and table_name = 'campaign_coupon'
        and column_name = 'membership_id'`);
      expect(column.rows).toEqual([{ is_nullable: "YES" }]);
      const index = await getDb().execute<{ indexdef: string }>(sql`
      select indexdef from pg_indexes
      where schemaname = 'core' and indexname = 'core_campaign_coupon_cross_unique'`);
      // Spec 0113 (migration 0058) narrowed the predicate: a valley coupon is also a claim
      // but has its own unique per LOCATION, so it stays out of this one.
      expect(index.rows[0].indexdef).toMatch(
        /\(campaign_id, consumer_id\) WHERE \(\(cross_claimed_at IS NOT NULL\) AND \(valley_location_id IS NULL\)\)/,
      );
      const checks = await getDb().execute<{ conname: string }>(sql`
      select conname from pg_constraint
      where conname in ('core_campaign_cross_shape_check', 'core_campaign_cross_audience_check',
        'core_campaign_cross_valid_days_check', 'core_campaign_cross_monthly_cap_check',
        'core_campaign_coupon_membership_check')
      order by conname`);
      expect(checks.rows.map((row) => row.conname)).toEqual([
        "core_campaign_coupon_membership_check",
        "core_campaign_cross_audience_check",
        "core_campaign_cross_monthly_cap_check",
        "core_campaign_cross_shape_check",
        "core_campaign_cross_valid_days_check",
      ]);
    }, 60_000);

    it("enable with a coupon alone → active, no channel, `cross` in the DTO; GET templates lists it (last before «Horas valle»)", async () => {
      const seed = await world("plus", "Cross enable");
      const campaign = await enableTemplate(
        seed.business.id,
        seed.userId,
        "cross",
        GIFT,
      );
      expect(campaign).toMatchObject({
        templateKey: "cross",
        status: "active",
        channels: [],
        couponLabel: "10% en tu clase",
        couponMaxRedemptions: null,
        endsAt: null,
        welcome: null,
        cross: { audience: "non_members", validDays: 15, monthlyCap: 50 },
      });
      const [row] = await getDb()
        .select({
          audience: campaigns.crossAudience,
          validDays: campaigns.crossValidDays,
          cap: campaigns.crossMonthlyCap,
          dormantDays: campaigns.dormantDays,
        })
        .from(campaigns)
        .where(sql`${campaigns.id} = ${campaign.id}`);
      expect(row).toEqual({
        audience: "non_members",
        validDays: 15,
        cap: 50,
        dormantDays: 30,
      });
      const templates = await listTemplates(seed.business.id);
      // Spec 0113: «Horas valle» went after it; the cross offer is now second to last.
      expect(templates.at(-2)).toMatchObject({
        key: "cross",
        live: { id: campaign.id },
      });
      expect(templates.at(-1)).toMatchObject({ key: "valley" });
      // Another template's DTO says `cross: null`.
      const other = await enableTemplate(
        seed.business.id,
        seed.userId,
        "missed_you",
        {},
      );
      expect((await getCampaign(seed.business.id, other.id)).cross).toBeNull();
    }, 120_000);

    it("enable refuses each field of the contract's table with a 400 on it", async () => {
      const seed = await world("plus", "Cross enable 400");
      for (const [body, field] of [
        [{}, "couponLabel"],
        [{ ...GIFT, couponMaxRedemptions: 5 }, "couponMaxRedemptions"],
        [{ ...GIFT, channels: ["push"] }, "channels"],
        [{ ...GIFT, crossAudience: "members" }, "crossAudience"],
        [{ ...GIFT, crossValidDays: 10 }, "crossValidDays"],
        [{ ...GIFT, crossMonthlyCap: 0 }, "crossMonthlyCap"],
        [{ ...GIFT, dormantDays: 45 }, "dormantDays"],
        [{ ...GIFT, welcomeValidDays: 15 }, "welcomeValidDays"],
      ] as const) {
        const error = await caught(() =>
          enableTemplate(seed.business.id, seed.userId, "cross", body),
        );
        expect(error).toMatchObject({ status: 400, code: "validation" });
        expect(Object.keys(error.fields ?? {})).toContain(field);
      }
      const error = await caught(() =>
        enableTemplate(seed.business.id, seed.userId, "missed_you", {
          crossMonthlyCap: 5,
        }),
      );
      expect(Object.keys(error.fields ?? {})).toContain("crossMonthlyCap");
    }, 120_000);

    it("the checks refuse a cross without its parameters, with a channel or with a redemption cap, and a membership-less coupon that was not claimed", async () => {
      const seed = await world("plus", "Cross checks");
      const valid = {
        businessId: seed.business.id,
        kind: "proximity",
        templateKey: "cross",
        channelProximity: false,
        channelPush: false,
        name: "Oferta cruzada",
        status: "draft",
        message: "Hola",
        couponLabel: "Un café",
        couponCost: "1.00",
        couponKind: "free_product",
        crossAudience: "any",
        crossValidDays: 15,
        crossMonthlyCap: 50,
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        createdByUserId: seed.userId,
      } as const;
      const insert = (over: Partial<typeof campaigns.$inferInsert>) =>
        attempt(() =>
          getDb()
            .insert(campaigns)
            .values({ ...valid, ...over }),
        );
      expect(await insert({ crossMonthlyCap: null })).toBe(
        "core_campaign_cross_shape_check",
      );
      expect(await insert({ channelPush: true })).toBe(
        "core_campaign_channel_check",
      );
      expect(await insert({ couponMaxRedemptions: 3 })).toBe(
        "core_campaign_coupon_all_or_nothing_check",
      );
      expect(await insert({ crossAudience: "members" })).toBe(
        "core_campaign_cross_audience_check",
      );
      expect(
        // Another template WITHOUT a coupon (so only the cross parameters are wrong).
        await insert({
          templateKey: "missed_you",
          channelProximity: true,
          couponLabel: null,
          couponCost: null,
          couponKind: null,
        }),
      ).toBe("core_campaign_cross_shape_check");

      const [campaign] = await getDb()
        .insert(campaigns)
        .values(valid)
        .returning({ id: campaigns.id });
      const consumer = await seedConsumer();
      const coupon = (over: Partial<typeof campaignCoupons.$inferInsert>) =>
        attempt(() =>
          getDb()
            .insert(campaignCoupons)
            .values({
              campaignId: campaign.id,
              businessId: seed.business.id,
              consumerId: consumer.id,
              membershipId: null,
              labelSnapshot: "Un café",
              costSnapshot: "1.00",
              kindSnapshot: "free_product",
              validFrom: new Date(),
              validUntil: new Date(Date.now() + 86_400_000),
              ...over,
            }),
        );
      try {
        expect(await coupon({})).toBe("core_campaign_coupon_membership_check");
        expect(await coupon({ crossClaimedAt: new Date() })).toBeNull();
        expect(await coupon({ crossClaimedAt: new Date() })).toBe(
          "core_campaign_coupon_cross_unique",
        );
      } finally {
        await getDb()
          .delete(campaignCoupons)
          .where(sql`${campaignCoupons.campaignId} = ${campaign.id}`);
      }
    }, 120_000);
  },
);
