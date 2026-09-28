---
spec: 0108
fecha: 2026-09-28
estado: cerrada
resumen: El comercio (owner y staff con `counter`) ve el listado paginado de SUS clientes —nombre, alta, ultima visita, puntos/sellos del programa activo— y busca por nombre o por telefono exacto, leido de la proyeccion `core.business_customer` con aislamiento en dos capas (guard + rol de base con RLS, ADR 0100). API + contrato; la UI la hace GPT.
disjunta: no — toca `counter/orders.ts`, `counter/redemptions.ts`, `counter/coupon-store.ts`, `counter/resolve.ts` y `consumer/enrollment.ts`; serializar contra cualquier spec abierta sobre el mostrador o el alta
archivos: apps/merchant/src/server/schema/business-customer.ts, apps/merchant/src/server/schema.ts, apps/merchant/drizzle/0053_*.sql, apps/merchant/drizzle/meta/*, apps/merchant/src/server/customers/*, apps/merchant/src/app/api/customers/route.ts, apps/merchant/src/server/consumer/enrollment.ts, apps/merchant/src/server/counter/resolve.ts, apps/merchant/src/server/counter/orders.ts, apps/merchant/src/server/counter/redemptions.ts, apps/merchant/src/server/counter/coupon-store.ts, docs/specs/0108-contratos-de-api.md
---

# 0108 — Listado de clientes del comercio

> Plantilla grande: hay migracion (tabla, extensiones, rol, politicas, funcion y backfill).
> Implementa el **ADR 0100**, que trae la medicion completa (rama efimera, 3M filas, con y sin RLS).
> Contrato para GPT: `specs/0108-contratos-de-api.md`.

## Problema

El comercio no tiene donde ver quienes son sus clientes. Los competidores (Fivestars, Perkstar) lo
ofrecen. Los datos existen repartidos (`consumer.program_membership`, `core."order"`,
`core.reward_redemption`, `core.coupon_redemption`), pero «ultima visita» no esta guardada en ningun
lado y una consulta que la calcule sobre la red entera no escala (ADR 0100: 940 ms sin el filtro por
negocio). Y en esta base la app se conecta con un rol que se saltea RLS, asi que hoy el unico
aislamiento entre comercios es el codigo.

## Alcance

**Entra** (decisiones del owner, 2026-09-28):

- Listado de los clientes del negocio de la sesion: **todo el que se enrolo alguna vez en cualquier
  programa del negocio**, **una fila por persona** aunque este en varios programas del mismo negocio.
- Columnas: **nombre** (tal cual lo cargo el cliente: `first_name + ' ' + last_name`), **fecha de
  alta**, **ultima visita**, **puntos o sellos del programa operativo** (vacio si no esta en el).
- **Ultima visita = compra o canje en mostrador**, lo mas reciente. Todo canje (de premio o de cupon)
  es una visita: sin escanear el QR no hay canje posible.
- **Orden fijo**: ultima visita, mas reciente primero; los que nunca vinieron al final.
- **Paginas numeradas** con anterior/siguiente: la API devuelve pagina, total y cantidad de paginas.
- **Busqueda por nombre** (contiene, sin tildes ni mayusculas) y **por telefono** (exacto). El
  telefono se busca pero **nunca** se devuelve.
- Lo ven el **owner** y el **staff con el permiso `counter`**.
- **Aislamiento verificado por la base**, no solo por el codigo (pedido del owner): rol de base
  restringido + RLS por negocio.
- API y contrato HTTP. **La UI la hace GPT por fuera** (ADR 0070).

**No entra:**

- Tiers / segmentacion (fuera de alcance; la proyeccion queda lista para sumarlos).
- Ficha o detalle de un cliente, historial de compras, exportar, ordenar por otra columna, filtros.
- Editar el nombre o el telefono de un cliente (no existe hoy ningun camino que lo haga).
- Un rol de base con login y credencial propios (cierra el limite de inyeccion del ADR 0100; queda en
  `PARQUEADO.md`).
- RLS sobre el resto de las tablas de la app.
- Cualquier pantalla.

## Diseño

### Modelo de datos — `core.business_customer`

Archivo propio `schema/business-customer.ts` (limite de tamaño; re-exportado por `server/schema.ts`).

| Columna | Tipo | Regla |
|---|---|---|
| `business_id` | uuid not null, FK `core.business` on delete cascade | parte de la PK |
| `consumer_id` | uuid not null, FK `consumer.consumer_account` on delete cascade | parte de la PK |
| `display_name` | text not null | `first_name || ' ' || last_name` de la cuenta al escribir |
| `search_name` | text not null | `lower(unaccent(display_name))`, calculado en SQL al escribir |
| `phone_e164` | text not null | copia de la cuenta; **nunca** sale en un DTO |
| `enrolled_at` | timestamptz not null | la **primera** alta en cualquier programa del negocio: una segunda alta **no** la pisa (`least`) |
| `last_visit_at` | timestamptz null | `greatest(actual, nueva)`; null = nunca vino |

- PK `(business_id, consumer_id)`.
- Indice `(business_id, last_visit_at desc nulls last, consumer_id)`: orden, paginas y conteo.
- Unico `(business_id, phone_e164)`: busqueda por telefono.
- GIN `(business_id, search_name gin_trgm_ops)`: busqueda por nombre (requiere `btree_gin`).
- Docblock con el invariante del ADR 0100: todo camino que cree membresia, compra o canje en mostrador
  escribe la fila en la misma operacion; todo camino futuro que edite nombre o telefono actualiza sus
  filas.

### Migracion `0053`

El **mecanismo** se probo a mano en la rama del benchmark (ADR 0100) como `neondb_owner` —el rol con
el que corre `db:migrate`—, sobre el esquema `bench`: crear el rol, `GRANT … WITH SET TRUE`,
`SET LOCAL ROLE`, RLS por `app.business_id` y la funcion `SECURITY DEFINER`. **Las variantes exactas
de esta lista NO se probaron** —grant por columnas, politica `TO customer_reader`, `current_setting`
sin `missing_ok`, `unaccent` dentro de la funcion— y las verifica el implementador contra la base:

1. `CREATE EXTENSION IF NOT EXISTS pg_trgm`, `unaccent`, `btree_gin` (disponibles, ninguna instalada
   en `main` hoy). El unico `IF NOT EXISTS` legitimo del repo es el de una extension.
2. La tabla y sus indices.
3. **Rol** `customer_reader`: `NOLOGIN NOBYPASSRLS`; `GRANT customer_reader TO neondb_owner WITH SET
   TRUE` (sin eso `SET ROLE` falla con `permission denied to set role`, medido);
   `GRANT USAGE` sobre `core` y `consumer`; `GRANT SELECT` sobre `core.business_customer`; `GRANT
   SELECT (consumer_id, program_id, business_id, points_balance, stamps_count)` sobre
   `consumer.program_membership`. **Nada mas.** El rol es global al cluster: la migracion lo crea si
   no existe (`DO $$ … IF NOT EXISTS (select from pg_roles …) $$`), porque las ramas de Neon heredan
   los roles del padre.
4. **RLS** (`ENABLE`, no `FORCE`) en `core.business_customer` y `consumer.program_membership`, con una
   politica `FOR SELECT TO customer_reader USING (business_id = current_setting('app.business_id')::uuid)`.
   Sin `missing_ok`: si la variable no esta fijada, la consulta **corta con error** (falla cerrado).
   `neondb_owner` es dueño y tiene `BYPASSRLS`: el resto de la app no cambia.
5. **Funcion** `core.search_business_customers(term text, page_limit int, page_offset int)`:
   `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = core, pg_temp`; toma el negocio de
   `current_setting('app.business_id')::uuid`; escapa `\`, `%` y `_` del termino y compara
   `search_name LIKE '%' || lower(unaccent(term)) || '%' ESCAPE '\'`; devuelve `display_name`,
   `enrolled_at`, `last_visit_at`, `consumer_id` (lo necesita el join del saldo; no sale al DTO) y el
   `total` de coincidencias, en el orden fijo. `REVOKE ALL … FROM PUBLIC`; `GRANT EXECUTE … TO
   customer_reader`. `unaccent` dentro de una `SECURITY DEFINER` necesita su esquema en el
   `search_path` o calificado (`public.unaccent`): el implementador lo verifica contra la base.
6. **Backfill**, una fila por `(business_id, consumer_id)` de `consumer.program_membership`:
   `enrolled_at = min(enrolled_at)`; nombre y telefono de la cuenta; `last_visit_at` = el maximo de
   `core."order".created_at`, `core.reward_redemption.created_at` y
   `core.coupon_redemption.created_at` (`schema/campaign-turn.ts:158`) de ese negocio y consumidor.
   Prod tiene 0 membresias (2026-09-28); el backfill igual tiene que ser correcto en `ci-integration`.

Aditiva: el codigo que corre en prod no toca nada de esto, asi que **se aplica antes del deploy**. El
deploy no puede ir antes: el codigo nuevo escribe la tabla en cada compra.

### Escrituras — en la misma operacion que su origen

La fila de la proyeccion y la de origen se confirman juntas o ninguna (misma sentencia con CTE, o
misma transaccion; lo elige el implementador). Las escrituras corren como `neondb_owner`, **no** como
`customer_reader`.

| Origen | Donde (medido 2026-09-28) | Efecto |
|---|---|---|
| Alta self-service | `consumer/enrollment.ts:213` (sentencia suelta) | upsert: crea la fila o baja `enrolled_at` con `least`; no toca `last_visit_at` |
| Auto-alta en mostrador | `counter/resolve.ts:186` (sentencia suelta, reintento por `23505`) | igual |
| Compra acreditada | `counter/orders.ts:123` (CTE `ins`) | `last_visit_at = greatest(…, created_at de la orden)` |
| Canje de premio | `counter/redemptions.ts:184` (en `withDbTransaction`, `:112`) | idem |
| Canje de cupon | `counter/coupon-store.ts:207` (en `withDbTransaction`, `:114`) | idem |

- **Costo:** 0,05–0,4 ms por compra, constante (ADR 0100): una fila por cliente que se actualiza en su
  lugar, no una fila por compra.
- **Cuidado en las dos altas:** hoy capturan el `23505` y releen. Dentro de una transaccion de
  Postgres un error la aborta y la relectura falla. Si se envuelven, el `23505` sigue siendo el camino
  al 409 `already_member` / a la relectura, y **un 409 no escribe la proyeccion**. Un `on conflict do
  nothing` en la membresia mas el upsert condicionado a que haya insertado es una forma valida.
- El regalo de Bienvenida entregado al instalar el pase no pasa por mostrador: no es visita.

### Lectura — `server/customers/`

**Una** funcion `withCustomerReader(businessId, fn)` abre `withDbTransaction`, **primero** resuelve el
programa operativo del negocio (id y `kind`, como `neondb_owner`), despues ejecuta
`SET LOCAL ROLE customer_reader` y `select set_config('app.business_id', $1, true)`, y recien ahi corre
`fn`. Ninguna otra funcion lee `business_customer` para el comercio.

- **Pagina** (25 filas, fija), *deferred join*: claves de la pagina desde el indice de orden
  (`… where business_id = $1 order by last_visit_at desc nulls last, consumer_id limit 25 offset
  ($page-1)*25`), filas por PK, y `left join consumer.program_membership` por
  `(consumer_id, program_id)` del programa operativo. `kind='points'` → `points_balance`;
  `kind='stamps'` → `stamps_count`; sin programa operativo, sin membresia en el o de otro `kind` →
  `null`. El `business_id = $1` explicito va **ademas** de RLS (ADR 0100 §3).
- **Conteo**: `count(*)::int` con el mismo `where` (`count(*)` es `bigint`: el driver lo devuelve como
  string).
- **Nombre** (`q`, 3 a 60 caracteres recortado): `core.search_business_customers`, y el saldo con el
  mismo `left join`.
- **Telefono** (`phone`, E.164 con la regex de `consumer/validation.ts:5`):
  `where business_id = $1 and phone_e164 = $2`. No existe o es de otro negocio → **misma** respuesta:
  `items: []`, `total: 0`.
- `q` y `phone` juntos → 400. Una pagina mas alla de la ultima → `items: []` con el `total` real.
- Fechas en ISO-8601 (con SQL crudo, `timestamptz` llega como string).

### Autorizacion y DTO

- `GET /api/customers` con `requireApiPermission(request, "counter")` (`server/api-permission.ts:91`):
  owner siempre, staff con `counter`. La escalera de errores es la del guard; no se reescribe.
- **El DTO por fila tiene EXACTAMENTE** `name`, `enrolledAt`, `lastVisitAt`, `balance`. **Nunca**
  `consumerId` (dos comercios podrian cruzar listas y saber que clientes comparten), telefono,
  `qrToken`, `webViewToken` ni nada mas de la cuenta.

### Arquitectura de referencia

ADR 0100 (esta decision), ADR 0032 (DB compartida, analitica aislada por `business_id`), ADR 0067
(transaccion por request en el pool de WebSocket), ADR 0079 (permisos delegables), ADR 0070 (API sin
UI), ADR 0042 (dimensiones del evento de valor).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/schema/business-customer.ts` | crear |
| `apps/merchant/src/server/schema.ts` | editar (re-export) |
| `apps/merchant/drizzle/0053_*.sql` + `meta/` | generar con `drizzle-kit` y completar extensiones, rol, RLS, funcion y backfill |
| `apps/merchant/src/server/customers/` (lectura con `withCustomerReader`, validacion, escritura de la proyeccion) | crear |
| `apps/merchant/src/app/api/customers/route.ts` | crear |
| `apps/merchant/src/server/consumer/enrollment.ts` | editar |
| `apps/merchant/src/server/counter/resolve.ts` | editar |
| `apps/merchant/src/server/counter/orders.ts` | editar |
| `apps/merchant/src/server/counter/redemptions.ts` | editar |
| `apps/merchant/src/server/counter/coupon-store.ts` | editar |
| tests unit + `.neon.integration` nuevos junto a cada modulo | crear |
| `docs/specs/0108-contratos-de-api.md` | ya escrito; editar solo si el codigo lo contradice, avisando |

### Disjunta?

**No.** Toca el mostrador y el alta. Hoy no hay otra spec abierta sobre esos archivos (INDEX,
2026-09-28); si aparece una, se serializa.

### Archivos compartidos

Ninguno: el contrato ya esta escrito.

## Definition of Done

- [ ] Migracion `0053` aplicada a una rama efimera y a `ci-integration`: tabla, indices, extensiones,
      rol, grants, politicas y funcion presentes (verificado por SQL); backfill correcto sobre un
      mundo sembrado.
- [ ] Las cinco escrituras mantienen la proyeccion; un 409 `already_member` no la toca.
- [ ] `GET /api/customers` cumple el contrato `0108-contratos-de-api.md`.
- [ ] Aislamiento probado en las **dos** capas (abajo).
- [ ] DTO con exactamente las cuatro claves por fila.
- [ ] Las suites `.neon.integration` existentes del mostrador y del alta siguen verdes con RLS
      habilitada en `program_membership`.
- [ ] Benchmark de aceptacion corrido por el revisor, con los numeros en el handoff.
- [ ] Gates: `typecheck`, `lint`, `test`, `format:check`, `build` (de a uno, forzados) y las suites
      `.neon.integration` nuevas y tocadas via `tools/neon-test.sh`. No lleva `test:e2e` (no toca UI).

## Plan de pruebas y verificacion

**Integracion (`.neon.integration`), el mundo:** negocios A, B y C. Cliente X en A y en B; Y solo en
B; Z en A en un programa **viejo** (`inactive`) y en el operativo; W en A solo en un programa viejo.

- [ ] **Capa 1 (endpoint):** A lista X, Z y W, **nunca** Y. B lista X e Y. C lista vacio. Nombre y
      telefono de Y desde A → vacio, y el de telefono con la **misma forma** que uno inexistente.
- [ ] **Capa 2 (base), sin pasar por las consultas de la app:** dentro de `withCustomerReader(A)` se
      corre SQL crudo **sin filtro** — `select count(*) from core.business_customer`,
      `select count(*) from consumer.program_membership` — y da solo lo de A;
      `select 1 from consumer.consumer_account` y `select 1 from core."order"` fallan con
      `permission denied`; `core.search_business_customers` devuelve solo coincidencias de A; y la
      funcion sin `app.business_id` fijado **falla** (no devuelve filas).
- [ ] Una fila por persona: Z aparece **una** vez en A; su `enrolledAt` es la alta **mas vieja**.
- [ ] Saldo: Z trae el del programa operativo; W trae `null`; un negocio sin programa operativo trae
      `null` en todas.
- [ ] Ultima visita: una compra, un canje de premio y un canje de cupon la mueven cada uno; una compra
      en B no la mueve en A; quien nunca vino va al final.
- [ ] Alta: self-service y auto-alta en mostrador crean la fila; un 409 `already_member` la deja byte
      a byte igual.
- [ ] Paginas: con 30 clientes, pagina 1 = 25, pagina 2 = 5, pagina 3 = `[]` con `total: 30` y
      `totalPages: 2`; ninguna fila repetida ni perdida entre paginas.
- [ ] Busqueda: `maria` encuentra «María»; `MAR` y `már` tambien; `q` de 2 caracteres → 400;
      `q = "___"` **no** devuelve a todos (escape).
- [ ] Autorizacion: staff sin `counter` → 403 `missing_permission`; staff con `counter` → 200; owner
      → 200; sin sesion → 401.
- [ ] DTO: `Object.keys` de cada fila es exactamente `["balance","enrolledAt","lastVisitAt","name"]`.

**Unit:** validacion de entrada (`page`, `q`, `phone`, exclusion mutua).

**Mutaciones** — presupuesto **8**, protocolo de la skill `protocolo-de-verificacion` (etiqueta
`MUTATION`, `shasum` antes, revertir con `diff`). Condicion de corte: las 8 muerden **por el motivo
correcto**; una que no muerde se reporta como oraculo faltante, no se persigue una novena. Clase de
error a cazar: **fuga entre comercios (en cada capa por separado), proyeccion desincronizada y fuga
en el DTO**.

| # | Mutacion | Mecanismo (donde va a vivir) | Tiene que morder |
|---|---|---|---|
| M1 | sacar el `SET LOCAL ROLE customer_reader` | `withCustomerReader`, `server/customers/` | capa 2: el `count(*)` sin filtro ve otros negocios |
| M2 | la politica de `business_customer` con `USING (true)` (en la rama del test) | migracion `0053` | capa 2: el `count(*)` sin filtro |
| M3 | la funcion de busqueda sin `business_id = …` | migracion `0053` | capa 2: busqueda desde A ve a Y |
| M4 | no escribir la proyeccion en la compra | `counter/orders.ts:123` | ultima visita por compra |
| M5 | no escribir la proyeccion en el canje de premio | `counter/redemptions.ts:184` | ultima visita por canje |
| M6 | `enrolled_at = excluded.enrolled_at` en vez de `least` | escritura en `server/customers/` | Z con su alta mas vieja |
| M7 | agregar `consumerId` al DTO | lectura en `server/customers/` | claves del DTO |
| M8 | no escapar `%`/`_` en la funcion | migracion `0053` | `q = "___"` |

**Declarado fuera:**

- El `business_id = $1` explicito de las consultas de la app **no tiene oraculo mientras RLS este
  sana**: sacarlo no cambia ningun resultado, porque la capa 2 lo cubre. Es la defensa para cuando una
  politica se rompa; M1/M2 prueban la otra direccion.
- Las escrituras de `coupon-store.ts` y de las dos altas tienen test de integracion pero no mutacion
  propia.
- El rendimiento no tiene test automatico (un test sobre `EXPLAIN` es fragil); lo cubre el benchmark.
- La inyeccion con `RESET ROLE` (limite declarado del ADR 0100).

**Benchmark de aceptacion** (lo corre el **revisor**, en una rama efimera hija de `ci-integration`
con la migracion `0053` real, o en `bench-clientes-comercio` despues de aplicarla ahi): 3M filas, un
negocio de 200.000, `vacuum analyze`, y `EXPLAIN (ANALYZE)` **del SQL exacto que emite el codigo**,
**corriendo como `customer_reader`** dentro de la transaccion. Dos corridas; vale la segunda. Umbrales
para el negocio de 200.000 (el ADR 0100 midio 0,3 / 63 / 79 / 16 / 0,04 ms):

| Consulta | Umbral |
|---|---|
| pagina 1 + conteo | < 150 ms |
| ultima pagina + conteo | < 250 ms |
| nombre de 3+ caracteres, comun / raro / sin resultados, con total | < 50 ms |
| telefono | < 5 ms |

Si una no llega, es FAIL y vuelve al diseño; no se afloja el umbral.

**Comandos:** Node 24 (`nvm use`); `TURBO_FORCE=1 pnpm run typecheck`, `pnpm run lint`,
`pnpm run test`, `pnpm run format:check`, `TURBO_FORCE=1 pnpm run build` (separados);
`tools/neon-test.sh <archivos>`.

**Verificacion manual:** no hay pantalla. El owner prueba con `curl` autenticado o con la UI de GPT.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. Un implementador para toda la spec, un revisor independiente al
final con este presupuesto. Aplicar `0053` a prod es paso del orquestador **despues** del PASS y
**antes** del deploy, verificando despues por SQL que existan el rol, las politicas y la funcion.

## Abierto

Nada.
