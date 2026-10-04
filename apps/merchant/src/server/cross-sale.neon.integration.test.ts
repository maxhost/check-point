import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE `after()` OF THE GRANT, MADE AWAITABLE: outside a request `after()` throws and the code
 * falls back to a fire-and-forget; here every task is collected so the test awaits it.
 */
const after = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: Promise<unknown> | (() => unknown)) => {
    after.tasks.push(
      Promise.resolve().then(typeof task === "function" ? task : () => task),
    );
  },
}));

/** ORACULO DE M2: a spy over the REAL `decideCrossSale` counts how often `afterGrant` calls
 * it — the `unique (order_id)` would hide a second call from any row count. */
const spy = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock(
  "@mi-pasaporte/domain/server/marketing/cross-sale",
  async (importOriginal) => {
    const real =
      await importOriginal<
        typeof import("@mi-pasaporte/domain/server/marketing/cross-sale")
      >();
    return {
      ...real,
      decideCrossSale: (...args: Parameters<typeof real.decideCrossSale>) => {
        spy.calls.push(args[0]);
        return real.decideCrossSale(...args);
      },
    };
  },
);

import {
  integrationEnabled,
  seedReward,
  setBalance,
} from "./counter-integration-support";
import { dropCrossWorlds } from "./consumer-cross-support";
import {
  MINUTE,
  businessName,
  candidatesOf,
  couponsOf,
  decisionsOf,
  enrolled,
  grant,
  lonelyA,
  queueOf,
  saleWorld,
  ungeocode,
} from "./cross-sale-support";
import { redeemReward } from "./counter/redeem";
import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { validateCoupon } from "./counter/coupon-validate";
import { resolveScan } from "./counter/resolve";
import { claimCrossOffer } from "@mi-pasaporte/domain/server/consumer/cross-offers";
import { selectCoupon } from "@mi-pasaporte/domain/server/consumer/coupon-selection";

/**
 * Spec 0143 — THE CROSS SALE TRIGGERED BY THE PURCHASE, through the real counter
 * (`grantAccrual` → `afterGrant` → `decideCrossSale`) against a real base. Every state is
 * READ BY SQL (ADR 0054). The decision draws with `Math.random` here: the assertions follow
 * the CHOSEN campaign the decision recorded, never a guessed one. The idempotency and the
 * conflict of two purchases are in `cross-sale-races.neon.integration.test.ts`.
 */

afterAll(dropCrossWorlds, 180_000);

async function settle(): Promise<void> {
  while (after.tasks.length > 0) await Promise.all(after.tasks.splice(0));
}

beforeEach(() => {
  spy.calls.splice(0);
});

const TITLE = "🎁 Tenés un regalo";

