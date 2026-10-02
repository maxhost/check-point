import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { seedCampaign } from "./marketing-integration-support";
import { seedWelcomeCampaign } from "./marketing-welcome-support";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { campaigns, subscriptions } from "@mi-pasaporte/db/schema";
import { loadWelcomeCampaign } from "@mi-pasaporte/domain/server/marketing/welcome-store";
import { transitionCampaign } from "./marketing/campaign-actions";
import {
  activeCampaignCount,
  pauseCampaignsForDowngrade,
} from "./marketing/plan-brake";
import { enableTemplate } from "./marketing/template-store";
import {
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * ADR 0112 / spec 0126 — LA BIENVENIDA EN TODOS LOS PLANES, contra Postgres. Los cuatro
 * puntos donde el freno de plan la decidía con `campaigns.enabled` (activar, reanudar,
 * entregar, la baja de plan) ahora la deciden con `campaigns.welcome`, y cada caso tiene su
 * control: otra plantilla, en el MISMO negocio, sigue recibiendo 402 / siendo pausada.
 * Todo estado se LEE POR SQL (ADR 0054).
 *
 * El negocio free es el de producción: `status='active'` y SIN `stripe_subscription_id`.
 */

afterAll(dropCampaignWorlds, 120_000);

const GIFT = { couponLabel: "Un café gratis", couponCost: "1.20" };
const ON = new Date("2026-09-01T12:00:00.000Z");
const NOW = new Date("2026-10-02T15:00:00.000Z");

async function statusOf(id: string) {
  const [row] = await getDb()
    .select({ status: campaigns.status, pauseReason: campaigns.pauseReason })
    .from(campaigns)
    .where(eq(campaigns.id, id));
  return row;
}

async function liveTemplateRuns(businessId: string, key: string) {
  const rows = await getDb()
    .select({ key: campaigns.templateKey, status: campaigns.status })
    .from(campaigns)
    .where(eq(campaigns.businessId, businessId));
  return rows.filter((row) => row.key === key);
}

describe.skipIf(!integrationEnabled)("welcome in every plan (ADR 0112)", () => {
  it("ORACULO DE M1 Y M2: a FREE business enables welcome, and gets 402 for win_back", async () => {
    const free = await world("free", "Welcome plan free");
    const created = await enableTemplate(
      free.business.id,
      free.userId,
      "welcome",
      GIFT,
    );
    expect(await statusOf(created.id)).toEqual({
      status: "active",
      pauseReason: null,
    });

    expect(
      await caught(() =>
        enableTemplate(free.business.id, free.userId, "win_back", {}),
      ),
    ).toMatchObject({ status: 402, code: "plan_not_allowed" });
    expect(await liveTemplateRuns(free.business.id, "win_back")).toEqual([]);
  }, 120_000);

  it("a business with NO subscription row enables welcome and gets its gift campaign", async () => {
    const bare = await world("free", "Welcome plan none");
    await getDb()
      .delete(subscriptions)
      .where(eq(subscriptions.businessId, bare.business.id));
    const created = await enableTemplate(
      bare.business.id,
      bare.userId,
      "welcome",
      GIFT,
    );
    expect(await statusOf(created.id)).toMatchObject({ status: "active" });
    expect(
      await loadWelcomeCampaign(getDb(), bare.business.id, new Date()),
    ).toMatchObject({ id: created.id });
  }, 120_000);

  it("ORACULO DE M3: the delivery READS a free business's welcome (it used to be null)", async () => {
    const free = await world("free", "Welcome plan delivery");
    const id = await seedWelcomeCampaign(free, { activatedAt: ON });
    expect(await loadWelcomeCampaign(getDb(), free.business.id, NOW)).toEqual(
      expect.objectContaining({
        id,
        businessId: free.business.id,
        couponLabel: "Un café gratis",
        monthlyCap: 50,
      }),
    );
  }, 120_000);

  it("resuming on free: the paused welcome comes back (200), the paused win_back is 402", async () => {
    // A plus that ran both and then landed on free: the shape a downgrade leaves.
    const seed = await world("plus", "Welcome plan resume");
    const welcome = await enableTemplate(
      seed.business.id,
      seed.userId,
      "welcome",
      GIFT,
    );
    const winBack = await enableTemplate(
      seed.business.id,
      seed.userId,
      "win_back",
      {},
    );
    await transitionCampaign(seed.business.id, welcome.id, "pause");
    await transitionCampaign(seed.business.id, winBack.id, "pause");
    await getDb()
      .update(subscriptions)
      .set({ plan: "free", interval: null, stripeSubscriptionId: null })
      .where(eq(subscriptions.businessId, seed.business.id));

    const resumed = await transitionCampaign(
      seed.business.id,
      welcome.id,
      "activate",
    );
    expect(resumed.campaign.status).toBe("active");
    expect(await statusOf(welcome.id)).toMatchObject({ status: "active" });

    expect(
      await caught(() =>
        transitionCampaign(seed.business.id, winBack.id, "activate"),
      ),
    ).toMatchObject({ status: 402, code: "plan_not_allowed" });
    expect(await statusOf(winBack.id)).toMatchObject({ status: "paused" });
  }, 120_000);

  it("ORACULO DE M4: the downgrade brake neither counts nor pauses the welcome — a custom campaign (NULL key) still is", async () => {
    const seed = await world("plus", "Welcome plan brake");
    const welcome = await seedWelcomeCampaign(seed, { activatedAt: ON });
    const custom = await seedCampaign({
      businessId: seed.business.id,
      createdByUserId: seed.userId,
      locationIds: [seed.locationId],
      status: "active",
    });
    const winBack = await enableTemplate(
      seed.business.id,
      seed.userId,
      "win_back",
      {},
    );

    const [counted, paused] = await withDbTransaction(async (tx) => [
      await activeCampaignCount(tx, seed.business.id),
      await pauseCampaignsForDowngrade(tx, seed.business.id, NOW),
    ]);
    expect(counted).toBe(2);
    expect(paused).toBe(2);

    const rows = await getDb()
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(inArray(campaigns.id, [welcome, custom, winBack.id]));
    const byId = Object.fromEntries(rows.map((row) => [row.id, row.status]));
    expect(byId).toEqual({
      [welcome]: "active",
      [custom]: "paused",
      [winBack.id]: "paused",
    });
  }, 120_000);
});
