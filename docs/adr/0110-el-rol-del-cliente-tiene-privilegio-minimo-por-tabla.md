---
adr: 0110
fecha: 2026-10-01
estado: aceptada
resumen: El rol de Postgres del cliente (checkpass_consumer) pasa de DML en las 52 tablas + BYPASSRLS a privilegio minimo por tabla (GRANT solo de lo que el codigo del cliente lee y escribe, medido funcion por funcion) y a politicas RLS explicitas propias en las 4 tablas con RLS, sin bypass; todo en una migracion SQL a mano como la 0053, con las tablas nuevas cerradas por defecto. Sin RLS por cliente (no protege de un servidor comprometido y obliga a tocar todas las consultas).
---

# 0110 — El rol del cliente tiene privilegio minimo por tabla

## Contexto

Tras el corte (0117, ADR 0109) el rol `checkpass_consumer` tiene `SELECT, INSERT, UPDATE, DELETE` en las 52 tablas de
`core` y `consumer` y `BYPASSRLS` (agregado en PROD porque 4 tablas con RLS le devolvian 0 filas). Si el servidor del
cliente quedara comprometido, la base no le impediria escribir pedidos (sellos), canjes, comercios o productos. El codigo
del cliente no escribe ninguna de esas: medido desde las 22 rutas, no hay escritura a `order` ni `reward_redemption`.

**Owner (2026-10-01):** «las RLS siempre añaden tiempo de ejecucion, eso es un problema para la experiencia de usuario»;
AskUserQuestion: GRANT **«Mínimo por tabla»**; RLS **«Políticas explícitas, sin bypass»**.

**Medido (rama `bench-clientes-comercio`, 3.000.040 membresias, 500 repeticiones, mismas 4 filas en todas):** consulta
«mis programas» (`program_membership` ⨝ `loyalty_program` por `consumer_id`): sin RLS 0,112 ms; politica `USING (true)`
para el rol 0,152 ms (+0,04); RLS por cliente con `app.consumer_id` 0,204 ms (+0,09); la politica sola filtra los 3M
por indice (0,195 ms). Un viaje Vercel→Neon es 1–5 ms. **El costo de una politica es despreciable; lo caro de la RLS
por cliente es fijar la variable de sesion en cada pedido.**

## Decision

1. **GRANT minimo por tabla** (costo cero: se resuelve al planificar). Lectura y escritura SOLO donde el codigo del
   cliente las ejerce, con la lista medida funcion por funcion desde las 22 rutas. Esta es la capa que impide escribir
   pedidos, canjes, comercios o productos aunque el servidor del cliente este comprometido.
2. **Politicas explicitas `TO checkpass_consumer`** en las 4 tablas con RLS (`core.loyalty_program`,
   `consumer.program_membership`, `core.business_customer`, `core.business_customer_count`), con `USING (true)` /
   `WITH CHECK (true)` solo para las operaciones que el rol tiene por GRANT; **`NOBYPASSRLS`**. Una tabla con RLS nueva
   queda cerrada para el cliente hasta que alguien la decida.
3. **Sin RLS por cliente.** Una variable de sesion la fija el propio servidor: no protege de un servidor comprometido,
   solo de un `WHERE` olvidado, y obliga a pasar todas las consultas del cliente por una transaccion.
4. **Como la 0053:** migracion SQL a mano, idempotente (`CREATE ROLE … NOLOGIN` si no existe; la contraseña la pone el
   owner por rama), `GRANT checkpass_consumer TO neondb_owner WITH SET TRUE` (para las sondas de los tests) y
   `ALTER DEFAULT PRIVILEGES` revocado: **las tablas nuevas nacen cerradas** para el cliente.

## Consecuencias

- Cada spec futura que haga que el cliente lea o escriba una tabla nueva incluye su GRANT (y su politica si la tabla
  tiene RLS). Si falta, el oraculo de la 0118 da `permission denied` en CI, no en PROD.
- El trigger `business_customer_count_sync` es `SECURITY INVOKER`: el alta del cliente escribe el contador, asi que el
  rol necesita `INSERT/UPDATE` ahi (y su politica).
