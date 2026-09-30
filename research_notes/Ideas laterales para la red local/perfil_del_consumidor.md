# Perfil del consumidor y decisiones por perfil — notas de investigacion

> Dominio: PERFILES DE CONSUMIDOR (la idea del owner, «estilo Meta»). Fecha: 2026-09-29.
> Formato del `_encargo.md`. Confianza: **A** = fuente primaria leida en esta sesion; **M** = fuente
> secundaria leida (prensa/guia de terceros); **B** = dato citado de segunda mano que no pude abrir;
> «sin fuente» = razonamiento propio o tecnica estandar sin cita verificada hoy.
> **Limite declarado:** el cupo de busquedas web de la sesion se agoto a mitad del trabajo; varias cifras
> (Kroger 70 %, retiro de «similar audiences» de Google, mecanica de Payback) quedaron en B o «sin fuente».
> No se toco ninguna base de datos; los numeros de la red de Cuenca son hipotesis a medir (ver §6).

---

## 0. La idea en una frase

Hoy cada comercio decide sus campañas **con reglas por rubro** («te extrañamos a los 21 dias si sos cafe»).
El salto es que la RED aprenda **como responde cada persona** —a que tipo de mensaje, con que incentivo,
a que hora, con que cadencia— usando lo que esa persona hizo en **todos** los comercios, y que cada campaña
se ejecute contra ese perfil. Es lo que un comercio chico nunca puede tener solo (no tiene el volumen) y lo
que Meta/Google/dunnhumby venden como ventaja: **el dato de la red es el producto**.

Pero con una correccion importante al ejemplo del owner (ver §1.3): **«no respondio» no es lo mismo que «el
mensaje no sirve»**. Lo que hay que aprender es el **efecto incremental** (uplift), y eso solo se puede medir
porque CheckPass ya tiene grupo de control (`campaign_pushes.holdout`, `apps/merchant/src/server/schema/campaign-push.ts:47`).
Ese holdout es el activo que convierte la idea del owner de «segmentacion» en «aprendizaje causal».

---

## 1. Analogias

### 1.1 Meta / Google Ads — lookalikes y señales de conversion

1. **Industria A → mecanismo → resultado B.** El anunciante entrega una «audiencia fuente» (sus mejores
   clientes, o las conversiones que le devuelve por pixel/CAPI) y la plataforma busca personas con patrones
   parecidos entre todos sus usuarios; el 1 % es lo mas parecido y el 10 % gana alcance perdiendo similitud.
   El giro 2024-26: el lookalike manual se absorbio dentro de la optimizacion automatica (Advantage+ en Meta;
   en Google los «similar segments» se retiraron y hoy quedan «lookalike segments» solo en Demand Gen). La
   señal que manda es la **conversion real que el anunciante le devuelve**, y mejor si trae valor (value-based).
   Resultado B: adquisicion de clientes nuevos parecidos a los buenos, sin que el anunciante defina a mano quien.
   - Lookalike Meta, fuente/1 %/value-based: https://pixis.ai/blog/meta-lookalike-audiences/ ,
     https://jetfuel.agency/create-facebook-lookalike-audiences-in-7-steps-2025-guide/ — **M** (guias de terceros).
   - Advantage+ Audience (oficial): https://www.facebook.com/business/ads/meta-advantage-plus/audience — **M** (no lo abri).
   - Google «Lookalike segments … share characteristics with others on an existing seed list», solo Demand Gen:
     https://support.google.com/google-ads/answer/7139569 — **A**. Retiro de «similar audiences» en 2023 — **B**.
2. **De B a C.** CheckPass tiene algo que Meta no tiene: la **visita fisica verificada** (el escaneo), no un clic.
   El «seed» son los 30 mejores clientes de la Panaderia X (frecuencia × antiguedad × canjes). La red busca, entre
   los consumidores que **no** son miembros de X, a los que se parecen: mismas franjas horarias, mismo barrio
   de escaneo, mismos rubros complementarios, misma cadencia. A ellos (y solo a ellos) les aparece en
   «Mis beneficios» el cupon de bienvenida de X. **Comercio:** ve «esta semana 120 personas de la red, parecidas
   a tus mejores clientes, recibieron tu bienvenida; 9 vinieron; sin la red, en el grupo de control, vinieron 2».
   **Consumidor:** ve una bienvenida de un lugar a 400 m que encaja con lo que hace. **Red:** reparte atencion
   escasa hacia donde mas convierte.
