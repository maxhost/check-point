/**
 * Pure, DB-free drain planner for the Wallet push queue (ADR 0037 §3). Split out of
 * `push.ts` so the priority/cooldown/preemption logic stays unit-testable in isolation
 * and `push.ts` keeps under the file-size budget.
 */

export type QueueRow = {
  id: string;
  consumerId: string;
  klass: "transactional" | "campaign";
  notBefore: Date;
  createdAt: Date;
};

export type DrainAction =
  | { kind: "send"; row: QueueRow }
  | { kind: "reschedule"; row: QueueRow; notBefore: Date };

/**
 * Pure drain planner for ONE consumer (unit-testable, no DB). Orders `transactional`
 * (by age) before `campaign` (by `not_before`), then walks them keeping the effective
 * last-push time: a `transactional` always sends (skips cooldown) and advances the
 * clock to `now`, which **preempts** any following `campaign` (rescheduled to
 * `now + cooldown`); a `campaign` sends only when `now ≥ lastPush + cooldown`, else it
 * is rescheduled. Mirrors ADR 0037 §3.
 */
export function planConsumerDrain(
  rows: QueueRow[],
  lastPushAt: Date | null,
  now: Date,
  cooldownMs: number,
): DrainAction[] {
  const ordered = [...rows].sort((a, b) => {
    if (a.klass !== b.klass) return a.klass === "transactional" ? -1 : 1;
    const key = a.klass === "transactional" ? "createdAt" : "notBefore";
    return a[key].getTime() - b[key].getTime();
  });
  let lastPush = lastPushAt ? lastPushAt.getTime() : null;
  const actions: DrainAction[] = [];
  for (const row of ordered) {
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
