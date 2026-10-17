import { sql } from "drizzle-orm";
import { withCustomerReader } from "./reader";
import { ANALYTICS_CUSTOMER_NAMESPACE } from "../counter/analytics-events";

/** GET /api/customers/analytics/:id. Session tenant + counter permission; opaque tenant id only. */
export async function readAnalyticsCustomer(
  businessId: string,
  pseudonym: string,
) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      pseudonym,
    )
  )
    return null;
  return withCustomerReader(businessId, async (reader) => {
    // The only source access is the normal customer projection under its restricted RLS role.
    const rows =
      await reader.execute(sql`select display_name,enrolled_at,last_visit_at from core.business_customer c
      cross join lateral (select public.digest(decode(replace(${ANALYTICS_CUSTOMER_NAMESPACE},'-',''),'hex') || convert_to(lower(${businessId}::text)||':'||lower(c.consumer_id::text),'UTF8'),'sha1') AS bytes) h
      cross join lateral (select encode(set_byte(set_byte(substring(h.bytes from 1 for 16),6,(get_byte(h.bytes,6)&15)|80),8,(get_byte(h.bytes,8)&63)|128),'hex') id) opaque
      where c.business_id=${businessId}::uuid and opaque.id=replace(lower(${pseudonym}),'-','') limit 1`);
    const row = rows[0];
    if (!row) return null;
    const iso = (value: unknown) =>
      value ? new Date(String(value)).toISOString() : null;
    return {
      name: String(row.display_name ?? "").trim() || "Sin nombre",
      enrolledAt: iso(row.enrolled_at),
      lastVisitAt: iso(row.last_visit_at),
    };
  });
}
