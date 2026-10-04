# Canje de cupones/recompensas en mostrador — competencia loyalty para pymes

Nota de alcance: presupuesto de ~18 llamadas. Cubiertos con fuente primaria: Square (Loyalty + Marketing), Toast Loyalty (+ API de POS), Loopy Loyalty, Stamp Me, Loyverse, Fivestars/SumUp (parcial), Thanx (parcial), Mercado Pago QR (parcial). NO cubiertos con fuente: Punchh, Paytronix, Como, Belly, Perkville, Smile/Yotpo in-store, Bonda, Puntos Colombia, Rappi, Zomato/Swiggy Dineout, reseñas G2/Capterra (ver Gaps).

## 1. Flujo paso a paso del canje en mostrador por plataforma

### Takeaway
Los POS integrados (Square, Toast, Loyverse) tratan el canje como **un descuento que se agrega a la orden/ticket** y se confirma al pagar; las apps standalone sin POS (Loopy, Stamp Me) tratan el canje como **una transacción separada de "quemar" la recompensa**, sin tocar el monto, que es exactamente el modelo actual de CheckPass.

### Cited Findings
**Square POS (Loyalty + Marketing coupons)**
- Cupón por código: Checkout > Library > Rewards > "Use Code", ingresar el código, seleccionar recompensas a aplicar y completar la venta — [Square UK help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases); mismo flujo en [Redeem Coupons with Square Marketing](https://squareup.com/help/us/en/article/7922-redeem-coupons-with-square-marketing)
- Cupón por perfil del cliente: tocar el nombre del cliente en "Current Sale" → sección "Coupons" → "Apply to Sale" en cada cupón que se quiera aplicar — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)
- Loyalty: si el cliente tiene puntos canjeables aparece el aviso "Reward Available" antes del checkout; el cajero lo toca y elige la recompensa — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)
- Card-linked: si el cliente paga con una tarjeta vinculada a su cuenta de loyalty, ve una pantalla de canje en el checkout (pantalla del cliente) para elegir recompensas — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)
- Para quitar un cupón aplicado: en la pantalla de pago, "Add discount" muestra/quita los cupones — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)

