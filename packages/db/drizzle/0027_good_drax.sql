CREATE TABLE "merchant_auth"."password_reset_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip_hash" text,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_attempt_kind_check" CHECK ("merchant_auth"."password_reset_attempt"."kind" in ('request', 'reset_ok', 'reset_fail'))
);
--> statement-breakpoint
CREATE INDEX "password_reset_attempt_email_created_idx" ON "merchant_auth"."password_reset_attempt" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "password_reset_attempt_ip_created_idx" ON "merchant_auth"."password_reset_attempt" USING btree ("ip_hash","created_at");