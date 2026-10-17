import {
  ANALYTICS_POLICY,
  policyWindows,
  type AnalyticsPolicy,
} from "@mi-pasaporte/domain/analytics/policy/index";
import { minorUnitForCurrency } from "@mi-pasaporte/domain/financial/rational";
import { sql } from "drizzle-orm";
import { getDb, type DbTransaction } from "@mi-pasaporte/db";
import {
  addDays,
  daysBetween,
  localDay,
} from "@mi-pasaporte/domain/analytics/date";
import type {
  AnalyticsInput,
  AnalyticsMetric,
  CardState,
  AnalyticsGauge,
  CardCandidate,
} from "@mi-pasaporte/domain/analytics/types";
import {
  buildDay,
  historyRange,
  summarizeHistory,
  type HistoryPeriod,
} from "@mi-pasaporte/domain/analytics/history";
import { summarizeCustomerPromoHistory } from "@mi-pasaporte/domain/analytics/customer-promo-history";
import { summarizeStockHistory } from "@mi-pasaporte/domain/analytics/stock-history";
import { validDay } from "@mi-pasaporte/domain/analytics/date";
import { calculateGoal } from "@mi-pasaporte/domain/analytics/cards/index";
export class AnalyticsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function safeMoney(value: bigint | string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new AnalyticsError(
      422,
      "amount_out_of_range",
      "El monto supera el rango de cálculo.",
    );
  return number;
}
function metricRow(row: Record<string, unknown>): AnalyticsMetric {
  return {
    day: String(row.day),
    metric: String(row.metric),
    locationId: row.locationId ? String(row.locationId) : null,
    dimensionId: row.dimensionId ? String(row.dimensionId) : null,
    amountMinor: safeMoney(String(row.amountMinor)),
    currencyCode: String(row.currencyCode),
    minorUnit: Number(row.minorUnit),
    quantity: Number(row.quantity),
    count: safeMoney(String(row.count)),
  };
}
/** One round-trip: covered historical money plus bounded windows for product metrics. */
export function inputStatement(
  businessId: string,
  now = new Date(),
  locationId?: string,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
  originDayOverride?: string,
) {
  if (originDayOverride && !validDay(originDayOverride))
    throw new Error("Día factual inválido.");
  const today = originDayOverride
    ? sql`${originDayOverride}::date`
    : sql`(${now.toISOString()}::timestamptz at time zone timezone)::date`;
  const windows = policyWindows(policy);
  const revenueDays = Math.max(windows.recentDays, windows.sameWeekdays * 7);
  const factIds = policy.rules
    .filter((r) => r.handler === "cost-rise" || r.handler === "count-gap")
    .map((r) => r.id);
  const factFilter = factIds.length
    ? sql`card_key in (${sql.join(
        factIds.map((id) => sql`${id}`),
        sql`,`,
      )})`
    : sql`false`;
  const location = locationId ? sql`and m.location_id=${locationId}` : sql``;
  return sql`with b as (select id,currency_code,timezone,${today} today from core.business where id=${businessId}),
    account_money as materialized (select m.location_id,m.day,m.metric,m.dimension_kind,m.dimension_id,m.currency_code,m.minor_unit,m.amount_minor,m.count from analytics.daily_metric m,b where m.business_id=${businessId} and m.metric in ('revenue','expense_fixed','expense_variable') and m.day<=b.today ${location}),
    same_days as (select distinct m.day from account_money m,b where m.metric='revenue' and (m.count>0 or m.amount_minor>0) and m.day<b.today and extract(dow from m.day)=extract(dow from b.today) order by m.day desc limit ${windows.sameWeekdays}),
    fixed_months as (select (max(m.day) filter(where m.amount_minor>0))::date as day,m.dimension_id,sum(m.amount_minor)::text amount,m.currency_code,m.minor_unit,
      row_number() over(partition by m.dimension_id,m.currency_code,m.minor_unit order by date_trunc('month',m.day) desc) as rank
      from account_money m,b where m.metric='expense_fixed' and m.day<date_trunc('month',b.today)
      group by date_trunc('month',m.day),m.dimension_id,m.currency_code,m.minor_unit having sum(m.amount_minor)>0),
    metric_rows as (
      select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day between b.today-${windows.recentDays}::int and b.today where (m.metric<>'expense_fixed' or m.day>=date_trunc('month',b.today)) ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day>=date_trunc('month',b.today) and m.day<b.today-${windows.recentDays}::int where m.metric='expense_fixed' ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day>=date_trunc('month',b.today)-${windows.closedMonths}*interval '1 month' and m.day<b.today-${windows.recentDays}::int where m.metric='expense_variable' ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day>=b.today-${revenueDays}::int and m.day<b.today-${windows.recentDays}::int where m.metric='revenue' ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day<b.today-${windows.recentDays}::int where m.metric in ('visits','promo_discount','promo_sales','promo_cost') ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day>=b.today-${windows.anomalyDays}::int and m.day<b.today-${windows.recentDays}::int where m.metric='voided_tickets' ${location}
      union all select m.* from b join same_days sd on true join analytics.daily_metric m on m.business_id=b.id and m.day=sd.day where m.day<b.today-${windows.recentDays}::int and m.metric='units_sold' ${location}
      union all select m.* from b join same_days sd on true join analytics.daily_metric m on m.business_id=b.id and m.day=sd.day where m.day<b.today-${revenueDays}::int and m.metric='revenue' ${location}),
    metrics as (select m.day::text,m.metric,case when m.day=b.today-1 or m.metric in ('stock_consumption','units_sold','revenue','voided_tickets','visits','promo_discount','promo_sales','promo_cost') then m.location_id else null end as "locationId",m.dimension_id as "dimensionId",sum(m.amount_minor)::text as "amountMinor",m.currency_code as "currencyCode",m.minor_unit as "minorUnit",sum(m.quantity)::text as quantity,sum(m.count)::int as count
      from metric_rows m,b group by m.day,m.metric,case when m.day=b.today-1 or m.metric in ('stock_consumption','units_sold','revenue','voided_tickets','visits','promo_discount','promo_sales','promo_cost') then m.location_id else null end,m.dimension_id,m.currency_code,m.minor_unit
      union all select day::text,'expense_fixed',null,dimension_id,amount,currency_code,minor_unit,'0',0 from fixed_months where rank<=${windows.closedMonths})
    select b.currency_code as "currencyCode",b.timezone,b.today::text,${JSON.stringify(windows)}::jsonb as "readWindows",
      (select min(day)::text from account_money where metric='revenue' and (count>0 or amount_minor>0)) as "firstSaleDay",
      coalesce((select jsonb_agg(jsonb_build_object('locationId',location_id,'day',day)) from (select location_id,min(day)::text AS day from account_money where metric='revenue' and (count>0 or amount_minor>0) group by location_id) first_sales),'[]'::jsonb) as "firstSaleDays",
      coalesce((select jsonb_agg(c) from (select campaign_id as "campaignId",label,status,(starts_at at time zone b.timezone)::date::text as "startsAt",(ends_at at time zone b.timezone)::date::text as "endsAt",(ended_at at time zone b.timezone)::date::text as "endedAt",captured_at as "capturedAt",event_id as "eventId",least(ends_at,ended_at) as "finishOccurredAt",(select source_key from analytics.source_revision r where r.business_id=b.id and r.source_key='campaign.snapshot:'||event_id::text) as "sourceKey",(select source_revision from analytics.source_revision r where r.business_id=b.id and r.source_key='campaign.snapshot:'||event_id::text) as "sourceRevision" from analytics.campaign_snapshot where business_id=b.id) c),'[]'::jsonb) as campaigns,
      exists(select 1 from analytics.daily_metric m where m.business_id=b.id ${location}) as "hasData",
      exists(select 1 from account_money where metric in ('expense_fixed','expense_variable') and day<date_trunc('month',b.today) and amount_minor>0) as "hasClosedExpenseMonth",
      coalesce((select jsonb_agg(jsonb_build_array(metric,"locationId","dimensionId","currencyCode","minorUnit",days)) from
        (select metric,"locationId","dimensionId","currencyCode","minorUnit",jsonb_agg(jsonb_build_array(ordinal,day,"amountMinor",quantity,count)) days
          from (select row_number() over () ordinal,metrics.* from metrics) numbered_metrics group by metric,"locationId","dimensionId","currencyCode","minorUnit") grouped_metrics),'[]'::jsonb) as "metricGroups",
      coalesce((select jsonb_agg(jsonb_build_object('locationId',location_id,'itemId',dimension_id,'day',day)) from (select m.location_id,m.dimension_id,min(m.day)::text AS day from analytics.daily_metric m where m.business_id=b.id and m.metric='stock_consumption' and m.quantity>0 group by m.location_id,m.dimension_id) first_days),'[]'::jsonb) as "firstConsumptionDays",
      coalesce((select jsonb_agg(g) from (select distinct on (metric,location_id,dimension_id) day::text,metric,location_id as "locationId",dimension_id as "dimensionId",amount_minor::text as "amountMinor",quantity::text,currency_code as "currencyCode",minor_unit as "minorUnit",unit,observed_at as "observedAt",event_id as "eventId" from analytics.daily_gauge where business_id=b.id and day<=b.today order by metric,location_id,dimension_id,observed_at desc,event_id desc) g),'[]'::jsonb) as gauges,
      coalesce((select jsonb_agg(c) from (select distinct on (card_key,subject_key) card_key as "cardKey",subject_key as "subjectKey",parameters,amount_minor::text as "amountMinor",currency_code as "currencyCode",minor_unit as "minorUnit",fingerprint,weight::text,location_id as "locationId" from analytics.card_candidate where business_id=b.id and ${factFilter} and day<=b.today order by card_key,subject_key,parameters->>'originObservedAt' desc,day desc) c),'[]'::jsonb) as "factCards",
      coalesce((select jsonb_agg(jsonb_build_object('cardKey',card_key,'subjectKey',subject_key,'fingerprint',fingerprint,'status',status,'shownDays',shown_days,'lastShownDay',last_shown_day,'candidateId',candidate_id,'contextVersion',context_version,'context',context,'episodeStartedAt',episode_started_at,'expiresAt',expires_at,'remindAt',remind_at,'revision',revision,'decidedAt',decided_at)) from analytics.card_state where business_id=b.id),'[]'::jsonb) as states,
      coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'label',label)) from analytics.dimension_label where business_id=b.id),'[]'::jsonb) as labels,
      coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from core.location where business_id=b.id),'[]'::jsonb) as locations from b`;
}
/** Repeated series headers travel once; every day/value tuple stays distinct.
 * Accept the prior flat representation for existing callers and recorded snapshots.
 */
