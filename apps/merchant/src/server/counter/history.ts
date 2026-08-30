import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, orders, users } from "../schema";

/** One row of the counter's day history. No qr_token / hash / session token is selected. */
export type AccreditationDTO = {
  id: string;
  createdAt: string;
  operator: string;
  consumer: string;
  accrualKind: string;
  unitsGranted: number;
};

/**
 * The accreditations (orders) of a business that fall on the current business-local day —
 * the same "wall-clock day in the business timezone" notion loyalty closing uses. Comparing
 * `(created_at AT TIME ZONE tz)::date` to `(now AT TIME ZONE tz)::date` is DST-safe and keeps
 * the whole filter inside Postgres. Newest first; joined to the operator + consumer names.
 */
export async function listTodaysAccreditations(
  businessId: string,
  timezone: string,
  now: Date,
): Promise<AccreditationDTO[]> {
  const rows = await getDb()
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      unitsGranted: orders.unitsGranted,
      accrualKind: orders.accrualKind,
      operatorName: users.name,
      operatorEmail: users.email,
      consumerFirstName: consumerAccounts.firstName,
      consumerLastName: consumerAccounts.lastName,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.createdByUserId))
    .innerJoin(consumerAccounts, eq(consumerAccounts.id, orders.consumerId))
    .where(
      and(
        eq(orders.businessId, businessId),
        sql`(${orders.createdAt} AT TIME ZONE ${timezone})::date = (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::date`,
      ),
    )
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    operator: row.operatorName?.trim() || row.operatorEmail,
    consumer: `${row.consumerFirstName} ${row.consumerLastName}`.trim(),
    accrualKind: row.accrualKind,
    unitsGranted: row.unitsGranted,
  }));
}
