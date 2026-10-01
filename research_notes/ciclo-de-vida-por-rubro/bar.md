# Ciclo de vida del cliente — Rubro: Bar (`gcid:bar`)

Investigacion: 2026-09-29. Presupuesto usado: ~21 busquedas/fetches (tope ~20). Condicion de corte:
presupuesto agotado; hay 3+ numeros independientes de **frecuencia** (distribucion por encuesta),
pero **ninguno** es un intervalo medido en dias por cliente sacado de datos transaccionales de bares.

Leyenda de calidad de fuente:
- **[PRIMARIO]** estudio con muestra declarada o datos de plataforma (POS/CRM) con universo declarado.
- **[PROVEEDOR-PRODUCTO]** configuracion por defecto que ofrece un proveedor (no es un dato medido, es practica de industria).
- **[BLOG/AGREGADOR]** opinion o compilado sin metodologia verificable.

Nota de verificacion: varias fuentes primarias (Toast `regulars-report`, NielsenIQ, cgastrategy.com,
barandrestaurant.com, craftbrewingbusiness.com) devolvieron 403/404/DNS al fetch. Donde la cita viene
de una republicacion o del snippet del buscador, se indica. Las citas marcadas «(snippet del buscador)»
**no fueron leidas en la pagina** y valen como puntero, no como verificacion.

---

## 1) Intervalo de visita

No se encontro un intervalo **en dias** (mediana/promedio entre visitas del mismo cliente) medido sobre
tickets de bares. Lo que hay son **distribuciones de frecuencia autodeclarada** por encuesta:

| Dato | Valor | Fuente | Calidad |
|---|---|---|---|
| Frecuencia de ir a un pub/bar a beber (UK, marzo 2026, n=500 representativa) | 1/dia: 1%; 2–3/semana: 8%; 1/semana: 20%; 1/mes: 23% (respuesta mas comun); nunca: 18% | Vypr Consumer Horizon | [PRIMARIO] |
| Derivado de lo anterior: entre quienes van alguna vez (82%), ~35% va semanal o mas (29/82) | ~35% | calculo propio sobre Vypr | derivado |
| Bares de barrio (EE.UU., CGA by NIQ 2025): 53% los visita; de ellos, 66% semanalmente | 66% semanal | CGA by NIQ via craftbrewingbusiness (snippet del buscador; pagina 403) | [PRIMARIO], no verificado en pagina |
| On-premise global (CGA REACH 2024, 30.000 consumidores): 83% al menos trimestral; 62% semanal (base: quienes visitan) | 62% semanal | Club Mirror (resumen de CGA) | [PRIMARIO] (resumen de tercero) |
| Consumidores de destilados en Irlanda: 86% visita bares/restaurantes al menos 1 vez al mes (abril 2024) | 86% mensual | Drinks Industry Ireland (CGA by NIQ) | [PRIMARIO] (resumen de tercero), sin n |
| Promedio EE.UU.: 2,5 visitas a bares por mes por adulto (≈12 dias) | ~12 dias | Gitnux (snippet del buscador) | [BLOG/AGREGADOR] — sin metodologia, **no usar como base** |
| Argentina (Kantar, marzo 2025): 76% redujo la frecuencia de salidas gastronomicas; ~42% mantiene salir «varias veces al mes o una vez por semana» | — | Ambito (Kantar Insights) | [PRIMARIO] (nota de prensa), no especifico de bares |
| Paytronix (gastronomia en general, no bares): las visitas se parecen mas a decisiones diarias independientes que a un ciclo fijo; pico relativo al dia 1 y al dia 7 | — | Paytronix | [PRIMARIO] (n=1000 cuentas por cliente) |

**Lectura:** el bar es bimodal. Hay un nucleo de **habituales semanales** (20–35% de quienes van a
bares; 62–66% en las muestras de «visitantes» de CGA, que ya filtran al publico que sale) y una masa
de **clientes mensuales u ocasionales** (23% «una vez por mes» es la respuesta modal en UK). Traducido
a dias, con la cautela de que es frecuencia de ir **a bares en general**, no **al mismo bar**:
- Habitual: ~7 dias.
- Promedio/modal: ~30 dias.
- La frecuencia a UN bar especifico es necesariamente menor o igual que a la categoria (el cliente
  reparte salidas entre varios bares). Esto empuja todos los umbrales hacia arriba.

## 2) Definiciones de la industria (en riesgo / lapsed / perdido)

- **SevenRooms** (CRM de hospitalidad, usado por bares y restaurantes) [PROVEEDOR-PRODUCTO]: ofrece
  segmentar lapsed con disparadores a **30, 60 o 90 dias**: «identify guests who haven't returned and
  trigger the right message at 30, 60 or 90 days». No es especifico de bares ni medido.
- **Toast** [PRIMARIO, plataforma]: mide retencion en ventana de **90 dias** (Q1 2026, 13-ene a 13-abr).
  No se encontro una definicion publicada de «lapsed» por Toast.
