CREATE TABLE "stock"."item_location" (
	"business_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"last_unit_cost" numeric(14, 6),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_location_business_id_item_id_location_id_pk" PRIMARY KEY("business_id","item_id","location_id"),
	CONSTRAINT "stock_item_location_cost_check" CHECK ("stock"."item_location"."last_unit_cost" is null or "stock"."item_location"."last_unit_cost">=0)
);
--> statement-breakpoint
CREATE TABLE "recipes"."revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"lines" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."module_event_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"subscriber_id" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claim_token" uuid,
	"claim_until" timestamp with time zone,
	"diagnostic" text,
	"terminal_reason" text,
	"applied_at" timestamp with time zone,
	CONSTRAINT "module_event_delivery_state_check" CHECK ("core"."module_event_delivery"."state" in ('pending','processing','applied','skipped'))
);
--> statement-breakpoint
CREATE TABLE "core"."module_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"source_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."module_resource_version" (
	"business_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"slot" text NOT NULL,
	"version_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "module_resource_version_business_id_resource_type_resource_id_provider_id_slot_pk" PRIMARY KEY("business_id","resource_type","resource_id","provider_id","slot")
);
--> statement-breakpoint
ALTER TABLE "stock"."movement" DROP CONSTRAINT "stock_movement_kind_check";--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD COLUMN "source_order_id" uuid;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD COLUMN "source_line_id" uuid;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD COLUMN "product_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "core_location_business_id_unique" ON "core"."location" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_item_business_id_unique" ON "stock"."item" USING btree ("business_id","id");--> statement-breakpoint
ALTER TABLE "stock"."item_location" ADD CONSTRAINT "stock_item_location_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "stock"."item"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."item_location" ADD CONSTRAINT "stock_item_location_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes"."revision" ADD CONSTRAINT "revision_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."module_event_delivery" ADD CONSTRAINT "module_event_delivery_event_id_module_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."module_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."module_event" ADD CONSTRAINT "module_event_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."module_resource_version" ADD CONSTRAINT "module_resource_version_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "module_event_delivery_subscriber_unique" ON "core"."module_event_delivery" USING btree ("event_id","subscriber_id");--> statement-breakpoint
CREATE INDEX "module_event_delivery_due_idx" ON "core"."module_event_delivery" USING btree ("next_attempt_at","id") WHERE "core"."module_event_delivery"."state" = 'pending';--> statement-breakpoint
CREATE INDEX "module_event_delivery_claim_idx" ON "core"."module_event_delivery" USING btree ("claim_until","id") WHERE "core"."module_event_delivery"."state" = 'processing';--> statement-breakpoint
CREATE UNIQUE INDEX "module_event_source_unique" ON "core"."module_event" USING btree ("business_id","event_type","source_id");--> statement-breakpoint
CREATE INDEX "module_event_local_cut_idx" ON "core"."module_event" USING btree ("business_id","location_id","id");--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "stock_movement_business_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "stock"."item"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "stock_movement_business_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movement_consumption_unique" ON "stock"."movement" USING btree ("business_id","source_order_id","source_line_id","item_id") WHERE "stock"."movement"."kind"='consumption';--> statement-breakpoint
CREATE INDEX "stock_movement_local_idx" ON "stock"."movement" USING btree ("business_id","location_id","item_id");--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "stock_movement_consumption_check" CHECK ("stock"."movement"."kind" <> 'consumption' or ("stock"."movement"."quantity"<0 and "stock"."movement"."total_cost" is null and "stock"."movement"."counted_quantity" is null and "stock"."movement"."source_order_id" is not null and "stock"."movement"."source_line_id" is not null and "stock"."movement"."product_id" is not null));--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "stock_movement_kind_check" CHECK ("stock"."movement"."kind" in ('purchase', 'adjustment', 'consumption'));