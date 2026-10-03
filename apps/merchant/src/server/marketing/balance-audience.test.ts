import { describe, expect, it } from "vitest";
import { campaignKindEnabled } from "@mi-pasaporte/domain/server/marketing/enabled-campaigns";
import {
  type BalanceCandidate,
  type BalanceContext,
  decideBalancePush,
  renderGap,
} from "./balance-audience";

const DAY = 86_400_000;
const NOW = new Date("2026-09-27T12:00:00.000Z");
const ago = (days: number, ms = 0) => new Date(NOW.getTime() - days * DAY - ms);

/** A dormant (enrolled 100 days ago, no order), reachable, opted-in membership with
 * 8 of 10 stamps and no history. Every case changes ONE thing. */
const candidate = (over: Partial<BalanceCandidate> = {}): BalanceCandidate => ({
  membershipId: "m",
  consumerId: "c",
  marketingOptOutAt: null,
  enrolledAt: ago(100),
  lastOrderAt: null,
  pushReachable: true,
  lastGroupDecisionAt: null,
  balance: 8,
  lastRedemptionAt: null,
  ownDecisions: [],
  ...over,
});

const near = (over: Partial<BalanceContext> = {}): BalanceContext => ({
  now: NOW,
  dormantDays: 7,
  template: "near_reward",
  reward: { kind: "stamps", cost: 10 },
  nearRewardStamps: 2,
  nearRewardPercent: 20,
  rewardRepeat: null,
  ...over,
});

const unclaimed = (over: Partial<BalanceContext> = {}): BalanceContext =>
  near({
    template: "unclaimed_reward",
    nearRewardStamps: null,
    nearRewardPercent: null,
    rewardRepeat: "once",
    ...over,
  });

const points = { kind: "points" as const, cost: 100 };

describe.skipIf(
  !["near_reward", "unclaimed_reward"].some((key) => campaignKindEnabled(key)),
)("decideBalancePush — the shared exclusions, in order", () => {
  it("opt_out → not_reachable → not_dormant → no_reward, before any balance rule", () => {
    // Everything wrong at once: the FIRST reason wins, then peel one at a time.
    const all = candidate({
      marketingOptOutAt: ago(1),
      pushReachable: false,
      enrolledAt: ago(1),
      balance: 0,
    });
    const ctx = near({ reward: null });
    expect(decideBalancePush(all, ctx)).toEqual({
      kind: "excluded",
      reason: "opt_out",
    });
    const reachable = { ...all, marketingOptOutAt: null };
    expect(decideBalancePush(reachable, ctx)).toMatchObject({
      reason: "not_reachable",
    });
    const dormant = { ...reachable, pushReachable: true };
    expect(decideBalancePush(dormant, ctx)).toMatchObject({
      reason: "not_dormant",
    });
    expect(
      decideBalancePush({ ...dormant, enrolledAt: ago(100) }, ctx),
    ).toMatchObject({ reason: "no_reward" });
    expect(
      decideBalancePush(candidate(), unclaimed({ reward: null })),
    ).toMatchObject({ reason: "no_reward" });
  });
});

