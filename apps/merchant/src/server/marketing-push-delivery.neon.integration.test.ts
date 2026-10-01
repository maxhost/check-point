import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import {
  optOut,
  seedMembership,
  seedOrder,
  setCampaignState,
} from "./marketing-integration-support";
import { readPush, readQueue } from "./marketing-push-support";
import {
  ENDS,
  HOUR,
  NEXT_NINE,
  NIGHT,
  NOON,
  coupons,
  seeds,
  work,
  world,
} from "./marketing-push-delivery-support";
import { dropCampaigns, readAccount } from "./marketing-read-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  campaignCoupons,
  campaigns,
} from "@mi-pasaporte/db/schema";
import { recordPushClick } from "@mi-pasaporte/domain/server/marketing/push-delivery";
import { loadActiveCoupon } from "./counter/coupon-scan";
import { listConsumerCoupons } from "@mi-pasaporte/domain/server/consumer/coupons";
import type { FakeWebPushChannel } from "@mi-pasaporte/domain/server/push/webpush-channel";

/**
 * The worker's side of a campaign push (spec 0103 §6-§9) against a real database, through
 * the REAL `runPushWorker` with fake transports. The consumers only have Web Push, so the
 * notice goes by Web Push (transport = transactional) and the click id is observable in
 * the payload. Business zone: America/Guayaquil (UTC-5), window 9–21 (the world lives in
 * `marketing-push-delivery-support.ts`).
 */
afterAll(async () => {
  for (const seed of seeds.splice(0)) {
    await dropCampaigns(seed.business.id);
    await dropBusiness(seed.business.id);
  }
}, 120_000);

