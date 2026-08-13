CREATE TABLE "core"."brand_asset_cleanup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"object_prefix" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."brand_asset_upload" (
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
ALTER TABLE "core"."business" ADD COLUMN "brand_primary_color" text DEFAULT '#176548' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "brand_complementary_color" text DEFAULT '#2D8B68' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "brand_accent_color" text DEFAULT '#E78132' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "brand_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "logo_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."brand_asset_cleanup" ADD CONSTRAINT "brand_asset_cleanup_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."brand_asset_upload" ADD CONSTRAINT "brand_asset_upload_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_brand_asset_cleanup_prefix_unique" ON "core"."brand_asset_cleanup" USING btree ("object_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "core_brand_asset_upload_object_key_unique" ON "core"."brand_asset_upload" USING btree ("object_key");--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_primary_color_check" CHECK ("core"."business"."brand_primary_color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_complementary_color_check" CHECK ("core"."business"."brand_complementary_color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_accent_color_check" CHECK ("core"."business"."brand_accent_color" ~ '^#[0-9A-Fa-f]{6}$');--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_brand_revision_check" CHECK ("core"."business"."brand_revision" >= 1);--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_logo_version_check" CHECK ("core"."business"."logo_version" >= 0);