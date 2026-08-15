CREATE TABLE "core"."order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid,
	"name_snapshot" text NOT NULL,
	"unit_price_snapshot" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	CONSTRAINT "core_order_item_quantity_check" CHECK ("core"."order_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "core"."order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid,
	"program_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"currency_code" text NOT NULL,
	"note" text,
	"accrual_kind" text NOT NULL,
	"units_granted" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"created_by_user_id" text NOT NULL,
	"client_request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "core_order_mode_check" CHECK ("core"."order"."mode" in ('detailed', 'quick')),
	CONSTRAINT "core_order_accrual_kind_check" CHECK ("core"."order"."accrual_kind" in ('points', 'stamps')),
	CONSTRAINT "core_order_total_check" CHECK ("core"."order"."total" >= 0),
	CONSTRAINT "core_order_units_granted_check" CHECK ("core"."order"."units_granted" >= 0)
);
--> statement-breakpoint
ALTER TABLE "consumer"."program_membership" ADD COLUMN "points_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "consumer"."program_membership" ADD COLUMN "stamps_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD CONSTRAINT "order_item_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order_item" ADD CONSTRAINT "order_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "core"."product"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order" ADD CONSTRAINT "order_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order" ADD CONSTRAINT "order_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "core"."location"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order" ADD CONSTRAINT "order_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order" ADD CONSTRAINT "order_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order" ADD CONSTRAINT "order_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."order" ADD CONSTRAINT "order_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "merchant_auth"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_order_item_order_idx" ON "core"."order_item" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "core_order_business_client_request_unique" ON "core"."order" USING btree ("business_id","client_request_id");--> statement-breakpoint
CREATE INDEX "core_order_membership_idx" ON "core"."order" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "core_order_business_idx" ON "core"."order" USING btree ("business_id","created_at");--> statement-breakpoint
ALTER TABLE "consumer"."program_membership" ADD CONSTRAINT "consumer_program_membership_points_balance_check" CHECK ("consumer"."program_membership"."points_balance" >= 0);--> statement-breakpoint
ALTER TABLE "consumer"."program_membership" ADD CONSTRAINT "consumer_program_membership_stamps_count_check" CHECK ("consumer"."program_membership"."stamps_count" >= 0);