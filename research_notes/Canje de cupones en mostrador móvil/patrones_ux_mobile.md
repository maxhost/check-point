# Patrones UX mobile para canje de cupones en mostrador (dos telefonos: cliente + staff)

Nota de metodo: ~17 llamadas de busqueda/lectura. Fuentes primarias priorizadas (Apple PassKit, Google Wallet, Square, Shopify, Baymard, NN/g). No encontre investigacion publicada (NN/g, Baymard o academica) especifica sobre la transaccion "dos telefonos cara a cara" para cupones; lo que sigue combina docs de plataforma, practica de POS lideres y benchmarks de e-commerce transferibles. Lo transferido se marca como inferencia.

## (a) Como el cliente elige el cupon y se lo comunica al staff (codificacion de la eleccion; Wallet vs PWA)

### Takeaway
Las plataformas de Wallet muestran UN codigo por pase (el primero soportado), cuyo uso recomendado es un ID que apunta al servidor; la eleccion del cupon no puede vivir dentro de Apple Wallet. Los referentes del mercado (Starbucks, Square) resuelven esto separando "identificar al cliente" (escanear su codigo) de "elegir el beneficio" (lo dice el cliente o lo elige el staff de una lista), y ofrecen codigo manual / codigo de cupon como respaldo.

### Cited Findings
- Apple: "PassKit displays the first supported barcode in this array" — el array `barcodes` es de formatos alternativos/fallback, no de multiples codigos seleccionables. — [Apple Wallet Developer Guide: Pass Design and Creation](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- Apple: el `altText` opcional se renderiza cerca del codigo "y contiene un codigo para ingresar manualmente si el barcode no se puede escanear" (patron de codigo corto de respaldo). — [Apple PassKit Creating](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- El uso mas comun del barcode de un pase es un ID unico que apunta a registros del servidor, lo que permite "actualizar un saldo, anular un cupon o confirmar que un ticket es valido". — [Apple Wallet Developer Guide (via resultado de busqueda, doc Creating)](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- Apple: cualquier campo del pase se puede actualizar via push + web service salvo el authentication token y el serial number; las pushes "no estan garantizadas" y se coalescen. — [Apple: Updating a Pass](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html)
- Apple: tipos relevantes: Store Card (loyalty) y Coupon (ofertas de un uso). En coupon/storeCard con codigo cuadrado, campos secundarios+auxiliares comparten un limite de 4. — [WalletWallet: Anatomy of an Apple Wallet Pass](https://www.walletwallet.dev/blog/anatomy-of-an-apple-wallet-pass/) (fuente secundaria)
- Apple: los cupones solo soportan relevancia por ubicacion; `relevantDate` "Not supported" para coupon. — [Apple PassKit Creating](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- NFC en Apple Wallet requiere un entitlement aprobado por Apple caso por caso y lectores compatibles con Apple VAS — no lo puede leer un telefono comun de staff via web. — [Passcreator: NFC passes](https://www.passcreator.com/en/blog/what-you-need-to-know-about-nfc-passes-in-apple-and-google-wallet); [Apple Developer Forums VAS](https://developer.apple.com/forums/thread/773982)
- Google Wallet Offers: redencion por NFC (Smart Tap, requiere alta aparte de comercio y terminal certificada) o barcode; tipos: barcode estatico, `rotatingBarcode` (cambia "tipicamente cada minuto") y animacion de seguridad `FOIL_SHIMMER`. — [Google Wallet: Redeem an Offer](https://developers.google.com/wallet/retail/offers/use-cases/redemption-methods)
- Google prioriza Smart Tap > rotating barcode > static barcode segun capacidades del dispositivo; `smartTapRedemptionValue` requiere `enableSmartTap` y `redemptionIssuers` a nivel clase. — [Google Wallet REST offerobject](https://developers.google.com/wallet/reference/rest/v1/offerobject) (resumen de busqueda)
- Starbucks: el cliente escanea su cuenta en la app y "le dice al barista el nombre del reward que quiere canjear"; alternativa: mostrar la pantalla del reward antes de que cobren, y el barista escanea o lo carga manualmente. — [Starbucks Rewards FAQ (AE)](https://www.starbucks.ae/en/starbucks-rewards-faqs) (resumen de busqueda; no verificado contra el FAQ de EE.UU.)
- Square: el staff aplica cupones por (1) "Use Code" con el codigo que da el cliente, (2) perfil del cliente con sus cupones disponibles, (3) seleccion manual de esa lista. — [Square: Apply coupons and rewards](https://squareup.com/help/us/en/article/5522-apply-rewards-to-purchases)
- Square: si el cliente paga con tarjeta vinculada a su cuenta, ve una pantalla de canje en el checkout para elegir entre sus rewards disponibles (seleccion del lado cliente, pero en la terminal del comercio). — [Square: Apply coupons and rewards](https://squareup.com/help/gb/en/article/5522-apply-rewards-to-purchases) (resumen de busqueda)
- Escaneo inverso: algunas plataformas (BonusQR) usan que el cliente escanee un QR del comercio (tablet/staff) y un PIN de comercio o QR con limite de tiempo para validar; argumentan que impide autoemitir recompensas. — [BonusQR](https://bonusqr.com/) (fuente de vendedor, sin datos)
- Shopify POS (v11.5+) escanea QR de descuento con camara o lector y "el descuento se aplica automaticamente al carrito cuando el QR es valido" — antecedente de QR-por-cupon. — [Shopify Help: Applying discounts](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/discount-management/applying-discounts)

### Inferences
- Para el pase de Wallet (estatico/semiestatico) el patron robusto es: QR = identidad del cliente; la eleccion se hace del lado staff (lista de cupones del cliente) o del lado cliente en la PWA. Cambiar el barcode del pase por push para "seleccionar" un cupon es fragil (push no garantizada, coalescida).
- Opciones para que la eleccion del cliente viaje al staff, de menos a mas friccion: (1) verbal + el staff ve la lista del cliente tras escanear (modelo Starbucks/Square); (2) PWA con QR por cupon o QR dinamico "cliente+cupon" (modelo Shopify QR de descuento); (3) codigo numerico corto en pantalla (altText/“Use Code” de Square) como fallback ante camara o luz mala; (4) escaneo inverso (cliente escanea QR del comercio) — util sin camara de staff, pero traslada la confirmacion al cliente y requiere un paso de staff (PIN) para no permitir autocanje.
- NFC/Smart Tap queda fuera de alcance para un mostrador web en telefono comun (entitlement Apple + terminal certificada).

### Gaps
- No encontre datos medidos (tiempo por transaccion, tasa de error) comparando QR por cupon vs lista del lado staff vs escaneo inverso.
- No verifique limites concretos de frecuencia de actualizacion de pases Apple (Apple no documenta rate limit explicito en la guia leida).
- No confirme si Google Wallet rotating barcode funciona offline en el telefono del cliente (la doc leida no lo dice).

## (b) Como el staff valida y aplica sin cerrar la sesion (flujo de mostrador)

### Takeaway
Los POS lideres tratan al cupon como un ajuste del carrito abierto (linea o nivel orden), visible y removible antes del cobro, y avisan proactivamente al staff cuando el cliente identificado tiene recompensas disponibles. El orden canonico es: identificar cliente → armar carrito → aplicar beneficio → cobrar → registrar.

### Cited Findings
- Square: si el cliente esta agregado a la venta y tiene puntos suficientes, aparece "Reward Available" en la venta actual antes de finalizar; se toca y se elige el reward. — [Square Loyalty: apply rewards (resumen de busqueda)](https://squareup.com/help/us/en/article/8411-apply-loyalty-rewards-to-a-sale)
- Square: los cupones aplicados se ven y se quitan desde la pantalla de pago ("Add discount" muestra los aplicados o los remueve) — undo antes de cobrar. — [Square: Apply coupons and rewards](https://squareup.com/help/us/en/article/5522-apply-rewards-to-purchases)
- Square: "A single reward cannot be applied to more than one sale, even if the full reward isn't redeemed." — [Square: Apply coupons and rewards](https://squareup.com/help/us/en/article/5522-apply-rewards-to-purchases)
- Shopify POS: descuentos de linea y de carrito; el descuento de carrito "cambia el total mostrado en el carrito"; se remueven desde "Manage discounts". — [Shopify Help: Applying discounts](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/discount-management/applying-discounts)
- Shopify POS: un codigo solo aplica si "los items del carrito cumplen los requisitos del codigo". — [Shopify Help: Applying discounts](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/discount-management/applying-discounts)
- Square Orders API: los descuentos de nivel orden se aplican como ajustes de precio prorrateados entre las lineas. — [Square Orders API: Discounts](https://developer.squareup.com/docs/orders-api/discounts)
- NN/g: objetivos tactiles minimos ~1cm x 1cm; mas grandes para CTA primarios y para contextos de uso en movimiento/con error. — [NN/g: Touch Targets on Touchscreens](https://www.nngroup.com/articles/touch-target-size/)
- Guias de "thumb zone" recomiendan acciones clave en el tercio inferior para uso a una mano. — [Parachute Design: Thumb Zone](https://parachutedesign.ca/blog/thumb-zone-ux/) (fuente secundaria, no NN/g)

### Inferences
- En CheckPass: escaneo del QR abre una sesion de venta "abierta" que contiene cliente + carrito/monto + beneficios; el canje es una accion dentro de esa sesion, no un flujo aparte que cierra y reabre (modelo Square "Reward Available" sobre la venta actual).
- Cupones de momento de pedido (2x1, producto gratis) se aplican al armar el carrito como linea; los de momento de pago (10%) al final sobre el total — coincide con la separacion linea/orden de Square y Shopify.
- El canje se confirma (consume) atomicamente junto con el registro de la venta, no al tocar "aplicar": asi el undo antes de cobrar es trivial y no hay cupones "quemados" por error (inferido de que Square/Shopify permiten quitar descuentos hasta el pago).
- Boton primario (Cobrar/Registrar) fijo abajo, ≥1cm, con los chips de beneficios aplicados justo encima.

### Gaps
- No hay estudios publicados de tiempo/errores en mostradores mobile con cola; recomendaciones de glanceability son inferidas.

## (c) Como mostrar el efecto sobre el total

### Takeaway
La evidencia de e-commerce (Baymard) y la practica POS convergen: aplicar automaticamente lo que corresponde, mostrar explicitamente el descuento aplicado y el precio original junto al nuevo, y resaltar visualmente el cambio para que se entienda que lo causo.

### Cited Findings
- Baymard: 83% de los sitios no aplica automaticamente descuentos/promos; participantes perciben como "customer-focused and trustworthy" a los que si; recomendacion: aplicar automaticamente el mejor promo para el que califica y mostrarlo claramente en el carrito. — [Baymard: 10 Sales UX Best Practices](https://baymard.com/blog/10-sales-ux-best-practices)
- Baymard: debe haber resaltado visual cuando un codigo aplicado cambia precio, para aclarar que cambio y por que. — [Baymard: Avoid Apply Buttons (resumen de busqueda)](https://baymard.com/blog/checkout-usability-apply-buttons)
- Baymard: un campo de cupon visible hace que usuarios sin cupon se detengan o salgan a "cazar" cupones; 70% de sitios tiene campo de promo; recomendacion de ocultarlo tras un link. — [Baymard (resumen de busqueda)](https://baymard.com/blog/checkout-flow-average-form-fields)
- Shopify POS: con descuento aplicado, "el valor regular del producto se muestra debajo del precio descontado". — [Shopify Help: Applying discounts](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/discount-management/applying-discounts)
- Square: orden de calculo: % de item → % de orden → monto fijo de orden → monto fijo de item; advierte que el fijo de orden puede reducir el precio del item antes del fijo de item. — [Square Orders API: Discounts](https://developer.squareup.com/docs/orders-api/discounts)
- Shopify: al combinar, el descuento monetario de linea se aplica antes del % de carrito (ej. $5 de linea antes del 10%). — [Shopify Help: Applying discounts](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/discount-management/applying-discounts)

### Inferences
- Sin integracion POS, la pantalla del staff debe terminar en UN numero grande "Cobrar $X" con desglose plegable: subtotal, cada beneficio como linea negativa nombrada, total. Square y Shopify ordenan distinto los descuentos combinados: CheckPass debe fijar y documentar un orden propio y mostrarlo.
- Beneficios no monetarios (sellos/puntos extra, texto libre) no cambian el total: mostrarlos como chip separado ("+2 sellos") para no confundir el monto a cobrar.
- Inferido de Baymard: del lado cliente, no mostrar un "campo de codigo"; mostrar la lista de cupones ya tenidos.

### Gaps
- Baymard es e-commerce de escritorio/mobile, no mostrador; transferencia al contexto presencial es inferencia.

## (d) Multiples cupones, stacking, reglas de elegibilidad y timing; anti-fraude; errores

### Takeaway
Los POS permiten varios beneficios de distinto tipo por venta pero cada beneficio una sola vez; la elegibilidad se evalua contra el carrito. Contra fraude, la defensa principal es que el codigo sea un puntero a estado del servidor (anulable) y, cuando hace falta, codigos rotativos (TOTP) contra capturas de pantalla.

### Cited Findings
- Square: "Multiple rewards of different types can be applied at the same time" (ej. % + monto en una venta). — [Square: Apply coupons and rewards](https://squareup.com/help/us/en/article/5522-apply-rewards-to-purchases)
- Shopify: combinaciones permitidas: % en linea/carrito/ambos, monto en linea/carrito/ambos, y linea+carrito. — [Shopify Help: Applying discounts](https://help.shopify.com/en/manual/sell-in-person/shopify-pos/discount-management/applying-discounts)
- Square: pricing rules con `auto_apply_discounts`: toda orden con un item de catalogo que matchea la regla se descuenta automaticamente (elegibilidad por item). — [Square Orders API: Discounts](https://developer.squareup.com/docs/orders-api/discounts)
- Square: item-level discounts en el POS solo pueden ser %, no montos fijos (limitacion reportada por la comunidad). — [Square Community](https://community.squareup.com/t5/Payments-Troubleshooting/Applying-a-discount-to-one-item-on-a-ticket-and-not-the-rest/m-p/749007) (resumen de busqueda; foro)
- Google Wallet: rotating barcodes cambian periodicamente; el lector "solo acepta el mas reciente", lo que reduce riesgo de capturas de pantalla; algoritmo TOTP_SHA1, `periodMillis` configurable (ejemplo 3000 ms), `valuePattern` con `{totp_timestamp_seconds}` y `{totp_value_0}`; recomiendan secreto OTP por pase. — [Google Wallet: Rotating Barcodes (Offers)](https://developers.google.com/wallet/retail/offers/resources/rotating-barcodes); [Rotating Barcodes (Loyalty)](https://developers.google.com/wallet/retail/loyalty-cards/resources/rotating-barcodes)
- Google Wallet: `class.viewUnlockRequirement` puede exigir desbloqueo del telefono para ver el pase. — [Google Wallet: Redeem an Offer](https://developers.google.com/wallet/retail/offers/use-cases/redemption-methods)
- Apple: el barcode no puede modificarse localmente, por eso es "inapropiado para cupones de un uso" cuando el dato vive en el codigo — el estado debe vivir en el servidor. — [Apple PassKit Creating](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html)
- Apple: cambios de campo con `changeMessage` muestran notificacion al usuario cuando el pase se actualiza (via de "recibo" de canje en Wallet). — [Apple: Updating a Pass](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html)
- Plataformas de loyalty QR usan PIN de comercio y QR con tiempo limitado para evitar autoemision y doble sellado; roles de staff limitados (escanean pero no ven lista de clientes). — [BonusQR Staff Access Control](https://bonusqr.com/loyalty-feature/staff-access-control) (vendedor)

### Inferences
- Elegibilidad: tras escanear, el staff deberia ver los cupones del cliente ordenados "aplica ahora" (cumple regla con el carrito actual) / "falta X" (ej. "agrega un latte") / "no aplica hoy" — es la version mostrador del "Reward Available" de Square y del auto-apply de Baymard.
- Stacking: regla por defecto conservadora y explicita (ej. un descuento monetario por venta + beneficios no monetarios ilimitados), comunicada en el chip; Square/Shopify muestran que permitir distintos tipos es estandar, pero sin integracion POS un orden de calculo claro es mas importante que la flexibilidad.
- Timing: cupones "al pedir" (2x1/gratis) se sugieren al agregar items; "al pagar" (%) en el paso final — ambos en la misma sesion.
- Anti-fraude para CheckPass: codigo = ID opaco del cliente, canje = transaccion idempotente en servidor (clave de idempotencia por sesion de venta), un cupon solo se consume una vez (Square). Una captura del QR estatico solo identifica al cliente; no canjea nada sin la sesion del staff. QR rotativo en la PWA (TOTP) si se decide permitir canje iniciado por el cliente.
- Recibo: push/changeMessage al pase y estado "Usado" en la PWA tras el canje confirma al cliente sin que tenga que mirar la pantalla del staff.
- Errores: estados explicitos en el telefono del staff — "Vencido el dd/mm", "No aplica: requiere latte en el carrito" (con accion para agregarlo), "Ya usado hoy a las HH:MM en [sucursal]", "Sin conexion: no se puede validar" (no permitir canje offline si el estado vive en servidor).

### Gaps
- No encontre fuentes que midan fraude por capturas de QR en loyalty de pequeños comercios.
- No encontre guias de accesibilidad especificas (lectores de pantalla, contraste bajo luz de local) para pantallas de canje; solo tamaño de objetivo tactil (NN/g).
- No verifique el funcionamiento offline de la PWA ni de rotating barcodes de Google sin red.
