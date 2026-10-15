CREATE TABLE "core"."payment_method_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"country_code" text,
	"name" text NOT NULL,
	"charge_shape" text NOT NULL,
	"is_cash" boolean DEFAULT false NOT NULL,
	"initially_suggested" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "payment_catalog_name_check" CHECK (char_length("core"."payment_method_catalog"."name") between 1 and 120),
	CONSTRAINT "payment_catalog_country_check" CHECK ("core"."payment_method_catalog"."country_code" is null or "core"."payment_method_catalog"."country_code" ~ '^[A-Z]{2}$'),
	CONSTRAINT "payment_catalog_shape_check" CHECK ("core"."payment_method_catalog"."charge_shape" in ('none','percent','fixed','percent_and_fixed')),
	CONSTRAINT "payment_catalog_cash_check" CHECK (not "core"."payment_method_catalog"."is_cash" or "core"."payment_method_catalog"."charge_shape"='none')
);--> statement-breakpoint
CREATE TABLE "profitability"."commission_revision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"method_provider_id" text NOT NULL,
	"method_id" uuid NOT NULL,
	"charge_shape" text NOT NULL,
	"percent" numeric(9, 6),
	"fixed" numeric(18, 2),
	"original_fixed" jsonb,
	"fixed_normalization_adjustment" jsonb,
	"currency_code" text,
	"minor_unit" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_revision_shape_check" CHECK ("profitability"."commission_revision"."charge_shape" in ('none','percent','fixed','percent_and_fixed')),
	CONSTRAINT "commission_revision_percent_check" CHECK ("profitability"."commission_revision"."percent" is null or ("profitability"."commission_revision"."percent" between 0 and 100 and "profitability"."commission_revision"."percent" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))),
	CONSTRAINT "commission_revision_fixed_check" CHECK ("profitability"."commission_revision"."fixed" is null or ("profitability"."commission_revision"."fixed">=0 and "profitability"."commission_revision"."fixed" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))),
	CONSTRAINT "commission_revision_components_check" CHECK (("profitability"."commission_revision"."charge_shape" in ('percent','percent_and_fixed') or "profitability"."commission_revision"."percent" is null) and ("profitability"."commission_revision"."charge_shape" in ('fixed','percent_and_fixed') or "profitability"."commission_revision"."fixed" is null) and (("profitability"."commission_revision"."fixed" is null and "profitability"."commission_revision"."original_fixed" is null and "profitability"."commission_revision"."fixed_normalization_adjustment" is null and "profitability"."commission_revision"."currency_code" is null and "profitability"."commission_revision"."minor_unit" is null) or ("profitability"."commission_revision"."fixed" is not null and "profitability"."commission_revision"."original_fixed" is not null and "profitability"."commission_revision"."fixed_normalization_adjustment" is not null and "profitability"."commission_revision"."currency_code" ~ '^[A-Z]{3}$' and "profitability"."commission_revision"."minor_unit" in (0,2) and "profitability"."commission_revision"."fixed"=round("profitability"."commission_revision"."fixed","profitability"."commission_revision"."minor_unit"))))
);--> statement-breakpoint
CREATE TABLE "profitability"."payment_commission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"source_order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"method_provider_id" text NOT NULL,
	"method_id" uuid NOT NULL,
	"method_name" text NOT NULL,
	"charge_shape" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"minor_unit" integer NOT NULL,
	"commission_revision_id" uuid,
	"percent" numeric(9, 6),
	"original_fixed" jsonb,
	"fixed_currency_code" text,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_commission_amount_check" CHECK ("profitability"."payment_commission"."amount">0 and "profitability"."payment_commission"."amount" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
	CONSTRAINT "payment_commission_currency_check" CHECK ("profitability"."payment_commission"."currency_code" ~ '^[A-Z]{3}$' and "profitability"."payment_commission"."minor_unit" in (0,2) and "profitability"."payment_commission"."amount"=round("profitability"."payment_commission"."amount","profitability"."payment_commission"."minor_unit"))
);--> statement-breakpoint
CREATE TABLE "pos"."order_payment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"pos_order_id" uuid NOT NULL,
	"method_id" uuid NOT NULL,
	"method_provider_id" text DEFAULT 'pos' NOT NULL,
	"position" integer NOT NULL,
	"method_name" text NOT NULL,
	"charge_shape" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"original_amount" jsonb NOT NULL,
	"normalization_adjustment" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_payment_amount_check" CHECK ("pos"."order_payment"."amount">0 and "pos"."order_payment"."amount" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
	CONSTRAINT "pos_payment_position_check" CHECK ("pos"."order_payment"."position">=0),
	CONSTRAINT "pos_payment_shape_check" CHECK ("pos"."order_payment"."charge_shape" in ('none','percent','fixed','percent_and_fixed'))
);--> statement-breakpoint
CREATE TABLE "pos"."payment_method_initialization" (
	"business_id" uuid PRIMARY KEY NOT NULL,
	"country_code" text NOT NULL,
	"source" text NOT NULL,
	"initialized_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_payment_initialization_source_check" CHECK ("pos"."payment_method_initialization"."source" in ('country','base'))
);--> statement-breakpoint
CREATE TABLE "pos"."payment_method" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"catalog_id" uuid,
	"name" text NOT NULL,
	"charge_shape" text NOT NULL,
	"is_cash" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pos_method_name_check" CHECK (char_length(btrim("pos"."payment_method"."name")) between 1 and 120),
	CONSTRAINT "pos_method_shape_check" CHECK ("pos"."payment_method"."charge_shape" in ('none','percent','fixed','percent_and_fixed')),
	CONSTRAINT "pos_method_status_check" CHECK ("pos"."payment_method"."status" in ('active','archived')),
	CONSTRAINT "pos_method_cash_check" CHECK (not "pos"."payment_method"."is_cash" or ("pos"."payment_method"."status"='active' and "pos"."payment_method"."charge_shape"='none'))
);--> statement-breakpoint
ALTER TABLE "pos"."pos_order_item" ADD COLUMN "financial_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "pos"."pos_order" ADD COLUMN "settlement" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_catalog_key_unique" ON "core"."payment_method_catalog" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_revision_business_id_unique" ON "profitability"."commission_revision" USING btree ("business_id","id");--> statement-breakpoint
CREATE INDEX "commission_revision_method_idx" ON "profitability"."commission_revision" USING btree ("business_id","method_provider_id","method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_commission_event_payment_unique" ON "profitability"."payment_commission" USING btree ("business_id","event_id","payment_id");--> statement-breakpoint
CREATE INDEX "payment_commission_sale_idx" ON "profitability"."payment_commission" USING btree ("business_id","location_id","source_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_payment_business_id_unique" ON "pos"."order_payment" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_payment_order_method_unique" ON "pos"."order_payment" USING btree ("business_id","pos_order_id","method_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_payment_order_position_unique" ON "pos"."order_payment" USING btree ("pos_order_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_method_business_id_unique" ON "pos"."payment_method" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "pos_method_active_name_unique" ON "pos"."payment_method" USING btree ("business_id",lower(btrim("name"))) WHERE "pos"."payment_method"."status"='active';--> statement-breakpoint
CREATE UNIQUE INDEX "pos_method_cash_unique" ON "pos"."payment_method" USING btree ("business_id") WHERE "pos"."payment_method"."is_cash";--> statement-breakpoint
CREATE UNIQUE INDEX "pos_method_catalog_active_unique" ON "pos"."payment_method" USING btree ("business_id","catalog_id") WHERE "pos"."payment_method"."status"='active';--> statement-breakpoint
CREATE UNIQUE INDEX "pos_order_business_id_unique" ON "pos"."pos_order" USING btree ("business_id","id");--> statement-breakpoint
ALTER TABLE "profitability"."commission_revision" ADD CONSTRAINT "commission_revision_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."payment_commission" ADD CONSTRAINT "payment_commission_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."order_payment" ADD CONSTRAINT "order_payment_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."order_payment" ADD CONSTRAINT "pos_payment_order_fk" FOREIGN KEY ("business_id","pos_order_id") REFERENCES "pos"."pos_order"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."order_payment" ADD CONSTRAINT "pos_payment_method_fk" FOREIGN KEY ("business_id","method_id") REFERENCES "pos"."payment_method"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."payment_method_initialization" ADD CONSTRAINT "payment_method_initialization_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."payment_method" ADD CONSTRAINT "payment_method_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pos"."payment_method" ADD CONSTRAINT "payment_method_catalog_id_payment_method_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "core"."payment_method_catalog"("id") ON DELETE no action ON UPDATE no action;
