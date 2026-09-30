import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import {
  DAY,
  base,
  category,
  claim,
  crossBusiness,
  crossCampaign,
  crossConsumer,
  dropCrossWorlds,
  memberOf,
  north,
  offeredBy,
  offersOf,
  readCrossCoupons,
} from "./consumer-cross-support";
import { seedCampaign } from "./marketing-integration-support";
import { getDb } from "@mi-pasaporte/db";
import { campaignPushes, walletPushQueue } from "@mi-pasaporte/db/schema";
import { listConsumerCoupons } from "./consumer/coupons";
import { disableTemplate } from "./marketing/template-store";

/**
 * Spec 0112 C2 — `POST /api/public/consumer/cross-offers/{campaignId}/claim` against a
 * real base, through the REAL route and a real session. Every state is READ BY SQL. Oracles
 * of M6 (the campaign's `for update` under a race of two DIFFERENT consumers, where the
 * partial unique — per consumer — cannot act) and M7 (the idempotent re-claim).
 */

afterAll(dropCrossWorlds, 180_000);

const RACES = 3;

describe.skipIf(!integrationEnabled)("cross offers — C2 claim", () => {
  it("201 issues the coupon WITHOUT membership, valid from now for validDays, with the reward's snapshots; no push", async () => {
    const cat = category("claim");
    const here = base(11);
    const x = await crossBusiness("Cruz claim", cat("gym"), north(here, 300));
    const campaignId = await crossCampaign(x, { validDays: 7 });
    const consumer = await crossConsumer();

    const before = Date.now();
    const answer = await claim(consumer.id, campaignId, here);
    expect(answer.status).toBe(201);
    const coupon = answer.body.coupon as Record<string, unknown>;
    expect(coupon).toMatchObject({
      businessId: x.seed.business.id,
      label: "10% en tu primera clase",
      kind: "discount",
      status: "valid",
      origin: "cross",
    });
    const rows = await readCrossCoupons(campaignId);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      id: coupon.id,
      consumerId: consumer.id,
      membershipId: null,
      welcomeMembershipId: null,
      label: "10% en tu primera clase",
      cost: "2.00",
      kind: "discount",
      discountValue: "10.00",
    });
    expect(row.crossClaimedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row.validFrom.getTime()).toBe(row.crossClaimedAt!.getTime());
    expect(row.validUntil.getTime() - row.validFrom.getTime()).toBe(7 * DAY);

    // E3 (C3): it lives in the consumer's own coupons, `origin: "cross"`, unfiltered …
    const own = await listConsumerCoupons(consumer.id);
    expect(own.map((c) => [c.id, c.origin])).toEqual([[row.id, "cross"]]);
    // … and it left the offers (O8).
    expect(offeredBy(await offersOf(consumer.id, here), x)).toEqual([]);
    // No Wallet, no Web Push (ADR 0103 §2).
    expect(
      await getDb()
        .select({ id: walletPushQueue.id })
        .from(walletPushQueue)
        .where(eq(walletPushQueue.consumerId, consumer.id)),
    ).toEqual([]);
    expect(
      await getDb()
        .select({ id: campaignPushes.id })
        .from(campaignPushes)
        .where(eq(campaignPushes.consumerId, consumer.id)),
    ).toEqual([]);
  }, 180_000);

  it("ORACULO DE M7 — the same consumer claiming twice gets 200 with the SAME coupon, and one row", async () => {
    const cat = category("m7");
    const here = base(12);
    const x = await crossBusiness("Cruz M7", cat("gym"), north(here, 300));
    const campaignId = await crossCampaign(x);
    const consumer = await crossConsumer();

    const first = await claim(consumer.id, campaignId, here);
    expect(first.status).toBe(201);
    // Without the GPS the second one would not even pass the rules: the answer is the
    // coupon already held, not a re-evaluation.
    const second = await claim(consumer.id, campaignId);
    expect(second.status).toBe(200);
    expect((second.body.coupon as { id: string }).id).toBe(
      (first.body.coupon as { id: string }).id,
    );
    expect(await readCrossCoupons(campaignId)).toHaveLength(1);
  }, 180_000);

  for (let race = 1; race <= RACES; race += 1)
    it(`ORACULO DE M6 — race ${race}/${RACES}: cap 1, two DIFFERENT consumers at once → ONE coupon and one 404`, async () => {
      const cat = category(`m6-${race}`);
      const here = base(12 + race);
      const x = await crossBusiness("Cruz M6", cat("gym"), north(here, 300));
      const campaignId = await crossCampaign(x, { monthlyCap: 1 });
      const a = await crossConsumer();
      const b = await crossConsumer();

      const answers = await Promise.all([
        claim(a.id, campaignId, here),
        claim(b.id, campaignId, here),
      ]);
      expect(answers.map((r) => r.status).sort()).toEqual([201, 404]);
      expect(await readCrossCoupons(campaignId)).toHaveLength(1);
      expect(answers.find((r) => r.status === 404)!.body).toMatchObject({
        code: "offer_unavailable",
      });
    }, 180_000);

  it("404 offer_unavailable: too far, another audience, a campaign that is not cross, one that does not exist, no origin", async () => {
    const cat = category("404");
    const here = base(17);
    const far = await crossBusiness(
      "Cruz 404 far",
      cat("gym"),
      north(here, 2600),
    );
    const members = await crossBusiness(
      "Cruz 404 members",
      cat("pool"),
      north(here, 300),
    );
    const farId = await crossCampaign(far);
    const membersId = await crossCampaign(members);
    const consumer = await crossConsumer();
    await memberOf(members, consumer.id);
    const notCross = await seedCampaign({
      businessId: members.seed.business.id,
      createdByUserId: members.seed.userId,
      locationIds: [members.seed.locationId],
      coupon: { label: "2x1", cost: "1.00", maxRedemptions: 10 },
    });
    for (const id of [
      farId,
      membersId,
      notCross,
      "0112dead-0000-4000-8000-000000000000",
    ]) {
      const answer = await claim(consumer.id, id, here);
      expect(answer.status).toBe(404);
      expect(answer.body).toMatchObject({ code: "offer_unavailable" });
    }
    // Without any location: no origin, so not claimable either.
    const lost = await crossConsumer();
    expect((await claim(lost.id, membersId)).status).toBe(404);
    expect(await readCrossCoupons(farId)).toEqual([]);
    expect(await readCrossCoupons(membersId)).toEqual([]);
  }, 180_000);

  it("`dormant`/`any`: a member's coupon carries their membership", async () => {
    const cat = category("member");
    const here = base(18);
    const x = await crossBusiness("Cruz member", cat("gym"), north(here, 300));
    const campaignId = await crossCampaign(x, { audience: "any" });
    const consumer = await crossConsumer();
    const membershipId = await memberOf(x, consumer.id, {
      enrolledAt: new Date(Date.now() - 100 * DAY),
    });
    expect((await claim(consumer.id, campaignId, here)).status).toBe(201);
    const [row] = await readCrossCoupons(campaignId);
    expect(row.membershipId).toBe(membershipId);
  }, 180_000);

  // ORACULO DE R-M10 (revisor): `c.status = 'active'` in `loadCrossCampaigns` is the ONLY
  // guard of a turned-off offer — `disableTemplate` ends the run (`status = 'ended'`) and
  // leaves `ends_at`/`activated_at` alone, so no other condition catches it.
  it("a cross offer the business turned off is no longer listed nor claimable (404)", async () => {
    const cat = category("off");
    const here = base(19);
    const x = await crossBusiness("Cruz off", cat("gym"), north(here, 300));
    const campaignId = await crossCampaign(x);
    const consumer = await crossConsumer();
    // Control: live, it is offered.
    expect(offeredBy(await offersOf(consumer.id, here), x)).toEqual([
      x.seed.business.id,
    ]);

    await disableTemplate(x.seed.business.id, "cross");

    expect(offeredBy(await offersOf(consumer.id, here), x)).toEqual([]);
    const answer = await claim(consumer.id, campaignId, here);
    expect(answer.status).toBe(404);
    expect(answer.body).toMatchObject({ code: "offer_unavailable" });
    expect(await readCrossCoupons(campaignId)).toEqual([]);
  }, 180_000);
});
