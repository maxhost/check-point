import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import { analyticsCardStates as states } from "@mi-pasaporte/db/schema";
import type {
  MetricEvent,
  MetricTranslation,
} from "@mi-pasaporte/domain/analytics/metrics";
import {
  ANALYTICS_POLICY,
  type AnalyticsPolicy,
} from "@mi-pasaporte/domain/analytics/policy/index";
import { contextRecord } from "@mi-pasaporte/domain/analytics/cards/context";
import {
  buildStockCandidates,
  stockEvidenceBasis,
} from "@mi-pasaporte/domain/analytics/cards/stock";
import { inputFromRow, inputStatement } from "../queries";
import { syncInboxCandidates } from "./sync";
const newer = (next: Record<string, unknown>, old: unknown) => {
  const prior = contextRecord(old);
  return (
    String(next.at) > String(prior.at ?? "") ||
    (next.at === prior.at && String(next.id) > String(prior.id ?? ""))
  );
};
/** Called only after this source's revision/deltas succeeded, under the business-first lock. */
export async function recordStockEvidence(
  tx: DbTransaction,
  event: MetricEvent,
  translation: MetricTranslation,
  now = new Date(),
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const gauges = (translation.gauges ?? []).filter(
    (g) => g.metric === "stock_on_hand",
  );
  if (!gauges.length) return;
  const input = inputFromRow(
    (await tx.execute(inputStatement(event.businessId, now, undefined, policy)))
      .rows[0],
  );
  for (const rule of policy.rules.filter((r) => r.handler === "stock"))
    for (const gauge of gauges) {
      if (
        !gauge.locationId ||
        !gauge.dimensionId ||
        typeof gauge.quantity !== "string" ||
        !/^-?\d+(?:\.\d+)?$/.test(gauge.quantity) ||
        !Number.isFinite(Number(gauge.quantity))
      )
        continue;
      const subject = `${gauge.locationId}:${gauge.dimensionId}`;
      const [control] = await tx
        .select()
        .from(states)
        .where(
          and(
            eq(states.businessId, event.businessId),
            eq(states.cardKey, rule.id),
            eq(states.subjectKey, subject),
          ),
        );
      if (!control) continue;
      const context = contextRecord(control.context),
        evidence = { ...contextRecord(context.stockEvidence) };
      const cursor = {
        at: new Date(gauge.occurredAt).toISOString(),
        id: event.id,
        quantity: gauge.quantity,
      };
      if (newer(cursor, evidence.gauge)) evidence.gauge = cursor;
      const basis = stockEvidenceBasis(
        input,
        {
          locationId: gauge.locationId,
          dimensionId: gauge.dimensionId,
          quantity: gauge.quantity,
        },
        rule,
      );
      if (
        basis &&
        basis.short > rule.parameters.riskDays &&
        newer(cursor, evidence.recovery)
      )
        evidence.recovery = cursor;
      const consumption = translation.rows.filter(
        (r) =>
          r.metric === "stock_consumption" &&
          r.locationId === gauge.locationId &&
          r.dimensionId === gauge.dimensionId &&
          Number(r.quantity) > 0 &&
          r.occurredAt,
      );
      for (const row of consumption) {
        const fact = {
          at: new Date(row.occurredAt!).toISOString(),
          id: event.id,
          quantity: gauge.quantity,
        };
        if (newer(fact, evidence.consumption)) evidence.consumption = fact;
      }
      await tx
        .update(states)
        .set({ context: { ...context, stockEvidence: evidence } })
        .where(
          and(
            eq(states.businessId, event.businessId),
            eq(states.candidateId, control.candidateId),
          ),
        );
    }
  await syncInboxCandidates(
    tx,
    event.businessId,
    input,
    buildStockCandidates(input, [], policy),
    now,
    policy,
    ["stock"],
  );
}
