import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { consumerAccounts, orders, rewardRedemptions, users } from "../schema";

/**
 * One row of the counter's day history (spec 0030, extended by spec 0055). No qr_token
 * / hash / session token is selected.
 *
 * `entryKind` distinguishes the two events of value that share the day: an
 * accreditation (`accrual`, units GRANTED) and a redemption (`redemption`, units
 * DEBITED, with the reward label snapshot). `unitsGranted` and `accrualKind` keep their
 * names so the existing console keeps rendering; a redemption fills `unitsGranted` with
 * what was debited and is the only kind that carries a `rewardLabel`.
 */
export type AccreditationDTO = {
  id: string;
  createdAt: string;
  operator: string;
  consumer: string;
  accrualKind: string;
  unitsGranted: number;
  entryKind: "accrual" | "redemption";
  rewardLabel: string | null;
};

/** The shape both queries return, before classification. */
export type DayHistoryRow = {
  id: string;
  createdAt: Date;
  units: number;
  accrualKind: string;
  rewardLabel: string | null;
  operatorName: string | null;
  operatorEmail: string;
  consumerFirstName: string;
  consumerLastName: string;
};

function toEntry(
  row: DayHistoryRow,
  entryKind: AccreditationDTO["entryKind"],
): AccreditationDTO {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    operator: row.operatorName?.trim() || row.operatorEmail,
    consumer: `${row.consumerFirstName} ${row.consumerLastName}`.trim(),
    accrualKind: row.accrualKind,
    unitsGranted: row.units,
    entryKind,
    rewardLabel: entryKind === "redemption" ? row.rewardLabel : null,
  };
}

/**
 * PURE: classifies and interleaves the day's two event streams, newest first. Kept out
 * of the queries so the classification has a unit-test oracle — the merge is where an
 * accreditation and a redemption could silently be told apart wrongly, and no static
 * sweep pins that down.
 */
export function mergeDayHistory(
  accruals: DayHistoryRow[],
  redemptions: DayHistoryRow[],
): AccreditationDTO[] {
  return [
    ...accruals.map((row) => toEntry(row, "accrual")),
    ...redemptions.map((row) => toEntry(row, "redemption")),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** `(created_at AT TIME ZONE tz)::date = (now AT TIME ZONE tz)::date` — DST-safe, and
 * keeps the whole filter inside Postgres. Same notion of "business-local day" that
 * loyalty closing uses. */
function onBusinessDay(
  column: typeof orders.createdAt | typeof rewardRedemptions.createdAt,
  timezone: string,
  now: Date,
) {
  return sql`(${column} AT TIME ZONE ${timezone})::date = (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::date`;
}

/**
 * The accreditations AND redemptions of a business that fall on the current
 * business-local day. Newest first; joined to the operator + consumer names.
 */
export async function listTodaysAccreditations(
  businessId: string,
  timezone: string,
  now: Date,
): Promise<AccreditationDTO[]> {
  const db = getDb();
  const accruals = await db
    .select({
      id: orders.id,
      createdAt: orders.createdAt,
      units: orders.unitsGranted,
      accrualKind: orders.accrualKind,
      rewardLabel: sql<string | null>`NULL`,
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
        onBusinessDay(orders.createdAt, timezone, now),
      ),
    )
    .orderBy(desc(orders.createdAt));

  const redemptions = await db
    .select({
      id: rewardRedemptions.id,
      createdAt: rewardRedemptions.createdAt,
      units: rewardRedemptions.unitsDebited,
      accrualKind: rewardRedemptions.accrualKind,
      rewardLabel: rewardRedemptions.rewardLabel,
      operatorName: users.name,
      operatorEmail: users.email,
      consumerFirstName: consumerAccounts.firstName,
      consumerLastName: consumerAccounts.lastName,
    })
    .from(rewardRedemptions)
    .innerJoin(users, eq(users.id, rewardRedemptions.createdByUserId))
    .innerJoin(
      consumerAccounts,
      eq(consumerAccounts.id, rewardRedemptions.consumerId),
    )
    .where(
      and(
        eq(rewardRedemptions.businessId, businessId),
        onBusinessDay(rewardRedemptions.createdAt, timezone, now),
      ),
    )
    .orderBy(desc(rewardRedemptions.createdAt));

  return mergeDayHistory(accruals, redemptions);
}
