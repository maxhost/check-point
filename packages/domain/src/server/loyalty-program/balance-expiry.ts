/**
 * THE BALANCE-EXPIRY RULE, pure and DB-free (spec 0195 §D2 / ADR 0136). The whole balance
 * of a membership expires after N months without a purchase or a redemption in that
 * business. Dates are LOCAL calendar dates of the business (`YYYY-MM-DD`); the balance is
 * lost when its expiry day ends, and only once the «hoy vencen» notice was issued.
 */

export const EXPIRY_MONTHS = [3, 6, 9, 12] as const;
export type ExpiryMonths = (typeof EXPIRY_MONTHS)[number];

/** The notice thresholds, in days before the expiry date (owner, 2026-10-10). */
export const NOTICE_DAYS = [20, 10, 5, 0] as const;
export type NoticeDays = (typeof NOTICE_DAYS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export function isExpiryMonths(value: unknown): value is ExpiryMonths {
  return (EXPIRY_MONTHS as readonly unknown[]).includes(value);
}

/** The local calendar date (`YYYY-MM-DD`) of an instant in an IANA zone. */
export function localDate(at: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function parse(day: string): [number, number, number] {
  const [y, m, d] = day.split("-").map(Number);
  return [y, m, d];
}

function format(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Calendar months, clamped to the end of the month (31 Jan + 1 = 28/29 Feb). */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = parse(day);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return format(year, month, Math.min(d, lastDay));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = parse(from);
  const [ty, tm, td] = parse(to);
  return Math.round(
    (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / DAY_MS,
  );
}

/**
 * The expiry date: the local date of `max(lastVisitAt ?? enrolledAt, since)` plus `months`.
 * `since` (turned on or shortened) wins over an older activity, so switching the rule on
 * never expires anything that day (ADR 0136 §3).
 */
export function expiresOn(input: {
  lastVisitAt: Date | null;
  enrolledAt: Date;
  since: Date;
  months: ExpiryMonths;
  timezone: string;
}): string {
  const activity = input.lastVisitAt ?? input.enrolledAt;
  const base =
    activity.getTime() > input.since.getTime() ? activity : input.since;
  return addMonths(localDate(base, input.timezone), input.months);
}

/**
 * The notice due today, or null: the SMALLEST threshold `t` with `daysLeft ≤ t` (an overdue
 * balance gets `0`), only if it was not issued yet for this expiry date. A late cron sends
 * only the most urgent notice, never a burst.
 */
export function noticeDue(input: {
  today: string;
  expiresOn: string;
  sent: readonly number[];
}): NoticeDays | null {
  const daysLeft = daysBetween(input.today, input.expiresOn);
  if (daysLeft > NOTICE_DAYS[0]) return null;
  const due = [...NOTICE_DAYS]
    .reverse()
    .find((threshold) => daysLeft <= threshold) as NoticeDays;
  return input.sent.includes(due) ? null : due;
}

/**
 * The balance expires once its expiry day ended AND the «hoy vencen» notice was issued on an
 * EARLIER local day (§4) — so a late notice always leaves the consumer that whole day, even
 * if the sweep runs twice. `zeroNoticeOn` = local date the `0` notice was issued, or null.
 */
export function shouldExpire(input: {
  today: string;
  expiresOn: string;
  zeroNoticeOn: string | null;
}): boolean {
  return (
    input.today > input.expiresOn &&
    input.zeroNoticeOn !== null &&
    input.zeroNoticeOn < input.today
  );
}

/**
 * The new `since` when the rule changes: turning it on or shortening it → `now`;
 * lengthening it keeps the old one (it is only more lenient); turning it off → null.
 */
export function nextSince(input: {
  prevMonths: ExpiryMonths | null;
  nextMonths: ExpiryMonths | null;
  since: Date | null;
  now: Date;
}): Date | null {
  if (input.nextMonths === null) return null;
  if (input.prevMonths === null || input.since === null) return input.now;
  return input.nextMonths < input.prevMonths ? input.now : input.since;
}
