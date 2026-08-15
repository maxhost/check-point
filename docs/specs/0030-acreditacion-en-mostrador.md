---
spec: 0030
fecha: 2026-08-14
estado: cerrada
resumen: Consola web móvil de mostrador (URL del backoffice, cámara del teléfono) — escanea el QR del consumidor, resuelve/auto-enrola su membresía y acredita puntos/sellos por venta detallada (carrito del catálogo) o venta rápida (importe + nota), atómico y auditado como orden. Solo acreditación; el canje es otra feature.
disjunta: no
archivos: `src/server/counter/*`, `src/server/schema/order.ts`, `src/server/schema/consumer.ts` (saldo), `app/api/counter/*`, `app/backoffice/counter/*`, migración aditiva
---

# 0030 — Acreditación en mostrador

> Tercera rebanada del camino A (ADR 0031). Depende de la spec **0028** (QR personal +
> membresía, implementada), del **catálogo de productos** (**spec 0034, implementada**) y de
> la **mecánica de acumulación + premios** (**spec 0036, implementada**). El cálculo del
> otorgamiento ya está fijado en `computeAccrual` (0036); 0030 lo **ejecuta y persiste**.

## Problema

El enrolamiento (0028) crea la membresía pero **nadie puede todavía otorgarle valor**: la
membresía no tiene saldo y no existe ninguna superficie para acreditar consumo. Sin esta
pieza, el loop de fidelización no cierra — el consumidor se registra, obtiene su pase de
Wallet (0029) y nunca recibe un punto ni un sello.

El comportamiento que el owner necesita, punta a punta:

1. El cliente muestra su QR (pase de Wallet o landing de 0028/0029).
2. El owner o el staff abre **una URL del backoffice** (guardable como favorito en el
   teléfono).
3. **Escanea el QR con la cámara del teléfono** → se resuelve el perfil del consumidor y su
   membresía en el programa **de este negocio**; si no es miembro, se **auto-enrola** en el acto.
4. Un **toggle hipersimple** alterna entre **venta detallada** (arma un carrito con productos
   del catálogo → total) y **venta rápida** (teclea el importe directo + nota opcional). Ambas
   validan las reglas del programa vía `computeAccrual`.
5. Confirma.
6. El consumidor recibe el aviso de lo que sumó (puntos/sellos) — la **entrega** es la spec
   0031; 0030 **registra y emite** el evento.
7. La UI se **reinicia** para escanear el próximo QR.

## Alcance

**Entra:**

- **Saldo por membresía**: `points_balance` y `stamps_count` en `consumer.program_membership`
  (una modalidad por programa usa uno de los dos). **Es el núcleo nuevo.**
- **Orden como registro auditable** en `core` (`order` + `order_item`), con **snapshot** de los
  productos (nombre + precio unitario al momento), total, moneda, modo (`detailed`/`quick`),
  nota opcional, unidades otorgadas, saldo resultante, actor (staff/owner) y local.
- **Consola web móvil** (`/backoffice/counter`) bajo auth de `merchant_auth`: escaneo por
  cámara (`BarcodeDetector` nativo con fallback JS), toggle detallada/rápida, carrito,
  confirmación y **reinicio automático** tras confirmar.
- **Resolución del QR** desambiguada por negocio + **auto-enrolamiento por escaneo** (ADR 0033).
- **Otorgamiento atómico, idempotente y auditado**: `computeAccrual(total)` → incremento de saldo
  + inserción de la orden en **una sola transacción**; idempotencia por `client_request_id`.

**No entra (explícito):**

- **El canje.** Descontar puntos / resetear la tarjeta de sellos es **otra feature, otra URL,
  otra mecánica** (spec futura). 0030 **solo acredita**.
- **Editar una venta rápida.** Una venta rápida es total + nota, **inmutable**. Permitir
  editarla incentiva no armar el carrito y ensucia la estadística de producto: si se quiere
  desglose por producto, se arma la venta detallada en el momento.
- El catálogo en sí (0034), la mecánica/premios (0036), el pase de Wallet (0029).
- La **entrega** de la notificación al consumidor y la landing en vivo (**spec 0031**; 0030
  registra la orden y deja el evento listo para que 0031 lo consuma).
- Programas `tiers`/`cashback`: sin mecánica de acumulación (0036), **fuera de alcance**.

## Diseño

### Especificación técnica

**Arquitectura.** Dominio nuevo `apps/merchant/src/server/counter/*` (barrel `counter.ts` +
`core.ts` tipos/errores, `resolve.ts`, `grant.ts`, `orders.ts`), cada archivo < 300 líneas
(hook `file-size`). Reusa `computeAccrual`/`AccrualInput` de `loyalty-program/accrual.ts` (0036),
el snapshot de productos del catálogo (0034) y el patrón atómico CTE de 0024/0028.

**Modelo de datos (migración aditiva, próximo número correlativo).**

- `consumer.program_membership` — **agregar** `points_balance integer NOT NULL DEFAULT 0` y
  `stamps_count integer NOT NULL DEFAULT 0`, ambos con check `>= 0`. Es el saldo vivo por
  membresía. (El reset/decremento lo hará la feature de canje, no ésta.)
