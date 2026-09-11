ALTER TABLE "core"."stripe_webhook_event" ADD COLUMN "ignored_reason" text;--> statement-breakpoint
ALTER TABLE "core"."subscription" ADD COLUMN "pending_plan" text;--> statement-breakpoint
ALTER TABLE "core"."subscription" ADD COLUMN "pending_plan_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."subscription" ADD COLUMN "downgrade_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."subscription" ADD COLUMN "last_event_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "core_subscription_business_unique" ON "core"."subscription" USING btree ("business_id");