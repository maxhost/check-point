import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  analyticsCardCandidates as candidates,
  analyticsCardStates as states,
} from "@mi-pasaporte/db/schema";
import { cardWeight } from "@mi-pasaporte/domain/analytics/weights";
import { addDays, validDay } from "@mi-pasaporte/domain/analytics/date";
import {
  planEpisode,
  canonicalContext,
  contextRecord,
} from "@mi-pasaporte/domain/analytics/cards/context";
import { sumIntegers } from "@mi-pasaporte/domain/analytics/money";
import type {
  AnalyticsInput,
  CardCandidate,
  AnalyticsContext,
} from "@mi-pasaporte/domain/analytics/types";
import type {
  AnalyticsPolicy,
  AnalyticsRuleHandler,
} from "@mi-pasaporte/domain/analytics/policy/index";
import { lockAnalyticsBusiness } from "./index";
const key = (card: { cardKey: string; subjectKey: string }) =>
  card.cardKey + ":" + card.subjectKey;
export const contextVersion = (context: unknown) =>
  createHash("sha256").update(canonicalContext(context)).digest("hex");
/** Stable identity and bounded control. Caller and every writer share the business-first lock. */
export async function syncInboxCandidates(
  tx: DbTransaction,
  businessId: string,
  input: AnalyticsInput,
  cards: readonly CardCandidate[],
  now: Date,
  policy: AnalyticsPolicy,
  scope?: readonly AnalyticsRuleHandler[],
  retireMissing = true,
) {
  await lockAnalyticsBusiness(tx, businessId);
  const controls = await tx
    .select()
    .from(states)
    .where(eq(states.businessId, businessId));
  const existing = await tx
    .select()
    .from(candidates)
    .where(eq(candidates.businessId, businessId));
  const average =
    sumIntegers(
      input.metrics
        .filter(
          (r) =>
            r.metric === "revenue" &&
            r.day >= addDays(input.today, -policy.weights.averageDailyDays) &&
            r.day < input.today,
        )
        .map((r) => r.amountMinor),
    ) / policy.weights.averageDailyDays;
  const fresh = new Set<string>();
  for (const card of cards) {
    const rule = policy.rules.find(
      (r) => r.id === card.cardKey && r.category !== "marketing",
    );
    if (!rule || (scope && !scope.includes(rule.handler))) continue;
    fresh.add(key(card));
    const previous = controls.find((s) => key(s) === key(card));
    const observed = card.context ?? {
      kind: rule.handler,
      legacyUnknown: true,
    };
    const oldContext = contextRecord(previous?.context);
    const isFact = rule.handler === "cost-rise" || rule.handler === "count-gap";
    const comparable = isFact
      ? {
          ...observed,
          fact: { occurredAt: contextRecord(observed.fact).occurredAt },
          emission: undefined,
        }
      : observed;
    if (!rule.enabled) {
      if (
        isFact &&
        observed.fact &&
        String(card.originObservedAt ?? "") >=
          String(oldContext.factCursor ?? "")
      ) {
        const started =
          previous?.episodeStartedAt ??
          new Date(String(contextRecord(observed.fact).occurredAt));
        const values = {
          context: {
            ...oldContext,
            observed: oldContext.observed ?? comparable,
            sourceFact: observed,
            factCursor: card.originObservedAt,
            originDay: card.originDay,
          },
          policyVersion: policy.version,
          updatedAt: now,
        };
        await tx
          .insert(states)
          .values({
            ...values,
            businessId,
            cardKey: rule.id,
            subjectKey: card.subjectKey,
            candidateId: previous?.candidateId ?? randomUUID(),
            status: previous?.status ?? "open",
            fingerprint: previous?.fingerprint ?? card.fingerprint,
            shownDays: previous?.shownDays ?? 0,
            lastShownDay: previous?.lastShownDay ?? input.today,
            episodeStartedAt: started,
            expiresAt:
              previous?.expiresAt ??
              new Date(started.getTime() + policy.lifetime.days * 86400000),
          })
          .onConflictDoUpdate({
            target: [states.businessId, states.cardKey, states.subjectKey],
            set: values,
          });
        if (previous)
          await tx
            .delete(candidates)
            .where(eq(candidates.id, previous.candidateId));
      }
      continue;
    }
    // Fact snapshots must never be rolled back by a late delivery.
    if (
      rule.handler === "cost-rise" &&
      String(card.originObservedAt ?? "") < String(oldContext.factCursor ?? "")
    )
      continue;
    const original =
      contextRecord(observed.fact).occurredAt ??
      card.originObservedAt?.slice(0, 24);
    const origin =
      typeof original === "string" && Number.isFinite(Date.parse(original))
        ? original
        : now.toISOString();
    const before = previous
      ? {
          status: previous.status,
          context: oldContext,
          decidedAt: previous.decidedAt?.toISOString(),
          episodeStartedAt: previous.episodeStartedAt.toISOString(),
          expiresAt: previous.expiresAt.toISOString(),
        }
      : undefined;
    let plan = planEpisode(
      rule.handler,
      before,
      observed,
      now.toISOString(),
      policy.lifetime.days,
      origin,
    );
    if (plan.stale) continue;
    if (previous && !plan.eligible) {
      await tx
        .delete(candidates)
        .where(
          and(
            eq(candidates.businessId, businessId),
            eq(candidates.id, previous.candidateId),
          ),
        );
      await tx
        .update(states)
        .set({
          policyVersion: policy.version,
          ...(plan.rebaseline
            ? { context: { ...oldContext, observed: comparable } }
            : isFact && observed.fact
              ? { context: { ...oldContext, sourceFact: observed } }
              : {}),
          expiresAt: new Date(plan.expiresAt),
          remindAt: null,
          status: plan.expired && !plan.closed ? "expired" : previous.status,
        })
        .where(
          and(
            eq(states.businessId, businessId),
            eq(states.candidateId, previous.candidateId),
          ),
        );
      continue;
    }
    if (
      plan.newEpisode &&
      !original &&
      card.originDay &&
      validDay(card.originDay)
    ) {
      const clock = await tx.execute(
        sql`select ${card.originDay}::date::timestamp at time zone timezone started from core.business where id=${businessId}`,
      );
      plan = planEpisode(
        rule.handler,
        before,
        observed,
        now.toISOString(),
        policy.lifetime.days,
        new Date(String(clock.rows[0].started)).toISOString(),
      );
    }
    const newEpisode = plan.newEpisode,
      start = new Date(plan.startedAt),
      expiry = new Date(plan.expiresAt);
    const context: AnalyticsContext = {
      ...oldContext,
      legacy: false,
      compacted: false,
      observed: comparable,
      ...(isFact ? { sourceFact: observed } : {}),
      eligible: true,
      ...(card.originObservedAt ? { factCursor: card.originObservedAt } : {}),
      ...(card.originDay ? { originDay: card.originDay } : {}),
    };
    // A fact body is stored once in sourceFact; observed retains only its comparable reference. No notification text/history.
    const version = contextVersion(observed),
      id = previous?.candidateId ?? randomUUID();
    const status = newEpisode
      ? "open"
      : previous?.status === "shown"
        ? "open"
        : (previous?.status ?? "open");
    const values = {
      candidateId: id,
      policyVersion: policy.version,
      contextVersion: version,
      context,
      episodeStartedAt: start,
      expiresAt: expiry,
      status: now > expiry ? "expired" : status,
      fingerprint: card.fingerprint,
      shownDays: newEpisode ? 0 : (previous?.shownDays ?? 0),
      lastShownDay: previous?.lastShownDay ?? input.today,
      remindAt: newEpisode ? null : (previous?.remindAt ?? null),
      revision: previous?.revision ?? 0,
      ...(newEpisode ? { decidedAt: null, reminderConsumedAt: null } : {}),
      updatedAt: now,
    };
    await tx
      .insert(states)
      .values({
        ...values,
        businessId,
        cardKey: card.cardKey,
        subjectKey: card.subjectKey,
      })
      .onConflictDoUpdate({
        target: [states.businessId, states.cardKey, states.subjectKey],
        set: values,
      });
    if (now > expiry) {
      await tx.delete(candidates).where(eq(candidates.id, id));
      continue;
    }
    const period = card.period ?? {
      from:
        card.originDay && validDay(card.originDay)
          ? card.originDay
          : input.today,
      to:
        card.originDay && validDay(card.originDay)
          ? card.originDay
          : input.today,
      label: "",
    };
    const content = {
      businessId,
      cardKey: card.cardKey,
      subjectKey: card.subjectKey,
      day: period.to,
      weight: String(cardWeight(card, average, undefined, policy)),
      amountMinor: card.amountMinor === null ? null : BigInt(card.amountMinor),
      currencyCode: card.currencyCode,
      minorUnit: card.minorUnit,
      parameters: card,
      fingerprint: card.fingerprint,
      locationId: card.locationId,
      category: card.category ?? rule.category,
      policyVersion: policy.version,
      contextVersion: version,
      episodeStartedAt: start,
      expiresAt: expiry,
      period,
    };
    await tx
      .insert(candidates)
      .values({ id, ...content })
      .onConflictDoUpdate({
        target: [
          candidates.businessId,
          candidates.cardKey,
          candidates.subjectKey,
        ],
        set: content,
      });
  }
  if (!retireMissing) return;
  for (const content of existing) {
    const rule = policy.rules.find((r) => r.id === content.cardKey);
    if (scope && rule && !scope.includes(rule.handler)) continue;
    if (fresh.has(key(content))) continue;
    // Learning's emission cooldown is not resolution of its unfinished history condition.
    if (
      rule?.enabled &&
      rule.handler === "demand" &&
      content.subjectKey === "learning" &&
      !cards.some((c) => c.cardKey === rule.id && c.subjectKey === "forecast")
    )
      continue;
    const control = controls.find((s) => s.candidateId === content.id);
    await tx
      .delete(candidates)
      .where(
        and(
          eq(candidates.businessId, businessId),
          eq(candidates.id, content.id),
        ),
      );
    if (control)
      await tx
        .update(states)
        .set({
          status:
            control.status === "open" || control.status === "snoozed"
              ? "resolved"
              : control.status,
          remindAt: null,
          policyVersion: policy.version,
          context: {
            ...contextRecord(control.context),
            eligible: false,
            observedResolved: true,
          },
          updatedAt: now,
        })
        .where(eq(states.candidateId, control.candidateId));
  }
}