function metricTuples(row: Record<string, unknown>): unknown[][] {
  if (!("metricGroups" in row)) {
    if (Array.isArray(row.metrics)) return row.metrics as unknown[][];
    throw new AnalyticsError(
      422,
      "invalid_snapshot",
      "El resumen está incompleto.",
    );
  }
  if (!Array.isArray(row.metricGroups))
    throw new AnalyticsError(
      422,
      "invalid_snapshot",
      "El resumen está incompleto.",
    );
  const tuples: unknown[][] = [];
  let length = 0;
  for (const group of row.metricGroups as unknown[]) {
    if (!Array.isArray(group) || group.length !== 6 || !Array.isArray(group[5]))
      throw new AnalyticsError(
        422,
        "invalid_snapshot",
        "El resumen está incompleto.",
      );
    const [metric, locationId, dimensionId, currencyCode, minorUnit, days] =
      group;
    for (const day of days as unknown[]) {
      if (
        !Array.isArray(day) ||
        day.length !== 5 ||
        !Number.isSafeInteger(Number(day[0])) ||
        Number(day[0]) < 1 ||
        tuples[Number(day[0]) - 1]
      )
        throw new AnalyticsError(
          422,
          "invalid_snapshot",
          "El resumen está incompleto.",
        );
      tuples[Number(day[0]) - 1] = [
        day[1],
        metric,
        locationId,
        dimensionId,
        day[2],
        currencyCode,
        minorUnit,
        day[3],
        day[4],
      ];
      length++;
    }
  }
  if (tuples.length !== length)
    throw new AnalyticsError(
      422,
      "invalid_snapshot",
      "El resumen está incompleto.",
    );
  return tuples;
}
export function inputFromRow(
  row: Record<string, unknown> | undefined,
): AnalyticsInput & {
  states: CardState[];
  factCards: CardCandidate[];
  timezone: string;
} {
  if (!row)
    throw new AnalyticsError(
      404,
      "business_not_found",
      "No encontramos el negocio.",
    );
  const currencyCode = String(row.currencyCode);
  return {
    states: row.states as CardState[],
    timezone: String(row.timezone),
    readWindows: row.readWindows as AnalyticsInput["readWindows"],
    gauges: (row.gauges ?? []) as AnalyticsGauge[],
    firstConsumptionDays: (row.firstConsumptionDays ??
      []) as AnalyticsInput["firstConsumptionDays"],
    factCards: ((row.factCards ?? []) as Record<string, unknown>[]).map(
      (c) => ({
        ...(c.parameters as CardCandidate),
        cardKey: String(c.cardKey) as CardCandidate["cardKey"],
        subjectKey: String(c.subjectKey),
        amountMinor:
          c.amountMinor === null ? null : safeMoney(String(c.amountMinor)),
        currencyCode: String(c.currencyCode),
        minorUnit: Number(c.minorUnit),
        fingerprint: String(c.fingerprint),
        weight: Number(c.weight),
        locationId: c.locationId ? String(c.locationId) : null,
      }),
    ),
    campaigns: (row.campaigns ?? []) as AnalyticsInput["campaigns"],
    firstSaleDays: (row.firstSaleDays ?? []) as AnalyticsInput["firstSaleDays"],
    today: String(row.today),
    firstSaleDay: row.firstSaleDay ? String(row.firstSaleDay) : null,
    currencyCode,
    minorUnit: minorUnitForCurrency(currencyCode),
    hasData: Boolean(row.hasData),
    hasClosedExpenseMonth: Boolean(row.hasClosedExpenseMonth),
    locations: row.locations as AnalyticsInput["locations"],
    labels: row.labels as AnalyticsInput["labels"],
    metrics: metricTuples(row).map(
      ([
        day,
        metric,
        locationId,
        dimensionId,
        amountMinor,
        currencyCode,
        minorUnit,
        quantity,
        count,
      ]) =>
        metricRow({
          day,
          metric,
          locationId,
          dimensionId,
          amountMinor,
          currencyCode,
          minorUnit,
          quantity,
          count,
        }),
    ),
  };
}
export async function readInput(
  businessId: string,
  now = new Date(),
  db: DbTransaction | ReturnType<typeof getDb> = getDb(),
  locationId?: string,
  policy: AnalyticsPolicy = ANALYTICS_POLICY,
) {
  const result = await db.execute(
    inputStatement(businessId, now, locationId, policy),
  );
  return inputFromRow(result.rows[0]);
}
export function assertLocation(input: AnalyticsInput, locationId?: string) {
  if (locationId && !input.locations.some((l) => l.id === locationId))
    throw new AnalyticsError(
      404,
      "location_not_found",
      "No encontramos ese local.",
    );
}
export async function readHistory(
  businessId: string,
  period: HistoryPeriod,
  locationId?: string,
  now = new Date(),
) {
  const input = await readInput(businessId, now, getDb(), locationId);
  assertLocation(input, locationId);
  const range = historyRange(input.today, period);
  const location = locationId ? sql`and location_id=${locationId}` : sql``;
  const result = await getDb().execute(sql`with bucketed as (
    select m.*,w.bucket from analytics.daily_metric m cross join lateral (values
      ('current',${range.from}::date,${range.to}::date),('previous',${range.previousFrom}::date,${range.previousTo}::date),('annual',${range.annualFrom}::date,${range.annualTo}::date)) w(bucket,start_day,end_day)
    where business_id=${businessId} and day>=${range.annualFrom}::date and day<=${range.to}::date and day between w.start_day and w.end_day ${location})
    select bucket,metric,dimension_id as "dimensionId",sum(amount_minor)::text as "amountMinor",sum(quantity)::text as quantity,sum(count)::int as count,currency_code as "currencyCode",minor_unit as "minorUnit",(select count(distinct day)::int from bucketed where bucket='annual') as "annualDays" from bucketed group by bucket,metric,dimension_id,currency_code,minor_unit`);
  const rows = result.rows;
  const summary = (bucket: string) =>
    summarizeHistory(
      input,
      rows
        .filter((r) => r.bucket === bucket)
        .map((r) => metricRow({ ...r, day: input.today })),
    );
  const stockRows = await getDb().execute(
    sql`select day::text,metric,location_id as "locationId",dimension_id as "dimensionId",amount_minor::text as "amountMinor",quantity::text,currency_code as "currencyCode",minor_unit as "minorUnit",unit,observed_at as "observedAt",event_id as "eventId" from analytics.daily_gauge where business_id=${businessId} and day<=${range.to}::date ${location}`,
  );
  const stock = summarizeStockHistory(
    { ...input, gauges: stockRows.rows as AnalyticsGauge[] },
    range.from,
    range.to,
    locationId,
  );
  const customerPromoRows = await getDb().execute(
    sql`select day::text,metric,location_id as "locationId",dimension_id as "dimensionId",amount_minor::text as "amountMinor",quantity,count,currency_code as "currencyCode",minor_unit as "minorUnit" from analytics.daily_metric where business_id=${businessId} and day<=${range.to}::date and metric in ('visits','promo_discount','promo_sales','promo_cost') ${location}`,
  );
  const customerPromo = summarizeCustomerPromoHistory(
    { ...input, metrics: customerPromoRows.rows.map(metricRow) },
    range.from,
    range.to,
    locationId,
  );
  const current = summary("current");
  const previous = summary("previous");
  return {
    period,
    ...range,
    locationId: locationId ?? null,
    currencyCode: input.currencyCode,
    minorUnit: input.minorUnit,
    ...current,
    stock,
    ...customerPromo,
    previous: {
      revenueMinor: previous.revenueMinor,
      variation:
        previous.revenueMinor > 0
          ? (current.revenueMinor - previous.revenueMinor) /
            previous.revenueMinor
          : null,
    },
    annual:
      Number(rows[0]?.annualDays ?? 0) ===
      daysBetween(range.annualFrom, range.annualTo) + 1
        ? summary("annual")
        : null,
    goal: calculateGoal(input),
    locations: input.locations,
  };
}
export async function readDay(
  businessId: string,
  day: string,
  locationId?: string,
  now = new Date(),
) {
  const input = await readInput(businessId, now);
  assertLocation(input, locationId);
  const location = locationId ? sql`and location_id=${locationId}` : sql``;
  const rows = await getDb().execute(
    sql`select day::text,metric,location_id as "locationId",dimension_id as "dimensionId",amount_minor::text as "amountMinor",quantity,count,currency_code as "currencyCode",minor_unit as "minorUnit" from analytics.daily_metric where business_id=${businessId} and day=${day}::date ${location}`,
  );
  return buildDay(
    { ...input, metrics: rows.rows.map(metricRow) },
    day,
    locationId,
  );
}
export { localDay, addDays };
