import {
  boolean,
  check,
  integer,
  numeric,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses, locations } from "./business";

/** Owner-managed, free-form product category, scoped to a business. */
export const productCategories = core.table(
  "product_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // No duplicate categories per business, case-insensitive.
    uniqueIndex("core_product_category_name_unique").on(
      table.businessId,
      sql`lower(${table.name})`,
    ),
  ],
);

/** A product the business sells. Price/cost optional; the loyalty value lives in the program. */
export const products = core.table(
  "product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => productCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
    /** Internal R2 prefix. NEVER serialized to the client. */
    imageObjectKey: text("image_object_key"),
    imageVersion: integer("image_version").notNull().default(0),
    /** Stock-photo attribution (spec 0035); null when the owner uploaded their own file. */
    imageSource: text("image_source"),
    imageAuthor: text("image_author"),
    imageAuthorUrl: text("image_author_url"),
    imageSourceUrl: text("image_source_url"),
    availableAllLocations: boolean("available_all_locations")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "product_unit_price_check",
      sql`${table.unitPrice} is null or ${table.unitPrice} >= 0`,
    ),
    check(
      "product_unit_cost_check",
      sql`${table.unitCost} is null or ${table.unitCost} >= 0`,
    ),
    check("product_image_version_check", sql`${table.imageVersion} >= 0`),
  ],
);

/** Per-location visibility, only present when available_all_locations = false. */
export const productLocations = core.table(
  "product_location",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.productId, table.locationId] })],
);

/** A short-lived, private object uploaded before the owner confirms Save. */
export const productAssetUploads = core.table(
  "product_asset_upload",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_product_asset_upload_object_key_unique").on(
      table.objectKey,
    ),
  ],
);

/** Durable retry queue: failures cleaning obsolete private R2 prefixes never break a saved product. */
export const productAssetCleanups = core.table(
  "product_asset_cleanup",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    objectPrefix: text("object_prefix").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    notBefore: timestamp("not_before", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_product_asset_cleanup_prefix_unique").on(
      table.objectPrefix,
    ),
  ],
);
