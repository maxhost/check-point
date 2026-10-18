import { getDb } from "@mi-pasaporte/db";
import { sql } from "drizzle-orm";
import { safeInteger } from "@mi-pasaporte/domain/analytics/money";
import type { RecentMovement } from "@mi-pasaporte/domain/analytics/history";

type Context = { today: string; currencyCode: string; minorUnit: number };
/** Current source contributions are individual operations, not daily aggregates. */
export function recentMovementsStatement(
  businessId: string,
  context: Context,
  locationId?: string,
) {
  const location = locationId ? sql`and c.location_id=${locationId}` : sql``;
  return sql`select md5(c.source_key||':'||c.metric||':'||coalesce(c.location_id::text,'')||':'||c.day::text) as id,
    c.day::text as date,case when c.metric='revenue' then 'sale' else 'expense' end as kind,
    case when c.metric='revenue' then 'Venta registrada' else coalesce(max(l.label),'Gasto registrado') end as label,
    sum(c.amount_minor)::text as "amountMinor"
    from analytics.metric_contribution c
    left join analytics.dimension_label l on l.business_id=c.business_id and l.kind=c.dimension_kind and l.id=c.dimension_id
    where c.business_id=${businessId} and c.day between date_trunc('month',${context.today}::date)::date and ${context.today}::date
      and c.metric in ('revenue','expense_fixed','expense_variable')
      and c.currency_code=${context.currencyCode} and c.minor_unit=${context.minorUnit} ${location}
    group by c.source_key,c.day,c.location_id,c.metric
    order by c.day desc,c.source_key desc,c.metric,c.location_id nulls last limit 4`;
}
export function recentMovementFromRow(
  row: Record<string, unknown>,
): RecentMovement {
  if (row.kind !== "sale" && row.kind !== "expense")
    throw new Error("Invalid movement kind");
  return {
    id: String(row.id),
    date: String(row.date),
    kind: row.kind,
    label: String(row.label),
    amountMinor: safeInteger(BigInt(String(row.amountMinor))),
  };
}
export async function readRecentMovements(
  businessId: string,
  context: Context,
  locationId?: string,
  db = getDb(),
) {
  const result = await db.execute(
    recentMovementsStatement(businessId, context, locationId),
  );
  return result.rows.map(recentMovementFromRow);
}
