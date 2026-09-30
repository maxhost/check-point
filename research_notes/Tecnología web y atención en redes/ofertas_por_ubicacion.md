# Ofertas disparadas por ubicación y contexto para comercios locales: qué se probó, qué funcionó, qué falló

Notas de investigación, septiembre 2026. Confianza: **A** = fuente primaria / paper revisado por pares; **M** = prensa especializada o vendor con cifra; **B** = agregador, blog o fuente secundaria; **NV** = no verificado (no pude abrir la fuente primaria).
Limitación de método: los PDFs (paper de Luo et al., texto oficial de la LOPDP) se descargaron pero no se pudieron leer (faltan herramientas para extraer texto de PDF en este entorno). Lo que se cita de ellos sale de resúmenes y abstracts, y se marca así.

## 1. Historia de la proximidad: Foursquare, Groupon Now, Google Nearby/Eddystone, iBeacon (Macy's/Shopkick), atribución

### Takeaway
Casi todos los sistemas «push por cercanía» de 2010-2018 murieron por lo mismo: la oferta llegaba sin que el usuario la hubiera pedido, desde alguien con quien no tenía relación, con fricción técnica alta (app propia + Bluetooth + permiso de ubicación + permiso de notificaciones). Lo que sobrevivió fue lo que ocurre donde el usuario ya está por otro motivo, o lo que se dispara por una acción suya (check-in, escaneo, pago), no por un sensor.

