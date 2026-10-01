---
spec: 0118
fecha: 2026-10-01
estado: implementada
resumen: ADR 0110 — el rol checkpass_consumer pasa de DML en 52 tablas + BYPASSRLS a GRANT minimo por tabla (medido funcion por funcion desde las 22 rutas del cliente) y politicas RLS propias en las 4 tablas con RLS, NOBYPASSRLS, tablas nuevas cerradas; migracion 0059 a mano como la 0053; oraculo positivo = flujos del cliente conectados COMO el rol en la rama de CI, negativo = sondas SET ROLE que deben dar 42501.
disjunta: si
archivos: packages/db/drizzle/0059_*.sql (+ meta/_journal.json), packages/domain/src/** (ninguna linea de logica), apps/consumer/src/server/*.neon.integration.test.ts (nuevos), apps/consumer/src/server/*-support.ts (nuevos), tools/neon-test.sh, .github/workflows/ci.yml, docs/**
---

# 0118 — El rol del cliente con privilegio minimo

> ADR 0110. **Owner (2026-10-01):** GRANT «Mínimo por tabla»; RLS «Políticas explícitas, sin bypass»; preocupacion
> explicita por el costo de RLS en la experiencia (medido en el ADR: +0,04 ms por consulta con `USING (true)`).

## Problema

Medido en PROD 2026-10-01: `checkpass_consumer` tiene `SELECT, INSERT, UPDATE, DELETE` en las 52 tablas de `core` y
`consumer` y `rolbypassrls = true`. Con el servidor del cliente comprometido, la base no impide escribir pedidos,
canjes, comercios o productos. Hoy el codigo del cliente no los escribe (cierre de imports desde las 22 rutas, ningun
`insert`/`update` sobre `order` ni `reward_redemption`).

## Alcance

**Entra:**

1. **Inventario por funcion (antes de escribir SQL).** Desde cada una de las 22 rutas de
   `apps/consumer/src/app/api/public/**` y las paginas de `app/(consumer)/**`, seguir las funciones que **se llaman**
   (no los modulos importados) hasta cada acceso a la base, y escribir en el handoff una tabla
   `tabla | SELECT/INSERT/UPDATE/DELETE | ruta → funcion (archivo:linea)`. Incluye SQL crudo, `ON CONFLICT … DO UPDATE`
   (pide `SELECT`+`UPDATE`), `RETURNING` (pide `SELECT`) y triggers `SECURITY INVOKER` (medido:
   `core.business_customer_count_sync` escribe `core.business_customer_count` al insertar en `core.business_customer`).
   **Punto de partida medido por modulo** (sobre-estima: incluye funciones de merchant que viven en modulos compartidos):
   escrituras en `consumer.{consumer_account, consumer_session, otp_challenge, otp_delivery, program_membership,
   wallet_pass, wallet_push_device, wallet_push_queue, web_push_subscription, enroll_attempt}` y
   `core.{business_customer, campaign_coupon, campaign_push, welcome_device, valley_detection, valley_window}`;
   candidatos a **descartar** si ninguna ruta los llama: escrituras en `loyalty_program`, `loyalty_reward`,
   `loyalty_program_event`, `product*`, `brand_asset_*`, `loyalty_asset_*`, `business`, y `merchant_auth.session`
   (`onboarding-grant.ts`, solo desde `saveProgram`).
2. **Migracion `0059`** (SQL a mano, mismo formato y journal que la `0053`, `drizzle-kit generate --custom`):
   - `CREATE ROLE checkpass_consumer NOLOGIN` **solo si no existe** (en PROD y CI ya existe; la contraseña es del owner).
   - `ALTER ROLE checkpass_consumer NOBYPASSRLS`.
   - `REVOKE ALL ON ALL TABLES IN SCHEMA core, consumer, merchant_auth, drizzle FROM checkpass_consumer` y lo mismo con
     `SEQUENCES`; `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA core, consumer REVOKE ALL ON TABLES|SEQUENCES
     FROM checkpass_consumer` (**tablas nuevas cerradas**).
   - `GRANT USAGE ON SCHEMA core, consumer` y los `GRANT` **exactos** del inventario (por tabla y operacion; por columna
     si la tabla tiene columnas que el cliente no debe ver y la consulta lo permite — opcional, se declara si no).
   - En las 4 tablas con RLS, una politica por operacion concedida: `CREATE POLICY consumer_app_<op> ON … FOR <op> TO
     checkpass_consumer USING (true) [WITH CHECK (true)]`.
   - `GRANT checkpass_consumer TO neondb_owner WITH SET TRUE` (para las sondas, como la 0053 con `customer_reader`).
3. **Oraculo positivo** `apps/consumer/src/server/consumer-role.neon.integration.test.ts`: siembra como dueño
   (`NEON_INTEGRATION_DATABASE_URL`) y ejecuta **cada ruta** (al menos su camino feliz y, si escribe, una escritura
   real: enrolarse, abrir la billetera, reclamar oferta cruzada y de valle, opt-out, suscribir push, recovery request y
   verify con el proveedor `fake`, pases Apple/Google con el proveedor `fake`, passkit register/unregister/log, stamp,
   logo, imagen de producto) con `DATABASE_URL` = `NEON_INTEGRATION_CONSUMER_DATABASE_URL` (el rol). Cada caso asevera
   el resultado de negocio, no solo el codigo HTTP. **Si `NEON_INTEGRATION_ISOLATED=true` y falta la URL del rol, el
   archivo FALLA (no se saltea)**.
4. **Oraculo negativo** `apps/consumer/src/server/consumer-role-denied.neon.integration.test.ts`, con
   `withDbTransaction` + `SET LOCAL ROLE checkpass_consumer`: `INSERT` en `core."order"`, `core.reward_redemption`,
   `core.business`, `core.product`, `core.loyalty_program`; `UPDATE` de `core.business`; `SELECT` en
   `merchant_auth."user"` → `42501` cada uno (nombres de tabla verificados contra el esquema); `rolbypassrls = false`;
   una tabla creada por `neondb_owner` dentro de la transaccion no es legible por el rol (default privileges).
5. **CI y herramientas:** `tools/neon-test.sh` exporta `NEON_INTEGRATION_CONSUMER_DATABASE_URL` desde la clave
   `NEON_CI_CONSUMER_DATABASE_URL` de `apps/merchant/.env.local` (sin imprimir); `ci.yml` la pasa desde el secret
   homonimo y falla si esta vacia (como hace con `NEON_CI_DATABASE_URL`).

**No entra:** RLS por cliente (ADR 0110 §3); cambios de logica del cliente; permisos de merchant o de `customer_reader`.

## Precondicion del owner (antes de despachar)

En la rama `ci-integration` de Neon (SQL Editor): `ALTER ROLE checkpass_consumer LOGIN PASSWORD '<otra contraseña>';`.
Agregar a `apps/merchant/.env.local` la clave `NEON_CI_CONSUMER_DATABASE_URL` (URL pooled de esa rama con ese usuario) y
el mismo valor como secret de GitHub Actions `NEON_CI_CONSUMER_DATABASE_URL`. El orquestador verifica `rolcanlogin` en
la rama de CI y la existencia de la clave (sin leer su valor) antes de despachar.

## Definition of Done

- [ ] Inventario en el handoff, con `archivo:linea` por fila, y cada `GRANT` de la `0059` trazable a una fila.
- [ ] Rama de CI con la `0059` aplicada: `rolbypassrls = false`; `has_table_privilege` coincide con el inventario
      (consulta transcripta); politicas listadas en `pg_policy` para las 4 tablas.
- [ ] Oraculo positivo verde COMO el rol (`tools/neon-test.sh --app consumer …`), con el conteo de casos por ruta.
- [ ] Oraculo negativo verde (cada `42501` leido, no solo «tiro»).
- [ ] `drizzle-kit generate` → «No schema changes» despues de la `0059`.
- [ ] Gates de root: typecheck, lint, test, format:check, build (`TURBO_FORCE=1`). (Sin UI: `test:e2e` no aplica.)

## Plan de pruebas y verificación

Presupuesto: **5 mutaciones**, en la rama de CI y en la `0059`. Clase de error a cazar: un GRANT que falta (rompe un
flujo en PROD), uno de mas (abre una escritura prohibida), una politica que falta (0 filas sin error), el bypass que
vuelve, tablas nuevas abiertas.

| # | Mutacion | Oraculo | Guard hermano |
|---|---|---|---|
| M1 | quitar de la `0059` el `INSERT` en `consumer.consumer_account` y reaplicar | positivo: el caso de enrolarse rojo con `42501` | ninguno |
| M2 | agregar `INSERT ON core."order"` | negativo: el caso de `order` rojo (no da `42501`) | ninguno |
| M3 | quitar la politica `SELECT` de `consumer.program_membership` | positivo: billetera/enrolarse rojo por **0 filas** (no por error) | ninguno: es el caso que rompio PROD el 2026-09-30 |
| M4 | `ALTER ROLE checkpass_consumer BYPASSRLS` al final de la `0059` | negativo: `rolbypassrls` rojo | M3 tambien puede verse: la fila mide la sonda |
| M5 | no revocar los default privileges | negativo: la tabla nueva queda legible → rojo | ninguno |

Las mutaciones de base se aplican y revierten en la rama de CI (reaplicar la `0059` limpia y re-correr la sonda).

## Handoff requerido

Implementador + revisor. Con el PASS, el orquestador aplica la `0059` a PROD **con OK del owner**, verifica las mismas
sondas por SQL y por curl (`my./enroll/<programa activo>` muestra el formulario, sello 200), y el owner hace el QA en
telefono (enrolarse, billetera, agregar pase). **Vuelta atras en PROD:** `ALTER ROLE checkpass_consumer BYPASSRLS;` +
`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, consumer TO checkpass_consumer;` (el estado de hoy).

## Abierto

Nada que bloquee.
