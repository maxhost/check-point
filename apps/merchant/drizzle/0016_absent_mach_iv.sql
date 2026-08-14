CREATE TABLE "consumer"."wallet_pass" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"consumer_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"serial_number" text NOT NULL,
	"auth_token_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- pgcrypto provides gen_random_bytes for the base64url backfill below. gen_random_uuid
-- (used elsewhere) is in core since PG13, so pgcrypto may not be installed yet.
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
-- `web_view_token` is NOT NULL + UNIQUE, but rows already exist (spec 0028 is live).
-- Drizzle emits a bare `ADD COLUMN ... NOT NULL`, which fails on non-empty tables.
-- Split into add-nullable -> per-row backfill -> SET NOT NULL so existing accounts
-- get a distinct opaque token. The backfill is base64url (URL-safe: this value is a
-- path param at /c/[web_view_token]) of 32 random bytes (256 bits): base64-encode,
-- map +/ to -_, and drop = padding — so the result has no +, /, or = character.
ALTER TABLE "consumer"."consumer_account" ADD COLUMN "web_view_token" text;--> statement-breakpoint
UPDATE "consumer"."consumer_account"
	SET "web_view_token" = rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=')
	WHERE "web_view_token" IS NULL;--> statement-breakpoint
ALTER TABLE "consumer"."consumer_account" ALTER COLUMN "web_view_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "consumer"."wallet_pass" ADD CONSTRAINT "wallet_pass_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_pass_serial_number_unique" ON "consumer"."wallet_pass" USING btree ("serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_pass_consumer_provider_unique" ON "consumer"."wallet_pass" USING btree ("consumer_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "consumer_account_web_view_token_unique" ON "consumer"."consumer_account" USING btree ("web_view_token");