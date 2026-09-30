# Capacidad ociosa y descubrimiento — marketplaces que llenan huecos o traen descubridores

Investigacion 2026-09-29. Dominio: marketplaces que llenan CAPACIDAD OCIOSA (horas muertas, excedente) o hacen
DESCUBRIMIENTO de negocios locales, traducidos a CheckPass (red de comercios de Cuenca, pase unico en Wallet).

**Nota de metodo (leer antes de citar):** el presupuesto de busquedas web de la sesion se agoto a mitad del
trabajo. Cada dato lleva su estado:
- **[V]** = leido en esta sesion en la fuente citada (buscador o pagina abierta).
- **[M]** = conocimiento previo del modelo, NO re-verificado hoy → «sin fuente» a efectos del encargo. No subirlo
  a un doc ni al owner sin buscarlo primero.
Las fuentes de marketing de las propias empresas (ClassPass, Too Good To Go, Panera) son auto-reportadas: sirven
para ver el mecanismo, no como prueba de incrementalidad.

---

## La pregunta de fondo en una linea

Un comercio chico de Cuenca tiene dos activos que se pierden cada dia y no aparecen en ninguna cuenta: **la silla
vacia de las 15:30** y **el pan que sobra a las 19:00**. Los marketplaces de este dominio ganan plata vendiendo
exactamente eso, con una regla comun: **se vende el hueco, no el producto** — y asi el descuento no canibaliza la
hora pico ni al cliente fiel. Groupon es el contraejemplo: desconto el producto entero, a cualquiera, a cualquier
hora, y fracaso para el comercio.

---

## 1. ClassPass — creditos + precio dinamico que solo vende el hueco

**A → mecanismo → B.** El consumidor paga una suscripcion mensual de creditos que gasta en cualquier estudio de la
red. El estudio fija un **piso de precio confidencial**; *SmartRate* sube o baja los creditos de cada clase segun
demanda, horario y ocupacion, sin bajar del piso; *SmartSpot* decide cuantos lugares abrir a ClassPass. Resultado
reportado: partners con SmartRate ~20% mas de pago, >2x visitantes nuevos, ~14% mas ocupacion (2024); **94% de los
usuarios son nuevos para el estudio que visitan**; 80% de los usuarios de prueba que se volvieron pagos volvieron a
un estudio que conocieron en la prueba; clases con >80% de ocupacion por miembros directos pagan 45% mas por el
lugar ClassPass (el precio refleja escasez).
Fuentes [V]: https://classpass.com/partners/blog/classpass-payouts-pricing-policies-rates ,
https://classpass.com/partners/blog/what-is-smartrate , https://athletechnews.com/classpass-tops-3-billion-in-partner-revenue/ ,
https://www.mindbodyonline.com/business/education/blog/how-classpass-works-for-businesses . Confianza **M** (datos del
propio vendedor, sin grupo de control publicado).
[M] Historia: en 2016 ClassPass cerro su plan «ilimitado» porque los usuarios mas intensivos iban siempre al mismo
estudio y el estudio perdia su socio directo — el paso a creditos con precio variable nacio de ahi. Confianza **B**
sin re-verificar.

**De B a C.** CheckPass no vende clases, pero cada comercio tiene una «curva de ocupacion» que el escaneo YA mide
(hora de cada escaneo). La red puede:
- **Consumidor:** en «Mis beneficios» ve «Ahora mismo, cerca tuyo» — beneficios que existen SOLO en la franja muerta
  de cada local (p. ej. cafe 15–17 h: capuchino + humita al precio del capuchino).
- **Comercio:** no fija un descuento, fija **dos cosas: su franja muerta y su «piso»** (lo maximo que esta dispuesto
  a regalar). Idealmente la franja la sugiere la red a partir de sus propios escaneos: «tu martes 15–17 h tiene 70%
  menos escaneos que tu promedio».
- **Red:** muestra el beneficio solo a quien NO es cliente frecuente del local (o a su propio cliente dormido), y
  solo dentro de la franja. Eso es SmartSpot en version barata: no canibalizar la hora pico ni al fiel.

**Por que es dificil de copiar.** El dato de ocupacion por hora sale gratis del escaneo en el mostrador; un
directorio o un Instagram no lo tienen. Y el grupo de control de CheckPass puede probar algo que ClassPass nunca
publico: si la visita en hora valle fue incremental.

