/**
 * Pure, DB-free drain planner for the Wallet push queue (ADR 0037 §3). Split out of
 * `push.ts` so the priority/cooldown/preemption logic stays unit-testable in isolation
 * and `push.ts` keeps under the file-size budget.
 */

/**
 * The classes the drain understands. `pass_refresh` (spec 0065) is the silent lane that
 * only reloads the pass; it is a THIRD member on purpose, not a flavour of
 * `transactional` — see {@link planConsumerDrain}.
 */
export type NoticeClass = "transactional" | "campaign" | "pass_refresh";

export type QueueRow = {
  id: string;
  consumerId: string;
  klass: NoticeClass;
  notBefore: Date;
  createdAt: Date;
};

export type DrainAction =
  | { kind: "send"; row: QueueRow }
  | { kind: "reschedule"; row: QueueRow; notBefore: Date };

/**
 * Class precedence inside one consumer's batch. Kept as a rank (not a pair of ternaries)
 * so the comparator is TOTAL for three classes: with two, `a.klass === "transactional" ?
 * -1 : 1` sufficed; with three it would order `campaign` before `pass_refresh` and
 * `pass_refresh` before `campaign` depending on the argument order, which is not a
 * strict weak ordering and leaves the result engine-dependent.
 */
const CLASS_RANK: Record<NoticeClass, number> = {
  transactional: 0,
  pass_refresh: 1,
  campaign: 2,
};

/**
 * The timestamp a row is ordered by inside its class: a `campaign` waits on its
 * `not_before` (that is the column the cooldown stamps), the other two on their age.
 */
function orderKey(row: QueueRow): number {
  return row.klass === "campaign"
    ? row.notBefore.getTime()
    : row.createdAt.getTime();
}

/**
 * Pure drain planner for ONE consumer (unit-testable, no DB). Orders by class rank
 * (`transactional` → `pass_refresh` → `campaign`), then by the class's timestamp, then
 * by `id` — the last tiebreak makes the order deterministic without relying on the
 * engine's sort stability. Then it walks them keeping the effective last-push time:
 *
 * - `transactional` always sends (skips cooldown) and advances the clock to `now`, which
 *   **preempts** any following `campaign` (rescheduled to `now + cooldown`);
 * - `campaign` sends only when `now ≥ lastPush + cooldown`, else it is rescheduled;
 * - `pass_refresh` (spec 0065) ALWAYS sends and leaves `lastPush` untouched, so it never
 *   consumes the consumer's push budget and can never preempt a following `campaign`.
 *   That is the whole class: the pass reloads in silence. Because it never writes the
 *   clock, its position in the order cannot change any other row's action.
 *
 * Mirrors ADR 0037 §3.
 */
export function planConsumerDrain(
  rows: QueueRow[],
  lastPushAt: Date | null,
  now: Date,
  cooldownMs: number,
): DrainAction[] {
  const ordered = [...rows].sort((a, b) => {
    const byClass = CLASS_RANK[a.klass] - CLASS_RANK[b.klass];
    if (byClass !== 0) return byClass;
    const byKey = orderKey(a) - orderKey(b);
    if (byKey !== 0) return byKey;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  let lastPush = lastPushAt ? lastPushAt.getTime() : null;
  const actions: DrainAction[] = [];
  for (const row of ordered) {
    if (row.klass === "pass_refresh") {
      actions.push({ kind: "send", row });
      continue;
    }
    if (row.klass === "transactional") {
      actions.push({ kind: "send", row });
      lastPush = now.getTime();
      continue;
    }
    if (lastPush === null || now.getTime() >= lastPush + cooldownMs) {
      actions.push({ kind: "send", row });
      lastPush = now.getTime();
    } else {
      actions.push({
        kind: "reschedule",
        row,
        notBefore: new Date(lastPush + cooldownMs),
      });
    }
  }
  return actions;
}
