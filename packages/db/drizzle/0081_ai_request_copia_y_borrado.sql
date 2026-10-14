-- Spec 0224 / ADR 0143 — COPIA al registro unico ANTES de borrar lo viejo. Escrita a mano: el
-- snapshot no cambia (drizzle-kit solo genero los DROP de abajo).
-- 1. El dictado (todas las filas de PROD son texto). `prompt_version` no existe en esta tabla.
insert into core.ai_request (id, business_id, created_by_user_id, task, task_version, mode, provider, model, status,
  failure_code, input_chars, output_items, input_tokens, output_tokens, created_at, finished_at)
select id, business_id, created_by_user_id,
  case kind when 'recipe' then 'recipes.recipe_text' else 'stock.entry_text' end,
  'legacy', 'sync', provider, model, status,
  case status when 'failed' then 'legacy' end,
  input_chars, line_count,
  case when input_tokens >= 0 then input_tokens end, case when output_tokens >= 0 then output_tokens end,
  created_at, created_at
from stock.draft_request
on conflict (id) do nothing;--> statement-breakpoint
-- 2. El menu: una fila por submit aceptado (provider is not null) que el codigo nuevo no haya registrado ya.
insert into core.ai_request (business_id, created_by_user_id, task, task_version, mode, provider, model, status,
  failure_code, input_images, input_files, input_tokens, output_tokens, duration_ms, provider_request_id, subject_id,
  created_at, finished_at)
select business_id, created_by_user_id, 'catalog.menu_extraction', coalesce(schema_version, 'legacy'), 'background',
  provider, model,
  case when draft is not null then 'ok' when status in ('queued','analyzing') then 'pending' else 'failed' end,
  case when draft is null and status not in ('queued','analyzing') then left(coalesce(failure_code, status), 120) end,
  case source_kind when 'images' then file_count else 0 end,
  case source_kind when 'pdf' then file_count else 0 end,
  case when input_tokens >= 0 then input_tokens end, case when output_tokens >= 0 then output_tokens end,
  case when duration_ms >= 0 then duration_ms end, provider_request_id, id, created_at,
  case when draft is not null or status not in ('queued','analyzing') then updated_at end
from core.catalog_import where provider is not null
on conflict (task, subject_id) where subject_id is not null do nothing;--> statement-breakpoint
-- 3. Borrar lo viejo (decision 3 del owner) y la columna LEGACY `draft_version` (owner 2026-10-13).
DROP TABLE "stock"."draft_request" CASCADE;--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "draft_version";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "model";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "prompt_version";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "schema_version";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "provider_request_id";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "input_tokens";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "output_tokens";--> statement-breakpoint
ALTER TABLE "core"."catalog_import" DROP COLUMN "duration_ms";