import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedExtraLocation,
} from "./locations-integration-support";
import { seedLocation } from "./marketing-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { campaignLocations, campaigns } from "@mi-pasaporte/db/schema";
import { createCampaign, updateCampaign } from "./marketing/campaign-store";
import { TURNS_NOTICE, transitionCampaign } from "./marketing/campaign-actions";
import {
  disableTemplate,
  enableTemplate,
  listTemplates,
} from "./marketing/template-store";
import { TEMPLATES } from "@mi-pasaporte/domain/server/marketing/templates";
import {
  COMPOSER_ENABLED,
  campaignKindEnabled,
} from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import {
  campaignBody as body,
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * The prebuilt campaigns against a real database (spec 0101 / ADR 0092). Every state is
 * READ BY SQL: the returned DTO is never the oracle (ADR 0054). The HTTP layer —the
 * owner-only `disable`, the 201— is pinned by `marketing-routes.test.ts` and
 * `marketing-template-routes.test.ts`. The true race over the unique index lives in
 * `marketing-templates-race.neon.integration.test.ts`: the `Promise.all` case below is
 * settled by the select that runs before the insert, not by the index.
 */

afterAll(dropCampaignWorlds, 120_000);

/** Spec 0138: the mechanism runs on `cross`/`welcome` (ON); both demand a coupon. */
const GIFT = { couponLabel: "10% en tu clase", couponCost: "2.00" };
/** Spec 0143 (owner, 2026-10-03: «Exigir fecha de fin»): enabling a cross campaign needs an end. */
const ENDS = "2099-12-31T00:00:00.000Z";
const CROSS_GIFT = { ...GIFT, endsAt: ENDS };

async function doorsOf(campaignId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: campaignLocations.locationId })
    .from(campaignLocations)
    .where(eq(campaignLocations.campaignId, campaignId));
  return rows.map((row) => row.id).sort();
}

async function liveRuns(businessId: string, key: string) {
  return await getDb()
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.businessId, businessId),
        eq(campaigns.templateKey, key),
        inArray(campaigns.status, ["draft", "active", "paused"]),
      ),
    );
}

