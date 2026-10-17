import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { withDbTransaction, type DbTransaction } from "@mi-pasaporte/db";
import {
  analyticsCardCandidates as candidates,
  analyticsCardStates as states,
  analyticsEvaluationRuns as runs,
  businesses,
} from "@mi-pasaporte/db/schema";
import type {
  AnalyticsCleanupResult,
  AnalyticsInboxCommand,
  AnalyticsInboxMutation,
  AnalyticsInboxResponse,
  AnalyticsPeriod,
  CardCandidate,
  InboxCard,
} from "@mi-pasaporte/domain/analytics/types";
import {
  ANALYTICS_POLICY,
  policyText,
  type AnalyticsPolicy,
} from "@mi-pasaporte/domain/analytics/policy/index";
import {
  localDay,
  validDay,
  daysBetween,
} from "@mi-pasaporte/domain/analytics/date";
import { actionContext, type AnalyticsViewer } from "../actions";
import { AnalyticsError, safeMoney } from "../queries";

type Control = typeof states.$inferSelect;
type Content = typeof candidates.$inferSelect;
type PolicyOptions = { policy?: AnalyticsPolicy };
const dayMs = 24 * 60 * 60 * 1000;
export const lifecycleLockKey = (businessId: string) =>
  `analytics:lifecycle:${businessId}`;