**Viabilidad en Cuenca sin app:** **alta**. Es un beneficio con ventana horaria en la PWA + 1 aviso dirigido de
Wallet dentro de la franja. Riesgo: que el comercio no tenga una franja realmente muerta con suficiente trafico
de paso, o que el descuento en franja entrene al cliente fiel a venir solo a esa hora (mitigar mostrando solo a
no-frecuentes).

**Experimento (1 semana, 3 cafes):** sacar del historial de escaneos la peor franja de cada uno; crear un
beneficio valido solo en esa franja, visible solo para miembros de la red que NUNCA escanearon en ese cafe. Medir
escaneos en franja vs las 2 semanas anteriores y contra la mitad de la audiencia que no lo vio (grupo de control
existente).

---

## 2. Too Good To Go — el excedente como canal de adquisicion

**A → mecanismo → B.** El comercio publica «bolsas sorpresa» con lo que le sobra al cierre, a ~1/3 del precio, con
una ventana de retiro. El consumidor paga en la app y retira en el local. Resultado reportado: 58% de los usuarios
probo comercios nuevos a traves de la app y 76% dice haber vuelto como cliente regular a precio completo; en otra
encuesta, 73% «volveria». Escala: ~164.000 comercios, ~62 M usuarios, 23 paises (2024).
Fuentes [V]: https://www.toogoodtogo.com/en-gb/blog/attract-regular-cafe-restaurant-customers (via buscador; la
pagina devolvio 429 al abrirla), https://www.tipranks.com/news/private-companies/case-study-underscores-revenue-and-customer-benefits-of-too-good-to-go-model ,
https://en.wikipedia.org/wiki/Too_Good_To_Go . Confianza **M-B**: el 76% es auto-reporte declarado de usuarios, no
retorno medido. [M] Modelo de cobro: comision por bolsa + cuota anual; no verificado hoy.

**La clave lateral:** la bolsa SORPRESA no es un descuento, es una **muestra gratis que el cliente paga**. El
cliente no elige el producto (no canibaliza la venta normal), entra al local (lo conoce), y el costo marginal para
el comercio es casi cero (el pan ya estaba perdido).

**De B a C.**
- **Consumidor:** en la PWA, seccion «Rescates de hoy» — panaderia X, 18:30–19:30, bolsa de US$3 que vale ~US$9. Se
  reserva en la PWA; retira mostrando su pase (el mismo QR). **El retiro es el primer escaneo** → queda como cliente
  del comercio y entra al ciclo de vida (te extrañamos, etc.). Eso es lo que Too Good To Go no tiene: TGTG entrega el
  cliente y lo suelta; CheckPass lo retiene.
- **Comercio:** a las 17:00 toca un boton «hoy tengo 5 bolsas». Sin pago online al principio (paga en el local).
- **Red:** lo muestra primero a quien vive/trabaja cerca y no conoce el local.

**Por que dificil de copiar:** TGTG no hace fidelizacion; los sistemas de sellos no hacen adquisicion. La
combinacion «entras por el excedente, te quedas por el sello» es un embudo completo con medicion de retorno real
(escaneo a precio completo en los 30 dias siguientes), no una encuesta.

**Viabilidad en Cuenca:** **alta** para panaderias (rubro enorme en Cuenca, excedente diario seguro). Riesgos:
que el cliente de la bolsa sea «cazador de gangas» que nunca vuelve (el problema Groupon), y el no-show si no se
paga por adelantado. Sin pago propio todavia: reserva sin cobro, con limite de reservas por persona.

**Experimento (1 semana, 3 panaderias):** «bolsa de las 19 h» reservable en la PWA, 5 por dia por local. Medir:
reservas, retiros, % de retirantes que eran nuevos para el local, y **% que vuelve a escanear a precio completo en
30 dias** — ese numero es el argumento de venta a US$10/mes.

---

## 3. Groupon — la advertencia (lo que NO hay que construir)

**A → mecanismo → B.** Descuento fuerte (50%+) sobre el producto, sin restriccion de horario ni de publico, con
comision alta. Resultado: solo ~20% de los compradores volvio a precio completo; 21,7% ni canjeo; en 324 negocios,
55,5% gano plata, 26,6% perdio; menos de la mitad repetiria. Restaurantes y bares les fue peor que a fotografos,
fitness o turismo (servicios con capacidad ociosa y costo marginal bajo).
Fuentes [V]: https://knowledge.wharton.upenn.edu/article/death-daily-deal/ , https://ssrn.com/abstract=1790414 ,
https://doi.org/10.2139/ssrn.1863466 . Confianza **A** (academico, Dholakia/Rice).

