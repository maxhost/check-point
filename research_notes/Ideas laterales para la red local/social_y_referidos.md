# Crecimiento social, referidos y comunidad — ideas laterales para CheckPass

> Dominio: el CLIENTE como canal. Investigado el 2026-09-29. Confianza: A = fuente primaria u oficial,
> M = fuente secundaria seria o Wikipedia, B = blog o memoria sin verificar. Lo que no tiene URL dice
> «sin fuente». **Aviso de medicion:** el cupo de busquedas web de la sesion se agoto a mitad del trabajo;
> Uber, Lululemon y el «kan jia» de Pinduoduo quedaron sin fuente leida y estan marcados asi.

**La tesis del dominio en una linea:** la red tiene algo que ningun comercio suelto tiene: sabe que el
cliente del Cafe A tambien va a la Panaderia B. Eso permite **pagar el referido en OTRO comercio** (el
comercio que recibe al cliente nuevo no paga todo solo) y **devolverle al cliente una identidad de ciudad**
(«tu año en Cuenca») que un comercio suelto no puede armar. Ademas, el canal social (el cliente le manda un
link a un amigo) **no gasta ninguno de los 3 avisos diarios de Google Wallet**: es el unico canal de captacion
que no compite por ese cupo.

---

## 1. Referido de dos lados (Dropbox, Uber) → «Traé a un amigo, ganan los dos, en cualquier comercio de la red»

1. **A → mecanismo → B.** Dropbox (sept. 2008) dio 500 MB **al que invita y al invitado**, con tope de 16 GB.
   Las altas pasaron de 100.000 a 4.000.000 en 15 meses y en el pico ~35 % de las altas diarias venian de
   referidos; el premio era lo que el usuario mas pedia (espacio), no plata.
   Fuentes: https://viral-loops.com/blog/dropbox-grew-3900-simple-referral-program/ ,
   https://growsurf.com/blog/dropbox-referral-program/ — confianza **M** (secundarias que citan el post
   original de Houston; las cifras son consistentes entre ellas).
   Uber: credito de viaje gratis para ambos lados al primer viaje del invitado — **sin fuente** (memoria, B).
   **Contrapunto medido — Nubank:** «we acquired approximately 90% of our customers organically in the six
   months ended June 30, 2021, either through word-of-mouth or a direct **unpaid** referral», con un CAC de
   US$4,95 (prospecto F-1 ante la SEC,
   https://www.sec.gov/Archives/edgar/data/1691493/000095012321012993/filename1.htm — confianza **A**).
   O sea: Nubank crecio por referido **sin pagarlo**. El pago acelera; lo que hace que alguien recomiende es
   que el producto le guste.
2. **De B a C.**
   - *Consumidor:* en «Mis beneficios» ve «Invita a un amigo al Cafe A». Toca, se abre el menu nativo de
     compartir (Web Share API, anda en la PWA y en el navegador sin instalar) y el amigo recibe un link
     `checkpass.club/i/<codigo>`. Cuando el amigo **escanea por primera vez** en el Cafe A, los dos ganan.
   - *El giro de red:* el premio del que invita **puede venir de otro comercio**: «trajiste a Ana al Cafe A →
     tenes 1 sello extra en la Panaderia B (donde ya sos cliente)». La Panaderia B pone un sello (costo casi
     cero, y ademas le trae una visita propia); el Cafe A recibe un **cliente nuevo desde la red**, que es
     exactamente el resultado (2) que el comercio tiene que percibir.
   - *Comercio:* solo activa «acepto referidos» y elige que regala al invitado (p. ej. 2 sellos de arranque).
     En su panel: «3 clientes nuevos traidos por clientes de la red este mes».
   - *Red:* valida (cuenta nueva o primer escaneo en ese comercio; un premio por par de personas; tope por
     mes), atribuye y **mide contra el grupo de control** que ya existe: ¿los referidos vuelven mas que los que
     llegaron solos?
3. **Por que es innovador / dificil de copiar.** Un referido comun lo paga el mismo comercio que recibe al
   cliente. Aca el costo **se reparte en la red** y el premio del que invita cae donde el ya compra, lo que
   ademas genera una visita en un tercer comercio. Un Fidely o una tarjeta de papel no puede: no sabe donde
   mas compra el cliente.
4. **Viabilidad: alta.** Todo es web + escaneo, no toca Wallet ni push. **Riesgo principal:** fraude
   (autoreferido con dos cuentas, «amigos» que ya eran clientes). Mitigacion: el premio se libera en el
   **primer escaneo en el mostrador** (una persona fisica frente al comercio), no en el alta.
   **Riesgo secundario a decidir:** el owner descarto WhatsApp *como canal de la plataforma*; aca el que
   comparte es el cliente, desde su propio telefono. No es lo mismo, pero hay que preguntarle.
5. **Experimento (1 semana, 3 comercios).** Un cafe, una panaderia y una peluqueria del mismo barrio. Link de
   invitacion generado a mano (codigo en la URL) + planilla. Premio del invitado: 2 sellos de arranque; premio
   del que invita: 1 sello en el comercio de la red que el elija. Medir: invitaciones enviadas, links abiertos,
   primeros escaneos. Umbral de exito: ≥ 1 cliente nuevo por comercio por semana atribuible.

## 2. Compra en grupo (Pinduoduo) → «Mesa completa»: la oferta que se desbloquea si van juntos

1. **A → mecanismo → B.** Cada producto muestra dos precios: individual y de grupo. El que arma o se suma a un
   grupo tiene un plazo (24 h) para completarlo; si no se completa, se cancela. El comprador hace el marketing:
   para conseguir el precio tiene que traer gente. Pinduoduo (fundada en 2015) supero a Alibaba en compradores
   activos en 2020 (788,4 millones). Fuentes:
   https://www.uxmatters.com/mt/archives/2024/12/how-pinduoduos-group-buying-model-shapes-the-asian-ecommerce-experience-1.php
   (M), https://en.wikipedia.org/wiki/Pinduoduo (M). La variante «kan jia» (tus amigos tocan el link y te
   bajan el precio) — **sin fuente** leida (B).
