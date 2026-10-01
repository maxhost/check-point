import { describe, expect, it } from "vitest";
import {
  BUDGET_WINDOW_MS,
  COUNTER_NOTICES_PER_24H,
  NOTIFYING_PER_24H,
  type Budget,
  decideBudget,
} from "./wallet/push-budget";

/**
 * The 24 h notice budget (spec 0111 D2), the whole table, pure. The cableado —that
 * `deliverClaimed` actually asks it— is pinned by `wallet-push-budget.neon.integration`,
 * not here (a pure oracle never sees its caller deleted).
 */

const NOW = new Date("2026-09-29T18:00:00Z");
const HOUR = 60 * 60 * 1000;

function budget(
  counter: number,
  notifying: number,
  oldest: Date | null = notifying > 0
    ? new Date(NOW.getTime() - 5 * HOUR)
    : null,
): Budget {
  return {
    counterSent24h: counter,
    notifyingSent24h: notifying,
    oldestNotifyingSentAt: oldest,
  };
}

describe("decideBudget — constants of the owner's decision", () => {
  it("2 counter notices, 3 notifying, a 24 h moving window", () => {
    expect(COUNTER_NOTICES_PER_24H).toBe(2);
    expect(NOTIFYING_PER_24H).toBe(3);
    expect(BUDGET_WINDOW_MS).toBe(24 * HOUR);
  });
});

describe("decideBudget — transactional (the counter)", () => {
  it("1st and 2nd counter notices send", () => {
    expect(decideBudget("transactional", budget(0, 0), NOW)).toEqual({
      kind: "send",
    });
    expect(decideBudget("transactional", budget(1, 1), NOW)).toEqual({
      kind: "send",
    });
  });

  // ORACULO DE M1: the 3rd counter notice is credited in silence.
  it("the 3rd counter notice (2 already sent) is suppressed", () => {
    expect(decideBudget("transactional", budget(2, 2), NOW)).toEqual({
      kind: "suppress",
    });
  });

  it("any counter notice past the 3rd is suppressed too", () => {
    expect(decideBudget("transactional", budget(3, 3), NOW)).toEqual({
      kind: "suppress",
    });
  });

  it("with 1 counter notice but 3 notifying (campaigns/reminders) it is suppressed", () => {
    expect(decideBudget("transactional", budget(1, 3), NOW)).toEqual({
      kind: "suppress",
    });
  });

  it("with 0 counter notices and 2 notifying it still sends (global not full)", () => {
    expect(decideBudget("transactional", budget(0, 2), NOW)).toEqual({
      kind: "send",
    });
  });
});

describe("decideBudget — campaign", () => {
  it("sends below 3 notifying, whatever the counter count", () => {
    expect(decideBudget("campaign", budget(2, 2), NOW)).toEqual({
      kind: "send",
    });
  });

  it("with 3 notifying it is deferred to EXACTLY oldest + 24 h", () => {
    const oldest = new Date(NOW.getTime() - 23 * HOUR);
    expect(decideBudget("campaign", budget(1, 3, oldest), NOW)).toEqual({
      kind: "defer",
      notBefore: new Date(oldest.getTime() + 24 * HOUR),
    });
  });

  it("the window edge: an oldest send 1 ms inside the window frees its slot 1 ms from now", () => {
    const oldest = new Date(NOW.getTime() - 24 * HOUR + 1);
    const decision = decideBudget("campaign", budget(0, 3, oldest), NOW);
    expect(decision).toEqual({
      kind: "defer",
      notBefore: new Date(NOW.getTime() + 1),
    });
  });
});

describe("decideBudget — reminder", () => {
  it("sends below 3 notifying", () => {
    expect(decideBudget("reminder", budget(2, 2), NOW)).toEqual({
      kind: "send",
    });
  });

  it("with 3 notifying it is suppressed (never deferred)", () => {
    expect(decideBudget("reminder", budget(0, 3), NOW)).toEqual({
      kind: "suppress",
    });
  });
});

describe("decideBudget — pass_refresh never counts nor waits", () => {
  // ORACULO DE M2.
  it("sends with a full window and a full counter", () => {
    expect(decideBudget("pass_refresh", budget(3, 3), NOW)).toEqual({
      kind: "send",
    });
    expect(decideBudget("pass_refresh", budget(2, 2), NOW)).toEqual({
      kind: "send",
    });
  });
});
