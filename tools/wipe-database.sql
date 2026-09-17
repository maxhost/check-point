-- ============================================================================
-- tools/wipe-database.sql — spec 0067 §6 / ADR 0070 §10
--
--   «borramos todo, comercios, usuarios, staff, locales, programas, todo,
--    comenzamos con una DB limpia para pruebas»  — el owner, 2026-09-16
--
-- ACCION DESTRUCTIVA E IRREVERSIBLE. Este archivo SE ENTREGA, NO SE EJECUTA:
-- correrlo contra produccion lo autoriza el OWNER explicitamente, en el momento,
-- y DESPUES de que la migracion 0032 este aplicada. El implementador de la spec
-- 0067 no lo corrio contra ninguna base. Lo unico que se ejecuto —contra la rama
-- Neon EFIMERA de integracion, en una transaccion `read only` que termino en
-- rollback— son las partes de SOLO LECTURA: el SELECT del paso 0, el `string_agg`
-- que arma la lista del paso 2 (sin su `EXECUTE`) y las dos consultas del paso 3.
-- **El `TRUNCATE` del paso 2 nunca corrio en ningun lado.**
--
-- ORDEN OBLIGATORIO. Los pasos 0 y 1 van ANTES del 2 y no son opcionales:
--
--   0. EXPORTAR los identificadores de Stripe.  <-- se pierden con el TRUNCATE
--   1. STRIPE PRIMERO: cancelar suscripciones vivas y desconectar customers.
--   2. Truncar `core.*` y `merchant_auth.*`.
--   3. Verificar por SQL que todo quedo en 0 y TRANSCRIBIR la salida.
--
-- Por que Stripe va primero (ADR 0070 §10): Stripe NO vive en la base. Una
-- suscripcion viva sigue facturando y sigue disparando webhooks contra un
-- negocio que ya no existe — y nuestro handler recibiria eventos cuyo
-- `stripe_customer_id` no matchea ninguna fila. Si se trunca antes, los ids
-- para cancelarlas desaparecen y hay que salir a buscarlos al dashboard.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PASO 0 — Exportar los ids de Stripe (SOLO LECTURA). Guardar esta salida.
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
   OR s.stripe_subscription_id IS NOT NULL
ORDER BY s.created_at;

-- ----------------------------------------------------------------------------
-- PASO 1 — STRIPE, FUERA DE LA BASE (checklist manual, con la salida del paso 0)
--
--   [ ] 1.a  Para CADA `stripe_subscription_id` de arriba:
--            `stripe subscriptions cancel <sub_id> --invoice-now=false --prorate=false`
--            (o el boton «Cancel subscription» del dashboard). Cancelar, no
--            programar la baja: una baja programada sigue viva hasta la fecha.
--   [ ] 1.b  Verificar que NO queda ninguna suscripcion viva en la cuenta:
--            `stripe subscriptions list --status all --limit 100`
--            y confirmar que ninguna quedo en `active`, `trialing`, `past_due`
--            ni `unpaid`. Transcribir la salida.
--   [ ] 1.c  Para CADA `stripe_customer_id`: `stripe customers delete <cus_id>`
--            (borrar el customer tambien mata sus suscripciones y sus metodos de
--            pago; si se prefiere conservar el historial contable, alcanza con
--            1.a + vaciar el metadata que apunta al `business_id`).
--   [ ] 1.d  Dejar constancia de que el webhook puede seguir recibiendo eventos
--            tardios (`customer.subscription.deleted`) DESPUES del truncado: van
--            a caer como «no matchea ningun negocio», que es lo esperado.
--
-- Nada de este paso se puede hacer con SQL. Hasta que 1.b este transcripto, NO
-- seguir al paso 2.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- PASO 2 — Truncar `core.*` y `merchant_auth.*`.
--
-- La lista de tablas se DERIVA del catalogo en vez de escribirse a mano: una
-- lista a mano envejece con cada spec que agrega una tabla, y lo que queda
-- afuera no se ve —la base «limpia» arrancaria con filas viejas—.
--
-- `CASCADE` no es decorativo. MEDIDO contra la rama de integracion el 2026-09-16
-- (`pg_constraint`, `contype='f'`, hija en `consumer` y padre en `core`): hay
-- **4 FKs de `consumer.*` contra `core.*`, en 2 tablas** —
-- `consumer.pass_placement` (→ `core.location`, → `core.campaign_turn`) y
-- `consumer.program_membership` (→ `core.location`, → `core.loyalty_program`)—,
-- asi que el truncado ALCANZA a esas dos y, transitivamente, a lo que cuelgue de
-- ellas dentro de `consumer`. Es lo que el owner pidio («todo»), y queda
-- explicito aca para que no sorprenda en el paso 3.
--
-- Lo que NO toca: el esquema `drizzle` (`__drizzle_migrations`). Borrarlo haria
-- que `db:migrate` quisiera re-aplicar las 32 migraciones sobre un esquema que
-- ya existe.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
  INTO tables
  FROM pg_tables
  WHERE schemaname IN ('core', 'merchant_auth');

  IF tables IS NULL THEN
    RAISE EXCEPTION 'No hay tablas en core/merchant_auth: base equivocada?';
  END IF;

  RAISE NOTICE 'TRUNCATE de: %', tables;
  EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
END
$$;

-- ----------------------------------------------------------------------------
-- PASO 3 — Verificar por SQL y TRANSCRIBIR la salida.
--
-- Cuenta TODAS las tablas de los tres esquemas, incluido `consumer` (para ver
-- el efecto del CASCADE). `filas` tiene que dar 0 en todas.
-- `count(*)` es bigint y el driver lo devuelve como string: el `::int` de aca
-- es el mismo cuidado que exige el repo en SQL crudo.
-- ----------------------------------------------------------------------------
SELECT
  t.table_schema,
  t.table_name,
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
ORDER BY filas DESC, t.table_schema, t.table_name;

-- Y el resumen de una linea, que es lo que se pega en el handoff:
SELECT
  count(*) FILTER (WHERE filas > 0)::int AS tablas_con_filas,
  coalesce(sum(filas), 0)::int AS filas_totales
FROM (
  SELECT
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
) conteos;
