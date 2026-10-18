// Portable oracle: exact inputStatement from 5fac6608942dd2a71e4ceff0f902169311c51dec.
// Deliberate immutable legacy SQL snapshot. Project only the explicitly changed window/metadata below; compare every shared field and order.
import { expect } from "vitest";
import { addDays } from "@mi-pasaporte/domain/analytics/date";
import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { inputStatement, inputFromRow, safeMoney } from "../queries";
import {
  buildCandidates,
  calculateGoal,
} from "@mi-pasaporte/domain/analytics/cards/index";
import { carryFactCandidate } from "@mi-pasaporte/domain/analytics/cards/stock";
import { summarizeHistory } from "@mi-pasaporte/domain/analytics/history";
import { summarizeCustomerPromoHistory } from "@mi-pasaporte/domain/analytics/customer-promo-history";
function legacyInputStatement(
  businessId: string,
  now = new Date(),
  locationId?: string,
) {
  const location = locationId ? sql`and m.location_id=${locationId}` : sql``;
  return sql`with b as (select id,currency_code,timezone,(${now.toISOString()}::timestamptz at time zone timezone)::date today from core.business where id=${businessId}),
    account_money as materialized (select m.location_id,m.day,m.metric,m.dimension_kind,m.dimension_id,m.currency_code,m.minor_unit,m.amount_minor,m.count from analytics.daily_metric m,b where m.business_id=${businessId} and m.metric in ('revenue','expense_fixed','expense_variable') and m.day<=b.today ${location}),
    same_days as (select distinct m.day from account_money m,b where m.metric='revenue' and (m.count>0 or m.amount_minor>0) and m.day<b.today and extract(dow from m.day)=extract(dow from b.today) order by m.day desc limit 8),
    fixed_months as (select (max(m.day) filter(where m.amount_minor>0))::date as day,m.dimension_id,sum(m.amount_minor)::text amount,m.currency_code,m.minor_unit,
      row_number() over(partition by m.dimension_id,m.currency_code,m.minor_unit order by date_trunc('month',m.day) desc) as rank
      from account_money m,b where m.metric='expense_fixed' and m.day<date_trunc('month',b.today)
      group by date_trunc('month',m.day),m.dimension_id,m.currency_code,m.minor_unit having sum(m.amount_minor)>0),
    metric_rows as (
      select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day between b.today-28 and b.today where (m.metric<>'expense_fixed' or m.day>=date_trunc('month',b.today)) ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day>=date_trunc('month',b.today) and m.day<b.today-28 where m.metric='expense_fixed' ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day>=date_trunc('month',b.today)-interval '3 months' and m.day<b.today-28 where m.metric='expense_variable' ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day>=b.today-56 and m.day<b.today-28 where m.metric='revenue' ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day<b.today-28 where m.metric in ('visits','promo_discount','promo_sales','promo_cost') ${location}
      union all select m.* from b join analytics.daily_metric m on m.business_id=b.id and m.day between b.today-63 and b.today-29 where m.metric='voided_tickets' ${location}
      union all select m.* from b join same_days sd on true join analytics.daily_metric m on m.business_id=b.id and m.day=sd.day where m.day<b.today-28 and m.metric='units_sold' ${location}
      union all select m.* from b join same_days sd on true join analytics.daily_metric m on m.business_id=b.id and m.day=sd.day where m.day<b.today-56 and m.metric='revenue' ${location}),
    metrics as (select m.day::text,m.metric,case when m.day=b.today-1 or m.metric in ('stock_consumption','units_sold','revenue','voided_tickets','visits','promo_discount','promo_sales','promo_cost','product_revenue','cost_of_goods','revenue_with_cost','payment_commission','payment_commission_with_cost','units_with_cost') then m.location_id else null end as "locationId",m.dimension_id as "dimensionId",sum(m.amount_minor)::text as "amountMinor",m.currency_code as "currencyCode",m.minor_unit as "minorUnit",sum(m.quantity)::text as quantity,sum(m.count)::int as count
      from metric_rows m,b group by m.day,m.metric,case when m.day=b.today-1 or m.metric in ('stock_consumption','units_sold','revenue','voided_tickets','visits','promo_discount','promo_sales','promo_cost','product_revenue','cost_of_goods','revenue_with_cost','payment_commission','payment_commission_with_cost','units_with_cost') then m.location_id else null end,m.dimension_id,m.currency_code,m.minor_unit
      union all select day::text,'expense_fixed',null,dimension_id,amount,currency_code,minor_unit,'0',0 from fixed_months where rank<=3)
    select b.currency_code as "currencyCode",b.timezone,b.today::text,
      (select min(day)::text from account_money where metric='revenue' and (count>0 or amount_minor>0)) as "firstSaleDay",
      coalesce((select jsonb_agg(jsonb_build_object('locationId',location_id,'day',day)) from (select location_id,min(day)::text AS day from account_money where metric='revenue' and (count>0 or amount_minor>0) group by location_id) first_sales),'[]'::jsonb) as "firstSaleDays",
      coalesce((select jsonb_agg(c) from (select campaign_id as "campaignId",label,status,(starts_at at time zone b.timezone)::date::text as "startsAt",(ends_at at time zone b.timezone)::date::text as "endsAt",(ended_at at time zone b.timezone)::date::text as "endedAt",captured_at as "capturedAt",event_id as "eventId" from analytics.campaign_snapshot where business_id=b.id) c),'[]'::jsonb) as campaigns,
      exists(select 1 from analytics.daily_metric m where m.business_id=b.id ${location}) as "hasData",
      exists(select 1 from account_money where metric in ('expense_fixed','expense_variable') and day<date_trunc('month',b.today) and amount_minor>0) as "hasClosedExpenseMonth",
      coalesce((select jsonb_agg(jsonb_build_array(day,metric,"locationId","dimensionId","amountMinor","currencyCode","minorUnit",quantity,count)) from metrics),'[]'::jsonb) as metrics,
      coalesce((select jsonb_agg(jsonb_build_object('locationId',location_id,'itemId',dimension_id,'day',day)) from (select m.location_id,m.dimension_id,min(m.day)::text AS day from analytics.daily_metric m where m.business_id=b.id and m.metric='stock_consumption' and m.quantity>0 group by m.location_id,m.dimension_id) first_days),'[]'::jsonb) as "firstConsumptionDays",
      coalesce((select jsonb_agg(g) from (select distinct on (metric,location_id,dimension_id) day::text,metric,location_id as "locationId",dimension_id as "dimensionId",amount_minor::text as "amountMinor",quantity::text,currency_code as "currencyCode",minor_unit as "minorUnit",unit,observed_at as "observedAt",event_id as "eventId" from analytics.daily_gauge where business_id=b.id and day<=b.today order by metric,location_id,dimension_id,observed_at desc,event_id desc) g),'[]'::jsonb) as gauges,
      coalesce((select jsonb_agg(c) from (select distinct on (card_key,subject_key) card_key as "cardKey",subject_key as "subjectKey",parameters,amount_minor::text as "amountMinor",currency_code as "currencyCode",minor_unit as "minorUnit",fingerprint,weight::text,location_id as "locationId" from analytics.card_candidate where business_id=b.id and card_key in ('5','9') and day between b.today-14 and b.today order by card_key,subject_key,parameters->>'originObservedAt' desc,day desc) c),'[]'::jsonb) as "factCards",
      coalesce((select jsonb_agg(jsonb_build_object('cardKey',card_key,'subjectKey',subject_key,'fingerprint',fingerprint,'status',status,'shownDays',shown_days,'lastShownDay',last_shown_day)) from analytics.card_state where business_id=b.id),'[]'::jsonb) as states,
      coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'label',label)) from analytics.dimension_label where business_id=b.id),'[]'::jsonb) as labels,
      coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name)) from core.location where business_id=b.id),'[]'::jsonb) as locations from b`;
}