**De B a C (reglas de diseño que salen de aca):**
1. **Nunca descontar a cualquiera a cualquier hora**: el beneficio de descubrimiento va a no-clientes y en franja
   valle. Groupon no podia saber quien ya era cliente; CheckPass si (el historial de escaneos del pase).
2. **El rubro importa**: la analogia funciona mejor donde el costo marginal del hueco es ~0 (gym, peluqueria a
   las 11, cafe en la tarde, panaderia al cierre) que en un restaurante lleno de insumos.
3. **Medir retorno a precio completo** es el numero honesto; el grupo de control lo hace creible.

**Viabilidad / experimento:** no aplica como idea; aplica como filtro para las otras.

---

## 4. Yield management de aerolineas/hoteles → «happy hour dinamico» (Eatigo, OpenTable)

**A → mecanismo → B.** Aerolineas y hoteles venden la misma silla a distintos precios segun cuando y cuanto falta.
Aplicado a restaurantes: **Eatigo** (Asia, ~4.500 restaurantes) reserva con descuento de hasta 50% que varia por
franja horaria — mayor descuento a las 15 h, cero a las 20 h. Fuente [V]:
https://vulcanpost.com/575551/eatigo-off-peak-dining-reservation-apps/ . Confianza **M** (mecanismo claro; sin datos de
resultado). [M] OpenTable da mesas de «puntos bonus» (p. ej. 1.000 puntos) en horarios flojos: el premio lo paga la
red/restaurante para mover demanda al valle. Confianza **B**, no verificado hoy.

**De B a C: «sellos dobles en hora valle»** — la version sin descuento. No se baja el precio: se sube el premio. El
sello de las 15 h vale doble; el de las 8 h vale uno. Para el comercio no hay plata que se va de caja hoy; el costo
es adelantar el premio. Para el consumidor es visible en el pase (campo «ahora: sello x2 hasta las 17 h»).
- **Red:** propone la franja desde los datos de escaneo; el comercio solo aprueba.
- **Surge inverso de ciudad:** «el martes a la tarde es x2 en toda la red» — un evento compartido que da un motivo
  para salir, igual que un Hot Sale pero para horas muertas.

**Por que dificil de copiar:** el multiplicador de sellos por hora solo existe si el sistema sabe la hora de cada
escaneo y lleva el saldo — es nativo de CheckPass.

**Viabilidad en Cuenca:** **alta** (es configuracion de reglas ya existentes + un campo en el pase). Riesgo: que el
fiel desplace su visita de la hora pico a la valle sin visita extra (canibalizacion horaria). Se mide: visitas por
cliente por semana, no solo escaneos en franja.

**Experimento (1 semana, 5 comercios):** x2 en la peor franja de cada uno para la mitad de sus clientes (control =
la otra mitad). Medir si sube la frecuencia total o solo se muda de hora.

---

## 5. Panera Sip Club — la suscripcion que compra FRECUENCIA

**A → mecanismo → B.** Bebidas ilimitadas por una cuota mensual (US$8,99 Coffee Club; US$10,99–14,99 Sip Club
segun epoca). El margen no esta en la bebida (costo casi cero) sino en lo que se agrega: suscriptores pasaron de ~4
a ~10 visitas/mes en el piloto, «food attachment» +70% / al menos 30% de las visitas; ~600.000 suscriptores a fines
de 2021, 43% eran clientes nuevos.
Fuentes [V]: https://www.foxbusiness.com/lifestyle/panera-unlimited-sip-club-subscription ,
https://thestreet.com/restaurants/panera-major-sip-club-change (Panera despues limito el «ilimitado»: el modelo
tuvo que ajustarse). Confianza **M** (cifras del CEO, cadena grande).

**De B a C: «Pase Cuenca» — suscripcion de ciudad pagada por el consumidor.** US$5–8/mes: 1 cafe por dia habil en
cualquier cafe de la red (en franja valle), + beneficios fijos en otros rubros (corte de pelo con 20% martes,
clase de prueba en 3 gyms).
- **Como gana el comercio:** la red le paga cada canje a un precio acordado (su «piso», como ClassPass: ej. US$0,80
  por un cafe de US$1,50 que cuesta US$0,35 hacer). Con eso el comercio **cobra** por llenar la hora muerta, y el
  pase le trae gente que nunca lo piso (en ClassPass, 94% de las visitas son de nuevos).
