import {
  check,
  index,
  integer,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { users } from "./auth";
import { businesses, locations } from "./business";
import { loyaltyPrograms } from "./loyalty";
import { consumerAccounts, programMemberships } from "./consumer";
import { products } from "./catalog";

/**
 * An accreditation order (spec 0030): the append-only audit record of one grant of
 * points/stamps at the counter. One order = one grant; rows are never mutated. It is
 * OWNER-facing analytics of the business (not exposed to the consumer) and carries a
 * full snapshot (total, currency, units granted, resulting balance, actor, location)
 * so editing/deleting the catalog or program later never rewrites history.
 *
 * `mode` distinguishes a detailed sale (a cart of `order_item`s) from a quick sale
 * (typed total + optional note, no items). `balance_after` traces the membership
 * balance right after this grant. Idempotency is enforced by the unique
 * `(business_id, client_request_id)`: a retried grant returns the existing order.
 */
export const orders = core.table(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").references(() => locations.id, {
      onDelete: "set null",
    }),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id),
    // Cross-schema FK to consumer.* (same direction as spec 0028's memberships).
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => programMemberships.id),
    consumerId: uuid("consumer_id")
      .notNull()
      .references(() => consumerAccounts.id),
    mode: text("mode").notNull(),
    total: numeric("total", { precision: 12, scale: 2 }).notNull(),
    currencyCode: text("currency_code").notNull(),
    note: text("note"),
    accrualKind: text("accrual_kind").notNull(),
    unitsGranted: integer("units_granted").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    clientRequestId: uuid("client_request_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check("core_order_mode_check", sql`${table.mode} in ('detailed', 'quick')`),
    check(
      "core_order_accrual_kind_check",
      sql`${table.accrualKind} in ('points', 'stamps')`,
    ),
    check("core_order_total_check", sql`${table.total} >= 0`),
    check("core_order_units_granted_check", sql`${table.unitsGranted} >= 0`),
    uniqueIndex("core_order_business_client_request_unique").on(
      table.businessId,
      table.clientRequestId,
    ),
    index("core_order_membership_idx").on(table.membershipId),
    index("core_order_business_idx").on(table.businessId, table.createdAt),
  ],
);

/**
 * A line of a detailed order (spec 0030), only for `mode='detailed'`. Snapshots the
 * product name and unit price at grant time so a later catalog edit/delete never
 * alters the recorded breakdown. `product_id` is nullable + `on delete set null`:
 * the line survives the product being deleted.
 */
export const orderItems = core.table(
  "order_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    nameSnapshot: text("name_snapshot").notNull(),
    unitPriceSnapshot: numeric("unit_price_snapshot", {
      precision: 12,
      scale: 2,
    }).notNull(),
    quantity: integer("quantity").notNull(),
    lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
  },
  (table) => [
    check("core_order_item_quantity_check", sql`${table.quantity} > 0`),
    index("core_order_item_order_idx").on(table.orderId),
  ],
);
