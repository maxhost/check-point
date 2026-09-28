---
spec: 0108
fecha: 2026-09-28
estado: cerrada
resumen: El comercio (owner y staff con `counter`) ve el listado paginado de SUS clientes —nombre, alta, ultima visita, puntos/sellos del programa activo— y busca por nombre o por telefono exacto, leido de la proyeccion `core.business_customer` (ADR 0100). API + contrato; la UI la hace GPT.
disjunta: no — toca `counter/orders.ts`, `counter/redemptions.ts`, `counter/coupon-store.ts`, `counter/resolve.ts` y `consumer/enrollment.ts`; serializar contra cualquier spec abierta sobre el mostrador o el alta
archivos: apps/merchant/src/server/schema/business-customer.ts, apps/merchant/src/server/schema.ts, apps/merchant/drizzle/0053_*.sql, apps/merchant/drizzle/meta/*, apps/merchant/src/server/customers/*, apps/merchant/src/app/api/customers/route.ts, apps/merchant/src/server/consumer/enrollment.ts, apps/merchant/src/server/counter/resolve.ts, apps/merchant/src/server/counter/orders.ts, apps/merchant/src/server/counter/redemptions.ts, apps/merchant/src/server/counter/coupon-store.ts, docs/specs/0108-contratos-de-api.md
---

# 0108 — Listado de clientes del comercio

> Plantilla grande: hay migracion (tabla + tres extensiones + backfill). Implementa el **ADR 0100**,
> que trae la medicion completa (rama efimera, 3M filas) y por que **no** es RLS. Contrato para GPT:
> `specs/0108-contratos-de-api.md`.

## Problema

El comercio no tiene donde ver quienes son sus clientes. Los competidores (Fivestars, Perkstar) lo
ofrecen. Los datos existen repartidos (`consumer.program_membership`, `core."order"`,
`core.reward_redemption`, `core.coupon_redemption`), pero «ultima visita» no esta guardada en ningun
lado y una consulta que la calcule sobre la red entera no escala (ADR 0100, medido: 940 ms sin el
filtro por negocio).

## Alcance

**Entra** (decisiones del owner, 2026-09-28):

- Listado de los clientes del negocio de la sesion: **todo el que se enrolo alguna vez en cualquier
  programa del negocio**, **una fila por persona** aunque este en varios programas del mismo negocio.
- Columnas: **nombre** (tal cual lo cargo el cliente: `first_name + ' ' + last_name`), **fecha de
  alta**, **ultima visita**, **puntos o sellos del programa operativo** (vacio si no esta en el).
- **Ultima visita = compra o canje en mostrador**, lo mas reciente.
- **Orden fijo**: ultima visita, mas reciente primero; los que nunca vinieron al final.
- **Paginas numeradas** con anterior/siguiente: la API devuelve pagina, total y cantidad de paginas.
- **Busqueda por nombre** (contiene, sin tildes ni mayusculas) y **por telefono** (exacto). El
  telefono se busca pero **nunca** se devuelve.
- Lo ven el **owner** y el **staff con el permiso `counter`**.
- API y contrato HTTP. **La UI la hace GPT por fuera** (ADR 0070).

**No entra:**

- Tiers / segmentacion (el owner los saco del alcance; el ADR 0100 deja la proyeccion lista para
  sumarlos).
- Ficha o detalle de un cliente, historial de compras, exportar, ordenar por otra columna, filtros.
- Editar el nombre de un cliente (no existe hoy ningun camino que lo edite).
- RLS: parqueado como endurecimiento (ADR 0100, Consecuencias).
- Cualquier pantalla.

## Diseño

### Modelo de datos — `core.business_customer`

Archivo propio `schema/business-customer.ts` (limite de tamaño; re-exportado por `server/schema.ts`).

| Columna | Tipo | Regla |
|---|---|---|
| `business_id` | uuid not null, FK `core.business` on delete cascade | parte de la PK |
| `consumer_id` | uuid not null, FK `consumer.consumer_account` on delete cascade | parte de la PK |
| `display_name` | text not null | `first_name || ' ' || last_name` de la cuenta al escribir |
| `search_name` | text not null | `lower(unaccent(display_name))` — se calcula en SQL al escribir, con la misma funcion con que se normaliza la busqueda |
| `enrolled_at` | timestamptz not null | la **primera** alta del consumidor en cualquier programa del negocio: una segunda alta (otro programa) **no** la pisa (`least`) |
| `last_visit_at` | timestamptz null | `greatest(actual, nueva)`; null = nunca vino |

- PK `(business_id, consumer_id)`.
- Indice `(business_id, last_visit_at desc nulls last, consumer_id)`: orden, paginas y conteo.
- Indice GIN `(business_id, search_name gin_trgm_ops)`: busqueda por nombre. Requiere `btree_gin`.
- El telefono **no** se copia: se resuelve contra `consumer_account_phone_unique`, que ya existe.
- Docblock de la tabla con el invariante del ADR 0100: todo camino que cree membresia, compra o canje
  en mostrador la escribe atomicamente; todo camino futuro que edite el nombre actualiza sus filas.

### Migracion `0053`

- `CREATE EXTENSION IF NOT EXISTS pg_trgm`, `unaccent`, `btree_gin` (disponibles en Neon, PG 18.6;
  medido: `pg_available_extensions` de `main`, ninguna instalada hoy). El unico `IF NOT EXISTS`
  legitimo del repo es el de una extension (gotcha de migraciones).
- La tabla y sus dos indices.
- **Backfill** desde lo que ya existe, una fila por `(business_id, consumer_id)` de
  `consumer.program_membership`: `enrolled_at = min(enrolled_at)`; `last_visit_at` = el maximo entre
  `core."order".created_at`, `core.reward_redemption.created_at` y `core.coupon_redemption.created_at` (`schema/campaign-turn.ts:158`)
  de ese negocio y consumidor. Prod hoy tiene 0 membresias (medido
  2026-09-28); el backfill igual tiene que ser correcto para `ci-integration` y cualquier rama.
- Aditiva: el codigo que corre en prod no lee ni escribe la tabla, asi que **puede aplicarse antes
  del deploy**. El deploy **no** puede ir antes: el codigo nuevo escribe la tabla en cada compra.

### Escrituras — atomicas con su origen

«Atomica» = la fila de la proyeccion y la fila de origen se confirman juntas o ninguna. La forma la
elige el implementador (misma sentencia con CTE, o misma transaccion).

| Origen | Donde (medido 2026-09-28) | Efecto en la proyeccion |
|---|---|---|
| Alta self-service | `consumer/enrollment.ts:213` (sentencia suelta, sin transaccion) | upsert: crea la fila o baja `enrolled_at` con `least`; no toca `last_visit_at` |
| Auto-alta en mostrador | `counter/resolve.ts:186` (sentencia suelta, reintento por `23505`) | igual que la anterior |
| Compra acreditada | `counter/orders.ts:123` (CTE `ins` dentro de una sentencia) | `last_visit_at = greatest(last_visit_at, created_at de la orden)` |
| Canje de premio | `counter/redemptions.ts:184` (dentro de `withDbTransaction`, `:112`) | idem con la fecha del canje |
| Canje de cupon en mostrador | `counter/coupon-store.ts:207` (dentro de `withDbTransaction`, `:114`) | idem con la fecha del canje |

- **Cuidado en las dos altas:** hoy capturan el `23505` y releen. Dentro de una transaccion de
  Postgres, un error aborta la transaccion y la relectura falla. Si se envuelven, el `23505` tiene que
  seguir siendo el camino al 409 `already_member` / la relectura, y **un 409 no escribe la
  proyeccion**. Un `on conflict do nothing` en la membresia mas el upsert condicionado a que haya
  insertado es una forma valida.
- El regalo de Bienvenida entregado al instalar el pase **no** es una visita: no pasa por mostrador.
- «Canje» incluye el cupon en mostrador (`coupon_redemption`) ademas del premio del programa:
  decision del **orquestador**, derivada del criterio del owner («las dos veces el cliente estuvo en
  el local»). Se reporta al owner como hallazgo; revertirla es sacar una fila de esta tabla y del
  backfill.

### Lectura — `server/customers/`

Una **unica** funcion de lectura recibe el `businessId` **del guard**. Ninguna otra lee la tabla para
el comercio.

- **Pagina** (25 filas, fijo): *deferred join* — las claves de la pagina salen de
  `select consumer_id, last_visit_at … where business_id = $1 [and filtro] order by last_visit_at
  desc nulls last, consumer_id limit 25 offset ($page-1)*25` y las filas se leen por PK. Medido en el
  ADR 0100: 0,6 ms la primera pagina y 46 ms la ultima de un comercio de 200.000 (la forma ingenua,
  160 ms).
- **Saldo**: `left join consumer.program_membership` por `(consumer_id, program_id)` con el programa
  **operativo** del negocio (`status in ('active','closing')`, el mismo predicado del unico parcial
  `core_loyalty_program_one_operational`). `kind='points'` → `points_balance`; `kind='stamps'` →
  `stamps_count`; sin programa operativo, sin membresia en el o de otro `kind` → `null`.
- **Conteo**: `count(*)::int` con el mismo `where` (gotcha: `count(*)` es `bigint` y el driver lo
  devuelve como string).
- **Nombre** (`q`): se recorta; debe tener **3 a 60 caracteres**; se normaliza con
  `lower(unaccent($q))` en SQL; `%`, `_` y `\` se **escapan** antes de armar el `like '%…%'`.
- **Telefono** (`phone`): E.164 exacto (la misma regex de `consumer/validation.ts:5`). Resuelve
  `consumer_account` por `phone_e164` y hace join a la proyeccion **del negocio de la sesion**. Si el
  telefono no existe o es de un cliente de otro negocio, la respuesta es **identica**: lista vacia,
  `total: 0`.
- `q` y `phone` juntos → 400.
- Una pagina mas alla de la ultima devuelve `items: []` con el `total` real, no un error.
- Fechas: si se lee con SQL crudo, `timestamptz` llega como string (gotcha); el DTO devuelve ISO-8601.

### Autorizacion y DTO

- `GET /api/customers` con `requireApiPermission(request, "counter")` (`server/api-permission.ts:91`):
  el owner pasa siempre, el staff necesita `counter`. La escalera de errores es la del guard
  (401 / 403 `not_member` / 403 `missing_permission` / estado del negocio); no se reescribe.
- **El DTO por fila tiene EXACTAMENTE**: `name`, `enrolledAt`, `lastVisitAt`, `balance`. **Nunca**
  `consumerId`, telefono, `qrToken`, `webViewToken` ni nada de la cuenta: un `consumer_id` le
  permitiria a dos comercios cruzar sus listas y saber que clientes comparten. La UI usa el indice de
  la fila como `key`.

### Arquitectura de referencia

ADR 0100 (esta decision), ADR 0032 (DB compartida, analitica aislada por `business_id`), ADR 0079
(permisos delegables), ADR 0070 (API sin UI), ADR 0042 (dimensiones del evento de valor).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/server/schema/business-customer.ts` | crear |
| `apps/merchant/src/server/schema.ts` | editar (re-export) |
| `apps/merchant/drizzle/0053_*.sql` + `meta/` | generar con `drizzle-kit` y completar extensiones + backfill |
| `apps/merchant/src/server/customers/` (lectura, validacion de entrada, escritura de la proyeccion) | crear |
| `apps/merchant/src/app/api/customers/route.ts` | crear |
| `apps/merchant/src/server/consumer/enrollment.ts` | editar |
| `apps/merchant/src/server/counter/resolve.ts` | editar |
| `apps/merchant/src/server/counter/orders.ts` | editar |
| `apps/merchant/src/server/counter/redemptions.ts` | editar |
| `apps/merchant/src/server/counter/coupon-store.ts` | editar |
| tests unit + `.neon.integration` nuevos junto a cada modulo | crear |
| `docs/specs/0108-contratos-de-api.md` | ya escrito por el orquestador; editar solo si el codigo lo contradice, avisando |

### Disjunta?

**No.** Toca el mostrador y el alta. Hoy no hay otra spec abierta sobre esos archivos (INDEX,
2026-09-28); si aparece una, se serializa.

### Archivos compartidos

Ninguno: el contrato ya esta escrito.

## Definition of Done

- [ ] Migracion `0053` aplicada a una rama efimera y a `ci-integration`: tabla, dos indices y tres
      extensiones presentes (verificado por SQL); backfill correcto sobre un mundo sembrado con
      compras, canjes, cupones y dos programas del mismo negocio.
- [ ] Las cinco escrituras de la tabla de arriba mantienen la proyeccion, y un 409 `already_member`
      no la toca.
- [ ] `GET /api/customers` cumple el contrato `0108-contratos-de-api.md`: pagina, total, busquedas,
      errores.
- [ ] Aislamiento probado con tres negocios (abajo).
- [ ] DTO con exactamente las cuatro claves por fila.
- [ ] Benchmark de aceptacion corrido por el revisor (abajo), con los numeros en el handoff.
- [ ] Gates: `typecheck`, `lint`, `test`, `format:check`, `build` (de a uno, forzados) y las suites
      `.neon.integration` nuevas y las de mostrador/alta tocadas via `tools/neon-test.sh`. No lleva
      `test:e2e` (no toca UI ni CSS).

## Plan de pruebas y verificacion

**Integracion (`.neon.integration`), el mundo:** negocios A, B y C. Cliente X en A y en B; Y solo en
B; Z en A en un programa **viejo** (`inactive`) y en el operativo; W en A solo en un programa viejo.

- [ ] Aislamiento: A lista X, Z y W; **nunca** Y. B lista X e Y. C lista vacio. Buscar el nombre de Y
      desde A → vacio. Buscar el telefono de Y desde A → vacio y **misma forma** que un telefono
      inexistente.
- [ ] Una fila por persona: Z aparece **una** vez en A; su `enrolledAt` es la alta **mas vieja**.
- [ ] Saldo: Z trae el saldo del programa operativo; W trae `balance: null`; un negocio sin programa
      operativo trae `null` en todas.
- [ ] Ultima visita: una compra, un canje de premio y un canje de cupon la mueven cada uno; una compra
      en B no la mueve en A; un cliente sin visitas va al final.
- [ ] Alta: self-service y auto-alta en mostrador crean la fila; un 409 `already_member` la deja
      byte a byte igual.
- [ ] Paginas: con 30 clientes, pagina 1 = 25, pagina 2 = 5, pagina 3 = `[]` con `total: 30` y
      `totalPages: 2`; el orden es estable entre paginas (ninguna fila repetida ni perdida).
- [ ] Busqueda: `maria` encuentra «María»; `MAR` y `már` tambien; `q` de 2 caracteres → 400;
      `q = "___"` **no** devuelve a todos (escape).
- [ ] Autorizacion: staff sin `counter` → 403 `missing_permission`; staff con `counter` → 200; owner
      → 200; sin sesion → 401.
- [ ] DTO: `Object.keys` de cada fila es exactamente `["balance","enrolledAt","lastVisitAt","name"]`.

**Unit:** validacion de entrada (`page`, `q`, `phone`, exclusion mutua) y el escape de `like`.

**Mutaciones** — presupuesto **7**, protocolo de la skill `protocolo-de-verificacion` (etiqueta
`MUTATION`, `shasum` antes, revertir con `diff`). Condicion de corte: las 7 muerden **por el motivo
correcto**; una que no muerde se reporta como oraculo faltante, no se persigue una octava. Clase de
error a cazar: **fuga entre comercios, proyeccion desincronizada y fuga en el DTO**.

| # | Mutacion | Mecanismo (donde va a vivir) | Tiene que morder |
|---|---|---|---|
| M1 | quitar `business_id = $1` de la consulta de pagina | lectura en `server/customers/` | aislamiento |
| M2 | la busqueda por telefono sin el join a la proyeccion del negocio | lectura en `server/customers/` | telefono de Y desde A |
| M3 | no escribir la proyeccion en la compra | `counter/orders.ts:123` | ultima visita por compra |
| M4 | no escribir la proyeccion en el canje de premio | `counter/redemptions.ts:184` | ultima visita por canje |
| M5 | `enrolled_at = excluded.enrolled_at` en vez de `least` | escritura en `server/customers/` | Z con su alta mas vieja |
| M6 | agregar `consumerId` al DTO | lectura en `server/customers/` | claves del DTO |
| M7 | no escapar `%`/`_` en `q` | validacion en `server/customers/` | `q = "___"` |

**Declarado fuera** (sin oraculo automatico): la escritura de la proyeccion en `coupon-store.ts` y en
las dos altas tiene test de integracion, pero no mutacion propia; el rendimiento no tiene test
automatico (un test sobre `EXPLAIN` es fragil) y lo cubre el benchmark.

**Benchmark de aceptacion** (lo corre el **revisor**, en una rama efimera hija de `ci-integration`
con la migracion `0053` real): mismo volumen que el ADR 0100 (3M filas, un negocio de 200.000),
`vacuum analyze`, y `EXPLAIN (ANALYZE)` **del SQL exacto que emite el codigo** (`.toSQL()` o log),
no de una consulta parecida. Umbrales para el negocio de 200.000:

| Consulta | Umbral |
|---|---|
| pagina 1 + conteo | < 80 ms |
| ultima pagina + conteo | < 150 ms |
| nombre de 3+ caracteres (comun, raro, sin resultados) | < 30 ms |
| telefono | < 5 ms |

Si una no llega, es FAIL y vuelve al diseño; no se afloja el umbral.

**Comandos:** Node 24 (`nvm use`); `TURBO_FORCE=1 pnpm run typecheck`, `pnpm run lint`,
`pnpm run test`, `pnpm run format:check`, `TURBO_FORCE=1 pnpm run build` (separados);
`tools/neon-test.sh <archivos>`.

**Verificacion manual:** no hay pantalla. El owner prueba con `curl` autenticado o con la UI de GPT.

## Handoff requerido

Formato de `docs/AGENT-WORKFLOW.md`. Un implementador para toda la spec, un revisor independiente al
final con este presupuesto. Aplicar `0053` a prod es paso del orquestador **despues** del PASS, por
`run_sql_transaction` o `db:migrate`, y **antes** del deploy.

## Abierto

Nada bloquea. Para confirmar con el owner, sin frenar la implementacion: que el canje de **cupon** en
mostrador cuente como visita (decision del orquestador, ver Escrituras).
