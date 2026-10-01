import type { ValleyWindow } from "./valley-rules";

/**
 * THE DETECTION OF A LOCATION'S VALLEY HOURS (spec 0113 / ADR 0105 / ADR 0103 §5 —
 * `docs/red-horas-valle-y-modelo.md` §2.3). PURE: the store (`valley-store.ts`) brings the
 * scans already on the business's wall clock and the opening hours; everything that
 * DECIDES is here, with a table of cases as its oracle (`valley-detect.test.ts`).
 *
 *  1. A grid of 8 weeks × 7 days × 24 hours of scans (orders at this location).
 *  2. OPEN blocks: the hours that fall ENTIRELY inside a range of the opening hours — a
 *     range that closes after midnight (V1) opens the next day's early hours; with no hours
 *     loaded (V3), the hours with at least one scan in ≥ 3 of the 8 weeks.
 *  3. Fewer than 150 scans in the 8 weeks → `insufficient_data` (the merchant is asked).
 *  4. Per week, the MEDIAN of the open blocks' counts; a block is SLACK that week when the
 *     median is > 0 and its count is < 40 % of it. VALLEY = slack in ≥ 5 of the 8 weeks.
 *  5. Contiguous valley hours of the same day become one window (V2: whole hours of one
 *     day, never across midnight). None → `none`.
 *
 * The rule is the owner's; this proves it is applied, not that it is statistically good
 * (declared in the spec).
 */

export const VALLEY_WEEKS = 8;
export const VALLEY_MIN_SCANS = 150;
export const VALLEY_SLACK_RATIO = 0.4;
export const VALLEY_MIN_WEEKS = 5;
/** V3: without opening hours, an hour is «open» with scans in at least this many weeks. */
export const OPEN_WITHOUT_HOURS_WEEKS = 3;

/** Scans of one hour of one day of one week (`week` 0..7, `weekday` ISO, `hour` 0..23). */
export type ScanCell = {
  week: number;
  weekday: number;
  hour: number;
  count: number;
};

/** One range of a day's opening hours, in minutes since midnight. `closes <= opens`
 * closes the next day (V1). */
export type HoursRange = { opens: number; closes: number };
export type DayHours = { weekday: number; ranges: readonly HoursRange[] };

export type DetectionStatus = "proposed" | "none" | "insufficient_data";

export type Detection = {
  status: DetectionStatus;
  scans: number;
  windows: ValleyWindow[];
};

type Grid = number[][][];

function gridOf(cells: readonly ScanCell[]): { grid: Grid; scans: number } {
  const grid: Grid = Array.from({ length: VALLEY_WEEKS }, () =>
    Array.from({ length: 7 }, () => new Array<number>(24).fill(0)),
  );
  let scans = 0;
  for (const cell of cells) {
    if (cell.week < 0 || cell.week >= VALLEY_WEEKS) continue;
    grid[cell.week][cell.weekday - 1][cell.hour] += cell.count;
    scans += cell.count;
  }
  return { grid, scans };
}

/** Step 2: `open[day][hour]`, `day` 0 = Monday. */
export function openBlocks(
  hours: readonly DayHours[] | null,
  grid: Grid,
): boolean[][] {
  const open = Array.from({ length: 7 }, () =>
    new Array<boolean>(24).fill(false),
  );
  if (hours && hours.some((day) => day.ranges.length > 0)) {
    for (const day of hours)
      for (const range of day.ranges) {
        const end =
          range.closes <= range.opens ? range.closes + 1440 : range.closes;
        for (
          let hour = Math.ceil(range.opens / 60);
          (hour + 1) * 60 <= end;
          hour += 1
        )
          open[(day.weekday - 1 + Math.floor(hour / 24)) % 7][hour % 24] = true;
      }
    return open;
  }
  for (let day = 0; day < 7; day += 1)
    for (let hour = 0; hour < 24; hour += 1) {
      const weeks = grid.filter((week) => week[day][hour] > 0).length;
      open[day][hour] = weeks >= OPEN_WITHOUT_HOURS_WEEKS;
    }
  return open;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Step 5: contiguous valley hours of each day, as windows. */
function windowsOf(valley: boolean[][]): ValleyWindow[] {
  const windows: ValleyWindow[] = [];
  for (let day = 0; day < 7; day += 1) {
    let start: number | null = null;
    for (let hour = 0; hour <= 24; hour += 1) {
      const on = hour < 24 && valley[day][hour];
      if (on && start === null) start = hour;
      if (!on && start !== null) {
        windows.push({ weekday: day + 1, startHour: start, endHour: hour });
        start = null;
      }
    }
  }
  return windows;
}

/** Spec 0113 «Deteccion», steps 1 to 5. */
export function detectValleys(
  cells: readonly ScanCell[],
  hours: readonly DayHours[] | null,
): Detection {
  const { grid, scans } = gridOf(cells);
  if (scans < VALLEY_MIN_SCANS)
    return { status: "insufficient_data", scans, windows: [] };
  const open = openBlocks(hours, grid);
  const slackWeeks = Array.from({ length: 7 }, () =>
    new Array<number>(24).fill(0),
  );
  for (const week of grid) {
    const counts: number[] = [];
    for (let day = 0; day < 7; day += 1)
      for (let hour = 0; hour < 24; hour += 1)
        if (open[day][hour]) counts.push(week[day][hour]);
    const middle = median(counts);
    if (middle <= 0) continue;
    for (let day = 0; day < 7; day += 1)
      for (let hour = 0; hour < 24; hour += 1)
        if (open[day][hour] && week[day][hour] < VALLEY_SLACK_RATIO * middle)
          slackWeeks[day][hour] += 1;
  }
  const valley = slackWeeks.map((day) =>
    day.map((weeks) => weeks >= VALLEY_MIN_WEEKS),
  );
  const windows = windowsOf(valley);
  return { status: windows.length > 0 ? "proposed" : "none", scans, windows };
}
