import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { getDb } from "./db";
import { campaigns } from "./schema";
import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
} from "./marketing/campaign-store";
import { transitionCampaign } from "./marketing/campaign-actions";
import {
  campaignBody as body,
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * Creating, scoping and editing a campaign against a real database (spec 0065 phase B).
 * The four transitions and the `activate` guards live in
 * `marketing-campaign-actions.neon.integration.test.ts` — same design, split only by the
 * size budget.
 *
 * ALCANCE DECLARADO: this exercises the store, NOT the HTTP layer. That the routes map
 * `CampaignError` to its status and refuse a caller without an owner session is pinned by
 * the unit route suite. Saying so matters: a reader would otherwise assume the 401 is here.
 */

afterAll(dropCampaignWorlds, 120_000);

describe.skipIf(!integrationEnabled)("campaigns: create, scope, edit", () => {
  it("creates a draft with its doors, and lists it", async () => {
    const seed = await world("plus", "Campaign create");

    const created = await createCampaign(
      seed.business.id,
      seed.userId,
      body(seed),
    );

    expect(created).toMatchObject({
      status: "draft",
      name: "Dormidos de septiembre",
      dormantDays: 45,
      activatedAt: null,
      locationIds: [seed.locationId],
    });
    // Read by SQL, not from the returned object: the API answer is never the oracle.
    const [row] = await getDb()
      .select({ status: campaigns.status, kind: campaigns.kind })
      .from(campaigns)
      .where(eq(campaigns.id, created.id));
    expect(row).toEqual({ status: "draft", kind: "proximity" });
    expect((await listCampaigns(seed.business.id)).map((c) => c.id)).toEqual([
      created.id,
    ]);
  }, 120_000);

  it("refuses a door of ANOTHER business", async () => {
    const mine = await world("plus", "Campaign mine");
    const theirs = await world("plus", "Campaign theirs");

    const error = await caught(() =>
      createCampaign(
        mine.business.id,
        mine.userId,
        body(mine, { locationIds: [theirs.locationId] }),
      ),
    );

    expect(error).toMatchObject({ status: 400, code: "validation" });
    expect(error.fields).toHaveProperty("locationIds");
  }, 120_000);

  it("is scoped by business: another owner's campaign is a 404, not a 403", async () => {
    const mine = await world("plus", "Campaign scope mine");
    const theirs = await world("plus", "Campaign scope theirs");
    const hers = await createCampaign(
      theirs.business.id,
      theirs.userId,
      body(theirs),
    );

    // A 403 would confirm the id EXISTS, which is the enumeration the spec forbids.
    expect(
      await caught(() => getCampaign(mine.business.id, hers.id)),
    ).toMatchObject({
      status: 404,
      code: "not_found",
    });
    expect(
      await caught(() =>
        updateCampaign(mine.business.id, hers.id, body(theirs)),
      ),
    ).toMatchObject({ status: 404 });
    expect(
      await caught(() =>
        transitionCampaign(mine.business.id, hers.id, "activate"),
      ),
    ).toMatchObject({ status: 404 });
  }, 120_000);

  it("edits in draft and paused, and refuses to edit an active one", async () => {
    const seed = await world("plus", "Campaign edit");
    const draft = await createCampaign(
      seed.business.id,
      seed.userId,
      body(seed),
    );

    const edited = await updateCampaign(
      seed.business.id,
      draft.id,
      body(seed, { message: "Nuevo mensaje" }),
    );
    expect(edited.message).toBe("Nuevo mensaje");

    await transitionCampaign(seed.business.id, draft.id, "activate");
    expect(
      await caught(() =>
        updateCampaign(
          seed.business.id,
          draft.id,
          body(seed, { message: "Otro" }),
        ),
      ),
    ).toMatchObject({ status: 409, code: "not_editable" });

    await transitionCampaign(seed.business.id, draft.id, "pause");
    expect(
      (
        await updateCampaign(
          seed.business.id,
          draft.id,
          body(seed, { message: "Tercero" }),
        )
      ).message,
    ).toBe("Tercero");
  }, 180_000);
});
