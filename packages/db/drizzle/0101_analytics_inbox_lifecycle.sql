DROP INDEX "analytics"."analytics_card_candidate_unique";--> statement-breakpoint
ALTER TABLE "analytics"."card_candidate" ADD COLUMN "category" text DEFAULT 'actionable' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_candidate" ADD COLUMN "policy_version" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_candidate" ADD COLUMN "context_version" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_candidate" ADD COLUMN "episode_started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_candidate" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_candidate" ADD COLUMN "period" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "candidate_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "policy_version" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "context_version" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "episode_started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "remind_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "reminder_consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "last_operation_id" text;--> statement-breakpoint
ALTER TABLE "analytics"."card_state" ADD COLUMN "last_operation_digest" text;--> statement-breakpoint
ALTER TABLE "analytics"."evaluation_run" ADD COLUMN "policy_version" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
-- Initial legacy transition. Ninety days is this migration's frozen initial policy,
-- never the runtime cleanup predicate. Runtime reductions use the effective expires_at.
WITH normalized AS (
 SELECT c.id,
   CASE WHEN c.card_key='1' AND c.subject_key ~ '^\d{4}-\d{2}-\d{2}$' THEN c.subject_key::date
        WHEN c.card_key IN ('5','9') AND c.parameters->>'originDay' ~ '^\d{4}-\d{2}-\d{2}$' THEN (c.parameters->>'originDay')::date
        ELSE c.day END AS target_day,
   CASE WHEN c.card_key='1' THEN 'summary'
        WHEN c.card_key='2' THEN CASE WHEN c.subject_key LIKE 'learning:%' THEN 'learning' ELSE 'forecast' END
        WHEN c.card_key='13' THEN 'slow-day' ELSE c.subject_key END AS subject,
   CASE WHEN c.parameters->>'originObservedAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z:'
        THEN left(c.parameters->>'originObservedAt',24)::timestamptz
        ELSE c.day::timestamp AT TIME ZONE b.timezone END AS proven_start
 FROM analytics.card_candidate c JOIN core.business b ON b.id=c.business_id
), anchored AS (
 SELECT n.id,n.subject,n.target_day,
   CASE WHEN c.card_key IN ('1','2','13') THEN n.proven_start
        ELSE min(n.proven_start) OVER(PARTITION BY c.business_id,c.card_key,n.subject) END AS started
 FROM normalized n JOIN analytics.card_candidate c ON c.id=n.id
)
UPDATE analytics.card_candidate c SET subject_key=a.subject,day=a.target_day,episode_started_at=a.started,
 expires_at=a.started+interval '2160 hours',
 category=CASE WHEN c.card_key IN ('1','2','9','12','13') THEN 'informational' ELSE 'actionable' END,
 period=jsonb_build_object('from',a.target_day::text,'to',a.target_day::text)
FROM anchored a WHERE c.id=a.id;
--> statement-breakpoint
WITH ranked AS (
 SELECT id,row_number() OVER(PARTITION BY business_id,card_key,subject_key
 ORDER BY day DESC,parameters->>'originObservedAt' DESC NULLS LAST,id DESC) AS rank
 FROM analytics.card_candidate
)
DELETE FROM analytics.card_candidate c USING ranked r WHERE c.id=r.id AND r.rank>1;
--> statement-breakpoint
-- accepted used to mean navigation, so it is explicitly not a declared resolution.
WITH normalized AS (
 SELECT s.*,CASE WHEN card_key='1' THEN 'summary'
   WHEN card_key='2' THEN CASE WHEN subject_key LIKE 'learning:%' THEN 'learning' ELSE 'forecast' END
   WHEN card_key='13' THEN 'slow-day' ELSE subject_key END AS subject
 FROM analytics.card_state s
), selected AS (
 SELECT n.*,row_number() OVER(PARTITION BY business_id,card_key,subject ORDER BY updated_at DESC,subject_key DESC) AS rank
 FROM normalized n
)
INSERT INTO analytics.card_state(business_id,card_key,subject_key,fingerprint,status,shown_days,last_shown_day,acted_by,updated_at,
 candidate_id,policy_version,context_version,context,episode_started_at,expires_at)
