ALTER TABLE "core"."business" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "suspension_reason" text;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_status_check" CHECK ("core"."business"."status" in ('active', 'suspended', 'closed'));