2. **De B a C.**
   - *Consumidor:* ve en «Mis beneficios»: «Almuerzo en El Patio: **4 personas = postre gratis para todos** —
     arma tu mesa (quedan 47 h)». Comparte el link; cada amigo toca «me sumo» (crea cuenta si no tiene: ese
     es el anzuelo de captacion). Con 4, la oferta queda activa en el pase de los 4.
   - *Comercio:* elige una oferta «de grupo» para su hora muerta (martes 15 h en un cafe, lunes en la
     peluqueria: «vengan 3 amigas y el brushing sale a mitad»). Es lo que mejor le sirve a un restaurante o
     un gimnasio (clase de prueba para 3).
   - *Red:* sostiene el grupo, el plazo y el canje (cada uno escanea su pase; la oferta se consume cuando llega
     el grupo o por persona, a definir).
3. **Innovador / dificil de copiar.** Convierte a cada cliente en vendedor de un momento concreto (una mesa,
   una clase), no de una marca. El grupo trae **varios clientes nuevos de una vez**, y lo hace con gente que
   ya se conoce: es la forma mas natural de probar un lugar en una ciudad mediana.
4. **Viabilidad: media.** Sin app, el grupo vive en un link. **Riesgo principal:** masa critica — si el cliente
   no logra juntar a 4, la experiencia es un fracaso publico. Mitigacion: grupos de 2 o 3, y que la oferta
   base siga valiendo en version individual.
5. **Experimento.** 2 restaurantes y 1 gimnasio. Una oferta de grupo cada uno, link + formulario simple, plazo
   de 72 h. Medir: grupos iniciados vs completados vs canjeados, y cuantos de los sumados eran cuentas nuevas.

## 3. Regalos entre amigos (Starbucks eGift, sobres rojos de WeChat) → «Invita un cafe» y el premio transferible

1. **A → mecanismo → B.**
   - Starbucks lanzo en enero de 2011 las eGifts: mandar saldo a un email o a un amigo de Facebook; ese año
     venia de US$1.500 millones en tarjetas de regalo (+21 %). Hoy se manda desde la app o desde iMessage a
     un numero de telefono. https://techcrunch.com/?p=195999 (M), https://www.starbucks.com/gift (A).
   - WeChat (enero de 2014) digitalizo el *hongbao*: sobres privados o **grupales, con el monto repartido al
     azar**. En la gala de Año Nuevo 2015 se mandaron 1.200 millones de sobres y hubo picos de 810 millones de
     «sacudidas» por minuto; entre 100 y 200 millones de usuarios vincularon su cuenta bancaria, y WeChat Pay
     mas que duplico su participacion. El regalo fue la excusa para dar el paso con friccion (vincular la
     tarjeta). https://en.wikipedia.org/wiki/WeChat_red_envelope (M).
