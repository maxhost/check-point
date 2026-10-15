import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses, locations } from "../business";
import { staffPersons, staffLocationPeriods } from "../staff-person";

export const profitabilitySchema = pgSchema("profitability");
export const profitabilityFixedCosts = profitabilitySchema.table(
  "fixed_cost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    personId: uuid("person_id"),
    endMonth: date("end_month"),
    revision: integer("revision").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("profitability_cost_business_id_unique").on(t.businessId, t.id),
    uniqueIndex("profitability_cost_person_unique")
      .on(t.businessId, t.personId)
      .where(sql`${t.kind} = 'personnel'`),
    foreignKey({
      name: "profitability_cost_person_fk",
      columns: [t.businessId, t.personId],
      foreignColumns: [staffPersons.businessId, staffPersons.id],
    }),
    check(
      "profitability_cost_kind_check",
      sql`${t.kind} in ('rent','gas','electricity','water','other','personnel')`,
    ),
    check(
      "profitability_cost_person_check",
      sql`(${t.kind} = 'personnel') = (${t.personId} is not null)`,
    ),
    check(
      "profitability_cost_end_check",
      sql`${t.endMonth} is null or (isfinite(${t.endMonth}) and extract(day from ${t.endMonth}) = 1)`,
    ),
    check("profitability_cost_revision_check", sql`${t.revision} > 0`),
  ],
);

export const profitabilityFixedCostPeriods = profitabilitySchema.table(
  "fixed_cost_period",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    costId: uuid("cost_id").notNull(),
    fromMonth: date("from_month").notNull(),
    untilMonth: date("until_month"),
    label: text("label").notNull(),
    monthlyTotal: numeric("monthly_total", {
      precision: 18,
      scale: 2,
    }).notNull(),
    currencyCode: text("currency_code").notNull(),
    minorUnit: integer("minor_unit").notNull(),
    distribution: text("distribution").notNull(),
    staffLocationPeriodId: uuid("staff_location_period_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("profitability_period_business_id_unique").on(
      t.businessId,
      t.id,
    ),
    uniqueIndex("profitability_period_start_unique").on(
      t.businessId,
      t.costId,
      t.fromMonth,
    ),
    foreignKey({
      name: "profitability_period_cost_fk",
      columns: [t.businessId, t.costId],
      foreignColumns: [
        profitabilityFixedCosts.businessId,
        profitabilityFixedCosts.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "profitability_period_staff_location_fk",
      columns: [t.businessId, t.staffLocationPeriodId],
      foreignColumns: [
        staffLocationPeriods.businessId,
        staffLocationPeriods.id,
      ],
    }),
    check(
      "profitability_period_month_check",
      sql`isfinite(${t.fromMonth}) and extract(day from ${t.fromMonth}) = 1 and (${t.untilMonth} is null or (isfinite(${t.untilMonth}) and extract(day from ${t.untilMonth}) = 1 and ${t.untilMonth} > ${t.fromMonth}))`,
    ),
    check(
      "profitability_period_label_check",
      sql`char_length(${t.label}) between 1 and 120`,
    ),
    check(
      "profitability_period_amount_check",
      sql`${t.monthlyTotal} >= 0 and ${t.monthlyTotal} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)`,
    ),
    check(
      "profitability_period_currency_check",
      sql`${t.currencyCode} ~ '^[A-Z]{3}$' and ${t.minorUnit} in (0,2) and ${t.monthlyTotal} = round(${t.monthlyTotal}, ${t.minorUnit})`,
    ),
    check(
      "profitability_period_distribution_check",
      sql`${t.distribution} in ('single','equal','manual')`,
    ),
  ],
);

export const profitabilityFixedCostAllocations = profitabilitySchema.table(
  "fixed_cost_allocation",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    periodId: uuid("period_id").notNull(),
    locationId: uuid("location_id").notNull(),
    monthlyAmount: numeric("monthly_amount", {
      precision: 18,
      scale: 2,
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.businessId, t.periodId, t.locationId] }),
    index("profitability_allocation_local_idx").on(
      t.businessId,
      t.locationId,
      t.periodId,
    ),
    foreignKey({
      name: "profitability_allocation_period_fk",
      columns: [t.businessId, t.periodId],
      foreignColumns: [
        profitabilityFixedCostPeriods.businessId,
        profitabilityFixedCostPeriods.id,
      ],
    }).onDelete("cascade"),
    foreignKey({
      name: "profitability_allocation_location_fk",
      columns: [t.businessId, t.locationId],
      foreignColumns: [locations.businessId, locations.id],
    }),
    check(
      "profitability_allocation_amount_check",
      sql`${t.monthlyAmount} >= 0 and ${t.monthlyAmount} not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)`,
    ),
  ],
);
