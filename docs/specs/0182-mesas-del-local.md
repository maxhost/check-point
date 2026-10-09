---
spec: 0182
fecha: 2026-10-08
estado: implementada
resumen: Mesas por local (L2, API + DB; UI de GPT; implementa ADR 0131). Migracion 0067 con `core.dining_table` y `pos_order.dining_table_id` (indice unico de mesa abierta). CRUD bajo `/api/locations/:id/tables` con permiso `locations` (archivar, nunca borrar); `GET /api/pos/tables` con ocupacion; crear/editar orden POS acepta `tableId` (nombre fotografiado, 409 `table_occupied`).
disjunta: no (toca `server/pos/orders.ts`, `read.ts`, `list.ts` de la 0169, ya implementada)
archivos: packages/db/src/schema/dining-table.ts, packages/db/src/schema/pos.ts, packages/db/src/schema/index.ts, packages/db/drizzle/0067_mesas_del_local.sql, packages/db/src/seed-local.ts, apps/merchant/src/server/tables/*, apps/merchant/src/app/api/locations/[locationId]/tables/**, apps/merchant/src/app/api/pos/tables/route.ts, apps/merchant/src/server/pos/{orders,read,list,lines}.ts
---

# 0182 — Mesas del local

> **Nivel L2** (ADR 0129): funcionalidad nueva con migracion a PROD (piso L2). Spec chica aunque lleva migracion:
> el template chico lo excluye, pero el ADR 0129 (posterior) asigna este template a L2.

## Problema

- `core.pos_order.table_label` es texto libre (`packages/db/src/schema/pos.ts:41`); no hay entidad mesa, asi que no
  se puede saber que mesa esta ocupada ni dejar el modelo listo para reservas (ADR 0131 §Contexto).
- Spec 0169 §No entra: «Gestion de mesas (catalogo de mesas, estados, plano)».

## Alcance

**Entra:** tabla `core.dining_table` y su CRUD (sin borrar); `GET /api/pos/tables` con ocupacion; `tableId` en
crear/editar orden del POS; `tableId` en `PosOrder` y en el listado; 4 mesas en el seed local del Café.

**No entra:** reservas (ADR 0131 §Reservas, solo pensado); zona, minimo de comensales, «reservable»; plano visual;
juntar mesas en una orden; mover una orden cerrada; tope de mesas por plan; la UI (GPT).

## Diseño

### Modelo (`migracion 0067_mesas_del_local.sql`)

`core.dining_table`: `id` uuid pk · `business_id` → business cascade · `location_id` → location cascade · `name` text
not null `CHECK char_length between 1 and 60` · `seats` integer null `CHECK seats is null or seats between 1 and 99` ·
`sort_order` integer not null default 0 · `status` text not null default `'active'` `CHECK in ('active','archived')` ·
`created_at`, `updated_at`. Unico parcial `(location_id, lower(name)) WHERE status = 'active'`. Indice
`(location_id, status, sort_order)`.

`core.pos_order.dining_table_id` uuid null → `core.dining_table` on delete set null. Unico parcial
`core_pos_order_open_table_unique (dining_table_id) WHERE status = 'open'`.

### DTO

`DiningTable = { id, locationId, name, seats: number | null, sortOrder, status: "active" | "archived" }`.
Orden de listado: `sort_order`, despues `name`.

### Gestion — permiso `locations` (`requireLocationsOwner`, mismos 401/403 de los locales)

Todo filtra por negocio: un local ajeno o inexistente → 404 `unknown_location`; una mesa ajena, de otro local o
inexistente → 404 `unknown_table`. Un local archivado se puede seguir administrando.

| Ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/locations/:locationId/tables` | — | `200 { tables: DiningTable[] }` (activas y archivadas) |
| `POST /api/locations/:locationId/tables` | `{ name, seats? }` | `201 { table }`; `sort_order` = max del local + 1 |
| `PATCH /api/locations/:locationId/tables/:tableId` | `{ name?, seats?, sortOrder? }` (`seats: null` la vacia) | `200 { table }` |
| `POST /api/locations/:locationId/tables/:tableId/status` | `{ status: "active" \| "archived" }` | `200 { table }` (mismo estado = 200 sin cambio) |

Validacion: `name` con `trim`, 1..60 → si no 422 `invalid_input`; `seats` entero 1..99 o null → si no 422
`invalid_input`; `sortOrder` entero 0..9999 → si no 422 `invalid_input`; `PATCH` sin ningun campo → 422
`invalid_input`; JSON invalido → 400 `invalid_body`. Nombre repetido entre las activas del local (crear, renombrar o
reactivar) → 409 `table_name_taken` (tambien si la carrera la resuelve el unico, `23505`). Mas de 200 mesas en un
local → 422 `too_many_tables`. Archivar con una orden del POS abierta en esa mesa → 409 `table_has_open_order`
(bajo `FOR UPDATE` de la mesa, que tambien toma la apertura de orden: ver abajo).

### POS — permiso `pos` (`requirePosOperator`)

`GET /api/pos/tables?locationId=<uuid>` → `200 { tables: [{ id, name, seats, openOrderId: string | null }] }`: solo
mesas activas del local. `locationId` ausente o no uuid → 422 `invalid_input`; local ajeno o archivado → 422
`unknown_location` (el error de `assertLocationInBusiness`).

`POST /api/pos/orders` y `PUT /api/pos/orders/:id` aceptan `tableId`:

- **Crear**: `tableId` ausente/null → como hoy (`tableLabel` obligatorio). Con `tableId`: la mesa tiene que ser
  activa y del negocio (si no → 422 `unknown_table`); `locationId` ausente → el de la mesa; presente y distinto →
  422 `table_location_mismatch`; el local de la mesa pasa por `assertLocationInBusiness`. `table_label` = nombre de
  la mesa (el `tableLabel` del cuerpo se ignora).
- **Editar**: `tableId` ausente conserva la mesa actual; `null` la quita (vuelve a texto libre, `tableLabel`
  obligatorio); un uuid la cambia. Con mesa resultante, `table_label` se refresca con su nombre actual y se aplica la
  misma regla de local (`locationId` ausente con mesa nueva → el de la mesa).
- **Ocupada**: la transaccion toma `SELECT … FROM core.dining_table WHERE id FOR SHARE` antes del `INSERT`/`UPDATE`
  y relee `status = 'active'` (archivada entre medio → 422 `unknown_table`); otra orden abierta en esa mesa → 409
  `table_occupied` (chequeo previo + `23505` del indice como red).
- Cerrar o anular libera la mesa (el indice es parcial sobre `open`).

`PosOrder` y cada fila de `GET /api/pos/orders` ganan `tableId: string | null`. `tableLabel` sigue igual.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/dining-table.ts`, `schema/index.ts`, `schema/pos.ts` | crear / editar |
| `packages/db/drizzle/0067_mesas_del_local.sql` + `meta/` | crear (drizzle-kit) |
| `packages/db/src/seed-local.ts` | editar (4 mesas en el Café) |
| `apps/merchant/src/server/tables/*` | crear |
| `apps/merchant/src/app/api/locations/[locationId]/tables/**` | crear |
| `apps/merchant/src/app/api/pos/tables/route.ts` | crear |
| `apps/merchant/src/server/pos/{orders,read,list}.ts` | editar |
| `apps/merchant/src/server/tables/tables.neon.integration.test.ts` | crear |

## Definition of Done

- [x] `pnpm --filter @mi-pasaporte/db typecheck` y `pnpm --filter @mi-pasaporte/merchant typecheck` en 0.
- [x] Lint de los paquetes tocados en 0.
- [x] La migracion 0067 aplica en la base local (`pnpm db:local:up`: 68 migraciones) y `\d core.dining_table` muestra
      los checks y el unico parcial.
- [x] `tools/neon-test.sh apps/merchant/src/server/tables/tables.neon.integration.test.ts` verde: CRUD + aislamiento
      (404 ajeno), nombre repetido 409, archivar con orden abierta 409, orden con mesa (label fotografiado, local
      derivado), `table_occupied` en crear y en mover, liberar al anular, `GET /api/pos/tables` con `openOrderId`.
- [x] Las suites POS existentes (`pos-orders`, `pos-close`) siguen verdes. Corrida conjunta: **3 archivos, 22/22**
      (`tables` 9, `pos-orders` 7, `pos-close` 6). `pos-orders` gano `tableId` en la lista exacta de claves de
      `PosOrder`: es el cambio de contrato de esta spec, no un ajuste para pasar.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | Sacar el filtro `business_id` al leer la mesa en crear orden | caso «mesa de otro negocio → 422 `unknown_table`» |
| 2 | Sacar el chequeo de orden abierta al archivar | caso «archivar con orden abierta → 409» |

**Medido 2026-10-08:**
- **M1** (`server/tables/pos.ts`, `resolveTable`, shasum limpio `827f5960…`): **ROJO 1/9** «ORACULO DE M1» →
  `AssertionError: expected 'unknown_location' to be 'unknown_table'` (la mesa ajena se resolvio y la orden recien
  cayo en el local: el motivo correcto). Revertida con `cp`, `diff` vacio, shasum igual.
- **M2** (`server/tables/manage.ts`, `setTableStatus`, shasum limpio `b08d4e5f…`): **ROJO 1/9** «POS: orden con
  mesa…» → `AssertionError: expected 200 to be 409`. Revertida, `diff` vacio, shasum igual.
- `grep -rn "MUTATION M" apps/merchant/src tools` → vacio.

## Declarado AFUERA (sin oraculo, a proposito)

- La carrera real de dos `POST` simultaneos en la misma mesa: la cubre el indice unico de la base, no un test de
  concurrencia.
- Renombrar una mesa no refresca las ordenes abiertas hasta su proximo `PUT` (ADR 0131 §Consecuencias).

## Abierto

Nada.

## Cierre

L2 (sin revisor, ADR 0129). Falta, fuera de esta spec: la UI de GPT (contrato arriba) y la migracion 0067 a PROD con
OK del owner (va con el proximo pase a live, `db:migrate` despues del snapshot).
