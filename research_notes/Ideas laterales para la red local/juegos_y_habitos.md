# Juegos, hábitos y mecánicas de retorno — ideas laterales para CheckPass

> Dominio: juegos y hábitos que hacen VOLVER a la gente **sin depender de notificaciones**.
> Investigado el 2026-09-29. Confianza: **A** = fuente primaria o paper; **M** = prensa seria o
> dato de memoria de un paper conocido que no pude releer entero; **B** = blog secundario sin cita a
> la fuente primaria. **Límite declarado:** se agotó el cupo de búsquedas web a mitad de la
> investigación. Los datos de Kivetz (tarjeta de café) y la cifra 34 %/19 % de Nunes & Drèze son de
> memoria y los marco **M**. Nike Run Club, Starbucks «Summer Game» y el regreso de las alcaldías de
> Swarm quedaron **sin fuente nueva**.

**La tesis que atraviesa todo:** el único momento de contacto que CheckPass tiene gratis, sin tope y
con el cliente presente es **el escaneo en el mostrador**. Los juegos que funcionan sin notificaciones
(el álbum de figuritas, el pasaporte de cervecerías, la lotería de facturas) ponen el premio **en el
acto de compra**, no en un aviso. Tanto el escaneo como «Mis beneficios» (la pantalla que se abre
después) son pantallas de juego que hoy se usan solo como contador.

---

## 1. Lotería de facturas (Taiwán, Portugal, São Paulo) → el cliente pide que lo escaneen