2. **De B a C.**
   - *Premio transferible:* el cliente completo la tarjeta del Cafe A y tiene «1 cafe gratis». Nuevo boton:
     **«Regalarselo a alguien»** → link. El que lo recibe tiene que crear cuenta para canjearlo (igual que
     WeChat: el regalo es el motivo para superar la friccion del alta). El comercio no pierde nada (el premio
     ya estaba ganado) y gana una **cara nueva en el mostrador**.
   - *«Invita un cafe» pago:* hoy, sin medios de pago propios, lo financia el comercio como cupon de captacion
     que *entrega el cliente* («tenes 1 cafe para regalarle a alguien que nunca vino»). Con los medios de pago
     del futuro, pasa a ser el Starbucks eGift real, y el cliente lo paga.
   - *Sobre de fiestas:* en fechas de Cuenca (fundacion y fiestas de noviembre, Pase del Niño en diciembre,
     Carnaval) la red reparte un «sobre» a un grupo de amigos, con premios de comercios distintos asignados al
     azar. Es la unica forma en que un premio de la Panaderia B le llega a alguien que nunca la piso.
3. **Innovador / dificil de copiar.** El regalo lleva la marca de la persona, no la del comercio: «Ana te
   invito un cafe» se abre; «Cafe A te ofrece 20 %» no. Y el sobre grupal con premios de varios comercios
   **solo lo puede hacer una red**.
4. **Viabilidad: alta** (transferible y cupon entregado por el cliente); **baja** para el pago real hasta
   tener medios de pago. **Riesgo principal:** reventa o canje de premios entre cuentas propias. Mitigacion:
   un regalo por premio, canje solo en el mostrador, y que el regalado sea cuenta nueva o no cliente de ese
   comercio (si no, no es captacion).
5. **Experimento.** 4 comercios. A los clientes que canjean un premio en la semana se les ofrece «regalarlo en
   vez de usarlo» (a mano, con link). Medir: tasa de regalo, tasa de canje del regalado y cuantos regalados
   vuelven a los 30 dias.

## 4. Cafe pendiente (caffe sospeso de Napoles) → «Cuenca pendiente»: los sellos sobrantes como gesto de barrio

1. **A → mecanismo → B.** En los cafes populares de Napoles, alguien paga dos cafes y toma uno; el otro queda
   «suspendido» para quien lo pida. Revivio despues de 2008 y en la pandemia; una campaña de Facebook de 2013
   llego a mas de 15 millones de cafes en 34 paises (cifra de la propia campaña) y lo adoptaron Starbucks y
   Tim Hortons. https://en.wikipedia.org/wiki/Suspended_coffee — confianza **M** (la cifra de 15 millones es B).
2. **De B a C.**
   - *Consumidor:* los sellos que se le van a vencer o los puntos que le sobran pueden **donarse** al «cafe
     pendiente» del comercio. En el mostrador del Cafe A un cartel con QR: «hoy hay 7 cafes pendientes, donados
     por clientes de la red».
   - *Comercio:* decide si participa y cuantos canjes pendientes por dia acepta. Gana algo que el descuento no da:
     reputacion en el barrio (y la nota del diario local).
   - *Red:* el contador publico por comercio y por ciudad («Cuenca lleva 1.240 cafes pendientes»). Puede
     sumarse una institucion (municipio, universidad, una fundacion) que sponsorea.
3. **Innovador.** Es la unica idea de esta lista que **no es un descuento**: le da a la red una razon de
   existir que un vecino puede contar. Y aprovecha un pasivo que hoy se pierde (sellos que vencen).
4. **Viabilidad: media.** Tecnicamente simple. **Riesgo principal:** quien reclama el cafe (verguenza,
   abuso, seleccion). Mitigacion: delegar la entrega en el comercio, que ya lo hace a ojo en Napoles.
5. **Experimento.** 1 cafe durante 1 semana, pizarra fisica + boton «donar mi sello» a mano. Medir donaciones
   y si los donantes vuelven mas (contra el grupo de control).

## 5. Feed social de pagos (Venmo) → «Pasa en tu barrio»: prueba social agregada, no chismosa

