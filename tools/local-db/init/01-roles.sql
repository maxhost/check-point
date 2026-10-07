-- Roles calcados de PROD (spec 0167 §1, ADR 0126 §Medido). Lo corre `docker-entrypoint-initdb.d`
-- UNA sola vez, como el superusuario `postgres` del contenedor, sobre la base `neondb`.
-- Atributos y membresias leidos de `pg_roles`/`pg_auth_members` en PROD por MCP el 2026-10-07.
-- `customer_reader` y `checkpass_consumer` NO se crean aca: los crean las migraciones, igual que en PROD.

-- Rol de Neon que hace de «casi superusuario» (NOLOGIN).
create role neon_superuser nologin createrole createdb bypassrls replication;
grant pg_read_all_data, pg_write_all_data, pg_monitor, pg_signal_backend, pg_create_subscription
  to neon_superuser with admin true, inherit true, set true;
grant pg_maintain, pg_signal_autovacuum_worker
  to neon_superuser with admin true, inherit true, set false;

-- Rol interno de Neon: sin privilegios propios, existe para que las membresias coincidan con PROD.
create role neon_service nologin;
grant neon_superuser to neon_service with inherit true, set true;

-- El duenio de la base. SIN superusuario: si lo fuera saltearia RLS y los GRANTs, y los oraculos de
-- los roles del cliente no probarian nada. `BYPASSRLS` si: la 0060 lo necesita para tocar ese atributo.
-- Contraseña fija y local: este contenedor solo escucha en 127.0.0.1.
create role neondb_owner login password 'local-solo-dev' createrole createdb bypassrls replication;
grant neon_superuser to neondb_owner;

alter database neondb owner to neondb_owner;
alter schema public owner to neondb_owner;
