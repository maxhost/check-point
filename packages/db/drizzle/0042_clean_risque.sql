CREATE TABLE "core"."catalog_import_cleanup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."catalog_import_file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"original_name" text NOT NULL,
	"declared_content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"object_key" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "catalog_import_file_status_check" CHECK (status in ('reserved', 'uploaded', 'validated', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "core"."catalog_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"created_by_user_id" text NOT NULL,
	"status" text DEFAULT 'pending_upload' NOT NULL,
	"source_kind" text NOT NULL,
	"file_count" integer NOT NULL,
	"page_count" integer,
	"draft" jsonb,
	"draft_version" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"model" text,
	"prompt_version" text,
	"schema_version" text,
	"provider_job_id" text,
	"provider_request_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"accepted_summary" jsonb,
	"failure_code" text,
	"failure_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cleaned_at" timestamp with time zone,
	CONSTRAINT "catalog_import_status_check" CHECK (status in ('pending_upload', 'queued', 'analyzing', 'ready', 'accepted', 'failed', 'cancelled', 'expired')),
	CONSTRAINT "catalog_import_source_kind_check" CHECK (source_kind in ('pdf', 'images')),
	CONSTRAINT "catalog_import_file_count_check" CHECK ("core"."catalog_import"."file_count" >= 1)
);
--> statement-breakpoint
ALTER TABLE "core"."catalog_import_cleanup" ADD CONSTRAINT "catalog_import_cleanup_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."catalog_import_file" ADD CONSTRAINT "catalog_import_file_import_id_catalog_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "core"."catalog_import"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."catalog_import_file" ADD CONSTRAINT "catalog_import_file_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."catalog_import" ADD CONSTRAINT "catalog_import_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_catalog_import_cleanup_key_unique" ON "core"."catalog_import_cleanup" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "core_catalog_import_cleanup_not_before_idx" ON "core"."catalog_import_cleanup" USING btree ("not_before");--> statement-breakpoint
CREATE UNIQUE INDEX "core_catalog_import_file_position_unique" ON "core"."catalog_import_file" USING btree ("import_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "core_catalog_import_open_unique" ON "core"."catalog_import" USING btree ("business_id") WHERE status in ('pending_upload', 'queued', 'analyzing', 'ready');--> statement-breakpoint
CREATE UNIQUE INDEX "core_catalog_import_provider_job_unique" ON "core"."catalog_import" USING btree ("provider_job_id") WHERE "core"."catalog_import"."provider_job_id" is not null;--> statement-breakpoint
CREATE INDEX "core_catalog_import_status_lease_idx" ON "core"."catalog_import" USING btree ("status","lease_until");--> statement-breakpoint
CREATE INDEX "core_catalog_import_business_created_idx" ON "core"."catalog_import" USING btree ("business_id","created_at");