- **Como gana la red:** margen entre la cuota y los canjes (breakage: la gente paga 20 cafes y usa 9) — y sobre
  todo, **el consumidor financia la red**: si 1.000 suscriptores pagan US$6, son US$6.000/mes, lo que pagarian 600
  comercios a US$10. Invierte la ecuacion de venta: el comercio entra porque la red le trae gente que paga.
- **Riesgo que ya vivio ClassPass:** el «ilimitado» se lo comen los intensivos y el que va siempre al mismo local
  (costo sin descubrimiento). Mitigacion: tope diario, **maximo N canjes por mes en el mismo local**, y solo en franja
  valle — el pase empuja a rotar, que es el descubrimiento.

**Por que dificil de copiar:** requiere la red ya armada + el pase unico + el conteo de canjes por comercio (todo
existe). Un cafe solo no puede ofrecer «cafe en toda la ciudad».

**Viabilidad en Cuenca:** **media**. Necesita cobrar al consumidor (hoy no hay medios de pago propios; se puede
arrancar con transferencia/Payphone o efectivo en un punto) y liquidar a los comercios. Riesgo principal: la
disposicion a pagar en Cuenca y la confianza en que el comercio honre el canje; segundo, flujo de caja si la red
paga canjes antes de cobrar cuotas.

**Experimento (1 semana, 5 cafes, sin cobrar):** «Pase Cafe» gratis para 50 personas de la red: 1 cafe/dia en 15–18 h,
max 2 por local por semana. La red le paga a cada cafe US$0,80 por canje de su bolsillo (presupuesto ~US$150).
Medir: canjes, cuantos locales distintos visita cada persona, % de visitas a locales nuevos, compras agregadas
(el comercio anota si vendio algo mas), y al final: «¿pagarias US$5/mes por esto?» con precompra real (reservar
lugar con US$1) — una intencion con plata, no una encuesta.

---

## 6. Blackbird — moneda de red y la RELACION con el restaurante

**A → mecanismo → B.** Red de restaurantes (NYC y otras; ~600 activos) donde el cliente hace «check-in» tocando con
el telefono un «puck» NFC en el mostrador y gana $FLY, una moneda (1 $FLY ≈ US$0,01) gastable en cualquier
restaurante de la red. Niveles de membresia por check-ins (25–50+) o por saldo cargado (US$250–5.000 segun nivel);
el restaurante reconoce al cliente y le puede escribir; programa para trabajadores de la industria con bonus los
lunes/martes (dias flojos). Luego sumo pagos con 2% de comision. Recaudo US$85 M (a16z, Coinbase).
Fuentes [V]: https://www.expedite.news/p/blackbirds-big-loyalty-play-revealed ,
https://www.restaurantbusinessonline.com/technology/restaurant-loyalty-app-blackbird-launches-payment-network ,
https://www.blackbird.xyz/faqs (via buscador). Confianza **M**. Sin datos publicos de resultado para el restaurante.

**Leccion lateral:** Blackbird es casi CheckPass con app y cripto: check-in en el mostrador, moneda comun, niveles.
Las dos ideas copiables: (a) **la moneda de red lleva al gasto a otro local** (descubrimiento pagado con el propio
programa), (b) **bonus en dias flojos** para un segmento con horarios distintos (trabajadores de la industria →
en Cuenca: universitarios, que tienen huecos a media tarde).

**De B a C:** «puntos de ciudad»: una fraccion del sello de cada comercio se acumula en un saldo de red gastable en
comercios que el cliente NO visito nunca (solo ahi). El comercio que acepta el canje recibe un cliente nuevo; el que
lo emitio no pierde nada porque el cliente ya estaba. Nivel «Vecino de Cuenca» (visitaste 10 comercios distintos)
con beneficios que ponen los propios comercios.

**Viabilidad:** **media** (liquidar saldos entre comercios es contable y legalmente mas pesado; arrancar sin plata:
el canje es un beneficio fijo que el comercio receptor pone como costo de adquisicion). Riesgo: complejidad de
explicarlo al comercio chico.

**Experimento:** con los sellos existentes, dar «1 sello de bienvenida» en el comercio B a quien complete una tarjeta
en A. Medir cuantos lo canjean y vuelven a B.

---

## 7. Fever, Airbnb Experiences, Tock — crear demanda con un EVENTO, no con un descuento

