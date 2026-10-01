# Ciclo de vida del cliente — Salón de uñas (`gcid:nail_salon`)

Investigado: 2026-09-29. Presupuesto: ~18 búsquedas/fetches. Todas las citas vienen de páginas abiertas
con WebFetch, salvo donde se marca **[snippet]** (texto que devolvió el buscador, página no abierta).

Tipos de fuente:
- **[PRIMARIO]** encuesta o dato de proveedor con muestra declarada.
- **[PROVEEDOR]** software del rubro (Zenoti, Fresha) que publica umbrales o casos, sin muestra completa.
- **[BLOG/OPINIÓN]** blog de salón, marketing o nota sin metodología.

---

## 1) Intervalo de visita

El rubro tiene un **reloj técnico**: el esmaltado semipermanente, el gel y el acrílico crecen o se
levantan, así que hay que volver cada **2–3 semanas**. Es un ciclo mucho más corto que el de una peluquería
y más largo que el de un café.

| Dato | Valor | Tipo | Fuente |
|---|---|---|---|
| Salon-goers que se hacen la manicura en el salón entre dos veces por mes y una vez por mes | 43% (pedicura: 36%) | **PRIMARIO**: The Benchmarking Company, 4.000+ mujeres de EE.UU., mayo 2025 | [F1] |
| Mujeres de 44–55 con servicio de uñas mensual / quincenal | 25,8% / 18,3% | **PRIMARIO débil**: encuesta NewBeauty a más de 500 lectoras, 2024 (autoselección) | [F2] |
| Clienta de relleno: 17 visitas por año, turno cada 3 semanas (quería cada 2) | aprox. 21 días | **Anécdota** en NAILS Magazine, 2002 | [F3] |
| Intervalo típico de un turno de uñas en la configuración de recordatorios de Zenoti | 2–4 semanas; recordatorio en el día 18 | **PROVEEDOR** | [F4] |
| Gel: «2 to 3 weeks», acrílico: «2 to 3 weeks between fills», esmalte común: «1 to 2 weeks», pedicura: «3 to 5 weeks, depending on season» | 7–35 días según servicio | **BLOG** (Zoca, marketing) | [F5] |
| Argentina, semipermanente: «cada 15 a 21 días» | 15–21 días | **[snippet]** de fichas de AgendaPro Argentina. La página abierta NO tenía la frase | [F6] |

**Lectura:**
- **Clienta habitual** (semipermanente, gel o acrílico): de **14 a 21 días**, con la moda cerca de los 21.
  Hay 4 fuentes independientes que coinciden en ese rango: F3, F4, F5 y F6.
- **Clienta promedio**, contando manicura simple, pedicura y ocasionales: el único dato con muestra (F1)
  pone al 43% entre 15 y 30 días. El 57% restante va con menos frecuencia (la fuente no da el desglose).
  Por eso la distribución tiene **cola larga**: una mediana general razonable estaría entre 21 y 35 días.
  Esto es una inferencia, no un dato.
- **No se encontró** una mediana de días entre visitas medida sobre transacciones reales (POS) del rubro.

## 2) Definiciones de la industria (en riesgo / inactivo / perdido)

| Fuente | En riesgo | Inactivo (lapsed) | Perdido | Tipo |
|---|---|---|---|---|
| Zenoti (salón en general) | «Clients who have not visited in 60 days»: aviso suave sin oferta | 61–90 días: oferta suave | >90 días: «meaningful offer»; último contacto en «180+ days» | **PROVEEDOR** [F4] |
| Fresha (salón en general) | disparador automático de recuperación «at eight weeks» (56 días) | «three months or more» | — | **PROVEEDOR** [F7] |
| Zoca (específico de uñas) | «3 weeks: Initial check-in», «5 weeks: Loyalty nudge» | «8 weeks: Win-back offer window» | — | **BLOG** [F5] |

**Lectura:** los umbrales genéricos de salón (60 días / 90 días / 180 días) están pensados para
peluquería, donde el ciclo es de 6 semanas. En uñas el ciclo es de unas 3 semanas, y la única fuente
específica del rubro (Zoca) adelanta todo: aviso a las 3 semanas, recuperación a las 8. Nadie publica un
umbral de «perdido» específico de uñas.

## 3) Retención

