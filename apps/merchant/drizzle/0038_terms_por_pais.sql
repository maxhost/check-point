-- Spec 0078 (ADR 0076 §7) — el TOS del programa pasa a ser POR PAIS.
--
-- SOLO SEMILLAS: `core.terms_template` ya tiene `jurisdiction_scope`, `locale`,
-- `category`, `variables_allowlist`, `version` y `status`, asi que esta migracion no
-- toca el esquema. Siembra dos scopes nuevos con las MISMAS dos claves que usa el
-- wizard (`earning` y `redemption`; `transition` sigue archivada por la `0011`):
--
--   * `default` — el scope de caida, para todo pais sin plantilla propia.
--   * `EC`      — el primero con texto propio, que es por donde empieza el owner.
--
-- Los ids van FIJOS (no `gen_random_uuid()`) para que el `ON CONFLICT DO NOTHING` sea
-- idempotente y para que un test pueda aseverar contra un id conocido.
--
-- `ON CONFLICT` pelado: el unico `core_terms_template_key_version_unique` NO es parcial
-- (`CREATE UNIQUE INDEX ... USING btree (key, locale, jurisdiction_scope, version)`,
-- verificado en `pg_indexes`), asi que no hay que repetir ningun `WHERE` — a diferencia
-- del gotcha de los unicos PARCIALES. No lo "arregles".
--
-- `country_code` entra al allowlist de las cuatro filas: hasta hoy se pasaba como
-- variable pero no estaba permitido en ninguna semilla, con lo cual un TOS por pais no
-- podia nombrar a su pais (`renderTermsText` tira 422 ante una variable fuera del
-- allowlist, `loyalty-program/validation.ts:246-248`). `program_unit_plural` es la
-- variable nueva que arregla el «Los sello se acumulan…» del texto que ve el consumidor.
--
-- El scope `global-draft` NO se borra ni se archiva: sigue `published` para que cualquier
-- programa que todavia referencie sus plantillas por `template_id` siga renderizando.
INSERT INTO "core"."terms_template" ("id", "key", "jurisdiction_scope", "locale", "category", "title", "template_markdown", "variables_allowlist", "version", "status", "published_at") VALUES
('0078a1b2-0000-4000-8000-000000000001', 'earning', 'default', 'es', 'acumulacion', 'Cómo se acumula', 'Los {{program_unit_plural}} se acumulan únicamente conforme a las acciones elegibles comunicadas por {{business_legal_name}}, no tienen valor monetario y no son canjeables por dinero.', '["business_legal_name", "program_name", "program_unit_plural", "country_code"]'::jsonb, '1', 'published', now()),
('0078a1b2-0000-4000-8000-000000000002', 'redemption', 'default', 'es', 'canje', 'Uso y canje', 'Los beneficios que se obtienen con {{program_unit_plural}} están sujetos a disponibilidad y a las condiciones comunicadas por {{business_legal_name}}, que informará cualquier cambio con anticipación.', '["business_legal_name", "program_name", "program_unit_plural", "country_code"]'::jsonb, '1', 'published', now()),
('0078ec00-0000-4000-8000-000000000001', 'earning', 'EC', 'es', 'acumulacion', 'Cómo se acumula', 'Los {{program_unit_plural}} se acumulan únicamente conforme a las acciones elegibles comunicadas por {{business_legal_name}}, no tienen valor monetario y no son canjeables por dinero. Este programa se rige por la legislación de defensa del consumidor vigente en {{country_code}}.', '["business_legal_name", "program_name", "program_unit_plural", "country_code"]'::jsonb, '1', 'published', now()),
('0078ec00-0000-4000-8000-000000000002', 'redemption', 'EC', 'es', 'canje', 'Uso y canje', 'Los beneficios que se obtienen con {{program_unit_plural}} están sujetos a disponibilidad y a las condiciones comunicadas por {{business_legal_name}}, que informará cualquier cambio con anticipación conforme a la normativa vigente en {{country_code}}.', '["business_legal_name", "program_name", "program_unit_plural", "country_code"]'::jsonb, '1', 'published', now())
ON CONFLICT ("key", "locale", "jurisdiction_scope", "version") DO NOTHING;
