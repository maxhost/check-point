import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  DEFAULT_REMINDER_TIMEZONE,
  type OpenCoupon,
  REMINDER_BODIES,
  REMINDER_SPACING_MS,
  REMINDER_TITLE,
  type ReminderInput,
  decideReminder,
} from "./reminder";

/**
 * The reminder's I/O (spec 0111 D5 + D7): who opened their account, and the planner that
 * queues the day-without-purchase `reminder` rows. The decision itself is pure
 * (`reminder.ts`); this file only loads its input and writes its result.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Scans that shape the consumer's usual time: the last 90 days, at most 30. */
const HABIT_WINDOW_MS = 90 * DAY_MS;
const HABIT_MAX_SCANS = 30;

type Row = Record<string, unknown>;

/** neon-http returns `{ rows }`; normalize to an array of records. */
function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return (Array.isArray(rows) ? rows : []) as Row[];
}

/** `execute` hands `timestamptz` back RAW (a string), and a `json_agg` field is a string
 * too: every date read here goes through this (gotchas: driver values). */
function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value : new Date(String(value));
}

/**
 * Stamps `last_opened_at = now()` when the consumer opens their account (spec 0111 D5):
 * `GET /c/[webViewToken]` and `/wallet` with a valid session. The guard keeps a refresh
 * from writing on every load (15 min). A failure never breaks the page: it is logged.
 */
export async function markAccountOpened(consumerId: string): Promise<void> {
  try {
    await getDb().execute(sql`
      UPDATE consumer.consumer_account
      SET last_opened_at = now()
      WHERE id = ${consumerId}
        AND (last_opened_at IS NULL
             OR last_opened_at < now() - interval '15 minutes')`);
  } catch (error) {
    console.error("[reminder] last_opened_at write failed", error);
  }
}

/**
 * The input of {@link decideReminder} for every CANDIDATE — a consumer with at least one
 * wallet pass or one Web Push subscription (someone the notice can reach) — in ONE query.
 * Every correlated subquery uses explicit aliases (gotchas: drizzle leaves a single-table
 * column unqualified). Scans go through `program_membership` (indexed by consumer) into
 * `core.order` (indexed by membership). `consumerIds` scopes the run (tests); prod passes
 * none.
 */
async function loadCandidates(
  now: Date,
  consumerIds?: string[],
): Promise<{ consumerId: string; input: ReminderInput }[]> {
  const nowIso = now.toISOString();
  const habitSince = new Date(now.getTime() - HABIT_WINDOW_MS).toISOString();
  const scope =
    consumerIds && consumerIds.length > 0
      ? sql`AND a.id IN (${sql.join(
          consumerIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql``;
  const res = await getDb().execute(sql`
    SELECT a.id, a.created_at, a.last_opened_at,
      (SELECT max(q.created_at) FROM consumer.wallet_push_queue q
        WHERE q.consumer_id = a.id AND q.class = 'reminder') AS last_reminder_at,
      ls.created_at AS last_scan_at,
      ls.timezone AS scan_timezone,
      coalesce((
        SELECT json_agg(h.minute) FROM (
          SELECT (extract(hour FROM o.created_at AT TIME ZONE b.timezone) * 60
                  + extract(minute FROM o.created_at AT TIME ZONE b.timezone))::int AS minute
          FROM consumer.program_membership pm
          JOIN core."order" o ON o.membership_id = pm.id
          JOIN core.business b ON b.id = o.business_id
          WHERE pm.consumer_id = a.id AND o.created_at > ${habitSince}
          ORDER BY o.created_at DESC
          LIMIT ${HABIT_MAX_SCANS}
        ) h), '[]'::json) AS scan_minutes,
      coalesce((
        SELECT json_agg(json_build_object(
          'created_at', c.created_at, 'valid_until', c.valid_until))
        FROM core.campaign_coupon c
        WHERE c.consumer_id = a.id AND c.valid_until > ${nowIso}
          AND NOT EXISTS (
            SELECT 1 FROM core.coupon_redemption r WHERE r.coupon_id = c.id)
      ), '[]'::json) AS coupons
    FROM consumer.consumer_account a
    LEFT JOIN LATERAL (
      SELECT o.created_at, b.timezone
      FROM consumer.program_membership pm
      JOIN core."order" o ON o.membership_id = pm.id
      JOIN core.business b ON b.id = o.business_id
      WHERE pm.consumer_id = a.id
      ORDER BY o.created_at DESC
      LIMIT 1
    ) ls ON true
    WHERE (EXISTS (SELECT 1 FROM consumer.wallet_pass p WHERE p.consumer_id = a.id)
        OR EXISTS (SELECT 1 FROM consumer.web_push_subscription s
                   WHERE s.consumer_id = a.id))
      ${scope}`);
  return rowsOf(res).map((row) => ({
    consumerId: String(row.id),
    input: toInput(row),
  }));
}

/** A `json` column may come back parsed or as text depending on the driver path. */
function jsonArray(value: unknown): unknown[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed : [];
}

function toInput(row: Row): ReminderInput {
  const coupons: OpenCoupon[] = jsonArray(row.coupons).map((c) => {
    const coupon = c as Row;
    return {
      createdAt: toDate(coupon.created_at) as Date,
      validUntil: toDate(coupon.valid_until) as Date,
    };
  });
  return {
    timeZone:
      row.scan_timezone === null || row.scan_timezone === undefined
        ? DEFAULT_REMINDER_TIMEZONE
        : String(row.scan_timezone),
    scanLocalMinutes: jsonArray(row.scan_minutes).map(Number),
    lastReminderAt: toDate(row.last_reminder_at),
    lastScanAt: toDate(row.last_scan_at),
    lastOpenedAt: toDate(row.last_opened_at),
    accountCreatedAt: toDate(row.created_at) as Date,
    openCoupons: coupons,
  };
}

/**
 * Plans the day-without-purchase reminders (spec 0111 D7). Runs at the start of every
 * worker pass (`runPushWorker`, every 5 min); each `send` of {@link decideReminder} becomes
 * ONE `reminder` row, `pending` at `now`, that the same pass drains — the 24 h budget
 * (`push-budget.ts`) applies at delivery. The insert re-checks «no reminder in the last
 * 20 h» in the SAME statement (`insert … select … where not exists`), so two runs in a row
 * never queue a second one. `created_at` is `now` (the clock the rule reads).
 */
export async function planReminders(
  now: Date,
  consumerIds?: string[],
): Promise<{ planned: number }> {
  const candidates = await loadCandidates(now, consumerIds);
  const nowIso = now.toISOString();
  const spacedSince = new Date(
    now.getTime() - REMINDER_SPACING_MS,
  ).toISOString();
  let planned = 0;
  for (const { consumerId, input } of candidates) {
    const decision = decideReminder(input, now);
    if (decision.kind !== "send") continue;
    const res = await getDb().execute(sql`
      INSERT INTO consumer.wallet_push_queue
        (consumer_id, class, title, body, status, not_before, created_at)
      SELECT ${consumerId}::uuid, 'reminder', ${REMINDER_TITLE},
             ${REMINDER_BODIES[decision.reason]}, 'pending', ${nowIso}, ${nowIso}
      WHERE NOT EXISTS (
        SELECT 1 FROM consumer.wallet_push_queue q
        WHERE q.consumer_id = ${consumerId}::uuid AND q.class = 'reminder'
          AND q.created_at > ${spacedSince})
      RETURNING id`);
    planned += rowsOf(res).length;
  }
  return { planned };
}
