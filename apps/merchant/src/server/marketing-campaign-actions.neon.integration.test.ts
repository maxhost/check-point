import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  integrationEnabled,
  seedExtraLocation,
} from "./locations-integration-support";
import { getDb } from "./db";
import { locations } from "./schema";
import {
  createCampaign,
  getCampaign,
  updateCampaign,
} from "./marketing/campaign-store";
import { TURNS_NOTICE, transitionCampaign } from "./marketing/campaign-actions";
import {
  campaignBody as body,
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * The four buttons and the guards of `activate` (spec 0065 phase B). The pure transition
 * table has its own unit suite; what only Postgres answers is here: that a door must be
 * active AND geocoded, that the plan gate reads the real subscription, and that pausing
 * says out loud that the turns are retired by the TICK and not by the route.
 */

afterAll(dropCampaignWorlds, 120_000);

describe.skipIf(!integrationEnabled)("campaigns: the four transitions", () => {
  it("walks the four transitions and refuses the ones outside the table", async () => {
    const seed = await world("plus", "Campaign walk");
    const draft = await createCampaign(
      seed.business.id,
      seed.userId,
      body(seed),
    );

    const activated = await transitionCampaign(
      seed.business.id,
      draft.id,
      "activate",
    );
    expect(activated.campaign.status).toBe("active");
    expect(activated.campaign.activatedAt).toBeInstanceOf(Date);
    expect(activated.notice).toBeUndefined();

    const paused = await transitionCampaign(
      seed.business.id,
      draft.id,
      "pause",
    );
    expect(paused.campaign).toMatchObject({
      status: "paused",
      pauseReason: "owner",
    });
    // The turns are NOT retired by the route: the answer has to say so.
    expect(paused.notice).toBe(TURNS_NOTICE);

    const resumed = await transitionCampaign(
      seed.business.id,
      draft.id,
      "activate",
    );
    expect(resumed.campaign).toMatchObject({
      status: "active",
      pauseReason: null,
    });
    // First activation wins: resuming must not erase «desde cuándo existe».
    expect(resumed.campaign.activatedAt).toEqual(
      activated.campaign.activatedAt,
    );

    const ended = await transitionCampaign(seed.business.id, draft.id, "end");
    expect(ended.campaign.status).toBe("ended");
    expect(ended.campaign.endedAt).toBeInstanceOf(Date);
    expect(ended.notice).toBe(TURNS_NOTICE);

    const archived = await transitionCampaign(
      seed.business.id,
      draft.id,
      "archive",
    );
    expect(archived.campaign.status).toBe("archived");

    expect(
      await caught(() =>
        transitionCampaign(seed.business.id, draft.id, "activate"),
      ),
    ).toMatchObject({ status: 409, code: "invalid_transition" });
  }, 180_000);

  it("will not activate without an active, GEOCODED door", async () => {
    const seed = await world("plus", "Campaign doors");
    const ungeocoded = await seedExtraLocation(
      seed.business.id,
      "Sin coordenadas",
    );
    await getDb()
      .update(locations)
      .set({ latitude: null, longitude: null })
      .where(eq(locations.id, ungeocoded));
    // Each HALF of the check is pinned separately, and that is not pedantry: with both
    // columns null a single one of the two `isNotNull`s already catches it, so dropping
    // the OTHER one left the whole suite green — measured (B1-M4), not reasoned. The two
    // columns are nullable independently, so a half-geocoded door is representable.
    const halfA = await seedExtraLocation(seed.business.id, "Solo longitud");
    await getDb()
      .update(locations)
      .set({ latitude: null })
      .where(eq(locations.id, halfA));
    const halfB = await seedExtraLocation(seed.business.id, "Solo latitud");
    await getDb()
      .update(locations)
      .set({ longitude: null })
      .where(eq(locations.id, halfB));
    const campaign = await createCampaign(
      seed.business.id,
      seed.userId,
      body(seed, { locationIds: [ungeocoded] }),
    );

    expect(
      await caught(() =>
        transitionCampaign(seed.business.id, campaign.id, "activate"),
      ),
    ).toMatchObject({ status: 409, code: "no_usable_location" });

    for (const half of [halfA, halfB]) {
      await updateCampaign(
        seed.business.id,
        campaign.id,
        body(seed, { locationIds: [half] }),
      );
      expect(
        await caught(() =>
          transitionCampaign(seed.business.id, campaign.id, "activate"),
        ),
      ).toMatchObject({ code: "no_usable_location" });
    }

    // An ARCHIVED door does not count either, and the campaign stays `draft`.
    const archivedDoor = await seedExtraLocation(seed.business.id, "Archivado");
    await getDb()
      .update(locations)
      .set({ status: "archived" })
      .where(eq(locations.id, archivedDoor));
    await updateCampaign(
      seed.business.id,
      campaign.id,
      body(seed, { locationIds: [archivedDoor] }),
    );
    expect(
      await caught(() =>
        transitionCampaign(seed.business.id, campaign.id, "activate"),
      ),
    ).toMatchObject({ code: "no_usable_location" });
    expect((await getCampaign(seed.business.id, campaign.id)).status).toBe(
      "draft",
    );
  }, 180_000);

  it("charges the plan: a `free` business gets 402 at activate", async () => {
    const seed = await world("free", "Campaign plan");
    const campaign = await createCampaign(
      seed.business.id,
      seed.userId,
      body(seed),
    );

    // Creating a draft is free; the gate is at ACTIVATE (the spec's 402 at create is [D]).
    expect(campaign.status).toBe("draft");
    expect(
      await caught(() =>
        transitionCampaign(seed.business.id, campaign.id, "activate"),
      ),
    ).toMatchObject({ status: 402, code: "plan_not_allowed" });
  }, 120_000);

  it("refuses to activate a campaign whose end already passed", async () => {
    const seed = await world("plus", "Campaign expired");
    const campaign = await createCampaign(
      seed.business.id,
      seed.userId,
      body(seed, {
        startsAt: "2026-09-01T12:00:00.000Z",
        endsAt: "2026-09-10T12:00:00.000Z",
      }),
    );

    expect(
      await caught(() =>
        transitionCampaign(
          seed.business.id,
          campaign.id,
          "activate",
          new Date("2026-09-20T12:00:00.000Z"),
        ),
      ),
    ).toMatchObject({ status: 409, code: "campaign_expired" });
  }, 120_000);
});
