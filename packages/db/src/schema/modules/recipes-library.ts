import {
  check,
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
import { sql } from "drizzle-orm";
import { businesses } from "../business";
import { stockItems } from "./stock";
/** R1: legacy line/revision above remain decodable; independent identities never own products. */
export type FrozenRecipeIngredient = {
  itemId: string;
  itemName: string;
  unit: string;
  quantity: string;
};
export type RecipeComponent = {
  recipeId: string;
  quantity: string;
  position: number;
};
export type ResolvedRecipeComponent = RecipeComponent & {
  recipeRevisionId: string;
};
export function createRecipeLibraryTables() {
  const recipesSchema = pgSchema("recipes");
  const recipeEntities = recipesSchema.table(
    "recipe",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      name: text("name").notNull(),
      status: text("status").notNull().default("active"),
      revisionId: uuid("revision_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("recipes_recipe_business_id_unique").on(t.businessId, t.id),
      uniqueIndex("recipes_recipe_active_name_unique")
        .on(t.businessId, sql`lower(${t.name})`)
        .where(sql`${t.status}='active'`),
      check(
        "recipes_recipe_name_check",
        sql`${t.name}=btrim(${t.name}) and char_length(${t.name}) between 1 and 120`,
      ),
      check(
        "recipes_recipe_status_check",
        sql`${t.status} in ('active','archived')`,
      ),
    ],
  );
  const independentRecipeRevisions = recipesSchema.table(
    "recipe_revision",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      recipeId: uuid("recipe_id").notNull(),
      name: text("name").notNull(),
      lines: jsonb("lines").$type<FrozenRecipeIngredient[]>().notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("recipes_recipe_revision_business_id_unique").on(
        t.businessId,
        t.id,
      ),
      foreignKey({
        columns: [t.businessId, t.recipeId],
        foreignColumns: [recipeEntities.businessId, recipeEntities.id],
      }).onDelete("cascade"),
      index("recipes_recipe_revision_history_idx").on(
        t.businessId,
        t.recipeId,
        t.createdAt,
        t.id,
      ),
    ],
  );
  const independentRecipeLines = recipesSchema.table(
    "recipe_line",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id").notNull(),
      recipeId: uuid("recipe_id").notNull(),
      itemId: uuid("item_id").notNull(),
      quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
      position: integer("position").notNull(),
    },
    (t) => [
      foreignKey({
        columns: [t.businessId, t.recipeId],
        foreignColumns: [recipeEntities.businessId, recipeEntities.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.businessId, t.itemId],
        foreignColumns: [stockItems.businessId, stockItems.id],
      }).onDelete("no action"),
      uniqueIndex("recipes_recipe_line_item_unique").on(t.recipeId, t.itemId),
      check(
        "recipes_recipe_line_quantity_check",
        sql`${t.quantity}>0 and ${t.quantity} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)`,
      ),
    ],
  );

  return { recipeEntities, independentRecipeRevisions, independentRecipeLines };
}
