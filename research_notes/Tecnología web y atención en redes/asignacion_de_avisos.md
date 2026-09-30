# Asignacion de avisos: muchos emisores compitiendo por la atencion limitada de un usuario

Contexto: red de comercios locales (~20 comercios) que compiten por ~3 avisos/dia por consumidor.
Investigado el 2026-09-29. Presupuesto: ~16 llamadas de herramienta. Confianza: **alta** = fuente
primaria (blog de ingenieria de la empresa, paper revisado por pares); **media** = resumen secundario
de un paper primario; **baja** = agregador de estadisticas o blog de marketing sin metodologia.
Aviso: varias paginas primarias devolvieron 403 (blog de Pinterest en Medium, blog de DoorDash) y el
PDF de Duolingo no se pudo extraer; donde un dato viene del snippet del buscador y no de la pagina
leida, se marca **[snippet]**.

## 1. Uber: Consumer Communication Gateway (CCG)

### Takeaway
Uber centraliza TODOS los push de todos los equipos internos en un "inbox" por usuario; un modelo
XGBoost puntua cada par (push, horario) y un programa lineal (problema de asignacion) elige cuales
mandar y cuando, bajo un tope diario, un espaciado minimo y ventanas de envio. Lo que no entra se
DESCARTA. Es exactamente el caso "muchos emisores, un cupo".

