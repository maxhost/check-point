---
adr: 0100
fecha: 2026-09-28
estado: aceptada
resumen: El listado de clientes del comercio se lee de una proyeccion propia `core.business_customer` (una fila por negocio×cliente, escrita en la MISMA operacion del alta, la compra y el canje; costo medido 0,05–0,4 ms por compra, constante). El aislamiento va en DOS capas: el guard (sesion + permiso `counter`) y despues la BASE — la lectura corre con `SET LOCAL ROLE customer_reader` (sin BYPASSRLS, sin acceso a la tabla global de cuentas) y RLS por `app.business_id`; la busqueda por nombre pasa por una funcion SECURITY DEFINER que toma el negocio de la sesion, porque con RLS pura `LIKE` no puede usar el indice (medido 180 ms → 0,25 ms).
---

# 0100 — El listado de clientes es una proyeccion por comercio

## Contexto

El owner pidio (2026-09-28) que el comercio vea el listado de sus clientes: nombre, fecha de alta,
ultima visita y puntos/sellos del programa activo, con paginas numeradas (y anterior/siguiente),
busqueda por nombre y por telefono (el telefono se busca pero **no se ve**). Lo ven el owner y el
staff con el permiso `counter`. Requisitos explicitos: un comercio **nunca** ve un cliente que no esta
en uno de sus programas; tiene que ser rapido en una red de cientos de miles o millones de clientes; y
el aislamiento **no puede depender solo del codigo de la app** — el owner pidio que la base verifique
que quien consulta esta autenticado y tiene un rol con permiso, y recien ahi filtre por comercio.

Decisiones del owner en la misma sesion: aparecen **todos los historicos** (quien se enrolo alguna
vez en cualquier programa del negocio, una fila por persona); «ultima visita» = **compra o canje** —
y todo canje es una visita, porque sin escanear el QR no hay canje posible; orden **fijo por ultima
visita**; tiers fuera de alcance; la UI la hace GPT, nosotros API y contrato.

Hechos del arbol que condicionan el diseño:

- Un negocio tiene como mucho **un** programa operativo (`core_loyalty_program_one_operational`,
  `schema/loyalty.ts:137`), pero puede tener varios en el tiempo; la membresia es **por programa**
  (`consumer.program_membership`) y un cambio de programa **no** mueve a nadie. «Cliente del
  comercio» ≠ «membresia».
- «Ultima visita» no esta guardada: marketing la calcula con `max(order.created_at)` por consulta
  (`marketing/audience.ts:35`).
- El nombre (`first_name` + `last_name`) y el telefono se escriben **solo** al crear la cuenta
  (`consumer/enrollment.ts:177`, `consumer/recovery/verify.ts:178`); ningun camino los edita
  (barrido de `phone_e164` y de `.set(` sobre la cuenta, 2026-09-28).
- **El unico rol de login de la app en prod es `neondb_owner`, con `rolbypassrls = true`**
  (miembro de `neon_superuser`; `pg_roles` y `pg_stat_activity` de `main`, 2026-09-28). Una politica
  RLS por si sola **no aislaria nada**: se probo con `FORCE ROW LEVEL SECURITY` y el conteo de un
  negocio ajeno devolvio sus 2.800 filas.

## Medicion (rama efimera `bench-clientes-comercio`, hija de `ci-integration`, PG 18.6)

Datos sinteticos: 1.000.000 de cuentas, 3.000.000 de filas negocio×cliente (1 comercio de 200.000 y
1.000 de 2.800, con clientes compartidos), nombres de un pool chico para que haya homonimos.
`EXPLAIN (ANALYZE)`, dos corridas por consulta, comercio de 200.000, **con la tabla ya inflada por
una reescritura completa** (peor que una tabla recien cargada):

| Consulta | Sin RLS | Con rol + RLS | Con rol + funcion de busqueda |
|---|---|---|---|
| Pagina 1 (25 filas + saldo) | 0,5 ms | **0,3 ms** | — |
| Ultima pagina, OFFSET 199.975, *deferred join* | 63–70 ms | **63 ms** | — |
| (misma, forma ingenua, tabla recien cargada) | 160 ms | — | — |
| `count(*)` del comercio | 61–88 ms | **79 ms** | — |
| Telefono exacto (columna en la proyeccion) | 0,03 ms | **0,04 ms** | — |
| Nombre comun (`maria`) + conteo | 10–52 ms | 55 ms | **16 ms** |
| Nombre raro (`villacis`) | 0,45 ms | 57 ms | **15 ms** (con conteo) |
| Nombre sin resultados (`xqzw`) | 0,05 ms | **180 ms** | **0,25 ms** |
| Sin **ningun** filtro por negocio | 940 ms (seq scan de 3M) | — | — |

**Escritura** (lo que suma cada compra, 2.000 upserts seguidos por corrida): **0,40 ms** con cache
fria, **0,048 ms** repitiendo sobre los mismos clientes, **0,058 ms** en un comercio de 2.800. **No
crece** con la cantidad de compras: la proyeccion tiene una fila por cliente, no por compra, y cada
compra actualiza esa fila en su lugar. Un numero de 3,5 ms que se midio antes era una sola escritura
con `EXPLAIN` y cache fria, no un costo por compra.

