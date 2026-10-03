import {
  BUDGET_WINDOW_MS,
  COUNTER_NOTICES_PER_24H,
  NOTIFYING_PER_24H,
} from "@mi-pasaporte/domain/server/notifications/limits";
import type { NoticeClass } from "./push-plan";

/**
 * THE 24 H NOTICE BUDGET (spec 0111 / ADR 0103 §3), pure and DB-free: the counter rings at
 * most {@link COUNTER_NOTICES_PER_24H} times and nothing rings more than
 * {@link NOTIFYING_PER_24H} times in {@link BUDGET_WINDOW_MS}. The values, and why they are
 * what they are, live in `@mi-pasaporte/domain/server/notifications/limits` (spec 0141 /
 * ADR 0115 §5); re-exported here so no importer changes.
 */
export { BUDGET_WINDOW_MS, COUNTER_NOTICES_PER_24H, NOTIFYING_PER_24H };

/** What was already sent with sound to one consumer in the last 24 h. */
export type Budget = {
  /** `transactional` rows sent in the window. */
  counterSent24h: number;
  /** `transactional` + `campaign` + `reminder` rows sent in the window. */
  notifyingSent24h: number;
  /** The oldest of those (when it leaves the window, a slot frees). */
  oldestNotifyingSentAt: Date | null;
};

export type BudgetDecision =
  { kind: "send" } | { kind: "suppress" } | { kind: "defer"; notBefore: Date };

/**
 * The table of spec 0111 D2. A `campaign` is DEFERRED (it is still worth sending once a
 * slot frees: when the oldest notifying send leaves the window); a counter notice or a
 * reminder is SUPPRESSED (it is about now — the balance is already in the account).
 */
export function decideBudget(
  klass: NoticeClass,
  b: Budget,
  now: Date,
): BudgetDecision {
  if (klass === "pass_refresh") return { kind: "send" };
  const full = b.notifyingSent24h >= NOTIFYING_PER_24H;
  if (klass === "transactional")
    return b.counterSent24h >= COUNTER_NOTICES_PER_24H || full
      ? { kind: "suppress" }
      : { kind: "send" };
  if (klass === "campaign") {
    if (!full) return { kind: "send" };
    // With a full window there is always an oldest send; `now` is only the defensive
    // floor for an inconsistent input (never earlier than now).
    const oldest = b.oldestNotifyingSentAt?.getTime() ?? now.getTime();
    return {
      kind: "defer",
      notBefore: new Date(Math.max(oldest + BUDGET_WINDOW_MS, now.getTime())),
    };
  }
  return full ? { kind: "suppress" } : { kind: "send" };
}
