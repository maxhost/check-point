CREATE SCHEMA "stock";
--> statement-breakpoint
CREATE SCHEMA "recipes";
--> statement-breakpoint
CREATE TABLE "core"."business_module" (
	"business_id" uuid NOT NULL,
	"module_id" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_module_business_id_module_id_pk" PRIMARY KEY("business_id","module_id"),
	CONSTRAINT "core_business_module_module_id_check" CHECK (char_length("core"."business_module"."module_id") between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "stock"."item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"last_unit_cost" numeric(14, 6),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_item_name_check" CHECK (char_length("stock"."item"."name") between 1 and 80),
	CONSTRAINT "stock_item_unit_check" CHECK ("stock"."item"."unit" in ('g', 'ml', 'unit')),
	CONSTRAINT "stock_item_status_check" CHECK ("stock"."item"."status" in ('active', 'archived')),
	CONSTRAINT "stock_item_last_unit_cost_check" CHECK ("stock"."item"."last_unit_cost" is null or "stock"."item"."last_unit_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stock"."movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"total_cost" numeric(12, 2),
	"counted_quantity" numeric(14, 3),
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movement_kind_check" CHECK ("stock"."movement"."kind" in ('purchase', 'adjustment')),
	CONSTRAINT "stock_movement_purchase_check" CHECK ("stock"."movement"."kind" <> 'purchase' or ("stock"."movement"."quantity" > 0 and "stock"."movement"."total_cost" is not null and "stock"."movement"."total_cost" >= 0 and "stock"."movement"."counted_quantity" is null)),
	CONSTRAINT "stock_movement_adjustment_check" CHECK ("stock"."movement"."kind" <> 'adjustment' or ("stock"."movement"."total_cost" is null and "stock"."movement"."counted_quantity" is not null and "stock"."movement"."counted_quantity" >= 0)),
	CONSTRAINT "stock_movement_note_check" CHECK ("stock"."movement"."note" is null or char_length("stock"."movement"."note") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "recipes"."line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "recipes_line_quantity_check" CHECK ("recipes"."line"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "core"."business_module" ADD CONSTRAINT "business_module_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."item" ADD CONSTRAINT "item_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "movement_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "movement_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "stock"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes"."line" ADD CONSTRAINT "line_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes"."line" ADD CONSTRAINT "line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "core"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes"."line" ADD CONSTRAINT "line_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "stock"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_item_active_name_unique" ON "stock"."item" USING btree ("business_id",lower("name")) WHERE "stock"."item"."status" = 'active';--> statement-breakpoint
CREATE INDEX "stock_movement_item_occurred_idx" ON "stock"."movement" USING btree ("item_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_line_product_item_unique" ON "recipes"."line" USING btree ("product_id","item_id");