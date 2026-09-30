ALTER TABLE "consumer"."wallet_push_queue" DROP CONSTRAINT "wallet_push_queue_class_check";--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" DROP CONSTRAINT "wallet_push_queue_status_check";--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "last_opened_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "wallet_push_queue_consumer_sent_idx" ON "consumer"."wallet_push_queue" USING btree ("consumer_id","sent_at") WHERE "consumer"."wallet_push_queue"."status" = 'sent';--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" ADD CONSTRAINT "wallet_push_queue_class_check" CHECK ("consumer"."wallet_push_queue"."class" in ('transactional', 'campaign', 'pass_refresh', 'reminder'));--> statement-breakpoint
ALTER TABLE "consumer"."wallet_push_queue" ADD CONSTRAINT "wallet_push_queue_status_check" CHECK ("consumer"."wallet_push_queue"."status" in ('pending', 'sending', 'sent', 'failed', 'cancelled', 'suppressed'));