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
--> statement-breakpoint
ALTER TABLE "stock"."item_location" DROP CONSTRAINT "stock_item_location_item_fk";
--> statement-breakpoint
ALTER TABLE "stock"."item_location" DROP CONSTRAINT "stock_item_location_location_fk";
--> statement-breakpoint
ALTER TABLE "stock"."movement" DROP CONSTRAINT "stock_movement_business_item_fk";
--> statement-breakpoint
ALTER TABLE "stock"."movement" DROP CONSTRAINT "stock_movement_business_location_fk";
--> statement-breakpoint
ALTER TABLE "stock"."item_location" ADD CONSTRAINT "stock_item_location_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "stock"."item"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."item_location" ADD CONSTRAINT "stock_item_location_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "stock_movement_business_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "stock"."item"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock"."movement" ADD CONSTRAINT "stock_movement_business_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes"."line" ADD CONSTRAINT "recipes_line_business_item_fk" FOREIGN KEY ("business_id","item_id") REFERENCES "stock"."item"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_product_business_id_unique" ON "core"."product" USING btree ("business_id","id");--> statement-breakpoint
ALTER TABLE "recipes"."line" ADD CONSTRAINT "recipes_line_business_product_fk" FOREIGN KEY ("business_id","product_id") REFERENCES "core"."product"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD CONSTRAINT "pos_order_business_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
-- Temporary bridge for old single-location writers; never emits sale events.
CREATE FUNCTION stock.assign_legacy_location() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE destination uuid; active_count integer;
BEGIN
 IF NEW.location_id IS NULL THEN
   SELECT count(*),min(id::text)::uuid INTO active_count,destination FROM core.location WHERE business_id=NEW.business_id AND status='active';
   IF active_count<>1 THEN RAISE EXCEPTION 'stock local backfill requires explicit destination' USING ERRCODE='23514'; END IF;
   NEW.location_id:=destination;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stock_legacy_location BEFORE INSERT ON stock.movement FOR EACH ROW EXECUTE FUNCTION stock.assign_legacy_location();
CREATE FUNCTION stock.bridge_local_cost() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q numeric; c numeric;
BEGIN
 INSERT INTO stock.item_location(business_id,item_id,location_id) VALUES(NEW.business_id,NEW.item_id,NEW.location_id) ON CONFLICT DO NOTHING;
 PERFORM 1 FROM stock.item_location WHERE business_id=NEW.business_id AND item_id=NEW.item_id AND location_id=NEW.location_id FOR UPDATE;
 IF NEW.kind='purchase' AND NEW.total_cost IS NOT NULL THEN
   SELECT quantity,total_cost INTO q,c FROM stock.movement WHERE business_id=NEW.business_id AND item_id=NEW.item_id AND location_id=NEW.location_id AND kind='purchase' AND total_cost IS NOT NULL ORDER BY occurred_at DESC,created_at DESC,id DESC LIMIT 1;
   UPDATE stock.item_location SET last_unit_cost=round(c/q,6),updated_at=now() WHERE business_id=NEW.business_id AND item_id=NEW.item_id AND location_id=NEW.location_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER stock_bridge_cost AFTER INSERT ON stock.movement FOR EACH ROW EXECUTE FUNCTION stock.bridge_local_cost();
CREATE FUNCTION recipes.bridge_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bid uuid; pid uuid; rid uuid; snapshot jsonb;
BEGIN
 bid:=coalesce(NEW.business_id,OLD.business_id);pid:=coalesce(NEW.product_id,OLD.product_id);
 -- Cascading business cleanup has no surviving core parent and creates no dangling pointer.
 IF NOT EXISTS(SELECT 1 FROM core.business WHERE id=bid) THEN RETURN NULL; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('itemId',l.item_id,'unit',i.unit,'quantity',l.quantity::text) ORDER BY l.position,l.id),'[]'::jsonb) INTO snapshot FROM recipes.line l JOIN stock.item i ON i.id=l.item_id AND i.business_id=l.business_id WHERE l.business_id=bid AND l.product_id=pid;
 INSERT INTO recipes.revision(business_id,product_id,lines) VALUES(bid,pid,snapshot) RETURNING id INTO rid;
 INSERT INTO core.module_resource_version(business_id,resource_type,resource_id,provider_id,slot,version_id) VALUES(bid,'product',pid,'recipes','recipe',rid) ON CONFLICT(business_id,resource_type,resource_id,provider_id,slot) DO UPDATE SET version_id=excluded.version_id,updated_at=now();
 RETURN NULL;
END $$;
CREATE TRIGGER recipes_bridge_revision AFTER INSERT OR UPDATE OR DELETE ON recipes.line FOR EACH ROW EXECUTE FUNCTION recipes.bridge_revision();
CREATE FUNCTION recipes.reject_revision_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM core.business WHERE id=OLD.business_id) THEN RETURN OLD; END IF; RAISE EXCEPTION 'Recipe revisions are immutable' USING ERRCODE='23514'; END $$;
CREATE TRIGGER recipes_revision_immutable BEFORE UPDATE OR DELETE ON recipes.revision FOR EACH ROW EXECUTE FUNCTION recipes.reject_revision_update();