### Cited Findings
**Google Nearby Notifications / Eddystone (2015-2018)**
- Google dejó de servir Nearby Notifications el **6-dic-2018** porque notó «un aumento significativo de notificaciones irrelevantes para el lugar y spam, que llevaban a una mala experiencia de usuario», y concluyó que no cumplían su estándar de calidad. Confianza A. — [Android Developers Blog, oct-2018](https://android-developers.googleblog.com/2018/10/discontinuing-support-for-android.html)
- Lo que se mantuvo: la Proximity Beacons API **dentro de apps propias**, además de Nearby Messages/Connections y Fast Pair. Es decir: murió el push abierto a cualquier emisor y sobrevivió el que va dentro de una relación ya existente (una app que el usuario instaló). Confianza A. — [Android Developers Blog](https://android-developers.googleblog.com/2018/10/discontinuing-support-for-android.html); cobertura: [9to5Google](https://9to5google.com/2018/10/25/google-killing-location-notifications/), [Android Police](https://www.androidpolice.com/2018/10/26/google-shuts-nearby-notifications-due-much-spam/)
- Según la prensa, la idea original era avisar de cosas útiles cerca (wifi gratis, puntos de carga, información de museos), pero los anunciantes la usaron para spam. Confianza M. — [TechSpot](https://www.techspot.com/news/77127-google-shutting-down-android-nearby-notifications-due-excess.html)

**iBeacon en retail: Macy's + Shopkick (2013-2015) y el declive**
- Macy's hizo un piloto cerrado con Shopkick al empezar la temporada de fiestas de 2013. Un año después lo llevó a nivel nacional: más de **4.000 dispositivos shopBeacon**, anunciado como el mayor despliegue de beacons en retail. Confianza M. — [RFID Journal](https://www.rfidjournal.com/news/macys-tests-shopkicks-shopbeacon-at-new-york-san-francisco-stores/74808/); [PYMNTS 2014](https://www.pymnts.com/in-depth/2014/prizes-perils-beacons/)
- Shopkick (oct-2014) dijo haber generado más de **US$1.000 millones** en ventas para sus socios desde 2010 (más de la mitad en los últimos 12 meses), más de 50 millones de «walk-ins», más de 7.500 shopBeacons en 3.000 tiendas y usuarios que «gastan 50-100% más». Son **cifras del propio vendor, sin grupo de control publicado**. Confianza B/M. — [PR Newswire](https://www.prnewswire.com/news-releases/shopkick-surpasses-1-billion-generated-for-partners-279269882.html); [MediaPost](https://www.mediapost.com/publications/article/236175/shopkick-beaconing-500-million-in-12-months.html)
- Por qué fracasaron los beacons, según un análisis retrospectivo: el usuario tenía que bajar la app del retailer, prender Bluetooth, dar permiso de ubicación y aceptar notificaciones. Las descargas eran bajas, el Bluetooth se apagaba para ahorrar batería y el cansancio de notificaciones llevaba a negar el permiso de ubicación «en tasas que destriparon el alcance». A eso se sumaron el rechazo a que la tienda rastreara por qué pasillo andaba cada uno, el cambio de baterías, las interferencias, costos no presupuestados y la dificultad de armar mensajes que fueran relevantes. En los años 2020, el beacon de marketing al consumidor había desaparecido casi por completo. Confianza B (artículo de síntesis, sin cifras primarias). — [CPG Matters](https://www.cpgmatters.com/article/look-back-beacons-how-promising-store-marketing-tool-got-lost-aisle)
- Otra fuente atribuye el estancamiento también a problemas impredecibles de hardware, y dice que solo el 23% de los retailers de EE.UU. había implementado beacons de forma satisfactoria (sin fecha clara). Confianza B. — [Harvard RCTOM (ensayo de estudiante)](https://d3.harvard.edu/platform-rctom/submission/macys-a-beacon-of-technology/); [Campaign US](https://www.campaignlive.com/article/retailers-shoppers-resist-apples-ibeacon-signals/1363907)

**Foursquare Specials (2010-2014)**
- Foursquare lanzó en 2011 una plataforma de «Specials» para comercios (ofertas por hacer check-in). Confianza M. — [TechCrunch 2011-03-09](https://techcrunch.com/2011/03/09/foursquare-specials); [Fast Company](https://www.fastcompany.com/1736762/foursquare-gets-specials-whole-new-merchant-platform)
- Hubo problemas de fraude: el GPS permitía hacer check-in desde otro código postal, y «más de la mitad» de los que hacían check-in no estaban en el restaurante (la cifra viene de un blog de marketing gastronómico, sin fuente primaria). Confianza B / NV. — [Gourmet Marketing](https://www.gourmetmarketing.net/blog/the-foursquare-phenomenon)
- Una lección citada: una app que solo sirve para ofertas se agota rápido (el usuario entra, no ve nada, vuelve a entrar, no ve nada, y deja de entrar). Las ofertas tienen que aparecer donde la gente ya está por otro motivo. En 2014 Foursquare separó el check-in en Swarm y giró hacia recomendaciones; Crowley lo describió como que la gente usaba la app sin hacer check-in. Confianza B/M. — [TechCrunch (Crowley)](https://techcrunch.com/?p=778450); [TechCrunch, «Foursquare's New Deal Partnerships Are No Big Deal»](https://techcrunch.com/?p=388544)

**Groupon (Now) y el modelo de ofertas**
- En 2012 el modelo de Groupon hizo agua: los comercios se quejaban de que el cliente que llegaba por el descuento no volvía, así que dejaban de ofrecer ofertas y Groupon tenía que salir a conseguir comercios nuevos a un costo alto. Confianza B. — [FourWeekMBA](https://fourweekmba.com/what-happened-to-groupon/); [Slate, ago-2012](https://slate.com/technology/2012/08/groupon-earnings-report-the-daily-deals-sites-crummy-business-model-is-finally-dead-hooray.html)

### Inferences
- El patrón de fracaso se repite: (a) el push lo inicia un emisor sin relación con el usuario → spam (Nearby); (b) una cadena de permisos y hardware → alcance mínimo (beacons); (c) descuentos profundos → clientes que no vuelven y comercios que se van (Groupon); (d) un check-in que no se puede verificar → fraude (Foursquare).
- Una red cuyo disparador es **el escaneo del pase en el mostrador** esquiva (b) y (d): la presencia queda probada por un acto físico, sin beacons ni GPS en segundo plano. El riesgo que queda es (a) y (c): que la red se vuelva un canal de spam entre comercios, o que la oferta cruzada sea tan profunda que atraiga cazadores de descuentos.

### Gaps
- **Groupon Now** (ofertas en tiempo real, 2011): no encontré fuente fechada sobre su cierre ni su desempeño. Queda sin verificar.
- **Foursquare Pilgrim SDK y Placed** (atribución de visitas): no llegué a buscar cifras de lift medidas. Quedan pendientes.
- No encontré resultados publicados y medidos del programa de Macy's (lift o tasa de opt-in), más allá de que «les gustó el piloto».

## 2. Ofertas en el momento de la compra (bounce-back, Catalina, Fivestars) y efectos entre comercios

### Takeaway
El cupón que se entrega en el momento del pago es de las formas más eficaces de promoción que están documentadas: históricamente, Catalina canjeaba unas 4-5 veces más que el cupón de periódico. La red de Fivestars muestra el mecanismo exacto de «descubrí comercios cercanos en la pantalla del mostrador». Pero no encontré mediciones públicas del efecto entre comercios.

### Cited Findings
- **Catalina Marketing (1994):** según George Off, presidente de Catalina, los cupones del checkout canjeaban cerca de **10%**, contra alrededor de **2%** de los cupones FSI (encartes de periódico): unas 4-5 veces más. Confianza M, con cifras del propio vendor. — [Supermarket News, 22-ago-1994](https://www.supermarketnews.com/grocery-operations/triggered-response)
- Otras fuentes hablan de ~7% de canje para el cupón Catalina impreso con el ticket, y lo explican por el momento de entrega, un valor facial más alto (~84¢ contra ~53¢ del FSI) y la segmentación por lo que se compró. Confianza B (secundaria, sin fecha clara). — [CSMonitor, 1992](https://www.csmonitor.com/1992/0616/16082.html); [NatPromo](https://www.natpromo.com/press/coupon_article.cfm)
- **Fivestars (hoy «SumUp Connect Loyalty»):** es una red de fidelización para PyMEs de Norteamérica. El cliente se inscribe en el checkout con su teléfono y después de la visita recibe un SMS con el resumen. El nombre y la ubicación de un comercio **aparecen en la pantalla del checkout de otros comercios cercanos de la red**, y el cliente recibe sugerencias de otros lugares donde puede ganar recompensas. Confianza M (sitio del vendor). — [Fivestars/SumUp promotions](https://www.fivestars.com/products/promotions/); [Fivestars blog, «Acquisition»](https://blog.fivestars.com/fivestars-acquisition-new-way-reach-automatically-engage-customers-love-local/)

### Inferences
- El mostrador es el momento de mayor atención y de presencia verificada. Catalina es la evidencia más antigua y robusta de que una oferta en ese momento, **segmentada según lo que se acaba de comprar**, canjea varias veces más que la misma oferta enviada a ciegas.
- Fivestars es el antecedente directo de la oferta cruzada entre comercios en el momento de la compra. Que la red siga existiendo como producto de SumUp sugiere que tiene valor para el comercio, pero **no hay datos públicos de conversión entre comercios**.

### Gaps
- No encontré datos de canje de cupones bounce-back ni de SMS de Fivestars hacia comercios vecinos. Tampoco estudios independientes del efecto entre comercios (si el comercio A le «presta» clientes al B, o solo se canibalizan).
- Las cifras de Catalina son de los años 90 y vienen del vendor. No verifiqué datos actuales de Catalina.

## 3. Geofencing con push: radio, momento, frecuencia, permanencia y lift medido

### Takeaway
La mejor evidencia académica (experimentos aleatorizados) dice que la cercanía funciona **combinada con la inmediatez**: si el usuario está cerca, la oferta tiene que servir para ahora mismo; si está lejos, conviene darle más tiempo. Además, la segmentación muy fina puede bajar la compra impulsiva. Los vendors recomiendan radios de 50-100 m, un tiempo mínimo de permanencia y topes de frecuencia, pero sus cifras de lift no tienen control.

### Cited Findings
- **Luo, Andrews, Fang y Phang, «Mobile Targeting», Management Science 60(7), 2014:** experimento aleatorizado con **12.265 usuarios** que recibieron SMS (en China, con promociones de entradas de cine; lo tomo del resumen, **NV** contra el PDF). La segmentación por tiempo y la segmentación por ubicación suben las compras cada una por su lado, pero combinadas no se suman sin más. Con usuarios **cerca**, la relación entre venta y anticipación es negativa: la promoción para el **mismo día** vence a la que llega con dos días de anticipación. Con usuarios **lejos**, el SMS con un día de anticipación aumenta las probabilidades de compra en **71%** frente al de dos días. Confianza A (abstract); los detalles de distancias y porcentajes por celda son NV. — [Management Science](https://pubsonline.informs.org/doi/10.1287/mnsc.2013.1836); [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2341865)
- **Ghose, Li y Liu, «Mobile Targeting Using Customer Trajectory Patterns», Management Science 2019:** experimento de campo en un shopping grande, **83.370 respuestas de usuarios** en 14 días (junio 2014). Segmentar por el recorrido que viene haciendo el usuario, y no solo por dónde está en ese momento, dio mayor probabilidad de canje, canje más rápido y tickets más altos, tanto para la tienda como para el shopping. Pero funcionó **peor los fines de semana y con compradores en modo exploración**: una promoción muy segmentada puede reducir la compra impulsiva. Confianza A (abstract). — [SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2962044); [PDF CMU](https://www.andrew.cmu.edu/user/beibeili/Publications/MobileTrajTargeting.2019.mnsc.Full.pdf)
- Andrews, Luo, Fang y Ghose, «Mobile ad effectiveness: Hyper-contextual targeting with crowdedness» (Marketing Science, 2016): en vagones de subte llenos, la gente respondía más a las ofertas por celular. Solo vi la referencia, no el texto: **NV**. — [referencia vía búsqueda / SSRN de Luo](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2341865)
- **Parámetros de práctica (vendors):** un radio de 25 m sirve para detectar llegadas en zona urbana; en suburbios puede hacer falta 100 m, y la mayoría de los casos usa 50-100 m por confiabilidad. Pedir una permanencia mínima (p. ej., 2 minutos o más) filtra a los que solo pasan por la vereda. Confianza M. — [Radar, «How accurate is geofencing?»](https://radar.com/blog/how-accurate-is-geofencing); la transición `DWELL` reduce alertas frente a `ENTER`: [Android Developers, Geofencing](https://developer.android.com/develop/sensors-and-location/location/geofencing) (A)
- Topes de frecuencia: una guía de 2026 para restaurantes habla de 3-5 notificaciones por día y por usuario, y dice que el mayor lift en restaurantes independientes aparece en las franjas horarias flojas. Es un blog de consultora: confianza B. — [ION Hospitality, ago-2026](https://www.ionhospitality.com/2026/08/20/geofencing-for-restaurants/)

### Inferences
- Para la red: el aviso «estás cerca del comercio X» debería ofrecer algo **para usar ya**. Una oferta cruzada entregada en el mostrador («a 2 cuadras, el comercio Y te da Z hoy») cumple la condición de cercanía más inmediatez de Luo et al.
- El resultado de Ghose et al. sirve de base a la idea de recomendar según el **historial de escaneos** (el recorrido del usuario por la red), y también advierte que no conviene empujar ofertas demasiado dirigidas a quien está explorando.
- En una PWA sin ubicación en segundo plano no se puede hacer geofencing real. La ubicación solo existe al escanear o al abrir la app con GPS, y eso deja la práctica más cerca de las ofertas a pedido (el usuario abre la app) que del push.

### Gaps
- No conseguí cifras de lift de Airship, Braze o Foursquare con grupo de control. Los datos de vendors que aparecieron (p. ej., «Store Mode convierte 2,5x») no tienen metodología y los dejé afuera.
- No verifiqué contra el PDF las distancias exactas de Luo et al. (0-200 m / 200-500 m / 500 m+?) ni el lift de la condición «cerca + mismo día».

## 4. Aceptación del consumidor, permisos, «creepiness» y regulación (LOPDP Ecuador)

### Takeaway
Pedir ubicación permanente es cada vez más difícil (iOS 13 sacó «Permitir siempre» del primer pedido de permiso), y una proporción grande de consumidores considera invasivo el aviso al pasar frente a una tienda. En Ecuador, la LOPDP (2021, con sanciones vigentes desde mayo de 2023) exige un consentimiento libre, específico, informado e inequívoco, y prohíbe el opt-out y las casillas premarcadas.

### Cited Findings
- Desde **iOS 13 (2019)** el usuario **no puede** dar «Permitir siempre» en el primer pedido: primero elige entre «Mientras se usa», «Permitir una vez» o «No permitir», y pedir «Siempre» de entrada da tasas bajas de aceptación. Confianza M. — [Notificare, may-2023](https://notificare.com/blog/2023/05/19/deep-dive-into-ios-location-permission/); [PlotProjects](https://www.plotprojects.com/blog/ios13-location-opt-in-your-questions-answered/)
- Según encuestas: el **40%** considera «creepy» (invasivo) recibir una notificación móvil al pasar frente a una tienda y el **41%** un SMS en la misma situación; el **67%** de los consumidores de EE.UU. ve como «creepy» los anuncios basados en ubicación, y solo el **31%** se siente cómodo compartiendo su ubicación en tiempo real. Confianza B: son agregadores, y no identifiqué con certeza la encuesta original ni su año. — [RetailWire](https://retailwire.com/discussion/can-location-based-marketing-overcome-its-creepiness-factor/); [MarketingCharts](https://www.marketingcharts.com/digital-235122); [MarketingCharts](https://www.marketingcharts.com/customer-centric/datadriven-232012)
- Solo el 53% de los grandes retailers creía que sus clientes se preocuparían por el rastreo, y los retailers chicos se preocupaban todavía menos: hay una brecha de percepción. Confianza B. — [eMarketer](https://www.emarketer.com/content/some-retailers-worry-location-tracking-is-creepy)
- **LOPDP Ecuador:** publicada en el Registro Oficial el **26-may-2021**; las **sanciones administrativas rigen desde el 26-may-2023**. Confianza M. — [Orizontel (guía)](https://orizontel.ec/guia-lopdp-ecuador/); texto oficial: [PDF finanzaspopulares.gob.ec](https://www.finanzaspopulares.gob.ec/wp-content/uploads/2021/07/ley_organica_de_proteccion_de_datos_personales.pdf) (descargado, no lo pude leer)
- El consentimiento tiene que ser una «manifestación libre, específica, informada e inequívoca». **No vale** el opt-out, las casillas premarcadas, el consentimiento puesto como condición de un servicio no relacionado, ni el obtenido con engaño. El silencio no implica consentimiento y se puede revocar en cualquier momento. Confianza M (las guías secundarias coinciden; **los números de artículo que da la guía de Orizontel no los verifiqué contra el texto oficial**). — [Orizontel](https://orizontel.ec/guia-lopdp-ecuador/); [GlobalSuite](https://www.globalsuitesolutions.com/es/claves-proyecto-ley-organica-proteccion-de-datos-personales-ecuador/)
- La ley reconoce el derecho de oposición y el derecho a no quedar sujeto a decisiones basadas únicamente en tratamiento automatizado. Las multas al sector privado van de 0,1% a 0,7% del volumen de negocio para infracciones leves y de 0,7% a 1% para las graves. La autoridad es la Superintendencia de Protección de Datos Personales. Confianza M (secundaria). — [Orizontel](https://orizontel.ec/guia-lopdp-ecuador/)
- Según la guía secundaria, la LOPDP **no menciona la geolocalización como categoría propia de dato sensible**. Los datos sensibles con consentimiento reforzado son otros (salud, biometría, etc.). Confianza B/NV: hay que confirmarlo contra el texto oficial y el Reglamento de 2023. — [Orizontel](https://orizontel.ec/guia-lopdp-ecuador/); [Reglamento, MINTEL](https://www.telecomunicaciones.gob.ec/ley-y-reglamento-de-la-ley-de-proteccion-de-datos-personales/)

### Inferences
- La ubicación sigue siendo un dato personal (identifica o hace identificable a alguien), así que su uso para marketing requiere un consentimiento con finalidad específica. Un «acepto los términos» que junte fidelización y ofertas por ubicación probablemente no alcanza: conviene un consentimiento separado para «avisos por cercanía» y otro para compartir datos con otros comercios de la red.
- Saber dónde está el usuario **solo cuando escanea o abre la app** es a la vez una limitación técnica y una ventaja de privacidad: no hay rastreo en segundo plano, que es justo lo que la gente percibe como invasivo.

### Gaps
- No obtuve las tasas de aceptación del permiso de geolocalización en la **web** (API Geolocation del navegador). El comunicado de Airship de 2019 sobre permisos móviles tras el GDPR devolvió 403.
- No verifiqué artículo por artículo el texto oficial de la LOPDP (definición de dato personal, reglas sobre publicidad o perfilado, y si la ubicación figura en algún lado).

## 5. Promoción cruzada en el mostrador en LatAm (bancos, Mercado Pago, Rappi)

### Takeaway
En LatAm el patrón dominante no es «estás cerca» sino un **descuento aplicado al pagar** (QR de billetera o tarjeta bancaria), que la billetera o el banco muestran en una sección de beneficios. No encontré datos públicos de desempeño.

### Cited Findings
- Mercado Pago ofrece descuentos al pagar con QR en comercios adheridos y los lista en la sección de beneficios o promociones de la app (restaurantes, laboratorios, tiendas). En eventos como Hot Sale o Buen Fin se suman descuentos por QR. Confianza B (agregadores de cupones; la página de ayuda oficial devolvió 403). — [Mercado Pago Ayuda (AR), «Cómo funcionan los descuentos con QR»](https://www.mercadopago.com.ar/ayuda/Como-funcionan-los-descuentos-con-QR_4324) (no accesible); [descuento.com.mx](https://www.descuento.com.mx/mercadopago)

### Inferences
- En la región el consumidor ya está acostumbrado a encontrar el beneficio al pagar y en un listado de beneficios, más que a recibir un push de cercanía. Una sección «Mis beneficios» con filtro por cercanía (con GPS cuando el usuario abre la app) calza con ese hábito.

### Gaps
- No encontré documentación pública de Rappi ni de bancos ecuatorianos (Banco Pichincha, Produbanco, Deuna) sobre ofertas cruzadas en el punto de venta, ni tasas de canje de descuentos por QR. Haría falta una búsqueda en español más específica o fuentes de la industria.
