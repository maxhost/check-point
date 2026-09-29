---
spec: 0109
fecha: 2026-09-28
estado: implementada
resumen: Tres mejoras de rendimiento al listado de clientes (spec 0108) antes de ir a prod — contador por negocio mantenido por trigger, busqueda con pagina y total separados, y 4 viajes a la base en vez de 7 (ADR 0101). Migracion `0054` aditiva; el contrato HTTP no cambia.
disjunta: no — toca `server/customers/*` y los tests de la 0108; serializar contra cualquier cambio a la 0108
archivos: apps/merchant/drizzle/0054_*.sql, apps/merchant/drizzle/meta/*, apps/merchant/src/server/schema/business-customer.ts, apps/merchant/src/server/customers/reader.ts, apps/merchant/src/server/customers/list.ts, apps/merchant/src/server/customers-*.neon.integration.test.ts, apps/merchant/src/server/customers-integration-support.ts
---

# 0109 — Rendimiento del listado de clientes

> Implementa el **ADR 0101**, que trae la medicion. Enmienda la 0108 **antes** de que llegue a prod:
> las migraciones `0053` y `0054` van juntas. El contrato `specs/0108-contratos-de-api.md` **no cambia**.

## Problema

En un negocio de 200.000 clientes (ADR 0101, medido): el total sin filtro cuesta 44–49 ms en cada
pedido y domina la pagina 1 (0,4 ms); la busqueda por nombre cuesta 17–45 ms porque cuenta y ordena
todas las coincidencias antes de paginar; y la lectura hace 7 viajes a una base que esta en otra
region.

## Alcance

**Entra** (pedido del owner, 2026-09-28: «implementa las tres mejoras y dejalas documentadas»):

1. Contador de clientes por negocio, mantenido por trigger.
2. Busqueda con pagina y total calculados por separado.
3. La lectura en 4 viajes.

**No entra:** mover la region de Vercel, el tamaño del computo de Neon (decisiones del owner, ADR 0101),
paginacion por cursor, cualquier cambio al contrato HTTP o a la UI.

## Diseño

### Migracion `0054` (aditiva; la `0053` no se toca)

1. `core.business_customer_count`: `business_id uuid PK` FK `core.business(id) on delete cascade`,
   `customers int not null default 0`, `CHECK (customers >= 0)`.
2. Funcion de trigger (`plpgsql`) + trigger `AFTER INSERT OR DELETE ON core.business_customer FOR EACH
   ROW`: en `INSERT`, upsert del contador (+1); en `DELETE`, `-1`. Medido en la rama (ADR 0101): un
   `INSERT … ON CONFLICT DO UPDATE` que actualiza **no** dispara el `AFTER INSERT`; uno que inserta si; un
   borrado en cascada del padre dispara el `AFTER DELETE`. Si el contador del negocio ya se borro por su
   propio cascade, el `UPDATE` afecta 0 filas: correcto.
3. Backfill: `INSERT … SELECT business_id, count(*) FROM core.business_customer GROUP BY 1`.
4. `GRANT SELECT ON core.business_customer_count TO customer_reader`; `ENABLE ROW LEVEL SECURITY`;
   politica `FOR SELECT TO customer_reader USING (business_id = current_setting('app.business_id')::uuid)`.
5. `GRANT SELECT (id, business_id, kind, status) ON core.loyalty_program TO customer_reader`; `ENABLE
   ROW LEVEL SECURITY`; la misma politica. El dueño tiene `BYPASSRLS`: el resto de la app no cambia (se
   prueba con las suites existentes que leen programas).
6. `CREATE OR REPLACE FUNCTION core.search_business_customers` con la **misma firma, el mismo
   `SECURITY DEFINER`, el mismo `search_path`, el mismo escape y la misma forma de salida** (siempre la
   fila del total), pero con pagina y total como subconsultas independientes: la pagina directo sobre
   `core.business_customer` con `ORDER BY last_visit_at DESC NULLS LAST, consumer_id LIMIT/OFFSET`, y el
   total con su propio `count(*)`; **ninguna de las dos lee de un CTE materializado con todas las
   coincidencias**. Despues del `CREATE OR REPLACE`, confirmar por SQL que el `proacl` sigue sin
   `PUBLIC` y con `EXECUTE` para `customer_reader`.

### Lectura

- `withCustomerReader`: `BEGIN`; **una** sentencia
  `SELECT set_config('role','customer_reader',true), set_config('app.business_id',$1,true)`; la
  consulta; `COMMIT`. Ya no resuelve el programa como dueño antes de cambiar de rol.
- **Cada forma (todos / nombre / telefono) es UNA sentencia** que resuelve el programa operativo
  (`core.loyalty_program` con `status IN ('active','closing')`, como `customer_reader`), la pagina, el
  saldo y el total, y devuelve el `kind` del programa en la fila. Sin filtro, el total sale de
  `core.business_customer_count` (`coalesce(…, 0)` si el negocio no tiene fila todavia). Por nombre,
  de la funcion. Por telefono, de las filas.
- Se mantiene el `business_id = $1` explicito en cada consulta, ademas de RLS (ADR 0100 §3).
- El DTO, el orden, las paginas y los errores no cambian.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/drizzle/0054_*.sql` + `meta/` | crear |
| `apps/merchant/src/server/schema/business-customer.ts` | editar (tabla del contador; el trigger y las politicas van en SQL) |
| `apps/merchant/src/server/customers/reader.ts`, `list.ts` | editar |
| `apps/merchant/src/server/customers-*.neon.integration.test.ts`, `customers-integration-support.ts` | editar / extender |

### Disjunta?

No: es la misma superficie que la 0108. Nada mas abierto la toca.

## Definition of Done

- [ ] `0054` aplicada en `ci-integration`: tabla, trigger, backfill, grants, politicas y funcion nueva,
      verificado por SQL.
- [ ] Las 3 suites de la 0108 y las existentes que leen `core.loyalty_program` o escriben la
      proyeccion, verdes.
- [ ] Contador correcto tras alta nueva, re-alta (409), compra, canje y borrado en cascada.
- [ ] La lectura hace **4** viajes (oraculo abajo).
- [ ] Benchmark (lo corre el orquestador por MCP, como en la 0108): pagina 1 + total < 5 ms; busqueda
      por nombre (`maria`, `nez`, `ia `, `villacis`, `xqzw`) < 25 ms; ultima pagina + total < 100 ms;
      telefono < 5 ms.
- [ ] Gates: `typecheck`, `lint`, `test`, `format:check`, `build` (de a uno, forzados). Sin `test:e2e`.

## Plan de pruebas y verificacion

- [ ] **Contador (integracion):** en el mundo de la 0108, `customers` de A = filas de A en la
      proyeccion; sube en 1 con un cliente nuevo; **no** cambia con una re-alta 409, una compra ni un
      canje; baja al borrar una cuenta (cascade). La respuesta sin filtro trae ese `total`.
- [ ] **Capa 2 extendida:** con `withCustomerReader(A)`, `select count(*)` sin filtro sobre
      `core.loyalty_program` y sobre `core.business_customer_count` ve solo lo de A;
      `select configuration from core.loyalty_program` (columna no otorgada) → `permission denied`. **Corregido tras la implementacion:** la spec decia `name`, columna que NO existe (`schema/loyalty.ts`); la habria rechazado la base por inexistente, no por el grant.
- [ ] **Busqueda:** total correcto con mas de una pagina de coincidencias (p. ej. 30 que matchean → 25 +
      5, `total` 30 en las dos); pagina mas alla de la ultima → `[]` con el total real; escape intacto.
- [ ] **Viajes:** un test cuenta las sentencias que `withCustomerReader` + `listCustomers` mandan a la
      base (envolviendo el `execute` de la transaccion) y asevera 2 sentencias propias por pedido en las
      tres formas (el `BEGIN`/`COMMIT` los pone `withDbTransaction`).
- [ ] Todas las aserciones de la 0108 siguen verdes sin tocarlas (salvo las que dependan de cuantas
      sentencias se mandan, si las hubiera: se declara).

**Mutaciones** — presupuesto **5**, protocolo de la skill `protocolo-de-verificacion`. Condicion de
corte: las 5 muerden por el motivo correcto; la que no, se reporta como oraculo faltante. Clase de error:
**contador desincronizado, total de busqueda mal calculado, aislamiento roto por la refactorizacion.**

| # | Mutacion | Mecanismo | Tiene que morder |
|---|---|---|---|
| M1 | el trigger como `AFTER INSERT OR UPDATE OR DELETE` (cuenta compras) | trigger de la `0054` (en la base del test) | contador tras una compra |
| M2 | el trigger sin la rama `DELETE` | idem | contador tras el cascade |
| M3 | el total de la busqueda = filas de la pagina | funcion de la `0054` | 30 coincidencias → total 30 |
| M4 | sacar `set_config('role', …)` de la sentencia | `server/customers/reader.ts` | capa 2 |
| M5 | la politica de `loyalty_program` con `USING (true)` | `0054` (en la base del test) | capa 2 sobre `loyalty_program` |

**Declarado fuera:** la latencia de red entre Vercel `iad1` y Neon `us-east-2` (no medida; la mejora
de viajes se asevera por conteo de sentencias, no por tiempo); la contencion en la fila del contador
entre altas simultaneas del mismo negocio (aceptada en el ADR 0101).

## Handoff requerido

Un implementador y un revisor independiente (ADR 0071). El benchmark lo corre el orquestador por MCP.
Prod: `0053` y `0054` juntas, antes del deploy, con OK del owner.

## Abierto

Nada.

## Benchmark y hallazgo (2026-09-28) — la busqueda NO cumple; hay que corregirla

Implementada (`794b545`, `474c4c1`); revisor corriendo. `0054` aplicada a PROD (pedido del owner, junto
con la `0053`; verificada: `md5` busqueda `326fd2bf…`, trigger `22909f9e…`, trigger `AFTER INSERT OR
DELETE`, cuatro politicas, `loyalty_program` con grant `business_id,id,kind,status` y RLS `ENABLE`,
fila de Drizzle `b5547938…`/1790643238459) y a `bench-clientes-comercio`. Prod tiene 0 clientes: la
regresion de abajo hoy no afecta a nadie, y el codigo de la 0109 NO esta en `main`.

Benchmark (SQL exacto de `list.ts` + funcion real, como `customer_reader`, 2a corrida; el comercio
sintetico no tiene programa, asi que el join del saldo no encuentra membresias —~0,3 ms en la 0108—):

| Consulta | Umbral | Medido |
|---|---|---|
| pagina 1 + total | < 5 ms | **0,33 ms** OK |
| pagina 40 | — | 0,54 ms |
| ultima pagina + total | < 100 ms | **64,8 ms** OK |
| telefono | < 5 ms | **0,10 ms** OK |
| nombre `maria` / `nez` / `ia ` / `villacis` / `xqzw` | < 25 ms | **31,8 / 62,3 / 78,9 / 29,8 / 0,16 ms — NO CUMPLE** |

**Causa (medida):** la funcion es `LANGUAGE sql SECURITY DEFINER`, que no se inlinea y se planifica
sin el valor del termino, asi que el planner no puede elegir entre el indice de orden y el de trigramas.
La medicion del ADR 0101 (9–18 ms) se hizo con el termino LITERAL, no dentro de la funcion.
**Correccion medida en la rama:** la misma consulta en `LANGUAGE plpgsql` con `RETURN QUERY EXECUTE
format(…%L…)` (plan con el termino real en cada llamada): `maria` 9,0 / `nez` 12,5 / `ia ` 15,5 /
`villacis` 9,5 / `xqzw` 0,3 ms; ultima pagina de `ia ` 39,6 ms; escape (`___` → 0), tildes y
aislamiento (B ve sus 112) intactos. Va como migracion `0055` (`CREATE OR REPLACE`, misma firma y
salida) antes de cerrar esta spec.


### `0055` aplicada (2026-09-28, pedido del owner: «aplica todas las migraciones de una vez»)

Escrita por el orquestador (`drizzle/0055_busqueda_plpgsql.sql`, `drizzle-kit generate --custom`,
commit `a207e49`). En la rama del benchmark, con la funcion real: `maria` 8,7 / `nez` 12,2 / `ia `
15,4–18,9 / `villacis` 9,3 / `xqzw` 0,3 ms — **cumple el umbral < 25 ms**; ultima pagina de `ia ` 43,6
ms; `___` → 0; `MÁRÍA` → 10.000; sin resultados → la fila del total; pagina vacia conserva el total; B
ve sus 112; sin `app.business_id` → error (falla cerrado). **En PROD:** `md5(prosrc)` `b45a9521…`,
`plpgsql`, `prosecdef`, `search_path=core, pg_temp`, `proacl` sin PUBLIC, fila de Drizzle
`f06bb7e9…`/1790646206872; una llamada real como `customer_reader` sobre un negocio de prod devuelve la
fila del total en 0, sin error.

**Pendiente:** el revisor de la 0109 revisa la version `sql` (`794b545`); la `0055` **no tiene revision
independiente** y las suites `customers-*` todavia no corrieron contra ella en `ci-integration` (el
revisor estaba usando esa rama): correrlas cuando termine. El codigo de la 0109 sigue sin estar en `main`.

## Cierre (2026-09-28)

**PASS del revisor independiente** sobre `794b545`/`474c4c1` con la `0054`: re-ejecuto M1, M3, M4 (rojas
por la propiedad) y dos propias — O1 (programa operativo sin `status IN (…)`) ROJO y O2 (la pagina vacia
pierde la fila del total) ROJO. Gates verdes; 95 tests `.neon` en 15 archivos. Su `EXPLAIN` confirmo la
causa de la regresion de la busqueda: desde la 6a llamada de la sesion la funcion `sql` usa el plan
GENERICO (`rows=1000` para el `LIKE`, bitmap + sort) y duplica el costo; detras de un pool lo normal es
el generico. La `0055` (`EXECUTE`) planifica cada llamada con el termino real. Tras el veredicto, las 5
suites `customers-*` corrieron contra la `0055` en `ci-integration`: 36/36.

**Hallazgos declarados del revisor:** (1) el total de una busqueda sigue pagando el `count(*)` de todas
las coincidencias; (2) el trigger por fila escala mal en operaciones MASIVAS dentro de una transaccion
(200k altas: 355 s; borrar un negocio de 200k: 769 s) — hoy no hay ningun camino productivo que lo
haga; parqueado en `PARQUEADO.md` con el arreglo posible (trigger `FOR EACH STATEMENT` con tablas de
transicion); (3) el oraculo de «4 viajes» cuenta las llamadas a `execute` del `tx`, no lo que llega a la
base; alcanza porque `CustomerReader` solo expone `execute`.

**La `0055` no tuvo revision independiente** (la escribio el orquestador por pedido del owner); la
cubren las 36 suites y el benchmark con la funcion real.

