import {
  check,
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "../business";
import type { createPaymentMethodTables } from "../payment-method-tables";
import type { ExactAmount } from "../../../../domain/src/financial/types";
/** Private builder. The canonical public table entry remains modules/pos.ts. */
export function createPosPaymentTables(
  schema: ReturnType<typeof pgSchema>,
  orders: { id: AnyPgColumn; businessId: AnyPgColumn },
  methods: ReturnType<typeof createPaymentMethodTables>["methods"],
) {
  const payments = schema.table(
    "order_payment",
    {
      id: uuid("id").primaryKey(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      posOrderId: uuid("pos_order_id").notNull(),
      methodId: uuid("method_id").notNull(),
      methodProviderId: text("method_provider_id").notNull().default("core"),
      position: integer("position").notNull(),
      methodName: text("method_name").notNull(),
      chargeShape: text("charge_shape").notNull(),
      amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
      originalAmount: jsonb("original_amount").$type<ExactAmount>().notNull(),
      normalizationAdjustment: jsonb("normalization_adjustment")
        .$type<ExactAmount>()
        .notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("pos_payment_business_id_unique").on(t.businessId, t.id),
      uniqueIndex("pos_payment_order_method_unique").on(
        t.businessId,
        t.posOrderId,
        t.methodId,
      ),
      uniqueIndex("pos_payment_order_position_unique").on(
        t.posOrderId,
        t.position,
      ),
      foreignKey({
        name: "pos_payment_order_fk",
        columns: [t.businessId, t.posOrderId],
        foreignColumns: [orders.businessId, orders.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "pos_payment_method_fk",
        columns: [t.businessId, t.methodId],
        foreignColumns: [methods.businessId, methods.id],
      }),
      check(
        "pos_payment_amount_check",
        sql`${t.amount}>0 and ${t.amount} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)`,
      ),
      check("pos_payment_position_check", sql`${t.position}>=0`),
      check(
        "pos_payment_shape_check",
        sql`${t.chargeShape} in ('none','percent','fixed','percent_and_fixed')`,
      ),
    ],
  );
  return { payments };
}