export async function assertSnapshotEquivalence(
  businessId: string,
  now: Date,
  locationId?: string,
) {
  const baselineRows = await getDb().execute(
    legacyInputStatement(businessId, now, locationId),
  );
  const compactRows = await getDb().execute(
    inputStatement(businessId, now, locationId),
  );
  const baseline = inputFromRow(baselineRows.rows[0]);
  const compact = inputFromRow(compactRows.rows[0]);
  // Lifecycle adds control/snapshot metadata; the default recent read window fixes the
  // former 28-day truncation of the already specified 45-day missing-expense rule.
  const metricKey = (r: (typeof compact.metrics)[number]) =>
    JSON.stringify([
      r.day,
      r.metric,
      r.locationId,
      r.dimensionId,
      r.currencyCode,
      r.minorUnit,
    ]);
  const legacyMetricKeys = new Set(baseline.metrics.map(metricKey));
  const extras = compact.metrics.filter(
    (r) => !legacyMetricKeys.has(metricKey(r)),
  );
  for (const extra of extras) {
    expect(
      extra.day >= addDays(compact.today, -45) &&
        extra.day < addDays(compact.today, -28),
    ).toBe(true);
    expect(
      [
        "revenue",
        "expense_fixed",
        "expense_variable",
        "visits",
        "promo_discount",
        "promo_sales",
        "promo_cost",
        "voided_tickets",
      ].includes(extra.metric),
    ).toBe(false);
  }
  const rawExtras = await getDb().execute(
    sql`select m.day::text,m.metric,case when m.metric in ('stock_consumption','units_sold','product_revenue','cost_of_goods','revenue_with_cost','payment_commission','payment_commission_with_cost','units_with_cost') then m.location_id else null end as "locationId",m.dimension_id as "dimensionId",m.currency_code as "currencyCode",m.minor_unit as "minorUnit",sum(m.amount_minor)::text as "amountMinor",sum(m.quantity)::text as quantity,sum(m.count)::text as count from analytics.daily_metric m join core.business b on b.id=m.business_id where m.business_id=${businessId} and m.day between (${now.toISOString()}::timestamptz at time zone b.timezone)::date-45 and (${now.toISOString()}::timestamptz at time zone b.timezone)::date-29 and m.metric not in ('revenue','expense_fixed','expense_variable','visits','promo_discount','promo_sales','promo_cost','voided_tickets') ${locationId ? sql`and m.location_id=${locationId}` : sql``} group by m.day,m.metric,case when m.metric in ('stock_consumption','units_sold','product_revenue','cost_of_goods','revenue_with_cost','payment_commission','payment_commission_with_cost','units_with_cost') then m.location_id else null end,m.dimension_id,m.currency_code,m.minor_unit`,
  );
  const expectedExtras = rawExtras.rows
    .map((r) => ({
      day: String(r.day),
      metric: String(r.metric),
      locationId: r.locationId ? String(r.locationId) : null,
      dimensionId: r.dimensionId ? String(r.dimensionId) : null,
      currencyCode: String(r.currencyCode),
      minorUnit: Number(r.minorUnit),
      amountMinor: safeMoney(String(r.amountMinor)),
      quantity: Number(r.quantity),
      count: safeMoney(String(r.count)),
    }))
    .filter((r) => !legacyMetricKeys.has(metricKey(r)));
  const completeBag = (rows: typeof compact.metrics) =>
    rows
      .map((r) =>
        JSON.stringify([
          r.day,
          r.metric,
          r.locationId,
          r.dimensionId,
          r.amountMinor,
          r.currencyCode,
          r.minorUnit,
          r.quantity,
          r.count,
        ]),
      )
      .sort();
  expect(completeBag(extras)).toEqual(completeBag(expectedExtras));
  expect(compact.readWindows).toEqual({
    recentDays: 45,
    closedMonths: 3,
    sameWeekdays: 8,
    anomalyDays: 63,
  });
  const legacyStates = compact.states.map((s) => ({
    cardKey: s.cardKey,
    subjectKey: s.subjectKey,
    fingerprint: s.fingerprint,
    status: s.status,
    shownDays: s.shownDays,
    lastShownDay: s.lastShownDay,
  }));
  const legacyCampaigns = compact.campaigns?.map((c) => ({
    campaignId: c.campaignId,
    label: c.label,
    status: c.status,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    endedAt: c.endedAt,
    capturedAt: c.capturedAt,
    eventId: c.eventId,
  }));
  const legacyFactKeys = new Set(
    baseline.factCards.map((c) => c.cardKey + ":" + c.subjectKey),
  );
  const projected = {
    ...compact,
    readWindows: undefined,
    metrics: compact.metrics.filter((r) => legacyMetricKeys.has(metricKey(r))),
    states: legacyStates,
    campaigns: legacyCampaigns,
    factCards: compact.factCards.filter((c) =>
      legacyFactKeys.has(c.cardKey + ":" + c.subjectKey),
    ),
  };
  for (const extra of compact.factCards.filter(
    (c) => !legacyFactKeys.has(c.cardKey + ":" + c.subjectKey),
  ))
    expect(
      (extra.originDay ?? "") < addDays(compact.today, -14) ||
        !["5", "9"].includes(extra.cardKey),
    ).toBe(true);
  expect(projected).toEqual(baseline);
  expect(buildCandidates(projected, projected.states)).toEqual(
    buildCandidates(baseline, baseline.states),
  );
  expect(
    projected.factCards.map((c) =>
      carryFactCandidate(projected, c, projected.states),
    ),
  ).toEqual(
    baseline.factCards.map((c) =>
      carryFactCandidate(baseline, c, baseline.states),
    ),
  );
  expect(calculateGoal(projected)).toEqual(calculateGoal(baseline));
  expect(summarizeHistory(projected, projected.metrics)).toEqual(
    summarizeHistory(baseline, baseline.metrics),
  );
  expect(
    summarizeCustomerPromoHistory(
      projected,
      "2025-10-01",
      compact.today,
      locationId,
    ),
  ).toEqual(
    summarizeCustomerPromoHistory(
      baseline,
      "2025-10-01",
      baseline.today,
      locationId,
    ),
  );
}
