import { describe, expect, it } from "vitest";
import {
  type AudienceCandidate,
  type AudienceContext,
  decideTurnEligibility,
  summarizeAudience,
} from "./audience";

const NOW = new Date("2026-09-16T12:00:00.000Z");
const DAY = 86_400_000;
const DOOR = "loc-a";
const OTHER_DOOR = "loc-b";

function candidate(
  overrides: Partial<AudienceCandidate> = {},
): AudienceCandidate {
  return {
    membershipId: "mem-1",
    consumerId: "con-1",
    marketingOptOutAt: null,
    // Enrolled long ago and last seen 90 days ago: dormant by any reading.
    enrolledAt: new Date(NOW.getTime() - 400 * DAY),
    lastOrderAt: new Date(NOW.getTime() - 90 * DAY),
    lastOrderLocationId: DOOR,
    originLocationId: null,
    hasPass: true,
    lastWindowEnd: null,
    hasLiveTurn: false,
    ...overrides,
  };
}

function context(overrides: Partial<AudienceContext> = {}): AudienceContext {
  return {
    now: NOW,
    dormantDays: 30,
    cooldownDays: 30,
    eligibleLocationIds: [DOOR, OTHER_DOOR],
    ...overrides,
  };
}

describe("decideTurnEligibility", () => {
  it("queues a dormant, reachable consumer at the door of their last order", () => {
    expect(decideTurnEligibility(candidate(), context())).toEqual({
      kind: "eligible",
      locationId: DOOR,
    });
  });

  it("excludes the consumer who turned promotions off", () => {
    const row = candidate({ marketingOptOutAt: new Date(NOW.getTime() - DAY) });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "excluded",
      reason: "opt_out",
    });
  });

  it("excludes the consumer without a wallet pass: the channel does not exist", () => {
    expect(
      decideTurnEligibility(candidate({ hasPass: false }), context()),
    ).toEqual({ kind: "excluded", reason: "not_reachable" });
  });

  it("excludes the consumer who bought inside the dormancy window", () => {
    const row = candidate({ lastOrderAt: new Date(NOW.getTime() - 5 * DAY) });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "excluded",
      reason: "not_dormant",
    });
  });

  it("uses GREATEST(last order, enrolled): a fresh enrolment is not dormant either", () => {
    const row = candidate({
      enrolledAt: new Date(NOW.getTime() - 2 * DAY),
      lastOrderAt: null,
    });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "excluded",
      reason: "not_dormant",
    });
  });

  it("covers «se enrolo y nunca volvio»: no order at all, enrolled long ago", () => {
    const row = candidate({ lastOrderAt: null, lastOrderLocationId: null });
    expect(
      decideTurnEligibility(row, context({ eligibleLocationIds: [DOOR] })),
    ).toEqual({ kind: "eligible", locationId: DOOR });
  });

  it("falls back to the enrolment door when the last order's door is not usable", () => {
    const row = candidate({
      lastOrderLocationId: "loc-archived",
      originLocationId: OTHER_DOOR,
    });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "eligible",
      locationId: OTHER_DOOR,
    });
  });

  it("falls back to the campaign's only usable door", () => {
    const row = candidate({
      lastOrderLocationId: "loc-archived",
      originLocationId: null,
    });
    expect(
      decideTurnEligibility(
        row,
        context({ eligibleLocationIds: [OTHER_DOOR] }),
      ),
    ).toEqual({ kind: "eligible", locationId: OTHER_DOOR });
  });

  it("excludes when no door is attributable and there are several to choose from", () => {
    const row = candidate({
      lastOrderLocationId: "loc-archived",
      originLocationId: null,
    });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "excluded",
      reason: "no_location",
    });
  });

  it("excludes when every door of the campaign is archived or ungeocoded", () => {
    // Both conditions reach the pure function the same way: such a door never enters
    // `eligibleLocationIds` (spec 0065 — the filter belongs to the enqueue step too).
    expect(
      decideTurnEligibility(candidate(), context({ eligibleLocationIds: [] })),
    ).toEqual({ kind: "excluded", reason: "no_location" });
  });

  it("excludes the consumer whose business already had its window", () => {
    const row = candidate({
      lastWindowEnd: new Date(NOW.getTime() - 10 * DAY),
    });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "excluded",
      reason: "cooldown",
    });
  });

  it("lets the cooldown expire: a window older than 30 days no longer blocks", () => {
    const row = candidate({
      lastWindowEnd: new Date(NOW.getTime() - 31 * DAY),
    });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "eligible",
      locationId: DOOR,
    });
  });

  it("excludes the consumer who already has a live turn of this business", () => {
    expect(
      decideTurnEligibility(candidate({ hasLiveTurn: true }), context()),
    ).toEqual({ kind: "excluded", reason: "live_turn" });
  });

  it("counts a consumer under ONE reason: opt-out wins over cooldown", () => {
    const row = candidate({
      marketingOptOutAt: new Date(NOW.getTime() - DAY),
      lastWindowEnd: new Date(NOW.getTime() - DAY),
      hasLiveTurn: true,
    });
    expect(decideTurnEligibility(row, context())).toEqual({
      kind: "excluded",
      reason: "opt_out",
    });
  });
});

describe("summarizeAudience", () => {
  it("counts reachable off the pass, not off where the decision stopped", () => {
    const rows = [
      candidate({ consumerId: "c1" }),
      candidate({ consumerId: "c2", marketingOptOutAt: NOW }),
      candidate({ consumerId: "c3", hasPass: false }),
      candidate({
        consumerId: "c4",
        lastWindowEnd: new Date(NOW.getTime() - DAY),
      }),
      candidate({
        consumerId: "c5",
        lastOrderLocationId: "loc-archived",
        originLocationId: null,
      }),
      // Opted out AND without a pass: the ONLY shape that tells the two readings of
      // `reachable` apart. Counting «everyone the decision did not stop at
      // `not_reachable`» would call this one reachable, because it stopped earlier.
      candidate({ consumerId: "c6", marketingOptOutAt: NOW, hasPass: false }),
    ].map((row) => ({
      candidate: row,
      eligibility: decideTurnEligibility(row, context()),
    }));
    expect(summarizeAudience(rows)).toEqual({
      total: 6,
      // c2 owns a pass and is still counted reachable although it was excluded first;
      // c3 and c6 do not own one and are not, whichever reason stopped them.
      reachable: 4,
      noLocation: 1,
      optOut: 2,
      cooldown: 1,
    });
  });
});
