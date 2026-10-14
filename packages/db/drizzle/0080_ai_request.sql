CREATE TABLE "core"."ai_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"created_by_user_id" text,
	"task" text NOT NULL,
	"task_version" text NOT NULL,
	"mode" text NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"status" text NOT NULL,
	"failure_code" text,
	"input_chars" integer DEFAULT 0 NOT NULL,
	"input_images" integer DEFAULT 0 NOT NULL,
	"input_files" integer DEFAULT 0 NOT NULL,
	"output_items" integer,
	"input_tokens" integer,
	"output_tokens" integer,
	"duration_ms" integer,
	"provider_request_id" text,
	"subject_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "core_ai_request_task_check" CHECK ("core"."ai_request"."task" ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'),
	CONSTRAINT "core_ai_request_mode_check" CHECK ("core"."ai_request"."mode" in ('sync', 'background')),
	CONSTRAINT "core_ai_request_status_check" CHECK ("core"."ai_request"."status" in ('pending', 'ok', 'failed')),
	CONSTRAINT "core_ai_request_pending_background_check" CHECK ("core"."ai_request"."status" <> 'pending' or "core"."ai_request"."mode" = 'background'),
	CONSTRAINT "core_ai_request_failure_code_check" CHECK (("core"."ai_request"."status" = 'failed') = ("core"."ai_request"."failure_code" is not null)),
	CONSTRAINT "core_ai_request_finished_check" CHECK (("core"."ai_request"."status" = 'pending') = ("core"."ai_request"."finished_at" is null)),
	CONSTRAINT "core_ai_request_counts_check" CHECK ("core"."ai_request"."input_chars" >= 0 and "core"."ai_request"."input_images" >= 0 and "core"."ai_request"."input_files" >= 0),
	CONSTRAINT "core_ai_request_metrics_check" CHECK (("core"."ai_request"."output_items" is null or "core"."ai_request"."output_items" >= 0) and ("core"."ai_request"."input_tokens" is null or "core"."ai_request"."input_tokens" >= 0) and ("core"."ai_request"."output_tokens" is null or "core"."ai_request"."output_tokens" >= 0) and ("core"."ai_request"."duration_ms" is null or "core"."ai_request"."duration_ms" >= 0))
);
--> statement-breakpoint
ALTER TABLE "core"."ai_request" ADD CONSTRAINT "ai_request_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_ai_request_business_task_created_idx" ON "core"."ai_request" USING btree ("business_id","task","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "core_ai_request_task_subject_unique" ON "core"."ai_request" USING btree ("task","subject_id") WHERE "core"."ai_request"."subject_id" is not null;