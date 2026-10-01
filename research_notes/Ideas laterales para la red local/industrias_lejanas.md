# Industrias lejanas — pensamiento lateral para CheckPass

> Dominio: citas, salud, educacion, medios locales, clubes de suscripcion, aerolineas, turismo, economia
> conductual. Fecha: 2026-09-29. Formato del `_encargo.md`.
>
> **Nota de honestidad sobre las fuentes.** El presupuesto de busqueda web de la sesion se agoto a mitad del
> trabajo. Lo que tiene URL y confianza **A** lo lei en esta sesion (resultado de busqueda o pagina abierta).
> Lo marcado **«de memoria, sin verificar en esta sesion»** es literatura que conozco pero no pude abrir: hay
> que re-verificarlo antes de citarlo en una spec, ADR o mensaje al owner (regla del CLAUDE.md).

---

## 1. Economia conductual — progreso dotado (Nunes & Dreze 2006)

**A → mecanismo → B.** En un lavadero de autos se entregaron dos tarjetas de fidelidad: una de 8 sellos
vacia y otra de 10 sellos con 2 ya puestos. En los dos casos faltaban 8 lavados. La tarjeta «ya empezada»
se canjeo mas (34 % contra 19 %) y se completo mas rapido. Lo que cambia es el encuadre: la tarea pasa de
«no empezada» a «empezada e incompleta».
**Cita verificada:** Nunes, J. C. & Dreze, X. (2006). *The Endowed Progress Effect: How Artificial
Advancement Increases Effort*. Journal of Consumer Research, 32(4), 504–512.
https://academic.oup.com/jcr/article-abstract/32/4/504/1787425 — **Confianza A** (autores, revista,
volumen, paginas y diseño confirmados. El 34 % frente a 19 % sale de resumenes secundarios coherentes entre
si, por ejemplo https://loyaltyrewardco.com/loyalty-psychology-series-endowed-progress-effect/. Conviene
confirmarlo con el PDF de SSRN: https://papers.ssrn.com/sol3/papers.cfm?abstract_id=991962).

Relacionado: el **goal-gradient** (Kivetz, Urminsky & Zheng 2006, *Journal of Marketing Research* 43(1)).
Con tarjetas de cafe, la frecuencia de compra sube a medida que el cliente se acerca al premio. *De memoria,
sin verificar en esta sesion* — **M**.

**De B a C.**
- **«Sellos de bienvenida de la red».** Cuando un cliente de la red entra por primera vez a un comercio al
  que llego desde la red, su tarjeta arranca en 2/10 y no en 0/8. La etiqueta visible dice «2 sellos por
  ser de la red CheckPass». El comercio no regala nada extra: define un premio a 10 sellos con 2 dotados, que
  es el mismo esfuerzo que 8. La red decide a quien le corresponden (solo al que ya tiene historial en otro
  comercio).
- **El push escaso va al cliente que esta a un sello del premio.** Por el goal-gradient, «te falta 1» es el
  aviso con mas rendimiento por unidad del cupo de 3 por dia. Le gana a «te extrañamos».

**Por que es innovador / dificil de copiar.** Una tarjeta de sellos suelta no puede dotar progreso «por ser
de la red», porque no sabe quien sos. En CheckPass el progreso dotado se vuelve el mecanismo que convierte al
cliente de la red en cliente nuevo del comercio, que es el resultado (2) que el comercio tiene que percibir.
Ademas cuesta cero en producto.

**Viabilidad sin app / en Cuenca: ALTA.** Es un campo en la tarjeta (sellos iniciales) mas una regla de
elegibilidad. Riesgo: que el comercio lo lea como «me regalan mis sellos». Hay que mostrarle que el esfuerzo
exigido es el mismo.

**Experimento (1 semana).** Dos comercios nuevos de la red. A la mitad de los clientes de la red que se suman
(aleatorio, con el grupo de control que ya existe) se le da 2/10 y a la otra mitad 0/8. Se mide la segunda
visita dentro de los 14 dias. Una semana alcanza para ver la señal de segunda visita, no la de canje.

---

## 2. Apps de citas — emparejamiento de dos lados con reciprocidad y el «¿se vieron?»

