CREATE TABLE "core"."balance_expiration" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"membership_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"accrual_kind" text NOT NULL,
	"units_expired" integer NOT NULL,
	"expires_on" date NOT NULL,
	"last_activity_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_expiration_kind_check" CHECK ("core"."balance_expiration"."accrual_kind" in ('points', 'stamps')),
	CONSTRAINT "balance_expiration_units_check" CHECK ("core"."balance_expiration"."units_expired" > 0)
);
--> statement-breakpoint
CREATE TABLE "consumer"."balance_expiry_notice" (
	"membership_id" uuid NOT NULL,
	"expires_on" date NOT NULL,
	"days_before" integer NOT NULL,
	"queue_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_expiry_notice_membership_id_expires_on_days_before_pk" PRIMARY KEY("membership_id","expires_on","days_before"),
	CONSTRAINT "balance_expiry_notice_days_check" CHECK ("consumer"."balance_expiry_notice"."days_before" in (20, 10, 5, 0))
);
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_event" DROP CONSTRAINT "loyalty_program_event_action_check";--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "balance_expiry_months" integer;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD COLUMN "balance_expiry_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "core"."balance_expiration" ADD CONSTRAINT "balance_expiration_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."balance_expiration" ADD CONSTRAINT "balance_expiration_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."balance_expiration" ADD CONSTRAINT "balance_expiration_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."balance_expiry_notice" ADD CONSTRAINT "balance_expiry_notice_membership_id_program_membership_id_fk" FOREIGN KEY ("membership_id") REFERENCES "consumer"."program_membership"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consumer"."balance_expiry_notice" ADD CONSTRAINT "balance_expiry_notice_queue_id_wallet_push_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "consumer"."wallet_push_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "core_balance_expiration_membership_day_unique" ON "core"."balance_expiration" USING btree ("membership_id","expires_on");--> statement-breakpoint
CREATE INDEX "core_balance_expiration_business_idx" ON "core"."balance_expiration" USING btree ("business_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_event" ADD CONSTRAINT "loyalty_program_event_action_check" CHECK ("core"."loyalty_program_event"."action" in ('created', 'edited', 'closing_scheduled', 'closing_canceled', 'expired', 'expiry_changed'));--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_balance_expiry_months_check" CHECK ("core"."loyalty_program"."balance_expiry_months" IS NULL OR "core"."loyalty_program"."balance_expiry_months" IN (3, 6, 9, 12));--> statement-breakpoint
ALTER TABLE "core"."loyalty_program" ADD CONSTRAINT "loyalty_program_balance_expiry_pair_check" CHECK (("core"."loyalty_program"."balance_expiry_months" IS NULL) = ("core"."loyalty_program"."balance_expiry_since" IS NULL));