3. **Por que es innovador / dificil de copiar.** Nadie en Cuenca tiene visitas fisicas verificadas de muchos
   comercios distintos bajo una sola identidad. Meta tiene intereses y clics; Google tiene ubicacion; ninguno
   sabe que «esta persona compra pan a las 7:10 los martes». El dato se acumula con cada escaneo y un
   competidor que llega despues arranca de cero.
4. **Viabilidad:** **media-alta.** No necesita app: la entrega es «Mis beneficios» + el cupon en el escaneo.
   Riesgo principal: **volumen**. Un lookalike necesita una fuente de decenas de clientes buenos y un universo
   de miles; en el piloto puede no alcanzar y el «parecido» degenera en «vive cerca» (que igual sirve).
5. **Primer experimento (1 semana, 3 comercios).** Elegir 3 comercios con ≥ 30 clientes frecuentes. Armar a mano
   (SQL) el lookalike por 3 señales simples: franja horaria dominante, local de escaneo mas frecuente a ≤ 1 km,
   ≥ 1 rubro complementario compartido. Partir el lookalike al azar 50/50: la mitad recibe el cupon de
   bienvenida en «Mis beneficios», la otra no. Comparar primeras visitas en 14 dias. Control: el mismo cupon a
   una muestra al azar de la red (no lookalike). Si lookalike > azar > control, la señal existe.

### 1.2 Starbucks Deep Brew — oferta y recomendacion por aprendizaje por refuerzo

1. **A → mecanismo → B.** Starbucks usa una plataforma de reinforcement learning (en Azure) que elige
   sugerencias y ofertas por miembro con historial de pedidos, hora, clima, inventario local y preferencias de la
   comunidad; ejemplo oficial: si pide siempre sin lacteos, infiere la preferencia y no le sugiere lacteos
   (Microsoft, 2019, 16 M de miembros). En la llamada de resultados Q1 FY2024 el CEO dijo que activaron
   capacidades de Deep Brew «to identify and incentivize specific rewards members cohorts» y ofertas dirigidas a
   convertir clientes ocasionales en miembros (34,3 M activos a 90 dias). Resultado B: frecuencia y ticket.
   - https://news.microsoft.com/source/features/digital-transformation/starbucks-turns-to-technology-to-brew-up-a-more-personal-connection-with-its-customers/ — **A**.
   - https://www.pymnts.com/news/loyalty-and-rewards-news/2024/starbucks-uses-artificial-intelligence-powered-personalized-rewards-boost-frequency-check-size/ — **M** (cita la llamada).
   - Cifra «+15 % engagement»: https://dmnews.com/dmn-analytics-insight-credits-deep-brew-with-a-15-engagement-lift-the-decade-of-identity-data-is-the-real-moat/ — **B** (no es de Starbucks).
2. **De B a C.** La leccion util no es el RL (CheckPass no tiene el volumen) sino **el bucle**: elegir una
   accion entre varias → observar → ajustar, con exploracion. En CheckPass el «brazo» es **el tipo de mensaje**
   (te extrañamos / en riesgo / perdido / cupon % / producto gratis / proximidad / cupon cruzado) y el premio es
   la visita incremental. Un **bandido** simple (Thompson sampling por segmento) reparte: la mayoria recibe el
   tipo que mejor viene funcionando para gente como ella y un 10-20 % explora otro. **El comercio no elige el
   texto por persona**: elige su objetivo y su presupuesto de cupones, la red elige el brazo.
3. **Por que es innovador.** En un comercio chico nunca hay datos para aprender que mensaje sirve; en la red
   el aprendizaje de 40 comercios se comparte (§1.4). El comercio recibe la ventaja de una cadena sin serlo.
4. **Viabilidad:** **media.** Tecnicamente es poco codigo (conteos + Beta), sin app. Riesgo: pocos eventos por
   celda; hay que agrupar fuerte (por rubro × etapa, no por persona) al principio.
