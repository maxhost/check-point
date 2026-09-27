import { describe, expect, it } from "vitest";
import { isAtRisk } from "./at-risk";

/**
 * Spec 0105 / ADR 0097 — the rhythm rule of #4, PURE. Visits are given as day offsets
 * from the first one; the habit the loader would build is `visitDays` = how many,
 * `firstOrderAt`/`lastOrderAt` = the first and the last.
 */
const DAY = 86_400_000;
const START = new Date("2026-06-01T14:00:00.000Z");
const RULE = { minVisits: 3, rhythmFactor: 2 };
const day = (n: number) => new Date(START.getTime() + n * DAY);

function habit(days: number[]) {
  return {
    visitDays: days.length,
    firstOrderAt: day(days[0]),
    lastOrderAt: day(days[days.length - 1]),
  };
}

describe("isAtRisk", () => {
  // ORACULO DE M1: 2 visits (rhythm 10, away 30 > 20) — only the minimum keeps it out.
  it("two visits are not a habit, however long the absence", () => {
    expect(isAtRisk(habit([0, 10]), day(40), RULE)).toBe(false);
  });

  // ORACULO DE M2: away exactly 2 × the rhythm is still inside it (strict `>`).
  it("away exactly 2× the rhythm is not at risk; one ms more is", () => {
    expect(isAtRisk(habit([0, 10, 20]), day(40), RULE)).toBe(false);
    expect(
      isAtRisk(habit([0, 10, 20]), new Date(day(40).getTime() + 1), RULE),
    ).toBe(true);
  });

  it("the rhythm is the MEAN gap: (last − first) / (visits − 1)", () => {
    // 4 visits over 30 days → rhythm 10, whatever the individual gaps were.
    expect(isAtRisk(habit([0, 1, 2, 30]), day(50), RULE)).toBe(false);
    expect(isAtRisk(habit([0, 1, 2, 30]), day(51), RULE)).toBe(true);
  });

  it("missing dates are never at risk", () => {
    const now = day(400);
    expect(
      isAtRisk(
        { visitDays: 5, firstOrderAt: null, lastOrderAt: day(0) },
        now,
        RULE,
      ),
    ).toBe(false);
    expect(
      isAtRisk(
        { visitDays: 5, firstOrderAt: day(0), lastOrderAt: null },
        now,
        RULE,
      ),
    ).toBe(false);
    expect(
      isAtRisk(
        { visitDays: 0, firstOrderAt: null, lastOrderAt: null },
        now,
        RULE,
      ),
    ).toBe(false);
  });
});
