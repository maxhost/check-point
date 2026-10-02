-- Spec 0119 / ADR 0111: el cliente entra con Google o Apple. La identidad es (provider, subject) en
-- `consumer_identity`; el telefono queda opcional (los unicos de telefono admiten varios NULL) y se
-- borran las tablas del OTP y del rate limit por telefono.
CREATE TABLE "consumer"."consumer_identity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumer_identity_provider_check" CHECK ("consumer"."consumer_identity"."provider" in ('google', 'apple'))
);
--> statement-breakpoint
ALTER TABLE "consumer"."enroll_attempt" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consumer"."otp_challenge" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "consumer"."otp_delivery" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "consumer"."enroll_attempt" CASCADE;--> statement-breakpoint
DROP TABLE "consumer"."otp_challenge" CASCADE;--> statement-breakpoint
DROP TABLE "consumer"."otp_delivery" CASCADE;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business_customer" ALTER COLUMN "phone_e164" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_identity" ADD CONSTRAINT "consumer_identity_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_identity_provider_subject_unique" ON "consumer"."consumer_identity" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "consumer_identity_consumer_idx" ON "consumer"."consumer_identity" USING btree ("consumer_id");--> statement-breakpoint
-- La tabla nace cerrada para el cliente (default privileges de la 0060): este GRANT la abre. Sin
-- UPDATE ni DELETE: una identidad nunca se reescribe.
GRANT SELECT, INSERT ON consumer.consumer_identity TO checkpass_consumer;