**A → mecanismo → B.** Hinge sugiere una sola persona por dia («Most Compatible»), elegida por la
probabilidad de interes MUTUO. Despues de una cita pregunta «We Met: ¿se vieron? ¿como fue?» y usa esa
respuesta del mundo real para entrenar las recomendaciones siguientes. Declaran que esos matches tienen 8x
mas chance de terminar en cita. Fuentes: TechCrunch (https://techcrunch.com/?p=1668547) y resumenes
(https://www.swipestats.io/blog/hinge-most-compatible). Se suele citar Gale-Shapley (emparejamiento
estable). **Confianza M**: la cifra de 8x es de la empresa, sin auditar.

**De B a C.**
- **«Tu comercio del dia».** En «Mis beneficios», una sola recomendacion diaria de un comercio donde todavia
  NO es miembro. No es una lista de 40 ofertas. Se elige por probabilidad mutua: que al consumidor le guste
  (perfil de rubros, horario, zona) Y que al comercio le convenga (tiene capacidad en ese horario, busca ese
  tipo de cliente).
- **El «like» del comercio.** El comercio declara que quiere en dos toques: «quiero clientes de mañana entre
  semana», «quiero gente que ya va a gimnasios». Solo hay match cuando el perfil del consumidor coincide, y
  recien ahi se muestra la oferta. El comercio no paga por impresiones, paga por matches.
- **El «We Met» de CheckPass lo da el escaneo.** El escaneo ya confirma que la cita ocurrio, sin preguntar.
  Lo que se agrega es una pregunta de un toque en la vista del cliente despues de la primera visita:
  «¿Volverias?». Esa respuesta y la segunda visita real entrenan el perfil. Es el perfil enriquecido que
  pide el owner, alimentado por resultados y no por clics.

**Por que es innovador.** Los marketplaces de cupones (Groupon) optimizan la primera visita. Esto optimiza
el MATCH que produce una segunda visita, y el escaneo es un oraculo que las apps de citas no tienen: ellas
dependen de que el usuario confiese que hubo cita.

**Viabilidad: MEDIA-ALTA.** Con pocos comercios, el «uno por dia» se queda sin inventario rapido. Riesgo:
arranque en frio (poco dato). Al principio el match puede ser por reglas (rubro distinto, 2 km, horario del
comercio) antes que por modelo.

**Experimento.** 5 comercios dispuestos, 50 consumidores activos. Durante una semana, cada dia una sola
recomendacion elegida a mano por reglas. Se mide la tasa de primera visita y la respuesta a «¿volverias?».
Se compara contra mostrar la lista completa a otro grupo.

---

## 3. Salud — adherencia: loterias de arrepentimiento, intenciones de implementacion e intervenciones adaptativas

**A → mecanismo → B.**
- **Loteria de arrepentimiento** (Volpp y colegas, adherencia a warfarina, *J Gen Intern Med* ~2008). Hay un
  sorteo diario. Si tomaste la medicacion cobras. Si no, te avisan que HABRIAS ganado. Aprovecha la aversion
  al arrepentimiento y la sobrevaloracion de probabilidades chicas, y en el piloto bajaron las dosis
  incorrectas. *De memoria, sin verificar en esta sesion (PubMed no abrio)* — **M/B**.
- **Intenciones de implementacion** (Milkman et al., *PNAS* 2011, vacunacion antigripal). Pedirle al
  empleado que ESCRIBA la fecha y la hora en que se iba a vacunar subio la vacunacion unos 4 puntos. *De
  memoria, sin verificar* — **M**.
- **Just-in-time adaptive interventions / ensayos micro-aleatorizados** (Klasnja et al. 2015, HeartSteps).
  Cada vez que se podria mandar un aviso, se aleatoriza si se manda y de que tipo. Asi se aprende que tipo de
  mensaje le funciona A CADA persona y en que contexto. *De memoria, sin verificar* — **M**.

**De B a C.**
- **Micro-aleatorizacion del perfil de respuesta.** Es la forma rigurosa de la idea del owner («no mandar
  "te extrañamos" a quien no responde»). Cada aviso candidato (te extrañamos / perdido / te falta 1 /
  novedad) se asigna con algo de azar y se registra si hubo escaneo en N dias. Con el tiempo, cada
  consumidor tiene una tasa de respuesta por TIPO de mensaje, acumulada entre todos los comercios de la red.
  El comercio solo ve «tu campaña se envia a quien responde a este tipo». El grupo de control que ya existe
  es la mitad del trabajo.
- **«¿Que dia venis?»** Despues de escanear, la vista del cliente pregunta: «¿Cuando volves? [lun] [mie]
  [sab]». El aviso de ese dia deja de ser marketing y pasa a ser un recordatorio que el cliente pidio.
  Además gasta el cupo de Wallet con alta probabilidad de acierto.

**Por que es innovador.** Ningun comercio suelto tiene suficientes eventos para aprender respuestas por
persona. La red si: un cliente en 20 comercios produce 20 veces mas señal. Eso es una ventaja de red de
datos y no se copia con un programa de puntos.

**Viabilidad: ALTA** para «¿que dia venis?», **MEDIA** para la micro-aleatorizacion, que necesita volumen
para que las tasas por persona converjan. Riesgo: sobreajustar con 3 o 4 eventos por persona. Hay que usar
promedios por segmento hasta tener dato.

**Experimento.** En 3 comercios, mostrar «¿cuando volves?» al 50 % de los escaneos durante una semana y
mandar el recordatorio ese dia. Medir el retorno en el dia elegido ±1 frente al control.

---

## 4. Salud / seguros — Vitality: conducta verificada → beneficio en comercio aliado, y el marco de perdida

**A → mecanismo → B.** Vitality (Discovery) premia actividad fisica verificada con beneficios en aliados:
puntos semanales que se canjean por cafe, cine, etc. En el beneficio del Apple Watch el reloj se entrega
por adelantado y el socio lo «paga» con actividad (si no cumple, paga cuotas). Es un **marco de perdida**.
RAND Europe evaluo 400.000 personas en Reino Unido, EE.UU. y Sudafrica: hasta 34 % mas activos y 4,8 dias
activos extra por mes. RAND concluye que el incentivo con marco de perdida supera al de ganancia.
https://www.rand.org/pubs/research_reports/RR2870.html ·
https://www.vitalitygroup.com/insights/largest-behavior-change-study-physical-activity-based-verified-data-shows-vitality-incentives-combined-apple-watch-lead-significant-sustained-increases-activity-levels-2/
— **Confianza A** para que el estudio existe y sus cifras titulares. Es un estudio encargado por la empresa y
observacional, asi que hay sesgo de seleccion.

**De B a C.**
- **Lo que se premia es la conducta de RED y no la de un comercio.** Ejemplo: «este mes visitaste 4
  comercios distintos de la red → tu cafe de la semana corre por cuenta de la red». Lo paga un fondo comun
  (una parte de la suscripcion) o un comercio que compra ese espacio para captar clientes. El consumidor
  aprende que explorar la red rinde, y eso empuja directamente el resultado (2).
- **Premio adelantado con marco de perdida.** El comercio entrega el premio en la PRIMERA visita («tu
  decimo cafe ya es tuyo, lo tomas hoy») y el cliente lo «amortiza» con visitas. Si no vuelve, pierde el
  estado o el precio preferente. Hay que cuidar que el comercio no quede con deuda incobrable: el premio
  adelantado debe ser de costo marginal bajo.

**Por que es innovador.** Vitality monetiza la conducta del cliente vendiendosela a una aseguradora. En
CheckPass el «pagador» es el conjunto de comercios que quieren clientes nuevos. La red se vuelve un
intermediario de atencion con conducta verificada por escaneo (no autodeclarada).

**Viabilidad: MEDIA.** Hay que inventar el fondo comun. Riesgo: que nadie quiera financiar el premio de red.
Alternativa: que lo financie el comercio que quiere clientes nuevos, como publicidad.

**Experimento.** Un comercio ancla (una cafeteria) acepta regalar un cafe a quien escanee en 3 comercios
distintos de la red en 14 dias. Se anuncia en «Mis beneficios» a 100 clientes. Se miden las visitas
cruzadas contra el control.

---

## 5. Educacion — rachas (Duolingo) y cohortes

**A → mecanismo → B.** Duolingo informa que los usuarios que llegan a una racha de 7 dias tienen 3,6x mas
probabilidad de terminar el curso. Pasar de uno a dos «streak freeze» (comodines que protegen la racha)
subio los aprendices activos diarios un +0,38 % relativo. Su propia observacion: pasar de 2 a 3 dias es
+50 % de racha y de 200 a 201 es +0,5 %, asi que el impulso temprano pesa mas.
https://blog.duolingo.com/how-duolingo-streak-builds-habit/ — **Confianza A** para que la empresa lo
publica. Es correlacional (el 3,6x tiene sesgo de seleccion).
Cohortes (MOOC y bootcamps): terminar junto a otros aumenta la finalizacion. *Sin fuente en esta sesion* — **B**.

**De B a C.**
- **Racha SEMANAL de red, no diaria.** «Llevas 5 semanas seguidas con al menos una visita en la red». La
  cuenta cualquier comercio. Eso le interesa a la red, y a cada comercio en particular le suma poco.
  Comodin: una semana de gracia al mes. El numero se ve en «Mis beneficios» y se puede mostrar en el pase
  (campo secundario, sin push).
- **Cohortes de barrio.** «Reto de 4 semanas de El Vergel»: 30 vecinos, meta colectiva de visitas, y si se
  cumple todos reciben un beneficio. Convierte la recurrencia en algo social sin red social.

**Por que es innovador.** Las rachas de un comercio unico son fragiles (cerrar un domingo rompe la racha).
Una racha de red es robusta y hace que el cliente elija «un comercio de la red» en lugar de «cualquier
comercio». Es competencia contra lo que esta fuera de la red, no entre socios.

**Viabilidad: ALTA** para la racha (es un calculo sobre los escaneos). **BAJA-MEDIA** para las cohortes
(hay que operarlas y hace falta densidad por barrio). Riesgo: que la racha de red no le parezca valiosa al
COMERCIO que paga. Hay que mostrarle cuantas visitas a SU local vinieron de rachas.

**Experimento.** Mostrar el contador de racha semanal en la vista del cliente a la mitad de los usuarios
activos durante 3 semanas. Medir la proporcion que visita la red en la semana siguiente.

---

## 6. Medios locales — newsletters de ciudad monetizadas por comercios (6AM City, Axios Local)

**A → mecanismo → B.** 6AM City arma una audiencia masiva con un newsletter diario gratuito de estilo de
vida local (eventos, comida, aperturas; evita politica y crimen para que sea «seguro» para el anunciante) y
cobra a comercios locales por contenido patrocinado nativo. En Greenville consiguio unos US$500k en
compromisos de publicidad local antes de lanzar. Declaran 70 % de margen por ciudad a los 36 meses y avisos
clasificados de pequeños comercios a unos US$250.
https://pressgazette.co.uk/news/6am-city-ryan-heafy-interview/ ·
https://voices.media/designed-marketing-engine-cities-6am-city-hits-milestone-1-million-newsletter-subscribers/
— **Confianza A** (entrevistas a fundadores; cifras autodeclaradas). Axios Local sigue un modelo parecido.
*Sin detalle verificado en esta sesion.*

**De B a C.**
- **El «timbre general» diario de la red tiene que tener contenido, no solo ofertas.** El problema de
  «Mis beneficios» es darle al cliente una razon para abrirlo. Propuesta: «Cuenca hoy», 3 lineas (una
  apertura, un evento del finde, «el pan de X salio a las 17 h») y debajo sus beneficios. Es el mismo slot
  de Wallet, pero el cliente lo abre porque le sirve.
- **Inventario pagado.** El comercio destaca una novedad en «Cuenca hoy» por un pago puntual (un tipo
  «clasificado» de US$3–5). Es un ingreso adicional al plan de US$10 y no le sube el precio base al que no
  lo usa.

**Por que es innovador.** Los newsletters locales tienen la audiencia pero no saben quien compro. CheckPass
tiene el escaneo: puede venderle a un comercio «X personas vieron tu destacado y 12 escanearon en 7 dias».
Eso es medicion de conversion, algo que 6AM City no puede ofrecer.

**Viabilidad: MEDIA.** Alguien tiene que escribir el contenido; en 2026 se puede generar a partir de lo que
cargan los comercios, con revision. Riesgo: que se vuelva spam de ofertas y pierda el «por que abrirlo».

**Experimento.** Una semana de «Cuenca hoy» curado a mano en la vista del cliente (sin push extra). Medir
aperturas de «Mis beneficios» por usuario contra la semana anterior.

---

## 7. Clubes de suscripcion de vino y cerveza — prepago y curaduria

**A → mecanismo → B.** Los clubes de vino de bodegas cobran periodicamente, envian una seleccion curada y dan
precio de socio. El prepago crea compromiso (se consume lo que ya se pago, por el efecto de costo hundido) y
le da al comercio caja adelantada y demanda predecible. En la gastronomia de EE.UU. se vio el cafe «ilimitado»
por suscripcion (p. ej. el Unlimited Sip Club de Panera). *Sin fuente verificada en esta sesion* — **B/M**.

**De B a C.**
- **«Membresia de barrio».** El consumidor paga, por ejemplo, US$12/mes y recibe un paquete: un cafe por
  semana en la Cafeteria A, pan los sabados en la Panaderia B y 10 % en la peluqueria C. Los comercios cobran
  su parte por adelantado; la red se queda una comision y el consumidor obtiene un ahorro visible.
- Es el camino natural hacia «medios de pago propios» que el encargo ya menciona a futuro.

**Por que es innovador.** Un comercio solo no puede armar un paquete multi-rubro atractivo. La red si. Y el
prepago hace que el cliente elija la red por defecto.

**Viabilidad: BAJA-MEDIA hoy.** Requiere cobrar al consumidor (medios de pago, regulacion y confianza en
Ecuador). Riesgo: la liquidacion entre comercios y los reembolsos.

**Experimento.** Sin cobrar online: 3 comercios contiguos venden en mostrador una «tarjeta de barrio» fisica
con precio fijo, y el canje se registra con el escaneo. Medir las ventas en una semana.

---

## 8. Aerolineas — niveles de estatus que se pierden, y «status match»

**A → mecanismo → B.** Los programas de viajero frecuente usan niveles que se ganan en un periodo y se
PIERDEN si no se recalifican. Por aversion a la perdida, el socio cerca de perder el nivel concentra vuelos
en la aerolinea («mileage run»). El **status match** permite que una aerolinea competidora reconozca tu nivel
de otra para robarte como cliente. *Mecanismo ampliamente documentado; sin fuente abierta en esta sesion.
Base teorica: aversion a la perdida (Kahneman & Tversky, 1979)* — **M**.

**De B a C.**
- **Nivel de RED, no de comercio.** Por ejemplo: «Vecino» → «Vecino Frecuente» → «Vecino de Oro», segun las
  visitas a la red en un trimestre (con minimo de comercios distintos). Se ve en el pase como un campo del
  frente, sin push.
- **Status match automatico: la joya.** Cuando un «Vecino de Oro» entra a un comercio nuevo de la red, el
  comercio lo recibe con un trato de nivel (sellos dotados, cortesia) desde el dia 1. Para el comercio es un
  cliente nuevo pre-calificado como frecuente en otros locales. Para el cliente, el estatus vale en toda la
  ciudad.
- **Aviso de perdida (el uso mas valioso del cupo escaso).** «Te faltan 2 visitas en 10 dias para mantener
  Oro». Es un solo aviso de red que empuja una visita a cualquier comercio.

**Por que es innovador / dificil de copiar.** El estatus portable es imposible sin la red: es literalmente
el efecto de red hecho visible. Cada comercio nuevo que se suma hace mas valioso el nivel para el cliente,
y cada cliente de Oro hace mas atractiva la red para el comercio.

**Viabilidad: ALTA** (es calculo y un campo del pase). Riesgo: si el nivel no trae beneficios reales, es un
titulo vacio. Hace falta al menos un beneficio de nivel garantizado por la red o por los comercios que se
adhieran.

**Experimento.** Asignar nivel a los clientes existentes segun sus datos historicos y mostrarlo en la vista
del cliente. 3 comercios aceptan dar una cortesia a Oro/Frecuente en la primera visita. Medir las primeras
visitas de clientes de nivel a esos comercios frente a los de sin nivel.

---

## 9. Turismo — city cards (Go City) y el caso Cuenca (expatriados y turistas)

**A → mecanismo → B.** Go City vende pases multi-atraccion. El «Explorer Pass» deja elegir N atracciones sin
elegirlas de antemano: el pase se activa con la primera visita y desde ahi hay 30 dias para el resto. El
«All-Inclusive» vence cada dia a medianoche, lo que empuja a madrugar y visitar mas. Ambos convierten un
prepago en visitas por costo hundido y urgencia.
https://www.gocity.com/en/how-it-works — **Confianza A** para el mecanismo; no hay cifras de efecto
publicadas.
**Cuenca:** 596.101 habitantes (censo 2022). Las publicaciones locales estimaban en 2015 entre 4.000 y 6.000
expatriados, en buena parte jubilados norteamericanos.
https://en.wikipedia.org/wiki/Cuenca,_Ecuador — **Confianza M** (estimacion vieja y de segunda mano).

**De B a C.**
- **«Pase Explorador Cuenca».** Un bundle de «primeras visitas» en comercios de la red: 5 beneficios de
  bienvenida en rubros distintos, que corren 30 dias desde el primer escaneo. Se lo agrega al pase de Wallet
  que el cliente ya tiene. Para los locales es gratis (captacion). Para turistas y expats se vende en hoteles
  y hostales o se regala.
- **Expats como segmento semilla.** Son unos miles, tienen tiempo e ingresos en dolares, estan en
  comunidades densas (grupos de Facebook, newsletters propios), buscan activamente «donde ir» y usan
  Wallet. Son el mejor grupo de early adopters para probar la red antes que la poblacion general.
- Para el comercio, cada canje es un cliente NUEVO atribuible a la red, que es lo que tiene que percibir.

**Por que es innovador.** Las city cards solo cubren atracciones turisticas. Una city card de comercios
cotidianos, en el mismo pase que despues sirve como fidelidad, convierte al turista o recien llegado en
cliente frecuente, algo que Go City no hace (el pase muere al terminar el viaje).

**Viabilidad: ALTA** (es una campaña con vencimiento relativo al primer uso). Riesgo: que atraiga
«cazadores de gratis» que no vuelven. Mitigacion: medir la segunda visita y pedirle al comercio beneficios de
costo marginal bajo.

**Experimento.** Un hostal u hotel y 5 comercios del Centro Historico. Una semana entregando el Explorador a
huespedes. Medir canjes y cuantos escanean de nuevo sin beneficio.

---

## 10. Economia conductual — efecto dotacion aplicado al beneficio entregado

**A → mecanismo → B.** Efecto dotacion: la gente valora mas lo que siente que ya es suyo (Kahneman, Knetsch
& Thaler 1990, experimento de las tazas). *De memoria, sin verificar* — **M**. Lo usan los retailers con
«tu cupon te esta esperando» en lugar de «hay un descuento».

**De B a C.** Cada beneficio en «Mis beneficios» aparece ya asignado con nombre y vencimiento: «Guardado
para vos, Maria: pan de yuca gratis, vence el domingo». No aparece como oferta publica. El aviso de
vencimiento («pierde tu beneficio el domingo») es un marco de perdida y cuenta como el «1 de reserva para lo
que vence hoy» del borrador de `red-y-atencion.md`.

**Por que es innovador.** Es barato y casi todo es texto. Lo nuevo es la combinacion: sin tope en la ENTREGA
(todo cae asignado) y con el AVISO solo para la perdida inminente.

**Viabilidad: ALTA.** Riesgo: que todo «vence» y el marco se gasta. Limitarlo a 1 vencimiento destacado.

**Experimento.** Una semana con el mismo beneficio redactado como «oferta» a la mitad y como «guardado para
vos + vence» a la otra mitad. Medir el canje.

---

## Ranking — mis 3 mejores

1. **Estatus de red con «status match» automatico (§8, con §1).** Es la idea que mejor hace VISIBLE el
   efecto de red: el cliente frecuente de un comercio llega a otro como VIP. El comercio lo percibe como
   cliente nuevo y bueno (resultado 2), y la amenaza de perder el nivel da el mejor uso del push escaso
   (resultado 1). Es casi todo calculo sobre escaneos y un campo del pase. Nadie fuera de una red lo puede
   copiar.
2. **Progreso dotado cruzado + «te falta 1» (§1).** Es el unico mecanismo de esta lista con un experimento
   de campo publicado, hecho justo con tarjetas de sellos. Cuesta cero, se prueba con el grupo de control
   existente y convierte la llegada desde la red en segunda visita.
3. **Perfil de respuesta por micro-aleatorizacion + «¿que dia volves?» (§3).** Es la forma rigurosa de la idea
   del owner del perfil tipo Meta. La red aprende que mensaje funciona para cada persona con datos de todos
   los comercios, y el «¿cuando volves?» convierte el aviso en un recordatorio que el cliente pidio. Es el
   motor que decide a quien le toca cada uno de los 3 avisos diarios.

## Idea «loca» para discutir

**«Cita a ciegas con un comercio».** Tomada de las apps de citas y de las loterias de salud. Una vez por
semana la red le ofrece al consumidor un beneficio sorpresa en un comercio de un rubro que NUNCA visito, a
menos de 2 km, sin decirle cual es. Solo sabe «algo dulce, a 600 m, vale US$3». Si acepta, se le revela el
comercio y tiene 48 h. Si no la usa, el sabado ve cual era («te perdiste el alfajor de X»): es el
arrepentimiento de la loteria de Volpp. El comercio paga por cita concretada (escaneo), no por impresion. La
curiosidad y la variabilidad del premio (refuerzo variable) mueven al cliente, la red rompe la rutina de
rubros y cada cita es un cliente nuevo medido. Riesgos: que el comercio sienta que regala a desconocidos sin
control (mitigar con tope semanal y costo bajo) y que un premio «sorpresa» decepcionante queme la confianza
en la red.
