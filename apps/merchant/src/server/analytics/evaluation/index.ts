import { and, eq, sql } from "drizzle-orm";
import { getDb, withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  analyticsCardStates as states,
  businesses,
} from "@mi-pasaporte/db/schema";
import type {
  AnalyticsFact,
  MetricEvent,
} from "@mi-pasaporte/domain/analytics/metrics";
import {
  buildFactCandidates,
  carryFactCandidate,
  restoreFactCandidates,
  needsFactOriginSnapshot,
  factOriginDay,
} from "@mi-pasaporte/domain/analytics/cards/stock";
import { buildCustomerPromoCandidates } from "@mi-pasaporte/domain/analytics/cards/customer-promo";
import { buildCandidates } from "@mi-pasaporte/domain/analytics/cards/index";
import { contextRecord } from "@mi-pasaporte/domain/analytics/cards/context";
import { localDay } from "@mi-pasaporte/domain/analytics/date";
import {
  ANALYTICS_POLICY,
  type AnalyticsPolicy,
} from "@mi-pasaporte/domain/analytics/policy/index";
import type { CardCandidate } from "@mi-pasaporte/domain/analytics/types";
import { AnalyticsError, inputStatement, inputFromRow } from "../queries";
import { lockAnalyticsBusiness } from "../lifecycle";
import { syncInboxCandidates } from "../lifecycle/sync";
import { metricTranslators } from "../ingestion/registry";
export { readInbox } from "../lifecycle";
export const evaluationLockKey = (businessId: string, day: string) =>
  `analytics:evaluate:${businessId}:${day}`;
