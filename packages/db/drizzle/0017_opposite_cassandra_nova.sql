CREATE TABLE "core"."product_asset_cleanup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"object_prefix" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"not_before" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."product_asset_upload" (
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
CREATE TABLE "core"."product_category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."product_location" (
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "product_location_product_id_location_id_pk" PRIMARY KEY("product_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "core"."product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"unit_price" numeric(12, 2),
	"unit_cost" numeric(12, 2),
	"image_object_key" text,
	"image_version" integer DEFAULT 0 NOT NULL,
	"available_all_locations" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_unit_price_check" CHECK ("core"."product"."unit_price" is null or "core"."product"."unit_price" >= 0),
	CONSTRAINT "product_unit_cost_check" CHECK ("core"."product"."unit_cost" is null or "core"."product"."unit_cost" >= 0),
	CONSTRAINT "product_image_version_check" CHECK ("core"."product"."image_version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "currency_code" text;--> statement-breakpoint
UPDATE "core"."business" SET "currency_code" = CASE upper("country_code")
	WHEN 'EC' THEN 'USD' WHEN 'US' THEN 'USD' WHEN 'SV' THEN 'USD' WHEN 'PA' THEN 'USD'
	WHEN 'AR' THEN 'ARS' WHEN 'BO' THEN 'BOB' WHEN 'BR' THEN 'BRL' WHEN 'CL' THEN 'CLP'
	WHEN 'CO' THEN 'COP' WHEN 'CR' THEN 'CRC' WHEN 'CU' THEN 'CUP' WHEN 'DO' THEN 'DOP'
	WHEN 'GT' THEN 'GTQ' WHEN 'HN' THEN 'HNL' WHEN 'MX' THEN 'MXN' WHEN 'NI' THEN 'NIO'
	WHEN 'PY' THEN 'PYG' WHEN 'PE' THEN 'PEN' WHEN 'UY' THEN 'UYU' WHEN 'VE' THEN 'VES'
	WHEN 'ES' THEN 'EUR' WHEN 'PT' THEN 'EUR' WHEN 'FR' THEN 'EUR' WHEN 'DE' THEN 'EUR'
	WHEN 'IT' THEN 'EUR' WHEN 'GB' THEN 'GBP' WHEN 'CA' THEN 'CAD' WHEN 'CH' THEN 'CHF'
	WHEN 'CN' THEN 'CNY' WHEN 'JP' THEN 'JPY' WHEN 'AU' THEN 'AUD' ELSE 'USD' END;--> statement-breakpoint
ALTER TABLE "core"."business" ALTER COLUMN "currency_code" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "core"."business" ALTER COLUMN "currency_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."product_asset_cleanup" ADD CONSTRAINT "product_asset_cleanup_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."product_asset_upload" ADD CONSTRAINT "product_asset_upload_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."product_category" ADD CONSTRAINT "product_category_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."product_location" ADD CONSTRAINT "product_location_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "core"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."product_location" ADD CONSTRAINT "product_location_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."product" ADD CONSTRAINT "product_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."product" ADD CONSTRAINT "product_category_id_product_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "core"."product_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_product_asset_cleanup_prefix_unique" ON "core"."product_asset_cleanup" USING btree ("object_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "core_product_asset_upload_object_key_unique" ON "core"."product_asset_upload" USING btree ("object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "core_product_category_name_unique" ON "core"."product_category" USING btree ("business_id",lower("name"));--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_currency_code_check" CHECK ("core"."business"."currency_code" ~ '^[A-Z]{3}$');