| Dato | Valor | Tipo | Fuente |
|---|---|---|---|
| Retención de clientas nuevas, promedio de la industria | «30%, 35% new client retention rate» (es decir, «alienate almost seven out of every 10 people»). Meta: 50% para técnicas nuevas y 60% para las que llevan 1–2 años | Opinión de consultores citada en NAILS, **2002** (vieja) | [F3] |
| Retención a 12 meses de un salón bien llevado | «most well-run salons aim for a 12-month retention rate of 60-75%» | **PROVEEDOR** (Fresha, es una meta, no una medición) | [F7] |
| Pre-reserva | «most salons should be able to pre-book 75% of their regular clientele» | Opinión (NAILS, 2002) | [F3] |
| Recuperación de inactivas en un salón de uñas | QQ Nails and Spa: 1.139 clientas recuperadas en 3 meses, «18% of their inactive list returning», y «31% of those recovered clients came back for a second visit» | **PROVEEDOR**, caso único | [F4] |
| Clientas con turno fijo | «About 40% of those clients will make regular appointments, while another 25% create standing appointments» | Atribuido a NAILS Magazine por un agregador, sin año | [F8] |

**Lectura:** la clienta nueva se pierde mucho (solo vuelve un 30–35% según una cifra vieja). La que ya es
habitual es muy estable, porque casi dos tercios tienen turno regular o fijo. Una recuperación del 18% de
la lista de inactivas sugiere que vale la pena seguir escribiéndoles hasta los 90 días y un poco más.

## 4) Particularidades del rubro

- **El reloj lo pone el producto:** el semipermanente o el acrílico que pasa las ~3 semanas se levanta o
  crece. La clienta que no vuelve a las 4–5 semanas probablemente **se lo sacó en casa o fue a otro lugar**.
  Una sola visita perdida ya es una señal fuerte, más fuerte que en un café.
- **Turno fijo:** entre el 25 y el 40% reserva de forma regular o fija [F8]. Si el comercio usa agenda,
  hay que tener en cuenta que una clienta con el próximo turno ya reservado no está «ausente». Es una
  limitación del modelo, que solo mira la última visita.
- **Estacionalidad:** la pedicura cae en los meses fríos. Booksy: «people are far less likely to be
  thinking about pedicures and foot treatments during the cooler months. But once Spring rolls around…»
  [F9]. En Argentina eso sería mayo–agosto bajo y octubre–enero alto. Hay picos antes de las fiestas
  (diciembre). Las cifras de +30–40% en verano y −15–25% en enero–febrero salieron de un **[snippet]** sin
  fuente verificable y **no se usan**.
- **Mezcla de servicios:** la clienta que solo se hace pedicura vuelve cada 3–5 semanas [F5]. Con una
  escalera única, se la va a marcar como «te extrañamos» un poco antes de tiempo.

## 5) Escalera propuesta

| Etapa | Valor | Mensajes (días desde la última visita) | Confianza |
|---|---|---|---|
| Te extrañamos, opción A | **21** | 21, 42 → pasa a En riesgo | **media-alta** |
| Te extrañamos, opción B | **28** | 28 → pasa a En riesgo | **media** |
| En riesgo | **R = 45**, cada **X = 14** | 45, 59, 73, 87 | **media** |
| Perdido | **P = 90** | 91, 105, 135, 180 (P+1, +14, +44, +89 desde el primero) | **media** |
| Irrecuperable | **~181** | no se le escribe más | **baja-media** |

Nota: con la opción A, el segundo «te extrañamos» (día 42) cae a 3 días de R. Si el motor no permite ese
solapamiento, alcanza con el mensaje del día 21.

**Justificación:**
- **21 / 28 (Te extrañamos):** el ciclo de la clienta habitual es de 14–21 días (F3, F4, F5, F6), y Zenoti
  recuerda en el día 18 (F4). A los 21 días, la clienta quincenal o de 3 semanas ya se pasó de su fecha.
  La opción A es para salones de semipermanente, gel o acrílico. La opción B, 28 días, es para salones con
  más manicura simple o pedicura (3–5 semanas, F5). **No conviene 7 ni 14**: cae dentro del ciclo normal y
  molesta.
- **R = 45, cada 14:** 45 días son unos dos ciclos de 3 semanas perdidos. Queda entre el «loyalty nudge»
  de Zoca a las 5 semanas y el disparador de Fresha y Zoca a las 8 semanas (56 días), y antes del «at-risk»
  genérico de Zenoti (60 días), que es de salón con ciclo más largo. Cada 14 días en lugar de 21 porque el
  ciclo del rubro es corto: son 4 mensajes entre el día 45 y el 90.
- **P = 90:** coincide con dos fuentes de proveedor: Fresha lo llama lapsed a los «three months or more»
  (F7) y Zenoti considera que pasados los 90 días hace falta una oferta fuerte (F4). A los 90 días son
  unos 4 ciclos perdidos.
