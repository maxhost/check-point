/**
 * «Cliente en riesgo» (spec 0105 / ADR 0097) as a PURE rule: the HABITUAL customer who
 * broke their rhythm. No DB and no ambient clock — the loaders bring the habit
 * (`audience-store.ts`, `push-store.ts`) and the audience decisions call this AFTER their
 * dormant floor (`audience.ts`, `push-audience.ts`), which is never skipped.
 *
 * A visit is a DISTINCT DAY with a purchase at the business, in the business's timezone
 * (several orders the same day are one visit; a redemption is not one, ADR 0097 §5). The
 * rhythm is the mean gap between visits: `(last − first) / (visits − 1)`. The customer is
 * at risk when they have at least `minVisits` visits and have been away STRICTLY longer
 * than `rhythmFactor ×` that rhythm. `minVisits` and `rhythmFactor` are platform constants
 * of the catalog (`templates.ts`), not editable (owner, ADR 0097).
 */

export type AtRiskRule = { minVisits: number; rhythmFactor: number };

export type VisitHabit = {
  /** Distinct local days with an order at this business. */
  visitDays: number;
  /** `min(order.created_at)` of this business, null when they never bought. */
  firstOrderAt: Date | null;
  /** `max(order.created_at)` of this business, null when they never bought. */
  lastOrderAt: Date | null;
};

export function isAtRisk(
  habit: VisitHabit,
  now: Date,
  rule: AtRiskRule,
): boolean {
  const { visitDays, firstOrderAt, lastOrderAt } = habit;
  if (visitDays < rule.minVisits) return false;
  if (!firstOrderAt || !lastOrderAt) return false;
  const rhythm =
    (lastOrderAt.getTime() - firstOrderAt.getTime()) / (visitDays - 1);
  return now.getTime() - lastOrderAt.getTime() > rule.rhythmFactor * rhythm;
}
