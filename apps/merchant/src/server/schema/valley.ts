import {
  check,
  index,
  integer,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { core } from "./_schemas";
import { locations } from "./business";

/**
 * «HORAS VALLE» (spec 0113 / ADR 0105): the opening hours of a location, its valley windows
 * and the last detection that proposed them. Days are ISO (1 = Monday … 7 = Sunday), hours
 * are the business's `timezone`.
 *
 * `location_hours`: 0, 1 or 2 ranges per day (a day without rows is CLOSED). `closes <=
 * opens` is a range that ends the NEXT day (V1: a bar's 20:00–02:00 is Saturday night).
 * Steps of 30 minutes. That the two ranges of a day do not overlap is the route's rule
 * (`locations/hours-input.ts`): two rows cannot be compared in a `check`.
 *
 * `valley_window`: the hours `[start_hour, end_hour)` of ONE local day (a window never
 * crosses midnight — V2). `source = 'network'` are the detection's proposal, rewritten by
 * the tick; `'merchant'` are the business's own and win while they exist (ADR 0105 §6).
 *
 * `valley_detection`: one row per location, what the tick last concluded and with which
 * `hours_version` of the location — a different version means the hours changed.
 */
export const locationHours = core.table(
  "location_hours",
  {
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    position: smallint("position").notNull(),
    opens: time("opens").notNull(),
    closes: time("closes").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.locationId, table.weekday, table.position],
    }),
    check(
      "core_location_hours_weekday_check",
      sql`${table.weekday} between 1 and 7`,
    ),
    check(
      "core_location_hours_position_check",
      sql`${table.position} between 1 and 2`,
    ),
    check(
      "core_location_hours_step_check",
      sql`extract(minute from ${table.opens}) in (0, 30) and extract(second from ${table.opens}) = 0 and extract(minute from ${table.closes}) in (0, 30) and extract(second from ${table.closes}) = 0`,
    ),
    check(
      "core_location_hours_range_check",
      sql`${table.opens} <> ${table.closes}`,
    ),
  ],
);

export const valleyWindows = core.table(
  "valley_window",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startHour: smallint("start_hour").notNull(),
    endHour: smallint("end_hour").notNull(),
    source: text("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "core_valley_window_weekday_check",
      sql`${table.weekday} between 1 and 7`,
    ),
    check(
      "core_valley_window_hours_check",
      sql`${table.startHour} between 0 and 23 and ${table.endHour} between 1 and 24 and ${table.endHour} > ${table.startHour}`,
    ),
    check(
      "core_valley_window_source_check",
      sql`${table.source} in ('network', 'merchant')`,
    ),
    index("core_valley_window_location_idx").on(
      table.locationId,
      table.weekday,
    ),
  ],
);

export const valleyDetections = core.table(
  "valley_detection",
  {
    locationId: uuid("location_id")
      .primaryKey()
      .references(() => locations.id, { onDelete: "cascade" }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    scans: integer("scans").notNull(),
    hoursVersion: integer("hours_version").notNull(),
  },
  (table) => [
    check(
      "core_valley_detection_status_check",
      sql`${table.status} in ('proposed', 'none', 'insufficient_data')`,
    ),
    check("core_valley_detection_scans_check", sql`${table.scans} >= 0`),
  ],
);
