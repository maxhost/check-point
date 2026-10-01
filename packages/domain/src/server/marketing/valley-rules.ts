import type { TemplateDefinition } from "./templates";

/**
 * THE PURE RULES OF «HORAS VALLE» (spec 0113 / ADR 0105) that decide in TIME: which
 * windows of a location rule, whether one is OPEN now, and when today's closes. The
 * detection is `valley-detect.ts`; the database half is `valley-store.ts`; the consumer's
 * list and claim, `consumer/valley-offers.ts`.
 *
 * TIME IS THE BUSINESS's: the weekday and hour are read on the wall clock of
 * `core.business.timezone` (`Intl`), and the end of a window is that wall time converted
 * back to an instant — so a zone with DST lands on the right side of the change.
 */

/** «Horas valle»'s parameters (spec 0113 V5): the monthly cap of claimed coupons. */
export type ValleyDefinition = {
  monthlyCap: { min: number; max: number; default: number };
};

/**
 * The catalog entry (`templates.ts` lists it after the cross offer), here only for the size
 * budget of `templates.ts`. Its audience is FIXED —not clients and dormant ones, never the
 * active member (ADR 0103 §5)—, so there is no audience option: only `dormantDays` (V6).
 */
export const VALLEY_TEMPLATE: TemplateDefinition = {
  key: "valley",
  title: "Horas valle",
  description:
    "Regala un premio a quien todavía no es cliente (o hace mucho no viene), solo en tus horas más flojas.",
  channels: [],
  group: "valley",
  rank: 1,
  dormantDays: { options: [30, 60, 90], default: 30 },
  message: {
    default: "Ahora hay lugar: te esperamos con un regalo",
    maxLength: 60,
    gapMarker: false,
  },
  couponRecommended: true,
  couponAllowed: true,
  couponRequired: true,
  nearReward: null,
  repeat: null,
  atRisk: null,
  welcome: null,
  cross: null,
  valley: { monthlyCap: { min: 1, max: 10000, default: 50 } },
};

/** One window: the hours `[startHour, endHour)` of ISO `weekday` (1 = Monday). */
export type ValleyWindow = {
  weekday: number;
  startHour: number;
  endHour: number;
};

export type WindowSource = "network" | "merchant";

/**
 * ADR 0105 §6: the business's own windows rule while they exist; otherwise the network's.
 * `effective` says which set that is.
 */
export function effectiveWindows(
  rows: readonly (ValleyWindow & { source: WindowSource })[],
): { effective: WindowSource; windows: ValleyWindow[] } {
  const pick = (source: WindowSource) =>
    rows
      .filter((row) => row.source === source)
      .map(({ weekday, startHour, endHour }) => ({
        weekday,
        startHour,
        endHour,
      }));
  const merchant = pick("merchant");
  return merchant.length > 0
    ? { effective: "merchant", windows: merchant }
    : { effective: "network", windows: pick("network") };
}

export type LocalClock = {
  year: number;
  month: number;
  day: number;
  /** ISO: 1 = Monday … 7 = Sunday. */
  weekday: number;
  hour: number;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function wallParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const text = (type: string) => parts.find((p) => p.type === type)?.value;
  const part = (type: string) => Number(text(type));
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    weekday: WEEKDAYS.indexOf(String(text("weekday"))) + 1,
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/** The business's wall clock at `at`: the day and hour a window is compared with. */
export function localClock(at: Date, timeZone: string): LocalClock {
  const { year, month, day, weekday, hour } = wallParts(at, timeZone);
  return { year, month, day, weekday, hour };
}

/** How far ahead of UTC the zone's wall clock is at `at` (negative west of Greenwich). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = wallParts(at, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant of the wall time `year-month-day hour:00` in `timeZone`. `Date.UTC`
 * normalises hour 24 to the next day's 00:00. Two passes so a DST change between the guess
 * and the answer lands on the right side (the same method as `localMidnight`).
 */
export function localInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour);
  let at = wall - zoneOffsetMs(new Date(wall), timeZone);
  at = wall - zoneOffsetMs(new Date(at), timeZone);
  return new Date(at);
}

/** The window that is OPEN at `clock` — `startHour <= hour < endHour` today — or `null`. */
export function openWindow(
  windows: readonly ValleyWindow[],
  clock: LocalClock,
): ValleyWindow | null {
  return (
    windows.find(
      (window) =>
        window.weekday === clock.weekday &&
        window.startHour <= clock.hour &&
        clock.hour < window.endHour,
    ) ?? null
  );
}

/** ADR 0105 §3: the claimed coupon lives until the window closes TODAY (local → UTC). */
export function windowEndsAt(
  clock: LocalClock,
  window: ValleyWindow,
  timeZone: string,
): Date {
  return localInstant(
    clock.year,
    clock.month,
    clock.day,
    window.endHour,
    timeZone,
  );
}
