CREATE TABLE "analytics"."daily_gauge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid,
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"dimension_kind" text NOT NULL,
	"dimension_id" uuid,
	"amount_minor" numeric DEFAULT '0' NOT NULL,
	"quantity" numeric DEFAULT '0' NOT NULL,
	"currency_code" text DEFAULT '' NOT NULL,
	"minor_unit" integer DEFAULT 0 NOT NULL,
	"unit" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"event_id" uuid NOT NULL,
	CONSTRAINT "analytics_daily_gauge_unique" UNIQUE NULLS NOT DISTINCT("business_id","location_id","day","metric","dimension_kind","dimension_id")
);
--> statement-breakpoint
ALTER TABLE "analytics"."daily_gauge" ADD CONSTRAINT "daily_gauge_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_daily_gauge_day_idx" ON "analytics"."daily_gauge" USING btree ("business_id","day");