- **Resy** (citado en el informe de Toast): «Regular» = 3+ visitas al mismo local entre 2023 y 2025
  — ventana larguisima, no sirve para cadencia.
- Practica genérica de win-back (no gastronomica) [BLOG]: brackets 30–60 / 61–90 / 91–180 / 180+ dias.
- **No se encontro** ninguna definicion de «perdido» especifica de bares, ni de LatAm.

## 3) Retencion

- Toast Q1 2026 [PRIMARIO]: «moving a guest into a loyalty program shifts their return rate from a
  7% baseline to nearly 30%». Tambien: «just 7% of a business's guest base is multi-visit, yet this
  cohort could generate up to 50% of the total order volume». Restaurantes, no bares especificamente.
- Toast Q1 2026 [PRIMARIO]: retencion a 90 dias de 24–26% con cashback en restaurantes casuales
  (pizzerias/cafes); 20% (item) vs 13% (cashback) en fine dining.
- **Implicacion:** en gastronomia la tasa base de regreso es baja (~7%); el grueso de los clientes
  nuevos nunca vuelve. Mensajes a 90+ dias hablan con una base que mayormente ya se fue.
- **No se encontro** retencion especifica de bares (ni % de segunda visita, ni retencion a 90 dias).

## 4) Particularidades del rubro

- **Concentracion en fin de semana**: Gitnux cita «Weekend visits account for 75% of bar traffic»
  [BLOG/AGREGADOR, sin metodologia]. Consecuencia practica (no medida): la unidad natural del bar es la
  **semana**; los umbrales conviene que sean multiplos de 7 y que el push salga jueves/viernes.
- **Salida grupal y social**: en Argentina el motor #1 de salir es socializar (66%, Kantar 2025); las
  celebraciones 33%. El cliente puede «desaparecer» del registro porque pago otro del grupo — el pase
  subregistra visitas en bares mas que en un cafe. Empuja los umbrales hacia arriba.
- **Sensibilidad al precio en Argentina**: 76% redujo salidas (Kantar 2025); el sector habla de
  perdidas de hasta 40% de clientes en dos anos (Ambito, julio 2026, titular). Frecuencias de UK/EE.UU.
  probablemente **sobreestiman** la argentina actual.
- **Estacionalidad** (no cuantificada con fuente): verano en Buenos Aires con exodo de enero; skybars y
  terrazas en verano (Infobae ene-2026, cualitativo). Diciembre de fiestas. No se encontro un numero.
  Recomendacion: pausar o alargar «Te extrañamos» en enero para no quemar clientes que estan de vacaciones.

## 5) Escalera propuesta — Bar

| Etapa | Valor | Justificacion | Confianza |
|---|---|---|---|
| Te extrañamos — opcion A | **14 dias** | 2 fines de semana sin venir. El habitual semanal (20% de adultos UK; 62–66% de visitantes en CGA) salta 2 ciclos. Multiplo de 7 por la concentracion en fin de semana. | media |
| Te extrañamos — opcion B | **21 dias** | Para bares de publico mas mensual/ocasional (la respuesta modal UK es «1 vez por mes», 23%) y para compensar el subregistro por pago grupal. | media-baja |
| En riesgo — R | **45 dias** | Un cliente modal mensual que salta un ciclo y medio. Cae entre los disparadores 30/60 de SevenRooms. | baja-media |
| En riesgo — cadencia X | **cada 15 dias** (45, 60, 75) | Tres toques antes de Perdido; coincide con el hito de 60 dias de SevenRooms. Mas espaciado que un cafe no tiene sentido porque R→P es solo 45 dias. | baja |
| Perdido — P | **90 dias** | Techo de los disparadores de SevenRooms y ventana de retencion de Toast. Con retorno base ~7% (Toast), a 90 dias la mayoria ya no vuelve. | media |
| Perdido — 4 mensajes | **91, 105, 135, 165** (P+1, +14, +44, +74 desde el primero) | Mas compacto que el cafe (91/105/151/181): el bar depende de ocasiones sociales y la base de regreso es baja; conviene que el ultimo toque caiga antes de los 6 meses. Si el comercio lo prefiere, se puede alinear el tercero/cuarto con eventos (fin de ano, vuelta de vacaciones). | baja |
| Irrecuperable | **~180 dias** | Los brackets genericos de win-back ponen «180+» como el ultimo; ninguna fuente de gastronomia mide algo mas alla de 90 dias. | baja |

Comparado con la referencia de cafeteria (7/14; R=30 c/21; P=90; 91/105/151/181; ~181): el bar
**corre el arranque una semana** (14/21 en vez de 7/14) porque su unidad es el fin de semana y su
publico modal es mensual; **adelanta la cadencia de riesgo** y **comprime Perdido** para terminar en
~180 dias.

## 6) Lo que no se encontro (declarado)