- `core.order` — **nueva**. `id uuid pk`; `business_id → core.business`;
  `location_id → core.location` (nullable); `program_id → core.loyalty_program`;
  `membership_id → consumer.program_membership` (FK cross-schema, misma dirección que las de
  0028); `consumer_id → consumer.consumer_account`; `mode text check in ('detailed','quick')`;
  `total numeric(12,2) NOT NULL check >= 0`; `currency_code text NOT NULL` (snapshot del negocio);
  `note text` (nullable, ej. "ticket 0423"); `accrual_kind text check in ('points','stamps')`;
  `units_granted integer NOT NULL check >= 0`; `balance_after integer NOT NULL` (traza de
  auditoría del saldo tras el otorgamiento); `created_by_user_id → merchant_auth.users`;
  `client_request_id uuid NOT NULL`; `created_at timestamptz NOT NULL default now()`.
  **`unique (business_id, client_request_id)`** (idempotencia). Índices por `membership_id` y
  `business_id`. La orden **es** el registro de auditoría append-only del otorgamiento (una
  orden = un grant); no se mutan filas. **Es dato del owner (analítica del negocio), no se
  expone al consumidor** — ninguna ruta pública la serializa.
- `core.order_item` — **nueva**, solo para `detailed`. `id`; `order_id → core.order` (cascade);
  `product_id → core.product` (nullable, `on delete set null`); `name_snapshot text NOT NULL`;
  `unit_price_snapshot numeric(12,2) NOT NULL`; `quantity integer NOT NULL check > 0`;
  `line_total numeric(12,2) NOT NULL`. El snapshot preserva el desglose aunque el catálogo se
  edite/borre después.

**Otorgamiento (`grant.ts`), invariante atómica.** En una transacción (`db.batch`, semántica
de 0024/0028):
1. `INSERT core.order` con `client_request_id`; ante `23505` → devolver la orden existente
   (idempotente, no re-otorga).
2. `UPDATE consumer.program_membership SET points_balance = points_balance + :n` **o**
   `stamps_count = stamps_count + :n` `WHERE id = :membership RETURNING` el saldo nuevo.
3. `INSERT core.order_item[]` (solo detallada).
4. `order.balance_after` = saldo devuelto por (2).
El monto que entra a `computeAccrual` es `order.total`. Para `stamps` `per_purchase`,
`units = grant` sin importar el total (el total igual se registra para estadística). Para
`per_amount` (puntos y sellos), `units = floor(total / block) * grant`.

**Resolución (`resolve.ts`).** `qr_token` → `consumer.consumer_account`. Programa del negocio =
`core.loyalty_program` con `status in ('active','closing')` y `kind in ('points','stamps')` con
mecánica definida. Membresía = `(consumer_id, program_id)`; si no existe, **auto-enrolar**
(`INSERT consumer.program_membership` saldo 0). Errores: `404` si el negocio no tiene programa
acreditable; `409`/`422` si el `qr_token` no resuelve; `403` si el operador no pertenece al negocio.

**Carrito (venta detallada).** Cada línea toma `name`/`unit_price` del producto (snapshot). Si
un producto no tiene `unit_price` (0034 lo permite), el operador **teclea el importe de esa
línea** antes de agregarla (se snapshotea igual). `total` = Σ `line_total`.

**Venta rápida.** Un input de importe + un input de nota opcional. `total` = importe tecleado;
`order_item` vacío; `mode='quick'`. Sin edición posterior (inmutable).

**Autorización y aislamiento.** Toda ruta bajo sesión `merchant_auth`. El operador debe tener
`core.business_membership` para el `business_id` (rol `owner` o `staff`). Nunca resuelve ni
acredita sobre un negocio ajeno. Los DTOs **no serializan** `qr_token`, `token_hash`,
`web_view_token` ni `auth_token_hash` (allow-list, test por entidad — regla CLAUDE.md).

**Rutas (runtime nodejs).**
- `POST /api/counter/resolve` — body `{ qrToken }`. Devuelve `{ consumer: { displayName },
  membership: { pointsBalance, stampsCount, justEnrolled }, program: { kind, accrual, cardDesign? },
  catalog?: [...] }`. Nunca el `qr_token`.
- `POST /api/counter/grant` — body `{ clientRequestId, membershipId, mode, total?, note?,
  items? }`. Valida, otorga atómico, devuelve `{ order: { unitsGranted, balanceAfter, kind } }`.
  Reintento con el mismo `clientRequestId` → misma orden (idempotente).

**UI (móvil).** Página `/backoffice/counter` (guardable como favorito; opcional
`?location=<id>` para fijar el local en el bookmark). Estados: escaneando (cámara) → resuelto
(perfil + toggle detallada/rápida + carrito/importe) → confirmando → **hecho → reinicio** al
escáner. Requiere HTTPS (`getUserMedia`). Si el negocio tiene >1 local y no viene `?location`,
pide elegir uno antes de acreditar. **Idempotencia en dos capas:** el botón Confirmar se
**deshabilita al primer tap** (guard de cliente, evita el doble-tap) y **además** el `grant`
es idempotente por `client_request_id` en DB (el guard de UI no reemplaza al de DB: cubre
reintentos de red, back/forward y recargas).

