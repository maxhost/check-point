import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { readTurns } from "./marketing-read-support";
import {
  type World,
  WORLD_DAY as DAY,
  WORLD_NOW as NOW,
  dropWorlds,
  seedWorld,
  tickWorld,
} from "./marketing-world-support";
import { redeemCoupon } from "./counter/coupon";
import { resolveScan } from "./counter/resolve";
import { getDb } from "@mi-pasaporte/db";
import {
  campaignCoupons,
  campaignTurns,
  campaigns,
  couponRedemptions,
  products,
} from "@mi-pasaporte/db/schema";
import type { TickSummary } from "./marketing/tick";

/**
 * Spec 0102 — the tick ISSUES the campaign coupon (step 4, `applyPlan`), and the turn's
 * result reads the redemption THROUGH the coupon (step 2, `expireTurns`). Driven by the
 * real tick on purpose: the unit of `couponToIssue` cannot see whether the applier calls
 * it (ORACULO DE M1), nor whether a holdout ends up with a coupon in the database (M2).
 */

const NS = "marketing_tick_test_coupon_issue";
const LABEL = "2x1 en picadas";
const ENDS_AT = new Date("2099-06-01T03:00:00.000Z");
const worlds: World[] = [];

async function world(people: number): Promise<World> {
  const built = await seedWorld({
    label: "Marketing cupon",
    people,
    coupon: { label: LABEL, cost: "2.50", maxRedemptions: 50 },
    endsAt: ENDS_AT,
  });
  worlds.push(built);
  return built;
}

async function couponsOf(businessId: string) {
  return getDb()
    .select({
      id: campaignCoupons.id,
      turnId: campaignCoupons.turnId,
      consumerId: campaignCoupons.consumerId,
      labelSnapshot: campaignCoupons.labelSnapshot,
      costSnapshot: campaignCoupons.costSnapshot,
      kindSnapshot: campaignCoupons.kindSnapshot,
      productId: campaignCoupons.productId,
      ruleSnapshot: campaignCoupons.ruleSnapshot,
      currencyCodeSnapshot: campaignCoupons.currencyCodeSnapshot,
      validFrom: campaignCoupons.validFrom,
      validUntil: campaignCoupons.validUntil,
    })
    .from(campaignCoupons)
    .where(eq(campaignCoupons.businessId, businessId));
}

describe.skipIf(!integrationEnabled)(
  "marketing coupon issue (spec 0102)",
  () => {
    afterEach(async () => {
      await dropWorlds(worlds);
    }, 120_000);

    it("issues ONE coupon per placed turn, none to the holdout, and a second tick does not duplicate", async () => {
      const built = await world(3);
      // First draw under the holdout rate, the rest above it: one holdout, two placed.
      let draws = 0;
      const summary = (await tickWorld(built, NS, {
        random: () => (draws++ === 0 ? 0 : 1),
      })) as TickSummary;
      expect(summary).toMatchObject({ activated: 3, holdouts: 1 });

      const turns = await readTurns(built.seed.business.id);
      const placed = turns.filter((t) => t.status === "active" && !t.holdout);
      const held = turns.filter((t) => t.holdout);
      expect(placed).toHaveLength(2);
      expect(held).toHaveLength(1);

      const coupons = await couponsOf(built.seed.business.id);
      expect(coupons.map((c) => c.turnId).sort()).toEqual(
        placed.map((t) => t.id).sort(),
      );
      for (const coupon of coupons)
        expect(coupon).toMatchObject({
          labelSnapshot: LABEL,
          costSnapshot: "2.50",
          validFrom: NOW,
          validUntil: ENDS_AT,
        });

      // (b) The holdout has no coupon row and the counter paints nothing for it.
      const heldIndex = built.consumerIds.indexOf(held[0].consumerId);
      expect(
        (await resolveScan(built.seed.business, built.qrTokens[heldIndex]))
          .coupon,
      ).toBeNull();
      const placedIndex = built.consumerIds.indexOf(placed[0].consumerId);
      expect(
        (await resolveScan(built.seed.business, built.qrTokens[placedIndex]))
          .coupon,
      ).toMatchObject({ label: LABEL, validUntil: ENDS_AT });

      await tickWorld(built, NS, { random: () => 1 });
      expect(await couponsOf(built.seed.business.id)).toHaveLength(2);
    }, 180_000);

    it("spec 0106: the coupon copies the WHOLE reward —type, product, rule— and editing the campaign later does not touch it", async () => {
      const built = await world(1);
      const businessId = built.seed.business.id;
      const [product] = await getDb()
        .insert(products)
        .values({ businessId, name: "Café" })
        .returning({ id: products.id });
      await getDb()
        .update(campaigns)
        .set({
          couponKind: "two_for_one",
          couponProductId: product.id,
          couponRule: "Solo tamaño mediano",
        })
        .where(eq(campaigns.id, built.campaignId));
      await tickWorld(built, NS, { random: () => 1 });
      await getDb()
        .update(campaigns)
        .set({
          couponKind: "free_product",
          couponProductId: null,
          couponRule: null,
        })
        .where(eq(campaigns.id, built.campaignId));

      expect(await couponsOf(businessId)).toEqual([
        expect.objectContaining({
          labelSnapshot: LABEL,
          kindSnapshot: "two_for_one",
          productId: product.id,
          ruleSnapshot: "Solo tamaño mediano",
          currencyCodeSnapshot: null,
        }),
      ]);
    }, 180_000);

    it("the expired turn whose coupon was redeemed is `coupon_redeemed` with its redemption; its sibling of the SAME campaign is not", async () => {
      // ORACULO DE M5: two turns of ONE campaign, one redemption. Joining by campaign
      // instead of by turn would mark both.
      const built = await world(2);
      await tickWorld(built, NS, { random: () => 1 });
      const coupons = await couponsOf(built.seed.business.id);
      expect(coupons).toHaveLength(2);
      const [spent, kept] = coupons;

      await redeemCoupon(built.seed.business, built.seed.userId, {
        clientRequestId: randomUUID(),
        couponId: spent.id,
        locationId: null,
      });

      await tickWorld(built, NS, {
        now: new Date(NOW.getTime() + 6 * DAY),
        random: () => 1,
      });
      const rows = await getDb()
        .select({
          id: campaignTurns.id,
          status: campaignTurns.status,
          outcome: campaignTurns.outcome,
          outcomeRedemptionId: campaignTurns.outcomeRedemptionId,
        })
        .from(campaignTurns)
        .where(eq(campaignTurns.businessId, built.seed.business.id));
      const [redemption] = await getDb()
        .select({ id: couponRedemptions.id })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, spent.id));
      expect(rows.find((t) => t.id === spent.turnId)).toMatchObject({
        status: "done",
        outcome: "coupon_redeemed",
        outcomeRedemptionId: redemption.id,
      });
      expect(rows.find((t) => t.id === kept.turnId)).toMatchObject({
        status: "done",
        outcome: "none",
        outcomeRedemptionId: null,
      });
    }, 180_000);
  },
);
