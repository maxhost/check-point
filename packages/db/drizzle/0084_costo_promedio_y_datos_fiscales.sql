ALTER TABLE "core"."business" ADD COLUMN "charges_vat" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "sale_vat_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "recovers_purchase_vat" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock"."item_location" ADD COLUMN "weighted_average_unit_cost" numeric(14, 6);--> statement-breakpoint
ALTER TABLE "stock"."item_location" ADD COLUMN "weighted_average_initialized_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_sale_vat_rate_check" CHECK ("core"."business"."sale_vat_rate" is null or "core"."business"."sale_vat_rate" between 0 and 100);--> statement-breakpoint
ALTER TABLE "core"."business" ADD CONSTRAINT "business_charges_vat_rate_check" CHECK (not "core"."business"."charges_vat" or "core"."business"."sale_vat_rate" is not null);--> statement-breakpoint
ALTER TABLE "stock"."item_location" ADD CONSTRAINT "stock_item_location_average_cost_check" CHECK ("stock"."item_location"."weighted_average_unit_cost" is null or "stock"."item_location"."weighted_average_unit_cost" >= 0);