describe.skipIf(!integrationEnabled)("cross sale — by the purchase", () => {
  it("ORACULO DE M1 y M2 — two eligible: ONE decision, ONE coupon of the chosen, TWO candidates summing 1, ONE campaign row at +3 min; the retry adds nothing", async () => {
    const w = await saleWorld("issued");
    const who = await enrolled(w.a);
    const key = randomUUID();
    await grant(w.a, who.membershipId, key);
    await settle();

    const [decision, ...more] = await decisionsOf(who.consumerId);
    expect(more).toEqual([]);
    expect(decision).toMatchObject({
      businessId: w.a.seed.business.id,
      locationId: w.a.seed.locationId,
      originKind: "last_scan",
      policy: "h4-v1",
      epsilon: 0.2,
      candidateCount: 2,
      outcome: "issued",
      clickedAt: null,
    });
    expect([w.campaignB, w.campaignC]).toContain(decision.chosenCampaignId);
    expect(decision.draw).toBeGreaterThanOrEqual(0);
    expect(decision.draw).toBeLessThan(1);

    const coupons = await couponsOf(who.consumerId);
    expect(coupons).toEqual([
      {
        id: decision.couponId,
        campaignId: decision.chosenCampaignId,
        crossClaimedAt: decision.decidedAt,
      },
    ]);

    const candidates = await candidatesOf(decision.id);
    expect(candidates.map((c) => c.campaignId)).toEqual([
      w.campaignB,
      w.campaignC,
    ]);
    expect(candidates.map((c) => c.locationId)).toEqual([
      w.b.seed.locationId,
      w.c.seed.locationId,
    ]);
    const total = candidates.reduce((sum, c) => sum + c.probability, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
    for (const candidate of candidates)
      expect(candidate).toMatchObject({
        segment: "new",
        ordersCount: 0,
        daysSinceLastOrder: null,
        capRemaining: 50,
        factorBonus: 1.5, // neither B nor C got a new customer this month
      });
    expect(candidates.map((c) => c.distanceMeters)).toEqual([300, 900]);

    const campaignRows = (await queueOf(who.consumerId)).filter(
      (row) => row.class === "campaign",
    );
    expect(campaignRows).toEqual([
      {
        id: decision.queueId,
        class: "campaign",
        title: TITLE,
        body: `Por tu compra en ${await businessName(w.a)}. Abrí la app y descubrí qué es.`,
        status: "pending",
        notBefore: new Date(decision.decidedAt.getTime() + 3 * MINUTE),
      },
    ]);
    expect(spy.calls).toEqual([decision.orderId]);

    // The retry of the same `clientRequestId`: no new decision, coupon nor queue row — and
    // `decideCrossSale` is not even called.
    const queued = (await queueOf(who.consumerId)).length;
    await grant(w.a, who.membershipId, key);
    await settle();
    expect(await decisionsOf(who.consumerId)).toHaveLength(1);
    expect(await couponsOf(who.consumerId)).toHaveLength(1);
    expect(await queueOf(who.consumerId)).toHaveLength(queued);
    expect(spy.calls).toEqual([decision.orderId]);
  }, 120_000);

  it("no eligible campaign within 2 km → `no_candidates`, no coupon, no push", async () => {
    const a = await lonelyA("none");
    const who = await enrolled(a);
    await grant(a, who.membershipId);
    await settle();
    const decisions = await decisionsOf(who.consumerId);
    expect(decisions).toEqual([
      expect.objectContaining({
        outcome: "no_candidates",
        originKind: "last_scan",
        candidateCount: 0,
        draw: null,
        chosenCampaignId: null,
        couponId: null,
        queueId: null,
      }),
    ]);
    expect(await candidatesOf(decisions[0].id)).toEqual([]);
    expect(await couponsOf(who.consumerId)).toEqual([]);
    expect(
      (await queueOf(who.consumerId)).filter((r) => r.class === "campaign"),
    ).toEqual([]);
  }, 120_000);

  it("an order with no geocoded place anywhere → `no_origin`, nothing issued", async () => {
    const w = await saleWorld("origin");
    await ungeocode(w.a);
    const who = await enrolled(w.a);
    await grant(w.a, who.membershipId);
    await settle();
    expect(await decisionsOf(who.consumerId)).toEqual([
      expect.objectContaining({
        outcome: "no_origin",
        originKind: "none",
        candidateCount: 0,
      }),
    ]);
    expect(await couponsOf(who.consumerId)).toEqual([]);
  }, 120_000);

  it("redeeming a reward or a coupon does NOT trigger it (only accrediting)", async () => {
    const w = await saleWorld("redeem");
    const who = await enrolled(w.a);
    // A cross coupon of B to redeem, sown with the domain's claim.
    const claimed = await claimCrossOffer(
      who.consumerId,
      w.campaignB,
      w.a.point,
    );
    if (claimed.status !== 201) throw new Error(`claim → ${claimed.status}`);
    const rewardId = await seedReward({
      programId: w.a.seed.programId,
      businessId: w.a.seed.business.id,
      pointsCost: 10,
    });
    await setBalance(who.membershipId, { points: 50 });
    await redeemReward(w.a.seed.business, w.a.seed.userId, {
      clientRequestId: randomUUID(),
      membershipId: who.membershipId,
      rewardId,
      locationId: w.a.seed.locationId,
    });
    // The counter of B scans first (it auto-enrols the non-member, ADR 0033). Spec 0148: a
    // DISCOUNT is only redeemed inside a sale — which IS an accreditation —, so the coupon is
    // turned into a free-text one (validated without a sale) to keep measuring «a coupon
    // redemption does not trigger it»; the consumer chooses it, the counter validates it.
    await getDb().execute(
      sql`update core.campaign_coupon set kind_snapshot = 'custom',
        discount_unit_snapshot = null, discount_value_snapshot = null
        where id = ${claimed.coupon.id}`,
    );
    const atB = await resolveScan(w.b.seed.business, who.qrToken);
    expect(await selectCoupon(who.consumerId, claimed.coupon.id)).toMatchObject(
      { status: 200 },
    );
    await validateCoupon(w.b.seed.business, w.b.seed.userId, {
      clientRequestId: randomUUID(),
      membershipId: atB.membership.id,
      couponId: claimed.coupon.id,
      locationId: w.b.seed.locationId,
    });
    await settle();
    expect(await decisionsOf(who.consumerId)).toEqual([]);
    expect(spy.calls).toEqual([]);
  }, 120_000);

  it("the consumer already holds B's coupon → B is not a candidate (once per campaign)", async () => {
    const w = await saleWorld("once");
    const who = await enrolled(w.a);
    const claimed = await claimCrossOffer(
      who.consumerId,
      w.campaignB,
      w.a.point,
    );
    expect(claimed.status).toBe(201);
    await grant(w.a, who.membershipId);
    await settle();
    const [decision] = await decisionsOf(who.consumerId);
    expect(decision).toMatchObject({
      outcome: "issued",
      candidateCount: 1,
      chosenCampaignId: w.campaignC,
    });
    expect(
      (await candidatesOf(decision.id)).map((c) => [
        c.campaignId,
        c.probability,
      ]),
    ).toEqual([[w.campaignC, 1]]);
    expect(
      (await couponsOf(who.consumerId)).map((c) => c.campaignId).sort(),
    ).toEqual([w.campaignB, w.campaignC].sort());
  }, 120_000);
});