- **91 / 105 / 135 / 180:** el primer mensaje al entrar en la etapa. El de 105 es un refuerzo corto,
  porque el caso QQ Nails muestra que se recupera el 18% de las inactivas (F4). Después se espacia, y el
  último cae en el «180+ days» que Zenoti usa como contacto final (F4).
- **Irrecuperable ~181:** es un umbral de proveedor genérico de salón. No hay un dato específico de uñas,
  por eso la confianza es baja-media.

## 6) Lo que no se encontró (declarado)

- **La mediana o el promedio de días entre visitas medido sobre transacciones reales** (POS/CRM) de salones
  de uñas. Ni Vagaro, ni Fresha, ni Boulevard, ni Zenoti lo publican separado para uñas.
- **La cifra «average client visits about 8 times per year» (Big Book de NAILS Magazine)** aparece en un
  resumen del buscador, pero **no se pudo encontrar en ninguna página abierta**. No se usa.
- **El Big Book de NAILS Magazine** (estadísticas completas): no está accesible sin suscripción. La nota
  «10 Industry Statistics» (2017–18) no trae frecuencia de visita.
- **Datos de LatAm o Argentina con muestra:** no hay. Solo recomendaciones de los salones («cada 15 a 21
  días», [snippet] de AgendaPro).
- **Un porcentaje de clientas que vuelven por segunda vez, medido recientemente:** solo está el 30–35% de
  2002 (F3).
- **Una retención a 90 días específica de uñas:** no hay.
- **Cifras de estacionalidad con fuente verificable:** no hay.

## 7) Fuentes

- **[F1]** The Benchmarking Company (vía GCI Magazine), jun. 2025, **PRIMARIO** (n = 4.000+). https://benchmarkingcompany.com/news/gci-obsessed-with-nail-care-a-timeless-consumer-beauty-favorite/
  — «Forty-three percent (43%) get a salon manicure twice-a-month to monthly» … «36% getting pedicures at
  the same rate».
- **[F2]** NewBeauty, 2024, encuesta a lectoras (n > 500). https://www.newbeauty.com/age-group-most-invested-in-nail-care/
  — «25.8 percent of respondents in this age group get nail services monthly» … «another 18.3 percent opt
  for bi-weekly appointments».
- **[F3]** NAILS Magazine, «Vital Signs: Essential Salon Statistics», 01/06/2002. https://www.nailsmag.com/390998/vital-signs-essential-salon-statistics?page=2
  — «My nail tech books me every three weeks, but I really want to come every two weeks»; «an average of 17
  times per year»; «30%, 35% new client retention rate»; «most salons should be able to pre-book 75% of
  their regular clientele».
- **[F4]** Zenoti, «How to win back salon clients», **PROVEEDOR** (cita su «2026 Beauty and Wellness
  Benchmark Report»). https://www.zenoti.com/thecheckin/how-to-win-back-salon-clients
  — «Clients who have not visited in 60 days»; uñas: «2–4 weeks», recordatorio «Day 18»; «18% of their
  inactive list returning»; «31% of those recovered clients came back for a second visit»; «180+ days».
- **[F5]** Zoca, «Nail Salon Loyalty Program», **BLOG**. https://zoca.com/post/post-nail-salon-loyalty-program
  — «2 to 3 weeks between fills»; «Pedicures: 3 to 5 weeks, depending on season»; «3 weeks: Initial
  check-in / 5 weeks: Loyalty nudge / 8 weeks: Win-back offer window».
- **[F6]** AgendaPro Argentina, **[snippet]**, página no confirmada. https://agendapro.com/mp/ar/semipermanente-manos-buenos-aires
  — «cada 15 a 21 días».
- **[F7]** Fresha, «Salon client retention strategies», **PROVEEDOR**. https://www.fresha.com/blog/4-simple-salon-client-retention-strategies
  — «most well-run salons aim for a 12-month retention rate of 60-75%»; lapsed: «three months or more»;
  disparador «at eight weeks».
- **[F8]** BrandonGaille (agregador que cita a NAILS Magazine, sin año). https://brandongaille.com/22-nail-salon-industry-statistics-trends-analysis/
  — «About 40% of those clients will make regular appointments, while another 25% create standing
  appointments for services.»
- **[F9]** Booksy, **BLOG**. https://biz.booksy.com/en-us/blog/dry-spells-business-seasonality-spa-salons
  — «people are far less likely to be thinking about pedicures and foot treatments during the cooler
  months».
