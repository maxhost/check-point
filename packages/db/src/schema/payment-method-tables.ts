import {
  boolean,
  check,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "./business";
import { paymentMethodCatalog } from "./payment-methods";
export function createPaymentMethodTables(schema: ReturnType<typeof pgSchema>) {
  const methods = schema.table(
    "payment_method",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      catalogId: uuid("catalog_id").references(() => paymentMethodCatalog.id),
      name: text("name").notNull(),
      chargeShape: text("charge_shape").notNull(),
      isCash: boolean("is_cash").notNull().default(false),
      status: text("status").notNull().default("active"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("pos_method_business_id_unique").on(t.businessId, t.id),
      uniqueIndex("pos_method_active_name_unique")
        .on(t.businessId, sql`lower(btrim(${t.name}))`)
        .where(sql`${t.status}='active'`),
      uniqueIndex("pos_method_cash_unique")
        .on(t.businessId)
        .where(sql`${t.isCash}`),
      uniqueIndex("pos_method_catalog_active_unique")
        .on(t.businessId, t.catalogId)
        .where(sql`${t.status}='active'`),
      check(
        "pos_method_name_check",
        sql`char_length(btrim(${t.name})) between 1 and 120`,
      ),
      check(
        "pos_method_shape_check",
        sql`${t.chargeShape} in ('none','percent','fixed','percent_and_fixed')`,
      ),
      check(
        "pos_method_status_check",
        sql`${t.status} in ('active','archived')`,
      ),
      check(
        "pos_method_cash_check",
        sql`not ${t.isCash} or (${t.status}='active' and ${t.chargeShape}='none')`,
      ),
    ],
  );
  const initializations = schema.table(
    "payment_method_initialization",
    {
      businessId: uuid("business_id")
        .primaryKey()
        .references(() => businesses.id, { onDelete: "cascade" }),
      countryCode: text("country_code").notNull(),
      source: text("source").notNull(),
      initializedAt: timestamp("initialized_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      check(
        "pos_payment_initialization_source_check",
        sql`${t.source} in ('country','base')`,
      ),
    ],
  );
  return { methods, initializations };
}