5. **Experimento.** En 5 comercios que ya corren «te extrañamos», para los clientes elegibles de una semana
   sortear 3 brazos: (a) mensaje sin cupon, (b) mensaje + cupon, (c) holdout. Medir visita a 14 dias. Solo con
   eso se sabe si el cupon agrega algo sobre el mensaje — la pregunta que ningun comercio chico puede contestar.

### 1.3 Uplift / propension por tipo de mensaje — el correctivo del ejemplo del owner

1. **A → mecanismo → B.** El modelado de uplift predice el **efecto incremental** de contactar a alguien, no
   su probabilidad de responder. Separa 4 tipos: **persuadibles** (vuelven solo si los contactas), **seguros**
   (vuelven igual), **causas perdidas** (no vuelven igual) y **«no molestar»** (el contacto los aleja). Un modelo
   de respuesta clasico apunta a los seguros, que parecen los mejores respondedores y son plata tirada. Requiere
   datos de experimentos aleatorios (tratamiento vs control). Uso tipico: retencion en telcos, donde la campaña
   de retencion puede *provocar* bajas.
   - https://en.wikipedia.org/wiki/Uplift_modelling — **A** (concepto) ·
     https://www.uplift-modeling.com/en/latest/user_guide/introduction/clients.html — **A**.
   - Lecciones de uso en campañas: https://cmr.berkeley.edu/assets/documents/pdf/2025-11-to-treat-or-not-to-treat-five-lessons-learned-from-using-uplift-modeling-to-optimize-marketing-campaigns.pdf — **M** (no lo abri).
2. **De B a C — la correccion al ejemplo.** El owner dice: «no mandar te extrañamos a quien en N marcas
   demostro no responder a ese tipo de mensaje, pero si responde a perdido». Dos trampas:
   - **No volvio tras «te extrañamos» ≠ el mensaje no sirve.** Puede ser una causa perdida (no vuelve con
     nada), o puede haber vuelto IGUAL mas tarde. Sin holdout no se distingue.
   - **«Responde a perdido pero no a te extrañamos» casi siempre es un tema de RELOJ, no de tono.** Si una
     persona tiene una cadencia natural de 40 dias en panaderias, el «te extrañamos» a los 21 dias le llega
     cuando todavia no se fue: vuelve igual (seguro) o lo ignora. El «perdido» a los 60 dias le llega justo
     cuando si se estaba yendo (persuadible). Lo que la red aprende no es «le gusta el mensaje perdido» sino
     **su reloj personal**. Esto cambia el diseño: las etapas del ciclo de vida deberian medirse en **multiplos
     de la cadencia propia de la persona**, no en dias fijos por rubro (Producto 1, §3).
   Lo que SI se puede afirmar con datos de la red: por persona × tipo de mensaje, la diferencia entre tasa de
   vuelta tratado vs holdout, agregada entre comercios. Eso es exactamente lo que habilita `campaign_pushes`
   (holdout, sent_at, clicked_at) sumado al escaneo posterior.
3. **Por que es innovador.** Casi ningun programa de fidelizacion local mide contra control; CheckPass ya lo hace
   (ADR 0066, citado en `docs/red-y-atencion.md` §3). Un perfil **causal** («a esta persona el cupon no le cambia
   nada») permite algo vendible: **ahorrarle cupones al comercio** — «este mes no regalamos 38 cafes a clientes
   que volvian igual».
4. **Viabilidad:** **alta** para el nivel segmento, **baja** para uplift individual en el piloto (hace falta
   muchos experimentos por persona). Riesgo: sobreprometer personalizacion individual con ruido.
5. **Experimento.** SQL sobre las campañas ya corridas: por etapa × tipo, tasa de vuelta en tratados vs holdout.
   Luego partir a los tratados por «volvio antes del mensaje en su historial» (proxy de seguro). Si en el grupo
   «regulares» el uplift es ~0 y en «irregulares» es positivo, ya hay un producto: no mandar a los seguros.

### 1.4 Aprendizaje ENTRE comercios de una red (coaliciones: Payback, dunnhumby/Tesco/Kroger)

