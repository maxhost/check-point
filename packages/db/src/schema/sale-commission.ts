import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { core } from "./_schemas";
import { businesses, locations } from "./business";
import type { ExactAmount } from "../../../domain/src/financial/types";
export const saleCommissions = core.table(
  "sale_commission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    sourceProviderId: text("source_provider_id").notNull(),
    sourceOrderId: uuid("source_order_id").notNull(),
    locationId: uuid("location_id").notNull(),
    collectedTotal: numeric("collected_total", {
      precision: 18,
      scale: 2,
    }).notNull(),
    currencyCode: text("currency_code").notNull(),
    minorUnit: integer("minor_unit").notNull(),
    state: text("state").notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull(),
    total: numeric("total"),
    originalTotal: jsonb("original_total").$type<ExactAmount>(),
    totalNormalizationAdjustment: jsonb(
      "total_normalization_adjustment",
    ).$type<ExactAmount>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("sale_commission_source_unique").on(
      t.businessId,
      t.sourceProviderId,
      t.sourceOrderId,
    ),
    foreignKey({
      name: "sale_commission_location_fk",
      columns: [t.businessId, t.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
    check(
      "sale_commission_state_check",
      sql`${t.state} in ('completo','incompleto')`,
    ),
    check(
      "sale_commission_money_check",
      sql`${t.collectedTotal}>=0 and ${t.collectedTotal} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) and ${t.minorUnit} in (0,2) and ${t.collectedTotal}=round(${t.collectedTotal},${t.minorUnit}) and ${t.currencyCode} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

export const businessConfiguration = core.table(
  "business_configuration",
  {
    businessId: uuid("business_id")
      .primaryKey()
      .references(() => businesses.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull().default(1),
  },
  (t) => [check("business_configuration_revision_check", sql`${t.revision}>0`)],
);
