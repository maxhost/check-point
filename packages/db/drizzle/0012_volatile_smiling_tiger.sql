CREATE TABLE "core"."loyalty_asset_cleanup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"object_prefix" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."loyalty_asset_upload" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "stamp_image_object_key" text;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "stamp_image_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."loyalty_asset_cleanup" ADD CONSTRAINT "loyalty_asset_cleanup_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_asset_upload" ADD CONSTRAINT "loyalty_asset_upload_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_loyalty_asset_cleanup_prefix_unique" ON "core"."loyalty_asset_cleanup" USING btree ("object_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "core_loyalty_asset_upload_object_key_unique" ON "core"."loyalty_asset_upload" USING btree ("object_key");--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_stamp_version_check" CHECK ("core"."loyalty_program"."stamp_image_version" >= 0);