1. **A → mecanismo → B.** dunnhumby armo Clubcard para Tesco (desde 1994) usando el ticket de cada tarjeta para
   elegir cupones relevantes por persona; en 1997 ya segmentaba a nivel uno-a-uno. La misma casa trabajo con
   Kroger, a quien se le atribuye una redencion ~70 % en cupones personalizados (vs ~1-3 % tipico del cupon
   masivo). Payback (Alemania, > 35 M de clientes) es la coalicion: una tarjeta, muchos socios, cupones por socio.
   Resultado B: el dato de una categoria mejora la oferta en otra; el socio chico se beneficia del dato del grande.
   - Tesco/dunnhumby: https://en.wikipedia.org/wiki/Tesco_Clubcard — **M**; «uno-a-uno en 1997»,
     https://www.slideshare.net/slideshow/the-loyalty-guide-5-tesco-dunnhumby-case-study/16921762 — **B**.
   - Kroger ~70 % redencion (Forbes, via resumen de busqueda) — **B**. El 1-3 % del cupon masivo — sin fuente.
   - Payback > 35 M: https://www.payback.group/ — **A**; mecanica de eCoupons entre socios — sin fuente.
   - Advertencia (ya en el repo): en coaliciones la canibalizacion entre socios supera a la sinergia salvo entre
     socios chicos no competidores (Dorotic et al., JAMS 2021, citado en `docs/red-y-atencion.md` §4).
2. **De B a C — como se comparte sin exponer.** La pregunta del owner («si en 5 comercios no respondio a
   descuentos, probablemente tampoco en el 6°») es un problema estadistico clasico de **encogimiento**
   (bayes empirico / modelo jerarquico — sin fuente, tecnica estandar): la estimacion de cada persona se arma
   como *promedio de su segmento* corregido por *su propia evidencia*, pesada por cuanta evidencia hay. Con 1
   campaña, casi todo es segmento; con 8 campañas en 5 comercios, pesa la persona. Asi, el comercio N° 6 hereda
   lo aprendido en los otros 5 **sin que ninguno vea el dato del otro**. Concreto:
   - **Nivel red:** tasa base de uplift por (rubro, etapa, tipo de mensaje, franja).
   - **Nivel persona:** un «factor» por tipo de mensaje (p. ej. sensibilidad al descuento: alta/media/nula),
     Beta-Binomial con prior = nivel red.
   - **Que ve el comercio:** nunca el perfil. Ve el efecto: «de tus 80 dormidos, a 25 no les mandamos cupon
     porque en la red vuelven sin cupon; les mandamos solo el recordatorio».
3. **Por que es dificil de copiar.** El valor crece con la cantidad de comercios por consumidor. Un sistema de
   fidelizacion de un solo comercio (o una app de sellos por marca) no puede hacerlo por construccion.
4. **Viabilidad:** **media.** Depende de una metrica que hoy no conozco: **que fraccion de consumidores es
   miembro de ≥ 3 comercios**. Si es < 10 %, el nivel persona no aporta y todo es nivel segmento (que igual
   sirve). Riesgo adicional: usar el dato de un cafe para una campaña de OTRO cafe es sensible comercialmente
   aunque sea agregado → excluir por defecto el aprendizaje entre competidores del mismo `category_gcid`
   (el mismo criterio de «no competidor» que el owner ya fijo para «Mis beneficios»).
5. **Experimento.** Consulta (en rama de Neon, no prod): distribucion de memberships por consumidor, y para los
   que tienen ≥ 3, correlacion entre su «vuelve tras cupon» en un comercio y en otro. Si la correlacion es ~0,
   la hipotesis del owner no se sostiene con estos datos y se ahorra construir el nivel persona.

### 1.5 McDonald's + Dynamic Yield — personalizar sin identidad (contexto, no persona)

1. **A → mecanismo → B.** En 2019 McDonald's compro Dynamic Yield (~US$300 M) y en meses llevo a > 12.000
   drive-thrus una logica que cambia el menu digital segun hora, clima, trafico del local y productos en
   tendencia, y sugiere agregados segun lo que ya se pidio: la mayoria de los clientes del drive-thru es
   **anonima**. Reporto ticket promedio mas alto; y en 2022 **vendio** la empresa (a Mastercard).
   - https://corporate.mcdonalds.com/corpmcd/our-stories/article/dynamic_yield_1164112100.html — **A** (no abierto; titular y resumen) ·
     https://www.restaurantdive.com/news/mcdonalds-revs-up-personalization-rollout-to-8k-drive-thrus/559649/ — **M** ·
     venta 2022: https://www.adexchanger.com/ad-exchange-news/the-ad-tech-company-that-keeps-getting-acquired-by-brands/ — **M**.
