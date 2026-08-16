CREATE TABLE "consumer"."web_push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"auth_key" text NOT NULL,
	"user_agent" text,
	"platform" text DEFAULT 'other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "web_push_subscription_platform_check" CHECK ("consumer"."web_push_subscription"."platform" in ('ios', 'android', 'other'))
);
--> statement-breakpoint
ALTER TABLE "consumer"."web_push_subscription" ADD CONSTRAINT "web_push_subscription_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "web_push_subscription_endpoint_unique" ON "consumer"."web_push_subscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "web_push_subscription_consumer_idx" ON "consumer"."web_push_subscription" USING btree ("consumer_id");