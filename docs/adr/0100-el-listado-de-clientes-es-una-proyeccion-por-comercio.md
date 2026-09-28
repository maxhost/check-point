---
adr: 0100
fecha: 2026-09-28
estado: aceptada
resumen: El listado de clientes del comercio se lee de una proyeccion propia `core.business_customer` (una fila por negocio×cliente, mantenida en la MISMA transaccion del alta, la compra y el canje), con todo indice encabezado por `business_id`; el aislamiento es un filtro explicito desde el guard, NO RLS (medido: el rol de la app tiene BYPASSRLS y con RLS la busqueda por nombre es 10× mas lenta). Paginas numeradas por OFFSET con «deferred join»; nombre por trigramas desde 3 caracteres; telefono solo por igualdad exacta y nunca en la respuesta.
---

# 0100 — El listado de clientes es una proyeccion por comercio

## Contexto

El owner pidio (2026-09-28) que el comercio vea el listado de sus clientes: nombre, fecha de alta,
ultima visita y puntos/sellos del programa activo, con paginas numeradas (y anterior/siguiente),
busqueda por nombre y por telefono (el telefono se busca pero **no se ve**). Lo ven el owner y el
staff con el permiso `counter`. Requisito explicito: un comercio **nunca** ve un cliente que no esta
en uno de sus programas, y tiene que ser rapido en una red de cientos de miles o millones de clientes.

Decisiones del owner en la misma sesion: aparecen **todos los historicos** (quien se enrolo alguna
vez en cualquier programa del negocio, una fila por persona); «ultima visita» = **compra o canje**;
orden **fijo por ultima visita**; tiers fuera de alcance; la UI la hace GPT, nosotros API y contrato.

Hechos del arbol que condicionan el diseño:

- Un negocio tiene como mucho **un** programa operativo (`core_loyalty_program_one_operational`,
  `schema/loyalty.ts:137`), pero puede tener varios en el tiempo; la membresia es **por programa**
  (`consumer.program_membership`) y un cambio de programa **no** mueve a nadie. «Cliente del
  comercio» ≠ «membresia».
- «Ultima visita» no esta guardada: marketing la calcula con `max(order.created_at)` por consulta
  (`marketing/audience.ts:35`).
- El nombre (`first_name` + `last_name`, ambos obligatorios) se escribe **solo** al crear la cuenta
  (`consumer/enrollment.ts:177`, `consumer/recovery/verify.ts:178`); ningun camino lo edita.

## Medicion (rama efimera `bench-clientes-comercio`, hija de `ci-integration`, PG 18.6)

Datos sinteticos: 1.000.000 de cuentas, 3.000.000 de filas negocio×cliente (1 comercio de 200.000 y
1.000 de 2.800, con clientes compartidos), nombres de un pool chico para que haya homonimos.
Todo con `EXPLAIN (ANALYZE)`:

| Consulta (comercio de 200.000) | Tiempo |
|---|---|
| Pagina 1 (25 filas) + saldo del programa activo por PK de membresia | **0,6 ms** |
| Ultima pagina, OFFSET 199.975, forma ingenua | **160 ms** (ordena 200k en disco) |
| Ultima pagina, OFFSET 199.975, *deferred join* (index-only scan de claves → 25 lecturas por PK) | **46 ms** |
| `count(*)` del comercio (index-only) | **35–60 ms** |
| Nombre, termino comun (`maría`, ~5%) | **2,3 ms** |
| Nombre, termino raro (`villacis ord`), con conteo | **4,8 ms** |
| Nombre, termino sin resultados (`xqzw`) | **0,8 ms** |
| Nombre de **2** letras sin resultados (`xq`): el trigrama no aplica | **56 ms** |
| Telefono exacto → cuenta → fila del comercio | **0,08 ms** |
| Upsert de la proyeccion (lo que suma cada compra/canje) | **3,5 ms** |
| **Sin** filtro por negocio (lo que pasa si el filtro falla) | **940 ms**, seq scan de 3M |

