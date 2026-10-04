import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { integrationEnabled } from "./counter-integration-support";
import {
  type CouponWorld,
  chooseCoupon,
  couponBody,
  dropCouponWorld,
  forceChoice,
  newCouponCard,
  readCoupons,
  seedCouponWorld,
} from "./counter-coupon-support";
import {
  optOut,
  seedCampaign,
  setCampaignState,
} from "./marketing-integration-support";
import { validateCoupon } from "./counter/coupon-validate";
import { resolveScan } from "./counter/resolve";
import { getDb } from "@mi-pasaporte/db";
import { campaignTurns, campaigns } from "@mi-pasaporte/db/schema";

/**
 * Spec 0102 / ADR 0094 — WHAT CUTS AN ISSUED COUPON, against Neon. Only three things do:
 * its `valid_until` (the campaign's `ends_at`, copied), its redemption, and the campaign's
 * cap. The turn that issued it and the campaign's STATUS do not. Every case gets its own
 * world, because these cases move the campaign's state and a shared one would leak.
 *
 * Split from `counter-coupon.neon.integration.test.ts` by the file-size budget.
 *
 * Spec 0148: the scan paints the coupon the consumer CHOSE (`couponState: selected`) and the
 * counter VALIDATES it (`validateCoupon`).
 */

const HOUR = 3_600_000;
const worlds: CouponWorld[] = [];

async function world(prefix: string, endsAt?: Date): Promise<CouponWorld> {
  const built = await seedCouponWorld(prefix, 100, endsAt);
  worlds.push(built);
  return built;
}

describe.skipIf(!integrationEnabled)("coupon validity (spec 0102)", () => {
  afterEach(async () => {
    for (const built of worlds.splice(0)) await dropCouponWorld(built);
  }, 120_000);

  it("(a) a turn cancelled by opt_out does NOT take the coupon back: scan paints it, redeem is 200", async () => {
    const w = await world("Cupon opt-out");
    const card = await newCouponCard(w);
    // The state `cancelTurns` leaves for an opted-out member.
    await optOut(card.membershipId, new Date());
    await getDb()
      .update(campaignTurns)
      .set({ status: "cancelled", cancelReason: "opt_out" })
      .where(eq(campaignTurns.id, card.turnId));
    await chooseCoupon(card);

    const scan = await resolveScan(w.seed.business, card.qrToken);
    expect(scan.couponState).toMatchObject({
      status: "selected",
      coupon: { couponId: card.couponId },
    });
    await expect(
      validateCoupon(w.seed.business, w.seed.userId, couponBody(card, w.seed)),
    ).resolves.toMatchObject({ coupon: { label: expect.any(String) } });
    expect(await readCoupons(w.campaignId)).toHaveLength(1);
  }, 120_000);

  it("(a') an ENDED campaign keeps its coupon in date: scan paints it, redeem is 200", async () => {
    // Inverts the phase-C case «el scan NO pinta el cupon de una campaña pausada»
    // (ADR 0094 §2 and its Consecuencias).
    const w = await world("Cupon campaña finalizada");
    const card = await newCouponCard(w);
    await setCampaignState(w.campaignId, "ended");
    await getDb()
      .update(campaigns)
      .set({ endedAt: new Date() })
      .where(eq(campaigns.id, w.campaignId));
    await chooseCoupon(card);

    const scan = await resolveScan(w.seed.business, card.qrToken);
    expect(scan.couponState).toMatchObject({
      status: "selected",
      coupon: { couponId: card.couponId, validUntil: w.endsAt },
    });
    await expect(
      validateCoupon(w.seed.business, w.seed.userId, couponBody(card, w.seed)),
    ).resolves.toMatchObject({ coupon: { label: expect.any(String) } });
    expect(await readCoupons(w.campaignId)).toHaveLength(1);
  }, 120_000);

  it("(a') a PAUSED campaign keeps showing its coupon too", async () => {
    const w = await world("Cupon campaña pausada");
    const card = await newCouponCard(w);
    await setCampaignState(w.campaignId, "paused", "owner");
    await chooseCoupon(card);

    const scan = await resolveScan(w.seed.business, card.qrToken);
    expect(scan.couponState).toMatchObject({
      status: "selected",
      coupon: { couponId: card.couponId },
    });
  }, 120_000);

  it("(a'') past the campaign's ends_at: scan paints nothing, redeem is 409 coupon_not_active", async () => {
    const w = await world("Cupon vencido", new Date(Date.now() - HOUR));
    const card = await newCouponCard(w);
    // A stale choice (made while it was valid): the choice never expires, the coupon does.
    await forceChoice(card);

    const scan = await resolveScan(w.seed.business, card.qrToken);
    expect(scan.couponState).toEqual({ status: "none" });
    await expect(
      validateCoupon(w.seed.business, w.seed.userId, couponBody(card, w.seed)),
    ).rejects.toMatchObject({ status: 409, code: "coupon_not_active" });
    expect(await readCoupons(w.campaignId)).toEqual([]);
  }, 120_000);

  it("the database refuses a campaign with a coupon and no ends_at (CHECK backstop)", async () => {
    const w = await world("Cupon sin fin");
    await expect(
      seedCampaign({
        businessId: w.seed.business.id,
        createdByUserId: w.seed.userId,
        locationIds: [],
        coupon: { label: "2x1", cost: "1.00", maxRedemptions: 5 },
        endsAt: null,
      }),
    ).rejects.toMatchObject({
      cause: { constraint: "core_campaign_coupon_needs_end_check" },
    });
  }, 120_000);

  it("the scan does NOT paint a coupon of ANOTHER business", async () => {
    // Revision independiente de la fase C: sin el scope por negocio de la LECTURA, el
    // mostrador de A pintaría el cupón de B para el mismo consumidor y el botón
    // contestaría 404 (el guard del CANJE sí re-chequea el negocio).
    const mine = await world("Cupon propio");
    const other = await world("Cupon de otro negocio");
    const card = await newCouponCard(other);
    await chooseCoupon(card);
    expect(
      (await resolveScan(mine.seed.business, card.qrToken)).couponState,
    ).toEqual({ status: "none" });
    expect(
      (await resolveScan(other.seed.business, card.qrToken)).couponState,
    ).toMatchObject({ status: "selected" });
  }, 120_000);
});
