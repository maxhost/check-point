---
spec: 0169
fecha: 2026-10-08
estado: implementada
resumen: Modulo POS (API; la UI la hace GPT). Ordenes abiertas por mesa en `core.pos_order` (precio fijo al agregar, version optimista), editar, anular, imprimir con datos de la API; cerrar sin pase o con pase, que ejecuta la MISMA acreditacion del mostrador con el cupon elegido y enlaza la `core.order`. Modulo por comercio (`pos_enabled`, no se apaga con ordenes abiertas) y permiso `pos`. Una migracion. Implementa el ADR 0130.
disjunta: no
archivos: packages/db/src/schema/pos.ts, packages/db/src/schema/business.ts, packages/db/src/schema/index.ts, packages/db/src/permissions-catalog.ts, packages/db/drizzle/0066_pos_ordenes_de_mesa.sql, apps/merchant/src/server/pos/*, apps/merchant/src/server/counter/grant-coupon.ts, apps/merchant/src/server/counter/grant.ts, apps/merchant/src/server/staff-permissions.ts, apps/merchant/src/server/session-view.ts, apps/merchant/src/app/api/pos/**, apps/merchant/src/app/api/merchant/business/pos/route.ts, apps/merchant/src/app/api/merchant/session/route.ts
---

# 0169 — POS: ordenes de mesa

Nivel **L3** (owner 2026-10-08: migracion a PROD, dinero y permisos; feature grande). Implementa el ADR 0130.
**Zonas (ADR 0114): esta spec es la API.** Las pantallas las hace GPT contra el contrato HTTP de §Contrato.

## Decisiones del owner (2026-10-08, no volver a preguntar)

- Flujo: abre POS → elige local (si tiene mas de uno) → nombre de mesa → catalogo como en el mostrador → guarda →
  la orden queda **abierta** en el historial → al pagar la abre → «escanear pase» → cupon si el cliente eligio uno →
  resultado como en el mostrador → cobra → cierra venta → se acreditan cupones y puntos como en el mostrador.
- Cliente sin pase: **se puede cerrar igual**.
- Se puede **editar** (agregar/quitar productos) y **anular** una orden abierta. Boton **«imprimir»**.
- Las ordenes **no se cierran solas**: las cierra el comercio.
- Owner + staff con permiso nuevo **`pos`**.
- «Cobrar» = cerrar venta. No se registra medio de pago. A lo sumo una **calculadora de cambio** en pantalla
  («la orden es 11.58, me pagaron con 20, cambio = xx»), que no se guarda.
- Cupon: **sigue el diseño actual** del mostrador (descuento, unidades sobre el neto, extras).
- **Seccion nueva**; el mostrador sigue igual. El POS es un **modulo que el owner activa o no** (un gym no lo
  necesita); desactivado, no se puede dar el permiso al staff. **En todos los planes.**
- Nombre de mesa: input libre, sin validar duplicados (MVP).
- Imprimir: impresion del navegador; abierta = precuenta (comercio, local, mesa, productos, total); cerrada = eso +
  descuento del cupon y total final. No es comprobante fiscal.
- Precio **fijo** al agregar el producto a la orden.
- **No se puede desactivar el POS con ordenes abiertas**: modal de error que pide cerrarlas.
- Historial del POS: «Abiertas» (de cualquier fecha) y «Cerradas hoy». Las cerradas con pase aparecen tambien en
  «Movimientos de hoy» del mostrador.
- Claude hace la API; GPT la parte visual.

## Problema

Hoy la unica forma de vender con productos es el mostrador, que exige escanear el pase **antes** de cargar la venta
y acredita en el mismo acto. Un local con mesas atiende primero y cobra despues: necesita una orden abierta sin
cliente, que se edita mientras dura la atencion y que recien al cobrar se asocia (o no) a un pase.

## Alcance

**Entra:**
- Migracion `0066`: `core.pos_order`, `core.pos_order_item`, `core.business.pos_enabled`, `pos` en el `CHECK` de
  permisos de `core.business_membership`.
- Encender/apagar el modulo (owner), con el bloqueo por ordenes abiertas.
- Permiso `pos` en el catalogo; el writer de permisos del staff lo rechaza con el modulo apagado.
- `GET /api/merchant/session` expone `business.posEnabled`.
- Rutas `/api/pos/*`: catalogo, crear, listar, leer, editar, anular, escanear, estado del cupon, quitar cupon,
  cerrar (sin pase / con pase).
- Refactor de `grant-coupon.ts`/`grant.ts` para que la acreditacion corra dentro de la transaccion del cierre.

**No entra:**
- Pantallas, estilos, impresion (layout) y e2e: GPT.
- Gestion de mesas (catalogo de mesas, estados, plano). Medio de pago, propina, division de cuenta, cierre de caja.
- Venta rapida (importe tipeado sin productos) en el POS: la orden siempre tiene lineas.
- Estadisticas o reportes de las ventas cerradas sin pase.
- Cambios al mostrador (salvo el refactor sin cambio de comportamiento del punto 3 del ADR).
- Canje de premios del programa desde el POS (owner: «no, el canje se hace desde mostrador… son dos cosas separadas»).

## Diseño

### Modelo de datos (`packages/db/src/schema/pos.ts`, migracion `0066_pos_ordenes_de_mesa.sql`)

`core.pos_order`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid pk | |
| `business_id` | uuid not null → `core.business` on delete cascade | |
| `location_id` | uuid null → `core.location` on delete set null | mismo criterio que `core.order` |
| `table_label` | text not null | `trim`, 1..60 caracteres |
| `status` | text not null default `'open'` | `CHECK in ('open','closed','voided')` |
| `version` | integer not null default 1 | `CHECK >= 1`; sube en cada edicion |
| `created_by_user_id` | text not null → `merchant_auth.user` | |
| `closed_by_user_id` | text null → `merchant_auth.user` | quien cerro o anulo |
| `closed_at` | timestamptz null | cierre o anulacion |
| `order_id` | uuid null → `core.order`, **unique** | solo cerrada con pase |
| `close_request_id` | uuid null | idempotencia del cierre |
| `created_at`, `updated_at` | timestamptz not null default now() | |

`CHECK`s: `status = 'open'` ⇔ `closed_at is null and closed_by_user_id is null and close_request_id is null`;
`order_id is not null` ⇒ `status = 'closed'`. Unico `(business_id, close_request_id)`. Indice
`(business_id, status, created_at)`.

`core.pos_order_item`: `id`, `pos_order_id` (cascade), `product_id` (null, on delete set null), `name_snapshot`
text not null, `unit_price_snapshot numeric(12,2) not null CHECK >= 0`, `quantity integer CHECK > 0`,
`position integer not null` (orden de carga). Indice `(pos_order_id)`.

`core.business.pos_enabled boolean not null default false`.

`business_membership_permissions_check` se recrea con la lista nueva (sale de `PERMISSIONS`, como hoy). `PERMISSIONS`
queda `brand, catalog, counter, locations, loyalty, marketing, pos, staff`.

Total de una orden = Σ `round(unit_price_snapshot × quantity, 2)` en centavos (mismo calculo que `buildDetailed`).
No se guarda: se calcula al leer.

### Autorizacion (`apps/merchant/src/server/pos/auth.ts`)

`requirePosOperator(request)`: la misma escalera que `requireOperator` del mostrador (sesion → negocio → permiso →
gate de email del owner → eje `status`), con `hasScope(role, permissions, "pos")` en vez de `counter`, y **despues
del permiso**: `business.posEnabled !== true` → 403 `pos_disabled`. Sin `pos`: 403 `missing_permission`. Cada ruta
filtra por `business_id` del operador: una orden de otro negocio es **404 `unknown_pos_order`** (nunca 403).

### Reglas

- **Crear** (`POST /api/pos/orders`): bajo `SELECT … FROM core.business WHERE id = $1 FOR SHARE` relee
  `pos_enabled` (si se apago entre medio → 403 `pos_disabled`). `locationId` opcional, validado con
  `assertLocationInBusiness` (local archivado o ajeno → el error de hoy). `items` puede venir vacio (guardar la mesa
  antes de pedir). Cada linea nueva hace snapshot del catalogo **filtrado por `availableAtCounter(locationId)`**;
  producto sin precio exige `unitPrice` tipeado (mismas reglas y codigos que `buildDetailed`: `unknown_product`,
  `invalid_amount`, `invalid_input`). Maximo 200 lineas → 422 `too_many_items`.
- **Editar** (`PUT /api/pos/orders/:id`): body con `version` y la lista COMPLETA de lineas. Una linea con `lineId`
  existente de esa orden **conserva su snapshot** (nombre y precio) y solo cambia `quantity`; un `lineId` que no es
  de la orden → 422 `unknown_line`; una linea sin `lineId` es nueva y hace snapshot. Las lineas ausentes se borran.
  `tableLabel` y `locationId` editables (cambiar el local NO re-snapshotea lineas existentes). `UPDATE … WHERE
  status = 'open' AND version = $v` → 0 filas: si la orden no esta abierta 409 `pos_order_not_open`, si no 409
  `version_conflict` con la orden actual en el cuerpo. Producto borrado del catalogo con la orden abierta: su linea
  sigue (snapshot, `product_id` null) y se puede cerrar.
- **Anular** (`POST /api/pos/orders/:id/void`): `open → voided` con `closed_at`/`closed_by_user_id`. Anular una
  anulada → 200 idempotente; una cerrada → 409 `pos_order_not_open`.
- **Cerrar** (`POST /api/pos/orders/:id/close`), body `{ clientRequestId, version, membershipId?, coupon? }`:
  - Una transaccion. Primero `SELECT … FROM core.pos_order WHERE id AND business_id FOR UPDATE`.
  - Si ya esta `closed` con `close_request_id = clientRequestId` → devuelve el resultado guardado (reintento),
    leyendo la `core.order` enlazada con `readOrderByRequest`. Cerrada con otro id o anulada → 409
    `pos_order_not_open`. `version` distinta → 409 `version_conflict`.
  - Sin lineas → 422 `empty_cart`.
  - **Sin `membershipId`**: `status='closed'`, `closed_at`, `closed_by_user_id`, `close_request_id`. Respuesta con
    `accrual: null`. Si viene `coupon` sin `membershipId` → 422 `invalid_input`.
  - **Con `membershipId`**: exactamente lo que hace `grantAccrual` en `mode='detailed'` (membresia del negocio,
    programa acreditable, `programAccrual`), con `items` = las lineas de la orden (snapshots) y `locationId` = el de
    la orden, `note` = `"Mesa: <tableLabel>"`, `clientRequestId` = el del cierre. Con `coupon`, la misma logica de
    `grantWithCoupon` (los seis pasos, mismos codigos de error) **corriendo en la transaccion del cierre**. Despues,
    en la misma transaccion, `pos_order` pasa a `closed` con `order_id`. Un error de la acreditacion (cupon
    invalido, sin programa) revierte todo: la orden sigue `open` y el cliente ve el error del mostrador.
  - `afterGrant` (push, venta cruzada) corre **despues del commit**, solo si el cierre creo la orden.
- **Apagar el modulo** (`PUT /api/merchant/business/pos`, owner, `requireApiOwner`): bajo `FOR UPDATE` de la fila
  de `core.business`, si hay alguna `pos_order` `open` del negocio → 409 `pos_has_open_orders` con `openCount`. Si
  no, `pos_enabled = false`. Encender no tiene condicion. Idempotente.
- **Permiso**: `setStaffPermissions` (y el alta de staff, si recibe permisos) rechaza `pos` con el modulo apagado →
  422 `pos_disabled`. Apagar el modulo **no** borra el permiso de quien ya lo tiene: queda sin efecto (lo corta
  `requirePosOperator`). Con el modulo apagado, la UI no muestra el toggle `pos`.

### Contrato HTTP (lo consume GPT)

Todas las rutas `/api/pos/*` pasan por `requirePosOperator`; errores `{ error, code }` como el mostrador. Dinero como
string `"12.50"`.

`PosOrder` (la forma que devuelven crear/leer/editar/anular/cerrar):

```ts
type PosOrder = {
  id: string;
  status: "open" | "closed" | "voided";
  version: number;
  tableLabel: string;
  location: { id: string; name: string } | null;
  business: { name: string; currencyCode: string };   // para imprimir
  items: { lineId: string; productId: string | null; name: string;
           unitPrice: string; quantity: number; lineTotal: string }[];
  total: string;                       // suma de lineas (bruto)
  createdAt: string; createdBy: string; // nombre del operador
  closedAt: string | null; closedBy: string | null;
  sale: null | {                        // solo cerrada CON pase
    consumer: string;                   // nombre del cliente
    total: string;                      // neto cobrado
    grossTotal: string;
    unitsGranted: number; balanceAfter: number; kind: "points" | "stamps";
    coupon: { label: string; discountAmount: string; extraUnits: number | null } | null;
  };
};
```

| Metodo y ruta | Body / query | Respuesta | Errores propios |
|---|---|---|---|
| `GET /api/pos/catalog?locationId=` | | `{ products, categories }` (= `businessCatalog`) | |
| `GET /api/pos/orders` | | `{ open: PosOrderSummary[], closedToday: PosOrderSummary[] }`; `closedToday` = cerradas y anuladas en el dia local del negocio; abiertas de cualquier fecha, mas viejas primero | |
| `POST /api/pos/orders` | `{ tableLabel, locationId?, items: {productId, quantity, unitPrice?}[] }` | `201 PosOrder` | `invalid_table_label`, `too_many_items` |
| `GET /api/pos/orders/:id` | | `PosOrder` | `unknown_pos_order` |
| `PUT /api/pos/orders/:id` | `{ version, tableLabel, locationId?, items: {lineId?, productId, quantity, unitPrice?}[] }` | `PosOrder` | `version_conflict` (409, con `order: PosOrder`), `pos_order_not_open`, `unknown_line` |
| `POST /api/pos/orders/:id/void` | `{}` | `PosOrder` | `pos_order_not_open` |
| `POST /api/pos/resolve` | `{ qrToken, locationId? }` | igual que `POST /api/counter/resolve` | los del mostrador |
| `GET /api/pos/coupon-state?membershipId=` | | igual que el mostrador | |
| `POST /api/pos/coupon-remove` | igual que el mostrador | igual | |
| `POST /api/pos/orders/:id/close` | `{ clientRequestId, version, membershipId?, coupon?: {couponId, productId?} }` | `PosOrder` (con `sale` si hubo pase) | `empty_cart`, `version_conflict`, `pos_order_not_open` + los de `grant` |
| `PUT /api/merchant/business/pos` (owner) | `{ enabled: boolean }` | `{ enabled }` | `pos_has_open_orders` (409, `{ openCount }`) |

`PosOrderSummary = { id, status, tableLabel, location, total, itemCount, createdAt, closedAt, saleTotal }`.

`GET /api/merchant/session` suma `business.posEnabled: boolean`.

La calculadora de cambio y la impresion son de la UI y no tocan la API.

### Arquitectura de referencia

ADR 0130 (esta decision), ADR 0079 (permisos por objeto), ADR 0073 §1 (orden de los guards), ADR 0114 (zonas),
specs 0030/0148/0153 (acreditacion y cupon del mostrador), spec 0086 (permisos del staff).

## Archivos

| Archivo | Accion |
|---|---|
| `packages/db/src/schema/pos.ts` | crear |
| `packages/db/src/schema/business.ts` | editar (`posEnabled`) |
| `packages/db/src/schema/index.ts` | editar (export) |
| `packages/db/src/permissions-catalog.ts` | editar (`pos`; comentarios «siete» → «ocho») |
| `packages/db/drizzle/0066_pos_ordenes_de_mesa.sql` + `meta/` | crear (drizzle-kit) |
| `apps/merchant/src/server/pos/{auth,orders,lines,close,list,module}.ts` + tests | crear |
| `apps/merchant/src/server/counter/grant-coupon.ts`, `grant.ts` | editar (aceptar transaccion externa; sin cambio de comportamiento) |
| `apps/merchant/src/server/staff-permissions.ts` | editar (`pos` requiere modulo) |
| `apps/merchant/src/server/session-view.ts`, `app/api/merchant/session/route.ts` | editar (`posEnabled`) |
| `apps/merchant/src/app/api/pos/**/route.ts` | crear |
| `apps/merchant/src/app/api/merchant/business/pos/route.ts` | crear |

### Disjunta?

**No** con nada que toque el mostrador (`server/counter/*`) o los permisos del staff. Hoy no hay otra spec abierta
sobre esos archivos (las `cerradas` 0149/0152/0154 tocan solo la UI del mostrador, `backoffice/counter/**`). GPT no empieza la UI hasta que el contrato este implementado en `dev`.

## Definition of Done

- [ ] Migracion `0066` aplicada en la base local y en una rama efimera de Neon; `drizzle-kit` sin diff pendiente.
- [ ] Las rutas de §Contrato existen y devuelven las formas declaradas (tests de integracion Neon).
- [ ] Cerrar con pase produce la MISMA `core.order`, `order_item`, saldo, `coupon_redemption` y cola de push que el
      mostrador con el mismo carrito y cupon.
- [ ] Las suites del mostrador (`counter*.neon.integration.test.ts`, `server/counter/*.test.ts`) siguen verdes sin
      editarlas.
- [ ] `pnpm verify` en verde con Node 24 (tabla transcripta).

## Plan de pruebas y verificacion

Integracion Neon (`tools/neon-test.sh`), archivo nuevo `apps/merchant/src/server/pos/*.neon.integration.test.ts`:

1. **Precio fijo:** crear orden con P a 10.00 → cambiar P a 15.00 en el catalogo → editar la orden subiendo la
   cantidad de esa linea → la linea sigue a 10.00; una linea NUEVA de P entra a 15.00.
2. **Version:** dos `PUT` con la misma `version` → el segundo 409 `version_conflict` con la orden actual.
3. **Cerrar sin pase:** `closed`, `order_id` null, ningun cambio de saldo ni `core.order`.
4. **Cerrar con pase sin cupon:** misma `units_granted`/`balance_after`/`order_item` que `grantAccrual` detallado con
   el mismo carrito; `pos_order.order_id` = esa orden; nota `Mesa: …`.
5. **Cerrar con cupon** (descuento por monto y `extra_*`): neto, unidades sobre el neto y `coupon_redemption.order_id`
   como en el mostrador; la eleccion del cliente queda consumida.
6. **Cupon invalido al cerrar:** 409 con el codigo del veredicto; la `pos_order` sigue `open`, sin saldo movido.
7. **Reintento** del cierre con el mismo `clientRequestId` → mismo resultado, un solo grant. **Concurrencia:** dos
   cierres en paralelo con ids distintos → uno cierra, el otro 409 `pos_order_not_open`; saldo subido una vez.
8. **Aislamiento:** leer/editar/cerrar una orden de otro negocio → 404 `unknown_pos_order`; cerrar con una
   membresia de otro negocio → 403 `foreign_membership`.
9. **Permisos:** staff sin `pos` → 403 `missing_permission`; modulo apagado → 403 `pos_disabled` (owner y staff);
   dar `pos` con el modulo apagado → 422 `pos_disabled`.
10. **Apagar con abiertas:** 409 `pos_has_open_orders` con `openCount`; tras anular/cerrar todas, apaga.
11. **Producto borrado** con la orden abierta → la orden se cierra con pase y el `order_item` queda con
    `product_id` null.

Unit: total por centavos de las lineas; normalizacion de `tableLabel`; merge de lineas en el `PUT`.

Mutaciones (revisor, presupuesto 4, ver skill `protocolo-de-verificacion`): (M1) el `PUT` re-snapshotea lineas
existentes → cae 1; (M2) sacar el `FOR UPDATE` de la `pos_order` → cae 7; (M3) quitar el chequeo de `posEnabled` en
`requirePosOperator` → cae 9; (M4) apagar sin contar abiertas → cae 10.

Comandos: `tools/neon-test.sh apps/merchant/src/server/pos/`, las suites del mostrador, `pnpm verify`.

Manual (owner, despues de la UI de GPT): flujo completo en `dev-business.checkpass.club/backoffice/pos` con un pase
de prueba y un cupon.

## Handoff requerido

`implementador` y `revisor` con el formato de `docs/AGENT-WORKFLOW.md`. PASS del revisor antes de `implementada`.
Despues: encargo a GPT con §Contrato.

## Abierto

Nada. El canje de premios queda en el mostrador (owner 2026-10-08). La idea del owner de que el cliente active un
canje desde `my.checkpass.club` como cupon es otra feature: fila en `docs/PARQUEADO.md`.

## Implementacion (2026-10-08)

`79e3efc` (implementador) + `53fec62` (`/delete-user` borra las mesas cobradas con pase, owner) + el test
`pos/pos-close-reuse.neon.integration.test.ts` (oraculos R1/R2 del revisor). **PASS del revisor**: POS 35/35, mostrador
131/131 sin editar, `pnpm verify` ok salvo e2e (puerto 3200 ocupado por el ambiente local). Mutaciones: M1–M4 del
implementador rojas; del revisor R1 roja, R2 roja solo con su oraculo (ahora permanente; re-medida: «expected 503 to be
409»), R3 sobrevive (`no_program` por cambio de programa en `accrualContext`, codigo movido tal cual, deuda previa).

Desvios: escalera comun `server/operator-guard.ts` (el mostrador delega con el mismo orden y mensajes); `posEnabled` se
chequea al final de la escalera (solo cambia el orden de errores, todos 403); codigo nuevo 409 `request_reused` (clave de
cierre ya usada por otra venta); `PUT` sin `locationId` conserva el local, `null`/`""` lo quita; `version_conflict` lleva
`order` tambien en el cierre; `itemCount` = suma de cantidades.

Hallazgo a decidir (owner): cerrar con pase una mesa cuyo local se archivo despues de abrirla acredita en ese local
archivado; el mostrador daria `unknown_location`.

