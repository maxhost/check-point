---
adr: 0126
fecha: 2026-10-07
estado: aceptada
resumen: Se desarrolla y prueba contra un Postgres 18 LOCAL en Docker que replica Neon (mismos roles, extensiones y las 66 migraciones), al que la app llega con el mismo driver `@neondatabase/serverless` a traves de un proxy HTTP/WebSocket local. Datos: esquema + TOS semilla + datos de prueba ficticios, nunca copia de PROD. Sin ramas Neon para desarrollar y sin preview de Vercel: local → `pnpm verify` → migracion a PROD como paso explicito → push a `main`.
---

# 0126 — Ambiente de desarrollo local que replica Neon

## Contexto

Desde el 2026-10-07 PROD tiene clientes reales (la base se vacio ese dia con `tools/wipe-database.sql`, snapshot de
Neon `pre-wipe-2026-10-07`). Hasta ahora `DATABASE_URL` en `apps/*/.env.local` apunta a la rama `main` de Neon, o sea
PROD: correr la app en local escribe en produccion. No hay entorno intermedio: un push a `main` despliega.

Medido (2026-10-07, solo lectura):

- Neon corre **PostgreSQL 18.6** (`select version()`), plan `launch_v3` con 6 h de historia restaurable.
- Extensiones: `plpgsql`, `pgcrypto`, `pg_trgm`, `unaccent`, `btree_gin` (contrib estandar de `postgres:18`); las crean
  las migraciones 0016 y 0053.
- Nada del esquema es exclusivo de Neon, salvo el **nombre del rol duenio**: `packages/db/drizzle/0053_listado_de_clientes.sql:32`
  y `0060_rol_del_cliente.sql:20-21,72` nombran `neondb_owner`. Roles en PROD: `neondb_owner` (login),
  `customer_reader` (NOLOGIN, RLS por `app.business_id`) y `checkpass_consumer` (login; la 0060 lo crea NOLOGIN, el
  login se dio fuera de las migraciones).
- La app no habla Postgres plano: `packages/db/src/client.ts` usa neon-http (`getDb()`) y el `Pool` por WebSocket
  (`withDbTransaction()`).
- «Neon Local» (`neondatabase/neon_local`, Docker oficial) es un proxy a una rama EN LA NUBE, no una base local, y con el
  driver serverless solo sirve HTTP (sin transacciones interactivas). Fuente: docs de Neon `docs/local/neon-local.md`.
- Neon documenta un Postgres local + su driver en https://neon.com/guides/local-development-with-neon, con un proxy de
  la comunidad: `ghcr.io/timowilhelm/local-neon-http-proxy` (HTTP `/sql` y WebSocket en el puerto 4444).
- En la Mac del owner hay Docker 29.8 + Compose 5.6 y `libpq` 18.6 (`pg_dump` sin enlazar al PATH).

## Decision

Palabras del owner (2026-10-07): «yo no usaria una rama en neon, usaria una DB en local que replique exactamente neon
[...] no haria el preview en vercel, lo haria en local». Elecciones del owner sobre las opciones presentadas: **proxy**
(no cambiar de driver en local) y **esquema + datos de prueba** (no copia de PROD).

1. **Base local:** `postgres:18` en Docker. Un script de arranque crea los roles con los nombres de Neon:
   `neondb_owner` con login y **sin superusuario** (si fuera superusuario saltearia RLS y los GRANTs, y el oraculo del rol
   del cliente no probaria nada), `customer_reader` NOLOGIN NOBYPASSRLS, `checkpass_consumer` con login NOBYPASSRLS.
   Despues aplica las migraciones con `drizzle-kit migrate` (la misma via que PROD), que tambien siembra
   `core.terms_template`.
2. **Driver:** el mismo `@neondatabase/serverless` que en PROD, a traves del proxy HTTP/WebSocket local. La unica
   diferencia en el codigo es configurar `neonConfig` (`fetchEndpoint`, `wsProxy`, `useSecureWebSocket`) cuando el host
   de la URL es local; con un host de Neon no cambia nada.
3. **Datos:** esquema + TOS semilla + datos ficticios de prueba (comercios, programa, catalogo, clientes). **Nunca** una
   copia de PROD en la maquina local: PROD tiene datos personales de clientes reales.
4. **Servicios externos en local:** Stripe en modo test, email a consola, push y wallet apagados o con credenciales
   propias de desarrollo, para que el ambiente local nunca pueda notificar a un cliente real.
5. **Flujo:** desarrollar y probar en local → `pnpm verify` → si hay migracion, aplicarla primero en local y despues en
   PROD como paso explicito → push a `main` (despliega). Sin ramas Neon para desarrollo y sin preview de Vercel.
   `ci-integration` sigue siendo la rama de las suites `.neon.integration` (`tools/neon-test.sh`).

