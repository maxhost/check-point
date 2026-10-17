import {
  check,
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
import { sql } from "drizzle-orm";
import { businesses } from "./business";
import type { ExactAmount } from "../../../domain/src/financial/types";
export type FrozenCommissionResult = {
  commission: string | null;
  originalCommission: ExactAmount | null;
  normalizationAdjustment: ExactAmount | null;
  configured: boolean;
  reasons: string[];
};
/** Private builder; canonical exports belong to profitability.ts. No dependency on a sale producer. */
export function createCommissionTables(schema: ReturnType<typeof pgSchema>) {
  const revisions = schema.table(
    "commission_revision",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      methodProviderId: text("method_provider_id").notNull(),
      methodId: uuid("method_id").notNull(),
      chargeShape: text("charge_shape").notNull(),
      percent: numeric("percent", { precision: 9, scale: 6 }),
      fixed: numeric("fixed", { precision: 18, scale: 2 }),
      originalFixed: jsonb("original_fixed").$type<ExactAmount>(),
      fixedNormalizationAdjustment: jsonb(
        "fixed_normalization_adjustment",
      ).$type<ExactAmount>(),
      currencyCode: text("currency_code"),
      minorUnit: integer("minor_unit"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("commission_revision_business_id_unique").on(
        t.businessId,
        t.id,
      ),
      index("commission_revision_method_idx").on(
        t.businessId,
        t.methodProviderId,
        t.methodId,
      ),
      check(
        "commission_revision_shape_check",
        sql`${t.chargeShape} in ('none','percent','fixed','percent_and_fixed')`,
      ),
      check(
        "commission_revision_percent_check",
        sql`${t.percent} is null or (${t.percent} between 0 and 100 and ${t.percent} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))`,
      ),
      check(
        "commission_revision_fixed_check",
        sql`${t.fixed} is null or (${t.fixed}>=0 and ${t.fixed} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))`,
      ),
      check(
        "commission_revision_components_check",
        sql`(${t.chargeShape} in ('percent','percent_and_fixed') or ${t.percent} is null) and (${t.chargeShape} in ('fixed','percent_and_fixed') or ${t.fixed} is null) and ((${t.fixed} is null and ${t.originalFixed} is null and ${t.fixedNormalizationAdjustment} is null and ${t.currencyCode} is null and ${t.minorUnit} is null) or (${t.fixed} is not null and ${t.originalFixed} is not null and ${t.fixedNormalizationAdjustment} is not null and ${t.currencyCode} ~ '^[A-Z]{3}$' and ${t.minorUnit} in (0,2) and ${t.fixed}=round(${t.fixed},${t.minorUnit})))`,
      ),
    ],
  );
  const snapshots = schema.table(
    "payment_commission",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      eventId: uuid("event_id").notNull(),
      paymentId: uuid("payment_id").notNull(),
      sourceOrderId: uuid("source_order_id").notNull(),
      locationId: uuid("location_id").notNull(),
      methodProviderId: text("method_provider_id").notNull(),
      methodId: uuid("method_id").notNull(),
      methodName: text("method_name").notNull(),
      chargeShape: text("charge_shape").notNull(),
      amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
      currencyCode: text("currency_code").notNull(),
      minorUnit: integer("minor_unit").notNull(),
      commissionRevisionId: uuid("commission_revision_id"),
      percent: numeric("percent", { precision: 9, scale: 6 }),
      originalFixed: jsonb("original_fixed").$type<ExactAmount>(),
      fixedCurrencyCode: text("fixed_currency_code"),
      result: jsonb("result").$type<FrozenCommissionResult>().notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("payment_commission_event_payment_unique").on(
        t.businessId,
        t.eventId,
        t.paymentId,
      ),
      index("payment_commission_sale_idx").on(
        t.businessId,
        t.locationId,
        t.sourceOrderId,
      ),
      check(
        "payment_commission_amount_check",
        sql`${t.amount}>0 and ${t.amount} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)`,
      ),
      check(
        "payment_commission_currency_check",
        sql`${t.currencyCode} ~ '^[A-Z]{3}$' and ${t.minorUnit} in (0,2) and ${t.amount}=round(${t.amount},${t.minorUnit})`,
      ),
    ],
  );
  return { revisions, snapshots };
}
