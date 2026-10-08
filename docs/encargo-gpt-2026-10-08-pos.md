# Encargo para GPT — 2026-10-08: pantallas del POS

Lo arma Claude a pedido del owner. La API ya está hecha, revisada (PASS) y commiteada; falta toda la parte visual.

## 0. Rama: `dev`, NO `main` (léelo antes de tocar nada)

- **Trabajás en la rama local `dev`.** `git branch --show-current` tiene que decir `dev`; si no, `git switch dev`.
- **La API del POS solo existe en `dev`** (commits `656eaa3`..`88224ec`). En `main` no hay rutas `/api/pos/*` ni la
  migración `0066`: si trabajás sobre `main`, nada de esto anda.
- **No hagas merge a `main` ni push.** El owner quiere probar el POS completo en local (`pnpm dev:local`, base local en
  Docker con la migración `0066` ya aplicada) **antes** de que la migración llegue a PROD. El paso a `main` y el push
  los hace Claude con el OK del owner (`docs/TRABAJO-EN-PARALELO.md` §3).
- Commits chicos en `dev`. Reglas comunes y zonas: `docs/TRABAJO-EN-PARALELO.md`. Tu spec se numera desde **0170**
  (Claude usó hasta la 0169).

## 1. Qué es

Spec de la API: **`docs/specs/0169-pos-ordenes-de-mesa.md`** — leé §Decisiones del owner y §Contrato HTTP enteros;
son la fuente de verdad. ADR: `docs/adr/0130-pos-orden-abierta-separada-de-la-acreditacion.md`.

El POS es una **sección nueva** del backoffice (sugerido: `/backoffice/pos`). **El mostrador
(`/backoffice/counter`) no cambia.** Flujo del owner:

> Atiende una mesa → abre POS → elige local (si tiene más de uno) → pone nombre de mesa → ve el catálogo como lo ve
> hoy al escanear en mostrador → elige productos → guarda → la orden queda **abierta** en el historial → cuando el
> cliente quiere pagar, abre la orden → botón **«Escanear pase»** → escanea → se aplica el cupón si el cliente eligió
> uno en `my.checkpass.club` → ve el resultado como hoy en mostrador → cobra → **cierra venta** → se acreditan cupón y
> puntos como en mostrador.

## 2. Pantallas y comportamiento

1. **Entrada en la navegación** «POS», visible solo si `business.posEnabled === true` (de `GET /api/merchant/session`)
   **y** el usuario tiene `pos` en `membership.permissions` (el owner siempre lo tiene).
2. **Activar / desactivar el módulo** (solo owner): `PUT /api/merchant/business/pos` `{ enabled }`. Viene **apagado**
   por defecto. Un gym no lo necesita, así que el owner tiene que encontrar dónde activarlo. Proponé el lugar
   (ej. Cuenta / Configuración) y consultalo con el owner si dudás.
   - Desactivar con órdenes abiertas → **409 `pos_has_open_orders`** con `openCount`: **modal de error** que dice que
     hay que cerrar (o anular) las N órdenes abiertas para desactivar. Decisión del owner.
3. **Lista / historial del POS** (`GET /api/pos/orders`): dos grupos, **«Abiertas»** (de cualquier fecha, hasta que
   alguien las cierre; no se cierran solas) y **«Cerradas hoy»** (cerradas y anuladas del día). Botón «Nueva orden».
4. **Nueva orden / editar**:
   - Local: si el negocio tiene más de un local activo, elegirlo (como `location-gate.tsx` del mostrador).
   - Nombre de mesa: input libre, obligatorio, 1–60 caracteres, sin chequear duplicados (MVP).
   - Catálogo: `GET /api/pos/catalog?locationId=` (misma forma que el catálogo del mostrador). Mismo armado del carrito
     que el mostrador hoy (`sale-forms.tsx`). Un producto sin precio pide el precio tipeado (`unitPrice`).
   - Guardar: `POST /api/pos/orders` (crear) o `PUT /api/pos/orders/:id` (editar, con la `version` que tenés y la
     lista **completa** de líneas; las líneas existentes van con su `lineId`). El precio queda **fijo** al agregar el
     producto: si el catálogo cambia después, la línea vieja conserva su precio. No recalcules precios en el cliente.
   - **409 `version_conflict`**: otra persona la editó; el cuerpo trae `order` actual. Mostralo y recargá esa versión.