2. **De B a C.** Es la respuesta al **arranque en frio**: cuando no hay historia de la persona (consumidor nuevo)
   o del comercio (recien entra), se personaliza por **contexto**: hora del escaneo, rubro del local donde esta,
   dia, barrio. Un consumidor recien sumado en una cafeteria a las 8:00 recibe en «Mis beneficios» primero lo
   que la red sabe que funciona para «gente que escanea cafe a la mañana en ese barrio». La leccion de la venta:
   **la personalizacion es una capacidad, no un producto que se compra**; lo que no se integra al flujo diario
   (escaneo, «Mis beneficios») se abandona.
3. **Innovador:** poco — es la parte «aburrida». Pero sin ella el perfil es inutil las primeras semanas, que
   es justo cuando el comercio decide si paga.
4. **Viabilidad:** **alta**. Son reglas + conteos por segmento. Riesgo: que el «contexto» sea tan grueso que
   todos vean lo mismo.
5. **Experimento.** Para consumidores con < 2 escaneos, ordenar «Mis beneficios» por la tasa de canje del
   segmento (rubro del escaneo × franja) vs orden por distancia; medir aperturas y canjes en una semana.

---

## 2. Que señales tiene CheckPass (y cuales no)

Verificado en el arbol (`apps/merchant/src/server/schema/`): memberships con saldo, `enrolledAt` y
`marketingOptOutAt` **por comercio** (`consumer.ts:138-150`); campañas con `kind`, cupon tipado (tipo, costo,
descuento, producto) (`campaign.ts:58-107`); envios con `holdout`, `sent_at`, `clicked_at`, `cancel_reason`
(`campaign-push.ts:34-55`); cupones emitidos con snapshot de tipo y vigencia (`campaign-coupon.ts:53-93`);
comercios con `category_gcid` y locales con lat/long (`business.ts:50`, `:206`, `:235`). No verifique la tabla de
escaneos ni la de canjes columna por columna — las señales de abajo que dependen de ellas son a confirmar.

| Señal | Deriva de | Para que sirve | Sensibilidad |
|---|---|---|---|
| **Cadencia por rubro** (mediana de dias entre visitas, y su variabilidad) | escaneos × `category_gcid` | reloj personal: cuando alguien esta «tarde» de verdad | baja |
| **Franja horaria y dias** dominantes | timestamp del escaneo | hora de entrega, lookalike, contexto | baja |
| **Zona de vida** (centroide de locales escaneados, radio) | lat/long del local del escaneo | cercania sin GPS; lookalike por barrio | **media**: ubicacion es «elaboracion de perfiles» explicita en la LOPDP |
| **Canasta de rubros** (que combina: cafe+gym, panaderia+farmacia) | memberships × rubro | complementariedad para cupon cruzado y lookalike | **alta si incluye farmacias/salud** (ver §4) |
| **Afinidad de exploracion** (cuantos comercios nuevos por mes; si canjea bienvenidas) | memberships nuevas | a quien vale mostrarle comercios nuevos | baja |
| **Sensibilidad al incentivo por tipo** (uplift estimado: sin cupon / % / producto gratis / 2x1) | pushes + cupones + holdout + escaneo posterior | no regalar a los seguros; elegir el tipo | media |
| **Respuesta por canal** (proximidad, aviso Wallet, solo «Mis beneficios») | `channel_*`, `clicked_at` | asignar el cupo de 3 avisos | baja |
| **Estilo de canje** (canjea apenas puede / acumula / deja vencer) | canjes vs saldo | recordatorios de vencimiento, tipo de premio | baja |
| **Valor** (si el comercio registra monto; `accrual_block_amount` sugiere que en puntos si) | escaneo por monto | lookalike «por valor» como el value-based de Meta | media |

