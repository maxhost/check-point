CREATE TABLE "core"."campaign_location" (
	"campaign_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "campaign_location_campaign_id_location_id_pk" PRIMARY KEY("campaign_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "core"."campaign_tick_audience" (
	"campaign_id" uuid NOT NULL,
	"ran_at" timestamp with time zone NOT NULL,
	"total" integer NOT NULL,
	"reachable" integer NOT NULL,
	"no_location" integer NOT NULL,
	"opt_out" integer NOT NULL,
	"cooldown" integer NOT NULL,
	CONSTRAINT "campaign_tick_audience_campaign_id_ran_at_pk" PRIMARY KEY("campaign_id","ran_at")
);
--> statement-breakpoint
CREATE TABLE "core"."campaign" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"pause_reason" text,
	"dormant_days" integer DEFAULT 30 NOT NULL,
	"message" text NOT NULL,
	"coupon_label" text,
	"coupon_cost" numeric(12, 2),
	"coupon_max_redemptions" integer,
	"coupon_product_id" uuid,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"activated_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_campaign_kind_check" CHECK ("core"."campaign"."kind" in ('proximity')),
	CONSTRAINT "core_campaign_status_check" CHECK ("core"."campaign"."status" in ('draft', 'active', 'paused', 'ended', 'archived')),
	CONSTRAINT "core_campaign_pause_reason_check" CHECK ("core"."campaign"."pause_reason" is null or "core"."campaign"."pause_reason" in ('owner', 'plan_downgraded', 'no_active_locations')),
	CONSTRAINT "core_campaign_dormant_days_check" CHECK ("core"."campaign"."dormant_days" between 7 and 365),
	CONSTRAINT "core_campaign_name_check" CHECK (char_length("core"."campaign"."name") between 1 and 80),
	CONSTRAINT "core_campaign_message_check" CHECK (char_length("core"."campaign"."message") between 1 and 60),
	CONSTRAINT "core_campaign_coupon_label_check" CHECK ("core"."campaign"."coupon_label" is null or char_length("core"."campaign"."coupon_label") between 1 and 40),
	CONSTRAINT "core_campaign_coupon_cost_check" CHECK ("core"."campaign"."coupon_cost" is null or "core"."campaign"."coupon_cost" >= 0),
	CONSTRAINT "core_campaign_coupon_max_redemptions_check" CHECK ("core"."campaign"."coupon_max_redemptions" is null or "core"."campaign"."coupon_max_redemptions" >= 1),
	CONSTRAINT "core_campaign_coupon_all_or_nothing_check" CHECK (("core"."campaign"."coupon_label" is null) = ("core"."campaign"."coupon_cost" is null) and ("core"."campaign"."coupon_label" is null) = ("core"."campaign"."coupon_max_redemptions" is null)),
	CONSTRAINT "core_campaign_dates_check" CHECK ("core"."campaign"."ends_at" is null or "core"."campaign"."ends_at" > "core"."campaign"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "core"."campaign_turn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"location_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"holdout" boolean DEFAULT false NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"message_snapshot" text,
	"coupon_label_snapshot" text,
	"coupon_cost_snapshot" numeric(12, 2),
	"outcome" text,
	"outcome_order_id" uuid,
	"outcome_redemption_id" uuid,
	"outcome_at" timestamp with time zone,
	"cancel_reason" text,
	CONSTRAINT "core_campaign_turn_status_check" CHECK ("core"."campaign_turn"."status" in ('queued', 'active', 'done', 'cancelled')),
	CONSTRAINT "core_campaign_turn_outcome_check" CHECK ("core"."campaign_turn"."outcome" is null or "core"."campaign_turn"."outcome" in ('purchase', 'coupon_redeemed', 'none')),
	CONSTRAINT "core_campaign_turn_cancel_reason_check" CHECK ("core"."campaign_turn"."cancel_reason" is null or "core"."campaign_turn"."cancel_reason" in ('opt_out', 'campaign_paused', 'campaign_ended', 'plan_downgraded', 'location_archived', 'location_without_coordinates', 'membership_gone'))
);
--> statement-breakpoint
CREATE TABLE "core"."coupon_redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"turn_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"location_id" uuid,
	"label_snapshot" text NOT NULL,
	"cost_snapshot" numeric(12, 2) NOT NULL,
	"created_by_user_id" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer"."pass_placement" (
	"consumer_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"slot_kind" text NOT NULL,
	"turn_id" uuid,
	"business_id" uuid NOT NULL,
	"relevant_text" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pass_placement_consumer_id_location_id_pk" PRIMARY KEY("consumer_id","location_id"),
	CONSTRAINT "consumer_pass_placement_slot_kind_check" CHECK ("consumer"."pass_placement"."slot_kind" in ('utility', 'turn', 'both')),
	CONSTRAINT "consumer_pass_placement_relevant_text_check" CHECK (char_length("consumer"."pass_placement"."relevant_text") <= 120)
);
--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" DROP CONSTRAINT "wallet_push_queue_class_check";--> statement-breakpoint
ALTER TABLE "consumer"."program_membership" ADD COLUMN "marketing_opt_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."campaign_location" ADD CONSTRAINT "campaign_location_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "core"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_location" ADD CONSTRAINT "campaign_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_tick_audience" ADD CONSTRAINT "campaign_tick_audience_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "core"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "campaign_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "campaign_coupon_product_id_product_id_fk" FOREIGN KEY ("coupon_product_id") REFERENCES "core"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "campaign_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_turn" ADD CONSTRAINT "campaign_turn_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "core"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_turn" ADD CONSTRAINT "campaign_turn_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_turn" ADD CONSTRAINT "campaign_turn_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_turn" ADD CONSTRAINT "campaign_turn_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_turn" ADD CONSTRAINT "campaign_turn_outcome_order_id_order_id_fk" FOREIGN KEY ("outcome_order_id") REFERENCES "core"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_turn" ADD CONSTRAINT "campaign_turn_outcome_redemption_id_coupon_redemption_id_fk" FOREIGN KEY ("outcome_redemption_id") REFERENCES "core"."coupon_redemption"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_turn_id_campaign_turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "core"."campaign_turn"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "core"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."pass_placement" ADD CONSTRAINT "pass_placement_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."pass_placement" ADD CONSTRAINT "pass_placement_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."pass_placement" ADD CONSTRAINT "pass_placement_turn_id_campaign_turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "core"."campaign_turn"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_campaign_business_status_idx" ON "core"."campaign" USING btree ("business_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_turn_business_consumer_live_unique" ON "core"."campaign_turn" USING btree ("business_id","consumer_id") WHERE "core"."campaign_turn"."status" in ('queued', 'active');--> statement-breakpoint
CREATE INDEX "core_campaign_turn_consumer_status_idx" ON "core"."campaign_turn" USING btree ("consumer_id","status");--> statement-breakpoint
CREATE INDEX "core_campaign_turn_campaign_status_idx" ON "core"."campaign_turn" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "core_campaign_turn_business_status_idx" ON "core"."campaign_turn" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "core_campaign_turn_cooldown_idx" ON "core"."campaign_turn" USING btree ("business_id","consumer_id","window_end");--> statement-breakpoint
CREATE UNIQUE INDEX "core_coupon_redemption_turn_unique" ON "core"."coupon_redemption" USING btree ("turn_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_coupon_redemption_business_client_request_unique" ON "core"."coupon_redemption" USING btree ("business_id","client_request_id");--> statement-breakpoint
CREATE INDEX "core_coupon_redemption_campaign_idx" ON "core"."coupon_redemption" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "core_coupon_redemption_business_idx" ON "core"."coupon_redemption" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "consumer_pass_placement_business_idx" ON "consumer"."pass_placement" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "consumer_pass_placement_turn_idx" ON "consumer"."pass_placement" USING btree ("turn_id");--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" ADD CONSTRAINT "wallet_push_queue_class_check" CHECK ("consumer"."wallet_push_queue"."class" in ('transactional', 'campaign', 'pass_refresh'));