**A → mecanismo → B.** [M] Fever usa los datos de busqueda/compra de su audiencia para detectar que quiere la gente
y **produce** eventos en lugares con capacidad ociosa (Candlelight: conciertos a la luz de velas en iglesias,
museos o salones vacios de noche). Airbnb Experiences convierte a un local en anfitrion de una experiencia con cupo.
Tock vende cupos prepagados (con fecha, hora y precio) en vez de reservas gratis, lo que elimina el no-show. Sin
fuente verificada hoy (el buscador se agoto; las paginas probadas dieron 404). Confianza **B**.

**De B a C: «Rutas con cupo».** La red arma, con datos de escaneos, una salida de 2–3 comercios cercanos que no se
conocen entre si (panaderia → cafe → heladeria en el Centro Historico, sabado 16 h, 12 cupos). Cada comercio pone
una degustacion; el consumidor reserva en la PWA (cupo limitado = urgencia sin descuento). Se conecta con la
idea del owner de rutas en la web publica (red-y-atencion §4), pero con **cupo, fecha y hora** — lo que la vuelve
evento y no folleto. Para turistas (Cuenca recibe muchos jubilados extranjeros y turismo) es una puerta de entrada.

**Viabilidad:** **media-alta** (una pagina con cupo + escaneo en cada parada). Riesgo: la coordinacion entre
comercios la tiene que hacer la red a mano al principio.

**Experimento:** 1 ruta, 3 comercios, 2 sabados, 12 cupos. Medir llenado y retorno de los participantes a cada
comercio en 30 dias.

---

## Traduccion directa: ¿que gana un cafe de Cuenca?

- **Horas muertas llenas:** cada silla que se llena a las 15:30 es margen casi puro (cafe ~US$0,30–0,40 de costo, [M]
  estimado). Si la red le cobra US$10/mes, alcanza con **~8–10 cafes extra por mes** en la franja valle para que el
  producto se pague solo — un numero que el informe «en plata» puede mostrar con grupo de control.
- **Descubridores:** el cliente nuevo que viene por la red entra al ciclo de vida del propio comercio (sello,
  te extrañamos). TGTG y ClassPass entregan al cliente y lo pierden en su app; CheckPass lo deja fidelizado con el
  comercio.
- **¿Puede pagar el consumidor y financiar la red?** Si, con condiciones: la evidencia (ClassPass, Panera) dice que el
  consumidor paga por **acceso + variedad + frecuencia**, no por puntos. El formato que encaja es un pase de ciudad
  barato con canje en franja valle y tope por local; el comercio COBRA por canje (no regala). Riesgos: cobrar sin
  medio de pago propio, y el diseño anti-intensivos. Se prueba primero gratis con plata de la red (§5) antes de
  construir cobro.

---

## Ranking — mis 3 mejores ideas

1. **«Ahora mismo, cerca tuyo» — beneficio de franja valle solo para no-clientes** (ClassPass SmartRate/SmartSpot +
   la leccion de Groupon). Barato, usa lo que ya existe (escaneo con hora, beneficios, grupo de control), y ataca el
   resultado 2 de la mision (clientes nuevos) sin canibalizar. Lo que ningun competidor puede: elegir la franja
   con el propio historial de escaneos y probar incrementalidad.
2. **«Rescates de hoy» — bolsa sorpresa de panaderia retirada con el pase** (Too Good To Go + fidelizacion). El
   retiro ES el primer escaneo: adquisicion y retencion en un mismo flujo, costo marginal cero para el comercio, y
   el rubro panaderia en Cuenca es enorme.
3. **Sellos x2 en hora valle / «Surge inverso» de la red** (yield management sin descuento). No saca plata de caja,
   mueve demanda al valle, y un «martes x2 en toda la red» es un evento compartido que da identidad a la red.

## Idea «loca» para discutir

**El consumidor financia la red: «Pase Cuenca» de US$5–8/mes con canjes en franja valle que la red le PAGA a cada
comercio.** Invierte el modelo: el comercio deja de ser el que paga US$10 por un software y pasa a ser el que
**cobra** por cada cliente que la red le manda en su hora muerta. Con ~1.000 suscriptores la red recauda lo que
600 comercios pagando US$10. Es lo que convierte a CheckPass de «software de fidelizacion» en «la red de la
ciudad», y prepara el terreno natural para los medios de pago propios que el owner ya tiene en el horizonte. Es
loca porque exige cobrar al consumidor, liquidar a comercios y diseñar contra el abuso — por eso se prueba primero
regalando 50 pases con US$150 de la red durante una semana.
