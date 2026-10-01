-- Archive the loyalty terms template that references closing-window variables
-- ({{earning_ends_at}} / {{redemption_ends_at}}). It is a leftover of the
-- superseded versioning model (ADR 0026); the current renderer (ADR 0027/0028)
-- never provides those variables, so leaving it published makes it selectable at
-- program creation and hard-fails the save with a 422. Idempotent.
UPDATE "core"."terms_template"
SET "status" = 'archived', "published_at" = NULL
WHERE "id" = '9d4a3a05-2a87-4d12-8a99-e1a59e3cf103'
  AND "status" = 'published';