describe.skipIf(!integrationEnabled)("campaign templates", () => {
  it("lists the templates that are ON with no run on a business that never used them", async () => {
    const seed = await world("plus", "Templates list");
    const listed = await listTemplates(seed.business.id);
    expect(listed).toEqual(
      TEMPLATES.filter((template) => campaignKindEnabled(template.key)).map(
        (template) => ({ ...template, live: null, runs: [] }),
      ),
    );
  }, 120_000);

  it("enable creates an ACTIVE run with the defaults on every usable door", async () => {
    const seed = await world("plus", "Templates enable");
    const second = await seedExtraLocation(seed.business.id, "Segunda");
    // Not usable: the tick could never place a turn there.
    await seedLocation({
      businessId: seed.business.id,
      latitude: null,
      longitude: null,
    });
    await seedLocation({ businessId: seed.business.id, status: "archived" });

    const created = await enableTemplate(
      seed.business.id,
      seed.userId,
      "cross",
      CROSS_GIFT,
    );

    const [row] = await getDb()
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, created.id));
    expect(row).toMatchObject({
      kind: "proximity",
      templateKey: "cross",
      name: "Oferta cruzada",
      status: "active",
      dormantDays: 30,
      message: "Te esperamos con un regalo",
      couponLabel: GIFT.couponLabel,
      couponCost: GIFT.couponCost,
      couponMaxRedemptions: null,
      endsAt: new Date(ENDS),
      createdByUserId: seed.userId,
    });
    expect(row.activatedAt).toBeInstanceOf(Date);
    expect(await doorsOf(created.id)).toEqual([seed.locationId, second].sort());
    expect(created.templateKey).toBe("cross");
  }, 120_000);

  // Spec 0138: excluded doors exist only for PROXIMITY templates (cross/welcome refuse the
  // field with a 400): this mechanism is off while they are.
  it.skipIf(!campaignKindEnabled("win_back"))(
    "excludes exactly the excluded doors; excluding all is 409; a foreign one is 400",
    async () => {
      const seed = await world("plus", "Templates exclude");
      const theirs = await world("plus", "Templates exclude theirs");
      const second = await seedExtraLocation(seed.business.id, "Segunda");

      expect(
        await caught(() =>
          enableTemplate(seed.business.id, seed.userId, "win_back", {
            excludedLocationIds: [theirs.locationId],
          }),
        ),
      ).toMatchObject({
        status: 400,
        code: "validation",
        fields: { excludedLocationIds: expect.any(String) },
      });
      expect(
        await caught(() =>
          enableTemplate(seed.business.id, seed.userId, "win_back", {
            excludedLocationIds: [seed.locationId, second],
          }),
        ),
      ).toMatchObject({ status: 409, code: "no_usable_location" });
      expect(await liveRuns(seed.business.id, "win_back")).toEqual([]);

      const created = await enableTemplate(
        seed.business.id,
        seed.userId,
        "win_back",
        { excludedLocationIds: [seed.locationId] },
      );
      expect(await doorsOf(created.id)).toEqual([second]);
    },
    120_000,
  );

  it("refuses days outside the template's options, and a business without the plan", async () => {
    const seed = await world("plus", "Templates days");
    expect(
      await caught(() =>
        enableTemplate(seed.business.id, seed.userId, "cross", {
          ...CROSS_GIFT,
          dormantDays: 45,
        }),
      ),
    ).toMatchObject({
      status: 400,
      code: "validation",
      fields: { dormantDays: expect.any(String) },
    });
    const free = await world("free", "Templates free");
    expect(
      await caught(() =>
        enableTemplate(free.business.id, free.userId, "cross", CROSS_GIFT),
      ),
    ).toMatchObject({ status: 402, code: "plan_not_allowed" });
    expect(await liveRuns(free.business.id, "cross")).toEqual([]);
  }, 120_000);

  it("one live run per template: a second enable is 409, and two enables at once leave one run", async () => {
    const seed = await world("plus", "Templates twice");
    await enableTemplate(seed.business.id, seed.userId, "cross", CROSS_GIFT);
    expect(
      await caught(() =>
        enableTemplate(seed.business.id, seed.userId, "cross", CROSS_GIFT),
      ),
    ).toMatchObject({ status: 409, code: "template_already_live" });
    // The OTHER template is independent.
    await enableTemplate(seed.business.id, seed.userId, "welcome", GIFT);

    const race = await world("plus", "Templates race");
    const settled = await Promise.allSettled([
      enableTemplate(race.business.id, race.userId, "cross", CROSS_GIFT),
      enableTemplate(race.business.id, race.userId, "cross", CROSS_GIFT),
    ]);
    expect(settled.map((s) => s.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const lost = settled.find((s) => s.status === "rejected");
    expect(lost?.reason).toMatchObject({
      status: 409,
      code: "template_already_live",
    });
    expect(await liveRuns(race.business.id, "cross")).toHaveLength(1);
  }, 120_000);

  it("disable ENDS the run; on → off → on leaves two rows, the new one live and the old in runs", async () => {
    const seed = await world("plus", "Templates cycle");
    expect(
      await caught(() => disableTemplate(seed.business.id, "cross")),
    ).toMatchObject({ status: 404, code: "template_not_live" });
    expect(
      await caught(() => disableTemplate(seed.business.id, "birthday")),
    ).toMatchObject({ status: 404, code: "not_found" });

    const first = await enableTemplate(seed.business.id, seed.userId, "cross", {
      ...CROSS_GIFT,
      crossValidDays: 7,
    });
    const off = await disableTemplate(seed.business.id, "cross");
    expect(off.notice).toBe(TURNS_NOTICE);
    const [ended] = await getDb()
      .select({ status: campaigns.status, endedAt: campaigns.endedAt })
      .from(campaigns)
      .where(eq(campaigns.id, first.id));
    expect(ended.status).toBe("ended");
    expect(ended.endedAt).toBeInstanceOf(Date);

    const second = await enableTemplate(
      seed.business.id,
      seed.userId,
      "cross",
      CROSS_GIFT,
    );
    const rows = await getDb()
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.businessId, seed.business.id));
    expect(rows.map((r) => r.id).sort()).toEqual([first.id, second.id].sort());

    // Spec 0107: «Bienvenida» goes first in the catalog (spec 0138: `[welcome, cross]`).
    const [welcome, cross] = await listTemplates(seed.business.id);
    expect(cross.live?.id).toBe(second.id);
    expect(cross.live?.cross?.validDays).toBe(15);
    expect(cross.runs).toEqual([
      {
        id: first.id,
        status: "ended",
        activatedAt: expect.any(Date),
        endedAt: expect.any(Date),
      },
    ]);
    expect(welcome).toMatchObject({ live: null, runs: [] });
  }, 180_000);

  it("a template run is never PATCHed, not even paused", async () => {
    const seed = await world("plus", "Templates frozen");
    const run = await enableTemplate(
      seed.business.id,
      seed.userId,
      "cross",
      CROSS_GIFT,
    );
    await transitionCampaign(seed.business.id, run.id, "pause");
    expect(
      await caught(() =>
        updateCampaign(seed.business.id, run.id, { message: "Otro" }),
      ),
    ).toMatchObject({ status: 409, code: "template_not_editable" });
    const [kept] = await getDb()
      .select({ message: campaigns.message })
      .from(campaigns)
      .where(eq(campaigns.id, run.id));
    expect(kept.message).toBe("Te esperamos con un regalo");
  }, 120_000);

  // Spec 0138: the other half of the case above, split out because the composer is off.
  it.skipIf(!COMPOSER_ENABLED)(
    "a custom POST never carries a template",
    async () => {
      const seed = await world("plus", "Templates custom");
      const custom = await createCampaign(
        seed.business.id,
        seed.userId,
        body(seed, { templateKey: "missed_you" }),
      );
      const [row] = await getDb()
        .select({ templateKey: campaigns.templateKey })
        .from(campaigns)
        .where(eq(campaigns.id, custom.id));
      expect(row.templateKey).toBeNull();
    },
    120_000,
  );
});
