import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { breakLocation } from "./marketing-integration-support";
import { getDb } from "./db";
import { businesses, campaignLocations, campaigns } from "./schema";
import { seedReward } from "./counter-integration-support";
import { transitionCampaign } from "./marketing/campaign-actions";
import { enableTemplate, listTemplates } from "./marketing/template-store";
import {
  loadMarketingSettings,
  updateMarketingSettings,
} from "./marketing/push-settings";
import {
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * Spec 0103 §3 and §11 against a real database: `enable` with `channels`, and the
 * business's push hours. Every state is READ BY SQL. The HTTP layer of `settings` (400/200,
 * the guard) is pinned by `marketing-settings-route.test.ts`.
 */

afterAll(dropCampaignWorlds, 120_000);

async function row(id: string) {
  const [found] = await getDb()
    .select({
      channelProximity: campaigns.channelProximity,
      channelPush: campaigns.channelPush,
    })
    .from(campaigns)
    .where(eq(campaigns.id, id));
  return found;
}

async function doorsOf(id: string) {
  return await getDb()
    .select()
    .from(campaignLocations)
    .where(eq(campaignLocations.campaignId, id));
}

describe.skipIf(!integrationEnabled)("enable with channels", () => {
  it("push-only needs no usable door: created with NO door; proximity there is 409", async () => {
    const seed = await world("plus", "Push only no doors");
    await breakLocation(seed.locationId, "ungeocode");

    expect(
      await caught(() =>
        enableTemplate(seed.business.id, seed.userId, "win_back", {
          channels: ["proximity"],
        }),
      ),
    ).toMatchObject({ status: 409, code: "no_usable_location" });

    const created = await enableTemplate(
      seed.business.id,
      seed.userId,
      "win_back",
      { channels: ["push"] },
    );
    expect(await row(created.id)).toEqual({
      channelProximity: false,
      channelPush: true,
    });
    expect(await doorsOf(created.id)).toEqual([]);
    expect(created.channels).toEqual(["push"]);
  }, 120_000);

  it("no `channels` is BOTH, in the row, the DTO and the list; bad values are 400", async () => {
    const seed = await world("plus", "Push both");
    const created = await enableTemplate(
      seed.business.id,
      seed.userId,
      "missed_you",
      {},
    );
    expect(await row(created.id)).toEqual({
      channelProximity: true,
      channelPush: true,
    });
    expect(created.channels).toEqual(["proximity", "push"]);
    const [missedYou, winBack] = await listTemplates(seed.business.id);
    expect(missedYou.channels).toEqual(["proximity", "push"]);
    expect(missedYou.live?.channels).toEqual(["proximity", "push"]);
    expect(winBack.channels).toEqual(["proximity", "push"]);

    for (const channels of [[], ["sms"], ["push", "push"]])
      expect(
        await caught(() =>
          enableTemplate(seed.business.id, seed.userId, "win_back", {
            channels,
          }),
        ),
      ).toMatchObject({
        status: 400,
        code: "validation",
        fields: { channels: expect.any(String) },
      });
  }, 120_000);
});

/** Spec 0104 §3 and §8: the BALANCE templates at `enable`, and `activate` of a push-only
 * run. The world is a Puntos program with NO reward until the case seeds one. */
describe.skipIf(!integrationEnabled)(
  "enable/activate of the balance templates",
  () => {
    it("no reward → 409 no_loyalty_reward; with one, {} is push-only with its defaults", async () => {
      const seed = await world("plus", "Saldo enable");
      for (const key of ["near_reward", "unclaimed_reward"])
        expect(
          await caught(() =>
            enableTemplate(seed.business.id, seed.userId, key, {}),
          ),
        ).toMatchObject({
          status: 409,
          code: "no_loyalty_reward",
          message:
            "No se puede activar: necesitás un programa de fidelización con un premio.",
        });
      expect(
        await getDb()
          .select({ id: campaigns.id })
          .from(campaigns)
          .where(eq(campaigns.businessId, seed.business.id)),
      ).toEqual([]);

      await seedReward({
        programId: seed.programId,
        businessId: seed.business.id,
        pointsCost: 100,
      });
      const near = await enableTemplate(
        seed.business.id,
        seed.userId,
        "near_reward",
        {},
      );
      const unclaimed = await enableTemplate(
        seed.business.id,
        seed.userId,
        "unclaimed_reward",
        { rewardRepeat: "every_30_days" },
      );
      const [nearRow] = await getDb()
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, near.id));
      expect(nearRow).toMatchObject({
        status: "active",
        channelProximity: false,
        channelPush: true,
        dormantDays: 7,
        message: "¡Estás a {faltan} de tu premio!",
        nearRewardStamps: 2,
        nearRewardPercent: 20,
        rewardRepeat: null,
        couponLabel: null,
      });
      expect(near).toMatchObject({
        channels: ["push"],
        nearRewardStamps: 2,
        nearRewardPercent: 20,
        rewardRepeat: null,
      });
      expect(unclaimed).toMatchObject({
        channels: ["push"],
        dormantDays: 14,
        nearRewardStamps: null,
        rewardRepeat: "every_30_days",
      });
    }, 120_000);

    it("a push-only run paused with NO usable door activates again", async () => {
      const seed = await world("plus", "Saldo reactivar");
      await seedReward({
        programId: seed.programId,
        businessId: seed.business.id,
        pointsCost: 100,
      });
      const created = await enableTemplate(
        seed.business.id,
        seed.userId,
        "unclaimed_reward",
        {},
      );
      await breakLocation(seed.locationId, "ungeocode");
      await transitionCampaign(seed.business.id, created.id, "pause");
      const { campaign } = await transitionCampaign(
        seed.business.id,
        created.id,
        "activate",
      );
      expect(campaign.status).toBe("active");
      const [read] = await getDb()
        .select({ status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.id, created.id));
      expect(read.status).toBe("active");
    }, 120_000);
  },
);

describe.skipIf(!integrationEnabled)("marketing settings", () => {
  it("defaults to 9–21; a PATCH changes ONLY the session's business", async () => {
    const mine = await world("plus", "Settings mine");
    const theirs = await world("plus", "Settings theirs");
    expect(await loadMarketingSettings(mine.business.id)).toEqual({
      pushWindow: { startHour: 9, endHour: 21 },
      timeZone: "America/Guayaquil",
    });
    await updateMarketingSettings(mine.business.id, {
      pushWindow: { startHour: 8, endHour: 20 },
      businessId: theirs.business.id,
    });
    const read = async (id: string) =>
      (
        await getDb()
          .select({
            start: businesses.pushWindowStartHour,
            end: businesses.pushWindowEndHour,
          })
          .from(businesses)
          .where(eq(businesses.id, id))
      )[0];
    expect(await read(mine.business.id)).toEqual({ start: 8, end: 20 });
    expect(await read(theirs.business.id)).toEqual({ start: 9, end: 21 });
    expect(
      await caught(() =>
        updateMarketingSettings(mine.business.id, {
          pushWindow: { startHour: 21, endHour: 9 },
        }),
      ),
    ).toMatchObject({
      status: 400,
      fields: { pushWindow: expect.any(String) },
    });
    expect(await read(mine.business.id)).toEqual({ start: 8, end: 20 });
  }, 120_000);
});
