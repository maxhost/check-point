import type { AnalyticsContext } from "../types";
import type { AnalyticsRuleHandler } from "../policy/schema";
export const contextRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
export function canonicalContext(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((v) => canonicalContext(v)).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => JSON.stringify(k) + ":" + canonicalContext(v))
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export const requiresCalculationBaseline = (
  handler: AnalyticsRuleHandler,
  previous: AnalyticsContext,
  next: AnalyticsContext,
) =>
  ["goal", "expenses", "margin", "unknown-cost"].includes(handler) &&
  contextRecord(previous.observed).calculationKey !== next.calculationKey;
const same = (a: unknown, b: unknown) =>
  canonicalContext(a) === canonicalContext(b);
const bucket = (v: unknown) =>
  Number(
    String(v ?? "")
      .split(":")
      .at(-1),
  );
const time = (v: unknown) => {
  if (typeof v !== "string") return NaN;
  const instant = Date.parse(v);
  return Number.isFinite(instant) ? instant : Date.parse(v.slice(0, 24));
};
/** Only the declared pertinent evidence can reopen a closed episode. No clock/global-input hash. */
export function canReopenContext(
  handler: AnalyticsRuleHandler,
  previous: AnalyticsContext,
  next: AnalyticsContext,
  decidedAt: string | null,
): boolean {
  const old = contextRecord(previous.observed),
    b = contextRecord(next),
    closed = time(decidedAt);
  if (requiresCalculationBaseline(handler, previous, next)) return false;
  if (b.kind === "learning")
    return !same(
      [old.first, old.occurrences, old.historyReady],
      [b.first, b.occurrences, b.historyReady],
    );
  if (handler === "summary")
    return (
      String(b.period) >
      String(old.period ?? previous.legacyDecisionPeriod ?? "")
    );
  if (handler === "demand" || handler === "slow-day")
    return String(b.target) > String(old.target ?? "");
  if (handler === "cost-rise") {
    const fact = contextRecord(b.fact),
      prior = contextRecord(old.fact);
    return (
      time(fact.occurredAt) > closed &&
      String(b.eventId) !== String(old.eventId) &&
      time(fact.occurredAt) >=
        time(prior.occurredAt ?? "1970-01-01T00:00:00.000Z")
    );
  }
  if (handler === "count-gap") return false; // One immutable report per count/event+item.
  if (handler === "campaign") {
    const cursor = contextRecord(b.snapshot),
      prior = contextRecord(old.snapshot);
    // A changed local projection or late money is not a newly applied campaign source.
    return (
      !same(old.cycle, b.cycle) &&
      time(cursor.capturedAt) > closed &&
      typeof cursor.eventId === "string" &&
      cursor.eventId !== prior.eventId &&
      typeof b.sourceKey === "string" &&
      Number.isSafeInteger(b.sourceRevision) &&
      (b.sourceKey !== old.sourceKey ||
        Number(b.sourceRevision) > Number(old.sourceRevision))
    );
  }
  if (handler === "stock") {
    const priorGauge = contextRecord(old.gauge),
      gauge = contextRecord(b.gauge),
      evidence = contextRecord(previous.stockEvidence),
      consumption = contextRecord(evidence.consumption),
      recovery = contextRecord(evidence.recovery);
    const known = (v: unknown) =>
      typeof v === "string" &&
      /^-?\d+(?:\.\d+)?$/.test(v) &&
      Number.isFinite(Number(v))
        ? Number(v)
        : null;
    const attended = known(priorGauge.quantity),
      current = known(gauge.quantity),
      consumed = known(consumption.quantity);
    const compare = (
      at: unknown,
      id: unknown,
      otherAt: unknown,
      otherId: unknown,
    ) => {
      const a = time(at),
        b = time(otherAt);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
      return a !== b
        ? a - b
        : typeof id === "string" && typeof otherId === "string"
          ? id < otherId
            ? -1
            : id > otherId
              ? 1
              : 0
          : NaN;
    };
    if (current === null) return false;
    return (
      (time(consumption.at) > closed &&
        consumed !== null &&
        attended !== null &&
        consumed < attended &&
        current < attended &&
        compare(
          gauge.observedAt,
          gauge.eventId,
          consumption.at,
          consumption.id,
        ) >= 0) ||
      (time(recovery.at) > closed &&
        compare(gauge.observedAt, gauge.eventId, recovery.at, recovery.id) > 0)
    );
  }
  if (handler === "goal")
    return (
      b.month !== old.month ||
      b.closing !== old.closing ||
      (!same(
        [old.revenue, old.expenses, old.margin, old.coverage],
        [b.revenue, b.expenses, b.margin, b.coverage],
      ) &&
        b.gap !== old.gap)
    );
  if (handler === "expenses")
    return !same(
      [old.hasFixed, old.closedMonth, old.firstMonth],
      [b.hasFixed, b.closedMonth, b.firstMonth],
    );
  if (handler === "margin")
    return (
      !same(old.support, b.support) &&
      ((!old.negative && b.negative === true) ||
        bucket(b.material) > bucket(old.material) ||
        (previous.eligible === false &&
          Number(b.unitProfit) < Number(old.unitProfit)))
    );
  if (handler === "unknown-cost")
    return (
      Number(b.missingUnits) > Number(old.missingUnits) &&
      bucket(b.material) > bucket(old.material)
    );
  if (handler === "voids")
    return (
      Number(b.count) > Number(old.count) &&
      !same(b.observations, old.observations)
    );
  return false;
}

