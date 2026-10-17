CREATE TABLE "analytics"."campaign_snapshot" (
	"business_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"label" text NOT NULL,
	"status" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"captured_at" timestamp with time zone NOT NULL,
	"event_id" uuid NOT NULL,
	CONSTRAINT "campaign_snapshot_business_id_campaign_id_pk" PRIMARY KEY("business_id","campaign_id")
);
--> statement-breakpoint
ALTER TABLE "analytics"."campaign_snapshot" ADD CONSTRAINT "campaign_snapshot_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "core"."business"("id") ON DELETE cascade ON UPDATE no action;