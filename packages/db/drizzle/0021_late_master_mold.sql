CREATE TABLE "consumer"."wallet_push_device" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_pass_id" uuid NOT NULL,
	"device_library_id" text NOT NULL,
	"push_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer"."wallet_push_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"class" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "wallet_push_queue_class_check" CHECK ("consumer"."wallet_push_queue"."class" in ('transactional', 'campaign')),
	CONSTRAINT "wallet_push_queue_status_check" CHECK ("consumer"."wallet_push_queue"."status" in ('pending', 'sending', 'sent', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "latest_message" text;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "message_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "last_push_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_device" ADD CONSTRAINT "wallet_push_device_wallet_pass_id_wallet_pass_id_fk" FOREIGN KEY ("wallet_pass_id") REFERENCES "consumer"."wallet_pass"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" ADD CONSTRAINT "wallet_push_queue_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_push_device_library_pass_unique" ON "consumer"."wallet_push_device" USING btree ("device_library_id","wallet_pass_id");--> statement-breakpoint
CREATE INDEX "wallet_push_device_pass_idx" ON "consumer"."wallet_push_device" USING btree ("wallet_pass_id");--> statement-breakpoint
CREATE INDEX "wallet_push_queue_status_not_before_idx" ON "consumer"."wallet_push_queue" USING btree ("status","not_before");--> statement-breakpoint
CREATE INDEX "wallet_push_queue_consumer_idx" ON "consumer"."wallet_push_queue" USING btree ("consumer_id");