**Por que la busqueda con RLS pura es lenta:** `LIKE` no es `leakproof`, asi que el planner no puede
evaluarlo antes de la politica y el indice de trigramas queda sin usar para el termino. **No se puede
arreglar marcando la comparacion como `leakproof` en Neon**: se intento y la base contesta
`only superuser can define a leakproof function`.

**Aislamiento verificado en la rama:** con el rol restringido, 0 filas y 0 membresias de un negocio
ajeno; la funcion de busqueda devuelve para el negocio B exactamente las 112 filas que le da RLS; el
rol recibe `permission denied for table consumer_account`; y sin `app.business_id` en la sesion la
funcion **corta con error** (falla cerrado, no devuelve filas).

## Decision

1. **Proyeccion propia `core.business_customer`**, PK `(business_id, consumer_id)`: `display_name`,
   `search_name` (`lower(unaccent(nombre completo))`), `phone_e164` (copia; nunca sale en un DTO),
   `enrolled_at` (la primera alta en cualquier programa del negocio), `last_visit_at` (null = nunca
   vino). Se escribe **en la misma operacion** que la origina: alta (self-service y auto-alta del
   mostrador), compra y canje (de premio o de cupon) en mostrador. Sin cron ni cola.
2. **Todo indice empieza por `business_id`**: `(business_id, last_visit_at desc nulls last,
   consumer_id)` para orden, paginas y conteo; `unique (business_id, phone_e164)` para el telefono;
   GIN `(business_id, search_name gin_trgm_ops)` (con `btree_gin`) para el nombre.
3. **Aislamiento en dos capas, la segunda en la base:**
   - **Capa 1, la app:** `requireApiPermission(request, "counter")` — sesion valida, miembro activo,
     owner o staff con `counter`. El `business_id` sale de ahi, nunca de la request.
   - **Capa 2, la base:** la lectura corre en **una** transaccion que hace
     `SET LOCAL ROLE customer_reader` y fija `app.business_id` con `set_config(…, true)`.
     `customer_reader` es un rol `NOLOGIN NOBYPASSRLS` que **solo** puede leer `business_customer` y
     las columnas de saldo de `consumer.program_membership`, las dos con RLS
     `business_id = current_setting('app.business_id')::uuid`. **No** puede leer la tabla global de
     cuentas ni ninguna otra. `SET LOCAL` muere con la transaccion, asi que no se filtra a otra
     request del pool (el pool de WebSocket fija un cliente por transaccion, ADR 0067).
   - Las consultas de la app **ademas** llevan `business_id = $1` explicito: con RLS activa es
     redundante, y es lo que las mantiene rapidas y correctas si una politica se rompiera.
4. **La busqueda por nombre es una funcion `SECURITY DEFINER`** (`core.search_business_customers`)
   que toma el negocio de `current_setting('app.business_id')` —**no** de un parametro—, escapa los
   comodines de `LIKE` adentro, devuelve la pagina y el total, y solo la puede ejecutar
   `customer_reader`. Es la forma de que el indice de trigramas funcione con aislamiento en la base.
5. **Paginas numeradas por OFFSET con *deferred join***, conteo en la misma respuesta. Nombre desde 3
   caracteres. Telefono solo por igualdad exacta en E.164, con respuesta identica exista o no en la
   red.

## Consecuencias

- **Limite declarado de la capa 2:** protege contra **errores del codigo** (un filtro olvidado, un
  join mal hecho, una consulta nueva que alguien escriba mañana): el rol no ve otro negocio ni la
  tabla de cuentas, escriba la app lo que escriba. **No** protege contra una inyeccion SQL que ejecute
  `RESET ROLE`, porque la conexion sigue siendo `neondb_owner` por debajo. Drizzle parametriza todo,
  asi que ese riesgo es bajo; cerrarlo del todo es darle a la lectura un **rol con login y credencial
  propios** (una connection string mas en Vercel), anotado en `PARQUEADO.md`.
- Habilitar RLS en `consumer.program_membership` **no cambia nada para el resto de la app**:
  `neondb_owner` es dueño de la tabla y tiene `BYPASSRLS`. Se prueba corriendo las suites existentes
  del mostrador y del alta.
- **Invariante que tiene que sobrevivir a cualquier feature futura**: todo camino que cree una
  membresia, una compra o un canje en mostrador escribe la proyeccion en la misma operacion; todo
  camino que **edite el nombre o el telefono** de una cuenta (hoy no existe ninguno) tiene que
  actualizar sus filas. Va en el docblock de la tabla.
- La ultima pagina y el conteo dependen del visibility map (index-only scan); el autovacuum de Neon
  lo mantiene. Si un comercio grande se degrada, es lo primero que se mira.
- La proyeccion es la base natural de los **tiers** (fuera de alcance hoy): suman columnas aca y un
  recalculo nocturno, sin tocar el listado.
