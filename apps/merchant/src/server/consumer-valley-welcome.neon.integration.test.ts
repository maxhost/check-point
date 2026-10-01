import { randomUUID } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import {
  base,
  category,
  crossConsumer,
  dropCrossWorlds,
  north,
} from "./consumer-cross-support";
import {
  TUESDAY,
  at,
  claimValley,
  setWindows,
  valleyBusiness,
  valleyCampaign,
} from "./consumer-valley-support";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import {
  campaignCoupons,
  campaigns,
  consumerAccounts,
  webPushSubscriptions,
} from "@mi-pasaporte/db/schema";
import { resolveScan } from "./counter/resolve";
import { sweepWelcomeGifts } from "@mi-pasaporte/domain/server/marketing/welcome-issue";

/**
 * Owner, 2026-09-30: a VALLEY coupon does NOT count as «came by the cross offer» — whoever
 * claimed «Horas valle» of a business still gets its «Bienvenida» (the valley fills a hole,
 * it is not the entry gift). Against a real base, through the welcome sweep: the guard is
 * `valley_location_id is null` in `hasCrossCouponFrom` (`marketing/cross-store.ts`) —
 * ORACULO DE O-M11. The «solo el cruzado» side (a CROSS coupon blocks the gift) is pinned
 * by `consumer-cross-counter.neon.integration.test.ts`.
 */

afterAll(dropCrossWorlds, 180_000);

describe.skipIf(!integrationEnabled)("valley coupon — welcome", () => {
  it("ORACULO DE O-M11 — who claimed a valley offer still gets the business's welcome gift", async () => {
    const cat = category("v-welcome");
    const here = base(81);
    const x = await valleyBusiness(
      "Valle welcome",
      cat("bar"),
      north(here, 300),
    );
    const campaignId = await valleyCampaign(x);
    await setWindows(x.seed.locationId, [
      { weekday: TUESDAY, startHour: 15, endHour: 17 },
    ]);
    const consumer = await crossConsumer();
    const answer = await claimValley(
      consumer.id,
      campaignId,
      x.seed.locationId,
      here,
      at("15:10"),
    );
    expect(answer.status).toBe(201);

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
    // Auto-enrolled by the counter's scan AFTER the switch-on, then Home + push activated.
    await resolveScan(x.seed.business, consumer.qrToken);
    await getDb()
      .update(consumerAccounts)
      .set({ homeLaunchedAt: new Date() })
      .where(eq(consumerAccounts.id, consumer.id));
    await getDb()
      .insert(webPushSubscriptions)
      .values({
        consumerId: consumer.id,
        endpoint: `https://push.test/${randomUUID()}`,
        p256dhKey: "test-key",
        authKey: "test-auth",
        platform: "android",
      });

    const issued = await withDbTransaction((tx) =>
      sweepWelcomeGifts(tx, new Date(), [x.seed.business.id], [consumer.id]),
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
    expect(gifts.map((g) => g.consumerId)).toEqual([consumer.id]);
    expect(issued).toBe(1);
  }, 180_000);
});
