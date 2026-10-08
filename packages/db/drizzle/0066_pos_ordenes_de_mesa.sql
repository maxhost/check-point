-- Spec 0169 / ADR 0130: ordenes de mesa del POS.
-- core.pos_order + core.pos_order_item: la orden abierta vive aparte de core.order (que sigue inmutable);
-- precio fijo al agregar (snapshot por linea), `version` optimista, `order_id` solo al cerrar con pase.
-- core.business.pos_enabled: el modulo, apagado por defecto (aditiva: el codigo viejo no la lee).
-- business_membership_permissions_check se recrea con `pos` (sale de PERMISSIONS).
-- Grants: ninguno nuevo; `checkpass_consumer` no lee el POS.
CREATE TABLE "core"."pos_order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pos_order_id" uuid NOT NULL,
	"product_id" uuid,
	"name_snapshot" text NOT NULL,
	"unit_price_snapshot" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "core_pos_order_item_price_check" CHECK ("core"."pos_order_item"."unit_price_snapshot" >= 0),
	CONSTRAINT "core_pos_order_item_quantity_check" CHECK ("core"."pos_order_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."pos_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid,
	"table_label" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_user_id" text NOT NULL,
	"closed_by_user_id" text,
	"closed_at" timestamp with time zone,
	"order_id" uuid,
	"close_request_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_pos_order_status_check" CHECK ("core"."pos_order"."status" in ('open', 'closed', 'voided')),
	CONSTRAINT "core_pos_order_version_check" CHECK ("core"."pos_order"."version" >= 1),
	CONSTRAINT "core_pos_order_table_label_check" CHECK (char_length("core"."pos_order"."table_label") between 1 and 60),
	CONSTRAINT "core_pos_order_open_check" CHECK (("core"."pos_order"."status" = 'open') = ("core"."pos_order"."closed_at" is null and "core"."pos_order"."closed_by_user_id" is null and "core"."pos_order"."close_request_id" is null)),
	CONSTRAINT "core_pos_order_order_closed_check" CHECK ("core"."pos_order"."order_id" is null or "core"."pos_order"."status" = 'closed')
);
--> statement-breakpoint
ALTER TABLE "core"."business_membership" DROP CONSTRAINT "business_membership_permissions_check";--> statement-breakpoint
ALTER TABLE "core"."business" ADD COLUMN "pos_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."pos_order_item" ADD CONSTRAINT "pos_order_item_pos_order_id_pos_order_id_fk" FOREIGN KEY ("pos_order_id") REFERENCES "core"."pos_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pos_order_item" ADD CONSTRAINT "pos_order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "core"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pos_order" ADD CONSTRAINT "pos_order_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pos_order" ADD CONSTRAINT "pos_order_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pos_order" ADD CONSTRAINT "pos_order_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pos_order" ADD CONSTRAINT "pos_order_closed_by_user_id_user_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."pos_order" ADD CONSTRAINT "pos_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_pos_order_item_order_idx" ON "core"."pos_order_item" USING btree ("pos_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_pos_order_order_unique" ON "core"."pos_order" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_pos_order_close_request_unique" ON "core"."pos_order" USING btree ("business_id","close_request_id");--> statement-breakpoint
CREATE INDEX "core_pos_order_business_status_idx" ON "core"."pos_order" USING btree ("business_id","status","created_at");--> statement-breakpoint
ALTER TABLE "core"."business_membership" ADD CONSTRAINT "business_membership_permissions_check" CHECK ("core"."business_membership"."permissions" <@ array['brand', 'catalog', 'counter', 'locations', 'loyalty', 'marketing', 'pos', 'staff']::text[]);