## Consecuencias

- `DATABASE_URL` de los `.env.local` deja de ser PROD. `tools/neon-test.sh` compara hoy la rama de CI contra
  `DATABASE_URL` para abortar si coinciden: la spec tiene que conservar ese candado contra PROD de otra forma.
- El proxy es de la comunidad: la imagen empaqueta el binario `neon-proxy` de Neon (`git:58abce02`) detras de Caddy;
  riesgo de mantenimiento del empaquetado. Medido abajo.
- La aplicacion de migraciones a PROD pasa a ser un paso explicito del flujo, documentado en un runbook.
- Implementacion: spec N2 (toca el cliente de la base y la infraestructura de datos), siguiente arco despues de este ADR.

## Medido (2026-10-07, antes de la spec)

En Docker local descartable (`postgres:18` = 18.6 + `ghcr.io/timowilhelm/local-neon-http-proxy:main`, digest
`sha256:cd2ae14e…`, imagen del 2026-03-27), con `@neondatabase/serverless` 1.1.0 del repo y Node 24:

- **El proxy anda con PG 18 y SCRAM.** `neon()` por HTTP (`fetchEndpoint` → `http://host:4444/sql`) y el `Pool` por
  WebSocket (`wsProxy`, `useSecureWebSocket`/`pipelineTLS`/`pipelineConnect` en `false`) con transaccion interactiva;
  `transaction([...])` por HTTP tambien. Una contraseña mala se rechaza. Host `db.localtest.me` (resuelve a 127.0.0.1).
- **`/v1`, `/v2` o sin ruta: los tres andan** (Caddy reenvia cualquier ruta). La pregunta del README queda sin efecto.
- **Como funciona la imagen:** `start.sh` crea `neon_control_plane.endpoints` en la base de `PG_CONNECTION_STRING` y el
  proxy autentica leyendo el secreto SCRAM con esa conexion: `PG_CONNECTION_STRING` va con el superusuario `postgres`
  del contenedor, la app con `neondb_owner`. Reiniciar el proxy da `ERROR: relation "endpoints" already exists` y
  arranca igual; sobrevive a un reinicio de Postgres.
- **Correccion del §1:** en PROD `neondb_owner` NO es superusuario pero SI tiene `CREATEROLE CREATEDB BYPASSRLS
  REPLICATION` y es miembro de `neon_superuser` (NOLOGIN, mismos atributos, admin de `pg_read_all_data`,
  `pg_write_all_data`, `pg_monitor`, `pg_signal_backend`, `pg_maintain`, `pg_create_subscription`,
  `pg_signal_autovacuum_worker`) — leido de `pg_roles` en PROD. **Sin `BYPASSRLS` la 0060 falla** (`ALTER ROLE
  checkpass_consumer NOBYPASSRLS` → `permission denied to alter role`: en PG 16+ tocar ese atributo exige tenerlo).
  Se replica tal cual; no debilita los oraculos porque prueban con `SET LOCAL ROLE customer_reader|checkpass_consumer`,
  que deja atras los atributos del owner (medido: `checkpass_consumer` recibe `permission denied for schema
  merchant_auth` por HTTP con su login y por `SET LOCAL ROLE` desde el owner).
- **`drizzle-kit migrate` no sirve en local tal cual:** sin `pg` instalado elige el driver de Neon, no usa el `neonConfig`
  de un `drizzle.config.ts` y sale con exit 1 sin mensaje, sin llegar al proxy. **Si sirve** el migrador de
  `drizzle-orm/neon-serverless/migrator` sobre el `Pool` del proxy: las 66 migraciones en 2,3 s, todo-o-nada (tras el
  fallo de la 0060 quedaban 0 filas en `drizzle.__drizzle_migrations`). Mismo journal y misma tabla que PROD.
- **Esquema local == PROD** con una consulta de huellas corrida en ambos lados: migraciones (66, misma ultima
  `created_at`), TOS (11), extensiones y versiones, columnas (601), indices (149), politicas (14), tablas con RLS (4),
  grants de tabla (48) y de columna (533) de los dos roles, funciones (2) y triggers (1): hash identico. **Restricciones:
  identicas.** El hash distinto era de la **collation**, no del esquema: agrupado por `contype` con nombre, los 5 hashes
  coinciden local/PROD; sin nombre (ordenado por la definicion) difieren `c` y `n`, y el local recalculado con
  `collate "C"` da exactamente los de PROD. Local es `en_US.utf8` (libc), PROD ordena por bytes: un `ORDER BY` de texto
  en la app daria otro orden en local. La base local se crea con la collation de PROD y la huella usa `collate "C"`
  explicito (spec 0167); el valor exacto de PROD queda por leer (spec 0167 §Abierto 1).
