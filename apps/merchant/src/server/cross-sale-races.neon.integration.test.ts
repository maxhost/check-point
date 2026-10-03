import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { dropCrossWorlds } from "./consumer-cross-support";
import {
  MINUTE,
  couponsOf,
  decisionsOf,
  enrolled,
  orderAt,
  queueOf,
  saleWorld,
  waitForLockWaiters,
} from "./cross-sale-support";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { sql } from "drizzle-orm";
import { decideCrossSale } from "@mi-pasaporte/domain/server/marketing/cross-sale";

/**
 * Spec 0143 §2 — the two ways one purchase could give twice, against a real base, calling
 * `decideCrossSale` by hand over orders written by SQL (no counter, no `after()`):
 *
 *  - the SAME order decided twice (ORACULO DE M3): the second run finds the `cross_decision`
 *    of the order (`on conflict (order_id) do nothing`) and writes NOTHING. With two eligible
 *    campaigns the partial unique of the coupon does not save it — the second run would
 *    pick the OTHER campaign — so the oracle counts decisions, coupons and queue rows;
 *  - the same consumer buying twice AT ONCE with one eligible campaign: both read «no coupon
 *    of B yet», both wait on B's lock (held here by the test), and the loser's insert is
 *    refused by the partial unique → `coupon_conflict`, without a push.
 */

afterAll(dropCrossWorlds, 180_000);

const NOW = new Date();

describe.skipIf(!integrationEnabled)(
  "cross sale — idempotency and races",
  () => {
    it("ORACULO DE M3 — the same order decided twice: ONE decision, ONE coupon, ONE campaign row; the second run returns null", async () => {
      const w = await saleWorld("twice");
      const who = await enrolled(w.a);
      const orderId = await orderAt(w.a, who, new Date(NOW.getTime() - MINUTE));
      expect(
        await decideCrossSale(orderId, { now: NOW, random: () => 0 }),
      ).toBe("issued");
      expect(
        await decideCrossSale(orderId, { now: NOW, random: () => 0 }),
      ).toBeNull();
      // `u = 0` draws the first candidate by campaign id.
      const firstById = [w.campaignB, w.campaignC].sort()[0];
      const decisions = await decisionsOf(who.consumerId);
      expect(decisions.map((d) => [d.outcome, d.chosenCampaignId])).toEqual([
        ["issued", firstById],
      ]);
      expect(await couponsOf(who.consumerId)).toHaveLength(1);
      expect(
        (await queueOf(who.consumerId)).filter((r) => r.class === "campaign"),
      ).toHaveLength(1);
    }, 120_000);

    it("two purchases at once, one eligible campaign: one `issued`, one `coupon_conflict`; ONE coupon and ONE push", async () => {
      const w = await saleWorld("conflict");
      // Only B is eligible: C's campaign is paused.
      await getDb().execute(
        sql`update core.campaign set status = 'paused' where id = ${w.campaignC}`,
      );
      const who = await enrolled(w.a);
      const first = await orderAt(
        w.a,
        who,
        new Date(NOW.getTime() - 2 * MINUTE),
      );
      const second = await orderAt(w.a, who, new Date(NOW.getTime() - MINUTE));

      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let locked!: () => void;
      const isLocked = new Promise<void>((resolve) => {
        locked = resolve;
      });
      // The test holds B's campaign row, so both decisions read their facts and then wait.
      const holder = withDbTransaction(async (tx) => {
        await tx.execute(
          sql`select id from core.campaign where id = ${w.campaignB} for update`,
        );
        locked();
        await held;
      });
      await isLocked;
      const runs = [first, second].map((orderId) =>
        decideCrossSale(orderId, { now: NOW, random: () => 0 }),
      );
      try {
        await waitForLockWaiters(2);
      } finally {
        release();
      }
      await holder;
      expect((await Promise.all(runs)).sort()).toEqual([
        "coupon_conflict",
        "issued",
      ]);

      const decisions = await decisionsOf(who.consumerId);
      expect(decisions.map((d) => d.outcome)).toEqual([
        "coupon_conflict",
        "issued",
      ]);
      const [conflict, issued] = decisions;
      expect(conflict).toMatchObject({
        chosenCampaignId: w.campaignB,
        couponId: null,
        queueId: null,
      });
      expect(issued.couponId).not.toBeNull();
      expect(await couponsOf(who.consumerId)).toHaveLength(1);
      expect(
        (await queueOf(who.consumerId)).filter((r) => r.class === "campaign"),
      ).toEqual([expect.objectContaining({ id: issued.queueId })]);
    }, 120_000);
  },
);
