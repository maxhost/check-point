import { sql } from "drizzle-orm";
import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { analytics } from "./analytics-context";
import { businesses } from "./business";
const business = () =>
  uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" });
const values = () => ({
  amountMinor: bigint("amount_minor", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  currencyCode: text("currency_code").notNull().default(""),
  minorUnit: integer("minor_unit").notNull().default(0),
  quantity: numeric("quantity").notNull().default("0"),
  count: integer("count").notNull().default(0),
});
const dimensions = () => ({
  locationId: uuid("location_id"),
  day: date("day").notNull(),
  metric: text("metric").notNull(),
  dimensionKind: text("dimension_kind").notNull(),
  dimensionId: uuid("dimension_id"),
});
export const analyticsSourceRevisions = analytics.table(
  "source_revision",
  {
    businessId: business(),
    sourceKey: text("source_key").notNull(),
    sourceRevision: integer("source_revision").notNull(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.sourceKey] })],
);
export const analyticsMetricContributions = analytics.table(
  "metric_contribution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: business(),
    sourceKey: text("source_key").notNull(),
    sourceRevision: integer("source_revision").notNull(),
    ...dimensions(),
    ...values(),
  },
  (t) => [
    index("analytics_contribution_source_idx").on(t.businessId, t.sourceKey),
  ],
);
export const analyticsDailyMetrics = analytics.table(
  "daily_metric",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: business(),
    ...dimensions(),
    ...values(),
  },
  (t) => [
    unique("analytics_daily_metric_unique")
      .on(
        t.businessId,
        t.locationId,
        t.day,
        t.metric,
        t.dimensionKind,
        t.dimensionId,
        t.currencyCode,
        t.minorUnit,
      )
      .nullsNotDistinct(),
    index("analytics_daily_metric_day_idx").on(t.businessId, t.day),
    index("analytics_daily_metric_account_idx")
      .on(
        t.businessId,
        t.metric,
        t.day,
        t.locationId,
        t.dimensionKind,
        t.dimensionId,
        t.currencyCode,
        t.minorUnit,
        t.amountMinor,
        t.count,
      )
      .where(sql`${t.metric} in ('revenue','expense_fixed','expense_variable')`),
  ],
);
export const analyticsDimensionLabels = analytics.table(
  "dimension_label",
  {
    businessId: business(),
    kind: text("kind").notNull(),
    id: uuid("id").notNull(),
    label: text("label").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.kind, t.id] })],
);
export const analyticsEvaluationRuns = analytics.table(
  "evaluation_run",
  {
    businessId: business(),
    day: date("day").notNull(),
    status: text("status").notNull().default("preparing"),
    preparedAt: timestamp("prepared_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.day] })],
);
export const analyticsCardCandidates = analytics.table(
  "card_candidate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: business(),
    cardKey: text("card_key").notNull(),
    subjectKey: text("subject_key").notNull(),
    day: date("day").notNull(),
    weight: numeric("weight").notNull(),
    amountMinor: bigint("amount_minor", { mode: "bigint" }),
    currencyCode: text("currency_code").notNull(),
    minorUnit: integer("minor_unit").notNull(),
    parameters: jsonb("parameters").notNull(),
    fingerprint: text("fingerprint").notNull(),
    locationId: uuid("location_id"),
  },
  (t) => [
    uniqueIndex("analytics_card_candidate_unique").on(
      t.businessId,
      t.day,
      t.cardKey,
      t.subjectKey,
    ),
  ],
);
export const analyticsCardStates = analytics.table(
  "card_state",
  {
    businessId: business(),
    cardKey: text("card_key").notNull(),
    subjectKey: text("subject_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    status: text("status").notNull(),
    shownDays: integer("shown_days").notNull().default(1),
    lastShownDay: date("last_shown_day").notNull(),
    actedBy: text("acted_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.cardKey, t.subjectKey] })],
);
