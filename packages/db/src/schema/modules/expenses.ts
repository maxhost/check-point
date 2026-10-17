import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses, locations } from "../business";
import { users } from "../auth";

export const expensesSchema = pgSchema("expenses");
export const expenseConcepts = expensesSchema.table(
  "concept",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("expense_concept_identity_unique").on(
      t.businessId,
      t.category,
      t.normalizedName,
    ),
    uniqueIndex("expense_concept_tenant_category_unique").on(
      t.businessId,
      t.id,
      t.category,
    ),
    check(
      "expense_concept_category_check",
      sql`${t.category} in ('rent','gas','electricity','water','personnel','other')`,
    ),
    check(
      "expense_concept_name_check",
      sql`char_length(${t.name}) between 1 and 120 and char_length(${t.normalizedName}) between 1 and 120`,
    ),
  ],
);
export const expenses = expensesSchema.table(
  "expense",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    paidOn: date("paid_on").notNull(),
    paymentTimeZone: text("payment_time_zone").notNull(),
    amountMinor: numeric("amount_minor", { precision: 18, scale: 0 }).notNull(),
    currencyCode: text("currency_code").notNull(),
    minorUnit: integer("minor_unit").notNull(),
    category: text("category").notNull(),
    conceptId: uuid("concept_id").notNull(),
    name: text("name").notNull(),
    isFixed: boolean("is_fixed").notNull(),
    locationId: uuid("location_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revision: integer("revision").notNull().default(1),
    revisionId: uuid("revision_id").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("expense_tenant_id_unique").on(t.businessId, t.id),
    uniqueIndex("expense_revision_id_unique").on(t.revisionId),
    index("expense_register_idx").on(t.businessId, t.paidOn, t.id),
    foreignKey({
      name: "expense_concept_tenant_fk",
      columns: [t.businessId, t.conceptId, t.category],
      foreignColumns: [
        expenseConcepts.businessId,
        expenseConcepts.id,
        expenseConcepts.category,
      ],
    }),
    foreignKey({
      name: "expense_location_tenant_fk",
      columns: [t.businessId, t.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
    check(
      "expense_amount_check",
      sql`${t.amountMinor} > 0 and ${t.amountMinor} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)`,
    ),
    check(
      "expense_currency_check",
      sql`${t.currencyCode} ~ '^[A-Z]{3}$' and ${t.minorUnit} in (0,2)`,
    ),
    check(
      "expense_paid_on_check",
      sql`isfinite(${t.paidOn}) and ${t.paidOn} between '0001-01-01'::date and '9999-12-31'::date`,
    ),
    check("expense_name_check", sql`char_length(${t.name}) between 1 and 120`),
    check("expense_revision_check", sql`${t.revision} > 0`),
    check(
      "expense_timezone_check",
      sql`char_length(${t.paymentTimeZone}) between 1 and 100`,
    ),
  ],
);
/** Append-only snapshots, including the original result of every idempotent operation. */
export const expenseRevisions = expensesSchema.table(
  "expense_revision",
  {
    id: uuid("id").primaryKey(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    expenseId: uuid("expense_id").notNull(),
    revision: integer("revision").notNull(),
    operationType: text("operation_type").notNull(),
    operationId: uuid("operation_id").notNull(),
    lineIndex: integer("line_index").notNull(),
    requestDigest: text("request_digest").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => users.id),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("expense_revision_operation_unique").on(
      t.businessId,
      t.operationId,
      t.lineIndex,
    ),
    uniqueIndex("expense_revision_sequence_unique").on(
      t.businessId,
      t.expenseId,
      t.revision,
    ),
    foreignKey({
      name: "expense_revision_tenant_fk",
      columns: [t.businessId, t.expenseId],
      foreignColumns: [expenses.businessId, expenses.id],
    }).onDelete("cascade"),
    check(
      "expense_revision_operation_check",
      sql`${t.operationType} in ('recorded','updated','deleted') and ${t.lineIndex} between 0 and 29 and ${t.revision} > 0 and ${t.requestDigest} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
