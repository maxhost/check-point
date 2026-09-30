import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { parseQueueClass } from "./push-plan";
import { BUDGET_WINDOW_MS, type Budget, decideBudget } from "./push-budget";

/** neon-http returns `{ rows }`; normalize to an array of records. */
function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
}

/**
 * The consumer's 24 h budget in ONE query over `wallet_push_queue` (spec 0111 D3): the
 * `sent` rows with `sent_at > now − 24 h`, counted per class with `filter`, plus the oldest
 * notifying `sent_at`. `count(*)` is a bigint the driver returns as a STRING, hence `::int`;
 * `min(sent_at)` comes back raw from `execute` (a string), hence the `Date` conversion.
 */
export async function loadBudget(
  consumerId: string,
  now: Date,
): Promise<Budget> {
  const since = new Date(now.getTime() - BUDGET_WINDOW_MS).toISOString();
  const res = await getDb().execute(sql`
    SELECT
      count(*) FILTER (WHERE q.class = 'transactional')::int AS counter_sent,
      count(*) FILTER (
        WHERE q.class IN ('transactional', 'campaign', 'reminder'))::int AS notifying_sent,
      min(q.sent_at) FILTER (
        WHERE q.class IN ('transactional', 'campaign', 'reminder')) AS oldest_sent_at
    FROM consumer.wallet_push_queue q
    WHERE q.consumer_id = ${consumerId}
      AND q.status = 'sent'
      AND q.sent_at > ${since}`);
  const [row] = rowsOf(res);
  const oldest = row?.oldest_sent_at;
  return {
    counterSent24h: Number(row?.counter_sent ?? 0),
    notifyingSent24h: Number(row?.notifying_sent ?? 0),
    oldestNotifyingSentAt:
      oldest === null || oldest === undefined
        ? null
        : new Date(oldest as string | Date),
  };
}

/**
 * Applies the budget to one CLAIMED row, before anything is written for it (spec 0111 D3).
 * Returns `true` when the notice may go out; otherwise the row is already closed here and
 * the caller must write nothing more:
 *
 * - `suppress` → `status = 'suppressed'`, `last_error = 'budget_24h'`. NOTHING on the
 *   account: writing `latest_message` would make Apple ring on the next pass download
 *   (`changeMessage` fires on a changed value). The balance is already credited by the
 *   counter's own transaction and shows in the account.
 * - `defer` → back to `pending` at `notBefore` (a `campaign` waits for a free slot).
 *
 * `pass_refresh` never counts nor waits, so it skips the query altogether.
 */
export async function applyBudget(
  id: string,
  claim: { consumerId: string; class: string },
  now: Date,
): Promise<boolean> {
  if (claim.class === "pass_refresh") return true;
  const budget = await loadBudget(claim.consumerId, now);
  const decision = decideBudget(parseQueueClass(claim.class), budget, now);
  if (decision.kind === "send") return true;
  if (decision.kind === "suppress")
    await getDb().execute(sql`
      UPDATE consumer.wallet_push_queue
      SET status = 'suppressed', last_error = 'budget_24h'
      WHERE id = ${id}`);
  else
    await getDb().execute(sql`
      UPDATE consumer.wallet_push_queue
      SET status = 'pending', not_before = ${decision.notBefore.toISOString()}
      WHERE id = ${id}`);
  return false;
}