**Lo que NO tiene y no hace falta:** edad, genero, ingresos, intereses declarados. Meta los necesita porque no
ve la compra; CheckPass ve la compra. Pedir menos datos es tambien la mejor defensa legal.

---

## 3. Productos que salen del perfil (5)

**P1 — Reloj personal.** Las etapas «te extrañamos / en riesgo / perdido» se disparan en multiplos de la
cadencia propia de la persona en ese rubro (p. ej. 1,5× / 2,5× / 4×), con la regla por rubro como prior cuando
hay poca historia. *Comercio:* no configura nada nuevo; ve menos mensajes desperdiciados. *Consumidor:* no recibe
«te extrañamos» dos dias despues de su ritmo normal. Es la traduccion correcta del ejemplo del owner (§1.3).

**P2 — «No regales a quien vuelve igual» (perfil de sensibilidad al incentivo).** Antes de adjuntar un cupon a
una campaña, la red mira el uplift estimado del cupon para esa persona (nivel red + persona, §1.4). Seguros →
mensaje sin cupon; persuadibles → cupon; causas perdidas → nada (ahorra cupo de avisos). *El comercio percibe:*
«Ahorramos 38 cupones este mes; la tasa de vuelta fue igual que si los regalabamos (medido contra control)». Es
el informe «en plata» que el owner ya preve, pero con un numero que solo la red puede dar.

**P3 — Lookalike local de adquisicion («clientes como tus mejores clientes»).** §1.1. Semilla = top clientes del
comercio; universo = consumidores de la red no miembros, de rubro no competidor como fuente de señal, a distancia
razonable. Entrega: bienvenida en «Mis beneficios» y como cupon cruzado en el escaneo (no gasta avisos). Medido
con holdout sobre el propio lookalike. Ataca el resultado (2) de la mision —clientes NUEVOS desde la red— con la
unica prueba de incrementalidad que, segun `docs/red-y-atencion.md` §4, nadie publico.

**P4 — Arranque en frio del comercio nuevo («tu audiencia en la red»).** El dia del alta el comercio ve un numero
concreto: «hay 340 personas en la red que escanean a la mañana a ≤ 800 m y van a rubros que combinan con el tuyo».
Sus primeras campañas usan los priors de su rubro × barrio, no cero. Es argumento de venta a US$10/mes: el
comercio compra acceso a una audiencia, no un software de sellos.

**P5 — Asignador del cupo de avisos por perfil.** Con 3 avisos por pase y dia en toda la red, el orden entre
comercios que compiten por el aviso (`docs/red-y-atencion.md` §3) se decide por **uplift esperado para esa
persona** × cercania × rotacion. Complementa el borrador del orquestador (que ordena por rotacion → cercania →
rendimiento del comercio) cambiando «rendimiento del comercio» por «respuesta de ESTA persona a ESTE tipo».

---

## 4. Privacidad — LOPDP Ecuador (texto leido: Registro Oficial Supl. 459, 26-may-2021)

Fuente: https://www.finanzaspopulares.gob.ec/wp-content/uploads/2021/07/ley_organica_de_proteccion_de_datos_personales.pdf — **A**
(texto extraido y leido). Sanciones vigentes desde 2023 segun https://orizontel.ec/guia-lopdp-ecuador/ — **M**.

- **La ley nombra exactamente lo que queremos hacer.** Define «Elaboracion de perfiles» como tratamiento que
  permite «evaluar, analizar o predecir aspectos de una persona natural» sobre «preferencias personales,
  intereses, … ubicacion, movimiento fisico». El perfil de red es esto, sin discusion.
- **Art. 8 — consentimiento «libre, especifico, informado e inequivoco», revocable «en cualquier momento» con un
  procedimiento «similar» al que lo recabo.** Hoy el consentimiento es **por comercio**: escanear = afiliacion +
  consentimiento (`consumer.ts:143-145`, ADR 0033 §2). Cruzar datos entre comercios para perfilar es **otra
  finalidad** → necesita su consentimiento especifico, no se hereda del escaneo.
- **Art. 16.2 — oposicion a la mercadotecnia directa «en todo momento … incluida la elaboracion de perfiles».**
  Hace falta un interruptor de red «no me perfiles» distinto del opt-out por comercio (`marketingOptOutAt`), y
  al activarlo el sistema vuelve a reglas por rubro para esa persona.
