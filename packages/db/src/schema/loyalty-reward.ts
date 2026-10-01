import {
  check,
  index,
  integer,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses } from "./business";
import { products } from "./catalog";
import { loyaltyPrograms } from "./loyalty";

/**
 * Redeemable rewards of a program (spec 0036): 1..N for Puntos (each with a
 * `points_cost`), exactly 1 for Sellos (no per-reward cost). Rewritten in place on
 * every save. `business_id` is denormalized for scoping/isolation, like the events.
 */
export const loyaltyRewards = core.table(
  "loyalty_reward",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    rewardType: text("reward_type").notNull(),
    // Shown name. For `catalog_product` it is a snapshot of the product name at
    // definition time, so it stays legible even if the product is edited or deleted.
    label: text("label").notNull(),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    discountPercent: integer("discount_percent"),
    pointsCost: integer("points_cost"),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "loyalty_reward_type_check",
      sql`${table.rewardType} in ('catalog_product', 'custom', 'discount')`,
    ),
    check(
      "loyalty_reward_discount_percent_check",
      sql`${table.discountPercent} IS NULL OR (${table.discountPercent} >= 1 AND ${table.discountPercent} <= 100)`,
    ),
    check(
      "loyalty_reward_points_cost_check",
      sql`${table.pointsCost} IS NULL OR ${table.pointsCost} > 0`,
    ),
    // A discount reward always carries a percent; a non-discount never does.
    check(
      "loyalty_reward_discount_pair_check",
      sql`(${table.rewardType} = 'discount') = (${table.discountPercent} IS NOT NULL)`,
    ),
    index("core_loyalty_reward_program_idx").on(
      table.programId,
      table.position,
    ),
    index("core_loyalty_reward_business_idx").on(table.businessId),
  ],
);
