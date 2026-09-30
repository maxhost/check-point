import { ACCOUNT_INVITE } from "./push-text";

/**
 * THE DAY-WITHOUT-PURCHASE REMINDER (spec 0111 D6 / ADR 0103 §3 and §7), pure and DB-free.
 * On a day the consumer did not scan anywhere, ONE notice invites them to open their
 * account — if there is something new in it (a new coupon, a coupon about to expire) or if
 * they have been inactive for 2 days (neither opened checkpass.club nor scanned). It goes
 * out at their usual time: a little before the median time they scan, 12:30 by default.
 */

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/** 12:30, when there is not enough history to know the consumer's time. */
export const DEFAULT_REMINDER_MINUTE = 12 * 60 + 30;
/** Scans needed before the median is trusted. */
export const MIN_SCANS_FOR_HABIT = 3;
/** How far before the usual scan time the reminder goes. */
export const REMINDER_LEAD_MINUTES = 30;
/** The target is clamped to [9:00, 21:00] local. */
export const REMINDER_EARLIEST_MINUTE = 9 * 60;
export const REMINDER_LATEST_MINUTE = 21 * 60;
/** At most one reminder per consumer in this span (any status). */
export const REMINDER_SPACING_MS = 20 * HOUR_MS;
/** A scan in this span means «bought today»: no reminder. */
export const SCAN_QUIET_MS = 24 * HOUR_MS;
/** A coupon expiring within this span counts as «about to expire». */
export const COUPON_EXPIRING_MS = 48 * HOUR_MS;
/** Inactivity (no open, no scan) that earns a reminder by itself. */
export const INACTIVE_MS = 48 * HOUR_MS;
/** The zone when the consumer never scanned (no business to take it from). */
export const DEFAULT_REMINDER_TIMEZONE = "America/Guayaquil";

export const REMINDER_TITLE = "CheckPass";

export type ReminderReason = "coupon_new" | "coupon_expiring" | "inactive_48h";

/** Provisional texts accepted by the owner (2026-09-29), all ≤ 80 characters. */
export const REMINDER_BODIES: Record<ReminderReason, string> = {
  coupon_expiring: `Tienes un cupón que vence pronto · ${ACCOUNT_INVITE}`,
  coupon_new: `Tienes un cupón nuevo · ${ACCOUNT_INVITE}`,
  inactive_48h: `Hay beneficios esperándote · ${ACCOUNT_INVITE}`,
};

/**
 * The local minute of the day (0–1439) the reminder is due at, from the minute of day of
 * the consumer's recent scans (each in its business's zone). With fewer than
 * {@link MIN_SCANS_FOR_HABIT}: 12:30. Otherwise the median minus 30 minutes (an even count
 * averages the two middle ones, rounded), clamped to [9:00, 21:00].
 */
export function reminderTargetMinute(scanLocalMinutes: number[]): number {
  if (scanLocalMinutes.length < MIN_SCANS_FOR_HABIT)
    return DEFAULT_REMINDER_MINUTE;
  const sorted = [...scanLocalMinutes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return Math.min(
    REMINDER_LATEST_MINUTE,
    Math.max(REMINDER_EARLIEST_MINUTE, median - REMINDER_LEAD_MINUTES),
  );
}

/** The local minute of the day of `at` in `timeZone` (`h23`, so midnight is 0). */
export function localMinuteOfDay(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return read("hour") * 60 + read("minute");
}

/** One unredeemed coupon of the consumer (`core.campaign_coupon` without a redemption). */
export type OpenCoupon = { createdAt: Date; validUntil: Date };

export type ReminderInput = {
  /** Zone of the business of the last scan; {@link DEFAULT_REMINDER_TIMEZONE} if none. */
  timeZone: string;
  /** Minute of day of the recent scans (≤ 30, last 90 days), each in its own zone. */
  scanLocalMinutes: number[];
  /** `created_at` of the newest `reminder` row of the consumer, any status. */
  lastReminderAt: Date | null;
  lastScanAt: Date | null;
  lastOpenedAt: Date | null;
  accountCreatedAt: Date;
  openCoupons: OpenCoupon[];
};

export type ReminderDecision =
  | { kind: "send"; reason: ReminderReason }
  | { kind: "skip"; why: "not_yet" | "already" | "scanned" | "nothing" };

/**
 * The table of spec 0111 D6, in order: (1) the local time reached the target, (2) no
 * reminder in the last 20 h, (3) no scan in the last 24 h, (4) a new coupon, a coupon
 * about to expire, or 48 h of inactivity. The reason picks the text, by priority
 * `coupon_expiring` > `coupon_new` > `inactive_48h`.
 */
export function decideReminder(
  input: ReminderInput,
  now: Date,
): ReminderDecision {
  const t = now.getTime();
  const target = reminderTargetMinute(input.scanLocalMinutes);
  if (localMinuteOfDay(now, input.timeZone) < target)
    return { kind: "skip", why: "not_yet" };
  if (
    input.lastReminderAt &&
    input.lastReminderAt.getTime() > t - REMINDER_SPACING_MS
  )
    return { kind: "skip", why: "already" };
  if (input.lastScanAt && input.lastScanAt.getTime() > t - SCAN_QUIET_MS)
    return { kind: "skip", why: "scanned" };

  const live = input.openCoupons.filter((c) => c.validUntil.getTime() > t);
  if (live.some((c) => c.validUntil.getTime() <= t + COUPON_EXPIRING_MS))
    return { kind: "send", reason: "coupon_expiring" };
  const openedAt = input.lastOpenedAt?.getTime() ?? -Infinity;
  if (live.some((c) => c.createdAt.getTime() > openedAt))
    return { kind: "send", reason: "coupon_new" };
  const lastActivity = Math.max(
    input.lastOpenedAt?.getTime() ?? -Infinity,
    input.lastScanAt?.getTime() ?? -Infinity,
    input.accountCreatedAt.getTime(),
  );
  if (t - lastActivity >= INACTIVE_MS)
    return { kind: "send", reason: "inactive_48h" };
  return { kind: "skip", why: "nothing" };
}
