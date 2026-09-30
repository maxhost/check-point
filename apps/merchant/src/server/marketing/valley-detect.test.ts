import { describe, expect, it } from "vitest";
import {
  type DayHours,
  type ScanCell,
  VALLEY_WEEKS,
  detectValleys,
  openBlocks,
} from "./valley-detect";

/**
 * Spec 0113 «Deteccion» — the owner's rule (ADR 0103 §5) over SYNTHETIC grids. Each case
 * builds the 8 weeks with a function `(week, weekday, hour) → scans`, so the numbers that
 * decide —the median, the 40 %, the 5 of 8 weeks, the 150— are written here, not derived.
 *
 * ORACULO DE M1 (the 40 % threshold), M2 (the ≥ 5 of 8 weeks) and M3 (the 150 minimum).
 */

const h = (hh: number, mm = 0) => hh * 60 + mm;

function grid(
  count: (week: number, weekday: number, hour: number) => number,
): ScanCell[] {
  const cells: ScanCell[] = [];
  for (let week = 0; week < VALLEY_WEEKS; week += 1)
    for (let weekday = 1; weekday <= 7; weekday += 1)
      for (let hour = 0; hour < 24; hour += 1) {
        const n = count(week, weekday, hour);
        if (n > 0) cells.push({ week, weekday, hour, count: n });
      }
  return cells;
}

/** Every day open 10:00–14:00: 28 open blocks a week. */
const TEN_TO_TWO: DayHours[] = Array.from({ length: 7 }, (_, i) => ({
  weekday: i + 1,
  ranges: [{ opens: h(10), closes: h(14) }],
}));

const openTenToTwo = (hour: number) => hour >= 10 && hour < 14;

describe("detectValleys — the owner's rule", () => {
  it("ORACULO DE M1 — a block at 35 % of the median is valley; at 45 % it is not", () => {
    // 27 blocks at 20 and Tuesday 12:00 at 7 (35 %) or 9 (45 %): the median is 20 → 8.
    const at = (slack: number) =>
      detectValleys(
        grid((_, weekday, hour) =>
          !openTenToTwo(hour) ? 0 : weekday === 2 && hour === 12 ? slack : 20,
        ),
        TEN_TO_TWO,
      );
    expect(at(7)).toMatchObject({
      status: "proposed",
      windows: [{ weekday: 2, startHour: 12, endHour: 13 }],
    });
    expect(at(9)).toMatchObject({ status: "none", windows: [] });
  });

  it("ORACULO DE M2 — slack (20 %) in 5 of 8 weeks is valley; in 4 of 8 it is not", () => {
    const weeks = (slackWeeks: number) =>
      detectValleys(
        grid((week, weekday, hour) =>
          !openTenToTwo(hour)
            ? 0
            : weekday === 3 && hour === 11 && week < slackWeeks
              ? 4
              : 20,
        ),
        TEN_TO_TWO,
      );
    expect(weeks(5).windows).toEqual([
      { weekday: 3, startHour: 11, endHour: 12 },
    ]);
    expect(weeks(4)).toMatchObject({ status: "none", windows: [] });
  });

  it("ORACULO DE M3 — 149 scans with an obvious gap are insufficient_data; 150 propose it", () => {
    // Monday 10–15 open: 4,4,4,4,0 a week (16 × 8 = 128) + scans at a CLOSED hour to reach
    // the total. The median stays 4 > 0, so only the minimum cuts at 149.
    const MONDAY: DayHours[] = [
      { weekday: 1, ranges: [{ opens: h(10), closes: h(15) }] },
    ];
    const total = (extra: number) =>
      detectValleys(
        grid((week, weekday, hour) => {
          if (weekday !== 1) return 0;
          if (hour >= 10 && hour < 14) return 4;
          if (hour === 20)
            return Math.floor(extra / 8) + (week < extra % 8 ? 1 : 0);
          return 0;
        }),
        MONDAY,
      );
    expect(total(21)).toEqual({
      status: "insufficient_data",
      scans: 149,
      windows: [],
    });
    expect(total(22)).toEqual({
      status: "proposed",
      scans: 150,
      windows: [{ weekday: 1, startHour: 14, endHour: 15 }],
    });
  });

  it("a week whose median is 0 marks nothing slack in it", () => {
    // Weeks 0–3 are empty: every open block is at 0 — «less than 40 % of the median» only
    // if the median counted, and a median of 0 does not. Weeks 4–7 are flat at 20. So no
    // block is slack in any week → no valley.
    const out = detectValleys(
      grid((week, _weekday, hour) =>
        !openTenToTwo(hour) || week < 4 ? 0 : 20,
      ),
      TEN_TO_TWO,
    );
    expect(out.status).toBe("none");
  });

  it("contiguous valley hours of the same day become ONE window", () => {
    const out = detectValleys(
      grid((_, weekday, hour) =>
        !openTenToTwo(hour)
          ? 0
          : weekday === 4 && (hour === 11 || hour === 12)
            ? 2
            : 20,
      ),
      TEN_TO_TWO,
    );
    expect(out.windows).toEqual([{ weekday: 4, startHour: 11, endHour: 13 }]);
  });

  it("V1 — a range that closes after midnight opens the next day's early hours", () => {
    // Saturday 20:00–02:00 opens Saturday 20–23 AND Sunday 00–01; Sunday 01:00 is slack.
    const SATURDAY_NIGHT: DayHours[] = [
      { weekday: 6, ranges: [{ opens: h(20), closes: h(2) }] },
    ];
    const open = openBlocks(SATURDAY_NIGHT, []);
    expect(
      open[5].map((on, hour) => (on ? hour : -1)).filter((x) => x >= 0),
    ).toEqual([20, 21, 22, 23]);
    expect(
      open[6].map((on, hour) => (on ? hour : -1)).filter((x) => x >= 0),
    ).toEqual([0, 1]);
    const out = detectValleys(
      grid((_, weekday, hour) =>
        weekday === 6 && hour >= 20
          ? 20
          : weekday === 7 && hour === 0
            ? 20
            : weekday === 7 && hour === 1
              ? 3
              : 0,
      ),
      SATURDAY_NIGHT,
    );
    expect(out.windows).toEqual([{ weekday: 7, startHour: 1, endHour: 2 }]);
  });

  it("a range from 08:30 opens only the WHOLE hours inside it (09 onwards)", () => {
    const open = openBlocks(
      [{ weekday: 1, ranges: [{ opens: h(8, 30), closes: h(11) }] }],
      [],
    );
    expect(
      open[0].map((on, hour) => (on ? hour : -1)).filter((x) => x >= 0),
    ).toEqual([9, 10]);
  });

  it("V3 — without opening hours, «open» is an hour with scans in ≥ 3 of the 8 weeks", () => {
    // Wednesday 9–12 always busy; Wednesday 13 busy in only 2 weeks → not open, so its
    // emptiness is not a valley; Wednesday 12 at 2 scans every week IS a valley.
    const cells = grid((week, weekday, hour) => {
      if (weekday !== 3) return 0;
      if (hour >= 9 && hour < 12) return 20;
      if (hour === 12) return 2;
      if (hour === 13 && week < 2) return 20;
      return 0;
    });
    const open = openBlocks(null, []);
    expect(open.flat().some(Boolean)).toBe(false);
    const out = detectValleys(cells, null);
    expect(out.windows).toEqual([{ weekday: 3, startHour: 12, endHour: 13 }]);
    // The same with an empty hours list (a location with no rows).
    expect(detectValleys(cells, []).windows).toEqual(out.windows);
  });
});
