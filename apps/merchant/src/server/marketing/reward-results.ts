import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import { CampaignError } from "./campaign-error";
import type { CouponKind } from "./reward-input";

/**
 * RESULTS BY REWARD (spec 0106 E4 / ADR 0098): the business's coupon redemptions in a date
 * range, grouped by what was handed over — `kind_snapshot` + `product_id` — across every
 * campaign. It is what the structured reward was for: comparing «2x1 en Café» between
 * campaigns instead of reading free text.
 *
 *  - The range is `[from, to]` in the BUSINESS's time zone, both days included, at most 366
 *    days: a 400 `validation` on `from`/`to` otherwise.
 *  - `incurredCost` is `sum(cost_snapshot)` — what each redemption was honoured at, never
 *    `n × current cost` (same rule as `results.coupon`), as the driver's decimal STRING.
 *  - `unitsGranted` sums only the extra stamps/points (`null` for any other kind).
 *  - `label`: the product's CURRENT name; with no product (a text reward, or a deleted one —
 *    the fk is `set null`), the `label_snapshot` of the group's most recent redemption.
 *  - Scoped by the SESSION's business: the only filter that keeps another business's
 *    redemptions out of the sums (ORACULO DE M6: `marketing-reward-results`).
 *
 * Raw SQL: `count(*)::int`, because a bare `count(*)` is a `bigint` the driver hands over as
 * a string (`gotchas-del-repo`).
 */

export type RewardResultRow = {
  kind: CouponKind;
  productId: string | null;
  label: string;
  redeemed: number;
  incurredCost: string;
  unitsGranted: number | null;
};

const DAY_MS = 86_400_000;
const MAX_DAYS = 366;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A `YYYY-MM-DD` that is a real calendar day, as its UTC midnight; `null` otherwise. */
function day(raw: unknown): number | null {
  if (typeof raw !== "string" || !DATE.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const at = Date.UTC(y, m - 1, d);
  const back = new Date(at);
  return back.getUTCFullYear() === y &&
    back.getUTCMonth() === m - 1 &&
    back.getUTCDate() === d
    ? at
    : null;
}

/** PURE. The validated range, or the 400 with its field errors. */
export function parseRewardRange(
  from: unknown,
  to: unknown,
): { from: string; to: string } {
  const start = day(from);
  const end = day(to);
  const fields: Record<string, string> = {};
  if (start === null)
    fields.from = "La fecha de inicio no es válida (AAAA-MM-DD).";
  if (end === null) fields.to = "La fecha de fin no es válida (AAAA-MM-DD).";
  if (start !== null && end !== null) {
    if (end < start)
      fields.to = "La fecha de fin no puede ser anterior a la de inicio.";
    else if ((end - start) / DAY_MS + 1 > MAX_DAYS)
      fields.to = `El rango no puede pasar de ${MAX_DAYS} días.`;
  }
  if (Object.keys(fields).length > 0)
    throw new CampaignError(
      400,
      "validation",
      "Revisá el rango de fechas.",
      fields,
    );
  return { from: from as string, to: to as string };
}

export async function loadRewardResults(
  businessId: string,
  rawFrom: unknown,
  rawTo: unknown,
): Promise<RewardResultRow[]> {
  const { from, to } = parseRewardRange(rawFrom, rawTo);
  const result = await getDb().execute<{
    kind: CouponKind;
    product_id: string | null;
    label: string;
    redeemed: number;
    incurred_cost: string;
    units_granted: number | null;
  }>(sql`
    with zone as (
      select b.timezone from core.business b where b.id = ${businessId}
    ), r as (
      select cr.id, cr.kind_snapshot, cr.product_id, cr.cost_snapshot,
        cr.units_granted, cr.label_snapshot, cr.created_at
      from core.coupon_redemption cr, zone z
      where cr.business_id = ${businessId}
        and cr.created_at >= (${from}::date)::timestamp at time zone z.timezone
        and cr.created_at < (${to}::date + 1)::timestamp at time zone z.timezone
    )
    select r.kind_snapshot as kind, r.product_id,
      count(*)::int as redeemed,
      sum(r.cost_snapshot)::text as incurred_cost,
      sum(r.units_granted)::int as units_granted,
      coalesce(p.name, (array_agg(r.label_snapshot
        order by r.created_at desc, r.id desc))[1]) as label
    from r
    left join core.product p on p.id = r.product_id
    group by r.kind_snapshot, r.product_id, p.name
    order by redeemed desc, kind asc, label asc
  `);
  return result.rows.map((row) => ({
    kind: row.kind,
    productId: row.product_id,
    label: row.label,
    redeemed: Number(row.redeemed),
    incurredCost: row.incurred_cost,
    unitsGranted: row.units_granted === null ? null : Number(row.units_granted),
  }));
}