- Intervalo mediano/promedio **en dias** entre visitas al **mismo** bar, medido sobre transacciones
  (Toast, SevenRooms, Square, Fudo, etc.). Nada publicado.
- % de clientes de un bar que vuelve por segunda vez, y retencion a 90 dias **especifica de bares**.
- Definicion de «perdido» o «inactivo» publicada por un proveedor LatAm (Fudo, Bistrosoft, Waiter, etc.).
- Datos de frecuencia de salida a bares **en Argentina** (Kantar mide «salidas gastronomicas» en general).
- Estacionalidad cuantificada (variacion mensual de trafico) de bares en Argentina.
- El informe «Regulars Report 2026» de Toast y las paginas de CGA/NielsenIQ no se pudieron leer
  directo (403/404/DNS); se usaron republicaciones.

## 7) Fuentes (URL + cita)

1. **Vypr, Consumer Horizon (UK, mar-2026, n=500)** [PRIMARIO] —
   https://vyprclients.com/blog/how-is-uk-drinking-culture-changing/ —
   «23% of consumers visit the pub at least once a month. This was the top answer»; desglose: 1/semana
   20%, 2–3/semana 8%, diario 1%, nunca 18%; «a nationally representative sample of 500 consumers».
2. **Toast, Regulars Report 2026 (republicado por Stacker/KRDO, sep-2026)** [PRIMARIO] —
   https://krdo.com/stacker-business-economy/2026/09/04/report-7-of-guests-can-drive-up-to-50-of-restaurant-order-volume/ —
   «According to Toast Loyalty data from Q1 2026, moving a guest into a loyalty program shifts their
   return rate from a 7% baseline to nearly 30%.» / «just 7% of a business's guest base is multi-visit,
   yet this cohort could generate up to 50% of the total order volume.»
   Misma nota (KVIA): https://kvia.com/stacker-business-economy/2026/09/04/report-7-of-guests-can-drive-up-to-50-of-restaurant-order-volume/ —
   retencion 90 dias «24% to 26%» (casual, cashback); «20% retention rate» vs «13%» (fine dining).
3. **SevenRooms, Marketing Automation** [PROVEEDOR-PRODUCTO] —
   https://sevenrooms.com/platform/marketing-automation/ —
   «Lapsed and first-timer targeting: identify guests who haven't returned and trigger the right
   message at 30, 60 or 90 days.»
4. **CGA REACH 2024 (resumen Club Mirror)** [PRIMARIO, resumen] —
   https://www.clubmirror.com/news/consumers-in-the-on-premise-takeaways-from-cga-reach —
   «More than four in five (83%) respondents say they visit restaurants, pubs, bars and similar venues
   at least quarterly»; «Nearly two thirds (62%) do so weekly».
5. **CGA by NIQ, Channel Strategy 2025 (craftbrewingbusiness)** [PRIMARIO, NO verificado: 403] —
   https://www.craftbrewingbusiness.com/business-marketing/cga-by-niqs-2025-channel-strategy-study-highlights-where-beer-wins-in-the-on-premise/ —
   (snippet del buscador) «More than half (53%) of consumers typically visit neighborhood bars, and 66%
   of this group do so weekly».
6. **CGA by NIQ, Irlanda (abr-2024)** [PRIMARIO, resumen] —
   https://www.drinksindustryireland.ie/cga-report-shows-86-of-spirits-consumers-visit-bars-and-restaurants-once-a-month/ —
   «86% of spirits consumers visit bars and restaurants at least once a month».
7. **Kantar Insights, Argentina (mar-2025), via Ambito** [PRIMARIO, prensa] —
   https://www.ambito.com/informacion-general/salir-comer-se-convirtio-un-lujo-el-76-los-argentinos-redujo-sus-visitas-bares-y-restaurantes-n6146139 —
   «el 76% de los argentinos disminuyó su frecuencia de salidas a comer en el último año»; ~42% mantiene
   salir varias veces al mes o una vez por semana; socializar 66%.
8. **Paytronix, Understanding Guest Frequency** [PRIMARIO, gastronomia general] —
   https://www.paytronix.com/blog/understanding-guest-frequency —
   «60% of guests have at least one pair of visits that are on consecutive days»; «Day seven is
   approximately 8% higher than it would be if this were a truly random process».
9. **Gitnux, Bar Industry Statistics** [BLOG/AGREGADOR — solo contexto] —
   https://gitnux.org/bar-industry-statistics/ — (snippet del buscador) «The average bar visit frequency
   is 2.5 times per month per U.S. adult»; «Weekend visits account for 75% of bar traffic». Sin
   metodologia; no se uso como base de ningun numero de la escalera.
10. **Ambito, julio 2026** [PRENSA, titular] —
    https://www.ambito.com/negocios/bares-y-restaurantes-pierden-40-clientes-dos-anos-no-vemos-una-luz-al-final-del-tunel-advierten-el-sector-n6300343 —
    titular: «Bares y restaurantes pierden hasta 40% de clientes en dos años». Cuerpo no leido.
