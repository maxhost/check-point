CREATE TABLE "core"."cross_candidate" (
	"decision_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"category_gcid" text NOT NULL,
	"distance_meters" integer NOT NULL,
	"cap_remaining" integer NOT NULL,
	"segment" text NOT NULL,
	"days_since_last_order" integer,
	"orders_count" integer NOT NULL,
	"factor_closeness" double precision NOT NULL,
	"factor_behind" double precision NOT NULL,
	"factor_bonus" double precision NOT NULL,
	"probability" double precision NOT NULL,
	CONSTRAINT "cross_candidate_decision_id_campaign_id_pk" PRIMARY KEY("decision_id","campaign_id"),
	CONSTRAINT "core_cross_candidate_segment_check" CHECK ("core"."cross_candidate"."segment" in ('new', 'dormant', 'regular'))
);
--> statement-breakpoint
CREATE TABLE "core"."cross_decision" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"consumer_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"location_id" uuid,
	"origin_kind" text NOT NULL,
	"policy" text NOT NULL,
	"epsilon" double precision NOT NULL,
	"candidate_count" integer NOT NULL,
	"draw" double precision,
	"chosen_campaign_id" uuid,
	"coupon_id" uuid,
	"queue_id" uuid,
	"outcome" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"clicked_at" timestamp with time zone,
	CONSTRAINT "core_cross_decision_order_unique" UNIQUE("order_id"),
	CONSTRAINT "core_cross_decision_outcome_check" CHECK ("core"."cross_decision"."outcome" in ('issued', 'no_candidates', 'no_origin', 'coupon_conflict'))
);
--> statement-breakpoint
ALTER TABLE "core"."cross_candidate" ADD CONSTRAINT "cross_candidate_decision_id_cross_decision_id_fk" FOREIGN KEY ("decision_id") REFERENCES "core"."cross_decision"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cross_decision" ADD CONSTRAINT "cross_decision_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "core"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cross_decision" ADD CONSTRAINT "cross_decision_consumer_id_consumer_account_id_fk" FOREIGN KEY ("consumer_id") REFERENCES "consumer"."consumer_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cross_decision" ADD CONSTRAINT "cross_decision_chosen_campaign_id_campaign_id_fk" FOREIGN KEY ("chosen_campaign_id") REFERENCES "core"."campaign"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cross_decision" ADD CONSTRAINT "cross_decision_coupon_id_campaign_coupon_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "core"."campaign_coupon"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "core"."cross_decision" ADD CONSTRAINT "cross_decision_queue_id_wallet_push_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "consumer"."wallet_push_queue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "core_cross_candidate_campaign_idx" ON "core"."cross_candidate" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "core_cross_decision_chosen_idx" ON "core"."cross_decision" USING btree ("chosen_campaign_id","decided_at");--> statement-breakpoint
CREATE INDEX "core_cross_decision_queue_idx" ON "core"."cross_decision" USING btree ("queue_id");--> statement-breakpoint
-- Spec 0143 §5: el clic del regalo misterio (`recordPushClick`, `POST /api/public/push/click` del
-- consumer, que corre como `checkpass_consumer`) escribe `cross_decision.clicked_at`. Como el clic
-- de `campaign_push` en la 0060: solo las columnas que lee su `UPDATE`, y solo `clicked_at`.
GRANT SELECT (id, clicked_at) ON core.cross_decision TO checkpass_consumer;--> statement-breakpoint
GRANT UPDATE (clicked_at) ON core.cross_decision TO checkpass_consumer;