- **Art. 33 — comunicar datos a terceros requiere, ademas, consentimiento del titular.** Diseño: **el perfil no
  sale de CheckPass**. El comercio nunca ve datos individuales de otros comercios; ve efectos agregados. Esto
  tambien protege del conflicto entre competidores.
- **Art. 20 — derecho a no ser objeto de decisiones automatizadas «incluida la elaboracion de perfiles» que
  produzcan efectos juridicos o atenten contra derechos**, con derecho a explicacion, criterios y tipos de datos.
  Elegir que mensaje ver probablemente no tiene efecto juridico, pero **dar descuentos distintos a personas
  distintas** se acerca. Excepciones utiles: consentimiento explicito (3) y decision sin impacto grave (4).
  Diseño: un «¿por que veo esto?» en «Mis beneficios» (cumple el derecho a explicacion y genera confianza).
- **Art. 42 — evaluacion de impacto obligatoria** para evaluacion sistematica de aspectos personales basada en
  perfiles con efectos juridicos. Posiblemente no obligatoria aqui; hacerla igual es barato y defendible.
- **Datos sensibles (definicion: incluye «salud»; Art. 26 prohibe su tratamiento salvo excepciones).** Visitas a
  farmacias, clinicas, opticas, laboratorios o incluso gimnasios de rehabilitacion permiten **inferir salud**.
  Regla propuesta: esos rubros **no alimentan el perfil de red** (sus escaneos cuentan solo para su propio
  comercio). **Menores (Art. 21):** sin perfilamiento automatizado.

**Momento de consentimiento que el consumidor QUIERA dar:** un resumen tipo «Tu mes en Cuenca» (rubros,
lugares nuevos, ahorro) que muestra el valor del perfil y en ese mismo momento pide el permiso de red, con
el interruptor al lado. Consentimiento informado por construccion.

---

## 5. Ranking

1. **P2 + P1 juntos («no regales a quien vuelve igual» con reloj personal).** Usa lo que ya existe (holdout,
   campañas, cupones), da un numero en plata que el comercio percibe, y corrige el ejemplo del owner hacia algo
   medible. Es el mas barato y el mas defendible.
2. **P3 — Lookalike local de adquisicion con holdout.** Es el que ataca el resultado (2) de la mision, el que
   mas vende, y el que puede ser la primera prueba publica de que una red local trae clientes incrementales.
   Depende del volumen del piloto.
3. **P4 — «Tu audiencia en la red» en el alta.** Casi sin modelo; convierte el perfil agregado en argumento de
   venta del precio de US$10.

(P5 es importante pero es una pieza del ADR del cupo de avisos, no un producto que el comercio perciba.)

## 6. Idea loca

**Cobrar por cliente nuevo incremental, verificado contra control.** Belly cobraba por cliente nuevo desde la red
(`docs/red-y-atencion.md` §4) pero sin probar que era incremental. Con P3 + holdout, CheckPass puede ofrecer:
«US$10/mes base + US$X solo por cada cliente nuevo que vino por la red **y que no habria venido** (medido contra
el grupo que no recibio tu bienvenida)». Los comercios **pujan** por el lugar en «Mis beneficios» de los lookalikes
de alta afinidad con su uplift esperado, no con su presupuesto. Es el modelo de Meta (pagar por conversion) pero
con conversion fisica y causal. Riesgos: con poco volumen la medicion es ruidosa y la factura se discute; y
monetizar el perfil sube la vara de la LOPDP (Art. 33). Vale discutirlo porque resuelve de raiz la pregunta
«¿por que pagar?» — pagas solo si funciona.

## 7. Lo que falta medir antes de decidir (declarado)

- Fraccion de consumidores con ≥ 3 memberships y ≥ 2 rubros (sin eso, el nivel persona no existe).
- Volumen de campañas con holdout ya corridas (sin eso, P2 arranca como experimento, no como producto).
- Correlacion real de «respuesta a cupon» entre comercios de la misma persona (la hipotesis del owner).
- Columnas exactas de escaneo y canje (no verificadas en esta nota).
- Cifras marcadas B: Kroger 70 %, retiro de similar audiences de Google, mecanica de Payback.
