import { type SQL, sql } from "drizzle-orm";
import { toDate } from "../marketing/driver-values";
import { CUSTOMERS_PAGE_SIZE, type CustomerQuery } from "./query";
import { type CustomerReader, withCustomerReader } from "./reader";

/** One row of the list. EXACTLY these four keys: never the consumer id (two businesses could
 * cross their lists), the phone, nor any token of the account (ADR 0100). */
export type CustomerRow = {
  name: string;
  enrolledAt: string;
  lastVisitAt: string | null;
  balance: { kind: "points" | "stamps"; value: number } | null;
};

export type CustomerPage = {
  items: CustomerRow[];
  page: number;
  pageSize: typeof CUSTOMERS_PAGE_SIZE;
  total: number;
  totalPages: number;
};

// An offset past any possible total is an empty page with the real total; the clamp keeps
// it inside the `int` of the search function.
const MAX_OFFSET = 2_147_483_647;

function iso(value: unknown): string | null {
  return toDate(value)?.toISOString() ?? null;
}

/** Balance of the OPERATIONAL program: null without one, without membership in it, or when
 * its kind is neither points nor stamps. The row carries the program's `kind` (`program_kind`)
 * and the membership columns, all resolved by the same statement. */
export function balanceOf(
  row: Record<string, unknown>,
): CustomerRow["balance"] {
  if (row.program_id == null) return null;
  if (row.program_kind === "points")
    return { kind: "points", value: Number(row.points_balance) };
  if (row.program_kind === "stamps")
    return { kind: "stamps", value: Number(row.stamps_count) };
  return null;
}

/** The DTO, built by allow-list from a raw row. */
export function toCustomerRow(row: Record<string, unknown>): CustomerRow {
  return {
    name: String(row.display_name),
    enrolledAt: iso(row.enrolled_at) ?? "",
    lastVisitAt: iso(row.last_visit_at),
    balance: balanceOf(row),
  };
}

/** The operational program (at most one, `core_loyalty_program_one_operational`), read AS
 * `customer_reader` inside the same statement as the page (spec 0109). */
function programCte(businessId: string): SQL {
  return sql`program AS (
      SELECT p.id, p.kind FROM core.loyalty_program p
      WHERE p.business_id = ${businessId}::uuid AND p.status IN ('active', 'closing')
      LIMIT 1
    )`;
}

/** The balance join, shared by the three shapes: the operational program and the membership in
 * it. `business_id = $1` goes IN ADDITION to RLS (ADR 0100 §3). */
function balanceJoin(businessId: string, alias: SQL): SQL {
  return sql`LEFT JOIN program ON true
    LEFT JOIN consumer.program_membership m
      ON m.consumer_id = ${alias}.consumer_id
     AND m.program_id = program.id
     AND m.business_id = ${businessId}::uuid`;
}

const BALANCE = sql.raw(
  `m.program_id, m.points_balance, m.stamps_count, program.kind AS program_kind`,
);

/** A page, its balances and the total in ONE statement. The total comes from the count
 * (`coalesce` 0: a business without customers has no row); the one-row `t` keeps the total even
 * when the page is empty (`consumer_id` null). */
async function listAll(reader: CustomerReader, offset: number) {
  const businessId = reader.businessId;
  // Deferred join: the keys of the page from the order index, the rows by PK.
  const rows = await reader.execute(sql`
    WITH ${programCte(businessId)},
    keys AS (
      SELECT k.consumer_id, k.last_visit_at
      FROM core.business_customer k
      WHERE k.business_id = ${businessId}::uuid
      ORDER BY k.last_visit_at DESC NULLS LAST, k.consumer_id
      LIMIT ${CUSTOMERS_PAGE_SIZE} OFFSET ${offset}
    )
    SELECT c.display_name, c.enrolled_at, c.last_visit_at, keys.consumer_id, t.total,
           ${BALANCE}
    FROM (SELECT coalesce((SELECT n.customers FROM core.business_customer_count n
                           WHERE n.business_id = ${businessId}::uuid), 0) AS total) t
    LEFT JOIN keys ON true
    LEFT JOIN core.business_customer c
      ON c.business_id = ${businessId}::uuid AND c.consumer_id = keys.consumer_id
    ${balanceJoin(businessId, sql`keys`)}
    ORDER BY keys.last_visit_at DESC NULLS LAST, keys.consumer_id`);
  return {
    rows: rows.filter((row) => row.consumer_id != null),
    total: Number(rows[0]?.total ?? 0),
  };
}

async function listByName(reader: CustomerReader, q: string, offset: number) {
  const rows = await reader.execute(sql`
    WITH ${programCte(reader.businessId)}
    SELECT f.display_name, f.enrolled_at, f.last_visit_at, f.consumer_id, f.total,
           ${BALANCE}
    FROM core.search_business_customers(${q}, ${CUSTOMERS_PAGE_SIZE}, ${offset})
      WITH ORDINALITY AS f(consumer_id, display_name, enrolled_at, last_visit_at, total, ord)
    ${balanceJoin(reader.businessId, sql`f`)}
    ORDER BY f.ord`);
  // The function always returns the `total` row; `consumer_id` null = the page is empty.
  return {
    rows: rows.filter((row) => row.consumer_id != null),
    total: Number(rows[0]?.total ?? 0),
  };
}

async function listByPhone(reader: CustomerReader, phone: string) {
  const rows = await reader.execute(sql`
    WITH ${programCte(reader.businessId)}
    SELECT c.display_name, c.enrolled_at, c.last_visit_at, ${BALANCE}
    FROM core.business_customer c
    ${balanceJoin(reader.businessId, sql`c`)}
    WHERE c.business_id = ${reader.businessId}::uuid AND c.phone_e164 = ${phone}`);
  return { rows, total: rows.length };
}

/**
 * `GET /api/customers` (spec 0108): the list of THIS business, fixed order (last visit, most
 * recent first, never-came last), 25 per page, by name or by exact phone. A phone of another
 * business answers exactly like one that does not exist.
 */
export async function listCustomers(
  businessId: string,
  query: CustomerQuery,
): Promise<CustomerPage> {
  const offset = Math.min((query.page - 1) * CUSTOMERS_PAGE_SIZE, MAX_OFFSET);
  return withCustomerReader(businessId, async (reader) => {
    const { rows, total } =
      query.filter === "name"
        ? await listByName(reader, query.q, offset)
        : query.filter === "phone"
          ? query.page === 1
            ? await listByPhone(reader, query.phone)
            : { ...(await listByPhone(reader, query.phone)), rows: [] }
          : await listAll(reader, offset);
    return {
      items: rows.map(toCustomerRow),
      page: query.page,
      pageSize: CUSTOMERS_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / CUSTOMERS_PAGE_SIZE),
    };
  });
}
