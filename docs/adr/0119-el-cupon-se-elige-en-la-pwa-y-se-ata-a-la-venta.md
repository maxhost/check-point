---
adr: 0119
fecha: 2026-10-03
estado: aceptada (§6, §7, §9, §11 y §14 reemplazados por el ADR 0120)
resumen: El canje de cupon deja de ser un evento suelto que cierra el mostrador. El cliente ELIGE el cupon en my.checkpass.club (filtrado por ubicacion o, sin ella, por el comercio que lo escaneo) y el QR del pase lo lleva; el comercio lo VALIDA al pedir (2x1, gratis, texto) o lo aplica en la venta (descuento), y al cobrar se ATA a la venta con su linea de descuento y los puntos/sellos sobre el neto. Ciclo disponible → elegido → validado → consumido; el comercio puede quitarlo (vuelve a disponible); un validado sin venta se consume al cierre del dia. Un cupon por cliente + comercio + dia; el canje de premio del programa no cuenta.
---

# 0119 — El cupon se elige en la PWA y se ata a la venta

## Contexto

El owner probo el 2026-10-03 un cupon de Bienvenida en el mostrador y lo declaro inservible. Hoy (specs 0065 C, 0102,
0106) el escaneo trae **un** cupon —el que vence primero (`apps/merchant/src/server/counter/coupon-scan.ts`,
`loadActiveCoupon`, `order by valid_until asc`)—, «Canjear cupón» lo quema en una transaccion aparte sin monto
(`coupon-store.ts`, `persistCouponRedemption`) y la consola pasa a «Entrega» → «Escanear siguiente» (`counter-console.tsx`,
`confirmCoupon` → `setStage("done")`). Los problemas que nombro el owner:

1. El cupon no tiene impacto en la compra.
2. Un 2x1 se valida al PEDIR (ver que es real y dar el beneficio); un 10 % al PAGAR. Son momentos distintos.
3. El canje termina la atencion: con un descuento hay que reabrir para cargar productos, no se ve lo que hay que cobrar
   y el cupon no queda atado al pedido (estadisticas).
4. «Si el cliente tiene 3 cupones de ese comercio, ¿cual ve el merchant? ¿como sabemos que es ese el que el cliente
   quiere canjear?» — el cliente no elige y el comercio no valida el correcto.
5. Es un proceso **mobile**, no desktop, en los dos lados.

Investigacion: `reports/Canje de cupones en mostrador móvil.md` y sus notas en
`research_notes/Canje de cupones en mostrador móvil/` (competencia pymes, grandes marcas, patrones mobile, analogias
laterales, `2x1_en_el_pos.md`, `un_cupon_por_visita.md`). Lo que se tomo: el modelo de McDonald's/BK/Tim Hortons (el
cliente elige antes, el codigo de la cuenta apunta a la eleccion, un solo escaneo canjea y acredita); el de Square/Toast
(el cupon es una linea de descuento dentro de la venta; «producto gratis» = item a precio de lista + 100 % de descuento
en esa linea; puntos sobre el neto); y la norma de un beneficio por compra.

## Decidido por el owner (2026-10-03)

1. **Elige el cliente, en my.checkpass.club.** Selecciona el cupon y la PWA muestra el QR del pase — el mismo que el de
   Wallet —; el servidor sabe cual eligio. El QR sigue identificando solo la cuenta.
2. **Filtro de la lista: ubicacion; sin permiso, el comercio donde lo escanearon.** Si el cliente elige DESPUES de ser
   escaneado, lo que ve el comercio se refresca (p. ej. un descuento que entra a la venta en curso).
3. **Sin cupon elegido, el comercio solo ve un aviso:** «este cliente tiene cupones para tu comercio, recomendale
   seleccionar alguno en el app de checkpass.club». **El comercio no puede activarlos.**
4. **La eleccion no vence.** Queda hasta que se consume o el cliente elige otro (el anterior vuelve a disponible, segun su
   propia vigencia). Escaneado en otro comercio, no aplica.
5. **Se mantienen las tres pestañas del mostrador.** «Canjear» valida cupones (y canjes del programa); «Venta detallada» y
   «Venta rapida» aplican el descuento (la rapida tambien, porque pide monto).
6. **Momento por tipo.** Descuento (% o monto): se aplica en la venta, el total se calcula con el descuento.
   2x1 / producto gratis / texto: lo ideal es **validarlo antes de pedir** («Oferta valida», queda en el historial del
   dia), porque las reglas (p. ej. «cervezas seleccionadas») se chequean antes de consumir; tambien existe el caso «lo
   dice al pagar», que valida y ata en el mismo escaneo.
7. **Validado no es consumido.** Validado al pedir, queda en la cuenta como «elegido y validado»; al cobrar el comercio
   vuelve a escanear el pase y ahi el cupon **se ata a la orden** y a sus puntos/sellos. En la venta detallada: con
   producto atado se ve el producto y la linea bonificada al 100 % (como Square/Toast); sin producto atado, el comercio
   elige a cual producto del pedido aplica.
8. **Venta rapida con 2x1 / gratis / texto:** el texto del cupon va como **nota** y el valor lo pone el comercio.
9. **Validado = trabado.** El cliente no puede cambiar un cupon validado; solo el comercio puede quitarlo.
10. **El comercio puede quitar el cupon** si no cumple las reglas («tenias que consumir 10 y consumiste 8»): cobra lo que
    corresponde y el cliente lo recupera para otro momento, mientras no venza por sus propias condiciones.
11. **Validado y nunca cobrado se consume al cierre del dia**, sin venta («canjeado sin venta registrada»). El owner
    anticipa un cron; la spec decide el mecanismo.
12. **Puntos y sellos sobre el monto con descuento.** Owner: si el pago deberia ser 20 y el descuento lo deja en 10, se
    otorgan 10 puntos (o lo que de la mecanica sobre 10).
13. **Un cupon de monto fijo mayor que la compra:** se cobra 0 y el resto se pierde.
14. **Un cupon por cliente + comercio + dia.** Un 2x1 validado al pedir impide usar un 10 % al pagar. A validar en uso
    real; si un comercio necesita combinar, la salida estandar es una marca «combinable» por cupon (no se construye ahora).
15. **Canjear un premio del programa NO cuenta como el beneficio de la visita** («para comercios pequeños es asumir
    demasiado»).
16. Despues de validar, la pantalla de exito ofrece **continuar con el cliente o escanear otro** (copy claro y simple).

## Consecuencias

- El cupon pasa de evento a **estado**: `disponible → elegido → validado → consumido`, y `quitado` devuelve a
  `disponible` desde elegido, validado o una venta en curso. La venta registrada guarda que cupon la bonifico y cuanto.
- Reemplaza el comportamiento de la spec 0065 C / 0102 en el mostrador (un cupon «el que vence primero», canje terminal).
  La UI vieja de ese canje se borra (ADR 0070 §17).
- Pantallas = zona de GPT (ADR 0114); la spec entrega servidor + **contrato HTTP** del mostrador y de la PWA.
- Riesgo declarado: si el comercio cobra en su propia caja sin re-escanear, el cupon validado termina «sin venta» y su
  efecto en el ticket no se registra.
