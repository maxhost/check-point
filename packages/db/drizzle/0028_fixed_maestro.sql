CREATE TABLE "core"."reward_redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid,
	"program_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"reward_id" uuid,
	"reward_type" text NOT NULL,
	"reward_label" text NOT NULL,
	"reward_discount_percent" integer,
	"reward_points_cost" integer,
	"accrual_kind" text NOT NULL,
	"units_debited" integer NOT NULL,
	"balance_before" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"insufficient_override" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_reward_redemption_accrual_kind_check" CHECK ("core"."reward_redemption"."accrual_kind" in ('points', 'stamps')),
	CONSTRAINT "core_reward_redemption_units_debited_check" CHECK ("core"."reward_redemption"."units_debited" >= 0),
	CONSTRAINT "core_reward_redemption_balance_before_check" CHECK ("core"."reward_redemption"."balance_before" >= 0),
	CONSTRAINT "core_reward_redemption_balance_after_check" CHECK ("core"."reward_redemption"."balance_after" >= 0),
	CONSTRAINT "core_reward_redemption_points_cost_check" CHECK ("core"."reward_redemption"."reward_points_cost" IS NOT NULL OR "core"."reward_redemption"."accrual_kind" = 'stamps')
);
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "redeem_allow_insufficient" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."reward_redemption" ADD CONSTRAINT "reward_redemption_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."reward_redemption" ADD CONSTRAINT "reward_redemption_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."reward_redemption" ADD CONSTRAINT "reward_redemption_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."reward_redemption" ADD CONSTRAINT "reward_redemption_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."reward_redemption" ADD CONSTRAINT "reward_redemption_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."reward_redemption" ADD CONSTRAINT "reward_redemption_reward_id_loyalty_reward_id_fk" FOREIGN KEY ("reward_id") REFERENCES "core"."loyalty_reward"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."reward_redemption" ADD CONSTRAINT "reward_redemption_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_reward_redemption_business_client_request_unique" ON "core"."reward_redemption" USING btree ("business_id","client_request_id");--> statement-breakpoint
CREATE INDEX "core_reward_redemption_membership_idx" ON "core"."reward_redemption" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "core_reward_redemption_business_idx" ON "core"."reward_redemption" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "core_reward_redemption_program_idx" ON "core"."reward_redemption" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "core_reward_redemption_reward_idx" ON "core"."reward_redemption" USING btree ("reward_id");