export type EpisodePrevious = {
  status: string;
  context: AnalyticsContext;
  decidedAt?: string | null;
  episodeStartedAt: string;
  expiresAt: string;
};
/** The runtime and pure simulator share this episode/retention decision. */
export function planEpisode(
  handler: AnalyticsRuleHandler,
  previous: EpisodePrevious | undefined,
  next: AnalyticsContext,
  now: string,
  lifetimeDays: number,
  originInstant = now,
) {
  const instant = Date.parse(now),
    old = contextRecord(previous?.context.observed);
  const saved = previous
    ? Math.min(
        Date.parse(previous.expiresAt),
        Date.parse(previous.episodeStartedAt) + lifetimeDays * 86400000,
      )
    : Infinity;
  const expired = !!previous && instant > saved,
    closed =
      !!previous && !["open", "snoozed", "shown"].includes(previous.status);
  const target = next.period ?? next.target,
    prior = old.period ?? old.target ?? previous?.context.legacyDecisionPeriod;
  const rolling =
    ["summary", "demand", "slow-day"].includes(handler) &&
    next.kind !== "learning";
  const stale =
    !!previous &&
    rolling &&
    prior !== undefined &&
    String(target) < String(prior);
  const changedPeriod =
    !!previous && rolling && String(target) > String(prior ?? "");
  const closure =
    previous?.decidedAt ??
    (expired
      ? new Date(saved).toISOString()
      : String(
          contextRecord(old.fact).occurredAt ??
            contextRecord(old.gauge).observedAt ??
            previous?.episodeStartedAt ??
            now,
        ));
  const allowed =
    !previous || canReopenContext(handler, previous.context, next, closure);
  const newEpisode =
    !previous || ((closed || expired) && allowed) || changedPeriod;
  const startedAt = newEpisode ? originInstant : previous!.episodeStartedAt;
  const expiresAt = newEpisode
    ? new Date(Date.parse(startedAt) + lifetimeDays * 86400000).toISOString()
    : new Date(saved).toISOString();
  return {
    rebaseline:
      !!previous &&
      requiresCalculationBaseline(handler, previous.context, next),
    newEpisode,
    allowed,
    expired,
    closed,
    stale,
    startedAt,
    expiresAt,
    eligible: !stale && (!(closed || expired) || allowed),
  };
}