export async function businessDay(businessId: string, now = new Date()) {
  const [business] = await getDb()
    .select({ timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business)
    throw new AnalyticsError(
      404,
      "business_not_found",
      "No encontramos el negocio.",
    );
  return localDay(now, business.timezone);
}
type Input = ReturnType<typeof inputFromRow>;
/** Only structured IDs of existing legacy facts; never scan/backfill event history or source tables. */
async function recoverLegacyFacts(
  tx: DbTransaction,
  businessId: string,
  input: Input,
  now: Date,
  policy: AnalyticsPolicy,
) {
  for (const card of input.factCards) {
    const control = input.states.find(
        (s) => s.cardKey === card.cardKey && s.subjectKey === card.subjectKey,
      ),
      context = contextRecord(control?.context);
    if (
      !control ||
      context.legacyRecoveryAttempted ||
      contextRecord(context.observed).fact
    )
      continue;
    const eventId =
      card.originObservedAt?.slice(25) ?? card.subjectKey.split(":")[0];
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(eventId))
      continue;
    const event = await tx.execute(
      sql`select e.id,e.event_type,e.event_version,e.payload,e.created_at from core.module_event e join core.module_event_delivery d on d.event_id=e.id and d.subscriber_id='core.analytics' and d.state='applied' where e.business_id=${businessId} and e.id=${eventId}::uuid`,
    );
    const raw = event.rows[0];
    let restored: CardCandidate | undefined;
    if (raw) {
      const translator = metricTranslators().find(
        (t) => t.eventType === raw.event_type,
      );
      if (translator) {
        let facts: readonly AnalyticsFact[] = [];
        let sourceKey: string | undefined, sourceRevision: number | undefined;
        try {
          const translation = translator.translate({
            id: eventId,
            businessId,
            eventType: String(raw.event_type),
            eventVersion: Number(raw.event_version),
            payload: raw.payload,
            capturedAt: new Date(String(raw.created_at)).toISOString(),
          } satisfies MetricEvent);
          facts = translation.facts ?? [];
          sourceKey = translation.sourceKey;
          sourceRevision = translation.sourceRevision;
        } catch {
          /* Incomplete legacy evidence never becomes an invented fact. */
        }
        const relevant = facts.filter(
          (f) =>
            card.subjectKey ===
            (f.kind === "unit_cost_change"
              ? `${f.locationId}:${f.itemId}:${f.productId}`
              : `${eventId}:${f.itemId}`),
        );
        if (relevant.length) {
          const original = inputFromRow(
            (
              await tx.execute(
                inputStatement(
                  businessId,
                  new Date(relevant[0].occurredAt),
                  undefined,
                  policy,
                ),
              )
            ).rows[0],
          );
          restored = buildFactCandidates(
            original,
            relevant,
            eventId,
            (instant) => localDay(new Date(instant), input.timezone!),
            [],
            policy,
          ).find(
            (c) =>
              c.cardKey === card.cardKey && c.subjectKey === card.subjectKey,
          );
        }
        if (restored)
          restored = {
            ...restored,
            context: { ...restored.context, sourceKey, sourceRevision },
          };
      }
    }
    await tx
      .update(states)
      .set({
        context: {
          ...context,
          legacyRecoveryAttempted: true,
          ...(restored?.context
            ? {
                observed: {
                  ...restored.context,
                  fact: {
                    occurredAt: contextRecord(restored.context.fact).occurredAt,
                  },
                  emission: undefined,
                },
                sourceFact: restored.context,
                factCursor: restored.originObservedAt,
                originDay: restored.originDay,
              }
            : {}),
        },
      })
      .where(
        and(
          eq(states.businessId, businessId),
          eq(states.candidateId, control.candidateId!),
        ),
      );
  }
}
export async function evaluateBusiness(
  businessId: string,
  now = new Date(),
  options: {
    budgetMs?: number;
    trace?: (stage: string, ms: number) => void;
    policy?: AnalyticsPolicy;
  } = {},
): Promise<boolean> {
  const policy = options.policy ?? ANALYTICS_POLICY,
    connecting = performance.now();
  return withDbTransaction(async (tx) => {
    if (!(await lockAnalyticsBusiness(tx, businessId, true))) return false;
    options.trace?.("transaction_connection", performance.now() - connecting);
    const started = performance.now(),
      budget = Math.max(
        1,
        Math.floor(options.budgetMs ?? policy.operation.evaluationBudgetMs),
      );
    const result = await tx.execute(
      sql`with b as materialized(select (${now.toISOString()}::timestamptz at time zone timezone)::date day from core.business where id=${businessId}),settings as materialized(select set_config('statement_timeout',${String(Math.max(1, budget - 100))},true),set_config('transaction_timeout',${String(budget)},true)),claim as(insert into analytics.evaluation_run(business_id,day,status,claimed_at,policy_version) select ${businessId}::uuid,b.day,'preparing',${now.toISOString()}::timestamptz,${policy.version} from b,settings on conflict(business_id,day) do update set status='preparing',claimed_at=excluded.claimed_at,policy_version=excluded.policy_version where analytics.evaluation_run.status<>'ready' or analytics.evaluation_run.policy_version<>excluded.policy_version returning day) select day::text from claim`,
    );
    if (!result.rows[0]) return false;
    let input = inputFromRow(
      (await tx.execute(inputStatement(businessId, now, undefined, policy)))
        .rows[0],
    );
    await recoverLegacyFacts(tx, businessId, input, now, policy);
    // Recovering structured facts is a one-time transition, followed by the normal summary snapshot.
    if (
      input.factCards.some(
        (c) =>
          contextRecord(
            input.states.find(
              (s) => s.cardKey === c.cardKey && s.subjectKey === c.subjectKey,
            )?.context,
          ).legacy,
      )
    )
      input = inputFromRow(
        (await tx.execute(inputStatement(businessId, now, undefined, policy)))
          .rows[0],
      );
    const origins = new Map<string, Input>();
    for (const state of input.states) {
      const observed = contextRecord(
          contextRecord(state.context).sourceFact ??
            contextRecord(state.context).observed,
        ),
        fact = observed.fact as AnalyticsFact | undefined;
      const rule = policy.rules.find(
        (r) =>
          r.id === state.cardKey &&
          r.enabled &&
          (r.handler === "cost-rise" || r.handler === "count-gap"),
      );
      if (
        !rule ||
        !fact ||
        typeof observed.eventId !== "string" ||
        !needsFactOriginSnapshot(rule, observed) ||
        origins.has(observed.eventId)
      )
        continue;
      origins.set(
        observed.eventId,
        inputFromRow(
          (
            await tx.execute(
              inputStatement(
                businessId,
                new Date(fact.occurredAt),
                undefined,
                policy,
                factOriginDay(
                  contextRecord(state.context),
                  fact,
                  input.timezone,
                ),
              ),
            )
          ).rows[0],
        ),
      );
    }
    input = {
      ...input,
      factSnapshots: [...origins].map(([eventId, input]) => ({
        eventId,
        input,
      })),
    };
    options.trace?.(
      "claim_and_summary_round_trip",
      performance.now() - started,
    );
    const calculating = performance.now();
    const cards = [
      ...buildCandidates(input, input.states, policy),
      ...restoreFactCandidates(input, input.states, policy),
    ];
    options.trace?.("pure_calculation", performance.now() - calculating);
    const writing = performance.now();
    await syncInboxCandidates(tx, businessId, input, cards, now, policy);
    await tx.execute(
      sql`update analytics.evaluation_run set status='ready',policy_version=${policy.version},prepared_at=clock_timestamp() where business_id=${businessId} and day=${input.today}::date`,
    );
    options.trace?.("persistence_round_trips", performance.now() - writing);
    return true;
  });
}
export async function reconcileCampaignCandidates(
  tx: DbTransaction,
  businessId: string,
  now = new Date(),
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  await lockAnalyticsBusiness(tx, businessId);
  const input = inputFromRow(
    (await tx.execute(inputStatement(businessId, now, undefined, policy)))
      .rows[0],
  );
  await syncInboxCandidates(
    tx,
    businessId,
    input,
    buildCustomerPromoCandidates(input, input.states, policy).filter((c) =>
      policy.rules.some((r) => r.id === c.cardKey && r.handler === "campaign"),
    ),
    now,
    policy,
    ["campaign"],
  );
}
export async function evaluateAnalyticsFacts(
  tx: DbTransaction,
  context: {
    businessId: string;
    eventId: string;
    capturedAt: string;
    facts: readonly AnalyticsFact[];
    now?: Date;
    sourceKey?: string;
    sourceRevision?: number;
  },
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  if (!context.facts.length) return;
  await lockAnalyticsBusiness(tx, context.businessId);
  const now = context.now ?? new Date();
  const input = inputFromRow(
    (
      await tx.execute(
        inputStatement(context.businessId, now, undefined, policy),
      )
    ).rows[0],
  );
  const cards: CardCandidate[] = [];
  for (const fact of context.facts) {
    const original = inputFromRow(
      (
        await tx.execute(
          inputStatement(
            context.businessId,
            new Date(fact.occurredAt),
            undefined,
            policy,
          ),
        )
      ).rows[0],
    );
    cards.push(
      ...buildFactCandidates(
        original,
        [fact],
        context.eventId,
        (instant) => localDay(new Date(instant), input.timezone),
        [],
        policy,
        new Map(),
        true,
      )
        .map((c) => {
          const captured = {
            ...c,
            context: {
              ...c.context,
              sourceKey: context.sourceKey,
              sourceRevision: context.sourceRevision,
            },
          };
          return policy.rules.find((r) => r.id === c.cardKey)?.enabled
            ? carryFactCandidate(input, captured, [], policy)
            : captured;
        })
        .filter((c): c is CardCandidate => c !== null),
    );
  }
  await syncInboxCandidates(
    tx,
    context.businessId,
    input,
    cards,
    now,
    policy,
    ["cost-rise", "count-gap"],
    false,
  );
}
export async function evaluateDueBusinesses(
  now = new Date(),
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const deadline = Date.now() + policy.operation.evaluationBudgetMs;
  let processed = 0,
    skipped = 0;
  const campaignDelays = policy.rules
    .filter((r) => r.enabled && r.handler === "campaign")
    .map((r) => r.parameters.emissionDelayDays);
  const campaignDue = campaignDelays.length
    ? sql`exists(select 1 from analytics.campaign_snapshot c where c.business_id=b.id and (least(c.ends_at,c.ended_at) at time zone b.timezone)::date in (${sql.join(
        campaignDelays.map(
          (days) =>
            sql`((${now.toISOString()}::timestamptz at time zone b.timezone)::date-${days}::int)`,
        ),
        sql`,`,
      )}))`
    : sql`false`;
  const due = await getDb().execute(
    sql`select b.id from core.business b where b.status='active' and extract(hour from ${now.toISOString()}::timestamptz at time zone b.timezone)>=${policy.operation.earliestEvaluationHour} and not exists(select 1 from analytics.evaluation_run r where r.business_id=b.id and r.day=(${now.toISOString()}::timestamptz at time zone b.timezone)::date and r.status='ready' and r.policy_version=${policy.version}) and (exists(select 1 from analytics.daily_metric m where m.business_id=b.id and m.day>=(${now.toISOString()}::timestamptz at time zone b.timezone)::date-${policy.operation.recentActivityDays}::int) or not exists(select 1 from analytics.daily_metric m where m.business_id=b.id) or exists(select 1 from analytics.card_state s where s.business_id=b.id and s.status in ('open','snoozed')) or ${campaignDue}) order by b.id limit ${policy.operation.evaluationBatchSize}`,
  );
  for (const row of due.rows) {
    if (Date.now() >= deadline) {
      skipped++;
      continue;
    }
    if (
      await evaluateBusiness(String(row.id), now, {
        budgetMs: Math.max(1, deadline - Date.now()),
        policy,
      })
    )
      processed++;
    else skipped++;
  }
  return { processed, skipped };
}
/** Legacy clients must reload v2; navigation is never reinterpreted as a decision. */
export async function actOnCard(..._legacy: unknown[]): Promise<never> {
  void _legacy;
  throw new AnalyticsError(
    409,
    "inbox_contract_changed",
    "Recarga el inbox para continuar.",
  );
}
