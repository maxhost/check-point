CREATE SCHEMA "profitability";
--> statement-breakpoint
CREATE TABLE "core"."staff_location_assignment" (
	"business_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	CONSTRAINT "staff_location_assignment_business_id_period_id_location_id_pk" PRIMARY KEY("business_id","period_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "core"."staff_location_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"from_month" date NOT NULL,
	"until_month" date,
	CONSTRAINT "staff_location_period_month_check" CHECK (extract(day from "core"."staff_location_period"."from_month") = 1 and ("core"."staff_location_period"."until_month" is null or (extract(day from "core"."staff_location_period"."until_month") = 1 and "core"."staff_location_period"."until_month" > "core"."staff_location_period"."from_month")))
);
--> statement-breakpoint
CREATE TABLE "core"."staff_person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"membership_user_id" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_person_name_check" CHECK ("core"."staff_person"."name" = btrim("core"."staff_person"."name") and char_length("core"."staff_person"."name") between 1 and 80),
	CONSTRAINT "staff_person_revision_check" CHECK ("core"."staff_person"."revision" > 0)
);
--> statement-breakpoint
CREATE TABLE "profitability"."fixed_cost_allocation" (
	"business_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"monthly_amount" numeric(18, 2) NOT NULL,
	CONSTRAINT "fixed_cost_allocation_business_id_period_id_location_id_pk" PRIMARY KEY("business_id","period_id","location_id"),
	CONSTRAINT "profitability_allocation_amount_check" CHECK ("profitability"."fixed_cost_allocation"."monthly_amount" >= 0 and "profitability"."fixed_cost_allocation"."monthly_amount" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric))
);
--> statement-breakpoint
CREATE TABLE "profitability"."fixed_cost_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"cost_id" uuid NOT NULL,
	"from_month" date NOT NULL,
	"until_month" date,
	"label" text NOT NULL,
	"monthly_total" numeric(18, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"minor_unit" integer NOT NULL,
	"distribution" text NOT NULL,
	"staff_location_period_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profitability_period_month_check" CHECK (extract(day from "profitability"."fixed_cost_period"."from_month") = 1 and ("profitability"."fixed_cost_period"."until_month" is null or (extract(day from "profitability"."fixed_cost_period"."until_month") = 1 and "profitability"."fixed_cost_period"."until_month" > "profitability"."fixed_cost_period"."from_month"))),
	CONSTRAINT "profitability_period_label_check" CHECK (char_length("profitability"."fixed_cost_period"."label") between 1 and 120),
	CONSTRAINT "profitability_period_amount_check" CHECK ("profitability"."fixed_cost_period"."monthly_total" >= 0 and "profitability"."fixed_cost_period"."monthly_total" not in ('NaN'::numeric,'Infinity'::numeric,'-Infinity'::numeric)),
	CONSTRAINT "profitability_period_currency_check" CHECK ("profitability"."fixed_cost_period"."currency_code" ~ '^[A-Z]{3}$' and "profitability"."fixed_cost_period"."minor_unit" in (0,2) and "profitability"."fixed_cost_period"."monthly_total" = round("profitability"."fixed_cost_period"."monthly_total", "profitability"."fixed_cost_period"."minor_unit")),
	CONSTRAINT "profitability_period_distribution_check" CHECK ("profitability"."fixed_cost_period"."distribution" in ('single','equal','manual'))
);
--> statement-breakpoint
CREATE TABLE "profitability"."fixed_cost" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"person_id" uuid,
	"end_month" date,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profitability_cost_kind_check" CHECK ("profitability"."fixed_cost"."kind" in ('rent','gas','electricity','water','other','personnel')),
	CONSTRAINT "profitability_cost_person_check" CHECK (("profitability"."fixed_cost"."kind" = 'personnel') = ("profitability"."fixed_cost"."person_id" is not null)),
	CONSTRAINT "profitability_cost_end_check" CHECK ("profitability"."fixed_cost"."end_month" is null or extract(day from "profitability"."fixed_cost"."end_month") = 1),
	CONSTRAINT "profitability_cost_revision_check" CHECK ("profitability"."fixed_cost"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "core"."staff_location_assignment" ADD CONSTRAINT "staff_location_assignment_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_location_assignment" ADD CONSTRAINT "staff_location_assignment_period_fk" FOREIGN KEY ("business_id","period_id") REFERENCES "core"."staff_location_period"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_location_assignment" ADD CONSTRAINT "staff_location_assignment_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_location_period" ADD CONSTRAINT "staff_location_period_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_location_period" ADD CONSTRAINT "staff_location_period_person_fk" FOREIGN KEY ("business_id","person_id") REFERENCES "core"."staff_person"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_person" ADD CONSTRAINT "staff_person_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."staff_person" ADD CONSTRAINT "staff_person_membership_fk" FOREIGN KEY ("business_id","membership_user_id") REFERENCES "core"."business_membership"("business_id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost_allocation" ADD CONSTRAINT "fixed_cost_allocation_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost_allocation" ADD CONSTRAINT "profitability_allocation_period_fk" FOREIGN KEY ("business_id","period_id") REFERENCES "profitability"."fixed_cost_period"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost_allocation" ADD CONSTRAINT "profitability_allocation_location_fk" FOREIGN KEY ("business_id","location_id") REFERENCES "core"."location"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost_period" ADD CONSTRAINT "fixed_cost_period_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost_period" ADD CONSTRAINT "profitability_period_cost_fk" FOREIGN KEY ("business_id","cost_id") REFERENCES "profitability"."fixed_cost"("business_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost_period" ADD CONSTRAINT "profitability_period_staff_location_fk" FOREIGN KEY ("business_id","staff_location_period_id") REFERENCES "core"."staff_location_period"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost" ADD CONSTRAINT "fixed_cost_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profitability"."fixed_cost" ADD CONSTRAINT "profitability_cost_person_fk" FOREIGN KEY ("business_id","person_id") REFERENCES "core"."staff_person"("business_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_location_period_business_id_unique" ON "core"."staff_location_period" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_location_period_start_unique" ON "core"."staff_location_period" USING btree ("business_id","person_id","from_month");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_person_business_id_unique" ON "core"."staff_person" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_person_membership_unique" ON "core"."staff_person" USING btree ("business_id","membership_user_id");--> statement-breakpoint
CREATE INDEX "profitability_allocation_local_idx" ON "profitability"."fixed_cost_allocation" USING btree ("business_id","location_id","period_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profitability_period_business_id_unique" ON "profitability"."fixed_cost_period" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "profitability_period_start_unique" ON "profitability"."fixed_cost_period" USING btree ("business_id","cost_id","from_month");--> statement-breakpoint
CREATE UNIQUE INDEX "profitability_cost_business_id_unique" ON "profitability"."fixed_cost" USING btree ("business_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "profitability_cost_person_unique" ON "profitability"."fixed_cost" USING btree ("business_id","person_id") WHERE "profitability"."fixed_cost"."kind" = 'personnel';--> statement-breakpoint
-- Identity only: no credentials, permissions, locations or monetary history are fabricated.
INSERT INTO "core"."staff_person" ("business_id", "name", "membership_user_id")
SELECT m."business_id", u."name", m."user_id"
FROM "core"."business_membership" m
JOIN "merchant_auth"."user" u ON u."id" = m."user_id"
WHERE m."role" = 'staff'
ON CONFLICT ("business_id", "membership_user_id") DO NOTHING;