**Toast Loyalty (POS integrado)**
- Botón "Rewards" en la pantalla de orden → buscar al cliente → seleccionar su cuenta; al agregar la cuenta a la orden aparece un pop-up con las recompensas disponibles, listadas alfabéticamente; el empleado toca "Redeem" junto a la elegida; el descuento aparece en la orden (panel izquierdo) y en "Discounts" junto al subtotal; luego "Pay" — [Toast: Redeem Points](https://support.toasttab.com/en/article/Redeeming-Points-with-Toast-Loyalty) (resumen vía buscador; ver también [guía Lunchbox para Toast](https://support.lunchbox.io/en/articles/8684393-2w-toast-in-store-guest-lookup-reward-redemption-guide-lb-2-0))
- En el programa de puntos-a-dinero de Toast, al canjear se aplican todos los puntos hasta el saldo de la cuenta; el cliente no elige cuántos puntos usar — [Toast: Redeem Points](https://support.toasttab.com/en/article/Redeeming-Points-with-Toast-Loyalty) (snippet del buscador)
- Etapas de la API de loyalty de Toast para integradores: Search → Inquire (recompensas disponibles) → Redeem (se aplica a la cuenta como descuento al elegirla; **la confirmación `LOYALTY_REDEEM` se envía recién al iniciar el pago**) → Accrue (puntos se acreditan después del pago) — [Toast dev guide: POS workflow](https://doc.toasttab.com/doc/devguide/apiLoyaltyPosWorkflow.html)
- Las ofertas no elegibles aparecen con el botón Redeem deshabilitado; el integrador decide elegibilidad con el booleano `applicable` del objeto `Offer` — [Toast dev guide](https://doc.toasttab.com/doc/devguide/apiLoyaltyPosWorkflow.html)

**Loyverse POS (gratis, muy usado por pymes en LATAM/Asia)**
- Elegir cliente (recientes o búsqueda por nombre/email/teléfono) → el perfil muestra puntos disponibles → muestra el valor máximo canjeable; el cajero canjea todo o ingresa un monto menor según pida el cliente → "OK" → el descuento aparece en el ticket bajo "Discounts" y el total baja; el recibo muestra la línea de puntos canjeados — [Loyverse help: points discounts](https://help.loyverse.com/help/points-discounts); [Loyverse support](https://support.loyverse.com/en/articles/1059200-redeem-customer-points)
- Default: 1 punto por cada 100 unidades de moneda gastadas; 1 punto = 1 unidad de moneda al canjear — [resumen de Loyverse vía buscador](https://help.loyverse.com/help/how-customer-loyalty-program)

**Loopy Loyalty (standalone, sin POS — el análogo más cercano a CheckPass)**
- App "Stamper" (iOS/Android): staff toca el botón azul para escanear, apunta la cámara al código del pase de Wallet del cliente, aparece una vista previa de la tarjeta con info del cliente y recompensas disponibles; "+" verde suma sellos (cada toque un sello); para canjear, se pone el switch de la recompensa en "on" y "Submit" — [Loopy docs iOS Stamper](https://docs.loopyloyalty.com/en/articles/10502182-using-the-ios-stamper-app)
- "Se pueden aplicar sellos y canjear recompensa(s) en un solo escaneo"; permite canjear una o varias recompensas en un escaneo — [Loopy docs](https://docs.loopyloyalty.com/en/articles/10502182-using-the-ios-stamper-app); [Loopy Stamper feature](https://loopyloyalty.com/features/stamper-app/)
- Ajuste opcional "Confirm Transaction": muestra pantalla de confirmación con el detalle antes de aplicar — [Loopy docs](https://docs.loopyloyalty.com/en/articles/10502182-using-the-ios-stamper-app)
- Todos los sellos y canjes quedan registrados en el dashboard web — [Loopy Stamper feature](https://loopyloyalty.com/features/stamper-app/)

**Stamp Me (standalone, app del cliente)**
- Al juntar los sellos se emite un voucher; se reclama en tienda **mostrando el voucher al staff**; el cliente tiene **3 minutos** para canjear y aparece un aviso recordando el límite — [Stamp Me (resumen de buscador sobre sourceforge/stampme.com)](https://sourceforge.net/software/product/Stamp-Me/); [Stamp Me misuse](https://help.stampme.com/en/articles/6204197-how-to-prevent-misuse-with-stamping-and-reward-redemptions)

**Fivestars by SumUp**
- El comercio suma puntos y canjea recompensas u ofertas en el POS o en la "Connect Tablet"; la tablet de cara al cliente permite al cliente registrarse, hacer check-in y canjear; "solo muestra las promociones o recompensas que el cliente puede canjear, para que el equipo aplique el descuento rápido" — [SumUp Connect help](https://help.sumup.com/en-US/sections/RqPe3XHxJvRKsH8POwjI0-sumup-connect); [SumUp loyalty](https://www.sumup.com/en-us/loyalty-om-marketing/) (vía resumen de buscador)

**Thanx**
- Loyalty card-linked: se acumula pagando con tarjeta registrada, sin check-in; en tienda el cliente puede canjear sin app dando email o teléfono — [Qu + Thanx](https://www.qubeyond.com/resource-center/thanx-qu-shaping-the-future-of-guest-engagement)
- Integración Qu POS: el staff busca al cliente, ve saldo y recompensas, selecciona y aplica una a la cuenta y **la recompensa se retira automáticamente de la cuenta en Thanx**; en kiosco el cliente arma la orden, ingresa su cuenta y ve las recompensas aplicables — [Qu + Thanx](https://www.qubeyond.com/resource-center/thanx-qu-shaping-the-future-of-guest-engagement)

**Mercado Pago (pago con QR en local físico)**
- Los descuentos por pagar con QR se aplican en el pago; "Si tenés más de uno disponible, **siempre aplicará el descuento más alto**" — [Mercado Pago UY: descuentos con QR](https://www.mercadopago.com.uy/ayuda/como-funcionan-los-descuentos-con-QR_4309) (vía resumen de buscador)
- Los cupones/beneficios se encuentran en la sección "Beneficios" de la app y el mapa "Descubrir locales" — [Mercado Pago UY](https://www.mercadopago.com.uy/ayuda/como-funcionan-los-descuentos-con-QR_4309); [iProfesional](https://www.iprofesional.com/economia/417228-mercado-pago-como-acceder-a-cupones-de-descuento-y-ahorrar)

**Apps LATAM pequeñas (solo marketing, sin flujo documentado)**
- Fidy, Fidufy, Fidelilocal: fidelización por QR (el cliente escanea en cada visita y canjea puntos) — [Fidy](https://www.befidy.com/); [Fidufy](https://fidufy.com/); [Fidelilocal](https://www.fidelilocal.com/). No describen el canje paso a paso.

### Inferences
- Hay dos modelos de canje: (A) **"aplicar a la orden"** (Square, Toast, Loyverse, Thanx vía POS): la recompensa es una línea de descuento en el ticket, editable/quitable antes de pagar, y se consolida al pagar; (B) **"validar/quemar"** (Loopy, Stamp Me): la recompensa se marca usada en una transacción propia, sin monto. El modelo A es el que resuelve los tres dolores declarados de CheckPass (impacto en el monto, atado a la venta, elección del cupón).
- Loopy demuestra que en standalone se puede combinar "sumar sellos + canjear" en una única transacción por escaneo: es el precedente más directo para que CheckPass una venta + canje en la misma sesión de mostrador.

### Gaps
- No obtuve el texto completo del artículo de Toast (solo snippet) ni capturas de pantalla.
- Punchh, Paytronix, Como, Belly (histórico, tablet iPad en mostrador), Perkville, Smile/Yotpo in-store, Bonda, Puntos Colombia, Rappi, Zomato/Swiggy Dineout, Clienty/Fidely: no investigados por presupuesto de llamadas; no hay hallazgos con fuente.

## 2. Quién elige el cupón y cómo se resuelve "el cliente tiene 3 cupones"

### Takeaway
En POS integrados **elige el cajero sobre una lista** (a veces con pantalla de cara al cliente), se permite apilar varios de distinto tipo, y hay auto-aplicación cuando hay uno solo; en billeteras masivas (Mercado Pago) **no elige nadie: el sistema aplica el mejor**.

### Cited Findings
- Square: cajero elige desde el perfil ("Apply to Sale" por cupón) o el cliente elige en la pantalla de canje del checkout si paga con tarjeta vinculada — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)
- Square: "Se pueden aplicar a la vez varias recompensas de distinto tipo, por ejemplo una de porcentaje y una de monto fijo en una misma venta" — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)
- Square: "Si hay una sola recompensa disponible, se aplica automáticamente. Una recompensa no puede aplicarse a más de una venta, aunque no se haya consumido entera" — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)
- Toast: pop-up con lista alfabética de recompensas; el empleado scrollea y toca "Redeem" en las que el cliente quiere — [Toast dev guide](https://doc.toasttab.com/doc/devguide/apiLoyaltyPosWorkflow.html); las no aplicables aparecen deshabilitadas — [mismo](https://doc.toasttab.com/doc/devguide/apiLoyaltyPosWorkflow.html)
- Toast: el cliente puede elegir solo en canales self-service (pantalla de cara al cliente GFD, kiosco, online) sin asistencia del staff — [Toast item-based rewards](https://support.toasttab.com/en/article/Optimize-Toast-Loyalty-with-Item-Based-Rewards)
- Fivestars/SumUp: tablet de cara al cliente para canjear; filtra y muestra solo lo canjeable — [SumUp Connect](https://help.sumup.com/en-US/sections/RqPe3XHxJvRKsH8POwjI0-sumup-connect)
- Loopy: el staff ve todas las recompensas disponibles al escanear y activa los switches de las que se canjean (una o varias) — [Loopy docs](https://docs.loopyloyalty.com/en/articles/10502182-using-the-ios-stamper-app)
- Stamp Me: elige el cliente en su app (abre el voucher, que corre 3 min) y lo muestra — [Stamp Me misuse](https://help.stampme.com/en/articles/6204197-how-to-prevent-misuse-with-stamping-and-reward-redemptions)
- Mercado Pago QR: con más de un descuento disponible "siempre aplicará el descuento más alto" — [Mercado Pago UY](https://www.mercadopago.com.uy/ayuda/como-funcionan-los-descuentos-con-QR_4309)

### Inferences
- Patrón dominante para un mostrador asistido: **el comercio ve la lista completa, filtrada/ordenada por aplicabilidad (deshabilitando lo no aplicable a la orden), y el cliente dice cuál**; la auto-aplicación con uno solo reduce toques. La elección del cliente en su propio teléfono existe (Stamp Me, Square card-linked, Toast GFD) pero aparece ligada a pantalla de cara al cliente o a voucher temporizado.

### Gaps
- No encontré documentación de reglas de compatibilidad/apilamiento explícitas (p. ej. "un cupón por visita") en Square/Toast más allá de la frase citada.

## 3. ¿El canje modifica el monto y cómo se ata a la orden?

### Takeaway
Sí en todos los POS integrados: la recompensa es un descuento de línea u orden dentro del ticket; los ítems gratis exigen que el ítem esté en la orden. En standalone (Loopy/Stamp Me) no hay monto: solo un registro de canje.

### Cited Findings
- Toast: la recompensa se agrega a la cuenta "como descuento" y aparece en el total bajo "Discounts" — [Toast dev guide](https://doc.toasttab.com/doc/devguide/apiLoyaltyPosWorkflow.html)
- Toast item-based: "La orden debe contener un ítem que califique"; "Si hay más de un ítem aplicable, seleccionar el ítem al que aplicar la recompensa" — [Toast item-based rewards](https://support.toasttab.com/en/article/Optimize-Toast-Loyalty-with-Item-Based-Rewards)
- Toast: las recompensas de ítem gratis no se pueden canjear en Mobile Order & Pay, pagos móviles ni Toast Local — [Toast item-based rewards](https://support.toasttab.com/en/article/Optimize-Toast-Loyalty-with-Item-Based-Rewards)
- Loyverse: el canje baja el total y figura en el ticket y en el recibo como línea de descuento — [Loyverse help](https://help.loyverse.com/help/points-discounts)
- Square: el cupón aplicado figura como descuento visible/quitable desde la pantalla de pago ("Add discount") — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)
- Loopy: canjes y sellos se registran como transacciones en el dashboard (sin monto) — [Loopy Stamper](https://loopyloyalty.com/features/stamper-app/)

### Inferences
- Atar el canje a la venta da atribución gratis (campaña → cupón → ticket con monto). Sin ítem en el carrito, un "producto gratis" no tiene cómo descontarse: Toast lo resuelve exigiendo el ítem y eligiendo cuál si hay varios — relevante para el carrito de productos de CheckPass; para "monto rápido" no hay ítem, y el % u monto fijo es lo único que se calcula limpio.

### Gaps
- No encontré documentación de reportes de atribución por campaña (ventas generadas por cupón) en Square Marketing/Toast con fuente.

## 4. Etapas "aplicar a la orden" vs "validar/quemar"; orden vs pago

### Takeaway
Toast separa explícitamente aplicar (al tomar la orden) de confirmar (al iniciar el pago) y acreditar (después del pago); Square parece descontar puntos al agregar al carrito, y eso genera un bug documentado de puntos perdidos.

### Cited Findings
- Toast: la recompensa se aplica a la cuenta inmediatamente al elegirla; "cuando empieza el proceso de pago, Toast envía un `LOYALTY_REDEEM` para confirmar el canje"; la acumulación (Accrue) se envía después de completar el pago — [Toast dev guide](https://doc.toasttab.com/doc/devguide/apiLoyaltyPosWorkflow.html)
- Square (comunidad, 26/05/2023): si el cajero usa "clear cart" con un canje en el carrito, "los puntos desaparecen"; si primero quita el canje y después limpia, los puntos sí se restituyen. Un Square Champion (no empleado) lo calificó de "definitivamente un bug"; sin respuesta oficial — [Square Community](https://community.squareup.com/t5/Customer-Engagement/loyalty-points-not-reinstated-when-cart-cleare/m-p/662289)
- Square: una recompensa no puede aplicarse a más de una venta aunque no se consuma entera (se quema con la venta) — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)

### Inferences
- Diseño recomendable que se deduce: **reservar** el cupón al aplicarlo a la orden (reversible al quitar/cancelar la sesión) y **consumirlo** solo al confirmar la venta. Quemar en el momento de aplicar produce exactamente el bug de Square.
- No encontré en ninguna fuente una distinción formal "2x1/ítem gratis al ordenar" vs "% al pagar"; en la práctica todo se aplica en la orden antes de pagar, y lo que cambia es si es descuento de ítem (exige el ítem) o de orden.

### Gaps
- Comportamiento de devoluciones/void (¿se restituye el cupón?) no documentado en las páginas leídas de Toast ni Square.

## 5. Plataformas SIN integración POS (app/tablet standalone)

### Takeaway
Las standalone resuelven el canje como escaneo + toggle de recompensa + submit, sin monto, con confirmación opcional y registro en dashboard; la elección y el monto quedan fuera del sistema.

### Cited Findings
- Loopy: "no POS integration required"; escaneo con cámara del teléfono, sellos y canje en una acción — [Loopy Stamper](https://loopyloyalty.com/features/stamper-app/); [App Store](https://apps.apple.com/us/app/loopy-loyalty-stamper/id945301614)
- Loopy: login del staff con Face ID/Touch ID o sesión persistente en dispositivo de un solo usuario; registra GPS del dispositivo que sella — [Loopy docs](https://docs.loopyloyalty.com/en/articles/10502182-using-the-ios-stamper-app)
- Stamp Me: canje presentando voucher en la app del cliente (3 min) o StampPod/Stamp Tag NFC en el mostrador para sellar — [Stamp Me misuse](https://help.stampme.com/en/articles/6204197-how-to-prevent-misuse-with-stamping-and-reward-redemptions)
- Fivestars: tablet propia de cara al cliente + POS — [SumUp Connect](https://help.sumup.com/en-US/sections/RqPe3XHxJvRKsH8POwjI0-sumup-connect)

### Inferences
- Ninguna standalone documentada calcula "cuánto cobrar". CheckPass ya registra la venta (carrito/monto) en el mostrador, así que puede ofrecer el modelo A (descuento en la venta) sin POS: sería una diferenciación frente a Loopy/Stamp Me, siempre que se deje claro que el cobro real lo hace la caja del comercio con el monto mostrado.

### Gaps
- Belly (tablet iPad en mostrador, histórico) y Perkville no investigados.

## 6. Antifraude

### Takeaway
Las medidas documentadas apuntan a capturas de pantalla (voucher animado temporizado), cuentas duplicadas (OTP), sellado abusivo (delays, códigos de un uso, NFC) y abuso del staff (auditoría, GPS, confirmación).

### Cited Findings
- Stamp Me: voucher animado con cuenta regresiva, fecha y hora y "party poppers" para probar que está "vivo" y no es captura; se instruye al staff a no aceptar imágenes estáticas — [Stamp Me misuse](https://help.stampme.com/en/articles/6204197-how-to-prevent-misuse-with-stamping-and-reward-redemptions)
- Stamp Me: validación OTP por teléfono; si hay varias cuentas en el mismo dispositivo, los vouchers de las cuentas extra se deshabilitan — [Stamp Me misuse](https://help.stampme.com/en/articles/6204197-how-to-prevent-misuse-with-stamping-and-reward-redemptions)
- Stamp Me: delay configurable entre sellos; "OneStamps" de un solo uso; rotar códigos; restringir acceso al portal; avisar al staff que la actividad se rastrea — [Stamp Me misuse](https://help.stampme.com/en/articles/6204197-how-to-prevent-misuse-with-stamping-and-reward-redemptions)
- Loopy: "Confirm Transaction" antes de aplicar; verificación de autenticidad de la tarjeta al escanear; GPS del dispositivo sellador; historial de auditoría — [Loopy docs](https://docs.loopyloyalty.com/en/articles/10502182-using-the-ios-stamper-app); [Loopy Stamper](https://loopyloyalty.com/features/stamper-app/)
- Square: recompensa no reutilizable en otra venta aunque quede saldo — [Square help 5522](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases)

### Inferences
- El modelo de CheckPass (el comercio escanea el QR del pase, el canje lo ejecuta el servidor) ya neutraliza la captura de pantalla de un voucher; el riesgo remanente es el abuso del staff (canjear cupones de un cliente sin venta), que se mitiga atando el canje a una venta registrada y a un usuario de staff auditado.

### Gaps
- Sin fuentes sobre límites por staff, PIN de gerente para canjes, ni QR dinámicos/rotativos en Wallet en estas plataformas.

## 7. Quejas y dolores de comerciantes

### Takeaway
Lo documentado son bugs de consistencia entre canje y venta (puntos perdidos al limpiar carrito, descuento visible pero no cobrado, pantalla de canje que no aparece); no obtuve reseñas G2/Capterra.

### Cited Findings
- Square: puntos perdidos al usar "clear cart" con canje en el carrito (2023) — [Square Community](https://community.squareup.com/t5/Customer-Engagement/loyalty-points-not-reinstated-when-cart-cleare/m-p/662289)
- Square (comunidad, resumido por buscador): un comerciante reportó que el descuento aparecía en la pantalla pero al procesar el pago se cobró el precio completo; clientes que no veían la pantalla de canje teniendo puntos; la pantalla de auto-canje dejaba de funcionar si la pantalla de recibo estaba deshabilitada; canje disponible en tienda pero no online — [Loyalty Program Not Redeeming Rewards](https://community.squareup.com/t5/Payments-Troubleshooting/Loyalty-Program-Not-Redeeming-Rewards/td-p/794839); [Customers cant redeem rewards](https://community.squareup.com/t5/Payments-Troubleshooting/Customers-cant-redeem-rewards/m-p/647688); [Loyalty reward not showing](https://community.squareup.com/t5/Orders-Menu-Items-Catalog/Loyalty-reward-not-showing-for-customers/m-p/192694) (no abrí cada hilo; atribución exacta hilo↔queja no verificada)
- Square Community: comerciante pidiendo que el CLIENTE pueda ingresar el código de cupón en el POS — [Need CUSTOMER To Apply Coupon Code On POS](https://community.squareup.com/t5/Payments-Troubleshooting/Need-CUSTOMER-To-Apply-Coupon-Code-On-POS-Here-s-Why/m-p/790293) (solo título visto)
- Square Community: pedido de cupones de un solo uso en el POS — [One Time Use Coupon/Discount in Square POS](https://community.squareup.com/t5/Payments-Troubleshooting/One-Time-Use-Coupon-Discount-in-Square-POS/m-p/741121/highlight/true) (solo título visto)

### Inferences
- Los dolores recurrentes son de **estado intermedio** (canje aplicado pero venta no cerrada/cobrada); refuerza el diseño reservar→consumir con reversión automática al cancelar la sesión.

### Gaps
- No se leyeron reseñas de G2/Capterra/App Store ni Reddit (r/smallbusiness, r/restaurateur) por presupuesto; no hay quejas con fuente sobre Loopy, Stamp Me, Toast o Fivestars.
