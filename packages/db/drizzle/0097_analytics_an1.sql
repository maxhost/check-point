CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE TABLE "analytics"."calendar_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"scope" text NOT NULL,
	"reference" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"source" text NOT NULL,
	"source_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."city" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"region" text NOT NULL,
	"name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"latitude" numeric,
	"longitude" numeric,
	"timezone" text NOT NULL,
	"active_since" timestamp with time zone,
	"active_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "analytics"."city_zone" (
	"city_id" uuid NOT NULL,
	"zone_id" text NOT NULL,
	CONSTRAINT "city_zone_city_id_zone_id_pk" PRIMARY KEY("city_id","zone_id")
);
--> statement-breakpoint
CREATE TABLE "analytics"."weather" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"city_id" uuid NOT NULL,
	"day" date NOT NULL,
	"type" text NOT NULL,
	"maximum" numeric,
	"minimum" numeric,
	"rain_mm" numeric,
	"rain_probability" numeric,
	"condition" text,
	"source" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."zone" (
	"id" text PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."card_candidate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"card_key" text NOT NULL,
	"subject_key" text NOT NULL,
	"day" date NOT NULL,
	"weight" numeric NOT NULL,
	"amount_minor" bigint,
	"currency_code" text NOT NULL,
	"minor_unit" integer NOT NULL,
	"parameters" jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"location_id" uuid
);
--> statement-breakpoint
CREATE TABLE "analytics"."card_state" (
	"business_id" uuid NOT NULL,
	"card_key" text NOT NULL,
	"subject_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"status" text NOT NULL,
	"shown_days" integer DEFAULT 1 NOT NULL,
	"last_shown_day" date NOT NULL,
	"acted_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_state_business_id_card_key_subject_key_pk" PRIMARY KEY("business_id","card_key","subject_key")
);
--> statement-breakpoint
CREATE TABLE "analytics"."daily_metric" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid,
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"dimension_kind" text NOT NULL,
	"dimension_id" uuid,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" text DEFAULT '' NOT NULL,
	"minor_unit" integer DEFAULT 0 NOT NULL,
	"quantity" numeric DEFAULT '0' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_metric_unique" UNIQUE NULLS NOT DISTINCT("business_id","location_id","day","metric","dimension_kind","dimension_id","currency_code","minor_unit")
);
--> statement-breakpoint
CREATE TABLE "analytics"."dimension_label" (
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"id" uuid NOT NULL,
	"label" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dimension_label_business_id_kind_id_pk" PRIMARY KEY("business_id","kind","id")
);
--> statement-breakpoint
CREATE TABLE "analytics"."evaluation_run" (
	"business_id" uuid NOT NULL,
	"day" date NOT NULL,
	"status" text DEFAULT 'preparing' NOT NULL,
	"prepared_at" timestamp with time zone,
	"claimed_at" timestamp with time zone,
	CONSTRAINT "evaluation_run_business_id_day_pk" PRIMARY KEY("business_id","day")
);
--> statement-breakpoint
CREATE TABLE "analytics"."metric_contribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"source_revision" integer NOT NULL,
	"location_id" uuid,
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"dimension_kind" text NOT NULL,
	"dimension_id" uuid,
	"amount_minor" bigint DEFAULT 0 NOT NULL,
	"currency_code" text DEFAULT '' NOT NULL,
	"minor_unit" integer DEFAULT 0 NOT NULL,
	"quantity" numeric DEFAULT '0' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics"."source_revision" (
	"business_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"source_revision" integer NOT NULL,
	CONSTRAINT "source_revision_business_id_source_key_pk" PRIMARY KEY("business_id","source_key")
);
--> statement-breakpoint
ALTER TABLE "core"."location" ADD COLUMN "city_id" uuid;--> statement-breakpoint
ALTER TABLE "analytics"."city_zone" ADD CONSTRAINT "city_zone_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "analytics"."city"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."city_zone" ADD CONSTRAINT "city_zone_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "analytics"."zone"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."weather" ADD CONSTRAINT "weather_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "analytics"."city"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."card_candidate" ADD CONSTRAINT "card_candidate_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD CONSTRAINT "card_state_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."daily_metric" ADD CONSTRAINT "daily_metric_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."dimension_label" ADD CONSTRAINT "dimension_label_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."evaluation_run" ADD CONSTRAINT "evaluation_run_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."metric_contribution" ADD CONSTRAINT "metric_contribution_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics"."source_revision" ADD CONSTRAINT "source_revision_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_calendar_event_unique" ON "analytics"."calendar_event" USING btree ("day","scope","reference","type","name");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_city_key_unique" ON "analytics"."city" USING btree ("normalized_key");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_weather_unique" ON "analytics"."weather" USING btree ("city_id","day","type","source");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_card_candidate_unique" ON "analytics"."card_candidate" USING btree ("business_id","day","card_key","subject_key");--> statement-breakpoint
CREATE INDEX "analytics_daily_metric_day_idx" ON "analytics"."daily_metric" USING btree ("business_id","day");--> statement-breakpoint
CREATE INDEX "analytics_daily_metric_account_idx" ON "analytics"."daily_metric" USING btree ("business_id","metric","day","location_id","dimension_kind","dimension_id","currency_code","minor_unit","amount_minor","count") WHERE "analytics"."daily_metric"."metric" in ('revenue','expense_fixed','expense_variable');--> statement-breakpoint
CREATE INDEX "analytics_contribution_source_idx" ON "analytics"."metric_contribution" USING btree ("business_id","source_key");--> statement-breakpoint
ALTER TABLE "core"."location" ADD CONSTRAINT "location_city_id_city_id_fk" FOREIGN KEY ("city_id") REFERENCES "analytics"."city"("id") ON DELETE no action ON UPDATE no action;
