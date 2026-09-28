import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./locations-integration-support";
import { getDb } from "./db";
import { campaigns, products } from "./schema";
import { createCampaign, updateCampaign } from "./marketing/campaign-store";
import { enableTemplate } from "./marketing/template-store";
import { INVALID_PRODUCT } from "./marketing/reward-input";
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
 */

afterAll(dropCampaignWorlds, 120_000);

const END = "2026-12-31T12:00:00.000Z";

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
    it("POST: own product is stored with the whole reward; ANOTHER business's product is 400", async () => {
      const mine = await world("plus", "Reward post mine");
      const theirs = await world("plus", "Reward post theirs");
      const own = await seedProduct(mine.business.id);
      const foreign = await seedProduct(theirs.business.id);

      const created = await createCampaign(
        mine.business.id,
        mine.userId,
        body(mine, reward({ couponProductId: own })),
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

      expectForeignProduct(
        await caught(() =>
          createCampaign(
            mine.business.id,
            mine.userId,
            body(mine, reward({ couponProductId: foreign })),
          ),
        ),
      );
      expect(await campaignsOf(mine.business.id)).toHaveLength(1);
    }, 120_000);

    it("PATCH: ANOTHER business's product is 400 and the campaign keeps its reward", async () => {
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
    }, 120_000);

    it("enable: ANOTHER business's product is 400 and no run is created", async () => {
      const mine = await world("plus", "Reward enable mine");
      const theirs = await world("plus", "Reward enable theirs");
      const foreign = await seedProduct(theirs.business.id);

      expectForeignProduct(
        await caught(() =>
          enableTemplate(
            mine.business.id,
            mine.userId,
            "missed_you",
            reward({ couponProductId: foreign }),
          ),
        ),
      );
      expect(await campaignsOf(mine.business.id)).toEqual([]);
    }, 120_000);

    it("extras must match the program: extra_stamps on a POINTS program is 400 on couponKind (POST and enable); extra_points passes", async () => {
      const seed = await world("plus", "Reward extras");
      const stamps = reward({
        couponKind: "extra_stamps",
        couponExtraUnits: 3,
      });

      for (const attempt of [
        () => createCampaign(seed.business.id, seed.userId, body(seed, stamps)),
        () =>
          enableTemplate(seed.business.id, seed.userId, "missed_you", stamps),
      ]) {
        const error = await caught(attempt);
        expect(error).toMatchObject({ status: 400, code: "validation" });
        expect(Object.keys(error.fields ?? {})).toEqual(["couponKind"]);
      }
      expect(await campaignsOf(seed.business.id)).toEqual([]);

      const points = await enableTemplate(
        seed.business.id,
        seed.userId,
        "missed_you",
        reward({ couponKind: "extra_points", couponExtraUnits: 5 }),
      );
      expect(points).toMatchObject({
        couponKind: "extra_points",
        couponExtraUnits: 5,
      });
    }, 120_000);
  },
);
