CREATE TABLE "consumer"."otp_challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_e164" text NOT NULL,
	"country_iso" text NOT NULL,
	"purpose" text DEFAULT 'recover_account' NOT NULL,
	"code_hash" text,
	"code_ciphertext" text,
	"encryption_key_version" text DEFAULT 'v1' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification_attempts" integer DEFAULT 0 NOT NULL,
	"delivery_count" integer DEFAULT 0 NOT NULL,
	"resend_available_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"onboarding_token_hash" text,
	"onboarding_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_challenge_purpose_check" CHECK ("consumer"."otp_challenge"."purpose" = 'recover_account'),
	CONSTRAINT "otp_challenge_status_check" CHECK ("consumer"."otp_challenge"."status" in ('pending', 'verified', 'consumed', 'locked', 'expired', 'invalidated')),
	CONSTRAINT "otp_challenge_verification_attempts_check" CHECK ("consumer"."otp_challenge"."verification_attempts" between 0 and 2),
	CONSTRAINT "otp_challenge_delivery_count_check" CHECK ("consumer"."otp_challenge"."delivery_count" between 0 and 2)
);
--> statement-breakpoint
CREATE TABLE "consumer"."otp_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"client_request_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"locale" text NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otp_delivery_kind_check" CHECK ("consumer"."otp_delivery"."kind" in ('initial', 'resend')),
	CONSTRAINT "otp_delivery_status_check" CHECK ("consumer"."otp_delivery"."status" in ('sending', 'accepted', 'failed', 'unknown')),
	CONSTRAINT "otp_delivery_provider_check" CHECK ("consumer"."otp_delivery"."provider" in ('clicksend', 'twilio')),
	CONSTRAINT "otp_delivery_locale_check" CHECK ("consumer"."otp_delivery"."locale" in ('es', 'pt', 'en'))
);
--> statement-breakpoint
ALTER TABLE "consumer"."otp_delivery" ADD CONSTRAINT "otp_delivery_challenge_id_otp_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "consumer"."otp_challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "otp_challenge_phone_created_idx" ON "consumer"."otp_challenge" USING btree ("phone_e164","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "otp_challenge_one_pending_phone_unique" ON "consumer"."otp_challenge" USING btree ("phone_e164") WHERE "consumer"."otp_challenge"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "otp_delivery_phone_reserved_idx" ON "consumer"."otp_delivery" USING btree ("phone_e164","reserved_at");--> statement-breakpoint
CREATE UNIQUE INDEX "otp_delivery_phone_client_request_unique" ON "consumer"."otp_delivery" USING btree ("phone_e164","client_request_id") WHERE "consumer"."otp_delivery"."status" in ('sending', 'accepted', 'unknown');--> statement-breakpoint
CREATE UNIQUE INDEX "otp_delivery_challenge_kind_unique" ON "consumer"."otp_delivery" USING btree ("challenge_id","kind") WHERE "consumer"."otp_delivery"."status" in ('sending', 'accepted', 'unknown');