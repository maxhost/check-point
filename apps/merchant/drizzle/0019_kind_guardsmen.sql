CREATE TABLE "core"."loyalty_reward" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"reward_type" text NOT NULL,
	"label" text NOT NULL,
	"product_id" uuid,
	"discount_percent" integer,
	"points_cost" integer,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_reward_type_check" CHECK ("core"."loyalty_reward"."reward_type" in ('catalog_product', 'custom', 'discount')),
	CONSTRAINT "loyalty_reward_discount_percent_check" CHECK ("core"."loyalty_reward"."discount_percent" IS NULL OR ("core"."loyalty_reward"."discount_percent" >= 1 AND "core"."loyalty_reward"."discount_percent" <= 100)),
	CONSTRAINT "loyalty_reward_points_cost_check" CHECK ("core"."loyalty_reward"."points_cost" IS NULL OR "core"."loyalty_reward"."points_cost" > 0),
	CONSTRAINT "loyalty_reward_discount_pair_check" CHECK (("core"."loyalty_reward"."reward_type" = 'discount') = ("core"."loyalty_reward"."discount_percent" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "accrual_mode" text;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "accrual_grant" integer;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "accrual_block_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "core"."loyalty_reward" ADD CONSTRAINT "loyalty_reward_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_reward" ADD CONSTRAINT "loyalty_reward_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_reward" ADD CONSTRAINT "loyalty_reward_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "core"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_loyalty_reward_program_idx" ON "core"."loyalty_reward" USING btree ("program_id","position");--> statement-breakpoint
CREATE INDEX "core_loyalty_reward_business_idx" ON "core"."loyalty_reward" USING btree ("business_id");--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_accrual_mode_check" CHECK ("core"."loyalty_program"."accrual_mode" IS NULL OR "core"."loyalty_program"."accrual_mode" IN ('per_amount', 'per_purchase'));--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_accrual_grant_check" CHECK ("core"."loyalty_program"."accrual_grant" IS NULL OR "core"."loyalty_program"."accrual_grant" > 0);--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_accrual_block_amount_check" CHECK ("core"."loyalty_program"."accrual_block_amount" IS NULL OR "core"."loyalty_program"."accrual_block_amount" > 0);--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_accrual_pair_check" CHECK (("core"."loyalty_program"."accrual_mode" = 'per_amount' AND "core"."loyalty_program"."accrual_block_amount" IS NOT NULL) OR ("core"."loyalty_program"."accrual_mode" = 'per_purchase' AND "core"."loyalty_program"."accrual_block_amount" IS NULL) OR "core"."loyalty_program"."accrual_mode" IS NULL);--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_accrual_points_mode_check" CHECK ("core"."loyalty_program"."kind" <> 'points' OR "core"."loyalty_program"."accrual_mode" IS NULL OR "core"."loyalty_program"."accrual_mode" = 'per_amount');