describe.skipIf(!integrationEnabled)("campaign push delivery", () => {
  it("SEND: Web Push with the click id, `sent_at`, «Última novedad» and ONE coupon", async () => {
    const built = await world("Push send");
    const web = await work(built, NOON);

    const [row] = await readQueue([built.consumerId]);
    expect(row).toMatchObject({ status: "sent", sentAt: NOON });
    expect(await readPush(built.pushId)).toMatchObject({
      sentAt: NOON,
      cancelledAt: null,
    });
    expect(web.calls).toEqual([
      {
        endpoint: built.endpoint,
        payload: {
          title: "La Gringa",
          body: "¡Volvé! · 2x1 en picadas",
          url: "/wallet",
          clickId: built.pushId,
        },
      },
    ]);
    expect((await readAccount(built.consumerId)).latestMessage).toBe(
      "La Gringa: ¡Volvé! · 2x1 en picadas",
    );
    expect(await coupons(built.consumerId)).toEqual([
      expect.objectContaining({
        campaignId: built.campaignId,
        pushId: built.pushId,
        turnId: null,
        labelSnapshot: "2x1 en picadas",
        costSnapshot: "2.50",
        validFrom: NOON,
        validUntil: ENDS,
      }),
    ]);

    // The click: first one wins, an unknown id is a no-op.
    await recordPushClick(built.pushId);
    const first = (await readPush(built.pushId)).clickedAt;
    expect(first).toBeInstanceOf(Date);
    await recordPushClick(built.pushId);
    expect((await readPush(built.pushId)).clickedAt).toEqual(first);
    await recordPushClick("99999999-9999-4999-8999-999999999999");
  }, 120_000);

  it("spec 0106: the delivered coupon copies the WHOLE reward and the business currency, and keeps it when the business changes it", async () => {
    // ORACULO DE M2. A discount by AMOUNT with a rule, and a currency that is not the
    // seed's default: a copy that dropped the type or the rule, or wrote a fixed currency,
    // shows here.
    const built = await world("Push reward");
    await getDb()
      .update(campaigns)
      .set({
        couponKind: "discount",
        couponDiscountUnit: "amount",
        couponDiscountValue: "5.00",
        couponRule: "Solo de lunes a jueves",
      })
      .where(eq(campaigns.id, built.campaignId));
    await getDb()
      .update(businesses)
      .set({ currencyCode: "ARS" })
      .where(eq(businesses.id, built.seed.business.id));
    await work(built, NOON);
    expect(await coupons(built.consumerId)).toEqual([
      expect.objectContaining({
        pushId: built.pushId,
        labelSnapshot: "2x1 en picadas",
        kindSnapshot: "discount",
        productId: null,
        discountUnitSnapshot: "amount",
        discountValueSnapshot: "5.00",
        currencyCodeSnapshot: "ARS",
        extraUnitsSnapshot: null,
        ruleSnapshot: "Solo de lunes a jueves",
      }),
    ]);

    // The business changes its currency AFTER the coupon was issued: an amount means
    // nothing in another currency, so the scan and the consumer's list keep the SNAPSHOT's
    // (reviewer's P2, `counter/coupon-scan.ts` and `consumer/coupons.ts`).
    const later = new Date(NOON.getTime() + HOUR);
    try {
      await getDb()
        .update(businesses)
        .set({ currencyCode: "EUR" })
        .where(eq(businesses.id, built.seed.business.id));
      expect(
        await loadActiveCoupon(built.seed.business.id, built.consumerId, later),
      ).toMatchObject({ discountUnit: "amount", currencyCode: "ARS" });
      expect(await listConsumerCoupons(built.consumerId, later)).toEqual([
        expect.objectContaining({ currencyCode: "ARS", status: "valid" }),
      ]);
    } finally {
      await getDb()
        .update(businesses)
        .set({ currencyCode: "ARS" })
        .where(eq(businesses.id, built.seed.business.id));
    }
  }, 120_000);

  it("an unredeemed coupon of the campaign already held: the push goes, a second coupon does not", async () => {
    const built = await world("Push second coupon");
    await getDb()
      .insert(campaignCoupons)
      .values({
        campaignId: built.campaignId,
        businessId: built.seed.business.id,
        consumerId: built.consumerId,
        membershipId: built.membershipId,
        labelSnapshot: "2x1 en picadas",
        costSnapshot: "2.50",
        kindSnapshot: "free_product",
        validFrom: new Date(NOON.getTime() - 24 * HOUR),
        validUntil: ENDS,
      });
    await work(built, NOON);
    expect((await readPush(built.pushId)).sentAt).toEqual(NOON);
    expect(await coupons(built.consumerId)).toHaveLength(1);
  }, 120_000);

  it("CANCEL visited: a purchase between the decision and the delivery", async () => {
    const built = await world("Push visited");
    await seedOrder({
      businessId: built.seed.business.id,
      locationId: built.seed.locationId,
      programId: built.seed.programId,
      membershipId: built.membershipId,
      consumerId: built.consumerId,
      userId: built.seed.userId,
      createdAt: new Date(NOON.getTime() - HOUR),
    });
    const web = await work(built, NOON);
    await expectCancelled(built, web, "visited");
  }, 120_000);

  it("CANCEL campaign_inactive: the campaign was paused after the decision", async () => {
    const built = await world("Push paused");
    await setCampaignState(built.campaignId, "paused", "owner");
    await expectCancelled(built, await work(built, NOON), "campaign_inactive");
  }, 120_000);

  it("CANCEL opt_out: the consumer turned promotions off", async () => {
    const built = await world("Push opt-out");
    await optOut(built.membershipId, new Date(NOON.getTime() - HOUR));
    await expectCancelled(built, await work(built, NOON), "opt_out");
  }, 120_000);

  it("RESCHEDULE outside the window: back to pending at the next 09:00 local, nothing sent", async () => {
    const built = await world("Push night");
    const web = await work(built, NIGHT);
    const [row] = await readQueue([built.consumerId]);
    expect(row).toMatchObject({ status: "pending", notBefore: NEXT_NINE });
    expect(await readPush(built.pushId)).toMatchObject({
      sentAt: null,
      cancelledAt: null,
    });
    expect(web.calls).toEqual([]);
    expect((await readAccount(built.consumerId)).latestMessage).toBeNull();
  }, 120_000);

  it("SEND despite ANOTHER consumer's unredeemed coupon and a purchase at ANOTHER business", async () => {
    const built = await world("Push not mine");
    const other = await seedConsumer();
    const otherMembership = await seedMembership({
      consumerId: other.id,
      programId: built.seed.programId,
      businessId: built.seed.business.id,
    });
    await getDb()
      .insert(campaignCoupons)
      .values({
        campaignId: built.campaignId,
        businessId: built.seed.business.id,
        consumerId: other.id,
        membershipId: otherMembership,
        labelSnapshot: "2x1 en picadas",
        costSnapshot: "2.50",
        kindSnapshot: "free_product",
        validFrom: new Date(NOON.getTime() - 24 * HOUR),
        validUntil: ENDS,
      });
    const elsewhere = await seedBusiness({
      name: `Push elsewhere ${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      kind: "stamps",
      mode: "per_purchase",
      grant: 1,
      blockAmount: null,
    });
    seeds.push(elsewhere);
    await seedOrder({
      businessId: elsewhere.business.id,
      locationId: elsewhere.locationId,
      programId: elsewhere.programId,
      membershipId: await seedMembership({
        consumerId: built.consumerId,
        programId: elsewhere.programId,
        businessId: elsewhere.business.id,
      }),
      consumerId: built.consumerId,
      userId: elsewhere.userId,
      createdAt: new Date(NOON.getTime() - HOUR),
    });
    await work(built, NOON);
    expect(await readPush(built.pushId)).toMatchObject({
      sentAt: NOON,
      cancelledAt: null,
    });
    expect(await coupons(built.consumerId)).toHaveLength(1);
  }, 120_000);
});

async function expectCancelled(
  built: { consumerId: string; pushId: string },
  web: FakeWebPushChannel,
  reason: string,
) {
  const [row] = await readQueue([built.consumerId]);
  expect(row).toMatchObject({ status: "cancelled", lastError: reason });
  expect(await readPush(built.pushId)).toMatchObject({
    cancelReason: reason,
    cancelledAt: NOON,
    sentAt: null,
  });
  expect(web.calls).toEqual([]);
  // Nothing of the consumer is touched: no «Última novedad», no cooldown clock.
  const account = await readAccount(built.consumerId);
  expect(account.latestMessage).toBeNull();
  expect(account.lastPushAt).toBeNull();
  expect(await coupons(built.consumerId)).toEqual([]);
}
