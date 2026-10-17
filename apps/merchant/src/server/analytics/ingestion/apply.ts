import { recordStockEvidence } from "../lifecycle/stock-evidence";
import { lockAnalyticsBusiness } from "../lifecycle";
import {
  evaluateAnalyticsFacts,
  reconcileCampaignCandidates,
} from "../evaluation";
import type { DbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  analyticsSourceRevisions,
  analyticsMetricContributions,
  analyticsDimensionLabels,
  analyticsDailyGauges,
  analyticsCampaignSnapshots,
} from "@mi-pasaporte/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  ANALYTICS_POLICY,
  type AnalyticsPolicy,
} from "@mi-pasaporte/domain/analytics/policy/index";
import { METRICS } from "@mi-pasaporte/domain/analytics/metrics";
import { isSupportedCurrency } from "@mi-pasaporte/domain/lib/currencies";
import { minorUnitForCurrency } from "@mi-pasaporte/domain/financial/rational";
import type {
  MetricEvent,
  MetricRow,
  MetricGauge,
  MetricTranslation,
} from "@mi-pasaporte/domain/analytics/metrics";
import { metricTranslators } from "./registry";
export function localMetricDay(instant: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
}
/** Caller owns delivery and origin-independent transactional application. A revision cursor survives empty replacements. */
export async function applyAnalyticsEvent(
  tx: DbTransaction,
  event: MetricEvent,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  await lockAnalyticsBusiness(tx, event.businessId);
  const translator = metricTranslators().find(
    (t) => t.eventType === event.eventType,
  );
  if (!translator) throw new Error("Metric translator unavailable");
  const result = translator.translate(event);
  const groups = [result, ...(result.additionalSources ?? [])].sort((a, b) =>
    a.sourceKey.localeCompare(b.sourceKey),
  );
  let campaignChanged = false;
  for (const group of groups)
    campaignChanged =
      (await applyTranslation(tx, event, group, policy)) || campaignChanged;
  // Acquire the daily evaluation lock only after all source locks/deltas for this event.
  if (campaignChanged)
    await reconcileCampaignCandidates(tx, event.businessId, new Date(), policy);
}
async function applyTranslation(
  tx: DbTransaction,
  event: MetricEvent,
  result: MetricTranslation,
  policy: AnalyticsPolicy,
) {
  if (
    !result.sourceKey ||
    !Number.isSafeInteger(result.sourceRevision) ||
    result.sourceRevision < 1
  )
    throw new Error("Invalid metric source");
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${event.businessId + ":" + result.sourceKey},0))`,
  );
  const [cursor] = await tx
    .select()
    .from(analyticsSourceRevisions)
    .where(
      and(
        eq(analyticsSourceRevisions.businessId, event.businessId),
        eq(analyticsSourceRevisions.sourceKey, result.sourceKey),
      ),
    );
  if (cursor && cursor.sourceRevision >= result.sourceRevision) return false;
  const [business] = await tx
    .select({ timezone: businesses.timezone })
    .from(businesses)
    .where(eq(businesses.id, event.businessId));
  if (!business) throw new Error("Metric business unavailable");
  const rows = result.rows.map((row) => normalize(row, business.timezone));
  await applyGauges(tx, event, result.gauges ?? [], business.timezone);
  const previous = await tx
    .select()
    .from(analyticsMetricContributions)
    .where(
      and(
        eq(analyticsMetricContributions.businessId, event.businessId),
        eq(analyticsMetricContributions.sourceKey, result.sourceKey),
      ),
    );
  // Sort the complete inverse/new delta set, not the two sets separately, to prevent lock inversions.
  const deltas = [
    ...previous.map((row) => ({ ...row, sign: -1 })),
    ...rows.map((row) => ({ ...row, sign: 1 })),
  ].sort((a, b) => key(a).localeCompare(key(b)));
  if (deltas.length) {
    const deltaValues = deltas.map(
      (row) =>
        sql`(${event.businessId}::uuid,${row.locationId}::uuid,${row.day}::date,${row.metric}::text,${row.dimensionKind}::text,${row.dimensionId}::uuid,${String(BigInt(row.amountMinor) * BigInt(row.sign))}::bigint,${row.currencyCode}::text,${row.minorUnit}::int,${row.quantity}::numeric * ${row.sign},${row.count * row.sign}::int)`,
    );
    await tx.execute(sql`insert into analytics.daily_metric (business_id,location_id,day,metric,dimension_kind,dimension_id,amount_minor,currency_code,minor_unit,quantity,count)
 select business_id,location_id,day,metric,dimension_kind,dimension_id,sum(amount_minor)::bigint,currency_code,minor_unit,sum(quantity),sum(count)::int from (values ${sql.join(deltaValues, sql`,`)}) as delta(business_id,location_id,day,metric,dimension_kind,dimension_id,amount_minor,currency_code,minor_unit,quantity,count)
 group by business_id,location_id,day,metric,dimension_kind,dimension_id,currency_code,minor_unit order by business_id,location_id,day,metric,dimension_kind,dimension_id,currency_code,minor_unit
 on conflict on constraint analytics_daily_metric_unique do update set amount_minor=analytics.daily_metric.amount_minor+excluded.amount_minor,quantity=analytics.daily_metric.quantity+excluded.quantity,count=analytics.daily_metric.count+excluded.count`);
  }
  await tx
    .delete(analyticsMetricContributions)
    .where(
      and(
        eq(analyticsMetricContributions.businessId, event.businessId),
        eq(analyticsMetricContributions.sourceKey, result.sourceKey),
      ),
    );
  if (rows.length)
    await tx.insert(analyticsMetricContributions).values(
      rows.map((row) => ({
        ...row,
        businessId: event.businessId,
        sourceKey: result.sourceKey,
        sourceRevision: result.sourceRevision,
      })),
    );
  await tx
    .insert(analyticsSourceRevisions)
    .values({
      businessId: event.businessId,
      sourceKey: result.sourceKey,
      sourceRevision: result.sourceRevision,
    })
    .onConflictDoUpdate({
      target: [
        analyticsSourceRevisions.businessId,
        analyticsSourceRevisions.sourceKey,
      ],
      set: { sourceRevision: result.sourceRevision },
    });
  const labels = new Map<
    string,
    typeof analyticsDimensionLabels.$inferInsert
  >();
  for (const row of [...result.rows, ...(result.gauges ?? [])]) {
    if (row.dimensionId && row.dimensionLabel) {
      const updatedAt = new Date(
          row.occurredAt ??
            event.capturedAt ??
            `${"day" in row ? row.day : ""}T00:00:00Z`,
        ),
        key = row.dimensionKind + ":" + row.dimensionId;
      const prior = labels.get(key);
      if (!prior || prior.updatedAt.getTime() <= updatedAt.getTime())
        labels.set(key, {
          businessId: event.businessId,
          kind: row.dimensionKind,
          id: row.dimensionId,
          label: row.dimensionLabel,
          updatedAt,
        });
    }
  }
  if (labels.size)
    await tx
      .insert(analyticsDimensionLabels)
      .values(
        [...labels.values()].sort((a, b) =>
          (a.kind + a.id).localeCompare(b.kind + b.id),
        ),
      )
      .onConflictDoUpdate({
        target: [
          analyticsDimensionLabels.businessId,
          analyticsDimensionLabels.kind,
          analyticsDimensionLabels.id,
        ],
        set: {
          label: sql`excluded.label`,
          updatedAt: sql`excluded.updated_at`,
        },
        setWhere: sql`${analyticsDimensionLabels.updatedAt} <= excluded.updated_at`,
      });
  let campaignChanged = result.rows.some(
    (row) => row.dimensionKind === "campaign",
  );
  for (const snapshot of result.campaignSnapshots ?? []) {
    const changed = await tx
      .insert(analyticsCampaignSnapshots)
      .values({
        ...snapshot,
        businessId: event.businessId,
        eventId: event.id,
        startsAt: new Date(snapshot.startsAt),
        endsAt: snapshot.endsAt ? new Date(snapshot.endsAt) : null,
        endedAt: snapshot.endedAt ? new Date(snapshot.endedAt) : null,
        capturedAt: new Date(snapshot.capturedAt),
      })
      .onConflictDoUpdate({
        target: [
          analyticsCampaignSnapshots.businessId,
          analyticsCampaignSnapshots.campaignId,
        ],
        set: {
          label: sql`excluded.label`,
          status: sql`excluded.status`,
          startsAt: sql`excluded.starts_at`,
          endsAt: sql`excluded.ends_at`,
          endedAt: sql`excluded.ended_at`,
          capturedAt: sql`excluded.captured_at`,
          eventId: sql`excluded.event_id`,
        },
        setWhere: sql`(${analyticsCampaignSnapshots.capturedAt},${analyticsCampaignSnapshots.eventId}) < (excluded.captured_at,excluded.event_id)`,
      })
      .returning({ eventId: analyticsCampaignSnapshots.eventId });
    campaignChanged ||= changed.length > 0;
  }
  await recordStockEvidence(tx, event, result, new Date(), policy);
  if (result.facts?.length)
    await evaluateAnalyticsFacts(
      tx,
      {
        businessId: event.businessId,
        eventId: event.id,
        capturedAt: event.capturedAt ?? new Date().toISOString(),
        facts: result.facts,
        sourceKey: result.sourceKey,
        sourceRevision: result.sourceRevision,
      },
      policy,
    );
  return campaignChanged;
}
function normalize(row: MetricRow, timezone: string) {
  if (Boolean(row.day) === Boolean(row.occurredAt))
    throw new Error("Metric needs local day or instant");
  const definition = METRICS[row.metric];
  if (
    !definition ||
    definition.type !== "sum" ||
    definition.dimension !== row.dimensionKind ||
    (row.dimensionKind === "none" && row.dimensionId !== null)
  )
    throw new Error("Invalid metric dimension");
  if (
    (definition.unit === "money" ||
      definition.unit === "money_quantity" ||
      definition.unit === "money_count") &&
    (!row.currencyCode ||
      !isSupportedCurrency(row.currencyCode) ||
      row.minorUnit !== minorUnitForCurrency(row.currencyCode) ||
      row.amountMinor === undefined)
  )
    throw new Error("Invalid metric currency");
  if (
    definition.unit === "quantity" &&
    (row.quantity === undefined ||
      row.amountMinor !== undefined ||
      row.currencyCode !== undefined)
  )
    throw new Error("Invalid quantity metric");
  const day = row.day ?? localMetricDay(row.occurredAt!, timezone);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day ||
    !/^[-]?\d+$/.test(row.amountMinor ?? "0") ||
    !/^[-]?\d+(?:\.\d+)?$/.test(row.quantity ?? "0") ||
    !Number.isSafeInteger(row.count ?? 0)
  )
    throw new Error("Invalid metric value");
  return {
    metric: row.metric,
    locationId: row.locationId,
    day,
    dimensionKind: row.dimensionKind,
    dimensionId: row.dimensionId,
    amountMinor: BigInt(row.amountMinor ?? "0"),
    currencyCode: row.currencyCode ?? "",
    minorUnit: row.minorUnit ?? 0,
    quantity: row.quantity ?? "0",
    count: row.count ?? 0,
  };
}
function key(row: {
  locationId: string | null;
  day: string;
  metric: string;
  dimensionKind: string;
  dimensionId: string | null;
  currencyCode: string;
  minorUnit: number;
}) {
  return [
    row.locationId ?? "",
    row.day,
    row.metric,
    row.dimensionKind,
    row.dimensionId ?? "",
    row.currencyCode,
    row.minorUnit,
  ].join("/");
}

async function applyGauges(
  tx: DbTransaction,
  event: MetricEvent,
  rows: readonly MetricGauge[],
  timezone: string,
) {
  const ordered = [...rows].sort((a, b) =>
    (a.locationId + a.metric + a.dimensionId).localeCompare(
      b.locationId + b.metric + b.dimensionId,
    ),
  );
  for (const row of ordered) {
    const definition = METRICS[row.metric];
    if (
      definition.type !== "gauge" ||
      definition.dimension !== row.dimensionKind ||
      !row.dimensionId ||
      !row.locationId ||
      !Number.isFinite(Date.parse(row.occurredAt)) ||
      !row.unit ||
      !/^-?\d+(?:\.\d+)?$/.test(row.amountMinor ?? "0") ||
      !/^-?\d+(?:\.\d+)?$/.test(row.quantity ?? "0")
    )
      throw new Error("Invalid gauge");
    if (
      definition.unit === "money" &&
      (!row.currencyCode ||
        !isSupportedCurrency(row.currencyCode) ||
        row.minorUnit !== minorUnitForCurrency(row.currencyCode) ||
        row.amountMinor === undefined)
    )
      throw new Error("Invalid gauge currency");
    if (
      definition.unit === "quantity" &&
      (row.quantity === undefined ||
        row.amountMinor !== undefined ||
        row.currencyCode !== undefined)
    )
      throw new Error("Invalid quantity gauge");
    await tx
      .insert(analyticsDailyGauges)
      .values({
        businessId: event.businessId,
        locationId: row.locationId,
        day: localMetricDay(row.occurredAt, timezone),
        metric: row.metric,
        dimensionKind: row.dimensionKind,
        dimensionId: row.dimensionId,
        amountMinor: row.amountMinor ?? "0",
        quantity: row.quantity ?? "0",
        currencyCode: row.currencyCode ?? "",
        minorUnit: row.minorUnit ?? 0,
        unit: row.unit,
        observedAt: new Date(row.occurredAt),
        eventId: event.id,
      })
      .onConflictDoUpdate({
        target: [
          analyticsDailyGauges.businessId,
          analyticsDailyGauges.locationId,
          analyticsDailyGauges.day,
          analyticsDailyGauges.metric,
          analyticsDailyGauges.dimensionKind,
          analyticsDailyGauges.dimensionId,
        ],
        set: {
          amountMinor: sql`excluded.amount_minor`,
          quantity: sql`excluded.quantity`,
          currencyCode: sql`excluded.currency_code`,
          minorUnit: sql`excluded.minor_unit`,
          unit: sql`excluded.unit`,
          observedAt: sql`excluded.observed_at`,
          eventId: sql`excluded.event_id`,
        },
        setWhere: sql`(analytics.daily_gauge.observed_at,analytics.daily_gauge.event_id)<(excluded.observed_at,excluded.event_id)`,
      });
  }
}