1. **A → mecanismo → B.** Venmo muestra un feed de pagos entre amigos (con emoji y memo); la prensa atribuyo
   parte de su crecimiento a esa visibilidad. Un experimento publicado en PLOS One encontro que **ver las
   transacciones de otros aumenta la disposicion a pagar** (efecto de pares).
   https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0340550 (A, estudio revisado por pares;
   leido solo en resumen), https://www.sciencedirect.com/science/article/pii/S0736585320300885 (A, descriptivo).
   El feed publico de Venmo fue tambien un escandalo de privacidad recurrente (memoria, B).
2. **De B a C.** En «Mis beneficios», una franja: «**32 vecinos canjearon en la Panaderia B esta semana**»,
   «Tus amigos van a…» (solo si ambos lo aceptaron). Siempre agregado y anonimo por defecto. El comercio lo ve
   como vidriera gratis; la red elige que mostrar segun cercania (los 2 km que ya decidio el owner).
3. **Innovador.** Convierte el dato que la red ya tiene (escaneos) en prueba social local sin que nadie escriba
   una reseña.
4. **Viabilidad: alta** en la version agregada; **baja** en la version con nombres (privacidad, ley de datos de
   Ecuador — LOPDP 2021 — a revisar). **Riesgo:** que los numeros chicos del piloto («2 vecinos») jueguen en
   contra: mostrar solo arriba de un umbral.
5. **Experimento.** A/B en «Mis beneficios»: la mitad de los clientes ve el contador junto a cada beneficio. Medir
   tasa de canje de beneficios de comercios donde el cliente **no es miembro**.

## 6. Vecindario verificado (Nextdoor) → el BARRIO como unidad de lanzamiento y de identidad

1. **A → mecanismo → B.** Nextdoor verifica nombre y domicilio; un vecindario lo abren «miembros fundadores» y
   hacen falta **al menos 10 hogares** para lanzarlo. Uno de sus usos centrales es pedir recomendaciones de
   servicios locales. 88 millones de miembros declarados (2024).
   https://en.wikipedia.org/wiki/Nextdoor (M).
2. **De B a C.** Lanzar la red **barrio por barrio**, no comercio por comercio: «Club San Sebastian» se abre
   cuando 8 comercios del barrio se suman (el umbral de Nextdoor aplicado a comercios). El cliente ve en el pase
   y en la PWA «Sos del Club San Sebastian»; los comercios del barrio se recomiendan entre si en el escaneo
   (esto ya lo pensaba el owner con el cupon cruzado). Los primeros clientes del barrio son «fundadores» con
   un sello simbolico permanente.
3. **Innovador.** El «2 km» del owner deja de ser un filtro tecnico y se vuelve una **identidad** con nombre
   propio. Es tambien una estrategia comercial: un vendedor cierra un barrio, no un comercio suelto, y la
   densidad es lo que hace que el cupon cruzado funcione.
4. **Viabilidad: alta.** **Riesgo:** en barrios con pocos comercios adheridos, el club se ve vacio. No abrirlo
   hasta el umbral.
5. **Experimento.** Elegir un barrio de Cuenca con densidad (Centro Historico, Remigio Crespo, El Vergel) y
   proponer el «club» a 8 comercios en una semana de visitas. Medir cuantos aceptan con el club vs. el pitch
   individual (es un experimento de VENTA, no de producto).

## 7. Identidad para compartir (Spotify Wrapped) → «Tu año en Cuenca» (y «Tu año con tus clientes» para el comercio)

1. **A → mecanismo → B.** Desde diciembre de 2016, Spotify arma un resumen personal (tus 5 artistas, canciones,
   generos) en pantallas pensadas para compartirse. En diciembre de 2019 hubo mas de 1,2 millones de posts en
   Twitter sobre Wrapped, y su lanzamiento se correlaciona con subidas en el ranking de la tienda de apps:
   millones de personas promocionan a Spotify sin cobrar. https://en.wikipedia.org/wiki/Spotify_Wrapped (M).