### Cited Findings
- Problema de origen: los equipos mandaban push por separado, "within minutes and hours of each other, many with conflicting messaging". La solucion es un gateway central, no reglas de prioridad por equipo — [Uber Blog](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/) (alta)
- Arquitectura: los push entran a un buffer (Persistor), se puntuan, se agendan (Schedule Generator + Scheduler sobre Cadence) y se entregan (Push Delivery) — [Uber Blog](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/) (alta)
- Objetivo: maximizar la suma de puntajes de las asignaciones; el puntaje es la probabilidad de conversion dentro de 24 h si el push se envia en ese horario — [Uber Blog](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/) (alta)
- Restricciones del LP (ejemplos textuales del post): expiracion del push ("antes de que expire la promocion"), tope diario ("at most 2 pushes per day"), separacion minima ("8 hours between pushes"), ventana de envio ("only morning hours"), horario de apertura del restaurante — [Uber Blog](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/) (alta)
- Regla de exceso: si el inbox supera el tope, "the most valuable pushes will be assigned to a time for delivery and the remaining ones will be dropped" — [Uber Blog](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/) (alta)
- Features del modelo: hora y dia de semana; categoria, contenido y deeplink del push; historial de pedidos y de engagement con push del usuario. Desbalance de clases resuelto con downsampling de negativos — [Uber Blog](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/) (alta)
- Resultados: solo cualitativos, "a reduction in opt outs" y "a strong increase in the relevance"; sin cifras publicadas — [Uber Blog](https://www.uber.com/us/en/blog/how-uber-optimizes-push-notifications-using-ml/) (alta sobre que no hay cifras)
- Uber tambien publico un enfoque de bandits contextuales para CRM personalizado — [Uber Blog](https://www.uber.com/blog/enhancing-personalized-crm/) (no leido; solo titulo)

### Inferences
- El patron "cola por usuario + puntaje + asignacion con topes + descarte del sobrante" traslada directo a la red de comercios: cada comercio encola candidatos, el sistema decide los 3 del dia. Con 20 emisores y 3 slots no hace falta un LP: un greedy por puntaje con restricciones (espaciado, ventana, expiracion) resuelve el mismo problema a esa escala.
- Uber no publica ningun mecanismo de equidad entre equipos emisores: su objetivo es solo valor para el usuario. En una red de comercios que pagan, eso es un hueco a disenar (ver seccion 3).

### Gaps
- Sin cifras de efecto ni el valor real de los topes en produccion (los "2/dia" y "8 h" son ejemplos del post, no necesariamente la config real).

## 2. LinkedIn, Pinterest, Meta/Instagram, Duolingo: control de volumen y fatiga

### Takeaway
Hay evidencia primaria consistente de que MENOS avisos, mejor elegidos, sostienen o suben el
engagement: Pinterest bajo volumen hasta 24% y subio CTR; Instagram bajo volumen "sustancialmente"
sin caida de engagement usando modelos de uplift; LinkedIn formula el volumen como decision
secuencial (RL). Los mecanismos recurrentes: presupuesto por usuario (semanal en Pinterest),
penalizacion por repeticion/recencia (Duolingo, Instagram) y objetivo de largo plazo con costo
explicito de desuscripcion.

### Cited Findings
**Pinterest**
- KDD 2018 "Notification Volume Control and Optimization System at Pinterest": enfoque ML para decidir el volumen de avisos por usuario optimizando engagement de largo plazo; en produccion desde mediados de 2017; redujo volumen y mejoro CTR y engagement del sitio vs. el enfoque ML anterior — [ACM DL](https://dl.acm.org/doi/10.1145/3219819.3219906), [KDD 2018](https://www.kdd.org/kdd2018/accepted-papers/view/notification-volume-control-and-optimization-system-at-pinterest) (alta, abstract)
- Cifras: volumen -24% (hasta), CTR de email +31% (hasta), push CTR +21% con menos volumen, DAU sube en usuarios poco activos — [grohaus.io](https://www.grohaus.io/content/pinterest-cut-notifications-by-24-using-ai-then-ctr-and-app-engagement-went-up) **[snippet, secundario]** (media; cifras no verificadas contra el PDF)
- Mecanismo: presupuesto SEMANAL de avisos por usuario; un "budget pacer" reparte ese presupuesto semanal en dias; modelos que predicen tanto la subida (visitas) como el costo (desuscripciones, churn) de enviar — [Pinterest Engineering, User state-based notification volume optimization](https://medium.com/pinterest-engineering/user-state-based-notification-volume-optimization-7764118f73ff) **[snippet; la pagina dio 403]**; [Resumen del paper (Nerd For Tech)](https://medium.com/nerd-for-tech/paper-explained-notification-volume-control-and-optimization-system-at-pinterest-f4a85608d05c) (media)
- Hallazgo contraintuitivo: mandar mas avisos a usuarios con CTR alto no necesariamente es buena estrategia — [grohaus.io](https://www.grohaus.io/content/pinterest-cut-notifications-by-24-using-ai-then-ctr-and-app-engagement-went-up) **[snippet]** (media)
- Post 2020: GBDT que predice la actividad del usuario en funcion del presupuesto, segmentando por "estado de usuario" (nivel de actividad) — [Pinterest Engineering](https://medium.com/pinterest-engineering/user-state-based-notification-volume-optimization-7764118f73ff) **[snippet]** (media)
- 2024: NEP, sistema de nueva generacion que decide contenido, destinatario, canal y horario casi en tiempo real — [Pinterest Engineering, NEP](https://medium.com/pinterest-engineering/nep-notification-system-and-relevance-a7fff21986c7) **[snippet]** (media)

**LinkedIn**
- KDD 2016 "Email Volume Optimization at LinkedIn" (Gupta et al.): mandar un mensaje por cada evento abruma y reduce la efectividad si no es relevante; optimizan volumen — [ACM DL](https://dl.acm.org/doi/10.1145/2939672.2939692) (alta, abstract). Seguimiento: "Optimizing Email Volume For Sitewide Engagement", CIKM 2017 **[snippet]** (media)
- WSDM 2022 "Near Real Time AI Personalization for Notifications at LinkedIn" — [ACM DL](https://dl.acm.org/doi/10.1145/3488560.3510017); explicacion del autor — [Medium, T. Goel](https://medium.com/@tushargoelml/near-real-time-optimization-of-notifications-at-linkedin-part-i-893dcb8eef41) (no leidos; solo titulo)
- "Offline Reinforcement Learning for Mobile Notifications" (arXiv 2202.03867): trata el envio como problema secuencial porque "a user's experience depends on a sequence of notifications and attributing impact to a single notification is not always accurate"; Double DQN entrenado offline, evaluado con importance sampling, lanzado en produccion — [arXiv](https://arxiv.org/abs/2202.03867) (alta para el enfoque)
- Cifras atribuidas a ese trabajo: volumen -3,49%, sesiones +0,3%, CTR de avisos +4,53%, tasa de "unfollow" de avisos -4,37% — [arXiv PDF](https://arxiv.org/pdf/2202.03867) **[snippet; el abstract leido no trae cifras]** (media)
- Tambien: "Multi-objective Optimization of Notifications Using Offline RL" — [arXiv 2207.03029](https://arxiv.org/pdf/2207.03029) (no leido)

**Meta / Instagram**
- 2022: en vez de un modelo de CTR, un modelo de UPLIFT (efecto incremental) decide si mandar el "daily digest" de stories. Experimento aleatorio: cada aviso se enviaba o descartaba con 50% de probabilidad; con eso entrenaron una red neuronal de uplift a nivel usuario; una transformacion de cuantiles online mantiene estable la tasa de envio — [Engineering at Meta](https://engineering.fb.com/2022/10/31/ml-applications/instagram-notification-management-machine-learning/) (alta)
- Quien pierde avisos: los usuarios MUY activos, que "would be active without receiving the daily digest notifications and thus the incremental values would be small". Resultado: "reduced the sending volume substantially compared to using the CTR model and also saw no decline in user engagement" (sin cifras) — [Engineering at Meta](https://engineering.fb.com/2022/10/31/ml-applications/instagram-notification-management-machine-learning/) (alta)
- 2025: ranking con conciencia de diversidad. Score(c) = R(c) x D(c), con D(c) = prod(1 - w_i * p_i(c)); p_i es una senal tipo MMR que vale 1 si la similitud con lo ya enviado supera un umbral en la dimension i (autor, contenido, superficie de producto, tipo de aviso). Ataca la sobreexposicion del mismo autor y la uniformidad de superficie. Resultado: "significantly reduced daily notification volume while improving CTR" (sin cifras) — [Engineering at Meta](https://engineering.fb.com/2025/09/02/ml-applications/a-new-ranking-framework-for-better-notification-quality-on-instagram/) (alta)
- El mismo post sostiene que avisos repetitivos se sienten spam y aumentan la probabilidad de que el usuario los desactive — [Engineering at Meta](https://engineering.fb.com/2025/09/02/ml-applications/a-new-ranking-framework-for-better-notification-quality-on-instagram/) (alta)

**Duolingo**
- KDD 2020 "A Sleeping, Recovering Bandit Algorithm for Optimizing Recurring Notifications" (Yancey & Settles): los bandits clasicos no sirven por el efecto novedad y la elegibilidad condicional (brazos que "duermen"); proponen Recovering Difference Softmax — [ACM DL](https://dl.acm.org/doi/10.1145/3394486.3403351), [PDF](https://research.duolingo.com/papers/yancey.kdd20.pdf) (alta; el PDF no se pudo extraer, datos del abstract via buscador)
- Mecanismo: puntaje por plantilla segun historial; se penaliza la plantilla enviada recientemente al mismo usuario (la novedad se "recupera" con el tiempo); softmax convierte puntajes en probabilidades — [Semantic Scholar](https://www.semanticscholar.org/paper/A-Sleeping,-Recovering-Bandit-Algorithm-for-Yancey-Settles/2c71f6fd971ae7c2d1b6134a35a8c686d835ccac) (media)
- Resultado: +0,5% DAU total y +2% retencion de usuarios nuevos sobre una linea de base fuerte — [KDD 2020](https://www.kdd.org/kdd2020/accepted-papers/view/a-sleeping-recovering-bandit-algorithm-for-optimizing-recurring-notificatio.html) **[snippet]** (media-alta)
- Dataset publico: 200 M de push en 35 dias, con plantilla y conversion a 2 h — [OpenDataLab](https://opendatalab.com/OpenDataLab/Duolingo_Bandit_Notifications/download) **[snippet]** (media)

**Benchmarks de industria (frecuencia y opt-out)**
- Encuesta interna de Braze (14 empleados): opt-out de push en 584 de 1.526 apps = 38,3%; valoran un centro de preferencias de frecuencia/contenido — [Braze](https://www.braze.com/resources/articles/opt-out-of-push-notifications-why-users-do-it) (baja: n=14, no representativa)
- "Mas de 6 push/semana de una marca = 3,4x mas probable desinstalar en 30 dias vs 1-2/semana", atribuido a un informe de Klaviyo — [amraandelma.com](https://www.amraandelma.com/push-notification-marketing-statistics/) **[NO VERIFICADO: agregador, no se encontro el informe primario]** (baja)

### Inferences
- Para 3 avisos/dia: el techo diario conviene expresarlo como presupuesto semanal con pacing (Pinterest) para no quemar el cupo en dias flojos y para adaptarlo por usuario (usuarios que no responden -> menos, no mas).
- La penalizacion multiplicativa por repeticion de autor (Instagram) es directamente un mecanismo de rotacion entre comercios: si el comercio X ya aparecio hoy/ayer, su siguiente candidato se multiplica por (1 - w).
- La penalizacion por recencia de Duolingo aplicada al tipo de beneficio evita que el mismo formato de oferta se gaste por novedad.
- Instagram muestra que el uplift, no el CTR, es la metrica correcta para decidir a quien NO avisar: el cliente que igual iba a ir al comercio no necesita el aviso.

### Gaps
- Twitter/X: no se encontro material primario reciente sobre su sistema de control de volumen de push dentro del presupuesto de busqueda.
- No se pudo leer el texto completo de los papers de Pinterest y Duolingo (403 / PDF binario); las cifras de Pinterest vienen de un secundario.

## 3. Equidad entre emisores en un canal con tope (rotacion, pacing, marketplaces)

### Takeaway
Los sistemas de notificaciones publicados optimizan valor para el usuario y tratan la equidad
entre emisores solo indirectamente (penalizacion de repeticion por autor en Instagram). El
mecanismo maduro de "reparto justo de un recurso escaso entre muchos anunciantes" es el budget
pacing publicitario, en particular el throttling probabilistico. En marketplaces (DoorDash) la
exposicion de comercios nuevos/locales se maneja con exploracion (explore/exploit).

### Cited Findings
- Throttling probabilistico: cada campana tiene una probabilidad de participar p(t); si va sobre-entregada respecto de su objetivo, p(t) baja; si va sub-entregada, sube. Adoptado por Facebook, Google, LinkedIn y Yahoo — [A Practical Guide to Budget Pacing Algorithms (arXiv 2503.06942)](https://arxiv.org/pdf/2503.06942) **[snippet]** (media-alta)
- Variante con multiplicadores de Lagrange para pacing con riesgo acotado (RCPacing) — [arXiv 2312.06174](https://arxiv.org/html/2312.06174) **[snippet]** (media)
- Throttling dinamico en subastas repetidas de segundo precio — [arXiv 2207.04690](https://arxiv.org/pdf/2207.04690) (no leido)
- Pinterest tiene ademas "Flexible Daily Budgeting" para anunciantes (reparto del presupuesto entre dias) — [Pinterest Engineering](https://medium.com/pinterest-engineering/flexible-daily-budgeting-at-pinterest-91fc310c2e33) (no leido; solo titulo)
- DoorDash: recomendacion del home con explotacion y exploracion para dar oportunidades a comercios locales y nuevos, mejorando diversidad y equidad del marketplace — [DoorDash Engineering](https://careersatdoordash.com/blog/homepage-recommendation-with-exploitation-and-exploration/) **[snippet; la pagina dio 403, sin cifras]** (media)
- DoorDash declara que su estado de comercio ("Merchant Status") no crea un sistema de ranking aparte, aunque el mejor desempeno operativo puede aumentar la aparicion — [DoorDash Help](https://help.doordash.com/en-us/merchants/article/road-to-most-love-faqs) **[snippet]** (media)
- Instagram: la dimension "autor" en la demotion multiplicativa limita la sobreexposicion del mismo emisor — [Engineering at Meta](https://engineering.fb.com/2025/09/02/ml-applications/a-new-ranking-framework-for-better-notification-quality-on-instagram/) (alta)

### Inferences
- Diseno aplicable: puntaje(usuario, oferta) x factor de repeticion del comercio (Instagram) x factor de pacing del comercio (ads): si el comercio ya recibio mas exposicion que su cuota justa en la semana, su factor baja; si recibio menos, sube. Esto es rotacion "suave" sin romper la relevancia.
- Una cuota justa puede definirse por red (partes iguales) o por plan pagado; es una decision de producto, no tecnica.
- Exploracion (DoorDash, bandits de Duolingo): un comercio nuevo sin historial necesita un margen de exploracion o nunca gana un slot contra comercios con datos.

### Gaps
- No se encontro un sistema de NOTIFICACIONES publicado que imponga cuotas de equidad entre emisores de forma explicita; la analogia con ads pacing es inferencia.
- Sin cifras de DoorDash/Uber Eats sobre exposicion de comercios chicos.

## 4. Digest vs. avisos individuales

### Takeaway
La evidencia fuerte es de Meta: un digest diario puede ser redundante para usuarios muy activos
(uplift bajo). Las cifras comparativas de CTR digest vs. individual que circulan vienen de
agregadores sin metodologia y deben tratarse como no verificadas.

### Cited Findings
- Instagram envia un "daily digest" de stories; para usuarios muy activos su valor incremental es pequeno y se puede suprimir sin perder engagement — [Engineering at Meta](https://engineering.fb.com/2022/10/31/ml-applications/instagram-notification-management-machine-learning/) (alta)
- "Weekly digests CTR 2-4% vs 1-3% envios promocionales individuales vs 0,5-1,5% broadcasts diarios", atribuido a Mailchimp; digests con mas de 10 items pierden 15-25% de CTR — [emailcalculator.com](https://emailcalculator.com/glossary/email-digest) **[NO VERIFICADO: glosario sin fuente primaria enlazada]** (baja)
- Pinterest combina email y push en su presupuesto y reporta mejora en usuarios que reciben ambos canales — [grohaus.io](https://www.grohaus.io/content/pinterest-cut-notifications-by-24-using-ai-then-ctr-and-app-engagement-went-up) **[snippet]** (media)

### Inferences
- Para la red: con 3 slots/dia, un slot puede ser un "resumen" de los beneficios disponibles (lo que el usuario va a ver al abrir su inbox), y los otros dos avisos dirigidos de alto valor. El digest no compite por slots entre comercios.
- El limite de ~10 items por digest (si fuera cierto) sugiere curar el digest al top-N, no listar los 20 comercios.

### Gaps
- No se encontro un experimento controlado primario publicado que compare digest vs. individual para push.

## 5. Inboxes de cupones/beneficios en super-apps y programas

### Takeaway
No hay datos publicos primarios de tasas de canje de los wallets de Grab, Gojek, Rappi, Mercado
Pago o Starbucks. Lo que existe son descripciones de mecanica (Payback: activar antes de canjear,
cupones segmentados semanales; Starbucks: ofertas personalizadas por cohortes con Deep Brew) y
benchmarks de agregadores de baja confianza.

### Cited Findings
- Payback: cada semana ~7-10 M de miembros activos reciben su saldo y eCoupons segmentados por grupo objetivo — [PAYBACK Group](https://www.payback.group/en/group/payback/performance) **[snippet]** (media)
- Payback: los eCoupons deben ACTIVARSE antes de comprar para valer (mecanica "clip") — [PAYBACK FAQ](https://www.payback.de/faq/ecoupons-aktivieren) (media); existen scripts de terceros que activan todos los cupones automaticamente, senal de friccion en el inbox — [GitHub payback-coupon-activator](https://github.com/BobbyCephy/payback-coupon-activator) (media)
- Starbucks: Deep Brew identifica cohortes de miembros y ofrece incentivos personalizados (p. ej. estrellas dobles en la categoria que el cliente compra) — [marketerintheloop](https://marketerintheloop.com/p/starbucks-ai-powered-hyper-personalization-with-deep-brew) (baja-media, secundario)
- Starbucks: 35,5 M de miembros activos a 90 dias en EE.UU. en el Q1 FY2026; relanzamiento del programa en 2026 con foco en personalizacion — [Starbucks press 2026](https://about.starbucks.com/press/2026/starbucks-unveils-reimagined-loyalty-program-to-deliver-more-meaningful-value-personalization-and-engagement-to-members/) **[cifra via snippet]** (media-alta)
- "+15% de engagement por Deep Brew" — [dmnews](https://dmnews.com/dmn-analytics-insight-credits-deep-brew-with-a-15-engagement-lift-the-decade-of-identity-data-is-the-real-moat/) **[NO VERIFICADO: atribuido a un tercero, sin metodologia]** (baja)
- Canje de cupones digitales: 7% promedio / 10-15% vs 1-2% del papel; cupones integrados a wallet 18% vs 8% por email — [Opensend](https://www.opensend.com/post/promotional-redemption-rate-statistics-ecommerce), [demandsage](https://www.demandsage.com/coupon-statistics/) **[NO VERIFICADO: agregadores; cifras sin fuente primaria]** (baja)

### Inferences
- La mecanica "activar/guardar" de Payback es un senal de interes barata que sirve de feedback para el ranking (equivalente al click), antes del canje.
- Si las cifras de wallet (18%) fueran ciertas, sostendrian que el beneficio vivo en un inbox persistente rinde mas que el aviso efimero; pero no hay fuente primaria.

### Gaps
- Grab, Gojek, Rappi, Mercado Pago: no se encontraron datos publicos de engagement ni de canje de sus secciones de vouchers/cupones, ni de su criterio de orden (distancia/relevancia) documentado por la empresa.

## 6. A quien priorizar: en riesgo de churn vs. mas propensos a responder (uplift)

### Takeaway
La literatura de uplift dice: ni a los de mayor riesgo ni a los de mayor respuesta, sino a los
"persuadibles" (mayor efecto incremental). Enviar a quien igual iba a volver (sure things) desperdicia
cupo, y existen "sleeping dogs" a quienes el contacto empeora. Instagram lo aplica en produccion.

### Cited Findings
- Cuatro segmentos: sure things, lost causes, sleeping dogs, persuadables; los persuadibles no se van SOLO si se los contacta; los sleeping dogs se van SOLO porque se los contacto — [Wikipedia, Uplift modelling](https://en.wikipedia.org/wiki/Uplift_modelling) (media); [Stochastic Solutions, uplift para retencion](https://stochasticsolutions.com/pdf/uplift-modelling-for-retention.pdf) (media, no leido completo)
- "Why you should stop predicting customer churn and start using uplift models" (Information Sciences) — [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0020025519312022) **[solo titulo/snippet]** (media)
- Un modelo de propension (churn) no puede representar a los sleeping dogs porque no modela la intervencion; la evaluacion se hace con curva Qini — [GitHub upliftpolicy](https://github.com/SlateGitOrg/upliftpolicy) **[snippet]** (baja-media)
- Caso de produccion: Instagram reemplaza CTR por uplift y deja de avisar a los usuarios muy activos (sure things) sin perder engagement; requiere un grupo aleatorizado (50/50) para entrenar — [Engineering at Meta](https://engineering.fb.com/2022/10/31/ml-applications/instagram-notification-management-machine-learning/) (alta)
- LinkedIn: "Personalized Treatment Selection using Causal Heterogeneity" — [arXiv 1901.10550](https://arxiv.org/pdf/1901.10550) (no leido)
- Pinterest: mas avisos a quien tiene CTR alto no es necesariamente buena estrategia — [grohaus.io](https://www.grohaus.io/content/pinterest-cut-notifications-by-24-using-ai-then-ctr-and-app-engagement-went-up) **[snippet]** (media)

### Inferences
- Para la red: el criterio correcto por slot es "cuanto cambia este aviso la probabilidad de visita", no "cuan probable es que visite". Mientras no haya datos para un modelo de uplift, una aproximacion es reservar un grupo de control aleatorio (sin aviso) desde el dia 1 para poder medir incrementalidad despues; sin control, nunca se va a poder separar persuadibles de sure things.
- Heuristica previa al modelo: el cliente que ya visito el comercio esta semana es probablemente "sure thing" para ese comercio.

### Gaps
- No se encontraron cifras publicas del tamano tipico de cada segmento ni de la ganancia de uplift vs churn en campanas de comercio minorista local.
