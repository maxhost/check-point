import type { NoticeClass } from "./push-plan";

/**
 * THE 24 H NOTICE BUDGET (spec 0111 / ADR 0103 §3), pure and DB-free. Google Wallet accepts
 * 3 notifying messages per pass every 24 h and the pass is ONE for the whole network, so:
 *
 * - the counter (`transactional`: accredit, redeem a reward, redeem a coupon) rings at most
 *   {@link COUNTER_NOTICES_PER_24H} times; the next ones are credited in silence;
 * - nothing rings more than {@link NOTIFYING_PER_24H} times, adding every class up.
 *
 * «With sound» = a `wallet_push_queue` row `sent` of class `transactional`, `campaign` or
 * `reminder`, in the moving window of {@link BUDGET_WINDOW_MS}. `pass_refresh` is silent: it
 * never counts and is never held back. Web Push counts like Wallet (the owner spoke of
 * notifications, not of a channel).
 */

export const COUNTER_NOTICES_PER_24H = 2;
export const NOTIFYING_PER_24H = 3;
export const BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000;

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
