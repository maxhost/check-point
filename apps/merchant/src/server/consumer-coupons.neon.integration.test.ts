import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import {
  type CouponWorld,
  couponBody,
  dropCouponWorld,
  newCouponCard,
  seedCouponWorld,
} from "./counter-coupon-support";
import { seedCampaignCoupon } from "./marketing-coupon-support";
import { getDb } from "./db";
import { businesses, campaignCoupons, couponRedemptions } from "./schema";
import { SESSION_COOKIE } from "./consumer/core";
import { issueSession } from "./consumer/session";
import { redeemCoupon } from "./counter/coupon";
import { resolveScan } from "./counter/resolve";
import { GET } from "../app/api/public/consumer/coupons/route";

/**
 * Spec 0106 E3 — `GET /api/public/consumer/coupons` against a real database, through the
 * REAL route and a real session. What it pins: the consumer sees ONLY their own coupons
 * (ORACULO DE M5), from EVERY business, with the rule and EXACTLY the contract's keys; and
 * since E3b (owner, 2026-09-27) the CALCULATED state — `valid` > `unavailable` (the business
 * is not active, ORACULO DE M5b) > history of `redeemed`/`expired` of the last 90 days.
 */

const DAY = 86_400_000;
const worlds: CouponWorld[] = [];

afterAll(async () => {
  for (const world of worlds.splice(0)) await dropCouponWorld(world);
}, 120_000);

async function world(prefix: string): Promise<CouponWorld> {
  const created = await seedCouponWorld(`${prefix} ${Date.now()}`);
  worlds.push(created);
  return created;
}

function request(sessionToken?: string): NextRequest {
  return new NextRequest("https://mp.test/api/public/consumer/coupons", {
    headers: sessionToken
      ? { cookie: `${SESSION_COOKIE}=${sessionToken}` }
      : undefined,
  });
}

async function couponsOf(consumerId: string) {
  const response = await GET(request(await issueSession(consumerId)));
  expect(response.status).toBe(200);
  return ((await response.json()) as { coupons: Record<string, unknown>[] })
    .coupons;
}

