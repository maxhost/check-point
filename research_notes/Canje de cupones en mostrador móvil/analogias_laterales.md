# Analogías laterales: canje de derechos (entitlements) cara a cara, en el celular, en otras industrias

Problema de fondo: un cliente tiene VARIOS derechos (cupones) en un mismo comercio; tiene que presentar el correcto, el personal tiene que validarlo y aplicarlo a una transacción concreta, ambos con celular, sin POS. Hoy en CheckPass: el cupón no afecta el monto, no se ata a la orden, el comercio ve uno solo, el cliente no elige, y la acción cierra la sesión. Hay cupones de "momento de pedido" (2x1) y de "momento de pago" (10%).

Nota de método: ~19 búsquedas/lecturas. Cada hecho lleva fuente. Las extrapolaciones a CheckPass son inferencias mías (sección Inferences) y no están medidas. Mecanismos que el encargo sugería pero que no pude sostener con fuente quedan en Gaps.

## P1. Redención invisible: ¿se puede eliminar el paso del mostrador?

### Takeaway
En card-linked offers (Amex Offers) y en billeteras (Alipay+, Mercado Pago QR) el cupón se "activa" antes y se aplica solo cuando ocurre el pago que cumple la condición: el personal no valida nada. El costo es que el sistema necesita ver el pago (o el monto); CheckPass ya ve el monto porque el comercio lo registra, así que puede imitar la mitad "auto-aplicar" sin necesitar integración bancaria.

