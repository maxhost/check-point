import { describe, expect, it } from "vitest";
import type { AtRiskRule } from "./at-risk";
import { type PushCandidate, decidePushEligibility } from "./push-audience";

/** Spec 0103 §4 — who gets a push decided, and why not. PURE. */
const DAY = 86_400_000;
const NOW = new Date("2026-09-26T12:00:00.000Z");
const ENROLLED = new Date(NOW.getTime() - 100 * DAY);

const candidate = (over: Partial<PushCandidate> = {}): PushCandidate => ({
  membershipId: "m-1",
  consumerId: "c-1",
  marketingOptOutAt: null,
  enrolledAt: ENROLLED,
  lastOrderAt: null,
  // Spec 0105: no habit by default; only the at-risk cases below read it.
  visitDays: 0,
  firstOrderAt: null,
  pushReachable: true,
  lastGroupDecisionAt: null,
  ...over,
});
const decide = (over: Partial<PushCandidate> = {}) =>
  decidePushEligibility(candidate(over), {
    now: NOW,
    dormantDays: 30,
    atRisk: null,
  });
const reason = (over: Partial<PushCandidate> = {}) => {
  const result = decide(over);
  return result.kind === "excluded" ? result.reason : "eligible";
};

describe("decidePushEligibility", () => {
  it("a dormant, reachable consumer with no push since the visit is eligible", () => {
    expect(decide()).toEqual({ kind: "eligible" });
  });

  it("each exclusion in its order: opt_out → not_reachable → not_dormant → already_reached", () => {
    // Every rule fails at once: the FIRST one names it.
    const everything = {
      marketingOptOutAt: NOW,
      pushReachable: false,
      lastOrderAt: new Date(NOW.getTime() - DAY),
      lastGroupDecisionAt: NOW,
    };
    expect(reason(everything)).toBe("opt_out");
    // An opted-out consumer with no transport is still `opt_out`.
    expect(reason({ marketingOptOutAt: NOW, pushReachable: false })).toBe(
      "opt_out",
    );
    expect(reason({ ...everything, marketingOptOutAt: null })).toBe(
      "not_reachable",
    );
    expect(
      reason({ ...everything, marketingOptOutAt: null, pushReachable: true }),
    ).toBe("not_dormant");
    expect(reason({ lastGroupDecisionAt: NOW })).toBe("already_reached");
  });

  it("already_reached: a decision AT the last visit counts (>=); one ms before it does not", () => {
    const visit = new Date(NOW.getTime() - 40 * DAY);
    expect(reason({ lastOrderAt: visit, lastGroupDecisionAt: visit })).toBe(
      "already_reached",
    );
    expect(
      reason({
        lastOrderAt: visit,
        lastGroupDecisionAt: new Date(visit.getTime() - 1),
      }),
    ).toBe("eligible");
    // Never bought: the absence starts at the enrolment.
    expect(reason({ lastGroupDecisionAt: ENROLLED })).toBe("already_reached");
  });
});

/**
 * Spec 0105 / ADR 0097: #4 on the push channel — the SAME order as proximity: the dormant
 * floor first (never skipped), then the rhythm, then the group rule.
 */
describe("decidePushEligibility — at risk (#4)", () => {
  const AT_RISK = { minVisits: 3, rhythmFactor: 2 };
  const habit = (days: number[], away: number): Partial<PushCandidate> => {
    const last = NOW.getTime() - away * DAY;
    const at = (day: number) =>
      new Date(last - (days[days.length - 1] - day) * DAY);
    return {
      enrolledAt: new Date(at(days[0]).getTime() - DAY),
      visitDays: days.length,
      firstOrderAt: at(days[0]),
      lastOrderAt: at(days[days.length - 1]),
    };
  };
  const decide14 = (
    over: Partial<PushCandidate>,
    atRisk: AtRiskRule | null = AT_RISK,
  ) => {
    const result = decidePushEligibility(candidate(over), {
      now: NOW,
      dormantDays: 14,
      atRisk,
    });
    return result.kind === "excluded" ? result.reason : "eligible";
  };
  const DAILY = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  it("a daily customer away 12 days is not_dormant under a 14-day floor", () => {
    expect(decide14(habit(DAILY, 12))).toBe("not_dormant");
  });

  it("past the floor: broke the rhythm → eligible; steady → not_dormant", () => {
    expect(decide14(habit(DAILY, 20))).toBe("eligible");
    expect(decide14(habit([0, 30, 60], 20))).toBe("not_dormant");
  });

  it("the group rule still applies to the customer at risk", () => {
    const over = habit(DAILY, 20);
    expect(decide14({ ...over, lastGroupDecisionAt: over.lastOrderAt })).toBe(
      "already_reached",
    );
  });

  it("without atRisk the old rule is intact", () => {
    expect(decide14(habit([0, 30, 60], 20), null)).toBe("eligible");
    expect(decide14(habit(DAILY, 12), null)).toBe("not_dormant");
  });
});
