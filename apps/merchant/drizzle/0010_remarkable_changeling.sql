CREATE TABLE "core"."loyalty_program_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_program_event_action_check" CHECK ("core"."loyalty_program_event"."action" in ('created', 'edited', 'closing_scheduled', 'closing_canceled', 'expired'))
);
--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_event" ADD CONSTRAINT "loyalty_program_event_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "core"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_event" ADD CONSTRAINT "loyalty_program_event_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."loyalty_program_event" ADD CONSTRAINT "loyalty_program_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "merchant_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_loyalty_program_event_program_idx" ON "core"."loyalty_program_event" USING btree ("program_id","created_at");--> statement-breakpoint
CREATE INDEX "core_loyalty_program_event_business_idx" ON "core"."loyalty_program_event" USING btree ("business_id","created_at");