### Cited Findings
- Amex Offers: el titular debe "agregar" la oferta a su tarjeta ANTES de comprar; la oferta no se aplica automáticamente sin ese paso; luego hace la compra calificante en el comercio — [American Express / guía](https://upgradedpoints.com/credit-cards/amex-offers/); [Amex FAQ](https://www.americanexpress.com/us/customer-service/faq.amex-offers.html)
- El beneficio llega como crédito en el resumen (línea aparte) después de que la compra se registra, hasta 90 días después — [Amex Offers](https://www.americanexpress.com/en-us/benefits/offers/); [upgradedpoints](https://upgradedpoints.com/credit-cards/amex-offers/)
- Amex limita a una inscripción por persona por oferta aunque tenga varias tarjetas; la oferta se apila sobre la acumulación base de puntos — [joinkudos](https://www.joinkudos.com/blog/can-you-add-the-same-amex-offer-to-multiple-cards-what-to-do-instead); [upgradedpoints](https://upgradedpoints.com/credit-cards/amex-offers/)
- Alipay+: los descuentos de checkout se aplican automáticamente cuando el cliente paga; los cupones obtenidos vía QR promocional quedan guardados en "Reward" y se aplican cuando se cumple la condición de pago — [Alipay+ payment marketing](https://www.alipayplus.com/payment-marketing/); [PayXpert](https://blog.payxpert.com/use-alipay-wechat-promotional-material/)
- Mercado Pago (Argentina/LatAm): pagando con QR en caja (ej. Carrefour) el descuento se aplica automáticamente al confirmar el pago; los cupones se asocian antes desde la sección "Beneficios"/"Ahorrá con Mercado Pago" — [descuentazo.com.ar / agregadores](https://descuentazo.com.ar/bancos/mercado-pago-64); [mipc.com.mx](https://mipc.com.mx/codigos-mercadopago) (fuentes agregadoras, no documentación oficial)

### Inferences
- **Mecanismo 1 — "Cargar la oferta en el pase" (Amex Offers).** El cliente "activa"/"guarda" en su pase uno o varios cupones antes de llegar (o en la fila). Cuando el comercio registra la venta, el motor evalúa los cupones activados del cliente contra el carrito/monto y los aplica solo; el mostrador solo ve el resultado ("se aplicó 10%: $1.200 → $1.080"). Resuelve "el cliente no puede elegir" (eligió antes, con calma) y "no afecta el monto".
- **Mecanismo 2 — "Descuento en la pantalla de cobro" (Alipay/Mercado Pago QR).** El descuento se resuelve en el momento en que se fija el monto, no en un paso separado de "canjear cupón". Para CheckPass: el cupón de momento-de-pago debería vivir dentro del paso "cobrar" (monto bruto → descuentos → monto neto), no como acción terminal aparte.
- El crédito diferido de Amex sugiere una variante para cupones que el comercio no quiere/puede aplicar al precio: "beneficio post-compra" (ej. sellos/puntos extra que se acreditan después de registrar la venta), que no exige que el cajero haga nada.
- Riesgo: la aplicación invisible saca al personal del circuito; en un café chico, el personal puede querer VER que se aplicó algo para entregar el producto gratis. Para 2x1/producto gratis la redención invisible no alcanza: hay un bien físico que entregar.

### Gaps
- No encontré documentación oficial de cómo Alipay/WeChat eligen automáticamente "el mejor" cupón cuando varios aplican (la fuente de Alipay+ no lo detalla).
- No verifiqué Cardlytics, Ualá ni Nubank específicamente; no hay hallazgos citables sobre ellos en estas notas.

## P2. Verificación por el comercio: el patrón chino 核销 (hexiao) y el "swipe to redeem"

### Takeaway
Meituan/Dianping separan compra y verificación: el cliente compra un voucher, recibe un código, y el comercio lo "quema" (核销) escaneando el QR o tipeando el número en una app de comercio dedicada que guarda historial. El patrón opuesto (Fave, Entertainment) hace que el CLIENTE ejecute el canje deslizando en su propio teléfono delante del empleado, que es testigo.

### Cited Findings
- Meituan Merchant (app de comercio): "Input coupon number to verify", "Scan coupon QR code to verify", "View verification records" — [App Store, Meituan Merchant](https://apps.apple.com/us/app/meituan-merchant/id1327175580)
- Desde el lado del cliente: compra el voucher, recibe un código y lo muestra en el local antes de que venza — [Trip.com guía Meituan](https://in.trip.com/guide/info/meituan-app.html)
- Meituan expone una API para que el comercio integre la verificación de cupones de compra grupal, consultar cupones usados y gestionar registros de verificación — [Context7 / Meituan developer API](https://context7.com/websites/developer_meituan_api)
- Fave (Malasia/Singapur): en el local el cliente muestra el voucher al personal y "desliza para canjear"; si el partner tiene varias sucursales, el cliente debe elegir la sucursal correcta al deslizar — [Fave help center (vía resultado de búsqueda; la página devolvió 403 al leerla)](https://help.myfave.com/hc/en-us/articles/222096267-How-do-I-redeem-my-voucher)
- Entertainment® (cuponera móvil) ofrece herramientas para que el comercio entrene al personal en el canje desde el móvil — [Entertainment Merchant Tools](https://toolbox.entertainment.com/downloads/)
- Student Beans: el estudiante muestra su iD digital (con foto y un temporizador de verificación) al personal; según la marca puede incluir QR/código de barras o código único, y algunas tiendas escanean un QR desde la pantalla de la app — [Student Beans Help](https://help.studentbeans.com/hc/en-us/articles/360004824400-How-do-I-redeem-in-store); el sitio para marcas solo dice que el SBiD "no puede falsificarse como los carnets plásticos" y que cada marca tiene "su propia pantalla de descuento" en la app, sin detallar mecánica — [Student Beans Business](https://partner.studentbeans.com/verification/self-service/in-store/)

### Inferences
- **Mecanismo 3 — 核销 con "bandeja de verificación".** En Meituan el voucher es una unidad discreta que se compra, se muestra y se quema; el comercio tiene un historial de verificaciones. Para CheckPass: cada cupón es un objeto con estado (disponible → reservado en orden → quemado) y el comercio puede ver "cupones quemados hoy" como auditoría. Resuelve el "no atado a la orden": el quemado referencia la venta.
- **Mecanismo 4 — "Swipe to redeem" con testigo (Fave/Entertainment).** El cliente elige y quema el cupón en SU teléfono frente al empleado; el empleado solo mira una pantalla de confirmación grande. Invierte quién elige (el cliente, que es quien conoce sus cupones) y ahorra que el empleado navegue una lista. Ideal para cupones de momento-de-pedido (2x1, producto gratis) en cafés sin caja formal. Debilidad: sin atarlo a una venta, no mueve el monto; necesita combinarse con el registro de la venta del comercio.
- **Mecanismo 5 — Pantalla de prueba "viva" (Student Beans: foto + temporizador).** Lo que el empleado necesita no es escanear sino confiar en 2 segundos: una pantalla con elementos que una captura no reproduce (hora corriendo, animación, nombre del comercio). Para CheckPass: la pantalla del cupón en el pase/PWA muestra el nombre del comercio actual, hora en vivo y un color del día, para que el canje "a ojo" (sin escanear) sea plausible en el pico de la mañana.
- La elección de sucursal en Fave al deslizar es un detalle trasladable: el canje se ata a un local concreto (multi-sucursal).

### Gaps
- No encontré en inglés un análisis detallado del flujo de UX 核销 (pantallas, tiempos, qué ve el cajero), solo la descripción de la app y la API.
- No pude leer el artículo de Fave (403); la descripción viene del snippet del buscador.
- No encontré fuente para "animación anti-captura" de UNiDAYS/Student Beans; solo "foto + temporizador".

## P3. Anti-fraude sin conectividad: códigos rotativos

### Takeaway
SafeTix de Ticketmaster no usa magia: es TOTP (el mismo estándar que los códigos 2FA) con rotación de 15 s y validable offline; la animación es CSS y no impide escanear una captura. La lección es que la seguridad está en el código que cambia, no en la animación.

### Cited Findings
- SafeTix: código de barras cifrado y rotativo atado a una cuenta de fan verificada; las capturas quedan inútiles — [Ticketmaster Business](https://business.ticketmaster.com/solutions/event-day/); [TechCrunch 2019](https://techcrunch.com/2019/05/16/ticketmaster-put-an-end-to-screenshots-with-new-digital-ticket-technology/)
- Ingeniería inversa: el código (PDF417) contiene un token portador estático + TOTP de evento + TOTP de cliente + timestamp; TOTP SHA-1 con paso de 15 s; validable sin conexión en tiempo real; el token sirve ~20 h antes de requerir refresco del servidor; la barra azul animada es solo CSS — [conduition.io](https://conduition.io/coding/ticketmaster/)
- Las fuentes divergen en el intervalo: "cada 15-30 s" en una guía secundaria vs 15 s medidos en la ingeniería inversa — [barcodeticket.com](https://barcodeticket.com/guides/concert-and-event-ticket-barcodes/) vs [conduition.io](https://conduition.io/coding/ticketmaster/)

### Inferences
- **Mecanismo 6 — QR rotativo por TOTP en el pase.** El QR del pase podría llevar un TOTP con paso corto: escanear una captura vieja falla. Relevante si el fraude por compartir capturas de cupones de alto valor (producto gratis) es un problema real. Limitación a verificar: un pase en Apple/Google Wallet no ejecuta código para rotar el QR por sí solo (la fuente neatpass discute rotación en Wallet pero no la leí) — esto aplicaría solo a la PWA.
- La animación sola (sin rotación) es teatro de seguridad: si se usa, que sea para la confianza "a ojo" del empleado (Mecanismo 5), no como control.

### Gaps
- No verifiqué si Apple/Google Wallet permiten QR rotativo en pases de terceros ([neatpass](https://neatpass.app/learn/event-ticket-rotating-qr-apple-wallet) parece tratarlo; no lo leí).

## P4. Orden abierta y momento de aplicación: tabs, comps, capping

### Takeaway
Tres industrias resuelven "aplicar el beneficio en el momento correcto" con una cuenta que vive abierta y se liquida al final: el bar tab (abrir con preautorización, sumar, cerrar), los comps de casino (los puntos se aplican a la cuenta del restaurante al pasar la tarjeta) y el fare capping de transporte (el sistema calcula el mejor precio al final del día sin que el pasajero elija).

### Cited Findings
- Bar tab: se abre con datos y tarjeta del cliente; preautorización que retiene fondos sin cobrar; se suman pedidos durante la noche; al cerrar se captura el total final y se libera lo no usado — [WebstaurantStore](https://www.webstaurantstore.com/blog/3660/bar-tabs-and-preauthorization.html); [Bonsai POS](https://www.bonsaipos.com/bar-tabs-and-card-pre-authorisation-holds-walkouts-and-closing-out-at-last-call/)
- Casinos: Boomtown Reno — "pasá tu Player's Card en cualquier punto de venta para canjear tus comps"; Players Casino — cada punto vale US$1 para comida y bebida; Golden Nugget distingue "Comp Dollars" (restaurante, hotel, spa) de "Slot Points" (juego) — [Boomtown](https://www.boomtownreno.com/players-club); [Players Casino](https://www.pcventura.com/players-reward-card/); [Golden Nugget](https://www.goldennugget.com/laughlin/casino/24k-select-club/)
- TfL: el sistema totaliza los viajes y deja de cobrar al llegar al tope diario (equivalente a un Day Travelcard); con contactless hay tope semanal lunes-domingo; el cobro real es un único monto agregado de madrugada; en metro se hace tap-in y tap-out para calcular la tarifa — [londontoolkit](https://www.londontoolkit.com/card/contactless-cards-and-apple-pay/); [findingtheuniverse](https://www.findingtheuniverse.com/pay-public-transport-london-oyster-contactless-best/)
- Starbucks: el cliente avisa al barista ANTES de pedir que va a canjear, y luego escanea el QR de la app para pagar; las recompensas tienen niveles (25/100/200/300 estrellas) — [Barista HQ](https://baristahq.com/how-to-redeem-starbucks-stars/); [Krazy Coupon Lady](https://thekrazycouponlady.com/tips/money/starbucks-rewards-program)

### Inferences
- **Mecanismo 7 — "Abrir cuenta" con el escaneo (bar tab).** Escanear el QR del cliente NO debería ser la acción final, sino abrir una "cuenta" (orden) del cliente en el mostrador. Mientras está abierta se le agregan productos y cupones; se cierra al cobrar. Resuelve directamente "la acción termina la sesión" y "cupón no atado a la orden": el cupón de pedido (2x1) se aplica al abrir/agregar el ítem, el de pago (10%) al cerrar. El 2x1 y el 10% conviven porque viven en la misma cuenta en momentos distintos.
- **Mecanismo 8 — Comp aplicado como forma de pago (casino).** Los comps se tratan como una "moneda" que paga parte de la cuenta, no como modificación del precio. Para cupones de monto fijo ($500 off) y puntos: modelarlos como un "medio de pago" más en el cierre (split tender), lo que hace natural combinarlos con efectivo/MP y deja trazado cuánto pagó el cupón. Los "Comp Dollars vs Slot Points" de Golden Nugget sugieren que distintos tipos de beneficio tienen distintos dominios de aplicación (como cupón de pedido vs de pago).
- **Mecanismo 9 — Fare capping: "el sistema garantiza el mejor precio".** El pasajero no elige tarifa: el sistema calcula al final cuál le conviene. Para CheckPass: al cerrar la cuenta, el motor propone automáticamente la mejor combinación de cupones aplicables (o el mejor si no se combinan), con opción de cambiarla. El cliente no necesita saber qué cupón "usar".
- **Mecanismo 10 — "Avisar antes de pedir" (Starbucks).** Incluso Starbucks, con integración total, mantiene un paso verbal antes del pedido para recompensas de producto. Es evidencia de que los beneficios de momento-de-pedido necesitan declararse al inicio; el diseño puede formalizarlo como "cupones a aplicar en este pedido" al abrir la cuenta.

### Gaps
- No encontré fuentes sobre retiro de recetas en farmacia/copago de seguro, coat check, valet, upgrades de aerolínea ni split-the-bill apps dentro del presupuesto; las analogías posibles (co-pago = cupón que paga una parte fija; coat check = ficha física emparejada) quedan sin fuente.

## P5. Quién elige el cupón: defaults, sobrecarga de opciones, campo de cupón

### Takeaway
Baymard recomienda esconder el campo de cupón y aplicar proactivamente los descuentos que correspondan, porque un campo visible hace que la gente se frene o se vaya a buscar códigos. La evidencia de "sobrecarga de opciones" es mixta: el estudio de la mermelada es famoso pero un metaanálisis encontró efecto medio casi nulo.

### Cited Findings
- Baymard: algunos participantes dejaron el sitio para buscar códigos al ver el campo de cupón; la mayoría al menos se detiene a considerarlo; recomiendan ocultarlo detrás de un enlace y aplicar proactivamente los descuentos aplicables al carrito — [Baymard Payment UX](https://baymard.com/blog/payment-ux); [Baymard checkout UX](https://baymard.com/blog/checkout-flow-ux-optimization)
- Estudio de la mermelada (6 vs 24 sabores): 30% vs 3% de compra con el cupón — [The Decision Lab](https://thedecisionlab.com/biases/choice-overload-bias); pero un metaanálisis de 2010 (Journal of Consumer Research, 50 experimentos, 63 condiciones, >5.000 participantes) halló efecto medio virtualmente nulo — [Behavioral Scientist](https://behavioralscientist.org/is-having-too-many-choices-versus-too-few-really-the-greater-problem-for-consumers/); conflicto explícito entre fuentes
- Un metaanálisis posterior de ~100 estudios reportó que el exceso de opciones reduce satisfacción y aumenta arrepentimiento y no-elección (fuente secundaria) — [The Decision Lab](https://thedecisionlab.com/biases/choice-overload-bias)

### Inferences
- **Mecanismo 11 — Default inteligente, elección como excepción (Baymard + capping).** Mostrar el cupón ya aplicado ("Te aplicamos 2x1 en medialunas") con un "cambiar" pequeño, en vez de una lista para elegir. Resuelve "el cliente no puede elegir" sin cargarlo con elegir siempre.
- **Mecanismo 12 — No exhibir el "campo vacío" en el mostrador.** Si el comercio ve un botón "¿tiene cupón?", el cliente se frena a buscar en su teléfono (equivalente físico de salir a buscar códigos). Mejor: el escaneo trae los cupones ya cargados.
- Dado que la evidencia de choice overload es mixta, no conviene justificar la decisión solo con la mermelada; el argumento más sólido es el operativo (tiempo en el mostrador, cola).

### Gaps
- No encontré estudios específicos sobre el efecto dotación (endowment) en cupones guardados ni sobre "fricción como señal de confianza" en canje presencial.

## P6. Proximidad y dirección del escaneo

### Takeaway
Hay alternativas al "comercio escanea al cliente": señal ultrasónica que prueba presencia sin acción (Shopkick) y el QR del lado del comercio que escanea el cliente (Pix estático/dinámico, Mercado Pago QR), donde además el tipo de QR define quién fija el monto.

### Cited Findings
- Shopkick: transmisores en el local emiten un sonido inaudible (18-22 kHz) con un código del local; el micrófono del teléfono lo capta (hasta ~150 pies) y la app confirma la presencia física; la señal no atraviesa paredes, evitando check-ins falsos desde el estacionamiento — [20k.org](https://www.20k.org/episodes/ultrasonictracking); [TechCrunch 2010](https://techcrunch.com/2010/08/03/shopkick-best-buy); [Geoconnexion](https://www.geoconnexion.com/in-depth/bringing-cell-phone-location-sensing-indoors)
- Pix: QR estático reutilizable, el cliente puede definir el valor; QR dinámico generado por cobro, con valor exacto e identificador único definido por el comercio — [Nubank blog](https://blog.nubank.com.br/pix-qr-code-estatico-dinamico/); [Efí](https://sejaefi.com.br/blog/qr-code-estatico-qr-code-dinamico-no-pix); [Mercado Pago BR](https://www.mercadopago.com.br/blog/gerar-qr-code-pix-estatico-dinamico)

### Inferences
- **Mecanismo 13 — Escaneo inverso con QR dinámico (Pix/Mercado Pago).** El comercio arma la orden y su teléfono muestra un QR dinámico de ESA orden (monto + id). El cliente lo escanea con su pase/PWA, ve sus cupones aplicables a esa orden, elige/acepta y confirma; el teléfono del comercio se actualiza con el monto neto. El cliente maneja su lista de cupones en su propio teléfono (resuelve "el comercio ve uno solo") y el cupón queda atado a la orden. Es el gesto que el público LATAM ya conoce por pagar con QR de MP.
- **Mecanismo 14 — QR estático de mostrador (Pix estático).** Un cartel fijo del comercio que el cliente escanea para "hacer check-in" y ver sus cupones de ese comercio, sin que el empleado toque nada. Sirve para el momento-de-pedido (el cliente llega a la caja con el cupón ya abierto).
- **Mecanismo 15 — Prueba de presencia ambiental (Shopkick).** Hoy es excesivo para un café, pero la idea transferible es que la presencia puede probarse por un canal que no requiere al empleado; en la práctica el QR estático del Mecanismo 14 cumple ese rol con costo cero.

### Gaps
- No investigué NFC/BLE en pases de Wallet (requiere certificados especiales de Apple, sin fuente en estas notas).

## P7. Otras analogías sugeridas sin fuente en esta ronda (para el redactor: tratarlas como hipótesis)

### Takeaway
Las siguientes analogías son plausibles pero NO tienen fuente en estas notas; se listan para no perderlas, marcadas como no verificadas.

### Cited Findings
- (ninguna fuente recolectada)

### Inferences
- **Mecanismo 16 (hipótesis) — "Equipar" antes de la partida (videojuegos: loadout).** El jugador elige consumibles antes de entrar; durante la partida no hay menú. Equivale a los Mecanismos 1/10: elegir cupones antes de llegar al mostrador.
- **Mecanismo 17 (hipótesis) — Ficha emparejada (guardarropa/valet).** El cupón de 2x1 de "momento de pedido" se "reserva" en la orden al pedir y se resuelve al pagar, como el talón que se entrega al dejar el abrigo y se usa al retirarlo; un estado "reservado" evita usarlo dos veces en el intervalo.
- **Mecanismo 18 (hipótesis) — Copago (farmacia/seguro).** El beneficio cubre una porción definida y el resto lo paga el cliente: modelo natural para cupones de monto fijo sobre un total.

### Gaps
- Sin fuentes para gaming loadout, coat check, valet, copagos de farmacia, upgrades de check-in hotelero/aerolínea, Paytm/PhonePe, UNiDAYS. Si el redactor las usa, deben ir como analogías propuestas, no como hechos.
