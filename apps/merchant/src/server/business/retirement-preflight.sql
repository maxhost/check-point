-- Read-only prerequisite for the conditioned post-cutover artifact.
-- Run against one consistent read-only snapshot. No operation is authorized by this query.
-- A successful database check does NOT certify READY, old writers, or sessions.
WITH obligations AS (
  SELECT d.state, d.claim_token, d.claim_until, d.diagnostic
  FROM core.module_event_delivery d
  JOIN core.module_event e ON e.id = d.event_id
  JOIN core.historical_event_handler h
    ON h.subscriber_id = d.subscriber_id AND h.event_type = e.event_type
  WHERE h.handler_key = 'commission_snapshot'
), counts AS (
  SELECT
    count(*) FILTER (WHERE state NOT IN ('applied', 'skipped'))::int AS unresolved_deliveries,
    count(*) FILTER (WHERE claim_token IS NOT NULL OR claim_until IS NOT NULL)::int AS unresolved_claims,
    count(*) FILTER (WHERE diagnostic = 'application_failed' AND state = 'pending')::int AS failed_attempts
  FROM obligations
), schema_state AS (
  SELECT
    to_regclass('core.payment_method') IS NOT NULL
    AND to_regclass('core.payment_method_initialization') IS NOT NULL
    AND to_regclass('core.commission_revision') IS NOT NULL
    AND to_regclass('core.payment_commission') IS NOT NULL
    AND to_regclass('core.sale_commission') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='core' AND table_name='historical_event_handler'
        AND column_name='source_provider_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='core' AND table_name='sale_commission'
        AND column_name='total' AND data_type='numeric' AND numeric_precision IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM core.historical_event_handler WHERE handler_key='commission_snapshot'
    ) AS schema_ready
)
SELECT schema_ready, unresolved_deliveries, unresolved_claims, failed_attempts,
  schema_ready AND unresolved_deliveries=0 AND unresolved_claims=0 AS database_ready_for_retirement
FROM counts CROSS JOIN schema_state;
