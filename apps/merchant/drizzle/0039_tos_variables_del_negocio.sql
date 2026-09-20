-- Spec 0081 (ADR 0076 §7) — EL TOS NOMBRA AL NEGOCIO DE VERDAD, y archiva `global-draft`.
--
-- SOLO DATOS. No toca tablas, tipos ni columnas: `core.terms_template` ya tiene todo lo que
-- hace falta (`jurisdiction_scope`, `locale`, `category`, `variables_allowlist`, `version`,
-- `status`), igual que en la `0038`. Tres cosas, en este orden:
--
--   1. SIEMBRA `earning_per_amount` en `default` y `EC` — la SEGUNDA clausula de
--      acumulacion, la de «se otorgan N unidades por cada $X de compra». Es una plantilla
--      APARTE y no una variable opcional de `earning` porque `renderTermsText` tira 422
--      cuando el valor de la variable es VACIO, no solo cuando no esta en el allowlist
--      (`loyalty-program/validation.ts`): un `earning` unico que nombrara
--      `{{program_accrual_block_amount}}` **romperia todo programa `per_purchase`**, que es
--      el que crea el cuerpo corto del alta. La eleccion entre las dos la hace
--      `earningClauseKey(accrual.mode)`.
--   2. SIEMBRA `transition` en `default` y `EC` — la clausula de vigencia por pais.
--      **OJO, y es lo contrario de lo que se podria suponer: el `transition` de
--      `global-draft` ESTA ARCHIVADO desde la `0011`**, justamente porque nombra
--      `{{earning_ends_at}}` / `{{redemption_ends_at}}`, que el renderer de hoy NO provee —
--      dejarlo publicado lo hacia seleccionable y reventaba el guardado con un 422. Por eso
--      estas dos filas nuevas usan **solo variables que el renderer emite siempre**. Copiar
--      su texto viejo habria reintroducido exactamente el bug que la `0011` saco.
--   3. ARCHIVA las 3 filas de `global-draft`. Dejan de ser `published`, asi que el filtro de
--      `renderedTerms` las excluye y `GET /api/loyalty-terms/templates` deja de ofrecerlas.
--
-- **EL RIESGO DEL ARCHIVADO, MEDIDO Y DESCARTADO:** no existe ninguna tabla ni columna que
-- guarde el `template_id` de un programa — `core.loyalty_program` guarda `terms_markdown`,
-- `terms_hash` y `terms_updated_at`, y no hay una sola columna `*template*` en toda la base
-- fuera de `terms_template.template_markdown` (verificado por `information_schema`). O sea
-- que **cero programas referencian estas plantillas** y ningun `PUT` sobre un programa viejo
-- puede caer al 422 por esto: las clausulas viajan en el cuerpo de cada escritura.
--
-- Los ids van FIJOS (no `gen_random_uuid()`) para que el `ON CONFLICT DO NOTHING` sea
-- idempotente y para que un test pueda aseverar contra un id conocido.
--
-- `ON CONFLICT ("key", "locale", "jurisdiction_scope", "version")` pelado: ese es el UNICO
-- indice unico de la tabla (`core_terms_template_key_version_unique`) y NO es parcial, asi
-- que no hay que repetir ningun `WHERE` — a diferencia del gotcha de los unicos PARCIALES.
-- No lo "arregles".
--
-- NO hay `UPDATE` del `variables_allowlist` de las 4 semillas de la `0038`: sus textos no
-- cambian en esta migracion, asi que no usan ni una variable nueva y su allowlist ya las
-- cubre. Las variables nuevas viajan en el allowlist de las 4 filas que se insertan aca.
INSERT INTO "core"."terms_template" ("id", "key", "jurisdiction_scope", "locale", "category", "title", "template_markdown", "variables_allowlist", "version", "status", "published_at") VALUES
('0081a1b2-0000-4000-8000-000000000001', 'earning_per_amount', 'default', 'es', 'acumulacion', 'Cómo se acumula (por monto de compra)', 'Se otorgan {{program_accrual_grant}} {{program_unit_plural}} por cada {{program_accrual_block_amount}} {{currency_code}} de compra registrada en {{business_legal_name}}. Los {{program_unit_plural}} no tienen valor monetario y no son canjeables por dinero.', '["business_legal_name", "program_name", "program_unit_singular", "program_unit_plural", "program_kind_label", "country_code", "currency_code", "program_accrual_grant", "program_accrual_block_amount"]'::jsonb, '1', 'published', now()),
('0081ec00-0000-4000-8000-000000000001', 'earning_per_amount', 'EC', 'es', 'acumulacion', 'Cómo se acumula (por monto de compra)', 'Se otorgan {{program_accrual_grant}} {{program_unit_plural}} por cada {{program_accrual_block_amount}} {{currency_code}} de compra registrada en {{business_legal_name}}. Los {{program_unit_plural}} no tienen valor monetario y no son canjeables por dinero. Este programa se rige por la legislación de defensa del consumidor vigente en {{country_code}}.', '["business_legal_name", "program_name", "program_unit_singular", "program_unit_plural", "program_kind_label", "country_code", "currency_code", "program_accrual_grant", "program_accrual_block_amount"]'::jsonb, '1', 'published', now()),
('0081a1b2-0000-4000-8000-000000000002', 'transition', 'default', 'es', 'vigencia', 'Cambios y vigencia', '{{business_legal_name}} podrá modificar o dar por terminado este programa de {{program_kind_label}}, informándolo con anticipación. Los {{program_unit_plural}} ya acumulados podrán utilizarse durante el plazo que se comunique al momento del cierre.', '["business_legal_name", "program_name", "program_unit_singular", "program_unit_plural", "program_kind_label", "country_code", "currency_code"]'::jsonb, '1', 'published', now()),
('0081ec00-0000-4000-8000-000000000002', 'transition', 'EC', 'es', 'vigencia', 'Cambios y vigencia', '{{business_legal_name}} podrá modificar o dar por terminado este programa de {{program_kind_label}}, informándolo con anticipación. Los {{program_unit_plural}} ya acumulados podrán utilizarse durante el plazo que se comunique al momento del cierre, conforme a la normativa vigente en {{country_code}}.', '["business_legal_name", "program_name", "program_unit_singular", "program_unit_plural", "program_kind_label", "country_code", "currency_code"]'::jsonb, '1', 'published', now())
ON CONFLICT ("key", "locale", "jurisdiction_scope", "version") DO NOTHING;
--> statement-breakpoint
-- El archivado de `global-draft`. `published_at = NULL` replica lo que hizo la `0011` con la
-- fila de `transition`. Idempotente por el `WHERE status = 'published'`.
UPDATE "core"."terms_template"
SET "status" = 'archived', "published_at" = NULL
WHERE "jurisdiction_scope" = 'global-draft'
  AND "status" = 'published';
