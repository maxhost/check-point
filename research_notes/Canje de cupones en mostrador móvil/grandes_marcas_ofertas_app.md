# Canje en tienda física de ofertas/cupones desde la app — grandes marcas (QSR, café, retail, LATAM)

> Notas de investigacion (2026-10-03). Advertencia de metodo: varias paginas oficiales (mcdonalds.com, help.bk.com, help.timhortons.ca, help.tacobell.com, promociones.mcdonalds.com.ar) devolvieron 403 o no cargaron al hacer fetch; en esos casos la cita viene del **snippet del buscador** sobre esa URL oficial (se marca «[snippet]»). Lo que no pude leer completo esta en Gaps. No se encontraron posts de Reddit de empleados indexados por el buscador.

## 1. ¿Cual es la mecanica de canje en mostrador de cada marca (quien elige, formato del codigo, expiracion, como entra al POS)?

### Takeaway
Hay dos familias. **(A) QSR/cafe: el cliente ELIGE la oferta en la app ANTES de ordenar, y la app genera un codigo corto (4–6 digitos) o QR que el cajero/kiosco ingresa; la seleccion queda «cargada» en la cuenta y el codigo la referencia, con ventana corta (McDonald's: 15 min) y regla de UNA oferta por orden + cooldown.** **(B) Retail: el cliente «clipea»/activa (o ni eso) y presenta UN solo identificador (barcode/telefono); el POS aplica automaticamente todo lo que corresponda al carrito.**

### Cited Findings
**McDonald's (EE.UU., MyMcDonald's)**
- Al tocar «Scan at Restaurant» en una oferta, hay 15 minutos para escanear el codigo [snippet] — [McDonald's App Deals FAQ](https://www.mcdonalds.com/us/en-us/contact-us/help-center/deals.html)
- Para canje en restaurante la app produce un QR y un codigo de 4 caracteres para la crew; la pestaña «Earn Points» tiene un codigo de restaurante de 4 digitos o un QR escaneable en kiosco [snippet] — [Yahoo/Lifestyle](https://www.yahoo.com/lifestyle/articles/redeem-multiple-mcdonald-offers-without-211500271.html)
- «One deal per person, per visit»; tras el checkout la app exige esperar 15 minutos antes de canjear otra oferta o recompensa — [Yahoo/Lifestyle](https://www.yahoo.com/lifestyle/articles/redeem-multiple-mcdonald-offers-without-211500271.html)
- Recompensas: «limited to redeeming one reward per order»; se da el codigo de 4 digitos (pestaña Rewards) y con UN solo codigo se canjea el item gratis y a la vez se suman puntos por lo que se compra («You only need to provide one code») [snippet] — [MyMcDonald's Rewards FAQ](https://www.mcdonalds.com/us/en-us/faq/mymcdonalds-rewards.html); [FAQ «¿tengo que dar dos codigos?»](https://www.mcdonalds.com/us/en-us/faq/do-i-have-to-provide-two-codes-if-i-want-to-redeem-a-reward-or-deal-and-earn-points-in-the-same-transaction.html)
- Kiosco: boton «Earn Points» → se ingresa el codigo de 4 digitos o se escanea el QR para vincular la cuenta; refrescar la pestaña genera un codigo nuevo que «dispara una sesion limpia» (usado por usuarios para encadenar ofertas en kiosco evitando el cooldown de 15 min) — [Yahoo/Lifestyle](https://www.yahoo.com/lifestyle/articles/redeem-multiple-mcdonald-offers-without-211500271.html)

**Burger King (EE.UU., Royal Perks)**
- Canje en restaurante: el cliente agrega la oferta elegible a su cuenta y da su «My Code» de **6 digitos** al cajero **antes de ordenar**; solo ofertas con icono «Redeem In-Restaurant» sirven en tienda [snippet] — [BK Help: usar oferta en restaurante](https://help.bk.com/hc/en-us/articles/36916360929175-How-do-I-use-an-offer-from-the-BK-App-in-restaurant-at-a-Burger-King-location)
- No se puede canjear una oferta dentro de los 60 minutos de un canje previo; limite de una oferta por cuenta por semana (segun T&C citadas por buscador) [snippet] — [BK Royal Perks T&C](https://www.bk.com/terms-conditions-rewards)
- Existen ofertas «digital-only» que NO se pueden canjear en restaurante: solo pidiendo por app/bk.com con pago digital — [BK Help: Digital-only Offers](https://help.bk.com/hc/en-us/articles/36916437864087-Digital-only-Offers)

**Starbucks Rewards**
- Se le avisa al barista ANTES de ordenar que se va a canjear; luego el cliente usa «Scan» y el barista escanea el QR para pagar (y descontar estrellas) — [Barista HQ](https://baristahq.com/how-to-redeem-starbucks-stars/) (fuente secundaria)
- Niveles 2026 citados: 25 estrellas (personalizacion), 100 (cafe/te/bakery), 200 (bebida preparada/desayuno) — [Barista HQ](https://baristahq.com/how-to-redeem-starbucks-stars/)
- Rewards tipo «Barista Pick»: se muestra la pantalla de la recompensa antes de que se registre la compra; el barista escanea el barcode o la ingresa a mano — [Quora](https://www.quora.com/How-do-I-redeem-a-Starbucks-Barista-Pick-reward) (fuente debil)
- Historico (2016): antes de la integracion, los miembros no podian canjear recompensas en Mobile Order & Pay — [TechCrunch 2016](https://techcrunch.com/2016/04/12/starbucks-rolls-out-a-more-personalized-mobile-app-along-with-a-revamped-rewards-program)

**Chick-fil-A One**
- Oficial: «order your desired reward menu item and scan your Chick-fil-A One QR code at the register or in the drive-thru»; el QR esta en la pantalla «scan» de la app — [Chick-fil-A: canjear en caja](https://www.chick-fil-a.com/customer-support/chick-fil-a-one-membership-program/points-and-rewards/how-do-i-redeem-rewards-at-the-register)
- Cada reward vale «only one of the specified entrée or a la carte menu items» — misma fuente.
- Guia secundaria: el cliente pide, le dice al cajero que tiene un reward, toca el reward en «My Rewards» → «redeem in store» → aparece un QR que el cajero escanea y el item se descuenta del total de la orden en curso — [Loyalty & Reward Co](https://loyaltyrewardco.com/the-ultimate-guide-to-chick-fil-a-one/)

**Taco Bell Rewards**
- Se canjea seleccionando «Redeem» bajo el reward en la app; un reward a la vez / «one reward per transaction»; en kiosco/drive-thru: «Check in now» en la app → codigo unico de 4 digitos ingresado ANTES de ordenar; alternativamente QR mostrado al cajero [snippet] — [Taco Bell Help](https://help.tacobell.com/s/faq/how-do-i-redeem-a-taco-bell-reward)

**Tim Hortons (Canada) — modelo «un escaneo»**
- «Scan & Pay» permite «pay, earn points, and redeem rewards and offers with one scan»; el QR se escanea al terminar de pedir, cuando toca pagar [snippet] — [Tim Hortons Help: cuando escanear](https://help.timhortons.ca/hc/en-ca/articles/35257398998299-When-can-I-scan-my-Tims-Rewards-QR-code); [Restaurant Dive](https://www.restaurantdive.com/news/tim-hortons-offers-scan-pay-option-for-loyalty-app/636364/)
- Las ofertas se activan antes en la «digital offer tray»; el nivel de reward elegido se puede cambiar «at any time prior to making a purchase» y al comprar se canjea segun el nivel seleccionado [snippet] — [Tims Rewards FAQ](https://www.timhortons.com/timsrewards-faq)

**Retail (modelo «clip/auto-apply»)**
- Target Circle: los deals «automatically applied at checkout»; identificacion por telefono en el keypad o escaneando el barcode de la pestaña Wallet — [Target Help oficial](https://www.target.com/help/articles/target-circle/about-target-circle)
- Target: antes habia que guardar cada oferta manualmente; ahora se aplican automaticamente al escanear el barcode (cambio historico, ~2024) — [Krazy Coupon Lady](https://thekrazycouponlady.com/tips/couponing/use-targets-new-app-stack-savings-pro)
- Kroger: cupones «clipped» se aplican solos al escanear la tarjeta o dar el telefono; normalmente uso una vez por transaccion; en eventos «5X» hasta 5 veces — [Kroger 5X](https://www.kroger.com/pr/5x-digital-coupon-event); [Krogerkrazy](https://www.krogerkrazy.com/kroger-digital-coupons/)
- Kroger ya no exige app para acceder a cupones digitales (cambio orientado a adultos mayores) — [Progressive Grocer](https://progressivegrocer.com/kroger-shoppers-no-longer-need-app-access-digital-coupons); [WCPO](https://www.wcpo.com/money/consumer/dont-waste-your-money/kroger-eases-digital-coupon-rules-helping-seniors-who-struggle-with-apps)
- CVS ExtraCare: «Send to Card» → las ofertas calificantes se canjean automaticamente la proxima vez que se usa la tarjeta (o telefono) en caja; ExtraBucks tambien se «envian a la tarjeta» — [CVS ExtraCare Help](https://www.cvs.com/retail/help/help-subtopic-with-extracare); [CVS Coupon Policy](https://www.cvs.com/extracare-cvs/couponpolicy)

**LATAM**
- McDonald's Argentina (Arcos Dorados): se activa el cupon en la app y se muestra el QR/codigo al cajero al pagar, o se agrega al pedido si se ordena por app; el canje queda sujeto a disponibilidad del producto en el local [snippet de agregadores, no de la pagina oficial] — [Legales McDonald's Argentina](https://promociones.mcdonalds.com.ar/legales-argentina); [cuponesargentina](https://cuponesargentina.com.ar/tienda/mcdonalds/)
- Arcos Dorados lanzo MiMcDonald's: puntos por compras registradas en la app canjeables por productos, en 20 paises de LatAm/Caribe — [Yahoo Finanzas](https://es-us.finanzas.yahoo.com/noticias/mcdonald-s-lanz%C3%B3-programa-acumular-000000346.html)
- OXXO / Spin Premia (ex OXXO Premia, Mexico): identificacion escaneando el codigo de la tarjeta Spin by OXXO en caja (OXXO, OXXO GAS, Doña Tota); 1 punto = 10 centavos; canje de puntos tambien escaneando — [Spin by OXXO oficial](https://spinbyoxxo.com.mx/programa-de-lealtad)
- Spin: cupones-premio se canjean escaneando el producto participante en caja (el cupon se activa contra el SKU) — [FinanzasYa](https://finanzasya.com.mx/tecnologia/guia-paso-a-paso-para-obtener-y-canjear-codigos-de-spin-by-oxxo/)

### Inferences
- En QSR el **codigo NO codifica la oferta en si**: es un token de sesion/cuenta (4–6 digitos) que referencia lo que el cliente ya selecciono en la app; por eso McDonald's/BK piden «elegir y agregar» antes y luego dar UN codigo. McDonald's explicitamente fusiona «canjear + sumar puntos» en un solo codigo — analogo directo a «escanear QR del pase + registrar venta» de CheckPass.
- El codigo corto numerico existe para que el cajero/drive-thru lo pueda **dictar o tipear** sin escaner; el QR es para kiosco/escaner. CheckPass (escaneo con celular) podria ofrecer ambos: QR + codigo corto de respaldo.
- La expiracion corta (15 min) cumple doble rol: anti-captura de pantalla/reuso y limpieza de sesiones abiertas.
- Para un comercio sin POS, el modelo Tim Hortons («un escaneo hace todo, la seleccion se cambia hasta el momento de pagar») es el mas parecido al flujo deseado.

### Gaps
- No pude leer textualmente las FAQ de McDonald's EE.UU. (403); el «4 caracteres» vs «4 digitos» y si el codigo de deal y el de rewards son el mismo quedan con fuente snippet.
- No encontre documentacion de Domino's, Subway, Dunkin', Panera, Sephora, Walmart, Walgreens, Starbucks LATAM (Alsea), Cafe Martinez, Havanna ni Grupo Bimbo en el presupuesto de busqueda.
- No verifique la duracion de validez del codigo en BK, Taco Bell ni Chick-fil-A.

## 2. ¿Como elige el cliente UNA oferta entre muchas? ¿Va codificada en lo que escanea el cajero? ¿Que pasa si no aplica?

### Takeaway
En QSR **elige el cliente, en la app, antes**, y la regla dura es una oferta/reward por orden; la eleccion vive en el servidor ligada a la cuenta y el codigo la referencia. En retail **no elige nadie**: el sistema aplica todo lo activado que matchee el carrito, con reglas de no-apilado por categoria. No hay documentacion publica clara de que pasa si la oferta elegida no aplica al carrito (salvo «sujeto a disponibilidad»).

### Cited Findings
- McDonald's: una oferta por persona por visita, una reward por orden — [Yahoo](https://www.yahoo.com/lifestyle/articles/redeem-multiple-mcdonald-offers-without-211500271.html); [MyMcDonald's FAQ](https://www.mcdonalds.com/us/en-us/faq/mymcdonalds-rewards.html)
- Taco Bell: «only redeem one reward at a time» / una por transaccion [snippet] — [Taco Bell Help](https://help.tacobell.com/s/faq/how-do-i-redeem-a-taco-bell-reward)
- BK: el cliente «agrega» la oferta a su cuenta y luego da el codigo — [BK Help](https://help.bk.com/hc/en-us/articles/36916360929175-How-do-I-use-an-offer-from-the-BK-App-in-restaurant-at-a-Burger-King-location)
- Tim Hortons: la seleccion (nivel de reward) se puede cambiar hasta antes de comprar; ofertas se activan en una «tray» — [Tims Rewards FAQ](https://www.timhortons.com/timsrewards-faq)
- Target: se puede combinar un cupon de categoria + uno de item en la misma transaccion, pero NO dos cupones de categoria sobre el mismo item (ej. 20% zapatos de mujer + 15% ropa y zapatos) — [Krazy Coupon Lady](https://thekrazycouponlady.com/tips/couponing/how-to-coupon-at-target); [ConsumerAffairs](https://www.consumeraffairs.com/news/how-to-coupon-at-target-like-a-pro-and-stack-every-deal-030426.html)
- Kroger aplica el cupon digital clipeado automaticamente y bloquea usar un cupon de papel de mayor valor sobre el mismo item: el auto-apply no garantiza «la mejor» oferta para el cliente — [ConsumerAffairs Kroger](https://www.consumeraffairs.com/news/how-to-coupon-at-kroger-and-save-serious-money-without-wasting-hours-040226.html)
- McDonald's Argentina: canje «sujeto a la disponibilidad del producto en el local al momento del canje» — [Legales AR](https://promociones.mcdonalds.com.ar/legales-argentina) [snippet]
- Chick-fil-A: el reward se descuenta del item ordenado en la orden en curso (requiere que el item este en el pedido) — [Loyalty & Reward Co](https://loyaltyrewardco.com/the-ultimate-guide-to-chick-fil-a-one/)

### Inferences
- Patron dominante para «varios cupones del mismo comercio»: lista en la app del cliente → cliente toca UNO → esa seleccion queda «armada» en el servidor (con TTL) → el cajero escanea el QR/codigo de identidad y ve la seleccion ya hecha. Esto resuelve exactamente el problema actual de CheckPass («el cliente no puede elegir, el comercio ve solo uno»).
- Alternativa sin preseleccion (retail): el cajero ve todos los aplicables y el sistema/cajero elige; tiene el riesgo documentado de aplicar uno que el cliente no queria (Kroger).
- Ningun caso documentado por las marcas resuelve «no aplicable al carrito» de forma explicita en la app; en QSR lo resuelve el cajero/POS rechazando.

### Gaps
- No encontre documentacion de comportamiento del POS cuando el item del deal no esta en la orden (rechazo vs agregado automatico).
- No encontre detalles publicos de patentes sobre tokens de seleccion de oferta.

## 3. Orden vs pago: ¿cuando se declara la oferta?

### Takeaway
QSR con ofertas de producto (BOGO, item gratis) exige declarar **antes de ordenar** (BK, Taco Bell, Starbucks) o al menos durante la orden (Chick-fil-A), porque el descuento se ata a items del ticket. El modelo de pago (Tim Hortons Scan & Pay, retail) escanea **al final**, cuando el carrito ya existe y el sistema puede calcular.

### Cited Findings
- BK: dar el «My Code» al cajero «before placing your order» — [BK Help](https://help.bk.com/hc/en-us/articles/36916360929175-How-do-I-use-an-offer-from-the-BK-App-in-restaurant-at-a-Burger-King-location)
- Taco Bell: el codigo de 4 digitos se ingresa en kiosco antes de ordenar [snippet] — [Taco Bell Help](https://help.tacobell.com/s/faq/how-do-i-redeem-a-taco-bell-reward)
- Starbucks: avisar al barista antes de ordenar, luego escanear al pagar — [Barista HQ](https://baristahq.com/how-to-redeem-starbucks-stars/)
- Chick-fil-A: pedir el item del reward y escanear el QR en caja — [Chick-fil-A oficial](https://www.chick-fil-a.com/customer-support/chick-fil-a-one-membership-program/points-and-rewards/how-do-i-redeem-rewards-at-the-register)
- Tim Hortons: escanear al terminar el pedido, cuando toca pagar — [Tim Hortons Help](https://help.timhortons.ca/hc/en-ca/articles/35257398998299-When-can-I-scan-my-Tims-Rewards-QR-code) [snippet]
- Target/Kroger/CVS: identificacion al checkout, aplicacion automatica sobre el carrito — [Target](https://www.target.com/help/articles/target-circle/about-target-circle); [CVS](https://www.cvs.com/retail/help/help-subtopic-with-extracare)

### Inferences
- Para CheckPass (sin POS, el comercio registra el monto a mano): cupones de producto (gratis, 2x1) necesitan que el cajero lo sepa al tomar el pedido; cupones de monto/% necesitan aplicarse al registrar la venta (para que los puntos se calculen sobre el neto o el bruto, decision a tomar); sellos/puntos extra pueden aplicarse en cualquier momento. Sugiere que el escaneo muestre el cupon elegido al inicio y que el registro de venta lo «consuma» en el mismo paso.

### Gaps
- No encontre una politica documentada de si los puntos se calculan sobre el total antes o despues del descuento en estas marcas (Starbucks: snippet sugiere que se ganan estrellas aun con total $0, no verificado).

## 4. Problemas de UX y dolores de cajeros/crew documentados

### Takeaway
La evidencia publica encontrada es escasa y mayormente indirecta: cooldowns que los usuarios esquivan, ofertas «digital-only» confusas, locales que no escanean, fallas de app. No logre acceder a hilos de r/McDonaldsEmployees o r/starbucksbaristas via buscador.

### Cited Findings
- Usuarios encadenan ofertas en kiosco refrescando el codigo de 4 digitos (cada codigo nuevo = sesion limpia), evitando el cooldown de 15 min: «7 snack wraps, 9 double cheeseburgers, 3 McFlurries» en 50 minutos — [Yahoo/Lifestyle](https://www.yahoo.com/lifestyle/articles/redeem-multiple-mcdonald-offers-without-211500271.html); variante: uno por pedido anticipado + otro en kiosco — [AOL](https://www.aol.com/hack-lets-redeem-multiple-mcdonalds-015027788.html)
- Algunas tiendas Starbucks en EE.UU. no pueden escanear QR de rewards (caso canadienses en EE.UU.) — [RedFlagDeals](https://forums.redflagdeals.com/canadian-starbucks-app-work-rewards-us-2617954/)
- Caso reportado de un codigo promo de McDonald's que consumio los puntos y quedo invalido (resena individual, fuente debil) — [Wanderlog](https://wanderlog.com/place/details/2890208/mcdonalds)
- Starbucks quito estrellas tras un error propio dejando saldo negativo al cliente — [AOL](https://www.aol.com/starbucks-removes-stars-rewards-account-154614669.html)
- BK obliga a distinguir ofertas canjeables en tienda (icono) vs digital-only — [BK Help](https://help.bk.com/hc/en-us/articles/36916437864087-Digital-only-Offers)
- Kroger flexibilizo el requisito de app para cupones digitales tras quejas de adultos mayores — [WCPO](https://www.wcpo.com/money/consumer/dont-waste-your-money/kroger-eases-digital-coupon-rules-helping-seniors-who-struggle-with-apps)

### Inferences
- Riesgos a disenar en CheckPass: (1) consumir el cupon sin que la venta lo refleje (el bug reportado de McDonald's es el mismo patron que el «canjear termina la sesion sin afectar la venta» actual); (2) sesiones/codigos re-generables permiten abuso si el limite es por sesion y no por cuenta+tiempo; (3) un cupon que el local no puede aplicar debe estar marcado antes del mostrador.

### Gaps
- Sin acceso a hilos de Reddit de empleados (no indexados por el buscador usado); los dolores de crew (clientes que muestran el codigo tarde, despues de pagar; codigos expirados en la fila; drive-thru dictando codigos) NO quedan verificados con fuente.