**A → mecanismo → B.**
- **Taiwán, Uniform Invoice (1951):** cada factura es un boleto de lotería. El sorteo es bimestral:
  premio mayor de NT$10 M y **premios chicos por coincidir las últimas 3 cifras (NT$200), que se
  cobran en el mismo minimercado**. Los consumidores empezaron a exigir la factura y se volvieron
  «auditores voluntarios». La recaudación subió ~75 % el primer año.
  [Wikipedia](https://en.wikipedia.org/wiki/Uniform_Invoice) (A para la mecánica),
  [ABC News 2025](https://www.abc.net.au/news/2025-12-28/taiwan-receipt-lottery-win-money-from-shopping/106140828) (M para el +75 %).
- **Portugal, «Fatura da Sorte» (2014):** cada factura con NIF entra al sorteo. Las facturas con NIF
  del consumidor subieron **+36,3 % al año y +51,2 % a los dos años**. El plan costó **€4,3 M entre
  2014 y 2016** (en autos Audi).
  [Creative Samba](https://creativesamba.substack.com/p/the-lucky-invoice-lottery-d3b) (M).
- **São Paulo, Nota Fiscal Paulista:** reembolso más lotería por poner el CPF en la factura. Las
  ventas declaradas subieron **al menos 21 % en 4 años** y la recaudación neta de premios **+9,3 %**.
  El paper encuentra un efecto conductual propio de la lotería. Naritomi, *AER* 2019,
  [RePEc](https://ideas.repec.org/a/aea/aecrev/v109y2019i9p3031-72.html) (A).

**El B que importa:** un premio aleatorio y barato, atado a una transacción, **cambia quién pide que
la transacción se registre**. Deja de depender del cajero y pasa a depender del cliente.

**De B a C.**
- **El problema que resuelve:** en un comercio chico el cajero se olvida de escanear o le da
  vergüenza pedir el pase. Si cada escaneo es un boleto del **«Sorteo de la red»**, es el cliente
  quien dice «¿me escaneás?».
- **Qué ve el consumidor:** tras el escaneo, en el pase y en «Mis beneficios»: «Boleto #4812 para el
  sorteo del domingo · tenés 7 boletos este mes». Estilo Taiwán: **muchos premios chicos**
  (un café gratis en el mismo comercio, que se canjea al instante) y **un premio grande de red** al
  mes, como una cena para dos en el comercio que salga sorteado.
- **Qué hace el comercio:** nada nuevo, sigue escaneando. Opcionalmente dona un premio chico.
- **Qué hace la red:** el sorteo, los boletos y el anuncio de ganadores en la PWA y la web pública.
- **Un giro propio:** boleto doble en un comercio **donde nunca estuviste**. Es captación (C2) sin
  pagarle nada a otro comercio.

**Por qué es innovador y difícil de copiar.** Los programas de un solo comercio no juntan un pozo que
valga la pena. La red sí: 100 comercios que aportan un premio chico cada uno arman un pozo visible. Un
comercio suelto no puede replicarlo.

**Viabilidad sin app nativa y en Cuenca: ALTA.** Todo pasa en el escaneo, el pase y la PWA.
**Riesgo principal: legal.** En Ecuador los sorteos promocionales pueden requerir autorización o
reglas de «sin obligación de compra» (**sin fuente, verificar antes**). Hay riesgo menor de fraude
(escaneos de amigos), que se mitiga con 1 boleto por comercio y por día.

**Primer experimento (1 semana).** 5 comercios de rubros distintos, cartel en el mostrador «cada
escaneo = 1 boleto; domingo sorteamos 5 cafés y 1 cena». Se mide la tasa de escaneo por ticket (o
escaneos por día) contra la semana anterior y contra 5 comercios sin cartel.

---

## 2. Pasaporte de cervecerías y «Ale Trails» + progreso dotado → rutas de la ciudad

**A → mecanismo → B.**
- **Los Ale Trails de EE. UU.** (Austin con más de 50 cervecerías, Lancaster con 29, Eau Claire con
  14, Vermont Brewery Challenge) funcionan igual: un pasaporte con sello por visita y compra, y
  **premios por escalones** (a las N paradas, un vaso; al completar, una gorra de edición limitada).
  Casi siempre los organiza la **asociación de cerveceros o la oficina de turismo**, no una
  cervecería.
  [Austin](https://craftbeeraustin.com/austin-ale-trail-passports-available-now),
  [Lancaster](https://lancasterbreweries.org/ale-trail/),
  [Eau Claire](https://www.visiteauclaire.com/things-to-do/breweries/brew-pass/),
  [Charlottesville](https://charlottesvillealetrail.org/pages/passports) (A para la mecánica).
  **No encontré ninguna medición publicada de visitas incrementales:** la evidencia es de adopción,
  no de efecto.
- **Progreso dotado (Nunes & Drèze, *JCR* 2006):** una tarjeta de lavadero de 10 sellos con 2 ya
  puestos se completó más que una de 8 sin regalo (de memoria: ~34 % contra ~19 %), y más rápido.
  Con la misma distancia real, el que siente que ya empezó termina.
  [JCR](https://academic.oup.com/jcr/article-abstract/32/4/504/1787425) (A para el efecto, M para las
  cifras).
- **Gradiente de meta (Kivetz, Urminsky y Zheng, *JMR* 2006):** en una tarjeta de café los clientes
  **aceleran las compras cuanto más cerca están del premio** (M, de memoria).

**El B que importa:** una colección finita y con nombre vuelve deseable visitar lugares **nuevos**.
El premio es de identidad (la gorra), no de dinero.

**De B a C.**
- **Rutas temáticas:** «Ruta del desayuno cuencano» (panadería, café, frutería) o «Ruta del
  Barranco». La idea ya está en `red-y-atencion.md` §4.
- **Lo nuevo acá:**
  1. La ruta **arranca con 1 de 5 sellos puestos** (progreso dotado), por ejemplo el comercio donde
     el cliente ya es miembro.
  2. **Escalones:** a los 3 sellos, un beneficio chico; al completar, un premio de identidad
     («Cuencano de ley 2026», sello visible en el pase).
  3. **La ruta se ofrece en el escaneo:** «Estás en la Ruta del desayuno: te faltan la Panadería X
     y la Frutería Y, a 400 m».
- **Qué hace el comercio:** acepta estar en una ruta y ofrece un beneficio de «primera visita por
  ruta».
- **Qué hace la red:** diseña las rutas (con rubros no competidores, como pide el owner) y las
  publica en la web pública para turistas. Cuenca recibe turismo.

**Por qué es innovador y difícil de copiar.** Los Ale Trails usan papel o una app aparte. Acá el
pasaporte ya está en la Wallet del cliente y cada sello es un escaneo real, sin fraude de papel. Y
**la ruta es la forma natural de medir captación**: primera visita de un cliente que llegó por la
ruta.

**Viabilidad: ALTA.** **Riesgo:** que las rutas atraigan cazadores de premios de una sola visita (el
Ale Trail no mide la segunda visita). Por eso el escalón final exige **volver** a uno de los
comercios de la ruta.

**Primer experimento.** Una ruta de 4 comercios en una misma cuadra. Cartel más oferta en el escaneo.
Se miden altas nuevas por comercio atribuidas a la ruta y el % que vuelve en 30 días.

---

## 3. Local Legends de Strava y alcalde de Foursquare → «Leyenda del local»

**A → mecanismo → B.**
- **Foursquare** coronaba «alcalde» a quien más check-ins tenía en un lugar. Muchos bares le daban
  un trago gratis al alcalde. El problema: en los lugares populares **el título se volvía
  inalcanzable** y la mayoría dejaba de competir. Cuando Swarm se separó (mayo 2014) quitando parte
  del juego, los usuarios se quejaron de la falta de gamificación.
  [Wikipedia Swarm](https://en.wikipedia.org/wiki/Swarm_(app)) (M).
- **Strava Local Legends** corrige ese error: la leyenda de un tramo es quien **más veces lo recorrió
  en 90 días móviles, sin importar la velocidad**. Premia la constancia y no el talento, y la
  ventana móvil hace que el título se pueda perder y recuperar.
  [Soporte Strava](https://support.strava.com/hc/en-us/articles/360043099552-Local-Legends) (A).

**El B que importa:** un estatus local, **por frecuencia**, y que **se puede perder**, crea visita
recurrente sin ningún aviso. La amenaza de perderlo hace el trabajo del push.

**De B a C.**
- **Qué ve el consumidor:** cada comercio tiene su **«Leyenda del local»**, el cliente con más visitas
  en 90 días. Se muestra en el pase («Sos Leyenda de Café X · 14 visitas») y en «Mis beneficios»
  («Te faltan 2 visitas para ser Leyenda de Panadería Y» o «Juan te está alcanzando»).
- **Qué hace el comercio:** decide el privilegio de su Leyenda (el café de siempre gratis los lunes,
  la foto en la pared). Costo casi nulo y alto valor percibido.
- **Qué hace la red:** calcula los rankings. Para no repetir el error de Foursquare, hay **escalones
  por percentil** («Top 10 del local», «Habitué»), así el cliente promedio también tiene una meta
  alcanzable.

**Por qué es innovador.** Es una fidelización **de estatus**, no de descuento, y el comercio chico la
puede dar sin perder margen. Los datos de frecuencia por comercio ya existen en CheckPass.

**Viabilidad: ALTA.** **Riesgo:** privacidad (mostrar nombres). Se resuelve con un alias o una
inicial y opt-in, como Strava, que solo cuenta actividades públicas.

**Primer experimento.** 3 cafés. Tabla del mes en un cartel del mostrador más la línea en el pase. Se
compara la frecuencia del top 20 % de clientes contra el mes anterior.

---

## 4. Rachas de Duolingo (con congelador) → rachas por comercio a su ritmo, y racha de red

**A → mecanismo → B.**
- Duolingo llama a la racha su palanca de retención más eficaz. Los datos que circulan dicen:
  - el «Streak Freeze» bajó ~21 % el abandono de quienes estaban por romperla;
  - un cambio en la racha dio +3,3 % de retención al día 14;
  - quienes tienen una «Friend Streak» completan su lección un 22 % más.
  [Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks),
  [StriveCloud](https://www.strivecloud.io/duolingo-gamification-explained) (**B**: ninguno cita la
  fuente primaria de Duolingo).
- **Advertencia:** la racha de Duolingo **depende mucho de notificaciones**. Lo que se transfiere sin
  ellas es la **aversión a la pérdida** del número acumulado.

**El B que importa:** un contador de constancia más un seguro para no perderlo (el congelador)
sostienen el hábito, porque romper la racha es lo que hace perder al usuario.

**De B a C.**
- **Racha a la cadencia del rubro, no diaria:** «4 semanas seguidas en Café X», «3 meses seguidos en
  Peluquería Y». CheckPass ya tiene días por rubro para el ciclo de vida, y es el mismo dato.
- **Congelador de red:** cada 4 semanas de racha se gana 1 comodín, que se usa solo si no pudo ir.
- **Racha de red:** «12 semanas seguidas comprando local en Cuenca», **en cualquier comercio de la
  red**. Es lo que hace que la red valga más que la suma: la racha la sostiene el comercio que le
  queda cerca esa semana.
- **Dónde se muestra sin push:** en el campo del pase (visible cada vez que lo abre para pagar) y en
  el escaneo («¡Racha de 6 semanas! Te queda 1 comodín»).
- **El aviso escaso** (de los 3 diarios) se reserva para «tu racha de 11 semanas termina el
  domingo». Es el aviso con mejor relación valor/cupo, porque lo pide la pérdida.

**Por qué es innovador.** Ningún sello de cartón puede llevar una racha. Y la racha **de red** solo
existe si hay red.

**Viabilidad: ALTA** (es un cálculo sobre escaneos que ya existen). **Riesgo:** rachas infladas por
visitas mínimas (un chicle para no perder la racha). Poner un monto mínimo o aceptarlo como el costo
del hábito.

**Primer experimento.** Activar la «racha semanal» en 5 comercios de alta frecuencia (café,
panadería). Se mide el % de clientes con 4 o más semanas consecutivas contra el grupo de control que
ya existe.

---

## 5. Álbum de figuritas y colecciones → «Álbum de Cuenca»

**A → mecanismo → B.** El álbum de figuritas (Panini, el Mundial) engancha por la **completitud**: un
set finito, con huecos visibles y figuritas difíciles. Swarm hacía lo mismo con stickers y con
«categorías únicas visitadas» ([Wikipedia Swarm](https://en.wikipedia.org/wiki/Swarm_(app)), M).
La mecánica es la misma que la de los pasaportes (§2): **un hueco visible pide ser llenado**.
Sin fuente con métricas.

**De B a C.**
- **Qué ve el consumidor:** en «Mis beneficios», un álbum con **una figurita por rubro** (café,
  panadería, heladería, peluquería, farmacia, gimnasio, restaurante…). Los huecos grises dicen «el
  más cercano: Heladería Z, a 300 m, 2x1 de primera visita».
- **Figuritas raras:** comercios nuevos en la red o de barrios menos visitados. La rareza **empuja el
  tráfico a donde la red lo necesita**.
- **Completar una página** («Página El Centro», «Página Rubros de Belleza») da un premio de red.
- **Qué hace el comercio:** nada. Recibe clientes nuevos que llegan a «pegar su figurita».

**Por qué es innovador.** Convierte la **diversidad de rubros** (que el owner ya definió como regla:
no competidores) en el juego mismo. Y el álbum es el mapa de captación.

**Viabilidad: ALTA** en la PWA. **Riesgo:** turismo de una sola visita, como en §2. Mitigarlo con
una figurita que exige **2 visitas** en ese comercio (la «brillante»).

**Primer experimento.** Álbum de 6 rubros en un barrio. Se mide cuántos clientes existentes abren un
comercio nuevo de la red en 2 semanas.

---

## 6. Star Dash y retos personalizados de Starbucks → retos entre rubros por perfil

**A → mecanismo → B.**
- **Starbucks Rewards** usa «Star Dashes» y «Bonus Star challenges»: retos por tiempo limitado y
  **personalizados por cliente** («comprá 3 veces antes del domingo y ganá 50 estrellas extra»). Se
  suman los Double Star Days.
- Se cita un +23 % de visitas en los 15 M de miembros más activos con gamificación.
  [Loquiz](https://loquiz.com/2023/03/31/starbucks-gamification/),
  [Open Loyalty](https://www.openloyalty.io/insider/starbucks-rewards-program) (**B**: blogs, la cifra
  del 23 % no tiene fuente primaria).
- La mecánica en sí es pública y conocida (M).

**El B que importa:** el reto está **calibrado a la frecuencia de cada cliente**. A quien viene una
vez por semana se le pide dos, no cinco. Estira la frecuencia justo por encima del hábito actual.

**De B a C.** Esto conecta con el **perfil enriquecido** que pide el owner.
- **Reto calibrado:** «Venís a Café X cada 9 días. Si venís 2 veces esta semana, tu próxima vale
  doble».
- **Reto entre rubros:** «Café + panadería en el mismo día = sello extra en los dos», con comercios
  a menos de 2 km y rubros distintos.
- **Dónde se ve:** en el escaneo y en «Mis beneficios», sin gastar avisos.
- **Qué hace el comercio:** aprueba una vez un «presupuesto de retos» (por ejemplo, hasta 1 sello
  extra por cliente al mes).
- **Qué hace la red:** calibra cada reto contra el perfil y mide el lift contra el grupo de control
  (ADR 0066).

**Por qué es innovador.** Starbucks lo hace con su propia data de un solo rubro. La red ve **la
frecuencia del cliente en todos los rubros** y puede proponer el reto cruzado que ninguna marca sola
puede diseñar.

**Viabilidad: MEDIA-ALTA.** El motor de campañas existe; falta el reto como tipo de campaña con
estado. **Riesgo:** que los retos se lean como spam si hay muchos. Máximo 1 reto activo por cliente.

**Primer experimento.** 2 pares café-panadería. Reto cruzado de 7 días, ofrecido en el escaneo. Se
mide el % que completa y las visitas cruzadas contra el control.

---

## 7. Sponsored Locations de Pokémon GO y señuelos → «Faro»: el comercio paga por visita nueva

**A → mecanismo → B.**
- **Niantic** cobró a los sponsors **por visita única diaria (menos de US$0,50)**.
  [TechCrunch 2017](https://techcrunch.com/2017/05/31/pokemon-go-sponsorship-price) (A/M).
- **McDonald's Japón** convirtió ~3.000 locales en PokéStops y gimnasios. En el pico, unas 2.000
  visitas diarias por local; un estudio de GLOBIS estimó +22 % de ventas.
  [Forbes 2016](https://www.forbes.com/sites/parmyolson/2016/07/20/pokemon-go-mcdonalds-japan-nintendo-revenue/),
  [PYMNTS](https://www.pymnts.com/news/2017/niantic-charges-pokemon-go-sponsors-up-to-50-cents-per-visitor/) (M).
- **Una pizzería de Long Island City** gastó unos US$10 en «Lure Modules» (señuelos visibles en el
  mapa) y reportó +75 % de ventas de fin de semana (anécdota, **B**).
- **Pero el efecto se desvaneció:** los usuarios diarios cayeron de ~45 M a ~30 M en 6 semanas, y el
  aumento de pasos medido en *BMJ* desapareció a la semana 6.
  [Make Tech Easier](https://maketecheasier.com/pokemon-go-small-business-foot-traffic/) (M, cita
  Sensor Tower y *BMJ*).

**El B que importa (dos lecciones):**
1. **Un señuelo temporal y visible en un mapa** mueve gente de forma inmediata y barata.
2. **Cobrar por visita** hace que el comercio perciba el valor sin discutirlo.

**Y la advertencia:** el tráfico que viene por la novedad del juego se va con la novedad. Lo que dura
es el hábito (§3, §4), no el juego.

**De B a C.**
- **«Faro»:** el comercio enciende por 2 horas un faro en el mapa de la PWA y en la web pública
  («Panadería Y: pan recién salido, 2x1 hasta las 18 h»).
- **Dónde se ve sin push:**
  - en «Mis beneficios» de quienes están a menos de 2 km;
  - por la proximidad del pase (ADR 0065) para quien pasa por delante;
  - en el escaneo de comercios vecinos («a 200 m hay un Faro encendido»).
- **Modelo de cobro lateral:** el plan base de US$10 incluye N faros al mes. Además, **«pagá solo
  por cliente nuevo que llegó por la red»** (como el costo por visita de Niantic o Belly Bites).
  Responde directo al resultado 2 de la misión.

**Por qué es innovador.** Es el único formato de §1–§7 que el comercio **controla en tiempo real**
(sacar el pan que sobró, llenar una hora muerta), y el cobro por resultado es fácil de vender a un
comercio que ve US$20 como mucho.

**Viabilidad: MEDIA.** Requiere que haya gente mirando el mapa. Sin masa crítica, el faro no lo ve
nadie. **Riesgo:** novedad que decae (la lección de Pokémon GO) y comercios que no se acuerdan de
encenderlo.

**Primer experimento.** 3 comercios con horas muertas encienden un faro diario por 1 semana, mostrado
en el escaneo de 10 comercios vecinos. Se cuentan los escaneos atribuibles en esa franja contra la
misma franja de la semana anterior.

---

## 8. BeReal (momento aleatorio) → premio variable en el escaneo

**A → mecanismo → B.**
- BeReal manda un aviso diario a hora aleatoria con 2 minutos para postear. Llegó a más de 10 M de
  usuarios diarios (ago. 2022) y bajó de 15 M (oct. 2022) a ~6 M (primavera 2023).
  [Wikipedia](https://en.wikipedia.org/wiki/BeReal) (M).
- Lección: la escasez temporal genera un pico, pero **si depende de una notificación y no da valor
  propio, cae**. La recompensa variable, en cambio, es un clásico del refuerzo intermitente (sin
  fuente puntual acá).

**De B a C.**
- **Sin notificación:** el azar vive **en el escaneo**. Cada escaneo tiene una probabilidad chica y
  conocida de «¡Sorpresa!»: sello doble, un café, una figurita rara (§5). La sorpresa se muestra en
  el pase en ese momento.
- **«Hora dorada» secreta:** cada día una franja de 1 hora, distinta y no anunciada, da escaneos
  dobles en toda la red. Se revela después («Hoy fue de 10 a 11: 34 personas la cazaron»). Es el
  mismo motor del sorteo (§1), pero instantáneo.

**Por qué es innovador.** Convierte el escaneo, un trámite, en un momento con expectativa, y no gasta
ningún aviso.

**Viabilidad: ALTA. Riesgo:** lo legal del azar, lo mismo que en §1.
**Experimento:** combinarlo con el de §1.

---

## 9. Friend Streaks y clubes (Duolingo, Strava, Nike Run Club) → «Parche»: el hábito de a dos

**A → mecanismo → B.**
- La Friend Streak de Duolingo (+22 % de lecciones completadas, **B**, ver §4) y los clubes y retos
  grupales de Strava y Nike Run Club (**sin fuente nueva**; mecánica pública, M) comparten algo: **el
  compromiso con otra persona sostiene el hábito mejor que el compromiso con uno mismo**.

**De B a C.**
- Dos o más consumidores se vinculan como **«parche»**: compañeros de trabajo que almuerzan juntos,
  amigas del café de los jueves.
- Si van juntos (escaneos en el mismo comercio con pocos minutos de diferencia), suman a una **racha
  compartida** y desbloquean beneficios de grupo («4 cafés del parche = 1 gratis para el grupo»).
- El alta de un amigo al parche es **captación con referido incorporado**: invitar a alguien es
  hacerlo cliente de la red.

**Por qué es innovador.** El comercio chico vive de grupos (el almuerzo de oficina) y ningún
programa de fidelización local lo modela.

**Viabilidad: MEDIA.** Requiere un flujo de vínculo en la PWA. **Riesgo:** adopción baja del
vínculo.

**Experimento:** 1 restaurante de almuerzo ejecutivo, parches de oficina, 2 semanas.

---

## Ranking final

1. **Sorteo de la red por escaneo (§1, con §8 incorporado).** Es la evidencia más dura de todo el
   dominio: tres países, un paper en *AER* y cifras oficiales. Resuelve un problema operativo real
   (que se escanee cada compra) **dando vuelta quién pide el escaneo**, no gasta avisos y es barato:
   muchos premios chicos donados más uno grande. Hay que verificar lo legal en Ecuador antes.
2. **Rutas y Álbum de Cuenca con progreso dotado (§2 + §5).** Es la palanca de **clientes nuevos**
   (C2) que la red tiene y un comercio suelto no. Además, la primera visita por ruta es la
   atribución que falta para demostrar captación.
3. **Leyenda del local más rachas a la cadencia del rubro (§3 + §4).** Es la palanca de **frecuencia
   de la propia base** (C1). Premia con estatus, no con margen, y se sostiene con la amenaza de
   perder, no con notificaciones. El único aviso que la usa («tu racha vence el domingo») es el que
   mejor justifica su cupo.

**Transversal:** la lección de Pokémon GO y BeReal es que **el juego trae el pico y el hábito lo
sostiene**. Toda mecánica tiene que terminar en una segunda visita (escalón final de la ruta,
figurita brillante, racha), no en la primera.

## Idea loca para discutir: «Copa de Barrios» (Ingress aplicado a Cuenca)

**Lo que toma de Ingress:** Ingress dividió al mundo en dos facciones que se disputan portales
físicos, y sus sponsors (Lawson, SoftBank, Zipcar, Jamba Juice) convertían locales en puntos
disputados. [Wikipedia Ingress](https://en.wikipedia.org/wiki/Ingress_(video_game)) (M).

**Cómo funcionaría en Cuenca:**
- Cada escaneo suma puntos **al barrio del comercio**: El Centro, Totoracocha, El Vergel, Challuabamba…
- Cada mes hay tabla pública en la web y en los comercios.
- El barrio ganador tiene un fin de semana de **«Feria del barrio campeón»**, con beneficios de todos
  sus comercios, y **aparece primero en la web pública el mes siguiente**.

**Qué cambia:** los comercios de un mismo barrio dejan de competir y **empiezan a empujarse entre
sí** («vení a comprar al barrio, que vamos segundos»). El orgullo local hace el marketing: la radio
local y las asociaciones barriales tienen algo que contar.

**Por qué es loca:** puede no importarle a nadie. Pero si prende, crea **cooperación entre comercios
vecinos**, algo que la literatura de coaliciones dice que no ocurre sola (Dorotic et al. 2021, citado
en `red-y-atencion.md`), y le da a la red una historia de prensa que ningún competidor SaaS puede
contar.

**Experimento mínimo:** 2 barrios, 1 mes, 8 comercios por barrio, tabla en un cartel.