2. **De B a C.**
   - *Consumidor:* en diciembre, una pagina de la PWA (no hace falta instalar nada): «**Tu año en Cuenca**: 64
     cafes en 3 cafeterias, tu panaderia es La Tienda de Rosa, sos del 5 % mas fiel de El Patio, recorriste 4
     barrios». Boton para descargar la imagen en formato historia de Instagram. Titulo tipo: «Sos un Madrugador
     de San Sebastian».
   - *Comercio:* su propio Wrapped: «tus 10 clientes mas fieles, cuantos clientes nuevos te trajo la red,
     cuanto vendiste de mas contra el grupo de control». Es el informe «en plata» que el owner ya tenia
     previsto, envuelto para que el comercio **lo publique** («gracias a nuestros 312 clientes fieles»).
   - *Red:* cada imagen compartida lleva la marca CheckPass y un link: es la publicidad anual gratis de la red.
3. **Innovador / dificil de copiar.** Ningun comercio suelto puede decirte «tu año en Cuenca»; solo la red ve
   los cruces entre comercios. Es el dato de red transformado en identidad, y la identidad se comparte sola.
4. **Viabilidad: alta** (todo con datos que ya existen, una pagina web y una imagen generada). **Riesgo:** con
   pocos meses de datos en el piloto, el resumen queda pobre; y exponer habitos puede incomodar. Mitigacion:
   hacerlo trimestral al principio («tu invierno en Cuenca») y que compartir siempre sea opt-in.
5. **Experimento.** Generar a mano (una consulta + una plantilla) el resumen de los 50 clientes con mas
   escaneos de 3 comercios y mandarlo por el canal que ya tengamos (link en «Mis beneficios»). Medir: aperturas
   y cuantos lo comparten (preguntando a los comercios o con el link rastreado).

## 8. Embajadores y micro-influencers pagados en especie (Lululemon y cia.) → «Embajadores de barrio»

1. **A → mecanismo → B.** Lululemon tiene embajadores locales (instructores de yoga o de gimnasio de la zona de
   cada tienda) que reciben producto y visibilidad a cambio de dar clases y traer comunidad a la tienda — **sin
   fuente** leida (la pagina oficial no respondio; memoria, B). El patron general del marketing con
   micro-influencers es pagar en producto a cuentas chicas con audiencia local y confiable (B).
2. **De B a C.**
   - *Embajador cliente:* la red detecta a los clientes que visitan **muchos comercios distintos** (el dato solo
     lo tiene la red). Se les ofrece ser «Embajador del Club X»: un codigo propio, un beneficio fijo por mes
     armado con aportes chicos de 5 comercios (un cafe por semana, un corte al mes), a cambio de traer gente
     (medido con el referido de la idea 1).
   - *Creador local:* un tiktoker o instagrammer de Cuenca con 3.000–20.000 seguidores recibe un «pase de
     creador» con beneficios en 10 comercios de la red a cambio de una «ruta» publicada (se empalma con las
     rutas de la web publica que el owner ya penso). Cada comercio aporta poco; el creador recibe mucho.
3. **Innovador.** Un comercio chico no puede pagar a un creador; diez comercios poniendo un cafe cada uno, si.
   La red **junta el pago en especie** que ningun comercio solo alcanza.
4. **Viabilidad: media.** **Riesgo:** la calidad y el tono del creador (un mal video quema a 10 comercios) y la
   coordinacion. Mitigacion: el comercio aprueba entrar a cada ruta.
5. **Experimento.** 1 creador, 5 comercios, 1 ruta, 1 semana. Codigo propio del creador en el link. Medir
   cuentas nuevas y primeros escaneos atribuibles, contra el costo en especie.

## 9. Monedas locales (Bristol Pound, Banco Palmas) → los puntos como «moneda de la red» (con cuidado)

1. **A → mecanismo → B.**
   - Banco Palmas (Conjunto Palmeira, Fortaleza, 2000): moneda social «palma», 1:1 con el real, que circula solo
     en el barrio; **los comercios dan 5–10 % de descuento a quien paga en palmas**. En 2010 la aceptaban ~240
     comercios. https://en.wikipedia.org/wiki/Banco_Palmas (M). El articulo no trae medicion del efecto sobre el
     consumo local.
   - Bristol Pound (2012): 1:1 con la libra, papel y pago por SMS con 1 % de comision; ~800 comercios en 2015 y
     £5 millones circulados hacia 2017. **Cerro en 2020–2021**: el uso bajaba desde 2017 y el municipio corto el
     apoyo desde 2018; su sucesor digital cerro en 2023 por falta de fondos.
     https://en.wikipedia.org/wiki/Bristol_Pound (M).
