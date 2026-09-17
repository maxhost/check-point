CREATE TABLE "merchant_auth"."auth_start_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_start_attempt_email_created_idx" ON "merchant_auth"."auth_start_attempt" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "auth_start_attempt_ip_created_idx" ON "merchant_auth"."auth_start_attempt" USING btree ("ip_hash","created_at");