### Arquitectura de referencia

- **ADR 0031/0033** — merchant-first, resolución desambiguada por negocio, auto-enrolamiento.
- **ADR 0002/0007** — aislamiento y auditoría por comercio; operación local con snapshots.
- **ADR 0027/0028** — estados del programa (`active`/`closing`), atomicidad y auditoría.
- **spec 0034** — catálogo (productos, precio/coste opcionales, `currency_code` por negocio).
- **spec 0036** — `computeAccrual`, `accrual_*` del programa (define; 0030 ejecuta).

## Archivos

| Archivo | Acción |
|---|---|
| `src/server/schema/order.ts` | crear (`core.order` + `core.order_item`) |
| `src/server/schema/consumer.ts` | editar (`points_balance`, `stamps_count` en membership) |
| `src/server/schema/_schemas.ts` / barrel | editar (registrar `order`) |
| `src/server/counter/{counter,core,resolve,grant,orders}.ts` | crear |
| `src/server/drizzle/00NN_*.sql` (+ meta) | crear (migración aditiva) |
| `app/api/counter/resolve/route.ts` | crear |
| `app/api/counter/grant/route.ts` | crear |
| `app/backoffice/counter/page.tsx` + componentes (scanner, cart, quick, confirm) | crear |
| nav del backoffice (tarjeta "Mostrador") | editar |
| tests unit (`counter/*`) + integración Neon | crear |

### Disjunta?

**No.** Agrega saldo a `consumer.program_membership` y crea `core.order`/`order_item` que la
**spec 0031** (notificación + landing en vivo + dashboard "Ver mis programas") **lee**. 0031
depende de las tablas de 0030 → **serializar 0031 después de 0030**. También toca el barrel de
schema compartido. Contra las specs *implementadas* (0028/0034/0036) no hay colisión de archivos
(las consume read-only o extiende aditivamente).

## Definition of Done

- [ ] Escanear el QR de un consumidor **no miembro** lo auto-enrola y abre la acreditación.
- [ ] Venta detallada: carrito de N productos → total correcto → puntos/sellos según
      `computeAccrual` → `order` + `order_item[]` con snapshot + saldo incrementado.
- [ ] Venta rápida: importe + nota → `order` sin items, `mode='quick'`, saldo incrementado.
- [ ] `stamps per_purchase` otorga 1 sin importar el total; `per_amount` = `floor(total/block)*grant`.
- [ ] Reintento del `grant` con el mismo `client_request_id` **no** duplica saldo ni orden.
- [ ] Operador de otro negocio → `403`; negocio sin programa acreditable → `404`.
- [ ] Ningún DTO serializa `qr_token`/`token_hash`/`web_view_token`/`auth_token_hash`.
- [ ] La UI se reinicia al escáner tras confirmar.
- [ ] Migración aditiva verificada en prod; `core`/`merchant_auth`/`consumer` intactos.

## Plan de pruebas y verificación

- [ ] Unit `counter/grant`: `computeAccrual` × modos (puntos `per_amount`, sellos
      `per_purchase`/`per_amount`) y total 0/negativo.
- [ ] Integración Neon (rama efímera): auto-enrolamiento por escaneo; otorgamiento atómico
      (saldo + orden + items en una transacción); idempotencia por `client_request_id`
      (doble POST → un solo grant); aislamiento por negocio (`403`); no-fuga de tokens.
- [ ] Regresión: enrolamiento 0028 y catálogo 0034 siguen verdes.
- [ ] Comandos: `pnpm run typecheck && pnpm run lint && pnpm run test && pnpm run build`
      (Node 24) + integración Neon del dominio `counter`.
- [ ] Manual (owner, teléfono real sobre Vercel): abrir la URL, escanear el QR de Marcos/Julio,
      venta detallada y rápida, ver el saldo subir por MCP, confirmar el reinicio de la UI.

## Handoff requerido

Implementador + **revisor independiente** con `PASS` verificable (`docs/AGENT-WORKFLOW.md`) antes
de `implementada`. Rama Neon efímera para la integración; migración a prod **después** del PASS.

## Abierto

Nada bloquea el cierre. Las cuatro decisiones técnicas quedaron **ratificadas por el owner
(2026-08-15)**:

1. **La orden ES el ledger de auditoría** (en `core`, con `balance_after`), sin tabla de ledger
   separada en `consumer`. Un grant = una orden. La orden es **owner-facing** (analítica del
   negocio), nunca se expone al consumidor.
2. **Idempotencia en dos capas**: DB (`unique (business_id, client_request_id)`) **+** UI
   (Confirmar se deshabilita al primer tap). Ambas, no una sola.
3. **`location_id` se registra siempre**; fijable por `?location=<id>` en el bookmark y
   obligatorio elegirlo si el negocio tiene >1 local.
4. **Decodificación del QR**: `BarcodeDetector` nativo + fallback a lib JS empaquetada
   (re-warm del store de pnpm antes de codear).
