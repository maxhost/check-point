import type { WelcomeRedeemFrom } from "./templates";

/**
 * THE PURE RULES OF THE WELCOME GIFT (spec 0107 §3 / ADR 0099). The database half lives in
 * `welcome-issue.ts`; everything that DECIDES lives here, so each rule has a table of cases
 * as its oracle (`welcome-issue.test.ts`).
 *
 * TIME IS THE BUSINESS's. «Desde el dia siguiente» is the next LOCAL midnight in
 * `core.business.timezone`, and the monthly cap counts the LOCAL calendar month: a gift
 * given at 21:00 in Guayaquil is already «tomorrow» in UTC, and the day after in UTC would
 * make the consumer wait a day and a half.
 */

const DAY_MS = 86_400_000;

type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localParts(at: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

/** How far ahead of UTC the zone's wall clock is at `at` (negative west of Greenwich). */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const p = localParts(at, timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The instant of the local midnight that opens `year-month-day` in `timeZone`. `Date.UTC`
 * normalises an overflowing day or month (the 32nd of a month is the 1st of the next). Two
 * passes so a DST change between the guess and the answer lands on the right side.
 */
export function localMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day);
  let at = wall - zoneOffsetMs(new Date(wall), timeZone);
  at = wall - zoneOffsetMs(new Date(at), timeZone);
  return new Date(at);
}

/** The first instant of the LOCAL day after the one `now` falls in. */
export function startOfNextLocalDay(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  return localMidnight(p.year, p.month, p.day + 1, timeZone);
}

/** The first instant of the LOCAL calendar month `now` falls in. */
export function localMonthStart(now: Date, timeZone: string): Date {
  const p = localParts(now, timeZone);
  return localMidnight(p.year, p.month, 1, timeZone);
}

/** From when the gift is worth something: now (`same_visit`) or the next local day. */
export function welcomeValidFrom(
  now: Date,
  redeemFrom: WelcomeRedeemFrom,
  timeZone: string,
): Date {
  return redeemFrom === "same_visit" ? now : startOfNextLocalDay(now, timeZone);
}

/** It expires `validDays` after the DELIVERY (ADR 0099 §4), not after it starts. */
export function welcomeValidUntil(now: Date, validDays: number): Date {
  return new Date(now.getTime() + validDays * DAY_MS);
}

/** Why a membership gets no gift — or `issue`. The cap is decided apart, under the lock. */
export type WelcomeVerdict =
  | "issue"
  | "enrolled_before"
  | "came_by_cross"
  | "home_not_opened"
  | "notifications_not_active"
  | "device_already_gifted";

/**
 * Steps 1–3 of spec 0107 §3, in order. `enrolledAt` is the membership's enrolment; a
 * consumer already enrolled when the template was switched on gets nothing. The installed
 * PWA must have opened and Web Push must be active. An iPhone that already got THIS business's welcome — even after
 * deleting the pass — gets nothing again.
 *
 * Spec 0112 / ADR 0104 §5 («Solo el cruzado», owner): a consumer holding a CROSS coupon of
 * this business came in through the network and already has their gift — no welcome. It
 * goes right after `enrolled_before`.
 */
export function decideWelcomeGift(facts: {
  enrolledAt: Date;
  activatedAt: Date;
  homeLaunched: boolean;
  pushSubscribed: boolean;
  deviceAlreadyGifted: boolean;
  crossCouponFromBusiness: boolean;
}): WelcomeVerdict {
  if (facts.enrolledAt < facts.activatedAt) return "enrolled_before";
  if (facts.crossCouponFromBusiness) return "came_by_cross";
  if (!facts.homeLaunched) return "home_not_opened";
  if (!facts.pushSubscribed) return "notifications_not_active";
  if (facts.deviceAlreadyGifted) return "device_already_gifted";
  return "issue";
}

/** Step 4: the monthly cap of the business is STRICT — `cap` gifts, not `cap + 1`. */
export function capAllows(givenThisMonth: number, monthlyCap: number): boolean {
  return givenThisMonth < monthlyCap;
}
