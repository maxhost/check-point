import {
  check,
  foreignKey,
  integer,
  jsonb,
  timestamp,
  numeric,
  pgSchema,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "../business";
import { products } from "../catalog";
import { stockItems } from "./stock";

/**
 * Spec 0210 / ADR 0138 — EL MODULO RECETAS (requiere Stock), en su propio esquema Postgres.
 * Claves foraneas modulo → core (`product`) y modulo → modulo del que depende (`stock.item`).
 * Borrar el producto borra su receta; un insumo con recetas no se puede borrar (y no se borra:
 * se archiva).
 */
export const recipesSchema = pgSchema("recipes");

export const recipeLines = recipesSchema.table(
  "line",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => stockItems.id, { onDelete: "restrict" }),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    foreignKey({
      name: "recipes_line_business_item_fk",
      columns: [table.businessId, table.itemId],
      foreignColumns: [stockItems.businessId, stockItems.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "recipes_line_business_product_fk",
      columns: [table.businessId, table.productId],
      foreignColumns: [products.businessId, products.id],
    }).onDelete("cascade"),
    check("recipes_line_quantity_check", sql`${table.quantity} > 0`),
    uniqueIndex("recipes_line_product_item_unique").on(
      table.productId,
      table.itemId,
    ),
  ],
);

/** Append-only snapshots; product identity deliberately survives product deletion. */
export const recipeRevisions = recipesSchema.table("revision", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  lines: jsonb("lines")
    .$type<{ itemId: string; unit: string; quantity: string }[]>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
