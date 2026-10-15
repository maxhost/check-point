-- Composite referenced keys must exist before FK creation (Drizzle generated FK before unique indexes).
CREATE TABLE "recipes"."composition_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name_at_composition" text NOT NULL,
	"is_combo" boolean NOT NULL,
	"recipes" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes"."recipe_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "recipes_recipe_line_quantity_check" CHECK ("recipes"."recipe_line"."quantity">0 and "recipes"."recipe_line"."quantity" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))
);
--> statement-breakpoint
CREATE TABLE "recipes"."recipe_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"name" text NOT NULL,
	"lines" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes"."product_composition" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"revision_id" uuid NOT NULL,
	"resolution_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes"."consumption_source" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"source_order_id" uuid NOT NULL,
	"source_line_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"resolution_id" uuid NOT NULL,
	"composition_revision_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"recipe_revision_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"recipe_quantity" numeric(30, 3) NOT NULL,
	"exact_quantity" numeric(20, 6) NOT NULL,
	"allocated_quantity" numeric(14, 3) NOT NULL,
	CONSTRAINT "recipes_consumption_source_quantities_check" CHECK ("recipes"."consumption_source"."recipe_quantity">0 and "recipes"."consumption_source"."exact_quantity">0 and "recipes"."consumption_source"."allocated_quantity">=0 and "recipes"."consumption_source"."recipe_quantity"<>'NaN'::numeric and "recipes"."consumption_source"."exact_quantity"<>'NaN'::numeric and "recipes"."consumption_source"."allocated_quantity"<>'NaN'::numeric)
);
--> statement-breakpoint
CREATE TABLE "recipes"."recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"revision_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_recipe_name_check" CHECK ("recipes"."recipe"."name"=btrim("recipes"."recipe"."name") and char_length("recipes"."recipe"."name") between 1 and 120),
	CONSTRAINT "recipes_recipe_status_check" CHECK ("recipes"."recipe"."status" in ('active','archived'))
);
--> statement-breakpoint
CREATE TABLE "recipes"."migration_mapping" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"original_name" text NOT NULL,
	"category_name" text,
	"assigned_name" text NOT NULL,
	"reason" text NOT NULL,
	"source_fingerprint" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes"."sale_resolution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"composition_revision_id" uuid NOT NULL,
	"components" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_composition_revision_business_id_unique" ON "recipes"."composition_revision" USING btree ("business_id","id");
--> statement-breakpoint
CREATE INDEX "recipes_composition_revision_history_idx" ON "recipes"."composition_revision" USING btree ("business_id","product_id","created_at","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_recipe_line_item_unique" ON "recipes"."recipe_line" USING btree ("recipe_id","item_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_recipe_revision_business_id_unique" ON "recipes"."recipe_revision" USING btree ("business_id","id");
--> statement-breakpoint
CREATE INDEX "recipes_recipe_revision_history_idx" ON "recipes"."recipe_revision" USING btree ("business_id","recipe_id","created_at","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_consumption_source_unique" ON "recipes"."consumption_source" USING btree ("business_id","source_order_id","source_line_id","item_id","recipe_revision_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_recipe_business_id_unique" ON "recipes"."recipe" USING btree ("business_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_recipe_active_name_unique" ON "recipes"."recipe" USING btree ("business_id",lower("name")) WHERE "recipes"."recipe"."status"='active';
--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_sale_resolution_business_id_unique" ON "recipes"."sale_resolution" USING btree ("business_id","id");
--> statement-breakpoint
ALTER TABLE "recipes"."composition_revision" ADD CONSTRAINT "composition_revision_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."recipe_line" ADD CONSTRAINT "recipe_line_business_id_recipe_id_recipe_business_id_id_fk" FOREIGN KEY ("business_id","recipe_id") REFERENCES "recipes"."recipe"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."recipe_line" ADD CONSTRAINT "recipe_line_business_id_item_id_item_business_id_id_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "stock"."item"("business_id","id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."recipe_revision" ADD CONSTRAINT "recipe_revision_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."recipe_revision" ADD CONSTRAINT "recipe_revision_business_id_recipe_id_recipe_business_id_id_fk" FOREIGN KEY ("business_id","recipe_id") REFERENCES "recipes"."recipe"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."product_composition" ADD CONSTRAINT "product_composition_business_id_product_id_product_business_id_id_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "core"."product"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."product_composition" ADD CONSTRAINT "product_composition_business_id_revision_id_composition_revision_business_id_id_fk" FOREIGN KEY ("business_id","revision_id") REFERENCES "recipes"."composition_revision"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."product_composition" ADD CONSTRAINT "product_composition_business_id_resolution_id_sale_resolution_business_id_id_fk" FOREIGN KEY ("business_id","resolution_id") REFERENCES "recipes"."sale_resolution"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."consumption_source" ADD CONSTRAINT "consumption_source_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."consumption_source" ADD CONSTRAINT "consumption_source_business_id_resolution_id_sale_resolution_business_id_id_fk" FOREIGN KEY ("business_id","resolution_id") REFERENCES "recipes"."sale_resolution"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."consumption_source" ADD CONSTRAINT "consumption_source_business_id_composition_revision_id_composition_revision_business_id_id_fk" FOREIGN KEY ("business_id","composition_revision_id") REFERENCES "recipes"."composition_revision"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."consumption_source" ADD CONSTRAINT "consumption_source_business_id_recipe_revision_id_recipe_revision_business_id_id_fk" FOREIGN KEY ("business_id","recipe_revision_id") REFERENCES "recipes"."recipe_revision"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."recipe" ADD CONSTRAINT "recipe_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."migration_mapping" ADD CONSTRAINT "migration_mapping_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."migration_mapping" ADD CONSTRAINT "migration_mapping_business_id_recipe_id_recipe_business_id_id_fk" FOREIGN KEY ("business_id","recipe_id") REFERENCES "recipes"."recipe"("business_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."sale_resolution" ADD CONSTRAINT "sale_resolution_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recipes"."sale_resolution" ADD CONSTRAINT "sale_resolution_business_id_composition_revision_id_composition_revision_business_id_id_fk" FOREIGN KEY ("business_id","composition_revision_id") REFERENCES "recipes"."composition_revision"("business_id","id") ON DELETE cascade ON UPDATE no action;