**RLS, medido aparte:**

- El unico rol de login de la app en prod es `neondb_owner`, miembro de `neon_superuser`, con
  **`rolbypassrls = true`** (`pg_roles` y `pg_stat_activity` de `main`, 2026-09-28). Una politica RLS
  escrita hoy **no aisla nada**: se probo con `FORCE ROW LEVEL SECURITY` y el conteo de un negocio
  ajeno devolvio sus 2.800 filas.
- Con un rol **sin** bypass (`bench_app`) la politica
  `business_id = current_setting('app.business_id')::uuid` aisla (0 filas ajenas) y la pagina 1 sigue
  en **0,08 ms**: la politica entra como condicion de indice. **Pero la busqueda por nombre pasa de
  4,8 ms a 55 ms**: `LIKE` no es `leakproof`, asi que el planner no puede evaluarlo antes del filtro
  de seguridad y el indice de trigramas queda sin usar para el termino. Ese es el «parto» de RLS que
  el owner vio en otros productos, y aca quedo medido.

## Decision

1. **Proyeccion propia `core.business_customer`**, PK `(business_id, consumer_id)`: `display_name`,
   `search_name` (`lower(unaccent(nombre completo))`), `enrolled_at` (la primera alta en cualquier
   programa del negocio), `last_visit_at` (null = nunca vino). Se escribe **en la misma transaccion**
   que la origina: alta (self-service y auto-alta del mostrador), compra y canje en mostrador. Asi la
   proyeccion nunca queda atras de su fuente y no hay cron ni cola.
2. **Todo indice empieza por `business_id`**: `(business_id, last_visit_at desc nulls last,
   consumer_id)` para el orden y el conteo; GIN `(business_id, search_name gin_trgm_ops)` (con
   `btree_gin`) para el nombre. El costo de una pagina depende del tamaño del comercio, no de la red.
3. **Aislamiento por filtro explicito, no por RLS**: el `business_id` sale del guard
   (`requireApiPermission(..., "counter")`), nunca de la request, y **una sola funcion** de lectura lo
   aplica. Lo blindan un test de integracion con dos negocios que comparten un cliente y una mutacion
   que quita el filtro.
4. **Paginas numeradas por OFFSET con *deferred join***: las claves de la pagina salen de un
   index-only scan y las filas se leen por PK. El conteo va en la misma respuesta.
5. **Busqueda por nombre desde 3 caracteres** (con 2 el trigrama no aplica y se cae al barrido
   medido de 56 ms); los comodines de `LIKE` de la entrada se escapan.
6. **Telefono solo por igualdad exacta en E.164**; la respuesta es la misma lista (vacia o con una
   fila) exista o no el telefono en la red. El telefono **nunca** se serializa.

## Consecuencias

- **RLS queda como endurecimiento aparte, no descartado** (`PARQUEADO.md`): exige un rol de base
  propio sin `BYPASSRLS`, fijar `app.business_id` por transaccion (el pool de WebSocket solo fija un
  cliente dentro de una transaccion, ADR 0067) y aceptar o esquivar el costo de `leakproof` en la
  busqueda. No se paga hoy para una pantalla.
- **Invariante que tiene que sobrevivir a cualquier feature futura**: todo camino que cree una
  membresia, una compra o un canje en mostrador escribe la proyeccion en su transaccion; todo camino
  que **edite el nombre** de una cuenta (hoy no existe ninguno) tiene que actualizar `display_name` y
  `search_name` de todas sus filas. Se escribe en el docblock de la tabla.
- `vacuum` importa: el *deferred join* es index-only solo con el visibility map al dia. El
  autovacuum de Neon lo mantiene; si la ultima pagina de un comercio grande se degrada, es lo
  primero que se mira.
- La proyeccion es la base natural de los **tiers** (fuera de alcance hoy): suman columnas aca y un
  recalculo nocturno, sin tocar el listado.
