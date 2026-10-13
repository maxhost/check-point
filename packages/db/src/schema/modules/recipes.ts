import {
  check,
  integer,
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
    check("recipes_line_quantity_check", sql`${table.quantity} > 0`),
    uniqueIndex("recipes_line_product_item_unique").on(
      table.productId,
      table.itemId,
    ),
  ],
);
