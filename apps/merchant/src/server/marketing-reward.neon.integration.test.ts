import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { campaigns, loyaltyPrograms, products } from "@mi-pasaporte/db/schema";
import { createCampaign, updateCampaign } from "./marketing/campaign-store";
import { COMPOSER_ENABLED } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import { enableTemplate } from "./marketing/template-store";
import { INVALID_PRODUCT } from "@mi-pasaporte/domain/server/marketing/reward-input";
import { allowedCouponKinds } from "./marketing/reward-store";
import { dropBusiness, seedBusiness } from "./counter-integration-support";
import {
  campaignBody as body,
  campaignWorld as world,
  caughtCampaignError as caught,
  dropCampaignWorlds,
} from "./marketing-campaigns-support";

/**
 * Spec 0106 / ADR 0098 — what the reward checks AGAINST THE DATABASE, on the three writers
 * (`createCampaign`, `updateCampaign`, `enableTemplate`): three call sites, three wirings,
 * one case each (ORACULO DE M1). Every rejection is also checked to have written NOTHING.
 *
 * The world is a POINTS program (`seedLocationsBusiness`), so `extra_points` fits it and
 * `extra_stamps` does not.
 *
 * Spec 0138 / ADR 0115: the composer is OFF, so `createCampaign` and `updateCampaign` no
 * longer write. The reward checks run through `enable` of `cross`/`welcome` (ON); the PATCH
 * case (the composer's only editor) is skipped while the composer is off.
 */

afterAll(dropCampaignWorlds, 120_000);
const stampBusinesses: string[] = [];
afterAll(async () => {
  for (const id of stampBusinesses.splice(0)) await dropBusiness(id);
}, 120_000);

const END = "2026-12-31T12:00:00.000Z";

/** Spec 0138: the reward as `cross`/`welcome` take it — no redemption cap, no end. */
function liveReward(over: Record<string, unknown> = {}) {
  return {
    couponKind: "two_for_one",
    couponLabel: "2x1 en Café",
    couponCost: "1.20",
    couponRule: "Solo tamaño mediano",
    ...over,
  };
}

function reward(over: Record<string, unknown> = {}) {
  return {
    couponKind: "two_for_one",
    couponLabel: "2x1 en Café",
    couponCost: "1.20",
    couponMaxRedemptions: 100,
    couponRule: "Solo tamaño mediano",
    endsAt: END,
    ...over,
  };
}

async function seedProduct(businessId: string): Promise<string> {
  const [row] = await getDb()
    .insert(products)
    .values({ businessId, name: "Café" })
    .returning({ id: products.id });
  return row.id;
}

async function campaignsOf(businessId: string) {
  return await getDb()
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.businessId, businessId));
}

/** The 400 of a foreign product: the SAME message as an id that is not a uuid, so the
 * answer never says the product exists at another business. */
function expectForeignProduct(error: {
  status: number;
  code: string;
  fields?: unknown;
}) {
  expect(error).toMatchObject({
    status: 400,
    code: "validation",
    fields: { couponProductId: INVALID_PRODUCT },
  });
}

