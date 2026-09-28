import { type SQL, sql } from "drizzle-orm";
import { toDate } from "../marketing/driver-values";
import { CUSTOMERS_PAGE_SIZE, type CustomerQuery } from "./query";
import {
  type CustomerReader,
  type OperationalProgram,
  withCustomerReader,
} from "./reader";

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
 * its kind is neither points nor stamps. */
export function balanceOf(
  program: OperationalProgram,
  row: Record<string, unknown>,
): CustomerRow["balance"] {
  if (!program || row.program_id == null) return null;
  if (program.kind === "points")
    return { kind: "points", value: Number(row.points_balance) };
  if (program.kind === "stamps")
    return { kind: "stamps", value: Number(row.stamps_count) };
  return null;
}

/** The DTO, built by allow-list from a raw row. */
export function toCustomerRow(
  program: OperationalProgram,
  row: Record<string, unknown>,
): CustomerRow {
  return {
    name: String(row.display_name),
    enrolledAt: iso(row.enrolled_at) ?? "",
    lastVisitAt: iso(row.last_visit_at),
    balance: balanceOf(program, row),
  };
}

/** The balance join, shared by the three shapes. `business_id = $1` goes IN ADDITION to RLS. */
function balanceJoin(reader: CustomerReader, alias: SQL): SQL {
  return sql`LEFT JOIN consumer.program_membership m
    ON m.consumer_id = ${alias}.consumer_id
   AND m.program_id = ${reader.program?.id ?? null}::uuid
   AND m.business_id = ${reader.businessId}::uuid`;
}

async function listAll(reader: CustomerReader, offset: number) {
  const businessId = reader.businessId;
  // Deferred join: the keys of the page from the order index, the rows by PK.
  const rows = await reader.execute(sql`
    WITH keys AS (
      SELECT k.consumer_id, k.last_visit_at
      FROM core.business_customer k
      WHERE k.business_id = ${businessId}::uuid
      ORDER BY k.last_visit_at DESC NULLS LAST, k.consumer_id
      LIMIT ${CUSTOMERS_PAGE_SIZE} OFFSET ${offset}
    )
    SELECT c.display_name, c.enrolled_at, c.last_visit_at,
           m.program_id, m.points_balance, m.stamps_count
    FROM keys
    JOIN core.business_customer c
      ON c.business_id = ${businessId}::uuid AND c.consumer_id = keys.consumer_id
    ${balanceJoin(reader, sql`keys`)}
    ORDER BY keys.last_visit_at DESC NULLS LAST, keys.consumer_id`);
  const [counted] = await reader.execute(sql`
    SELECT count(*)::int AS total FROM core.business_customer
    WHERE business_id = ${businessId}::uuid`);
  return { rows, total: Number(counted?.total ?? 0) };
}

async function listByName(reader: CustomerReader, q: string, offset: number) {
  const rows = await reader.execute(sql`
    SELECT f.display_name, f.enrolled_at, f.last_visit_at, f.consumer_id, f.total,
           m.program_id, m.points_balance, m.stamps_count
    FROM core.search_business_customers(${q}, ${CUSTOMERS_PAGE_SIZE}, ${offset})
      WITH ORDINALITY AS f(consumer_id, display_name, enrolled_at, last_visit_at, total, ord)
    ${balanceJoin(reader, sql`f`)}
    ORDER BY f.ord`);
  // The function always returns the `total` row; `consumer_id` null = the page is empty.
  return {
    rows: rows.filter((row) => row.consumer_id != null),
    total: Number(rows[0]?.total ?? 0),
  };
}

async function listByPhone(reader: CustomerReader, phone: string) {
  const rows = await reader.execute(sql`
    SELECT c.display_name, c.enrolled_at, c.last_visit_at,
           m.program_id, m.points_balance, m.stamps_count
    FROM core.business_customer c
    ${balanceJoin(reader, sql`c`)}
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
      items: rows.map((row) => toCustomerRow(reader.program, row)),
      page: query.page,
      pageSize: CUSTOMERS_PAGE_SIZE,
      total,
      totalPages: Math.ceil(total / CUSTOMERS_PAGE_SIZE),
    };
  });
}
