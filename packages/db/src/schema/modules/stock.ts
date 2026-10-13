import {
  check,
  index,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "../business";

/**
 * Spec 0210 / ADR 0138 — EL MODULO STOCK, en su propio esquema Postgres. Claves foraneas solo
 * modulo → core. Ningun archivo del core importa de aca (lo vigila `modules-boundary.test.ts`).
 */
export const stockSchema = pgSchema("stock");

/** Un insumo. `unit` es la unidad base e inmutable; nunca se borra, se archiva. */
export const stockItems = stockSchema.table(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    /** Costo por unidad base de la compra mas reciente (por `occurred_at`); null = sin compras. */
    lastUnitCost: numeric("last_unit_cost", { precision: 14, scale: 6 }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "stock_item_name_check",
      sql`char_length(${table.name}) between 1 and 80`,
    ),
    check("stock_item_unit_check", sql`${table.unit} in ('g', 'ml', 'unit')`),
    check(
      "stock_item_status_check",
      sql`${table.status} in ('active', 'archived')`,
    ),
    check(
      "stock_item_last_unit_cost_check",
      sql`${table.lastUnitCost} is null or ${table.lastUnitCost} >= 0`,
    ),
    uniqueIndex("stock_item_active_name_unique")
      .on(table.businessId, sql`lower(${table.name})`)
      .where(sql`${table.status} = 'active'`),
  ],
);

/** Un movimiento: compra (suma) o ajuste por conteo (delta). El stock estimado es su suma.
 * `total_cost` de una compra es opcional (spec 0210 §Entradas: «llegaron 5 kg» sin precio suma stock y
 * no toca el costo). `entry_id` agrupa las lineas de una misma entrada (una frase del audio). */
export const stockMovements = stockSchema.table(
  "movement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => stockItems.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    totalCost: numeric("total_cost", { precision: 12, scale: 2 }),
    countedQuantity: numeric("counted_quantity", { precision: 14, scale: 3 }),
    entryId: uuid("entry_id"),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "stock_movement_kind_check",
      sql`${table.kind} in ('purchase', 'adjustment')`,
    ),
    check(
      "stock_movement_purchase_check",
      sql`${table.kind} <> 'purchase' or (${table.quantity} > 0 and (${table.totalCost} is null or ${table.totalCost} >= 0) and ${table.countedQuantity} is null)`,
    ),
    check(
      "stock_movement_adjustment_check",
      sql`${table.kind} <> 'adjustment' or (${table.totalCost} is null and ${table.countedQuantity} is not null and ${table.countedQuantity} >= 0)`,
    ),
    check(
      "stock_movement_note_check",
      sql`${table.note} is null or char_length(${table.note}) between 1 and 200`,
    ),
    index("stock_movement_item_occurred_idx").on(
      table.itemId,
      table.occurredAt,
    ),
    index("stock_movement_business_occurred_idx").on(
      table.businessId,
      table.occurredAt,
    ),
  ],
);