2. **De B a C.** La leccion es doble. La de Palmas: **el descuento del comercio** es lo que hace que la moneda
   circule — no la conciencia local. La de Bristol: una moneda que vive de subsidio y de militancia se apaga.
   Traduccion: «puntos de la red» ganados en A y gastables en B **solo** si el comercio B lo elige como
   herramienta de captacion (le cuesta un descuento, gana un cliente nuevo), nunca como obligacion. Es el paso
   intermedio natural antes de los **medios de pago propios** del plan a mediano plazo.
3. **Innovador.** Posiciona la red como «plata que se queda en Cuenca», un relato que el municipio y la prensa
   compran.
4. **Viabilidad: baja por ahora.** **Riesgo principal:** la canibalizacion entre socios que ya documento el
   informe de coaliciones (Dorotic et al.), mas la contabilidad entre comercios (quien le debe a quien) y la
   posible regulacion de dinero electronico en Ecuador (a verificar). No es para el piloto.
5. **Experimento.** Ninguno de producto. Uno de conversacion: preguntar a 5 comercios si aceptarian «puntos de
   otro comercio» con descuento a cambio de clientes nuevos, y cuanto descuento.

## 10. Clubes de barrio y tribus → «clubes» por habito, no por comercio

1. **A → mecanismo → B.** Clubes de corredores, de lectura y de cafe son la forma clasica de retener por
   pertenencia, no por descuento — **sin fuente** (patron general, B). Nextdoor (idea 6) y Wrapped (idea 7) son
   versiones digitales del mismo impulso.
2. **De B a C.** Clubes que la red arma sola con los escaneos: «Madrugadores» (escaneas antes de las 9 en 3
   comercios), «Ruta del pan», «Club del corte» (peluqueria + barberia + gimnasio). El club da un beneficio
   rotativo de sus comercios y una insignia en el pase. Es tambien un **segmento** para campañas: exactamente
   el perfil enriquecido que pide el owner, pero visible y valorado por el cliente en vez de oculto.
3. **Innovador.** El segmento se vuelve algo que el cliente **quiere tener**, en lugar de algo que se le hace.
4. **Viabilidad: media-alta.** **Riesgo:** demasiados clubes diluyen el valor; empezar con uno.
5. **Experimento.** Un club («Madrugadores») con 3 cafes y 1 panaderia, una semana, insignia manual en la
   PWA. Medir si los miembros aumentan las visitas antes de las 9 contra el grupo de control.

---

## Ranking

1. **Referido cruzado de dos lados (idea 1).** Ataca directo el resultado (2) de la mision —clientes NUEVOS
   desde la red—, no gasta avisos, se atribuye con el escaneo y **se mide contra el grupo de control**, que es
   el diferencial que ningun competidor probo. Y el premio pagado en otro comercio es algo que solo una red
   puede hacer.
2. **«Tu año en Cuenca» + el Wrapped del comercio (idea 7).** Publicidad anual gratis para la red y, del lado
   del comercio, el informe «en plata» convertido en algo que el comercio **quiere mostrar**: la percepcion de
   valor que decide si paga los US$10.
3. **Premio transferible / «invita un cafe» (idea 3).** El regalo es el motivo mas fuerte para que alguien
   supere la friccion de crear la cuenta (WeChat lo probo a escala), no le cuesta nada extra al comercio (el
   premio ya estaba ganado) y deja preparado el terreno para los medios de pago.

**Idea loca para discutir — «El sobre de las fiestas de Cuenca».** En noviembre (fiestas de la ciudad) la red
—no un comercio— reparte sobres digitales **grupales al estilo WeChat**: un cliente abre un sobre y lo comparte
con su grupo de amigos; cada uno que lo toca se lleva un premio **al azar** de un comercio distinto de la red
(cafe en A, pan en B, 20 % en la peluqueria C), y para abrirlo hay que tener cuenta. Cada comercio aporta 20
premios; la red los reparte entre desconocidos que nunca lo pisaron. Es captacion masiva, en fecha propia de la
ciudad, sin gastar un solo aviso de Wallet, y con una propiedad rara: **el azar hace que un premio de la
panaderia le llegue a alguien que jamas la habria elegido**. Riesgo: el premio al azar tiene baja tasa de canje
(el que queria cafe se saco una peluqueria) — por eso hay que medirlo con grupo de control y no a ojo.