/** This lock precedes source locks and row locks in every writer, including delivery. */
export async function lockAnalyticsBusiness(
  tx: DbTransaction,
  businessId: string,
  tryOnly = false,
) {
  const result = await tx.execute(
    tryOnly
      ? sql`select pg_try_advisory_xact_lock(hashtextextended(${lifecycleLockKey(businessId)},0)) acquired`
      : sql`select pg_advisory_xact_lock(hashtextextended(${lifecycleLockKey(businessId)},0))`,
  );
  return !tryOnly || result.rows[0]?.acquired === true;
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function inboxCardVersion(
  control: Pick<
    Control,
    "candidateId" | "contextVersion" | "revision" | "policyVersion"
  >,
) {
  return digest([
    control.candidateId,
    control.contextVersion,
    control.policyVersion,
    control.revision,
  ]);
}
export function effectiveExpiresAt(
  control: Pick<Control, "episodeStartedAt" | "expiresAt">,
  policy: AnalyticsPolicy,
) {
  return new Date(
    Math.min(
      control.expiresAt.getTime(),
      control.episodeStartedAt.getTime() + policy.lifetime.days * dayMs,
    ),
  );
}
function fail(status: number, code: string, message: string): never {
  throw new AnalyticsError(status, code, message);
}
async function expireContent(
  tx: DbTransaction,
  control: Control,
  now: Date,
  policy: AnalyticsPolicy,
) {
  if (now.getTime() <= effectiveExpiresAt(control, policy).getTime())
    return false;
  await tx
    .delete(candidates)
    .where(
      and(
        eq(candidates.businessId, control.businessId),
        eq(candidates.id, control.candidateId),
      ),
    );
  await tx
    .update(states)
    .set({
      status: ["resolved", "ignored", "seen"].includes(control.status)
        ? control.status
        : "expired",
      remindAt: null,
      expiresAt: effectiveExpiresAt(control, policy),
      updatedAt: now,
    })
    .where(
      and(
        eq(states.businessId, control.businessId),
        eq(states.candidateId, control.candidateId),
        eq(states.revision, control.revision),
      ),
    );
  return true;
}
async function readInTransaction(
  tx: DbTransaction,
  businessId: string,
  viewer: AnalyticsViewer,
  now: Date,
  policy: AnalyticsPolicy,
  expose = true,
): Promise<AnalyticsInboxResponse> {
  const [business] = await tx
    .select({ timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!business) fail(404, "business_not_found", "No encontramos el negocio.");
  const today = localDay(now, business.timezone);
  const [run] = await tx
    .select()
    .from(runs)
    .where(and(eq(runs.businessId, businessId), eq(runs.day, today)));
  const prepared =
    run?.status === "ready" && run.policyVersion === policy.version;
  const rows = await tx
    .select({ content: candidates, control: states })
    .from(candidates)
    .innerJoin(
      states,
      and(
        eq(states.candidateId, candidates.id),
        eq(states.businessId, candidates.businessId),
      ),
    )
    .where(eq(candidates.businessId, businessId));
  const resolve = await actionContext(businessId, viewer, policy);
  const eligible: {
    content: Content;
    control: Control;
    card: CardCandidate;
    weight: number;
  }[] = [];
  let nextReminderAt: string | null = null;
  for (const row of rows) {
    const { content, control } = row;
    if (await expireContent(tx, control, now, policy)) continue;
    const rule = policy.rules.find((r) => r.id === content.cardKey);
    if (
      !rule?.enabled ||
      rule.category === "marketing" ||
      content.policyVersion !== policy.version ||
      control.policyVersion !== policy.version
    )
      continue;
    if (control.status !== "open" && control.status !== "snoozed") continue;
    if (
      rule.handler === "demand" &&
      content.subjectKey === "learning" &&
      control.shownDays > 0 &&
      control.lastShownDay !== today &&
      daysBetween(control.lastShownDay, today) <
        rule.parameters.learningCooldownDays
    )
      continue;
    const card = content.parameters as CardCandidate;
    // Target-day reports never masquerade as today's data while preparation is pending.
    if (
      (rule.handler === "summary" &&
        content.day !==
          new Date(Date.parse(`${today}T12:00:00Z`) - dayMs)
            .toISOString()
            .slice(0, 10)) ||
      ((rule.handler === "demand" || rule.handler === "slow-day") &&
        content.subjectKey !== "learning" &&
        content.day !== today)
    )
      continue;
    if (control.status === "snoozed" && control.remindAt) {
      if (control.remindAt > now) {
        const at = control.remindAt.toISOString();
        if (nextReminderAt === null || at < nextReminderAt) nextReminderAt = at;
        continue;
      }
      const unconsumed =
        !control.reminderConsumedAt ||
        control.reminderConsumedAt.getTime() !== control.remindAt.getTime();
      const update = {
        status: "open",
        reminderConsumedAt: control.remindAt,
        remindAt: null,
        shownDays: unconsumed ? 0 : control.shownDays,
        revision: control.revision + 1,
        updatedAt: now,
      };
      await tx
        .update(states)
        .set(update)
        .where(
          and(
            eq(states.candidateId, control.candidateId),
            eq(states.revision, control.revision),
          ),
        );
      Object.assign(control, update);
    }
    const novelty = policy.weights.noveltyDecay ** control.shownDays;
    let weight =
      rule.handler === "summary"
        ? policy.weights.summaryFixed
        : Number(content.weight) * novelty;
    if (card.criticalStock) weight = Math.max(weight, policy.weights.minimum);
    if (weight >= policy.weights.minimum)
      eligible.push({ ...row, card, weight });
  }
  eligible.sort(
    (a, b) =>
      b.weight - a.weight ||
      a.content.cardKey.localeCompare(b.content.cardKey) ||
      a.content.subjectKey.localeCompare(b.content.subjectKey),
  );
  // Enforce only the declared critical-stock precedence over invitations.
  for (const critical of eligible.filter((r) => r.card.criticalStock)) {
    const index = eligible.indexOf(critical);
    const invitation = eligible.findIndex((r) => {
      const handler = policy.rules.find(
        (rule) => rule.id === r.content.cardKey,
      )?.handler;
      return (
        handler === "expenses" ||
        handler === "unknown-cost" ||
        (handler === "demand" && r.content.subjectKey === "learning")
      );
    });
    if (invitation >= 0 && index > invitation) {
      eligible.splice(index, 1);
      eligible.splice(invitation, 0, critical);
    }
  }
  const cards: InboxCard[] = [];
  for (const { content, control, card } of eligible.slice(
    0,
    policy.weights.maximumCards,
  )) {
    const period = content.period as AnalyticsPeriod;
    const rule = policy.rules.find((r) => r.id === content.cardKey)!;
    const category = content.category as InboxCard["category"];
    cards.push({
      id: content.id,
      version: inboxCardVersion(control),
      cardKey: content.cardKey,
      category,
      expiresAt: effectiveExpiresAt(control, policy).toISOString(),
      period: {
        from: period.from,
        to: period.to,
        label:
          (period.label?.trim() || null) ??
          policyText(
            policy,
            period.from === period.to ? "periodDay" : "periodRange",
            period,
          ),
      },
      sender: card.sender,
      title: card.title,
      body: card.body,
      quality: card.quality,
      amountAtStake:
        content.amountMinor === null
          ? null
          : {
              amountMinor: safeMoney(content.amountMinor),
              currencyCode: content.currencyCode,
              minorUnit: content.minorUnit,
            },
      action: resolve(rule.actionKey, card.actionHref),
      decisions: policy.categories[category].map((key) => ({
        key,
        label: policy.decisions[key].label,
      })),
    });
    if (expose && (control.shownDays === 0 || control.lastShownDay !== today))
      await tx
        .update(states)
        .set({
          shownDays: control.shownDays + 1,
          lastShownDay: today,
          updatedAt: now,
        })
        .where(
          and(
            eq(states.candidateId, control.candidateId),
            eq(states.revision, control.revision),
          ),
        );
  }
  return {
    contractVersion: 2,
    policyVersion: policy.version,
    timezone: business.timezone,
    state: prepared ? "ready" : "preparing",
    preparedAt: prepared ? (run.preparedAt?.toISOString() ?? null) : null,
    nextReminderAt,
    refreshAfterMs: prepared ? null : policy.operation.fallbackWaitMs,
    cards,
  };
}
export async function readInbox(
  businessId: string,
  viewer: AnalyticsViewer,
  now = new Date(),
  options: PolicyOptions = {},
): Promise<AnalyticsInboxResponse> {
  const policy = options.policy ?? ANALYTICS_POLICY;
  return withDbTransaction(async (tx) => {
    if (!(await lockAnalyticsBusiness(tx, businessId, true))) {
      const [business] = await tx
        .select({ timezone: businesses.timezone })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      if (!business)
        fail(404, "business_not_found", "No encontramos el negocio.");
      // Busy snapshots have no exposure/expiry side effects and never serve stale content.
      return {
        contractVersion: 2,
        policyVersion: policy.version,
        timezone: business.timezone,
        state: "preparing",
        preparedAt: null,
        nextReminderAt: null,
        refreshAfterMs: policy.operation.fallbackWaitMs,
        cards: [],
      };
    }
    return readInTransaction(tx, businessId, viewer, now, policy);
  });
}
export async function decideInboxCard(
  command: AnalyticsInboxCommand,
  viewer: AnalyticsViewer,
  now = new Date(),
  options: PolicyOptions = {},
): Promise<AnalyticsInboxMutation> {
  const policy = options.policy ?? ANALYTICS_POLICY;
  if (
    !command.operationId?.trim() ||
    command.operationId.length > 200 ||
    !command.expectedVersion?.trim()
  )
    fail(422, "invalid_decision", "La decisión está incompleta.");
  const operationDigest = digest([
    command.cardId,
    command.decision,
    command.expectedVersion,
    command.remindAt ?? null,
  ]);
  return withDbTransaction(async (tx) => {
    await lockAnalyticsBusiness(tx, command.businessId);
    const [used] = await tx
      .select()
      .from(states)
      .where(
        and(
          eq(states.businessId, command.businessId),
          eq(states.lastOperationId, command.operationId),
        ),
      );
    if (used && used.candidateId !== command.cardId)
      fail(
        409,
        "operation_conflict",
        "Esa operación ya se usó para otro aviso.",
      );
    const [control] = await tx
      .select()
      .from(states)
      .where(
        and(
          eq(states.businessId, command.businessId),
          eq(states.candidateId, command.cardId),
        ),
      );
    if (!control) fail(404, "card_not_found", "No encontramos ese aviso.");
    if (control.lastOperationId === command.operationId) {
      if (control.lastOperationDigest !== operationDigest)
        fail(
          409,
          "operation_conflict",
          "Esa operación ya se usó para otra decisión.",
        );
      const current = await readInTransaction(
        tx,
        command.businessId,
        viewer,
        now,
        policy,
        false,
      );
      return { cards: current.cards, nextReminderAt: current.nextReminderAt };
    }
    if (now.getTime() > effectiveExpiresAt(control, policy).getTime())
      fail(409, "card_expired", "Ese aviso ya venció.");
    if (
      control.policyVersion !== policy.version ||
      command.expectedVersion !== inboxCardVersion(control)
    )
      fail(
        409,
        "card_context_changed",
        "El aviso cambió. Revisa sus datos antes de decidir.",
      );
    const [content] = await tx
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.businessId, command.businessId),
          eq(candidates.id, command.cardId),
        ),
      );
    if (!content || !["open", "snoozed"].includes(control.status))
      fail(409, "card_context_changed", "Ese aviso ya fue atendido.");
    const rule = policy.rules.find((r) => r.id === content.cardKey);
    const category = content.category as InboxCard["category"];
    if (
      !rule?.enabled ||
      !policy.categories[category]?.includes(command.decision)
    )
      fail(
        422,
        "invalid_decision",
        "Esa decisión no está disponible para este aviso.",
      );
    let remindAt: Date | null = null;
    if (command.decision === "snooze") {
      if (
        !command.remindAt ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(
          command.remindAt,
        ) ||
        !validDay(command.remindAt.slice(0, 10))
      )
        fail(
          422,
          "invalid_reminder",
          "Elige una fecha y hora con zona horaria.",
        );
      remindAt = new Date(command.remindAt);
      if (
        !Number.isFinite(remindAt.getTime()) ||
        remindAt <= now ||
        remindAt > effectiveExpiresAt(control, policy)
      )
        fail(
          422,
          "invalid_reminder",
          "Elige una fecha futura dentro de la vigencia del aviso.",
        );
    }
    const status =
      command.decision === "snooze"
        ? "snoozed"
        : command.decision === "resolve"
          ? "resolved"
          : command.decision === "ignore"
            ? "ignored"
            : "seen";
    const changed = await tx
      .update(states)
      .set({
        status,
        remindAt,
        reminderConsumedAt: null,
        decidedAt: now,
        actedBy: command.actorId,
        revision: control.revision + 1,
        lastOperationId: command.operationId,
        lastOperationDigest: operationDigest,
        updatedAt: now,
      })
      .where(
        and(
          eq(states.businessId, command.businessId),
          eq(states.candidateId, command.cardId),
          eq(states.revision, control.revision),
        ),
      )
      .returning({ id: states.candidateId });
    if (!changed.length)
      fail(409, "card_context_changed", "El aviso cambió. Intenta de nuevo.");
    if (command.decision !== "snooze")
      await tx
        .delete(candidates)
        .where(
          and(
            eq(candidates.businessId, command.businessId),
            eq(candidates.id, command.cardId),
          ),
        );
    const current = await readInTransaction(
      tx,
      command.businessId,
      viewer,
      now,
      policy,
      true,
    );
    return { cards: current.cards, nextReminderAt: current.nextReminderAt };
  });
}
export async function cleanupInbox(
  now = new Date(),
  options: PolicyOptions & { budgetMs?: number; batchSize?: number } = {},
): Promise<AnalyticsCleanupResult> {
  const policy = options.policy ?? ANALYTICS_POLICY;
  const budget = Math.min(
    options.budgetMs ?? policy.operation.cleanupBudgetMs,
    policy.operation.cleanupBudgetMs,
  );
  const batch = Math.min(
    options.batchSize ?? policy.operation.cleanupBatchSize,
    policy.operation.cleanupBatchSize,
  );
  const deadline = performance.now() + Math.max(0, budget);
  const result: AnalyticsCleanupResult = {
    cutoff: new Date(
      now.getTime() - policy.lifetime.days * dayMs,
    ).toISOString(),
    eligible: 0,
    processed: 0,
    completedAt: null,
    deleted: 0,
    skipped: 0,
    budgetExhausted: false,
  };
  const attempted = new Set<string>();
  const busyBusinesses = new Set<string>();
  while (performance.now() < deadline) {
    const progress = await withDbTransaction(async (tx) => {
      const attemptedFilter = attempted.size
        ? sql`and id not in (${sql.join(
            [...attempted].map((id) => sql`${id}::uuid`),
            sql`,`,
          )})`
        : sql``;
      const busyFilter = busyBusinesses.size
        ? sql`and business_id not in (${sql.join(
            [...busyBusinesses].map((id) => sql`${id}::uuid`),
            sql`,`,
          )})`
        : sql``;
      const rows = await tx.execute(
        sql`select id,business_id from analytics.card_candidate where (expires_at<${now.toISOString()}::timestamptz or episode_started_at<${now.toISOString()}::timestamptz-${policy.lifetime.days}*interval '24 hours') ${attemptedFilter} ${busyFilter} order by expires_at,id limit ${batch}`,
      );
      if (!rows.rows.length) return false;
      result.eligible += rows.rows.length;
      const businessIds = [
        ...new Set(rows.rows.map((row) => String(row.business_id))),
      ].sort();
      const acquired = await tx.execute(
        sql`with ordered as materialized(select business_id from (values ${sql.join(
          businessIds.map((id) => sql`(${id}::uuid)`),
          sql`,`,
        )}) b(business_id) order by business_id) select business_id,pg_try_advisory_xact_lock(hashtextextended('analytics:lifecycle:'||business_id::text,0)) acquired from ordered`,
      );
      for (const lock of acquired.rows)
        if (lock.acquired !== true)
          busyBusinesses.add(String(lock.business_id));
      for (const row of rows.rows) {
        const id = String(row.id),
          businessId = String(row.business_id);
        if (attempted.has(id)) continue;
        attempted.add(id);
        if (performance.now() >= deadline) {
          result.budgetExhausted = true;
          break;
        }
        if (busyBusinesses.has(businessId)) {
          result.skipped++;
          continue;
        }
        const available = await tx.execute(
          sql`select id from analytics.card_candidate where business_id=${businessId} and id=${id} for update skip locked`,
        );
        if (!available.rows.length) {
          result.skipped++;
          continue;
        }
        result.processed++;
        const [control] = await tx
          .select()
          .from(states)
          .where(
            and(eq(states.businessId, businessId), eq(states.candidateId, id)),
          );
        if (control && (await expireContent(tx, control, now, policy))) {
          result.deleted++;
        }
      }
      return true;
    });
    if (!progress) break;
  }
  // Controls for immutable facts/campaign cycles are not a notification history.
  // Their source cursor prevents delivery replay; campaign creation also keeps its emission gate.
  const controlProof = sql`((s.context->'observed'->>'kind' in ('count-gap','campaign') and exists(select 1 from analytics.source_revision r where r.business_id=s.business_id and r.source_key=s.context->'observed'->>'sourceKey' and r.source_revision>=case when s.context->'observed'->>'sourceRevision' ~ '^[0-9]+$' then (s.context->'observed'->>'sourceRevision')::numeric else null end)) or (s.context->'observed'->>'kind'='goal' and s.subject_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and pg_input_is_valid(s.subject_key,'date') and s.subject_key<(select to_char((${now.toISOString()}::timestamptz at time zone b.timezone)::date,'YYYY-MM-01') from core.business b where b.id=s.business_id)))`;
  const attemptedControls = new Set<string>();
  while (performance.now() < deadline) {
    const progressed = await withDbTransaction(async (tx) => {
      const excluded = attemptedControls.size
        ? sql`and s.candidate_id not in (${sql.join(
            [...attemptedControls].map((id) => sql`${id}::uuid`),
            sql`,`,
          )})`
        : sql``;
      const busy = busyBusinesses.size
        ? sql`and s.business_id not in (${sql.join(
            [...busyBusinesses].map((id) => sql`${id}::uuid`),
            sql`,`,
          )})`
        : sql``;
      const discover = await tx.execute(
        sql`select s.business_id,s.candidate_id from analytics.card_state s where s.expires_at<${now.toISOString()}::timestamptz and s.remind_at is null and ${controlProof} and not exists(select 1 from analytics.card_candidate c where c.business_id=s.business_id and c.id=s.candidate_id) ${excluded} ${busy} order by s.expires_at,s.candidate_id limit ${batch}`,
      );
      if (!discover.rows.length) return false;
      result.eligible += discover.rows.length;
      for (const row of [...discover.rows].sort((a, b) =>
        String(a.business_id).localeCompare(String(b.business_id)),
      )) {
        const id = String(row.candidate_id),
          businessId = String(row.business_id);
        attemptedControls.add(id);
        if (performance.now() >= deadline) break;
        if (!(await lockAnalyticsBusiness(tx, businessId, true))) {
          busyBusinesses.add(businessId);
          result.skipped++;
          continue;
        }
        const locked = await tx.execute(
          sql`select revision,context_version from analytics.card_state where business_id=${businessId} and candidate_id=${id}::uuid for update skip locked`,
        );
        if (!locked.rows.length) {
          result.skipped++;
          continue;
        }
        result.processed++;
        const deleted = await tx.execute(
          sql`delete from analytics.card_state s where s.business_id=${businessId} and s.candidate_id=${id}::uuid and ${controlProof} and s.revision=${Number(locked.rows[0].revision)} and s.context_version=${String(locked.rows[0].context_version)} and s.expires_at<${now.toISOString()}::timestamptz and s.remind_at is null and not exists(select 1 from analytics.card_candidate c where c.business_id=s.business_id and c.id=s.candidate_id) returning s.candidate_id`,
        );
        result.deleted += deleted.rows.length;
      }
      return true;
    });
    if (!progressed) break;
  }
  if (performance.now() >= deadline) result.budgetExhausted = true;
  if (!result.budgetExhausted) result.completedAt = new Date().toISOString();
  return result;
}
