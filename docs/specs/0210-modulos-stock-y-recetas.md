---
spec: 0210
fecha: 2026-10-12
estado: implementada
resumen: Registro de modulos (ADR 0138) + modulo Stock (insumos, compras a mano, ajustes, stock estimado) + modulo Recetas (receta por producto del catalogo → costo y margen). Solo API, servidor y base (migracion 0074); pantallas de GPT.
disjunta: si
archivos: packages/db/src/schema/modules/**, packages/db/src/schema/business-module.ts, packages/db/src/schema.ts, packages/db/drizzle.config.ts, packages/db/drizzle/0074_*, apps/merchant/src/modules/**, apps/merchant/src/app/api/modules/**
---

# 0210 — Modulos: registro, Stock y Recetas (capa A)

Nivel **L3** (CLAUDE.md §Niveles): modulos nuevos + migracion. Decisiones: `docs/adr/0138-…`, analisis
`docs/analisis-recetas-stock-2026-10-12.md`. Objetivo del owner: probarlo mañana con un comercio real.

## Problema

Los comercios gastronomicos no saben cuanto les cuesta cada producto ni su margen real, y el costo cambia con cada
compra (inflacion). No hay forma de registrar insumos, compras ni recetas. Y no existe un sistema de modulos: el POS es
una columna del core.

## Alcance

**Entra:**
- Registro de modulos en codigo + tabla `core.business_module` + `GET /api/modules` y `PUT /api/modules/:id`.
- Modulo `stock`: insumos (crear, renombrar, archivar/reactivar), compras cargadas a mano, ajustes por conteo, stock
  estimado = suma de movimientos, ultimo costo por unidad.
- Modulo `recipes` (requiere `stock`): receta por producto del catalogo (lineas insumo + cantidad), costo calculado,
  margen y margen %.
- Test de fronteras de imports (core nunca importa modulos).
- Tests: unitarios de calculo y validacion; integracion Neon por ruta critica, incluido aislamiento entre comercios.

**No entra:** pantallas (GPT), IA (foto/audio), descuento de stock por venta (capa B), avisos de margen, «te alcanza
para», migrar el POS al registro, permisos propios por modulo, conversion de unidades (kg→g la hace la pantalla),
escribir `core.product.unit_cost` (el modulo no escribe tablas del core).

## Diseño

### Modelo de datos (migracion `0074`, aditiva)

`core.business_module`
| columna | tipo | nota |
|---|---|---|
| business_id | uuid FK `core.business` on delete cascade | PK compuesta con module_id |
| module_id | text | `CHECK char_length between 1 and 40`; validado contra el registro en codigo |
| enabled | boolean not null | |
| updated_at | timestamptz not null default now() | |

Esquema Postgres `stock` (archivo `packages/db/src/schema/modules/stock.ts`):

`stock.item` (insumo)
| columna | tipo | nota |
|---|---|---|
| id | uuid pk default random | |
| business_id | uuid FK `core.business` cascade | |
| name | text | `char_length between 1 and 80`; unico `lower(name)` por negocio entre `status='active'` |
| unit | text | `CHECK in ('g','ml','unit')` — unidad base; **inmutable** |
| last_unit_cost | numeric(14,6) null | costo por unidad base de la ultima compra; null = sin compras |
| status | text default 'active' | `CHECK in ('active','archived')`; nunca se borra |
| created_at, updated_at | timestamptz | |

`stock.movement`
| columna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| business_id | uuid FK `core.business` cascade | |
| item_id | uuid FK `stock.item` cascade | |
| kind | text | `CHECK in ('purchase','adjustment')` |
| quantity | numeric(14,3) not null | delta en unidad base; purchase > 0; adjustment ≠ 0 o 0 permitido (conteo igual) |
| total_cost | numeric(12,2) null | solo purchase (not null y ≥ 0 en purchase; null en adjustment) — `CHECK` |
| counted_quantity | numeric(14,3) null | solo adjustment: lo que conto el comercio (≥ 0) |
| note | text null | 1..200 |
| occurred_at | timestamptz not null default now() | |
| created_by_user_id | text null | id del usuario de la sesion (sin FK) |
| created_at | timestamptz default now() | |
| | | indice `(item_id, occurred_at)` |

Esquema Postgres `recipes` (`packages/db/src/schema/modules/recipes.ts`):

`recipes.line`
| columna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| business_id | uuid FK `core.business` cascade | |
| product_id | uuid FK `core.product` on delete cascade | borrar el producto borra su receta |
| item_id | uuid FK `stock.item` on delete restrict | |
| quantity | numeric(14,3) not null | `CHECK > 0` |
| position | integer not null default 0 | orden de la lista |
| | | unico `(product_id, item_id)` |

Invariantes: toda fila lleva `business_id` y toda lectura/escritura filtra por el negocio de la sesion; un
`item_id`/`product_id` de otro negocio es **404** (nunca 403, no se revela existencia).

### Registro (`apps/merchant/src/modules/registry.ts`)

```ts
stock:   { name: "Stock", description: "Insumos, compras y stock estimado", requires: [],
           suggestedFor: [restaurant, cafe, bakery, bar, pizza_restaurant, ice_cream_shop,
                          pharmacy, grocery_store, clothing_store, pet_store] }
recipes: { name: "Recetas", description: "Receta de cada producto, costo y margen", requires: ["stock"],
           suggestedFor: [restaurant, cafe, bakery, bar, pizza_restaurant, ice_cream_shop] }
```
(gcid con prefijo `gcid:`, de `apps/merchant/src/lib/business-categories.ts`).

Helper `requireModule(businessId, moduleId)` → lanza 403 `module_disabled` si no esta encendido.

### Frontera (test `apps/merchant/src/modules/modules-boundary.test.ts`)

Recorre `apps/merchant/src/**/*.{ts,tsx}` y `packages/db/src/**/*.ts`:
- Ningun archivo fuera de `apps/merchant/src/modules/**` y `apps/merchant/src/app/api/modules/**` importa de
  `src/modules/<id>/` (solo puede importar `src/modules/registry` y `src/modules/guard`).
- Ningun archivo de `packages/db/src/schema/` fuera de `schema/modules/` importa de `schema/modules/` (excepto
  `packages/db/src/schema.ts`, el barril que lee drizzle).
- Debe **morder**: se prueba agregando un import prohibido temporal y viendo el rojo (bitacora de mutacion).

### Autorizacion

- `GET /api/modules`: cualquier miembro autenticado del negocio (owner o staff), mismo guard que la sesion del
  merchant que ya exista para lecturas sin permiso especifico; si no hay uno, `requireApiPermission(request,
  "catalog")`. El implementador elige el existente y lo documenta en el docblock de la ruta.
- `PUT /api/modules/:moduleId`: `requireApiOwner`.
- Rutas de stock y recetas: `requireApiPermission(request, "catalog")` + `requireModule`. Recetas exige `recipes`
  encendido (y por la regla de dependencias, `stock` lo esta).

### Formato de numeros

Igual que el catalogo: decimales como **string**. Dinero con 2 decimales (`"12.50"`), cantidades con 3
(`"100.000"`), costo por unidad con 6 (`"1.200000"`). Las entradas aceptan number o string decimal; mas decimales que
la columna → 422 `invalid_number`.

### API — contrato HTTP (lo consume GPT)

Errores: `{ error: string (español), code: string }`. Validacion → 422 con `code` especifico.
Un cuerpo que no es un objeto JSON → 422 `invalid_body` en todas las rutas; un numero que no es decimal (string no numerica,
exponente, otro tipo, mas digitos enteros de los que entran en la columna) → 422 `invalid_number`. *(Precisado al
implementar.)*

**Modulos**

- `GET /api/modules` → `200 { modules: [{ id, name, description, requires: string[], enabled: boolean,
  suggested: boolean }] }` en el orden del registro.
- `PUT /api/modules/:moduleId` body `{ enabled: boolean }` → `200 { module }` (misma forma). Idempotente.
  - 404 `module_not_found` (id fuera del registro).
  - 409 `module_requires` + `missing: string[]` (encender con requerido apagado).
  - 409 `module_required_by` + `dependents: string[]` (apagar con dependiente encendido).
  - 422 `invalid_body`.
  - **Ruteo (medido al implementar con `next dev`):** Next resuelve `app/api/modules/recipes/route.ts` (el `GET /` de
    Recetas) antes que `[moduleId]`, asi que `PUT /api/modules/recipes` daba 405. El contrato no cambia: la ruta base de
    un modulo re-expone el mismo handler (`modules/toggle-route.ts`) y `toggle-route.test.ts` lo exige para todo modulo
    del registro con ruta base.
  - `GET /api/modules` usa `requireApiPermission(request, "catalog")`: no existe un guard de API «cualquier miembro».

**Stock** (base `/api/modules/stock`)

Forma `Item`: `{ id, name, unit: "g"|"ml"|"unit", status: "active"|"archived", onHand: string(3),
lastUnitCost: string(6)|null, updatedAt }`. `onHand` = suma de `movement.quantity` del insumo (puede ser negativo
solo por ajustes historicos; con capa A no baja de lo contado).

- `GET /items?status=active|archived|all` (default `active`) → `200 { items: Item[] }` orden `lower(name)`.
- `POST /items` `{ name, unit }` → `201 { item }`. 409 `item_name_taken`; 422 `invalid_name`, `invalid_unit`.
- `PATCH /items/:itemId` `{ name?, status? }` → `200 { item }`. `unit` no se acepta (422 `unit_immutable` si viene).
  Reactivar con nombre tomado por otro activo → 409 `item_name_taken`. 404 `item_not_found`.
- `POST /items/:itemId/purchases` `{ quantity, totalCost, occurredAt?, note? }` → `201 { movement, item }`.
  `quantity > 0` (422 `invalid_quantity`), `totalCost ≥ 0` (422 `invalid_cost`). Efecto en la misma transaccion:
  inserta movimiento y, si `quantity > 0`, `last_unit_cost = totalCost / quantity` (redondeo a 6). Una compra con
  `occurredAt` anterior a la ultima compra registrada NO pisa `last_unit_cost` (el costo vigente es el de la compra
  mas reciente por `occurred_at`). Insumo archivado → 409 `item_archived`. `occurredAt` futuro (> ahora + 5 min) →
  422 `invalid_date`.
- `POST /items/:itemId/adjustments` `{ countedQuantity, note? }` → `201 { movement, item }`. `countedQuantity ≥ 0`.
  Inserta `quantity = counted − onHand actual` leyendo `onHand` con lock de la fila del insumo (`FOR UPDATE`) para que
  dos ajustes simultaneos no calculen el delta sobre el mismo saldo. Archivado → 409 `item_archived`.
- `GET /items/:itemId/movements?limit=50` (max 200) → `200 { movements: [{ id, kind, quantity, totalCost,
  countedQuantity, note, occurredAt, createdAt }] }` del mas reciente al mas viejo. Un `limit` que no es entero
  positivo vuelve a 50; mayor que 200 se recorta a 200.
- *Precisado al implementar:* `GET /items` con `status` fuera de `active|archived|all` → 422 `invalid_status`; `PATCH`
  con `status` invalido → 422 `invalid_status` y sin `name` ni `status` → 422 `invalid_body`; `note` de mas de 200 o no
  string → 422 `invalid_note` (vacia = null); `countedQuantity < 0` → 422 `invalid_quantity`; una compra cuyo costo por
  unidad no entra en `numeric(14,6)` → 422 `invalid_cost`; un `itemId` que no es uuid → 404 `item_not_found`.

**Recetas** (base `/api/modules/recipes`)

Forma `RecipeSummary`: `{ productId, productName, unitPrice: string|null, cost: string(2)|null,
costComplete: boolean, margin: string(2)|null, marginPct: string(1)|null, lineCount: number }`.
- `cost` = Σ `quantity × last_unit_cost` redondeado a 2; `null` si `lineCount = 0`.
- `costComplete` = `lineCount > 0` y todas las lineas tienen insumo con `last_unit_cost` no null (si falta alguno,
  `cost` suma solo las conocidas y `costComplete=false`).
- `margin` = `unitPrice − cost` (null si alguno es null); `marginPct` = `margin / unitPrice × 100` con 1 decimal
  (null si `unitPrice` es null o 0).

- `GET /` → `200 { recipes: RecipeSummary[] }`: **todos** los productos del catalogo del negocio (con o sin receta),
  orden por nombre del producto.
- `GET /:productId` → `200 { recipe: RecipeSummary & { lines: [{ itemId, itemName, unit, itemStatus, quantity,
  unitCost: string(6)|null, lineCost: string(2)|null }] } }`. 404 `product_not_found`.
- `PUT /:productId` `{ lines: [{ itemId, quantity }] }` → `200 { recipe }` (misma forma que el GET). Reemplaza la
  receta entera en una transaccion; `lines: []` la borra. Max 50 lineas (422 `too_many_lines`); `itemId` repetido →
  422 `duplicate_item`; `quantity > 0` (422 `invalid_quantity`); insumo de otro negocio o inexistente → 404
  `item_not_found`; insumo archivado que **no** estaba ya en la receta → 409 `item_archived` (uno que ya estaba se
  puede conservar). `position` = indice en el arreglo.

### Concurrencia

- Ajustes: lock `FOR UPDATE` de `stock.item` (arriba).
- Compras: el recalculo de `last_unit_cost` bajo el mismo lock del insumo.
- `PUT` de receta: delete+insert en una transaccion con lock `FOR UPDATE` de la fila del producto.
- Apagar un modulo mientras otra request escribe: aceptado (la escritura en vuelo termina; las siguientes dan 403).

### Migracion

`0074_modulos_stock_recetas.sql` generada por drizzle-kit (`schemaFilter` suma `stock`, `recipes`). Aditiva: el codigo
de PROD no la lee. **A PROD solo con OK del owner**, snapshot previo, por MCP de Neon (skill `gotchas-del-repo`).

### Arquitectura de referencia

ADR 0138 (modulos), ADR 0034 (catalogo), ADR 0079 (permisos), ADR 0114 (zonas: pantallas de GPT).

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/business-module.ts` | crear |
| `packages/db/src/schema/modules/stock.ts`, `modules/recipes.ts` | crear |
| `packages/db/src/schema.ts` | editar (reexportar) |
| `packages/db/drizzle.config.ts` | editar (`schemaFilter`) |
| `packages/db/drizzle/0074_*.sql` + `meta/` | crear (drizzle-kit) |
| `apps/merchant/src/modules/registry.ts`, `guard.ts`, `errors.ts` | crear |
| `apps/merchant/src/modules/stock/**`, `modules/recipes/**` | crear (servidor + tests) |
| `apps/merchant/src/modules/modules-boundary.test.ts` | crear |
| `apps/merchant/src/app/api/modules/**` | crear (rutas) |

Disjunta: si (la 0209 de GPT toca solo `backoffice/pos/**`).

## Plan de pruebas

Presupuesto: < 20 min de suites. Clase de error a cazar: **fuga entre comercios, calculo de costo/margen mal,
dependencias de modulos violadas, frontera rota**.

1. Unitarios (vitest): calculo de `cost`/`costComplete`/`margin`/`marginPct` con insumo sin costo, precio null,
   precio 0; validacion de numeros (decimales de mas, negativos, strings); registro (`requires` existe).
2. Frontera: `modules-boundary.test.ts` verde + mutacion que lo pone rojo.
3. Integracion Neon (`tools/neon-test.sh`), un archivo por modulo:
   - modulos: encender recipes con stock apagado → 409; apagar stock con recipes encendido → 409; apagado → 403 en
     una ruta de stock; reencender → datos siguen.
   - stock: compra actualiza `last_unit_cost`; compra con fecha vieja no lo pisa; ajuste deja `onHand = counted`;
     dos ajustes concurrentes dejan `onHand` igual al ultimo contado; nombre duplicado → 409.
   - recetas: PUT + GET con costo y margen correctos; insumo de otro negocio → 404; producto de otro negocio → 404;
     archivado nuevo → 409, archivado ya presente se conserva; borrar producto borra la receta.
   - aislamiento: comercio B no lista ni lee nada de A en ninguna de las 3 familias.
4. `pnpm --filter merchant typecheck` y lint verdes.

## DoD

- Todo lo anterior verde con salida real; migracion aplicada en la base local; contrato HTTP de esta spec igual al
  implementado (si cambia algo, se edita la spec en el mismo commit).
- Revisor PASS. Fila en INDEX. No se marca `implementada` sin el revisor.
