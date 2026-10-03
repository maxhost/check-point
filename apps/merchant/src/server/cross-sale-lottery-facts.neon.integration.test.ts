import { afterAll, describe, expect, it } from "vitest";
import { integrationEnabled } from "./counter-integration-support";
import { dropCrossWorlds } from "./consumer-cross-support";
import {
  MINUTE,
  candidatesOf,
  decisionsOf,
  enrolled,
  orderAt,
  saleWorld,
} from "./cross-sale-support";
import { decideCrossSale } from "@mi-pasaporte/domain/server/marketing/cross-sale";

/**
 * THE LOTTERY'S FACTS FROM THE BASE (spec 0143 §3). The unit test of `cross-lottery.ts`
 * receives F, R and the H4 bonus already computed; these cases pin the SQL that computes
 * them (`loadLotteryHistory`, `gotNewCustomerSince` in `cross-sale-store.ts`): F is the sum
 * of 1/k of the month's decisions (not their count), R counts the chosen ones, and the bonus
 * looks at the business's FIRST-EVER order of each customer. Added after the independent
 * review found a `count(*)` in place of `sum(1/k)` survived every other suite.
 */
afterAll(dropCrossWorlds, 180_000);
const NOW = new Date();
const DAY = 86_400_000;

describe.skipIf(!integrationEnabled)(
  "cross sale: lottery facts from the base",
  () => {
    it("F/R from the base: the 2nd decision's behind factors", async () => {
      const w = await saleWorld("probeF");
      const first = await enrolled(w.a);
      const o1 = await orderAt(
        w.a,
        first,
        new Date(NOW.getTime() - 2 * MINUTE),
      );
      expect(await decideCrossSale(o1, { now: NOW, random: () => 0 })).toBe(
        "issued",
      );
      const [d1] = await decisionsOf(first.consumerId);
      const second = await enrolled(w.a);
      const o2 = await orderAt(w.a, second, new Date(NOW.getTime() - MINUTE));
      expect(await decideCrossSale(o2, { now: NOW, random: () => 0 })).toBe(
        "issued",
      );
      const [d2] = await decisionsOf(second.consumerId);
      const rows = await candidatesOf(d2.id);
      const behind = Object.fromEntries(
        rows.map((r) => [r.campaignId, r.factorBehind]),
      );
      // F = 1/2 (previous) + 1/2 (this) = 1; R = 1 for the first chosen, 0 for the other.
      const other = [w.campaignB, w.campaignC].find(
        (c) => c !== d1.chosenCampaignId,
      )!;
      expect(behind[d1.chosenCampaignId!]).toBeCloseTo(1, 9);
      expect(behind[other]).toBeCloseTo(2, 9);
    }, 120_000);

    it("H4 bonus: B got a first-ever customer this month → 1; C's only customer is old → 1.5", async () => {
      const w = await saleWorld("probeH");
      const fresh = await enrolled(w.b);
      await orderAt(w.b, fresh, new Date(NOW.getTime() - 5 * MINUTE));
      const old = await enrolled(w.c);
      await orderAt(w.c, old, new Date(NOW.getTime() - 60 * DAY));
      await orderAt(w.c, old, new Date(NOW.getTime() - 5 * MINUTE));
      const buyer = await enrolled(w.a);
      const o = await orderAt(w.a, buyer, new Date(NOW.getTime() - MINUTE));
      expect(await decideCrossSale(o, { now: NOW, random: () => 0 })).toBe(
        "issued",
      );
      const [d] = await decisionsOf(buyer.consumerId);
      const bonus = Object.fromEntries(
        (await candidatesOf(d.id)).map((r) => [r.campaignId, r.factorBonus]),
      );
      expect(bonus).toEqual({ [w.campaignB]: 1, [w.campaignC]: 1.5 });
    }, 120_000);
  },
);
