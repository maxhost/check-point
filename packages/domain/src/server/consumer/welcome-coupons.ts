import { sql } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";

export type WelcomeCouponSummary = {
  id: string;
  businessName: string;
  timeZone: string;
  label: string;
  rule: string | null;
  available: boolean;
  validFrom: string;
  validUntil: string;
};

type Row = {
  id: string;
  business_name: string;
  time_zone: string;
  label_snapshot: string;
  rule_snapshot: string | null;
  valid_from: Date | string;
  valid_until: Date | string;
};

/** Only issued, unredeemed welcome coupons are visible to their owner. */
export async function listWelcomeCoupons(
  consumerId: string,
): Promise<WelcomeCouponSummary[]> {
  const result = await getDb().execute<Row>(sql`
    select c.id, b.name as business_name, b.timezone as time_zone,
      c.label_snapshot, c.rule_snapshot,
      c.valid_from, c.valid_until
    from core.campaign_coupon c
    join core.business b on b.id = c.business_id
    where c.consumer_id = ${consumerId}
      and c.welcome_membership_id is not null
      and c.valid_until > now()
      and not exists (select 1 from core.coupon_redemption r where r.coupon_id = c.id)
    order by c.created_at desc, c.id desc`);
  const rows = Array.isArray(result) ? result : result.rows;
  const now = Date.now();
  return rows.map((row) => ({
    id: row.id,
    businessName: row.business_name,
    timeZone: row.time_zone,
    label: row.label_snapshot,
    rule: row.rule_snapshot,
    available: new Date(row.valid_from).getTime() <= now,
    validFrom: new Date(row.valid_from).toISOString(),
    validUntil: new Date(row.valid_until).toISOString(),
  }));
}
