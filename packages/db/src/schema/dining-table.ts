import {
  check,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { businesses, locations } from "./business";

/**
 * Spec 0182 / ADR 0131 — UNA MESA DE UN LOCAL. Nunca se borra: se archiva, como el local, para
 * que ninguna orden del POS (ni una reserva futura) quede apuntando a algo que no existe.
 *
 * - `name`: unico sin mayusculas entre las ACTIVAS del mismo local (una archivada no bloquea).
 * - `seats`: opcional (owner 2026-10-08: una «Barra» sin plazas).
 * - La ocupacion NO vive aca: es el unico parcial de `pos_order (dining_table_id) WHERE open`.
 */
export const diningTables = core.table(
  "dining_table",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    seats: integer("seats"),
    sortOrder: integer("sort_order").notNull().default(0),
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
      "core_dining_table_name_check",
      sql`char_length(${table.name}) between 1 and 60`,
    ),
    check(
      "core_dining_table_seats_check",
      sql`${table.seats} is null or ${table.seats} between 1 and 99`,
    ),
    check(
      "core_dining_table_status_check",
      sql`${table.status} in ('active', 'archived')`,
    ),
    uniqueIndex("core_dining_table_active_name_unique")
      .on(table.locationId, sql`lower(${table.name})`)
      .where(sql`${table.status} = 'active'`),
    index("core_dining_table_location_idx").on(
      table.locationId,
      table.status,
      table.sortOrder,
    ),
  ],
);