describe.skipIf(!campaignKindEnabled("near_reward"))(
  "decideBalancePush — #7 near_reward",
  () => {
    it("Sellos: gap = N is eligible with its gap; N+1 is not_near", () => {
      expect(decideBalancePush(candidate({ balance: 8 }), near())).toEqual({
        kind: "eligible",
        gap: 2,
      });
      expect(decideBalancePush(candidate({ balance: 7 }), near())).toEqual({
        kind: "excluded",
        reason: "not_near",
      });
      expect(
        decideBalancePush(
          candidate({ balance: 7 }),
          near({ nearRewardStamps: 3 }),
        ),
      ).toEqual({ kind: "eligible", gap: 3 });
    });

    it("Puntos: cost 100, P 20 → gap 20 eligible, 21 not_near (the % rule, not N)", () => {
      const ctx = near({ reward: points });
      expect(decideBalancePush(candidate({ balance: 80 }), ctx)).toEqual({
        kind: "eligible",
        gap: 20,
      });
      expect(decideBalancePush(candidate({ balance: 79 }), ctx)).toEqual({
        kind: "excluded",
        reason: "not_near",
      });
      // P 10: gap 10 in, 15 out.
      const ten = near({ reward: points, nearRewardPercent: 10 });
      expect(decideBalancePush(candidate({ balance: 90 }), ten)).toMatchObject({
        kind: "eligible",
      });
      expect(decideBalancePush(candidate({ balance: 85 }), ten)).toMatchObject({
        reason: "not_near",
      });
    });

    it("balance = cost (or above) is has_reward — that customer is #8's", () => {
      for (const balance of [10, 12])
        expect(decideBalancePush(candidate({ balance }), near())).toEqual({
          kind: "excluded",
          reason: "has_reward",
        });
    });

    it("already_reached: a #7/#8 decision since the last visit (the group rule)", () => {
      const visit = ago(20);
      expect(
        decideBalancePush(
          candidate({ lastOrderAt: visit, lastGroupDecisionAt: visit }),
          near(),
        ),
      ).toMatchObject({ reason: "already_reached" });
      expect(
        decideBalancePush(
          candidate({ lastOrderAt: visit, lastGroupDecisionAt: ago(20, 1) }),
          near(),
        ),
      ).toMatchObject({ kind: "eligible" });
    });

    it("ONE per redemption cycle: a decision at the instant of the redemption still counts; 1 ms before does not", () => {
      const redeemed = ago(50);
      expect(
        decideBalancePush(
          candidate({ lastRedemptionAt: redeemed, ownDecisions: [redeemed] }),
          near(),
        ),
      ).toEqual({ kind: "excluded", reason: "already_this_cycle" });
      expect(
        decideBalancePush(
          candidate({ lastRedemptionAt: redeemed, ownDecisions: [ago(50, 1)] }),
          near(),
        ),
      ).toEqual({ kind: "eligible", gap: 2 });
      // A VISIT does not open a new cycle: decided, then an order, dormant again → no.
      expect(
        decideBalancePush(
          candidate({ lastOrderAt: ago(30), ownDecisions: [ago(60)] }),
          near(),
        ),
      ).toMatchObject({ reason: "already_this_cycle" });
    });
  },
);

describe.skipIf(!campaignKindEnabled("unclaimed_reward"))(
  "decideBalancePush — #8 unclaimed_reward",
  () => {
    it("balance < cost is no_reward_yet; balance = cost is eligible", () => {
      expect(decideBalancePush(candidate({ balance: 9 }), unclaimed())).toEqual(
        {
          kind: "excluded",
          reason: "no_reward_yet",
        },
      );
      expect(
        decideBalancePush(candidate({ balance: 10 }), unclaimed()),
      ).toMatchObject({ kind: "eligible" });
    });

    it("once: one decision in this absence blocks; one of a PREVIOUS absence does not", () => {
      const has = { balance: 10 };
      expect(
        decideBalancePush(
          candidate({ ...has, ownDecisions: [ago(40)] }),
          unclaimed(),
        ),
      ).toEqual({ kind: "excluded", reason: "already_reached" });
      expect(
        decideBalancePush(
          candidate({ ...has, lastOrderAt: ago(20), ownDecisions: [ago(40)] }),
          unclaimed(),
        ),
      ).toMatchObject({ kind: "eligible" });
    });

    it("every_30_days: 1 decision exactly 30 d ago is eligible, 29 d is not, 2 decisions never", () => {
      const ctx = unclaimed({ rewardRepeat: "every_30_days" });
      const has = { balance: 10 };
      expect(
        decideBalancePush(candidate({ ...has, ownDecisions: [ago(30)] }), ctx),
      ).toMatchObject({ kind: "eligible" });
      expect(
        decideBalancePush(candidate({ ...has, ownDecisions: [ago(29)] }), ctx),
      ).toEqual({ kind: "excluded", reason: "already_reached" });
      expect(
        decideBalancePush(
          candidate({ ...has, ownDecisions: [ago(90), ago(60)] }),
          ctx,
        ),
      ).toEqual({ kind: "excluded", reason: "already_reached" });
    });
  },
);

describe.skipIf(!campaignKindEnabled("near_reward"))("renderGap", () => {
  it("singular and plural of each unit, and EVERY marker", () => {
    const msg = "¡Estás a {faltan} de tu premio!";
    expect(renderGap(msg, 1, "stamps")).toBe("¡Estás a 1 sello de tu premio!");
    expect(renderGap(msg, 2, "stamps")).toBe("¡Estás a 2 sellos de tu premio!");
    expect(renderGap(msg, 1, "points")).toBe("¡Estás a 1 punto de tu premio!");
    expect(renderGap(msg, 15, "points")).toBe(
      "¡Estás a 15 puntos de tu premio!",
    );
    expect(renderGap("{faltan} y {faltan}", 3, "stamps")).toBe(
      "3 sellos y 3 sellos",
    );
  });
});
