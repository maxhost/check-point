import {
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { businesses } from "../business";
import { products } from "../catalog";
import {
  type createRecipeLibraryTables,
  type RecipeComponent,
  type ResolvedRecipeComponent,
} from "./recipes-library";
export function createRecipeCompositionTables(
  library: ReturnType<typeof createRecipeLibraryTables>,
) {
  const { recipeEntities, independentRecipeRevisions } = library;
  const recipesSchema = pgSchema("recipes");
  const compositionRevisions = recipesSchema.table(
    "composition_revision",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      productId: uuid("product_id").notNull(),
      productNameAtComposition: text("product_name_at_composition").notNull(),
      isCombo: boolean("is_combo").notNull(),
      recipes: jsonb("recipes").$type<RecipeComponent[]>().notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("recipes_composition_revision_business_id_unique").on(
        t.businessId,
        t.id,
      ),
      index("recipes_composition_revision_history_idx").on(
        t.businessId,
        t.productId,
        t.createdAt,
        t.id,
      ),
    ],
  );
  const recipeSaleResolutions = recipesSchema.table(
    "sale_resolution",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      productId: uuid("product_id").notNull(),
      compositionRevisionId: uuid("composition_revision_id").notNull(),
      components: jsonb("components")
        .$type<ResolvedRecipeComponent[]>()
        .notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      uniqueIndex("recipes_sale_resolution_business_id_unique").on(
        t.businessId,
        t.id,
      ),
      foreignKey({
        columns: [t.businessId, t.compositionRevisionId],
        foreignColumns: [
          compositionRevisions.businessId,
          compositionRevisions.id,
        ],
      }).onDelete("cascade"),
    ],
  );
  const productCompositions = recipesSchema.table(
    "product_composition",
    {
      productId: uuid("product_id").primaryKey(),
      businessId: uuid("business_id").notNull(),
      revisionId: uuid("revision_id").notNull(),
      resolutionId: uuid("resolution_id").notNull(),
    },
    (t) => [
      foreignKey({
        columns: [t.businessId, t.productId],
        foreignColumns: [products.businessId, products.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.businessId, t.revisionId],
        foreignColumns: [
          compositionRevisions.businessId,
          compositionRevisions.id,
        ],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.businessId, t.resolutionId],
        foreignColumns: [
          recipeSaleResolutions.businessId,
          recipeSaleResolutions.id,
        ],
      }).onDelete("cascade"),
    ],
  );
  const recipeConsumptionSources = recipesSchema.table(
    "consumption_source",
    {
      id: uuid("id").primaryKey().defaultRandom(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      eventId: uuid("event_id").notNull(),
      sourceOrderId: uuid("source_order_id").notNull(),
      sourceLineId: uuid("source_line_id").notNull(),
      locationId: uuid("location_id").notNull(),
      productId: uuid("product_id").notNull(),
      resolutionId: uuid("resolution_id").notNull(),
      compositionRevisionId: uuid("composition_revision_id").notNull(),
      recipeId: uuid("recipe_id").notNull(),
      recipeRevisionId: uuid("recipe_revision_id").notNull(),
      itemId: uuid("item_id").notNull(),
      recipeQuantity: numeric("recipe_quantity", {
        precision: 30,
        scale: 3,
      }).notNull(),
      exactQuantity: numeric("exact_quantity", {
        precision: 20,
        scale: 6,
      }).notNull(),
      allocatedQuantity: numeric("allocated_quantity", {
        precision: 14,
        scale: 3,
      }).notNull(),
    },
    (t) => [
      uniqueIndex("recipes_consumption_source_unique").on(
        t.businessId,
        t.sourceOrderId,
        t.sourceLineId,
        t.itemId,
        t.recipeRevisionId,
      ),
      foreignKey({
        columns: [t.businessId, t.resolutionId],
        foreignColumns: [
          recipeSaleResolutions.businessId,
          recipeSaleResolutions.id,
        ],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.businessId, t.compositionRevisionId],
        foreignColumns: [
          compositionRevisions.businessId,
          compositionRevisions.id,
        ],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.businessId, t.recipeRevisionId],
        foreignColumns: [
          independentRecipeRevisions.businessId,
          independentRecipeRevisions.id,
        ],
      }).onDelete("cascade"),
      check(
        "recipes_consumption_source_quantities_check",
        sql`${t.recipeQuantity}>0 and ${t.exactQuantity}>0 and ${t.allocatedQuantity}>=0 and ${t.recipeQuantity}<>'NaN'::numeric and ${t.exactQuantity}<>'NaN'::numeric and ${t.allocatedQuantity}<>'NaN'::numeric`,
      ),
    ],
  );
  const recipeMigrationMappings = recipesSchema.table(
    "migration_mapping",
    {
      productId: uuid("product_id").primaryKey(),
      businessId: uuid("business_id")
        .notNull()
        .references(() => businesses.id, { onDelete: "cascade" }),
      recipeId: uuid("recipe_id").notNull(),
      originalName: text("original_name").notNull(),
      categoryName: text("category_name"),
      assignedName: text("assigned_name").notNull(),
      reason: text("reason").notNull(),
      sourceFingerprint: text("source_fingerprint").notNull(),
    },
    (t) => [
      foreignKey({
        columns: [t.businessId, t.recipeId],
        foreignColumns: [recipeEntities.businessId, recipeEntities.id],
      }).onDelete("cascade"),
    ],
  );

  return {
    compositionRevisions,
    recipeSaleResolutions,
    productCompositions,
    recipeConsumptionSources,
    recipeMigrationMappings,
  };
}
