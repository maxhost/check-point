import { randomUUID } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import {
  base,
  category,
  claim,
  crossBusiness,
  crossCampaign,
  crossConsumer,
  dropCrossWorlds,
  north,
} from "./consumer-cross-support";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  campaignCoupons,
  campaigns,
  couponRedemptions,
  consumerAccounts,
  webPushSubscriptions,
} from "@mi-pasaporte/db/schema";
import { redeemCoupon } from "./counter/coupon";
import { resolveScan } from "./counter/resolve";
import { sweepWelcomeGifts } from "@mi-pasaporte/domain/server/marketing/welcome-issue";

/**
 * Spec 0136 — what happens AFTER the claim, against a real base:
 *  - the counter redeems a cross coupon of someone who was NOT a member: the scan
 *    auto-enrols (ADR 0033) and the redemption carries THAT membership (ORACULO DE M8 —
 *    with the coupon's `null`, `coupon_redemption.membership_id NOT NULL` refuses it);
 *    without the scan it is 409 `not_enrolled`;
 *  - «solo el cruzado» (ADR 0104 §5): the welcome sweep gives nothing to a consumer who
 *    holds a cross coupon of that business (ORACULO DE M9 — the WIRING in
 *    `issueWelcomeGiftsIn`; the pure rule has its own case in `welcome-issue.test.ts`),
 *    with a control consumer, identical but without the cross coupon, who DOES get it.
 */

afterAll(dropCrossWorlds, 180_000);

async function claimed(prefix: string, index: number) {
  const cat = category(prefix);
  const here = base(index);
  const x = await crossBusiness(`Cruz ${prefix}`, cat("gym"), north(here, 300));
  const campaignId = await crossCampaign(x);
  const consumer = await crossConsumer();
  const answer = await claim(consumer.id, campaignId, here);
  expect(answer.status).toBe(201);
  return {
    x,
    campaignId,
    consumer,
    couponId: String((answer.body.coupon as { id: string }).id),
  };
}

describe.skipIf(!integrationEnabled)(
  "cross coupon — counter and welcome",
  () => {
    it("ORACULO DE M8 — scan + redeem of a non-member's cross coupon: the redemption carries the auto-enrolled membership", async () => {
      const { x, consumer, couponId } = await claimed("m8", 21);
      const scan = await resolveScan(x.seed.business, consumer.qrToken);
      expect(scan.coupon?.couponId).toBe(couponId);

      const result = await redeemCoupon(x.seed.business, x.seed.userId, {
        clientRequestId: randomUUID(),
        couponId,
        locationId: x.seed.locationId,
      });
      expect(result.coupon.label).toBe("10% en tu primera clase");
      const [row] = await getDb()
        .select({ membershipId: couponRedemptions.membershipId })
        .from(couponRedemptions)
        .where(eq(couponRedemptions.couponId, couponId));
      expect(row.membershipId).toBe(scan.membership.id);
      // The coupon itself is not rewritten.
      const [coupon] = await getDb()
        .select({ membershipId: campaignCoupons.membershipId })
        .from(campaignCoupons)
        .where(eq(campaignCoupons.id, couponId));
      expect(coupon.membershipId).toBeNull();
    }, 180_000);

    it("redeeming it without scanning the consumer first is 409 not_enrolled, and nothing is written", async () => {
      const { x, couponId } = await claimed("enrol", 22);
      await expect(
        redeemCoupon(x.seed.business, x.seed.userId, {
          clientRequestId: randomUUID(),
          couponId,
          locationId: x.seed.locationId,
        }),
      ).rejects.toMatchObject({ status: 409, code: "not_enrolled" });
      expect(
        await getDb()
          .select({ id: couponRedemptions.id })
          .from(couponRedemptions)
          .where(eq(couponRedemptions.couponId, couponId)),
      ).toEqual([]);
    }, 180_000);

    it("ORACULO DE M9 — the welcome sweep gives nothing to who came by the cross offer, and the gift to an identical consumer who did not", async () => {
      const { x, consumer } = await claimed("m9", 23);
      const [welcome] = await getDb()
        .insert(campaigns)
        .values({
          businessId: x.seed.business.id,
          kind: "proximity",
          templateKey: "welcome",
          channelProximity: false,
          channelPush: false,
          name: "Bienvenida",
          status: "active",
          activatedAt: new Date(Date.now() - 60_000),
          message: "Sumate hoy",
          couponLabel: "Un café gratis",
          couponCost: "1.20",
          couponKind: "free_product",
          welcomeValidDays: 15,
          welcomeReminderDays: 3,
          welcomeMonthlyCap: 50,
          welcomeRedeemFrom: "next_day",
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          createdByUserId: x.seed.userId,
        })
        .returning({ id: campaigns.id });
      const control = await crossConsumer();
      for (const person of [consumer, control]) {
        // Auto-enrolled by the counter's scan AFTER the switch-on, then Home + push activated.
        await resolveScan(x.seed.business, person.qrToken);
        await getDb()
          .update(consumerAccounts)
          .set({ homeLaunchedAt: new Date() })
          .where(eq(consumerAccounts.id, person.id));
        await getDb()
          .insert(webPushSubscriptions)
          .values({
            consumerId: person.id,
            endpoint: `https://push.test/${randomUUID()}`,
            p256dhKey: "test-key",
            authKey: "test-auth",
            platform: "android",
          });
      }

      const issued = await withDbTransaction((tx) =>
        sweepWelcomeGifts(
          tx,
          new Date(),
          [x.seed.business.id],
          [consumer.id, control.id],
        ),
      );
      const gifts = await getDb()
        .select({ consumerId: campaignCoupons.consumerId })
        .from(campaignCoupons)
        .where(
          and(
            eq(campaignCoupons.campaignId, welcome.id),
            isNotNull(campaignCoupons.welcomeMembershipId),
          ),
        );
      expect(gifts.map((g) => g.consumerId)).toEqual([control.id]);
      expect(issued).toBe(1);
    }, 180_000);
  },
);
