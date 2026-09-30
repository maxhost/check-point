CREATE TABLE "core"."campaign_push" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"holdout" boolean NOT NULL,
	"queue_id" uuid,
	"decided_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	CONSTRAINT "core_campaign_push_cancel_reason_check" CHECK ("core"."campaign_push"."cancel_reason" is null or "core"."campaign_push"."cancel_reason" in ('campaign_inactive', 'membership_gone', 'opt_out', 'visited')),
	CONSTRAINT "core_campaign_push_cancel_pair_check" CHECK (("core"."campaign_push"."cancel_reason" is null) = ("core"."campaign_push"."cancelled_at" is null)),
	CONSTRAINT "core_campaign_push_holdout_check" CHECK (not "core"."campaign_push"."holdout" or ("core"."campaign_push"."queue_id" is null and "core"."campaign_push"."sent_at" is null)),
	CONSTRAINT "core_campaign_push_click_check" CHECK ("core"."campaign_push"."clicked_at" is null or "core"."campaign_push"."sent_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" DROP CONSTRAINT "wallet_push_queue_status_check";--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "push_window_start_hour" integer DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "push_window_end_hour" integer DEFAULT 21 NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD COLUMN "channel_proximity" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD COLUMN "channel_push" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD COLUMN "push_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."campaign_push" ADD CONSTRAINT "campaign_push_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "core"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_push" ADD CONSTRAINT "campaign_push_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_push" ADD CONSTRAINT "campaign_push_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_push" ADD CONSTRAINT "campaign_push_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_push" ADD CONSTRAINT "campaign_push_queue_id_wallet_push_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "consumer"."wallet_push_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_push_queue_unique" ON "core"."campaign_push" USING btree ("queue_id");--> statement-breakpoint
CREATE INDEX "core_campaign_push_group_idx" ON "core"."campaign_push" USING btree ("business_id","consumer_id","decided_at");--> statement-breakpoint
CREATE INDEX "core_campaign_push_campaign_idx" ON "core"."campaign_push" USING btree ("campaign_id");--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_push_id_campaign_push_id_fk" FOREIGN KEY ("push_id") REFERENCES "core"."campaign_push"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_coupon_push_unique" ON "core"."campaign_coupon" USING btree ("push_id");--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "core_business_push_window_check" CHECK ("core"."business"."push_window_start_hour" between 0 and 23 and "core"."business"."push_window_end_hour" between 1 and 24 and "core"."business"."push_window_start_hour" < "core"."business"."push_window_end_hour");--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" ADD CONSTRAINT "wallet_push_queue_status_check" CHECK ("consumer"."wallet_push_queue"."status" in ('pending', 'sending', 'sent', 'failed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_channel_check" CHECK ("core"."campaign"."channel_proximity" or "core"."campaign"."channel_push");--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "core_campaign_coupon_single_origin_check" CHECK ("core"."campaign_coupon"."turn_id" is null or "core"."campaign_coupon"."push_id" is null);