5. **Detalle de una orden abierta**: productos, total, y los botones **Editar**, **Imprimir**, **Anular**
   (`POST /api/pos/orders/:id/void`, con confirmación) y **Cobrar**.
6. **Cobrar**:
   - **Calculadora de cambio**: input «Recibido» → muestra `cambio = recibido − total`. Solo en pantalla, **no se
     guarda nada** (decisión del owner).
   - Botón **«Escanear pase»** (opcional): mismo escáner del mostrador (`qr-scanner.tsx`) pero contra
     **`POST /api/pos/resolve`**; después el estado del cupón con **`GET /api/pos/coupon-state?membershipId=`** y quitar
     cupón con **`POST /api/pos/coupon-remove`**. Mismo diseño y misma lógica de cupón que el mostrador hoy (no
     inventes reglas: el veredicto y el descuento los decide el servidor).
   - **Cerrar venta**: `POST /api/pos/orders/:id/close` con `{ clientRequestId, version, membershipId?, coupon? }`.
     - Sin escanear → se cierra sin pase (no acredita nada). Es válido: el cliente puede no tener Checkpass.
     - Con pase → `membershipId` (y `coupon` si aplica). La respuesta trae `sale` (neto, bruto, descuento, puntos o
       sellos, saldo): mostralo **como la pantalla de resultado del mostrador** (`done-stage.tsx`).
     - `clientRequestId`: un UUID por intento de cierre; reusalo en los reintentos del mismo intento.
     - Errores del cupón (409 con el código del veredicto) → la orden **sigue abierta**; mostrá el mismo mensaje que
       el mostrador.
7. **Imprimir** (impresión del navegador, `window.print()` + CSS de impresión; sirve para cualquier impresora,
   también una térmica): abierta = **precuenta** (comercio, local, mesa, productos, total). Cerrada = lo mismo + descuento
   del cupón y total final. Los datos salen de `PosOrder` (`business.name`, `location.name`, `items`, `total`, `sale`).
   No es comprobante fiscal.
8. **Pantalla de Equipo** (`backoffice/staff`): el toggle del permiso `pos` aparece **solo si `business.posEnabled`**.
   Hoy aparece siempre (Claude agregó la copia en `staff-contract.ts` solo para que compile). Si igual se manda con el
   módulo apagado, el servidor devuelve **422 `pos_disabled`**.

## 3. Lo importante de no romper

- **El POS usa SOLO `/api/pos/*`**, nunca `/api/counter/*`: un staff con permiso `pos` sin `counter` tiene que poder
  cobrar. Si reusás componentes del mostrador, parametrizá la URL; el mostrador tiene que seguir llamando a
  `/api/counter/*` como hoy.
- **El canje de premios NO va en el POS** (decisión del owner): se hace desde el mostrador.
- Errores de la API: `{ error, code }`, mismo formato que el mostrador. Lista de códigos en la spec 0169 §Contrato.
  `403 pos_disabled` / `missing_permission` → la sección no está disponible para ese usuario.
- Kit de UI y guardias (ADR 0123): `Button`/`Text` del kit, `ui-guard` sin aumentos.
- Si te falta un dato que la API no da, **no toques el servidor**: pedíselo a Claude por el owner.

## 4. Cómo probar en local

`pnpm dev:local` (base local con la `0066`). Owner de prueba → activar el POS → crear una mesa → editarla → imprimir →
cobrar sin pase; otra mesa → cobrar escaneando un pase de prueba con un cupón elegido → ver el resultado y el
movimiento en «Movimientos de hoy» del mostrador. Desactivar con una mesa abierta → modal. e2e del flujo en
`tests/e2e/` (tu zona). Después de tu PASS, el owner prueba en local; recién con su OK se pasa a `main`.
