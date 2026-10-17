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
} from "@mi-pasaporte/domain/analytics/types";
import {
  buildDay,
  historyRange,
  summarizeHistory,
  type HistoryPeriod,
} from "@mi-pasaporte/domain/analytics/history";
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
    count: Number(row.count),
  };
}
/** One database round-trip, summaries only. Evaluation reads 28 product days, 56 revenue days, the last eight matching weekdays and three paid fixed-expense months. */
export async function readInput(
  businessId: string,
  now = new Date(),
  db: DbTransaction | ReturnType<typeof getDb> = getDb(),
  locationId?: string,
): Promise<AnalyticsInput & { states: CardState[] }> {
  const location = locationId ? sql`and m.location_id=${locationId}` : sql``;
  const result =
    await db.execute(sql`with b as (select id,currency_code,timezone,(${now.toISOString()}::timestamptz at time zone timezone)::date today from core.business where id=${businessId}),
    same_days as (select distinct m.day from analytics.daily_metric m,b where m.business_id=b.id and m.metric='revenue' and m.amount_minor>0 ${location} and m.day<b.today and extract(dow from m.day)=extract(dow from b.today) order by m.day desc limit 8),
    fixed_months as (select (max(m.day) filter(where m.amount_minor>0))::date as day,m.dimension_id,sum(m.amount_minor)::text amount,m.currency_code,m.minor_unit,
      row_number() over(partition by m.dimension_id,m.currency_code,m.minor_unit order by date_trunc('month',m.day) desc) as rank
      from analytics.daily_metric m,b where m.business_id=b.id ${location} and m.metric='expense_fixed' and m.day<date_trunc('month',b.today)
      group by date_trunc('month',m.day),m.dimension_id,m.currency_code,m.minor_unit having sum(m.amount_minor)>0),
    metrics as (select m.day::text, m.metric, case when m.day=b.today-1 then m.location_id else null end as "locationId",m.dimension_id as "dimensionId",sum(m.amount_minor)::text as "amountMinor",m.currency_code as "currencyCode",m.minor_unit as "minorUnit",sum(m.quantity)::text as quantity,sum(m.count)::int as count
      from analytics.daily_metric m,b where m.business_id=b.id and m.day<=b.today ${location} and ((m.metric!='expense_fixed' and (m.day>=b.today-28 or (m.metric='revenue' and m.day>=b.today-56) or (m.metric='expense_variable' and m.day>=date_trunc('month',b.today)-interval '3 months') or (m.metric in ('revenue','units_sold') and m.day in(select day from same_days)))) or (m.metric='expense_fixed' and m.day>=date_trunc('month',b.today)))
      group by m.day,m.metric,case when m.day=b.today-1 then m.location_id else null end,m.dimension_id,m.currency_code,m.minor_unit
      union all select day::text,'expense_fixed',null,dimension_id,amount,currency_code,minor_unit,'0',0 from fixed_months where rank<=3)
    select b.currency_code as "currencyCode",b.timezone,b.today::text,
      (select min(day)::text from analytics.daily_metric where business_id=b.id and metric='revenue' and amount_minor>0 and day<=b.today) as "firstSaleDay",
      coalesce((select jsonb_agg(jsonb_build_array(day,metric,"locationId","dimensionId","amountMinor","currencyCode","minorUnit",quantity,count)) from metrics),'[]'::jsonb) as metrics,
      coalesce((select jsonb_agg(jsonb_build_object('cardKey',card_key,'subjectKey',subject_key,'fingerprint',fingerprint,'status',status,'shownDays',shown_days,'lastShownDay',last_shown_day)) from analytics.card_state where business_id=b.id),'[]'::jsonb) as states,
      coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'label',label)) from analytics.dimension_label where business_id=b.id),'[]'::jsonb) as labels,
      coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from core.location where business_id=b.id),'[]'::jsonb) as locations from b`);
  const row = result.rows[0];
  if (!row)
    throw new AnalyticsError(
      404,
      "business_not_found",
      "No encontramos el negocio.",
    );
  const currencyCode = String(row.currencyCode);
  return {
    states: row.states as CardState[],
    today: String(row.today),
    firstSaleDay: row.firstSaleDay ? String(row.firstSaleDay) : null,
    currencyCode,
    minorUnit:
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: currencyCode,
      }).resolvedOptions().maximumFractionDigits ?? 2,
    locations: row.locations as AnalyticsInput["locations"],
    labels: row.labels as AnalyticsInput["labels"],
    metrics: (row.metrics as unknown[][]).map(
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
  const current = summary("current");
  const previous = summary("previous");
  return {
    period,
    ...range,
    locationId: locationId ?? null,
    currencyCode: input.currencyCode,
    minorUnit: input.minorUnit,
    ...current,
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
