import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { core } from "./_schemas";
import { businesses } from "./business";
import { consumerAccounts } from "./consumer";

/**
 * THE CUSTOMER LIST OF A BUSINESS (spec 0108 / ADR 0100): a PROJECTION, one row per
 * business × consumer, that the merchant's `GET /api/customers` reads. It exists because
 * «last visit» is stored nowhere else and computing it over the whole network does not
 * scale (ADR 0100: 940 ms without the per-business filter).
 *
 * **INVARIANT that every future feature has to keep (ADR 0100 §Consecuencias):**
 *
 * - Every path that CREATES a membership, a counter purchase or a counter redemption (reward
 *   or coupon) writes this row IN THE SAME OPERATION as its origin — same statement (CTE) or
 *   same transaction. Today: `consumer/enrollment.ts`, `counter/resolve.ts`,
 *   `counter/orders.ts`, `counter/redemptions.ts`, `counter/coupon-store.ts`, all through
 *   `server/customers/projection.ts`.
 * - Every path that EDITS a consumer's name or phone (none exists today) has to update the
 *   `display_name`, `search_name` and `phone_e164` of all of its rows.
 *
 * - `enrolled_at` is the FIRST alta in any program of the business: a later alta never moves
 *   it forward (`least`).
 * - `last_visit_at` is the latest purchase or counter redemption (`greatest`); null = never
 *   came. The welcome gift delivered on pass install is NOT a visit.
 * - `search_name` = `lower(public.unaccent(display_name))`, computed in SQL on write.
 * - `phone_e164` is a copy used ONLY to search by exact phone: it NEVER leaves in a DTO.
 *
 * Isolation (migration `0053`): RLS by `app.business_id` for the restricted role
 * `customer_reader`; the app's own role owns the table and bypasses it (the writes).
 */
export const businessCustomers = core.table(
  "business_customer",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    searchName: text("search_name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull(),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.businessId, table.consumerId] }),
    index("core_business_customer_order_idx").on(
      table.businessId,
      table.lastVisitAt.desc().nullsLast(),
      table.consumerId,
    ),
    uniqueIndex("core_business_customer_phone_unique").on(
      table.businessId,
      table.phoneE164,
    ),
    index("core_business_customer_search_idx").using(
      "gin",
      table.businessId,
      table.searchName.op("gin_trgm_ops"),
    ),
  ],
);

/**
 * HOW MANY CUSTOMERS A BUSINESS HAS (spec 0109 / ADR 0101): the `total` of the unfiltered list,
 * so it is not a `count(*)` of the whole business on every request.
 *
 * Nobody writes it from the app: a trigger `AFTER INSERT OR DELETE` on `core.business_customer`
 * (migration `0054`) adds one per NEW customer and subtracts one per deleted row, whatever
 * deletes it (an account or a business in cascade). An upsert that ends in `DO UPDATE` (a
 * purchase, a re-alta) does not fire the `INSERT` trigger, so it does not move the count.
 * `customer_reader` reads it with RLS by `app.business_id`.
 */
export const businessCustomerCounts = core.table(
  "business_customer_count",
  {
    businessId: uuid("business_id")
      .primaryKey()
      .references(() => businesses.id, { onDelete: "cascade" }),
    customers: integer("customers").notNull().default(0),
  },
  (table) => [
    check(
      "business_customer_count_customers_check",
      sql`${table.customers} >= 0`,
    ),
  ],
);
