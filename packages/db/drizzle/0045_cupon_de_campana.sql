CREATE TABLE "core"."campaign_coupon" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"turn_id" uuid,
	"label_snapshot" text NOT NULL,
	"cost_snapshot" numeric(12, 2) NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_campaign_coupon_label_snapshot_check" CHECK (char_length("core"."campaign_coupon"."label_snapshot") between 1 and 40),
	CONSTRAINT "core_campaign_coupon_cost_snapshot_check" CHECK ("core"."campaign_coupon"."cost_snapshot" >= 0),
	CONSTRAINT "core_campaign_coupon_validity_check" CHECK ("core"."campaign_coupon"."valid_until" > "core"."campaign_coupon"."valid_from")
);
--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" DROP CONSTRAINT "coupon_redemption_turn_id_campaign_turn_id_fk";
--> statement-breakpoint
DROP INDEX "core"."core_coupon_redemption_turn_unique";--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD COLUMN "coupon_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "core"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."campaign_coupon" ADD CONSTRAINT "campaign_coupon_turn_id_campaign_turn_id_fk" FOREIGN KEY ("turn_id") REFERENCES "core"."campaign_turn"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_campaign_coupon_turn_unique" ON "core"."campaign_coupon" USING btree ("turn_id");--> statement-breakpoint
CREATE INDEX "core_campaign_coupon_scan_idx" ON "core"."campaign_coupon" USING btree ("business_id","consumer_id","valid_until");--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" ADD CONSTRAINT "coupon_redemption_coupon_id_campaign_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "core"."campaign_coupon"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_coupon_redemption_coupon_unique" ON "core"."coupon_redemption" USING btree ("coupon_id");--> statement-breakpoint
ALTER TABLE "core"."coupon_redemption" DROP COLUMN "turn_id";--> statement-breakpoint
ALTER TABLE "core"."campaign" ADD CONSTRAINT "core_campaign_coupon_needs_end_check" CHECK ("core"."campaign"."coupon_label" is null or "core"."campaign"."ends_at" is not null);