-- Spec 0182 / ADR 0131: mesas del local.
-- core.dining_table: nombre unico entre las activas del local, plazas opcionales, se archiva y nunca se borra.
-- core.pos_order.dining_table_id: aditiva y nullable (el codigo viejo no la lee); el unico parcial impide dos
-- ordenes abiertas en la misma mesa.
-- Grants: ninguno nuevo; `checkpass_consumer` no lee el POS ni las mesas.
CREATE TABLE "core"."dining_table" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"seats" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_dining_table_name_check" CHECK (char_length("core"."dining_table"."name") between 1 and 60),
	CONSTRAINT "core_dining_table_seats_check" CHECK ("core"."dining_table"."seats" is null or "core"."dining_table"."seats" between 1 and 99),
	CONSTRAINT "core_dining_table_status_check" CHECK ("core"."dining_table"."status" in ('active', 'archived'))
);
--> statement-breakpoint
ALTER TABLE "core"."pos_order" ADD COLUMN "dining_table_id" uuid;--> statement-breakpoint
ALTER TABLE "core"."dining_table" ADD CONSTRAINT "dining_table_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."dining_table" ADD CONSTRAINT "dining_table_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_dining_table_active_name_unique" ON "core"."dining_table" USING btree ("location_id",lower("name")) WHERE "core"."dining_table"."status" = 'active';--> statement-breakpoint
CREATE INDEX "core_dining_table_location_idx" ON "core"."dining_table" USING btree ("location_id","status","sort_order");--> statement-breakpoint
ALTER TABLE "core"."pos_order" ADD CONSTRAINT "pos_order_dining_table_id_dining_table_id_fk" FOREIGN KEY ("dining_table_id") REFERENCES "core"."dining_table"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_pos_order_open_table_unique" ON "core"."pos_order" USING btree ("dining_table_id") WHERE "core"."pos_order"."status" = 'open';