SELECT s.business_id,s.card_key,s.subject,s.fingerprint,
 CASE WHEN s.status='dismissed' AND (
 c.id IS NULL OR
 (s.card_key='1' AND s.subject_key ~ '^\d{4}-\d{2}-\d{2}$' AND c.day::text<=s.subject_key) OR
 (s.card_key='9' AND c.subject_key=s.subject_key AND c.subject_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:' AND EXISTS(
   SELECT 1 FROM core.module_event e JOIN core.module_event_delivery d ON d.event_id=e.id
   WHERE e.business_id=s.business_id AND e.id=CASE WHEN c.subject_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:' THEN left(c.subject_key,36)::uuid ELSE NULL END
    AND d.subscriber_id='core.analytics' AND d.state='applied'))
 ) THEN 'ignored' ELSE 'open' END,
 s.shown_days,s.last_shown_day,s.acted_by,s.updated_at,coalesce(c.id,s.candidate_id),'legacy','legacy',
 jsonb_strip_nulls(jsonb_build_object('legacy',true,'legacyFingerprint',s.fingerprint,'legacyOriginalStatus',s.status,'legacyDecisionPeriod',CASE WHEN s.card_key='1' THEN s.subject_key ELSE NULL END,'legacyAnchorAt',transaction_timestamp(),
 'legacyOriginObservedAt',c.parameters->>'originObservedAt','legacyOriginDay',c.parameters->>'originDay')),
 coalesce(c.episode_started_at,s.episode_started_at),coalesce(c.expires_at,s.episode_started_at+interval '2160 hours')
FROM selected s LEFT JOIN analytics.card_candidate c ON c.business_id=s.business_id AND c.card_key=s.card_key AND c.subject_key=s.subject
WHERE s.rank=1
ON CONFLICT(business_id,card_key,subject_key) DO UPDATE SET candidate_id=excluded.candidate_id,status=excluded.status,
 context=excluded.context,episode_started_at=excluded.episode_started_at,expires_at=excluded.expires_at;
--> statement-breakpoint
DELETE FROM analytics.card_state WHERE
 (card_key='1' AND subject_key<>'summary') OR
 (card_key='2' AND subject_key NOT IN ('learning','forecast')) OR
 (card_key='13' AND subject_key<>'slow-day');
--> statement-breakpoint
INSERT INTO analytics.card_state(business_id,card_key,subject_key,fingerprint,status,shown_days,last_shown_day,
 candidate_id,context,episode_started_at,expires_at)
SELECT c.business_id,c.card_key,c.subject_key,c.fingerprint,'open',0,c.day,c.id,
 jsonb_strip_nulls(jsonb_build_object('legacy',true,'legacyAnchorAt',transaction_timestamp(),
 'legacyOriginObservedAt',c.parameters->>'originObservedAt','legacyOriginDay',c.parameters->>'originDay')),
 c.episode_started_at,c.expires_at
FROM analytics.card_candidate c
ON CONFLICT(business_id,card_key,subject_key) DO NOTHING;
--> statement-breakpoint
DELETE FROM analytics.card_candidate c USING analytics.card_state s
WHERE c.business_id=s.business_id AND c.card_key=s.card_key AND c.subject_key=s.subject_key AND s.status='ignored';
--> statement-breakpoint
DELETE FROM analytics.card_candidate WHERE card_key='11';
--> statement-breakpoint
CREATE INDEX "analytics_candidate_started_idx" ON "analytics"."card_candidate" USING btree ("episode_started_at","id");--> statement-breakpoint
CREATE INDEX "analytics_candidate_expiry_idx" ON "analytics"."card_candidate" USING btree ("expires_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_state_candidate_unique" ON "analytics"."card_state" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "analytics_state_reminder_idx" ON "analytics"."card_state" USING btree ("remind_at","candidate_id");--> statement-breakpoint
CREATE INDEX "analytics_state_expiry_idx" ON "analytics"."card_state" USING btree ("expires_at","candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "analytics_card_candidate_unique" ON "analytics"."card_candidate" USING btree ("business_id","card_key","subject_key");