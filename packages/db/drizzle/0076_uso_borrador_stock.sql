CREATE TABLE "stock"."draft_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"created_by_user_id" text,
	"provider" text NOT NULL,
	"model" text,
	"status" text NOT NULL,
	"line_count" integer DEFAULT 0 NOT NULL,
	"input_chars" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_draft_request_status_check" CHECK ("stock"."draft_request"."status" in ('ok', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "stock"."draft_request" ADD CONSTRAINT "draft_request_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_draft_request_business_created_idx" ON "stock"."draft_request" USING btree ("business_id","created_at");