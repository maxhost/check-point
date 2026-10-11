import { randomUUID } from "node:crypto";
import { type SQL, sql } from "drizzle-orm";
import { getDb, withDbTransaction } from "@mi-pasaporte/db";
import { businessHasAccessSql } from "../billing-access";
import { rowsOf } from "../counter/core";
import { buildExpiryBody } from "../wallet/push-text";
import { zonedDateTimeToUtc } from "./time";
import {
  type ExpiryMonths,
  type NoticeDays,
  expiresOn,
  localDate,
  noticeDue,
  shouldExpire,
} from "./balance-expiry";

/**
 * THE NIGHTLY BALANCE-EXPIRY SWEEP (spec 0195 §D4 / ADR 0136), run by the existing cron
 * `/api/internal/loyalty-expiry` after `expireClosingPrograms`. Two phases over the same
 * candidates: EXPIRE what is due (each in its own transaction, re-reading under the
 * membership lock) and then NOTICE what is coming. Expiring first is not what keeps a late
 * notice fair — `shouldExpire` demands a `0` notice issued on an EARLIER day — but it keeps
 * a membership that just expired from also getting a notice in the same run.
 */

/** The hour (local to the business) at which an expiry notice may ring. */
export const NOTICE_LOCAL_TIME = "10:00";

export type ExpiryCandidate = {
  membershipId: string;
  consumerId: string;
  businessId: string;
  businessName: string;
  timezone: string;
  programId: string;
  kind: "points" | "stamps";
  months: ExpiryMonths;
  since: Date;
  balance: number;
  enrolledAt: Date;
  lastVisitAt: Date | null;
};

const asDate = (value: unknown) => new Date(String(value));
const asDateOrNull = (value: unknown) =>
  value === null || value === undefined ? null : asDate(value);

/**
 * Memberships with a balance in an ACTIVE program with the rule on, of an active business
 * WITH access (ADR 0134): a blocked business gets neither notices nor expirations (§6).
 * Raw SQL with explicit aliases (gotchas: correlated subqueries).
 */
export async function collectCandidates(
  now: Date,
  scope: SweepScope = {},
): Promise<ExpiryCandidate[]> {
  const inScope = scope.businessIds
    ? sql`AND m.business_id IN (${sql.join(
        scope.businessIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`
    : sql``;
  const result = await getDb().execute(sql`
    SELECT m.id AS membership_id, m.consumer_id, m.business_id, b.name AS business_name,
           b.timezone, p.id AS program_id, p.kind, p.balance_expiry_months AS months,
           p.balance_expiry_since AS since,
           (CASE WHEN p.kind = 'points' THEN m.points_balance ELSE m.stamps_count END)::int
             AS balance,
           m.enrolled_at, bc.last_visit_at
    FROM consumer.program_membership m
    JOIN core.loyalty_program p ON p.id = m.program_id
    JOIN core.business b ON b.id = m.business_id
    LEFT JOIN core.business_customer bc
      ON bc.business_id = m.business_id AND bc.consumer_id = m.consumer_id
    WHERE p.status = 'active'
      AND p.balance_expiry_months IS NOT NULL
      AND p.kind IN ('points', 'stamps')
      AND b.status = 'active'
      AND ${businessHasAccessSql(sql`b.id`, now)}
      AND (CASE WHEN p.kind = 'points' THEN m.points_balance ELSE m.stamps_count END) > 0
      ${inScope}
  `);
  return (rowsOf(result) as Record<string, unknown>[]).map((row) => ({
    membershipId: String(row.membership_id),
    consumerId: String(row.consumer_id),
    businessId: String(row.business_id),
    businessName: String(row.business_name),
    timezone: String(row.timezone),
    programId: String(row.program_id),
    kind: row.kind as "points" | "stamps",
    months: Number(row.months) as ExpiryMonths,
    since: asDate(row.since),
    balance: Number(row.balance),
    enrolledAt: asDate(row.enrolled_at),
    lastVisitAt: asDateOrNull(row.last_visit_at),
  }));
}

/** Limits a sweep to some businesses: the integration suites run in parallel on one branch,
 * and an unscoped sweep would touch the memberships of another file. Production: unscoped. */
export type SweepScope = { businessIds?: string[] };

type SentNotice = { daysBefore: number; issuedOn: string };

/** The notices already issued for ONE expiry date of a membership (local issue dates). */
async function sentNotices(
  executor: { execute(query: SQL): Promise<unknown> },
  membershipId: string,
  expiry: string,
  timezone: string,
): Promise<SentNotice[]> {
  const result = await executor.execute(sql`
    SELECT n.days_before, n.created_at FROM consumer.balance_expiry_notice n
    WHERE n.membership_id = ${membershipId} AND n.expires_on = ${expiry}::date
  `);
  return (rowsOf(result) as Record<string, unknown>[]).map((row) => ({
    daysBefore: Number(row.days_before),
    issuedOn: localDate(asDate(row.created_at), timezone),
  }));
}

function zeroNoticeOn(sent: SentNotice[]): string | null {
  return sent.find((notice) => notice.daysBefore === 0)?.issuedOn ?? null;
}

/**
 * Expires ONE membership if it is still due. Locks the membership row and re-reads the
 * balance, the last visit and the notices AFTER the lock (ADR 0054 §2): a purchase that
 * committed while the sweep ran moved the expiry date and nothing is lost. `persistGrant`
 * moves the balance and `business_customer.last_visit_at` in the same statement, so once
 * the lock is ours a fresh read sees both. Returns the units expired (0 = nothing).
 */
