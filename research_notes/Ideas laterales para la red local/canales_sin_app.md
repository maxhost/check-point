# Canales sin app nativa — cómo llegar al consumidor orquestando muchos canales (2026)

> Nota de investigación, 2026-09-29. Formato del `_encargo.md`. **Límite declarado:** el presupuesto de
> búsquedas web de la sesión se agotó a mitad de la investigación; lo que sigue se apoya en las búsquedas y
> lecturas que sí se hicieron (URLs abajo) y en conocimiento general marcado **«sin fuente»**. Nada de esto
> fue probado en un teléfono. WhatsApp está **descartado por el owner** (`docs/red-y-atencion.md` §5), así
> que no se desarrolla.

## 0. El mapa de canales (estado real, Ecuador, sept. 2026)

| Canal | ¿Sirve en Cuenca hoy? | Costo | Quién inicia | Lo que se verificó |
|---|---|---|---|---|
| **Pase Wallet — actualización de campo SIN aviso** | Sí | $0 | Nosotros | Google distingue `TEXT` de `TEXT_AND_NOTIFY` (el repo ya usa el segundo, `wallet/google-object.ts:147-164`); el tope de 3/24 h es de los avisos con notificación. Apple solo notifica si el campo trae `changeMessage`; los push que no cambian datos se estrangulan en silencio ([Loyably](https://loyably.com/apple-wallet-passes), M). |
| **Pase — proximidad (pantalla bloqueada)** | Sí (Apple; Google a re-verificar) | $0 | El sistema | Hasta **10 ubicaciones por pase**, ~100 m, requiere ubicación activada ([Loyably](https://loyably.com/apple-wallet-passes), [Pushwoosh](https://www.pushwoosh.com/blog/apple-google-wallet-passes-use-cases/), M). |
| **Pase — «Featured actions» / pases genéricos ricos (Apple 2026)** | Probable (depende de iOS del cliente) | $0 | El cliente | Hasta **dos bloques de acción** bajo el pase con título, ícono y destino propios ([The Wallet Crew](https://www.thewalletcrew.io/en/blog/apple-wallet-2026-new-features-that-could-change-the-game-for-retailers), M: blog de un proveedor, no la doc de Apple). |
| **Google Wallet — pase de oferta** | Sí | $0 | Nosotros | Google avisa **2 días antes de que venza** una oferta guardada ([Google Wallet Offers](https://developers.google.com/wallet/retail/offers), A). Si ese aviso consume el cupo del pase de fidelidad no está verificado: es otro objeto, **probablemente otro cupo** (a medir). |
| **Google Business Profile — posts (Update/Offer/Event)** | Sí | $0 | Nosotros (vía el comercio o API) | 3 tipos; «Update» vence a los 7 días; «Offer» lleva etiqueta visual distinta en el panel local; se pueden programar y publicar multi-ubicación; suben el click-through pero **no el ranking** del pack ([Digital Applied](https://www.digitalapplied.com/blog/google-business-profile-guide-every-feature-2026), [Wiremo](https://wiremo.co/blog/google-business-profile-posts-best-practices/), M). |
| **Apple Maps — Showcases (ficha del lugar)** | Probable: Apple Business salió en **200+ países**, gratis, el 14-abr-2026 | $0 | Nosotros (vía el comercio) | Título 38 caracteres, cuerpo 58, foto, 1 CTA de 9 posibles (incl. «Get Directions», «Add to Guide»), dura hasta 30 días, revisión de Apple ≤ 3 días ([Local Falcon](https://www.localfalcon.com/blog/how-to-create-showcases-in-apple-business-connect), M; [Apple Newsroom](https://www.apple.com/newsroom/2026/03/introducing-apple-business-a-new-all-in-one-platform-for-businesses-of-all-sizes/), A). **Los anuncios en Maps son solo EE. UU./Canadá** (A). Showcases en Ecuador: sin confirmar. |
| **RCS for Business** | **No** | «precio a pedido» | Nosotros | En iPhone desde iOS 18.1, pero depende del operador ([Apple](https://support.apple.com/en-us/122195), A). BulkGate lista Ecuador como **«operator currently unavailable»** ([BulkGate](https://www.bulkgate.com/en/pricing/rcs/ec/ecuador/), M); Sinch no menciona LatAm; Messente solo nombra Telcel (México) ([Messente](https://messente.com/blog/state-of-rcs-business-messaging), M). |
| **Apple Messages for Business** | Poco probable para un comercio de US$10 | Requiere un MSP aprobado | **El cliente** (QR, web, Maps) | Entradas: QR, enlace, «Message Us», Maps ([Apple Register](https://register.apple.com/resources/messages/messaging-documentation/), A). No hay un canal saliente que sirva de campaña. |
| **SMS** | Sí | ~US$0,049 + imp. por SMS, mínimo 5.000 (un proveedor) | Nosotros | Snippet de búsqueda sobre proveedores ecuatorianos (B: no se leyó la tabla). A 1.000 clientes × 4 SMS/mes ≈ US$200/mes: **más que lo que paga toda la red chica**. |
| **App Clips** | No sin app nativa | — | El cliente (NFC/QR/Maps) | **Exigen una app completa** para publicarse; 10 MB; notifican hasta 8 h ([Apple Developer](https://developer.apple.com/app-clips/), A). Descartado. |
| **NFC que abre una URL** | Sí | ~US$0,30–1 por etiqueta (sin fuente) | El cliente | iPhone lee etiquetas NFC con URL sin app desde hace años; Android también (sin fuente, A por conocimiento general). |
| **Email** | Sí | casi $0 | Nosotros | Sin fuente. Tasa de apertura baja pero sin tope y sin cupo. |
| **Instagram/TikTok** | Sí | tiempo | Nosotros/comercio | Sin fuente específica. |

**Lectura del mapa:** en Ecuador, en 2026, **los canales «ricos» del mundo desarrollado (RCS, anuncios en
Maps, Messages for Business) no llegan o no pagan**. Los que sí llegan y son gratis son tres: **el pase
(sobre todo en silencio), las fichas de Maps y lo que está físicamente en el mostrador**. La estrategia no es
«encontrar el canal», es **orquestar esos tres + email, y reservar el aviso y el SMS para lo que vale**.

---

## 1. Aerolíneas → el pase de embarque que cambia solo → el pase que «cambia» según tu etapa

1. **Industria A → mecanismo → resultado B.** Las aerolíneas actualizan puerta, asiento y hora en el pase
   sin que el pasajero haga nada; el pase es la fuente de verdad que el pasajero mira sin abrir ninguna app.
   Resultado: el pase se consulta muchas veces por viaje y la aerolínea «habla» sin gastar notificaciones
   en cada cambio ([Pushwoosh](https://www.pushwoosh.com/blog/apple-google-wallet-passes-use-cases/), M;
   mecánica de campos y `changeMessage` en la [doc de Apple](https://developer.apple.com/documentation/walletpasses/pass), A).
2. **De B a C.** El pase de CheckPass tiene un campo visible (frente) y el dorso. Hoy el campo «Última
   novedad» se pisa entre comercios y cada escritura gasta un aviso. Propuesta: **separar «escribir» de
   «avisar»**. El frente muestra un **titular que depende de la etapa del cliente**, actualizado en
   silencio (sin `changeMessage` / con `TEXT`, no `TEXT_AND_NOTIFY`):
   - *nuevo* (1–2 visitas): «Te falta 1 visita para tu primer premio en Café A»;
   - *frecuente*: «3 comercios de la red a 300 m te dan algo hoy»;
   - *en riesgo*: «Café A te guarda un 2x1 hasta el viernes»;
   - *perdido*: nada de culpa, una novedad («Nuevo en la red: Panadería Z»).
   El cliente lo ve **cada vez que abre el pase para escanear** (el momento de mayor atención del día) y
   cuando la proximidad lo sube a la pantalla bloqueada. El comercio no hace nada: la red elige el titular.
   Con las «Featured actions» de Apple (si se confirman en la doc oficial), los dos botones del pase serían
   «Mis beneficios» y «Qué hay cerca».
3. **Por qué es innovador.** Convierte el tope de 3 avisos en irrelevante para el 80 % de la comunicación: el
   aviso se reserva para lo urgente; el resto es **vidriera silenciosa**. Difícil de copiar porque requiere
   la etapa de ciclo de vida por comercio (ya existe) y el pase único de red (una tarjeta por comercio no
   puede elegir entre comercios).
4. **Viabilidad:** alta. **Riesgo:** que nadie mire el frente del pase fuera del mostrador; y en Apple, que
   un update silencioso frecuente igual se estrangule (no documentado).
5. **Experimento (1 semana, 3 comercios):** a la mitad de los clientes (grupo de control ya existe) se les
   cambia el titular por etapa en silencio; se mide visitas y aperturas del enlace a `/c/[webViewToken]`
   desde el pase contra la otra mitad.

## 2. Supermercados (cupón en la caja, estilo Catalina) → el escaneo como «recibo» con la próxima acción

1. **A → B.** Catalina Marketing imprime en la caja un cupón elegido según lo que compraste; el momento del
   pago es el de mayor atención y mayor intención (sin fuente — conocimiento general, confianza M).
   Square y otros POS mandan recibos digitales con un enlace de «volvé» (sin fuente, M).
2. **De B a C.** CheckPass no tiene POS, pero **tiene el escaneo**, que es su recibo. Tras cada escaneo, la
   pantalla que ve el cliente (y la actualización del pase) es un **recibo digital de la red**: «+1 sello
   en Café A (4/8). Por estar acá: Gimnasio B, a 2 cuadras, te regala la primera clase». Es el «cupón
   cruzado en el escaneo» del owner, pero pensado como **el canal principal de captación**, no un extra:
   - el comercio que escanea no hace nada distinto;
   - el comercio beneficiado (B) solo paga con su oferta;
   - la red elige qué cupón mostrar con el perfil (rubro no competidor, ≤ 2 km, lo que no se le mostró
     todavía, lo que la gente de su perfil canjeó).
   Si hay email, el mismo recibo llega por email con el resumen «este mes ahorraste US$X en la red».
3. **Innovador.** Un recibo de red cruza comercios que no se conocen; ningún POS individual lo puede hacer.
   El momento no consume cupo de avisos.
4. **Viabilidad:** alta. **Riesgo:** que el cliente no mire el teléfono tras el escaneo (el escaneo lo hace
   el comercio sobre el pase): la pantalla debe llegar como actualización del pase + la vista web.
5. **Experimento:** 2 cafés + 2 comercios de otro rubro cercanos; cupón cruzado en el recibo durante una
   semana; contar canjes de clientes nuevos en B con origen «recibo de A».

## 3. Restaurantes con QR en la mesa → el QR/NFC del mostrador como puerta de la red (y check-in sin GPS)

1. **A → B.** Menú y pago por QR en mesa se volvieron costumbre; Apple Messages for Business y App Clips
   usan justamente QR/NFC físicos como puerta de entrada «sin instalar nada» ([Apple Register](https://register.apple.com/resources/messages/messaging-documentation/), A; [App Clips](https://developer.apple.com/app-clips/), A).
2. **De B a C.** Hoy el QR que importa es el del pase (lo escanea el comercio). Agregar el **inverso**: un
   display o sticker NFC+QR del comercio en el mostrador y las mesas, que abre la PWA **en el contexto del
   local** (`/l/cafe-a`):
   - quien no tiene cuenta: «Sumate y llevate tu primer sello» → alta + botón «Agregar a Wallet»;
   - quien ya tiene: «Estás en Café A» → sus beneficios de acá y de 2 cuadras a la redonda.
   Efecto lateral valioso: **es un check-in**. Sabemos dónde está el cliente sin pedir GPS (resuelve el
   «si niega el permiso» del filtro de 2 km), y sirve de disparador del aviso dirigido.
   Variante de mesa: «¿Esperando? Mirá qué hay a la vuelta» — atención cautiva mientras espera el pedido.
3. **Innovador.** El soporte físico del comercio deja de ser «publicidad de CheckPass» y pasa a ser una
   terminal de la red que el comercio no tiene que operar. Difícil de copiar: el valor está en lo que hay
   detrás del QR (la red), no en el QR.
4. **Viabilidad:** alta; costo del material ~US$1–3 por local (sin fuente). **Riesgo:** fatiga de QR y que
   el comercio no lo ponga visible; fraude (sumarse sello escaneando el QR del local desde casa) → el QR del
   local **nunca suma sellos**, solo abre contexto.
5. **Experimento:** 3 locales con display QR+NFC en el mostrador; medir altas nuevas por local y por hora
   frente a la semana anterior.

## 4. Local SEO → ofertas sindicadas a Google Maps y Apple Maps («café cerca»)

1. **A → B.** Las cadenas publican ofertas en Google Business Profile y Showcases en Apple Maps desde un
   panel multi-ubicación; la oferta aparece en el panel local justo cuando alguien busca «café cerca».
   Resultado medido por la industria: más click-through en la ficha, no más ranking ([Digital Applied](https://www.digitalapplied.com/blog/google-business-profile-guide-every-feature-2026), M;
   [Local Falcon](https://www.localfalcon.com/blog/how-to-create-showcases-in-apple-business-connect), M).
   Google además resume lugares con IA a partir de reviews y **posts** (misma fuente, M).
2. **De B a C.** El comercio ya carga campañas en CheckPass. **La red las republica** en su ficha de Google
   (post «Offer» con código o enlace) y como Showcase de Apple Maps (38+58 caracteres, CTA «Get
   Directions»). Oferta tipo: «Primera visita con CheckPass: café gratis con tu pase». El clic lleva a la
   PWA en contexto del local → alta → pase. **Es el único canal de esta lista que llega a quien todavía no
   es cliente de nadie** en el momento de intención («café cerca»).
   Qué hace el comercio: autoriza una vez a CheckPass como administrador de su ficha. Qué hace la red:
   redacta, programa, renueva cada 7/30 días y mide cuántas altas vinieron de Maps.
3. **Innovador.** Para un comercio chico, mantener sus posts vivos es tarea que nunca hace; que se haga solo
   como subproducto de sus campañas es un beneficio **percibido** (su ficha se ve «activa»; los blogs
   reportan caídas de ficha tras 30 días sin actividad — Digital Applied, B). Difícil de copiar: la
   atribución «vino de Maps → canjeó» solo la tiene quien controla el alta y el escaneo.
4. **Viabilidad:** media. **Riesgos:** acceso a la API de Business Profile (pide aprobación de Google;
   sin verificar para este caso), políticas de contenido de posts, Showcases no confirmados en Ecuador, y
   que muchos comercios de Cuenca ni hayan reclamado su ficha (lo cual es, a la vez, un servicio que
   CheckPass puede hacer en el onboarding).
5. **Experimento:** 5 comercios; a mano (sin API) publicar un post «Offer» semanal en Google y un Showcase
   en Apple; enlace con `?src=maps`; contar altas atribuidas en 2 semanas.

## 5. Orquestación de canales (Braze/Iterable) → la escalera de costo por cliente

1. **A → B.** Las plataformas de engagement eligen el canal por cliente: el más barato que funciona para
   esa persona, y escalan a uno más caro solo si no respondió (sin fuente — conocimiento general de
   «Canvas»/«journeys», confianza M).
2. **De B a C.** Es la versión «canales» del **perfil enriquecido** que pide el owner. Cada mensaje de
   cualquier comercio baja por una escalera, y el perfil aprende en qué peldaño responde cada cliente:
   1) «Mis beneficios» (entregar, sin tope) → 2) titular silencioso del pase (§1) → 3) proximidad →
   4) recibo del escaneo (§2) → 5) email → 6) aviso de Wallet (escaso, 3/día de toda la red) →
   7) SMS (pagado, solo para lo de alto valor y quien nunca abre nada).
   Regla: **un cliente que en N comercios canjeó desde el pase silencioso nunca recibe aviso**; el aviso se
   gasta en quien solo responde a aviso. Eso multiplica el rendimiento del cupo de 3.
3. **Innovador.** Nadie en el segmento US$10 orquesta; y el aprendizaje es **de red** (se aprende del
   cliente en 20 comercios, no en uno).
4. **Viabilidad:** alta en lógica, media en medición (atribuir un canje a un canal requiere enlaces/códigos
   por canal). **Riesgo:** sobre-ingeniería antes de tener volumen.
5. **Experimento:** etiquetar cada entrega con su canal durante una semana (sin cambiar nada) y ver, por
   cliente, desde qué canal vino cada canje. Si los canales difieren por persona, la escalera se justifica.

## 6. Resúmenes anuales (Spotify Wrapped, extractos bancarios) → el «extracto de la red» por email

1. **A → B.** Wrapped y los extractos «ahorraste X» generan apertura y se comparten porque hablan de
   **uno mismo** (sin fuente, M).
2. **De B a C.** Email mensual automático: «Este mes: 7 visitas en 4 comercios, US$11 ahorrados, te faltan
   2 sellos en Panadería Z. Nuevos en tu barrio: …». El email no tiene tope ni cupo; el pase lleva el
   enlace. Para el comercio: el «informe en plata» ya previsto, espejado del lado del cliente.
3. **Innovador.** Solo la red puede sumar el ahorro entre comercios; un programa individual muestra poco.
4. **Viabilidad:** alta (requiere tener email, que hoy puede no pedirse). **Riesgo:** baja tasa de email
   capturado en el alta.
5. **Experimento:** mandar el primer extracto a los clientes con email; medir clics y visitas en 7 días
   contra el grupo de control.

## 7. RCS / Apple Messages / App Clips — lo que NO conviene hoy (y cuándo volver a mirar)

- **RCS:** técnicamente ideal (logo verificado, carruseles, botones, en iPhone y Android), pero **en
  Ecuador los proveedores lo listan como no disponible** (BulkGate, M) y el precio es «a pedido».
  Disparador para re-mirar: que Claro o Movistar Ecuador aparezcan en el listado de operadores con RCS for
  Business. Si pasa, entra en el peldaño 6–7 de la escalera como reemplazo del SMS.
- **Apple Messages for Business:** lo inicia el cliente y exige un MSP; sirve para atención, no campañas.
- **App Clips:** exigen app nativa. El equivalente sin app es **NFC/QR → PWA** (§3).
- **SMS:** a ~US$0,05, 1 SMS por cliente por mes ya se come buena parte de los US$10 del comercio. Solo
  como último peldaño o pagado por resultado.

## 8. Instagram/TikTok local → «la ruta de la semana» como contenido de la red

1. **A → B.** Cuentas de «dónde comer en [ciudad]» concentran audiencia local y mueven gente a locales
   (sin fuente, B).
2. **De B a C.** La red (no cada comercio) publica una ruta semanal («3 cafés + 1 panadería del Centro
   Histórico, beneficios con tu pase»), enlazando a la ruta en la web pública (idea del owner). El comercio
   aporta una foto por semana; la red edita.
3. **Innovador:** poco — es marketing de contenidos. Su valor es que termina en un alta con atribución.
4. **Viabilidad:** media (requiere tiempo humano). **Riesgo:** depende de alguien que produzca.
5. **Experimento:** 1 reel + 1 historia con enlace `?src=ig`; contar altas.

---

## Ranking

1. **El pase que cambia según la etapa, en silencio (§1) + la escalera de canales (§5).** Ataca de frente
   el tope de 3 avisos: la mayor parte de la comunicación deja de ser aviso. Barato, ya casi todo está
   construido; la pieza nueva es separar «escribir el campo» de «notificar».
2. **El escaneo como recibo de red con cupón cruzado (§2) + QR/NFC del mostrador como puerta y check-in
   (§3).** Los dos momentos físicos donde la atención es máxima y el costo es cero; captan clientes nuevos
   (resultado 2 de la misión) y dan ubicación sin GPS.
3. **Ofertas de la red sindicadas a Google Maps y Apple Maps (§4).** El único canal que llega a quien aún no
   conoce la red, en el momento de «café cerca», y le da al comercio una ficha activa que percibe.

## Idea «loca»: las 10 ubicaciones del pase como mapa personal de la red

Un pase de Apple admite **hasta 10 ubicaciones** para la proximidad (Loyably/Pushwoosh, M). Hoy serían los
comercios donde el cliente es miembro. La idea: **elegirlas dinámicamente por cliente con el perfil** y
reescribirlas en silencio cada día — p. ej. 5 de «tus» comercios en riesgo + 5 comercios de la red **que
todavía no conocés**, a su paso habitual (inferido de dónde escanea), de rubros no competidores. Resultado:
la pantalla bloqueada se vuelve un **radar de descubrimiento** sin gastar un solo aviso, y el texto de
relevancia de cada ubicación puede ser la oferta de bienvenida de ese comercio («Gimnasio B: primera clase
gratis con tu pase»). Es captación de clientes nuevos por proximidad, sin app y sin cupo.
**A verificar antes de discutirla:** si Apple penaliza reescribir ubicaciones seguido, si iOS 17+ sigue
mostrando la sugerencia de pantalla bloqueada igual que antes (Apple la volvió más pasiva), y el
equivalente en Google Wallet (su notificación por geovalla no fue verificada en esta sesión).

## Fuentes leídas
- Apple, RCS en iPhone: https://support.apple.com/en-us/122195
- Sinch, Apple RCS 2026: https://sinch.com/blog/apple-support-rcs/
- Messente, estado de RCS 2026: https://messente.com/blog/state-of-rcs-business-messaging
- BulkGate, RCS Ecuador: https://www.bulkgate.com/en/pricing/rcs/ec/ecuador/
- Apple Newsroom, Apple Business (mar. 2026): https://www.apple.com/newsroom/2026/03/introducing-apple-business-a-new-all-in-one-platform-for-businesses-of-all-sizes/
- Local Falcon, Showcases: https://www.localfalcon.com/blog/how-to-create-showcases-in-apple-business-connect
- Digital Applied, GBP 2026: https://www.digitalapplied.com/blog/google-business-profile-guide-every-feature-2026
- Wiremo, GBP posts 2026: https://wiremo.co/blog/google-business-profile-posts-best-practices/
- Google Wallet Offers: https://developers.google.com/wallet/retail/offers
- Apple, campos del pase: https://developer.apple.com/documentation/walletpasses/pass
- The Wallet Crew, Apple Wallet 2026: https://www.thewalletcrew.io/en/blog/apple-wallet-2026-new-features-that-could-change-the-game-for-retailers
- Loyably, qué hacen y qué no los pases: https://loyably.com/apple-wallet-passes
- Pushwoosh, casos de uso de pases: https://www.pushwoosh.com/blog/apple-google-wallet-passes-use-cases/
- Apple Messages for Business: https://register.apple.com/resources/messages/messaging-documentation/
- Apple App Clips: https://developer.apple.com/app-clips/
- Meta, precios WhatsApp (solo contexto; canal descartado): https://developers.facebook.com/docs/whatsapp/pricing/
- SMS Ecuador (snippet, sin tabla leída): https://masiva.ec/sms-mensajes-de-texto-masivos/ y otros

**No verificado en esta sesión (búsquedas agotadas):** casos concretos de Starbucks/Sephora con el dorso del
pase; límites exactos de Google Wallet para mensajes sin notificación; geovallas de Google Wallet;
disponibilidad de Showcases en Ecuador; tarifas de RCS en LatAm fuera de México.
