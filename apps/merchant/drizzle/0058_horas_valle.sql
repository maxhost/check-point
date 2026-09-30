CREATE TABLE "core"."location_hours" (
	"location_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"position" smallint NOT NULL,
	"opens" time NOT NULL,
	"closes" time NOT NULL,
	CONSTRAINT "location_hours_location_id_weekday_position_pk" PRIMARY KEY("location_id","weekday","position"),
	CONSTRAINT "core_location_hours_weekday_check" CHECK ("core"."location_hours"."weekday" between 1 and 7),
	CONSTRAINT "core_location_hours_position_check" CHECK ("core"."location_hours"."position" between 1 and 2),
	CONSTRAINT "core_location_hours_step_check" CHECK (extract(minute from "core"."location_hours"."opens") in (0, 30) and extract(second from "core"."location_hours"."opens") = 0 and extract(minute from "core"."location_hours"."closes") in (0, 30) and extract(second from "core"."location_hours"."closes") = 0),
	CONSTRAINT "core_location_hours_range_check" CHECK ("core"."location_hours"."opens" <> "core"."location_hours"."closes")
);
--> statement-breakpoint
CREATE TABLE "core"."valley_detection" (
	"location_id" uuid PRIMARY KEY NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"scans" integer NOT NULL,
	"hours_version" integer NOT NULL,
	CONSTRAINT "core_valley_detection_status_check" CHECK ("core"."valley_detection"."status" in ('proposed', 'none', 'insufficient_data')),
	CONSTRAINT "core_valley_detection_scans_check" CHECK ("core"."valley_detection"."scans" >= 0)
);
--> statement-breakpoint
CREATE TABLE "core"."valley_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_hour" smallint NOT NULL,
	"end_hour" smallint NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_valley_window_weekday_check" CHECK ("core"."valley_window"."weekday" between 1 and 7),
	CONSTRAINT "core_valley_window_hours_check" CHECK ("core"."valley_window"."start_hour" between 0 and 23 and "core"."valley_window"."end_hour" between 1 and 24 and "core"."valley_window"."end_hour" > "core"."valley_window"."start_hour"),
	CONSTRAINT "core_valley_window_source_check" CHECK ("core"."valley_window"."source" in ('network', 'merchant'))
);
--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_channel_check";--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_coupon_all_or_nothing_check";--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_reward_kind_check";--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_coupon_needs_end_check";--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_template_key_check";--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" DROP CONSTRAINT "core_coupon_redemption_kind_check";--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" DROP CONSTRAINT "core_campaign_coupon_reward_kind_check";--> statement-breakpoint
DROP INDEX "core"."core_campaign_coupon_cross_unique";--> statement-breakpoint
ALTER TABLE "core"."location" ADD COLUMN "hours_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD COLUMN "valley_monthly_cap" integer;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD COLUMN "valley_location_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."location_hours" ADD CONSTRAINT "location_hours_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."valley_detection" ADD CONSTRAINT "valley_detection_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."valley_window" ADD CONSTRAINT "valley_window_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_valley_window_location_idx" ON "core"."valley_window" USING btree ("location_id","weekday");--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_valley_location_id_location_id_fk" FOREIGN KEY ("valley_location_id") REFERENCES "core"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_coupon_valley_unique" ON "core"."campaign_coupon" USING btree ("valley_location_id","consumer_id") WHERE "core"."campaign_coupon"."valley_location_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_coupon_cross_unique" ON "core"."campaign_coupon" USING btree ("campaign_id","consumer_id") WHERE "core"."campaign_coupon"."cross_claimed_at" is not null and "core"."campaign_coupon"."valley_location_id" is null;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_valley_shape_check" CHECK ((coalesce("core"."campaign"."template_key", '') = 'valley') = ("core"."campaign"."valley_monthly_cap" is not null));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_valley_monthly_cap_check" CHECK ("core"."campaign"."valley_monthly_cap" is null or "core"."campaign"."valley_monthly_cap" between 1 and 10000);--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_channel_check" CHECK ((coalesce("core"."campaign"."template_key", '') in ('welcome', 'cross', 'valley')) = (not "core"."campaign"."channel_proximity" and not "core"."campaign"."channel_push"));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_coupon_all_or_nothing_check" CHECK ((coalesce("core"."campaign"."template_key", '') in ('welcome', 'cross', 'valley') and "core"."campaign"."coupon_label" is not null and "core"."campaign"."coupon_cost" is not null and "core"."campaign"."coupon_max_redemptions" is null) or (coalesce("core"."campaign"."template_key", '') not in ('welcome', 'cross', 'valley') and ("core"."campaign"."coupon_label" is null) = ("core"."campaign"."coupon_cost" is null) and ("core"."campaign"."coupon_label" is null) = ("core"."campaign"."coupon_max_redemptions" is null)));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_reward_kind_check" CHECK ("core"."campaign"."coupon_kind" is null or "core"."campaign"."coupon_kind" in ('free_product', 'two_for_one', 'discount', 'extra_stamps', 'extra_points', 'custom'));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_coupon_needs_end_check" CHECK (coalesce("core"."campaign"."template_key", '') in ('welcome', 'cross', 'valley') or "core"."campaign"."coupon_label" is null or "core"."campaign"."ends_at" is not null);--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_template_key_check" CHECK ("core"."campaign"."template_key" is null or "core"."campaign"."template_key" in ('missed_you', 'win_back', 'near_reward', 'unclaimed_reward', 'at_risk', 'welcome', 'cross', 'valley'));--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "core_coupon_redemption_kind_check" CHECK ("core"."coupon_redemption"."kind_snapshot" in ('free_product', 'two_for_one', 'discount', 'extra_stamps', 'extra_points', 'custom'));--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "core_campaign_coupon_valley_check" CHECK ("core"."campaign_coupon"."valley_location_id" is null or "core"."campaign_coupon"."cross_claimed_at" is not null);--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "core_campaign_coupon_reward_kind_check" CHECK ("core"."campaign_coupon"."kind_snapshot" is null or "core"."campaign_coupon"."kind_snapshot" in ('free_product', 'two_for_one', 'discount', 'extra_stamps', 'extra_points', 'custom'));