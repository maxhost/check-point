-- ============================================================================
-- tools/wipe-database.sql — base limpia para salir a live (2026-10-07)
-- Reemplaza la version de la spec 0067 / ADR 0070 §10 (2026-09-17), que ya no
-- alcanzaba: no tocaba el esquema `consumer` (cuentas, pases, push) y SI borraba
-- `core.terms_template` (los TOS semilla).
--
--   «eliminar usuarios, cupones, comercios, catalogo, etc. no eliminamos lo que
--    si necesitamos: paises, TOS de los programas seed»  — el owner, 2026-10-07
--
-- ACCION DESTRUCTIVA E IRREVERSIBLE. SE ENTREGA, NO SE EJECUTA sin el OK
-- explicito del owner en el momento. Se corre paso por paso, leyendo la salida.
--
-- QUE BORRA: todas las tablas de `core`, `merchant_auth` y `consumer`, salvo las
-- de la lista KEEP. Comercios, dueños y staff (y sus sesiones), locales,
-- catalogo e importaciones, programas, premios, campañas, cupones emitidos y
-- canjes, ventas, clientes (cuentas, identidades, sesiones, membresias), pases,
-- dispositivos y cola de push, suscripciones y eventos de Stripe, tours.
--
-- QUE CONSERVA (KEEP):
--   - `core.terms_template`: plantillas de TOS de los programas, sembradas por las
--     migraciones 0004, 0038 y 0039. Sin FKs en ninguna direccion (medido
--     2026-10-07 en `pg_constraint`), asi que el CASCADE no la alcanza.
--   - El esquema `drizzle` (`__drizzle_migrations`): sin el, `db:migrate`
--     re-aplicaria todo sobre un esquema existente.
--   - Roles, GRANTs y politicas RLS (`checkpass_consumer`, `customer_reader`):
--     TRUNCATE no los toca.
--   - Paises: no viven en la base (`packages/domain/src/lib/countries.data.ts`,
--     `apps/merchant/src/server/supported-countries.ts`).
--
-- FUERA DE LA BASE (no lo hace este script):
--   - R2: logos, imagenes de productos/programas y archivos de importacion quedan
--     huerfanos en el bucket.
--   - Pases de Apple/Google Wallet y PWAs instalados en telefonos de prueba: sus
--     seriales dejan de existir; hay que borrarlos del telefono.
--   - Stripe: al 2026-10-07 ninguna `core.subscription` tiene customer ni
--     subscription de Stripe (paso 0 lo vuelve a medir).
--
-- ORDEN: 0 → 1 → 2 → 3. Nada del paso 2 corre si el 0 o el 1 no dieron lo esperado.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 0 — Stripe (SOLO LECTURA). Esperado: 0 filas. Si devuelve filas, PARAR:
-- hay que cancelar esas suscripciones en Stripe antes de seguir (una suscripcion
-- viva sigue facturando y mandando webhooks a un negocio que ya no existe).
-- ----------------------------------------------------------------------------
SELECT
  s.business_id,
  b.name AS business_name,
  s.plan,
  s.status,
  s.stripe_customer_id,
  s.stripe_subscription_id
FROM core.subscription s
LEFT JOIN core.business b ON b.id = s.business_id
WHERE s.stripe_customer_id IS NOT NULL
   OR s.stripe_subscription_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- PASO 1 — Respaldo y foto de antes (SOLO LECTURA).
--   1.a Respaldo: rama Neon `pre-wipe-AAAA-MM-DD` desde `main` justo antes del
--       paso 2 (instantanea; restaurable). Ademas Neon conserva la historia para
--       restaurar a un punto en el tiempo dentro de la ventana del plan.
--   1.b Esta foto: guardar la salida para comparar en el paso 3.
-- ----------------------------------------------------------------------------
SELECT
  t.table_schema || '.' || t.table_name AS tabla,
  (xpath(
    '/row/c/text()',
    query_to_xml(
      format('SELECT count(*) AS c FROM %I.%I', t.table_schema, t.table_name),
      false, true, ''
    )
  ))[1]::text::int AS filas
FROM information_schema.tables t
WHERE t.table_schema IN ('core', 'merchant_auth', 'consumer')
  AND t.table_type = 'BASE TABLE'
ORDER BY filas DESC, tabla;

-- ----------------------------------------------------------------------------
-- PASO 2 — Truncar todo salvo KEEP, en UNA transaccion.
--
-- La lista se DERIVA del catalogo: una lista a mano envejece con cada tabla
-- nueva. Antes de truncar verifica que ninguna tabla a borrar tenga una FK hacia
-- una tabla KEEP ni al reves (si aparece, el CASCADE la vaciaria) y aborta.
-- ----------------------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  keep constant text[] := ARRAY['core.terms_template'];
  tables text;
  crossing text;
BEGIN
  SELECT string_agg(c.conrelid::regclass::text || ' -> ' || c.confrelid::regclass::text, ', ')
  INTO crossing
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND (c.conrelid::regclass::text = ANY (keep)) <> (c.confrelid::regclass::text = ANY (keep));

  IF crossing IS NOT NULL THEN
    RAISE EXCEPTION 'FK entre una tabla KEEP y una a borrar: %. Revisar antes de truncar.', crossing;
  END IF;

  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ' ORDER BY schemaname, tablename)
  INTO tables
  FROM pg_tables
  WHERE schemaname IN ('core', 'merchant_auth', 'consumer')
    AND format('%s.%s', schemaname, tablename) <> ALL (keep);

  IF tables IS NULL THEN
    RAISE EXCEPTION 'No hay tablas en core/merchant_auth/consumer: base equivocada?';
  END IF;

  RAISE NOTICE 'TRUNCATE de: %', tables;
  EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
END
$$;

-- Antes del COMMIT: KEEP intacto (terms_template con las mismas filas que en el
-- paso 1; el 2026-10-07 eran 11) y el resto en 0. Si no, ROLLBACK.
SELECT count(*)::int AS terms_template FROM core.terms_template;

COMMIT;

-- ----------------------------------------------------------------------------
-- PASO 3 — Verificar y TRANSCRIBIR. Esperado: una sola fila con filas > 0,
-- `core.terms_template`.
-- ----------------------------------------------------------------------------
SELECT
  t.table_schema || '.' || t.table_name AS tabla,
  (xpath(
    '/row/c/text()',
    query_to_xml(
      format('SELECT count(*) AS c FROM %I.%I', t.table_schema, t.table_name),
      false, true, ''
    )
  ))[1]::text::int AS filas
FROM information_schema.tables t
WHERE t.table_schema IN ('core', 'merchant_auth', 'consumer')
  AND t.table_type = 'BASE TABLE'
ORDER BY filas DESC, tabla;

-- Migraciones intactas (debe coincidir con la cantidad de packages/db/drizzle/*.sql):
SELECT count(*)::int AS migraciones_aplicadas FROM drizzle.__drizzle_migrations;
