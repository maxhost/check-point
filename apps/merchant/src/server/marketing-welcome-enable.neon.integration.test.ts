import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { campaigns } from "@mi-pasaporte/db/schema";
import { enableTemplate, listTemplates } from "./marketing/template-store";
import {
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * «Bienvenida» — E1 of spec 0107 against a real database: the migration `0052`'s checks
 * refuse the shapes the API refuses, `GET templates` lists it FIRST with its block, and
 * `enable` with a coupon alone creates 15/3/50/`next_day`, no channel, no end. Every state
 * is READ BY SQL (ADR 0054).
 */

afterAll(dropCampaignWorlds, 120_000);

const GIFT = { couponLabel: "Un café gratis", couponCost: "1.20" };

/** The constraint of a Postgres error, in the error or any of its `cause`s. */
function constraintOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const pg = current as { code?: unknown; constraint?: unknown };
    if (pg.code === "23514") return String(pg.constraint);
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

async function insertWelcome(
  seed: { business: { id: string }; userId: string },
  over: Partial<typeof campaigns.$inferInsert>,
): Promise<string | null> {
  try {
    await getDb()
      .insert(campaigns)
      .values({
        businessId: seed.business.id,
        kind: "proximity",
        templateKey: "welcome",
        channelProximity: false,
        channelPush: false,
        name: "Bienvenida",
        status: "draft",
        message: "Hola",
        couponLabel: "Un café",
        couponCost: "1.00",
        couponKind: "free_product",
        welcomeValidDays: 15,
        welcomeReminderDays: 3,
        welcomeMonthlyCap: 50,
        welcomeRedeemFrom: "next_day",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        createdByUserId: seed.userId,
        ...over,
      });
    return null;
  } catch (error) {
    const constraint = constraintOf(error);
    if (constraint === null) throw error;
    return constraint;
  }
}

describe.skipIf(!integrationEnabled)("welcome template — E1", () => {
  it("the checks accept the valid shape and refuse channel, no coupon, a redemption cap and a reminder ≥ validity", async () => {
    const seed = await world("plus", "Welcome checks");
    expect(await insertWelcome(seed, {})).toBeNull();
    await getDb()
      .delete(campaigns)
      .where(eq(campaigns.businessId, seed.business.id));

    expect(await insertWelcome(seed, { channelPush: true })).toBe(
      "core_campaign_channel_check",
    );
    expect(
      await insertWelcome(seed, {
        couponLabel: null,
        couponCost: null,
        couponKind: null,
      }),
    ).toMatch(/^core_campaign_(coupon_all_or_nothing|welcome_shape)_check$/);
    expect(await insertWelcome(seed, { couponMaxRedemptions: 10 })).toMatch(
      /^core_campaign_(coupon_all_or_nothing|welcome_shape)_check$/,
    );
    expect(
      await insertWelcome(seed, {
        welcomeValidDays: 7,
        welcomeReminderDays: 7,
      }),
    ).toBe("core_campaign_welcome_reminder_days_check");
    // And the welcome columns are refused in any other template.
    expect(
      await insertWelcome(seed, {
        templateKey: "missed_you",
        channelProximity: true,
        couponLabel: null,
        couponCost: null,
        couponKind: null,
      }),
    ).toBe("core_campaign_welcome_shape_check");
  }, 120_000);

  it("GET templates lists welcome FIRST with its block", async () => {
    const seed = await world("plus", "Welcome list");
    const [first] = await listTemplates(seed.business.id);
    expect(first).toMatchObject({
      key: "welcome",
      channels: [],
      dormantDays: null,
      couponRequired: true,
      welcome: {
        validDays: { options: [7, 15, 30], default: 15 },
        reminderDays: { options: [1, 3, 7], default: 3 },
        monthlyCap: { min: 1, max: 10000, default: 50 },
        redeemFrom: {
          options: ["next_day", "same_visit"],
          default: "next_day",
        },
      },
      live: null,
    });
  }, 120_000);

  it("enable with a coupon alone creates 15/3/50/next_day, with no channel and no end", async () => {
    const seed = await world("plus", "Welcome enable");
    const created = await enableTemplate(
      seed.business.id,
      seed.userId,
      "welcome",
      GIFT,
    );
    const [row] = await getDb()
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, created.id));
    expect(row).toMatchObject({
      templateKey: "welcome",
      name: "Bienvenida",
      status: "active",
      channelProximity: false,
      channelPush: false,
      couponLabel: "Un café gratis",
      couponCost: "1.20",
      couponMaxRedemptions: null,
      endsAt: null,
      welcomeValidDays: 15,
      welcomeReminderDays: 3,
      welcomeMonthlyCap: 50,
      welcomeRedeemFrom: "next_day",
    });
    expect(created).toMatchObject({
      channels: [],
      welcome: {
        validDays: 15,
        reminderDays: 3,
        monthlyCap: 50,
        redeemFrom: "next_day",
      },
    });
    expect(
      await caught(() =>
        enableTemplate(seed.business.id, seed.userId, "welcome", {}),
      ),
    ).toMatchObject({
      status: 400,
      code: "validation",
      fields: { couponLabel: expect.any(String) },
    });
  }, 120_000);
});
