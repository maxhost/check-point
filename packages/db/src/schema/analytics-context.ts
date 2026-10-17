import {
  pgSchema,
  uuid,
  text,
  numeric,
  timestamp,
  date,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
export const analytics = pgSchema("analytics");
export const analyticsCities = analytics.table(
  "city",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    countryCode: text("country_code").notNull(),
    region: text("region").notNull(),
    name: text("name").notNull(),
    normalizedKey: text("normalized_key").notNull(),
    latitude: numeric("latitude"),
    longitude: numeric("longitude"),
    timezone: text("timezone").notNull(),
    activeSince: timestamp("active_since", { withTimezone: true }),
    activeUntil: timestamp("active_until", { withTimezone: true }),
  },
  (t) => [uniqueIndex("analytics_city_key_unique").on(t.normalizedKey)],
);
export const analyticsZones = analytics.table("zone", {
  id: text("id").primaryKey(),
  countryCode: text("country_code").notNull(),
  name: text("name").notNull(),
});
export const analyticsCityZones = analytics.table(
  "city_zone",
  {
    cityId: uuid("city_id")
      .notNull()
      .references(() => analyticsCities.id, { onDelete: "cascade" }),
    zoneId: text("zone_id")
      .notNull()
      .references(() => analyticsZones.id),
  },
  (t) => [primaryKey({ columns: [t.cityId, t.zoneId] })],
);
export const analyticsWeather = analytics.table(
  "weather",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cityId: uuid("city_id")
      .notNull()
      .references(() => analyticsCities.id),
    day: date("day").notNull(),
    type: text("type").notNull(),
    maximum: numeric("maximum"),
    minimum: numeric("minimum"),
    rainMm: numeric("rain_mm"),
    rainProbability: numeric("rain_probability"),
    condition: text("condition"),
    source: text("source").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("analytics_weather_unique").on(
      t.cityId,
      t.day,
      t.type,
      t.source,
    ),
  ],
);
export const analyticsCalendarEvents = analytics.table(
  "calendar_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    day: date("day").notNull(),
    scope: text("scope").notNull(),
    reference: text("reference").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    source: text("source").notNull(),
    sourceUrl: text("source_url").notNull(),
  },
  (t) => [
    uniqueIndex("analytics_calendar_event_unique").on(
      t.day,
      t.scope,
      t.reference,
      t.type,
      t.name,
    ),
  ],
);
