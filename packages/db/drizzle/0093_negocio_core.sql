SELECT pg_advisory_xact_lock(2350150);
--> statement-breakpoint
CREATE TABLE "core"."business_configuration" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "business_configuration_revision_check" CHECK ("core"."business_configuration"."revision">0)
);
--> statement-breakpoint
CREATE TABLE "core"."sale_commission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"source_provider_id" text NOT NULL,
	"source_order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"collected_total" numeric(18, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"minor_unit" integer NOT NULL,
	"state" text NOT NULL,
	"reasons" jsonb NOT NULL,
	"total" numeric(18, 2),
	"original_total" jsonb,
	"total_normalization_adjustment" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_commission_state_check" CHECK ("core"."sale_commission"."state" in ('completo','incompleto')),
	CONSTRAINT "sale_commission_money_check" CHECK ("core"."sale_commission"."collected_total">=0 and "core"."sale_commission"."collected_total" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric) and "core"."sale_commission"."minor_unit" in (0,2) and "core"."sale_commission"."collected_total"=round("core"."sale_commission"."collected_total","core"."sale_commission"."minor_unit") and "core"."sale_commission"."currency_code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "core"."historical_event_handler" (
	"subscriber_id" text NOT NULL,
	"event_type" text NOT NULL,
	"handler_key" text NOT NULL,
	CONSTRAINT "historical_event_handler_subscriber_id_event_type_pk" PRIMARY KEY("subscriber_id","event_type")
);
--> statement-breakpoint
ALTER TABLE "pos"."payment_method_initialization" SET SCHEMA "core";
--> statement-breakpoint
ALTER TABLE "pos"."payment_method" SET SCHEMA "core";
--> statement-breakpoint
ALTER TABLE "profitability"."commission_revision" SET SCHEMA "core";
--> statement-breakpoint
ALTER TABLE "profitability"."payment_commission" SET SCHEMA "core";
--> statement-breakpoint
ALTER TABLE "core"."business_configuration" ADD CONSTRAINT "business_configuration_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."sale_commission" ADD CONSTRAINT "sale_commission_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."sale_commission" ADD CONSTRAINT "sale_commission_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sale_commission_source_unique" ON "core"."sale_commission" USING btree ("business_id","source_provider_id","source_order_id");--> statement-breakpoint

--> statement-breakpoint
ALTER FUNCTION pos.p1_method_identity() SET SCHEMA core;
--> statement-breakpoint
ALTER FUNCTION profitability.p1_immutable() SET SCHEMA core;
--> statement-breakpoint
ALTER TABLE core.payment_commission ALTER COLUMN event_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE core.payment_commission ADD COLUMN source_provider_id text NOT NULL DEFAULT 'pos';
--> statement-breakpoint
CREATE UNIQUE INDEX payment_commission_source_payment_unique ON core.payment_commission(business_id,source_provider_id,source_order_id,payment_id);
--> statement-breakpoint
ALTER TABLE pos.order_payment ALTER COLUMN method_provider_id SET DEFAULT 'core';
--> statement-breakpoint
CREATE TRIGGER sale_commission_immutable BEFORE UPDATE OR DELETE ON core.sale_commission FOR EACH ROW EXECUTE FUNCTION core.p1_immutable();
--> statement-breakpoint
INSERT INTO core.historical_event_handler(subscriber_id,event_type,handler_key) VALUES ('profitability','sale.closed','commission_snapshot');
--> statement-breakpoint
INSERT INTO core.module_resource_version(business_id,resource_type,resource_id,provider_id,slot,version_id,updated_at)
 SELECT business_id,resource_type,resource_id,'core',slot,version_id,updated_at FROM core.module_resource_version WHERE resource_type='payment_method' AND provider_id='profitability' AND slot='commission';
--> statement-breakpoint
DELETE FROM core.module_resource_version WHERE resource_type='payment_method' AND provider_id='profitability' AND slot='commission';
--> statement-breakpoint
WITH uninitialized AS (
 INSERT INTO core.payment_method_initialization(business_id,country_code,source)
 SELECT b.id,b.country_code,CASE WHEN EXISTS(SELECT 1 FROM core.payment_method_catalog c WHERE c.country_code=b.country_code) THEN 'country' ELSE 'base' END
 FROM core.business b ON CONFLICT(business_id) DO NOTHING RETURNING business_id,country_code,source
)
INSERT INTO core.payment_method(business_id,catalog_id,name,charge_shape,is_cash)
 SELECT i.business_id,c.id,c.name,c.charge_shape,c.is_cash FROM uninitialized i
 JOIN core.payment_method_catalog c ON ((i.source='country' AND c.country_code=i.country_code) OR (i.source='base' AND c.country_code IS NULL)) AND c.initially_suggested
 WHERE NOT EXISTS(SELECT 1 FROM core.payment_method m WHERE m.business_id=i.business_id);
