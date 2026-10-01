CREATE SCHEMA "consumer";
--> statement-breakpoint
CREATE TABLE "consumer"."consumer_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"qr_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer"."consumer_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer"."enroll_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer"."program_membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consumer"."consumer_session" ADD CONSTRAINT "consumer_session_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."program_membership" ADD CONSTRAINT "program_membership_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."program_membership" ADD CONSTRAINT "program_membership_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_account_phone_unique" ON "consumer"."consumer_account" USING btree ("phone_e164");--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_account_qr_token_unique" ON "consumer"."consumer_account" USING btree ("qr_token");--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_session_token_hash_unique" ON "consumer"."consumer_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "consumer_enroll_attempt_phone_idx" ON "consumer"."enroll_attempt" USING btree ("phone_e164","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_program_membership_unique" ON "consumer"."program_membership" USING btree ("consumer_id","program_id");--> statement-breakpoint
CREATE INDEX "consumer_program_membership_business_idx" ON "consumer"."program_membership" USING btree ("business_id");