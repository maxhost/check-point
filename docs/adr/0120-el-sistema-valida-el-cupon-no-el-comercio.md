---
adr: 0120
fecha: 2026-10-04
estado: aceptada
resumen: El comercio ya no valida cupones a mano. Al escanear, el sistema muestra el cupon que eligio el cliente con su veredicto (valido en verde, o invalido en rojo con el motivo); la venta lo aplica sola al confirmar y recien ahi se consume. «Quitar» siempre disponible (devuelve el cupon al cliente). Desaparecen el boton «Validar», el estado «validado» y el «validado sin venta se consume al cierre». Los sellos/puntos extra se acreditan con la venta; un producto gratis / 2x1 con producto se agrega solo al carrito de la venta detallada. Reemplaza los puntos 6, 7, 9, 11 y 14 (en lo que habla de validar) del ADR 0119.
---

# 0120 — El sistema valida el cupon, no el comercio

## Contexto

QA del owner, 2026-10-04, sobre la 0148/0149 en PROD: al escanear un pase con un cupon de Bienvenida («Cafe americano
gratis», `free_product`) el mostrador muestra «Cupón elegido» con «Validar» / «Quitar», y la venta queda bloqueada hasta
tocar uno de los dos (`counter-console.tsx`, `canConfirm`). Palabras del owner: «este flujo es erroneo. El merchant no
tiene que validar el cupon manualmente lo tiene que hacer el sistema».

El owner describio los dos casos de uso:

1. **Consulta.** El cliente quiere saber si su cupon (ya elegido en su cuenta) es valido. El comercio escanea el pase,
   ve el cupon en la venta detallada o rapida con un check verde si es valido, o una X roja con la explicacion («el
   cupon expiro [fecha]», «ya fue canjeado»), se lo comunica al cliente y sale del mostrador.
2. **Cobro.** El cliente va a pagar con el cupon elegido. El comercio escanea, ve el veredicto igual que en el caso 1,
   cobra con el cupon ya aplicado y confirma la venta.

«Quitar» esta siempre disponible, sea valido o no, y devuelve el cupon al cliente. El cliente no deberia poder elegir un
cupon invalido (ya es asi: `409 coupon_not_selectable`, spec 0148 P1).

## Decision

1. **No hay validacion manual.** Se borran el boton «Validar», `POST /api/counter/coupon-validate` y el estado
   «validado» (fila de canje sin venta). El ciclo queda `disponible → elegido → consumido`; «quitar» devuelve a
   disponible desde elegido.
2. **El escaneo trae el veredicto.** Si el cliente eligio un cupon de ESTE comercio, el mostrador lo muestra con
   `valido` o `invalido + motivo`, calculado por el servidor con las mismas reglas que la venta.
3. **El cupon se consume solo al confirmar la venta.** Escanear y salir (caso 1) no consume nada.
4. **«Quitar» siempre disponible** sobre el cupon elegido, valido o no: borra la eleccion del cliente.
5. **Sellos/puntos extra (`extra_stamps` / `extra_points`): se acreditan al confirmar la venta**, ademas de los de la
   venta (owner, 2026-10-04, opcion recomendada). Sin venta no se acreditan.
6. **Producto gratis / 2x1 con producto propio, en la venta detallada: el sistema agrega el producto al carrito
   bonificado** (owner, 2026-10-04, opcion recomendada): 1 unidad para producto gratis, 2 unidades para 2x1 (se
   bonifica 1). El comercio puede ajustar cantidades.

Se mantienen del ADR 0119: la eleccion en la PWA (§1–§4), las pestañas (§5), descuento en la venta, venta rapida con el
texto como nota (§8), puntos sobre el neto (§12), monto fijo mayor que la compra (§13) y **un cupon por cliente +
comercio + dia** (§14, ahora sin el caso «2x1 validado al pedir»).

## Consecuencias

- Sin «validado», nada queda trabado: entre la consulta y el cobro el cliente puede cambiar el cupon. La venta cobra el
  que esta elegido al confirmar (si cambio, la venta responde `409` y la pantalla se actualiza).
- Desaparece el «canjeado sin venta registrada» del ADR 0119 §11: no hay filas de canje sin venta nuevas. En PROD no hay
  ninguna (`core.coupon_redemption` sin filas desde la 0148, consultado 2026-10-04), no hay datos que convertir.
- Las reglas de un 2x1 («solo de manteca») las sigue mirando el comercio a ojo; si no se cumplen, «Quitar».
- Un cupon en rojo no se aplica: la venta sale sin el, y la eleccion queda como esta hasta que el comercio la quite o el
  cliente elija otro.
