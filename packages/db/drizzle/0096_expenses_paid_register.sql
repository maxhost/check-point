-- Destructive retirement is authorized only for an unused, empty 0231 model.
-- Locks and all DDL share the drizzle migration transaction.
LOCK TABLE profitability.fixed_cost_allocation, profitability.fixed_cost_period,
  profitability.fixed_cost IN ACCESS EXCLUSIVE MODE;
LOCK TABLE core.business_module, core.business_membership IN SHARE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM profitability.fixed_cost)
    OR EXISTS (SELECT 1 FROM profitability.fixed_cost_period)
    OR EXISTS (SELECT 1 FROM profitability.fixed_cost_allocation)
    OR EXISTS (SELECT 1 FROM core.business_module WHERE module_id='profitability' AND enabled)
    OR EXISTS (SELECT 1 FROM core.business_membership WHERE 'profitability'=ANY(permissions))
  THEN RAISE EXCEPTION '0236 retirement blocked: costs=%, periods=%, allocations=%, activations=%, permissions=%',
    (SELECT count(*) FROM profitability.fixed_cost),
    (SELECT count(*) FROM profitability.fixed_cost_period),
    (SELECT count(*) FROM profitability.fixed_cost_allocation),
    (SELECT count(*) FROM core.business_module WHERE module_id='profitability' AND enabled),
    (SELECT count(*) FROM core.business_membership WHERE 'profitability'=ANY(permissions));
  END IF;
END $$;
--> statement-breakpoint
DELETE FROM core.business_module WHERE module_id='profitability' AND NOT enabled;
--> statement-breakpoint
CREATE SCHEMA "expenses";
--> statement-breakpoint
CREATE TABLE "expenses"."concept" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_concept_category_check" CHECK ("expenses"."concept"."category" in ('rent','gas','electricity','water','personnel','other')),
	CONSTRAINT "expense_concept_name_check" CHECK (char_length("expenses"."concept"."name") between 1 and 120 and char_length("expenses"."concept"."normalized_name") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "expenses"."expense_revision" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"expense_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"operation_type" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"line_index" integer NOT NULL,
	"request_digest" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_revision_operation_check" CHECK ("expenses"."expense_revision"."operation_type" in ('recorded','updated','deleted') and "expenses"."expense_revision"."line_index" between 0 and 29 and "expenses"."expense_revision"."revision" > 0 and "expenses"."expense_revision"."request_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "expenses"."expense" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"paid_on" date NOT NULL,
	"payment_time_zone" text NOT NULL,
	"amount_minor" numeric(18, 0) NOT NULL,
	"currency_code" text NOT NULL,
	"minor_unit" integer NOT NULL,
	"category" text NOT NULL,
	"concept_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_fixed" boolean NOT NULL,
	"location_id" uuid,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"revision_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expense_amount_check" CHECK ("expenses"."expense"."amount_minor" > 0 and "expenses"."expense"."amount_minor" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
	CONSTRAINT "expense_currency_check" CHECK ("expenses"."expense"."currency_code" ~ '^[A-Z]{3}$' and "expenses"."expense"."minor_unit" in (0,2)),
	CONSTRAINT "expense_paid_on_check" CHECK (isfinite("expenses"."expense"."paid_on") and "expenses"."expense"."paid_on" between '0001-01-01'::date and '9999-12-31'::date),
	CONSTRAINT "expense_name_check" CHECK (char_length("expenses"."expense"."name") between 1 and 120),
	CONSTRAINT "expense_revision_check" CHECK ("expenses"."expense"."revision" > 0),
	CONSTRAINT "expense_timezone_check" CHECK (char_length("expenses"."expense"."payment_time_zone") between 1 and 100)
);
--> statement-breakpoint
DROP TABLE "profitability"."fixed_cost_allocation";--> statement-breakpoint
DROP TABLE "profitability"."fixed_cost_period";--> statement-breakpoint
DROP TABLE "profitability"."fixed_cost";--> statement-breakpoint
ALTER TABLE "core"."module_event" ALTER COLUMN "location_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_concept_identity_unique" ON "expenses"."concept" USING btree ("business_id","category","normalized_name");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_concept_tenant_category_unique" ON "expenses"."concept" USING btree ("business_id","id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_revision_operation_unique" ON "expenses"."expense_revision" USING btree ("business_id","operation_id","line_index");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_revision_sequence_unique" ON "expenses"."expense_revision" USING btree ("business_id","expense_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_tenant_id_unique" ON "expenses"."expense" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_revision_id_unique" ON "expenses"."expense" USING btree ("revision_id");--> statement-breakpoint
CREATE INDEX "expense_register_idx" ON "expenses"."expense" USING btree ("business_id","paid_on","id");--> statement-breakpoint
ALTER TABLE "expenses"."concept" ADD CONSTRAINT "concept_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses"."expense_revision" ADD CONSTRAINT "expense_revision_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses"."expense_revision" ADD CONSTRAINT "expense_revision_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses"."expense_revision" ADD CONSTRAINT "expense_revision_tenant_fk" FOREIGN KEY ("business_id","expense_id") REFERENCES "expenses"."expense"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses"."expense" ADD CONSTRAINT "expense_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses"."expense" ADD CONSTRAINT "expense_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses"."expense" ADD CONSTRAINT "expense_concept_tenant_fk" FOREIGN KEY ("business_id","concept_id","category") REFERENCES "expenses"."concept"("business_id","id","category") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses"."expense" ADD CONSTRAINT "expense_location_tenant_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."module_event" ADD CONSTRAINT "module_event_sale_location_check" CHECK ("core"."module_event"."event_type" <> 'sale.closed' or "core"."module_event"."location_id" is not null);--> statement-breakpoint
DROP SCHEMA "profitability";
--> statement-breakpoint
CREATE FUNCTION expenses.revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' AND NOT EXISTS(SELECT 1 FROM core.business WHERE id=OLD.business_id) THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Expense revisions are immutable' USING ERRCODE='23514';
END $$;
--> statement-breakpoint
CREATE TRIGGER expense_revision_immutable BEFORE UPDATE OR DELETE ON expenses.expense_revision
  FOR EACH ROW EXECUTE FUNCTION expenses.revision_immutable();
