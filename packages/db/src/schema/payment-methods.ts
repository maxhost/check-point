import {
  boolean,
  check,
  integer,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
/** Platform metadata only. No merchant rates or module-owned references. */
export const paymentMethodCatalog = core.table(
  "payment_method_catalog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    countryCode: text("country_code"),
    name: text("name").notNull(),
    chargeShape: text("charge_shape").notNull(),
    isCash: boolean("is_cash").notNull().default(false),
    initiallySuggested: boolean("initially_suggested").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("payment_catalog_key_unique").on(t.key),
    check(
      "payment_catalog_name_check",
      sql`char_length(${t.name}) between 1 and 120`,
    ),
    check(
      "payment_catalog_country_check",
      sql`${t.countryCode} is null or ${t.countryCode} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "payment_catalog_shape_check",
      sql`${t.chargeShape} in ('none','percent','fixed','percent_and_fixed')`,
    ),
    check(
      "payment_catalog_cash_check",
      sql`not ${t.isCash} or ${t.chargeShape}='none'`,
    ),
  ],
);