describe.skipIf(!integrationEnabled)("consumer coupons (spec 0106 E3)", () => {
  it("lists ONLY the session consumer's coupons: the usable ones first, then the last 90 days of redeemed/expired", async () => {
    const w1 = await world("Cupones cliente uno");
    const w2 = await world("Cupones cliente dos");
    const now = Date.now();

    // A: a coupon at w1 (with a rule) …
    const a = await newCouponCard(w1);
    await getDb()
      .update(campaignCoupons)
      .set({ ruleSnapshot: "Solo tamaño mediano" })
      .where(eq(campaignCoupons.id, a.couponId));
    // … a discount by amount at w2, sooner to expire …
    const atTwo = await resolveScan(w2.seed.business, a.qrToken);
    const discount = await seedCampaignCoupon({
      campaignId: w2.campaignId,
      businessId: w2.seed.business.id,
      consumerId: a.consumerId,
      membershipId: atTwo.membership.id,
      turnId: null,
      validFrom: new Date(now - DAY),
      validUntil: new Date(now + 10 * DAY),
    });
    await getDb()
      .update(campaignCoupons)
      .set({
        kindSnapshot: "discount",
        discountUnitSnapshot: "amount",
        discountValueSnapshot: "5.00",
        currencyCodeSnapshot: "ARS",
      })
      .where(eq(campaignCoupons.id, discount));
    // … one redeemed and one expired (history), and two older than 90 days (not shown).
    const spent = await seedCampaignCoupon({
      campaignId: w1.campaignId,
      businessId: w1.seed.business.id,
      consumerId: a.consumerId,
      membershipId: a.membershipId,
      turnId: null,
      validFrom: new Date(now - DAY),
      validUntil: new Date(now + 5 * DAY),
    });
    await redeemCoupon(w1.seed.business, w1.seed.userId, {
      ...couponBody(a, w1.seed),
      couponId: spent,
    });
    const expired = await seedCampaignCoupon({
      campaignId: w1.campaignId,
      businessId: w1.seed.business.id,
      consumerId: a.consumerId,
      membershipId: a.membershipId,
      turnId: null,
      validFrom: new Date(now - 5 * DAY),
      validUntil: new Date(now - DAY),
    });
    await seedCampaignCoupon({
      campaignId: w1.campaignId,
      businessId: w1.seed.business.id,
      consumerId: a.consumerId,
      membershipId: a.membershipId,
      turnId: null,
      validFrom: new Date(now - 110 * DAY),
      validUntil: new Date(now - 100 * DAY),
    });
    const oldSpent = await seedCampaignCoupon({
      campaignId: w1.campaignId,
      businessId: w1.seed.business.id,
      consumerId: a.consumerId,
      membershipId: a.membershipId,
      turnId: null,
      validFrom: new Date(now - DAY),
      validUntil: new Date(now + 5 * DAY),
    });
    await redeemCoupon(w1.seed.business, w1.seed.userId, {
      ...couponBody(a, w1.seed),
      couponId: oldSpent,
    });
    await getDb()
      .update(couponRedemptions)
      .set({ createdAt: new Date(now - 100 * DAY) })
      .where(eq(couponRedemptions.couponId, oldSpent));
    // B: another consumer with a coupon at the SAME business.
    const b = await newCouponCard(w1);

    const mine = await couponsOf(a.consumerId);
    expect(mine.map((coupon) => coupon.id)).toEqual([
      discount,
      a.couponId,
      spent,
      expired,
    ]);
    expect(Object.keys(mine[0]).sort()).toEqual([
      "businessId",
      "businessName",
      "currencyCode",
      "discountUnit",
      "discountValue",
      "extraUnits",
      "id",
      "kind",
      "label",
      "reason",
      "redeemedAt",
      "rule",
      "status",
      "validUntil",
    ]);
    expect(mine[0]).toMatchObject({
      businessId: w2.seed.business.id,
      kind: "discount",
      discountUnit: "amount",
      discountValue: "5.00",
      currencyCode: "ARS",
      rule: null,
      status: "valid",
      reason: null,
      redeemedAt: null,
    });
    expect(mine[1]).toMatchObject({
      businessId: w1.seed.business.id,
      kind: "free_product",
      rule: "Solo tamaño mediano",
      currencyCode: "USD",
      validUntil: w1.endsAt.toISOString(),
      status: "valid",
    });
    expect(mine[2]).toMatchObject({ status: "redeemed", reason: null });
    expect(typeof mine[2].redeemedAt).toBe("string");
    expect(mine[3]).toMatchObject({
      status: "expired",
      reason: null,
      redeemedAt: null,
    });

    expect((await couponsOf(b.consumerId)).map((coupon) => coupon.id)).toEqual([
      b.couponId,
    ]);
  }, 180_000);

  it("a suspended business turns its coupon UNAVAILABLE (after the valid ones), and back to VALID when reactivated", async () => {
    // ORACULO DE M5b. The w2 coupon expires FIRST, so only the state puts it second.
    const w1 = await world("Cupones estado uno");
    const w2 = await world("Cupones estado dos");
    const a = await newCouponCard(w1);
    const atTwo = await resolveScan(w2.seed.business, a.qrToken);
    const now = Date.now();
    const theirs = await seedCampaignCoupon({
      campaignId: w2.campaignId,
      businessId: w2.seed.business.id,
      consumerId: a.consumerId,
      membershipId: atTwo.membership.id,
      turnId: null,
      validFrom: new Date(now - DAY),
      validUntil: new Date(now + 10 * DAY),
    });
    const setStatus = (status: "active" | "suspended" | "closed") =>
      getDb()
        .update(businesses)
        .set({ status })
        .where(eq(businesses.id, w2.seed.business.id));
    try {
      await setStatus("suspended");
      const suspended = await couponsOf(a.consumerId);
      expect(suspended.map((c) => [c.id, c.status, c.reason])).toEqual([
        [a.couponId, "valid", null],
        [theirs, "unavailable", "business_suspended"],
      ]);
      await setStatus("closed");
      expect((await couponsOf(a.consumerId))[1]).toMatchObject({
        status: "unavailable",
        reason: "business_closed",
      });
      await setStatus("active");
      expect(
        (await couponsOf(a.consumerId)).map((c) => [c.id, c.status]),
      ).toEqual([
        [theirs, "valid"],
        [a.couponId, "valid"],
      ]);
    } finally {
      await setStatus("active");
    }
  }, 180_000);

  it("without a session it is 401 unauthenticated", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthenticated" });
  }, 60_000);
});
