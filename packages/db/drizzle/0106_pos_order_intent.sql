ALTER TABLE "pos"."pos_order" ADD COLUMN "sale_type" text;--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD COLUMN "create_request_id" uuid;--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD COLUMN "create_request_fingerprint" text;--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD COLUMN "total_snapshot" numeric(30, 2);--> statement-breakpoint
CREATE UNIQUE INDEX "pos_order_create_request_unique" ON "pos"."pos_order" USING btree ("business_id","create_request_id");--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD CONSTRAINT "pos_order_sale_type_check" CHECK ("pos"."pos_order"."sale_type" in ('table', 'pickup', 'delivery', 'counter', 'legacy'));--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD CONSTRAINT "pos_order_sale_type_table_check" CHECK ("pos"."pos_order"."sale_type" not in ('pickup', 'delivery', 'counter') or "pos"."pos_order"."dining_table_id" is null);--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD CONSTRAINT "pos_order_create_request_check" CHECK (("pos"."pos_order"."create_request_id" is null and "pos"."pos_order"."create_request_fingerprint" is null) or ("pos"."pos_order"."create_request_id" is not null and "pos"."pos_order"."create_request_fingerprint" is not null and "pos"."pos_order"."create_request_fingerprint" ~ '^[0-9a-f]{64}$'));
--> statement-breakpoint
UPDATE "pos"."pos_order" SET "sale_type" = CASE WHEN "dining_table_id" IS NOT NULL THEN 'table' ELSE 'legacy' END;
