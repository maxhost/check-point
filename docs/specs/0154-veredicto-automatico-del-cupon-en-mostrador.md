---
spec: 0154
fecha: 2026-10-04
estado: cerrada
resumen: El mostrador muestra el veredicto automático del cupón, lo aplica al confirmar la venta y elimina la validación manual.
disjunta: no
archivos: apps/merchant/src/app/backoffice/counter/{counter-console,coupon-panel,done-stage,stages,types,coupon-ui.test}.ts*, apps/merchant/src/app/globals.css, tests/e2e/**
---

# 0154 — Veredicto automático del cupón en Mostrador

## Problema

- `counter-console.tsx:158-181` bloquea la venta por un cupón elegido distinto de descuento; `:251-307` llama a M2 y abre una etapa de éxito sin venta. El owner declaró erróneo este flujo en el [ADR 0120](../adr/0120-el-sistema-valida-el-cupon-no-el-comercio.md).
- `coupon-panel.tsx:47-96` ofrece «Validar», oculta «Quitar» en los cupones `extra_*` y no muestra el motivo de invalidez.
- `types.ts:43,173` aún admite `validated`; `done-stage.tsx:41-55` solo muestra las unidades de la venta y no separa los extras del cupón.

## Alcance

**Entra:** pantallas de Mostrador según el [contrato HTTP 0153](0153-contratos-de-api.md), que manda sobre esta spec: veredicto en venta detallada y rápida, quitar siempre, venta sin M2, autoagregado de producto bonificado, errores visibles de M3/M4 y ticket con extras separados.

**No entra:** API, servidor, migraciones, PWA P0–P2, reglas de vigencia/descuento, ni cambios al flujo de Canjear premios. El sondeo M1 cada ~4 s continúa.

## Diseño

### Lectura y consulta

- M0 y M1 traen `couponState.selected` con `coupon` y `verdict`. Si `valid: true`, el panel muestra ✓ verde y el `label`; si `valid: false`, muestra ✗ rojo, el `label` y `verdict.message` **literal**, sin reconstruir fechas ni motivos. El mensaje se anuncia de forma accesible. `hint`, `used_today` y `none` mantienen su significado. `validated` desaparece del tipo y la UI.
- El panel se muestra en Venta detallada y Venta rápida; Canjear premios no envía un cupón. Escanear y cerrar con la X vuelve a Mostrador sin llamar M3/M4 ni consumir la elección.
- El sondeo M1 actualiza el veredicto en pantalla. Solo un cupón verde afecta la vista previa de neto y unidades; uno rojo mantiene el bruto y no afirma que habrá descuento.

### Acciones

- Se eliminan «Validar», `POST /api/counter/coupon-validate`, `coupon_done`, estado y copy de validación, junto con CSS huérfano. «Quitar» queda visible en cualquier `selected`, verde o rojo y de cualquier `kind`. M3 manda `{membershipId,couponId}`. En 200 `{removed:"selected"}`, el panel deja de mostrar la elección; un error conserva el estado y muestra `{error}`. M3 puede devolver `422 invalid_input`, `409 coupon_not_removable`, `409 not_enrolled`, `404 unknown_coupon` o `404 not_found`.
- Confirmar una venta solo depende de sus datos normales y de `busy`: carrito/precios en detallada e importe en rápida. Un cupón elegido no bloquea el botón. Si está verde, M4 manda `couponId` y, cuando corresponda, `productId`; si está rojo, M4 sale **sin** `coupon`, la elección queda intacta y la vista previa no descuenta. En rápida, la nota de un producto gratis/2x1 solo incorpora el `label` si el cupón está verde. `Canjear` conserva su propio criterio `canRedeem`.
- Si M4 responde error `{error,code}`, se muestra `error` y no se abre el ticket ni se afirma descuento. `409 coupon_not_selected` (el cliente cambió su elección) dispara una lectura inmediata de M1 para actualizar el panel, manteniendo la venta que el comercio preparó. Los códigos del contrato son `coupon_not_yet_valid`, `coupon_expired`, `already_redeemed`, `coupon_daily_limit`, `coupon_cap_reached`, `program_changed`, `coupon_product_missing`, `coupon_quantity` y `coupon_currency_mismatch`; se muestra el `error` del servidor para cada uno. `coupon_not_active` deja de usarse.

### Producto y ticket

- En venta detallada, cuando aparece por primera vez en el escaneo un `selected` **verde** `free_product` o `two_for_one` con `coupon.productId`, se busca ese producto en el catálogo resuelto y se añade una vez por cupón: 1 unidad para gratis, 2 para 2x1. Los sondeos y cambios de pestaña no vuelven a sumarlo. El comercio puede variar o borrar la cantidad; si falta la línea, el servidor decide `coupon_product_missing`/`coupon_quantity`. Si el producto no está en el catálogo resuelto, no se inventa una línea. Sin `productId`, el comercio elige una línea del carrito como hoy. Un precio no guardado se pide con el campo habitual.
- En éxito, `order.unitsGranted` se muestra como unidades de la venta y `order.coupon.extraUnits` (si no es `null`) como unidades adicionales del cupón, en línea separada. `order.balanceAfter` es el saldo final. El subtotal, descuento y total salen de M4; no se infiere un descuento desde el veredicto.

## Archivos

| Archivo | Acción |
|---|---|
| `apps/merchant/src/app/backoffice/counter/{types,counter-console,coupon-panel,stages,done-stage}.tsx` y `types.ts` | adaptar estado, flujo, panel y ticket |
| `apps/merchant/src/app/backoffice/counter/coupon-ui.test.ts` | probar veredicto y ticket |
| `apps/merchant/src/app/globals.css` | estilos verde/rojo y limpieza de CSS huérfano |
| `tests/e2e/**` | probar consulta sin consumo, cobro, quitar y producto automático en navegador |

**Disjunta?** No. La 0153 de Claude hace borrado mecánico en `counter-console.tsx` y `types.ts`. Esperar su SHA y aplicar esta UI encima de `motor`, resolviendo ambos cambios.

## Definition of Done

- [ ] Prueba de navegador: escaneo verde → X → nuevo escaneo con el cupón aún elegido; no hay botón «Validar» ni llamada a M2.
- [ ] Verde/rojo usan `verdict`; rojo muestra `verdict.message` literal, deja «Quitar» y M4 sin `coupon`. M3 funciona en ambos estados y también en `extra_*`.
- [ ] Detallada con producto fijo agrega 1 unidad `free_product` o 2 `two_for_one` una sola vez por cupón y escaneo; el comercio puede editar/quitar, y el precio sin guardar se solicita.
- [ ] M4 `coupon_not_selected` vuelve a leer M1; todos los errores enumerados son visibles y no abren éxito. Un cupón verde no bloquea confirmar por sí mismo.
- [ ] El ticket separa `unitsGranted`, `extraUnits` y `balanceAfter` y conserva bruto, descuento y neto del servidor.
- [ ] Barrido `rg -n 'coupon-validate|validateCoupon|"validated"|coupon_done|coupon_not_active' apps/merchant/src/app/backoffice/counter` → vacío, salvo texto histórico en tests deliberados.
- [ ] `pnpm verify` completo en verde con Node 24 y tabla final registrada; suites Neon solo mediante `tools/neon-test.sh`.
- [ ] `rg -n MUTATION apps/merchant/src/app/backoffice/counter apps/merchant/src/app/globals.css tests/e2e` → vacío.

## Mutaciones — presupuesto: 0

El contrato y las pruebas de navegador cubren los caminos de UI. La revisión independiente se hace al final, después del gate.

## Declarado AFUERA (sin oráculo, a propósito)

- QA físico con pase real, cámara, Panadería y cupón vencido; lo hará el owner tras deploy `READY` del SHA conjunto.

## Handoff

GPT implementa la UI cuando el owner entregue el SHA del servidor. Un solo push con servidor y UI, nunca antes de que ambos estén listos. Revisor independiente y deploy `READY` antes del QA del owner. La 0154 sigue `cerrada` hasta verificar todo.

## Abierto

Nada: el ADR 0120 y el contrato 0153 fijan las decisiones.
