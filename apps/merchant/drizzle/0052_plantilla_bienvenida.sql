CREATE TABLE "core"."welcome_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"device_library_id" text NOT NULL,
	"coupon_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_channel_check";--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_coupon_all_or_nothing_check";--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_coupon_needs_end_check";--> statement-breakpoint
ALTER TABLE "core"."campaign" DROP CONSTRAINT "core_campaign_template_key_check";--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" DROP CONSTRAINT "core_campaign_coupon_single_origin_check";--> statement-breakpoint
ALTER TABLE "consumer"."wallet_pass" ADD COLUMN "google_saved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD COLUMN "welcome_valid_days" integer;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD COLUMN "welcome_reminder_days" integer;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD COLUMN "welcome_monthly_cap" integer;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD COLUMN "welcome_redeem_from" text;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD COLUMN "welcome_membership_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD COLUMN "reminder_queue_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."welcome_device" ADD CONSTRAINT "welcome_device_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."welcome_device" ADD CONSTRAINT "welcome_device_coupon_id_campaign_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "core"."campaign_coupon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_welcome_device_business_device_unique" ON "core"."welcome_device" USING btree ("business_id","device_library_id");--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_welcome_membership_id_program_membership_id_fk" FOREIGN KEY ("welcome_membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_reminder_queue_id_wallet_push_queue_id_fk" FOREIGN KEY ("reminder_queue_id") REFERENCES "consumer"."wallet_push_queue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_coupon_welcome_unique" ON "core"."campaign_coupon" USING btree ("welcome_membership_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_coupon_reminder_queue_unique" ON "core"."campaign_coupon" USING btree ("reminder_queue_id");--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_welcome_valid_days_check" CHECK ("core"."campaign"."welcome_valid_days" is null or "core"."campaign"."welcome_valid_days" in (7, 15, 30));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_welcome_reminder_days_check" CHECK ("core"."campaign"."welcome_reminder_days" is null or ("core"."campaign"."welcome_reminder_days" in (1, 3, 7) and ("core"."campaign"."welcome_valid_days" is null or "core"."campaign"."welcome_reminder_days" < "core"."campaign"."welcome_valid_days")));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_welcome_monthly_cap_check" CHECK ("core"."campaign"."welcome_monthly_cap" is null or "core"."campaign"."welcome_monthly_cap" between 1 and 10000);--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_welcome_redeem_from_check" CHECK ("core"."campaign"."welcome_redeem_from" is null or "core"."campaign"."welcome_redeem_from" in ('next_day', 'same_visit'));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_welcome_shape_check" CHECK ((coalesce("core"."campaign"."template_key", '') = 'welcome') = ("core"."campaign"."welcome_valid_days" is not null and "core"."campaign"."welcome_reminder_days" is not null and "core"."campaign"."welcome_monthly_cap" is not null and "core"."campaign"."welcome_redeem_from" is not null) and (coalesce("core"."campaign"."template_key", '') <> 'welcome' or ("core"."campaign"."coupon_label" is not null and "core"."campaign"."coupon_max_redemptions" is null)));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_channel_check" CHECK ((coalesce("core"."campaign"."template_key", '') = 'welcome') = (not "core"."campaign"."channel_proximity" and not "core"."campaign"."channel_push"));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_coupon_all_or_nothing_check" CHECK ((coalesce("core"."campaign"."template_key", '') = 'welcome' and "core"."campaign"."coupon_label" is not null and "core"."campaign"."coupon_cost" is not null and "core"."campaign"."coupon_max_redemptions" is null) or (coalesce("core"."campaign"."template_key", '') <> 'welcome' and ("core"."campaign"."coupon_label" is null) = ("core"."campaign"."coupon_cost" is null) and ("core"."campaign"."coupon_label" is null) = ("core"."campaign"."coupon_max_redemptions" is null)));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_coupon_needs_end_check" CHECK (coalesce("core"."campaign"."template_key", '') = 'welcome' or "core"."campaign"."coupon_label" is null or "core"."campaign"."ends_at" is not null);--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_template_key_check" CHECK ("core"."campaign"."template_key" is null or "core"."campaign"."template_key" in ('missed_you', 'win_back', 'near_reward', 'unclaimed_reward', 'at_risk', 'welcome'));--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "core_campaign_coupon_reminder_check" CHECK ("core"."campaign_coupon"."reminder_queue_id" is null or "core"."campaign_coupon"."welcome_membership_id" is not null);--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "core_campaign_coupon_single_origin_check" CHECK (num_nonnulls("core"."campaign_coupon"."turn_id", "core"."campaign_coupon"."push_id", "core"."campaign_coupon"."welcome_membership_id") <= 1);