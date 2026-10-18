ALTER TABLE "core"."order_item" ALTER COLUMN "unit_price_snapshot" SET DATA TYPE numeric(24, 9);--> statement-breakpoint
ALTER TABLE "core"."order_item" ALTER COLUMN "quantity" SET DATA TYPE numeric(24, 9);--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ALTER COLUMN "unit_price_snapshot" SET DATA TYPE numeric(24, 9);--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ALTER COLUMN "quantity" SET DATA TYPE numeric(24, 9);--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD COLUMN "measure_kind" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD COLUMN "quantity_unit" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD COLUMN "price_unit" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD COLUMN "conversion_version" text DEFAULT 'mass-si-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD COLUMN "measure_kind" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD COLUMN "quantity_unit" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD COLUMN "price_unit" text DEFAULT 'unit' NOT NULL;--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD COLUMN "conversion_version" text DEFAULT 'mass-si-1' NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD CONSTRAINT "order_item_quantity_legacy_check" CHECK ("core"."order_item"."quantity" <= 2147483647 and "core"."order_item"."quantity" = trunc("core"."order_item"."quantity"));--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD CONSTRAINT "order_item_price_legacy_check" CHECK ("core"."order_item"."unit_price_snapshot" between -9999999999.99 and 9999999999.99 and "core"."order_item"."unit_price_snapshot" = trunc("core"."order_item"."unit_price_snapshot", 2));--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD CONSTRAINT "order_item_measure_legacy_check" CHECK ("core"."order_item"."measure_kind" = 'unit' and "core"."order_item"."quantity_unit" = 'unit' and "core"."order_item"."price_unit" = 'unit' and "core"."order_item"."conversion_version" = 'mass-si-1');--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD CONSTRAINT "pos_order_item_quantity_legacy_check" CHECK ("pos"."pos_order_item"."quantity" <= 2147483647 and "pos"."pos_order_item"."quantity" = trunc("pos"."pos_order_item"."quantity"));--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD CONSTRAINT "pos_order_item_price_legacy_check" CHECK ("pos"."pos_order_item"."unit_price_snapshot" between -9999999999.99 and 9999999999.99 and "pos"."pos_order_item"."unit_price_snapshot" = trunc("pos"."pos_order_item"."unit_price_snapshot", 2));--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD CONSTRAINT "pos_order_item_measure_legacy_check" CHECK ("pos"."pos_order_item"."measure_kind" = 'unit' and "pos"."pos_order_item"."quantity_unit" = 'unit' and "pos"."pos_order_item"."price_unit" = 'unit' and "pos"."pos_order_item"."conversion_version" = 'mass-si-1');