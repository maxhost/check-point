import { describe, expect, it } from "vitest";
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
  pushReachable: true,
  lastGroupDecisionAt: null,
  ...over,
});
const decide = (over: Partial<PushCandidate> = {}) =>
  decidePushEligibility(candidate(over), { now: NOW, dormantDays: 30 });
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
