import { timestamp, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { core } from "./_schemas";
import { businesses } from "./business";
import { campaignCoupons } from "./campaign-coupon";

/**
 * THE DURABLE APPLE FILTER OF «BIENVENIDA» (spec 0107 / ADR 0099 §6): an iPhone
 * (`device_library_id`) that already received the welcome gift of THIS business never
 * receives it again — even after deleting the pass, which DELETES its
 * `wallet_push_device` row (`unregisterDevice`), or enrolling with another phone number.
 * That is why it is a table of its own and is NEVER deleted on unregister.
 *
 * Unique per (business, device): the filter is per business, so the same iPhone still
 * gets the welcome of another business. `coupon_id` is the gift that burned the device.
 */
export const welcomeDevices = core.table(
  "welcome_device",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    deviceLibraryId: text("device_library_id").notNull(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => campaignCoupons.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("core_welcome_device_business_device_unique").on(
      table.businessId,
      table.deviceLibraryId,
    ),
  ],
);
