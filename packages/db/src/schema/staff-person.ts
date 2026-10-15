import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  integer,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { core } from "./_schemas";
import { businesses, locations } from "./business";
import { memberships } from "./membership";

/** Identity is independent from optional application access (SPEC0231/ADR0147). */
export const staffPersons = core.table(
  "staff_person",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    membershipUserId: text("membership_user_id"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_person_business_id_unique").on(t.businessId, t.id),
    uniqueIndex("staff_person_membership_unique").on(
      t.businessId,
      t.membershipUserId,
    ),
    foreignKey({
      name: "staff_person_membership_fk",
      columns: [t.businessId, t.membershipUserId],
      foreignColumns: [memberships.businessId, memberships.userId],
    }),
    check(
      "staff_person_name_check",
      sql`${t.name} = btrim(${t.name}) and char_length(${t.name}) between 1 and 80`,
    ),
    check("staff_person_revision_check", sql`${t.revision} > 0`),
  ],
);

export const staffLocationPeriods = core.table(
  "staff_location_period",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    personId: uuid("person_id").notNull(),
    fromMonth: date("from_month").notNull(),
    untilMonth: date("until_month"),
  },
  (t) => [
    uniqueIndex("staff_location_period_business_id_unique").on(
      t.businessId,
      t.id,
    ),
    uniqueIndex("staff_location_period_start_unique").on(
      t.businessId,
      t.personId,
      t.fromMonth,
    ),
    foreignKey({
      name: "staff_location_period_person_fk",
      columns: [t.businessId, t.personId],
      foreignColumns: [staffPersons.businessId, staffPersons.id],
    }).onDelete("cascade"),
    check(
      "staff_location_period_month_check",
      sql`extract(day from ${t.fromMonth}) = 1 and (${t.untilMonth} is null or (extract(day from ${t.untilMonth}) = 1 and ${t.untilMonth} > ${t.fromMonth}))`,
    ),
  ],
);

export const staffLocationAssignments = core.table(
  "staff_location_assignment",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").notNull(),
    locationId: uuid("location_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.businessId, t.periodId, t.locationId] }),
    foreignKey({
      name: "staff_location_assignment_period_fk",
      columns: [t.businessId, t.periodId],
      foreignColumns: [
        staffLocationPeriods.businessId,
        staffLocationPeriods.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "staff_location_assignment_location_fk",
      columns: [t.businessId, t.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
  ],
);