describe.skipIf(!integrationEnabled)(
  "the campaign reward against the database",
  () => {
    it("enable (cross): own product is stored with the whole reward; ANOTHER business's product is 400", async () => {
      const mine = await world("plus", "Reward post mine");
      const theirs = await world("plus", "Reward post theirs");
      const own = await seedProduct(mine.business.id);
      const foreign = await seedProduct(theirs.business.id);

      // Spec 0138: the foreign product goes FIRST — a second `enable` of the same template
      // would be 409 `template_already_live` before the product is ever checked.
      expectForeignProduct(
        await caught(() =>
          enableTemplate(
            mine.business.id,
            mine.userId,
            "cross",
            liveReward({ couponProductId: foreign }),
          ),
        ),
      );
      expect(await campaignsOf(mine.business.id)).toEqual([]);

      const created = await enableTemplate(
        mine.business.id,
        mine.userId,
        "cross",
        liveReward({ couponProductId: own }),
      );
      const [row] = await getDb()
        .select({
          couponKind: campaigns.couponKind,
          couponProductId: campaigns.couponProductId,
          couponRule: campaigns.couponRule,
        })
        .from(campaigns)
        .where(eq(campaigns.id, created.id));
      expect(row).toEqual({
        couponKind: "two_for_one",
        couponProductId: own,
        couponRule: "Solo tamaño mediano",
      });
      expect(created).toMatchObject({
        couponKind: "two_for_one",
        couponDiscountUnit: null,
        couponDiscountValue: null,
        couponExtraUnits: null,
        couponRule: "Solo tamaño mediano",
      });
      expect(await campaignsOf(mine.business.id)).toHaveLength(1);
    }, 120_000);

    it.skipIf(!COMPOSER_ENABLED)(
      "PATCH: ANOTHER business's product is 400 and the campaign keeps its reward",
      async () => {
        const mine = await world("plus", "Reward patch mine");
        const theirs = await world("plus", "Reward patch theirs");
        const foreign = await seedProduct(theirs.business.id);
        const created = await createCampaign(
          mine.business.id,
          mine.userId,
          body(mine, reward()),
        );

        expectForeignProduct(
          await caught(() =>
            updateCampaign(
              mine.business.id,
              created.id,
              reward({ couponProductId: foreign }),
            ),
          ),
        );
        const [row] = await getDb()
          .select({ couponProductId: campaigns.couponProductId })
          .from(campaigns)
          .where(eq(campaigns.id, created.id));
        expect(row.couponProductId).toBeNull();
      },
      120_000,
    );

    it("enable: ANOTHER business's product is 400 and no run is created", async () => {
      const mine = await world("plus", "Reward enable mine");
      const theirs = await world("plus", "Reward enable theirs");
      const foreign = await seedProduct(theirs.business.id);

      expectForeignProduct(
        await caught(() =>
          enableTemplate(
            mine.business.id,
            mine.userId,
            "cross",
            liveReward({ couponProductId: foreign }),
          ),
        ),
      );
      expect(await campaignsOf(mine.business.id)).toEqual([]);
    }, 120_000);

    it("extras must match the program: extra_stamps on a POINTS program is 400 on couponKind (enable of cross and of welcome); extra_points passes", async () => {
      const seed = await world("plus", "Reward extras");
      const stamps = liveReward({
        couponKind: "extra_stamps",
        couponExtraUnits: 3,
      });

      for (const attempt of [
        () => enableTemplate(seed.business.id, seed.userId, "welcome", stamps),
        () => enableTemplate(seed.business.id, seed.userId, "cross", stamps),
      ]) {
        const error = await caught(attempt);
        expect(error).toMatchObject({ status: 400, code: "validation" });
        expect(Object.keys(error.fields ?? {})).toEqual(["couponKind"]);
      }
      expect(await campaignsOf(seed.business.id)).toEqual([]);

      const points = await enableTemplate(
        seed.business.id,
        seed.userId,
        "cross",
        liveReward({ couponKind: "extra_points", couponExtraUnits: 5 }),
      );
      expect(points).toMatchObject({
        couponKind: "extra_points",
        couponExtraUnits: 5,
      });
    }, 120_000);

    it("E1b: couponKinds tells the business's own extra — points, stamps, or none", async () => {
      // The SAME source that decides the 400 above informs the UI (spec 0106 E1b).
      const base = ["free_product", "two_for_one", "discount"];
      const points = await world("plus", "Reward kinds points");
      expect(await allowedCouponKinds(points.business.id)).toEqual([
        ...base,
        "extra_points",
      ]);

      const stamps = await seedBusiness({
        name: `Reward kinds stamps ${Date.now()}`,
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      stampBusinesses.push(stamps.business.id);
      expect(await allowedCouponKinds(stamps.business.id)).toEqual([
        ...base,
        "extra_stamps",
      ]);

      await getDb()
        .update(loyaltyPrograms)
        .set({ status: "inactive" })
        .where(eq(loyaltyPrograms.id, stamps.programId));
      expect(await allowedCouponKinds(stamps.business.id)).toEqual(base);
    }, 120_000);
  },
);
