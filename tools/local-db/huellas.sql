-- Huellas del esquema (spec 0167): una fila por categoria con conteo y md5[0..12]. Solo lectura.
-- Se corre igual en local y en PROD; `compare.sh` hace diff contra `huellas-prod.txt`.
-- Todo ORDER BY va con collate "C": la huella no depende de la collation de la base (ADR 0126 §Medido);
-- la collation misma es su propia fila.
with
esq(n) as (values ('core'), ('consumer'), ('merchant_auth'), ('drizzle')),
roles(n) as (values ('neon_superuser'), ('neondb_owner'), ('customer_reader'), ('checkpass_consumer')),
f(cat, linea) as (
  select 'migraciones', hash || '|' || created_at::text from drizzle.__drizzle_migrations
  union all
  -- `published_at` lo pone now() al migrar (medido: PROD 2026-09-20, local el dia del reset): solo cuenta si es nulo.
  select 'tos', id::text || '|' || key || '|' || jurisdiction_scope || '|' || locale || '|' || category || '|' || title
      || '|' || md5(template_markdown) || '|' || variables_allowlist::text || '|' || version || '|' || status || '|'
      || (published_at is null)::text
    from core.terms_template
  union all
  select 'extensiones', extname || '|' || extversion from pg_extension
  union all
  select 'columnas', table_schema || '.' || table_name || '.' || column_name || '|' || data_type || '|' || udt_name
      || '|' || is_nullable || '|' || coalesce(column_default, '') || '|' || coalesce(character_maximum_length::text, '')
      || '|' || coalesce(is_identity, '') || '|' || coalesce(generation_expression, '')
    from information_schema.columns where table_schema in (select n from esq)
  union all
  select 'indices', schemaname || '.' || tablename || '|' || indexname || '|' || indexdef
    from pg_indexes where schemaname in (select n from esq)
  union all
  select 'restricciones_' || co.contype::text,
         n.nspname || '.' || cl.relname || '|' || co.conname || '|' || pg_get_constraintdef(co.oid)
    from pg_constraint co join pg_class cl on cl.oid = co.conrelid join pg_namespace n on n.oid = cl.relnamespace
    where n.nspname in (select n from esq)
  union all
  select 'politicas', schemaname || '.' || tablename || '|' || policyname || '|' || permissive || '|'
      || array_to_string(roles, ',') || '|' || cmd || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '')
    from pg_policies where schemaname in (select n from esq)
  union all
  select 'rls', n.nspname || '.' || c.relname || '|' || c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in (select n from esq) and c.relkind = 'r' and (c.relrowsecurity or c.relforcerowsecurity)
  union all
  select 'grants_tabla', grantee || '|' || table_schema || '.' || table_name || '|' || privilege_type
    from information_schema.role_table_grants
    where grantee in ('customer_reader', 'checkpass_consumer') and table_schema in (select n from esq)
  union all
  select 'grants_columna', grantee || '|' || table_schema || '.' || table_name || '.' || column_name || '|' || privilege_type
    from information_schema.column_privileges
    where grantee in ('customer_reader', 'checkpass_consumer') and table_schema in (select n from esq)
  union all
  select 'funciones', n.nspname || '.' || p.proname || '|' || pg_get_function_identity_arguments(p.oid) || '|'
      || md5(pg_get_functiondef(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in (select n from esq)
  union all
  select 'triggers', n.nspname || '.' || c.relname || '|' || t.tgname || '|' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in (select n from esq) and not t.tgisinternal
  union all
  select 'roles', r.rolname || '|' || r.rolsuper::text || r.rolinherit::text || r.rolcreaterole::text
      || r.rolcreatedb::text || r.rolcanlogin::text || r.rolreplication::text || r.rolbypassrls::text
    from pg_roles r where r.rolname in (select n from roles)
  union all
  select 'membresias', g.rolname || '>' || m.rolname || '|' || am.admin_option::text || am.inherit_option::text
      || am.set_option::text
    from pg_auth_members am join pg_roles g on g.oid = am.roleid join pg_roles m on m.oid = am.member
    where g.rolname in (select n from roles) or m.rolname in (select n from roles)
  union all
  select 'collation', datcollate || '|' || datctype || '|' || datlocprovider::text || '|' || coalesce(datlocale, '')
    from pg_database where datname = current_database()
)
select cat || '|' || count(*) || '|' || left(md5(string_agg(linea, E'\n' order by linea collate "C")), 12) as huella
from f group by cat order by cat collate "C";
