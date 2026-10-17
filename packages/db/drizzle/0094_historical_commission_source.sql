ALTER TABLE "core"."historical_event_handler" ADD COLUMN "source_provider_id" text DEFAULT 'pos' NOT NULL;
--> statement-breakpoint
ALTER TABLE core.historical_event_handler ALTER COLUMN source_provider_id DROP DEFAULT;