export async function expireMembership(
  candidate: ExpiryCandidate,
  now: Date,
): Promise<number> {
  return withDbTransaction(async (tx) => {
    const locked = rowsOf(
      await tx.execute(sql`
        SELECT (CASE WHEN ${candidate.kind} = 'points' THEN m.points_balance
                     ELSE m.stamps_count END)::int AS balance, m.enrolled_at
        FROM consumer.program_membership m WHERE m.id = ${candidate.membershipId}
        FOR UPDATE
      `),
    ) as Record<string, unknown>[];
    const balance = Number(locked[0]?.balance ?? 0);
    if (balance <= 0) return 0;
    const fresh = rowsOf(
      await tx.execute(sql`
        SELECT bc.last_visit_at, p.balance_expiry_months AS months,
               p.balance_expiry_since AS since
        FROM core.loyalty_program p
        LEFT JOIN core.business_customer bc
          ON bc.business_id = ${candidate.businessId} AND bc.consumer_id = ${candidate.consumerId}
        WHERE p.id = ${candidate.programId}
      `),
    ) as Record<string, unknown>[];
    const months = fresh[0]?.months;
    if (months === null || months === undefined) return 0;
    const expiry = expiresOn({
      lastVisitAt: asDateOrNull(fresh[0].last_visit_at),
      enrolledAt: asDate(locked[0].enrolled_at),
      since: asDate(fresh[0].since),
      months: Number(months) as ExpiryMonths,
      timezone: candidate.timezone,
    });
    const today = localDate(now, candidate.timezone);
    const sent = await sentNotices(
      tx,
      candidate.membershipId,
      expiry,
      candidate.timezone,
    );
    if (
      !shouldExpire({
        today,
        expiresOn: expiry,
        zeroNoticeOn: zeroNoticeOn(sent),
      })
    )
      return 0;
    const column =
      candidate.kind === "points" ? sql`points_balance` : sql`stamps_count`;
    await tx.execute(sql`
      UPDATE consumer.program_membership SET ${column} = 0
      WHERE id = ${candidate.membershipId}
    `);
    await tx.execute(sql`
      INSERT INTO core.balance_expiration
        (business_id, program_id, membership_id, consumer_id, accrual_kind,
         units_expired, expires_on, last_activity_at)
      VALUES (${candidate.businessId}, ${candidate.programId}, ${candidate.membershipId},
              ${candidate.consumerId}, ${candidate.kind}, ${balance}, ${expiry}::date,
              ${(asDateOrNull(fresh[0].last_visit_at) ?? asDate(locked[0].enrolled_at)).toISOString()}::timestamptz)
      ON CONFLICT DO NOTHING
    `);
    return balance;
  });
}

/**
 * Issues the notice due today for ONE membership, if any. One statement: the notice row
 * (its primary key is the idempotency — a retry inserts nothing) and, only from what it
 * inserted, the `transactional` queue row. The queue id is chosen here so the notice can
 * point at it; the FK is checked at the end of the statement.
 */
export async function noticeMembership(
  candidate: ExpiryCandidate,
  now: Date,
): Promise<NoticeDays | null> {
  const expiry = expiresOn({ ...candidate });
  const today = localDate(now, candidate.timezone);
  const sent = await sentNotices(
    getDb(),
    candidate.membershipId,
    expiry,
    candidate.timezone,
  );
  const due = noticeDue({
    today,
    expiresOn: expiry,
    sent: sent.map((notice) => notice.daysBefore),
  });
  if (due === null) return null;
  const tenLocal =
    zonedDateTimeToUtc(`${today}T${NOTICE_LOCAL_TIME}`, candidate.timezone) ??
    now;
  const notBefore = tenLocal.getTime() > now.getTime() ? tenLocal : now;
  const queueId = randomUUID();
  const body = buildExpiryBody(candidate.balance, candidate.kind, due);
  const result = await getDb().execute(sql`
    WITH n AS (
      INSERT INTO consumer.balance_expiry_notice
        (membership_id, expires_on, days_before, queue_id, created_at)
      VALUES (${candidate.membershipId}, ${expiry}::date, ${due}, ${queueId}::uuid,
              ${now.toISOString()}::timestamptz)
      ON CONFLICT DO NOTHING
      RETURNING queue_id
    )
    INSERT INTO consumer.wallet_push_queue
      (id, consumer_id, class, title, body, status, not_before)
    SELECT n.queue_id, ${candidate.consumerId}::uuid, 'transactional', ${candidate.businessName},
           ${body}, 'pending', ${notBefore.toISOString()}::timestamptz
    FROM n
    RETURNING id
  `);
  return rowsOf(result).length > 0 ? due : null;
}

/** The whole sweep. Returns counts for the cron's log. */
export async function runBalanceExpiry(
  now: Date,
  scope: SweepScope = {},
): Promise<{ expired: number; notices: number }> {
  const candidates = await collectCandidates(now, scope);
  let expired = 0;
  let notices = 0;
  for (const candidate of candidates) {
    if ((await expireMembership(candidate, now)) > 0) {
      expired += 1;
      continue;
    }
    if ((await noticeMembership(candidate, now)) !== null) notices += 1;
  }
  return { expired, notices };
}
