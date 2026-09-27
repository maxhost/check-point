/**
 * THE SENDING HOURS OF A CAMPAIGN PUSH (spec 0103 §5 / ADR 0095 §6). PURE: the tick uses
 * `nextSendableAt` for the row's `not_before`, and the worker re-checks `isInPushWindow`
 * at delivery (`push-delivery.ts`), because a notice decided at 20:55 can reach the worker
 * at 21:05 — and then it goes out at the next opening, not at night.
 *
 * The window is `[start, end)` in the business's IANA `timeZone`, whole hours
 * (`core_business_push_window_check`: start 0–23, end 1–24, start < end).
 */

const HOUR_MS = 60 * 60 * 1000;
/** Two days of whole hours: any `start` exists at least once in them, DST included. */
const MAX_STEPS = 48;

/** The local hour 0–23 of `at` in `timeZone`. `h23` so midnight is 0, never 24. */
export function localHour(at: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  })
    .formatToParts(at)
    .find((p) => p.type === "hour");
  return Number(part?.value);
}

export function isInPushWindow(
  at: Date,
  timeZone: string,
  start: number,
  end: number,
): boolean {
  const hour = localHour(at, timeZone);
  return hour >= start && hour < end;
}

/**
 * `now` when it is inside the window; otherwise the first whole (UTC) hour AFTER `now`
 * whose local hour is `start`. Not finding one in 48 steps is a BUG (a window the `check`
 * forbids, or a broken zone), never a case: it throws instead of inventing a time.
 */
export function nextSendableAt(
  now: Date,
  timeZone: string,
  start: number,
  end: number,
): Date {
  if (isInPushWindow(now, timeZone, start, end)) return now;
  const firstWholeHour = (Math.floor(now.getTime() / HOUR_MS) + 1) * HOUR_MS;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const candidate = new Date(firstWholeHour + step * HOUR_MS);
    if (localHour(candidate, timeZone) === start) return candidate;
  }
  throw new Error(
    `nextSendableAt: no ${start}:00 in ${timeZone} within ${MAX_STEPS} h of ${now.toISOString()}`,
  );
}
