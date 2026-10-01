# Ciclo de vida del cliente — Barberia (`gcid:barber_shop`)

Investigacion: 2026-09-29. Presupuesto: ~21 busquedas/fetches (se paso levemente del objetivo de ~20).
Tipos de fuente: **[PRIMARIO]** = datos de plataforma con muestra declarada o encuesta;
**[PROVEEDOR]** = afirmacion de un proveedor de software sin muestra publicada;
**[BLOG]** = opinion o recomendacion de barberos, sin datos.

> Nota de acceso: las paginas de SQUIRE (getsquire.com) y de American Salon devuelven 403 /
> desafio de Cloudflare a fetch automatico. Los numeros de SQUIRE se citan a traves de
> waitq.app, que los reproduce con atribucion (verificado con `curl` sobre el HTML), y de los
> resumenes del buscador sobre American Salon. Es cita de segunda mano de un dato primario.

## 1) Intervalo de visita

| # | Dato | Tipo | Fuente |
|---|------|------|--------|
| A | **48,5 dias** promedio entre visitas (~7 semanas), clientes que vuelven | PRIMARIO (SQUIRE, 9,79 M turnos; reporte sobre 13,9 M turnos en 7.000 barberias de EE.UU.) | waitq.app |
| B | **~7 cortes por año** por cliente (≈ 52 dias) | PRIMARIO (SQUIRE) | waitq.app |
| C | Cadencia "natural" del cliente de barberia: **2–5 semanas** (14–35 dias) | PROVEEDOR (Zenoti, dice basarse en 30.000+ negocios, pero este numero no trae muestra propia) | zenoti.com |
| D | LatAm: frecuencia natural **2–4 semanas**; por segmento 2–3 y 3–4 semanas | PROVEEDOR LatAm (AgendaPro, 20.000+ negocios en LatAm; sin muestra para este numero) | agendapro.com |
| E | LatAm: clientes recurrentes "vuelven cada 2-4 semanas" | PROVEEDOR/BLOG (Trak Booking) | trakapp.io |
| F | Reino Unido 2017: afeitado a navaja cada ~2,5 semanas; restyling cada 5,8 semanas | PRIMARIO (Statista, muestra no visible — paywall) | statista.com |

**Lectura.** Hay dos poblaciones: el **habitual de fade/corte corto** (14–28 dias; C, D, E) y el
**promedio que incluye ocasionales** (≈ 48,5 dias; A, B). El propio waitq resume que el promedio de
48,5 esta "dragged up by occasional clients" (frase del resumen del buscador, no verificada en el
HTML — tratar como interpretacion). No se encontro **mediana** ni **distribucion** publicada.

## 2) Definiciones de la industria (riesgo / inactivo / perdido)

- **OpenChair [BLOG de proveedor]**: el lapso es **relativo al intervalo propio**: "A lapsed client is
  one whose gap since their last visit exceeds their typical visit interval by a meaningful margin."
  Ejemplo: cliente cada 6 semanas → **gap de 12 semanas** = señal de lapso. Umbral por defecto:
  "most salons use 60 to 90 days as a starting point" / "Start with a 90-day window if you are unsure".
  Cadencia de win-back: "A second message two weeks later".
- **Zenoti [PROVEEDOR]**: no da dias; dice "software should flag anyone who breaks cadence before
  they're gone" — o sea, el riesgo se define como romper la cadencia de 2–5 semanas.
- **AgendaPro [PROVEEDOR LatAm]**: recordatorio **21 dias despues del ultimo corte** ("Ya pasaron tres
  semanas, ¿agendamos para mantener el look?"), que segun ellos "aumenta la frecuencia de visita hasta
  en un 20%" (sin muestra ni metodo publicado).
- **Fresha, Booksy, theCut, SQUIRE**: tienen automatizaciones de "lapsed client win-back" pero **no se
  encontro el umbral en dias publicado** por ninguno.

## 3) Retencion

- **~48% de los clientes son "one-and-done"** (una sola visita) [PRIMARIO, SQUIRE via waitq].
- **44,63% de las visitas** en SQUIRE vienen de un cliente que ya habia ido a la misma barberia
  [PRIMARIO, SQUIRE via waitq].
- Zenoti 2026: visitas de clientes nuevos **−17%** interanual en barberias, visitas de existentes **+2%**
  [PRIMARIO agregado de proveedor, 30.000+ negocios].
- **No se encontro** % retenido a 90 dias ni tasa de segunda visita con muestra, mas alla del 48%
  one-and-done (que implica ~52% de vuelta al menos una vez, sin horizonte temporal declarado).

## 4) Particularidades

- **Bimodal por tipo de corte**: fade/degradado 2–3 semanas vs. largos 5–6 semanas (AgendaPro,
  Statista UK). Una escalera unica por comercio promedia dos poblaciones distintas.
- **Barba** tiene ciclo mas corto (2–3 semanas, blogs) — no se encontro dato primario.
- **Estacionalidad [BLOG, dojobusiness]**: "Revenue typically increases 20-40% in November and
  December"; "Summer months often see 10-20% revenue decreases". Hemisferio norte: en Argentina el
  pico de fiestas (diciembre) coincide con el inicio del verano/vacaciones — **no hay dato local**.
  Implicancia: un "perdido" puede reaparecer en diciembre; conviene no declararlo irrecuperable
  antes de haber pasado por un pico de fiestas.
- **Lealtad al barbero, no al local**: "65% of men report staying with the same barber for over 3
  years" (WifiTalents via waitq — agregador de baja calidad). Si el barbero se va, el cliente se va
  con el: la perdida no siempre es recuperable con marketing.
- **Turnos concentrados** jueves–sabado ("nearly 40% of all barbering appointments", Mangomint,
  181.180 turnos) — relevante para el horario del push, no para la escalera.

## 5) Escalera propuesta

| Etapa | Valor | Confianza | Justificacion |
|-------|-------|-----------|---------------|
| Te extrañamos — opcion A (habituales/fade) | **35 dias** | media | Tope de la cadencia natural 2–5 semanas (Zenoti) y una semana despues del tope de 2–4 semanas LatAm (AgendaPro/Trak). A los 35 dias el habitual ya se paso de su ciclo. Repite cada 35 → dispara en 35 y 70. |
| Te extrañamos — opcion B (clientela mixta/pelo largo) | **49 dias** | media | ≈ promedio SQUIRE 48,5 dias / ~7 cortes/año; restyling 5,8 semanas (Statista UK). Repite cada 49 → un solo envio antes de R. |
| En riesgo — R | **84 dias** (12 semanas) | media-baja | Regla "el doble del intervalo propio" (OpenChair: 6 sem → 12 sem) aplicada al promedio (~7 sem → ~14 sem) queda en ~98; 84 cae dentro de la ventana 60–90 que "most salons use" y deja margen para 2 envios antes de P. |
| En riesgo — cadencia X | **cada 21 dias** (84, 105) | baja | 21 dias es el recordatorio que AgendaPro reporta que funciona en LatAm y equivale a un ciclo de corte habitual; la repeticion en si no tiene dato. |
| Perdido — P | **120 dias** | baja | ~2,5× el promedio de 48,5; ya supera el umbral por defecto de 90 dias de la industria. Con ~48% one-and-done, quien no volvio en 4 meses probablemente cambio de barbero. |
| Perdido — 4 mensajes | **121, 135, 181, 211** (P+1, +14, +60, +90 desde el primero) | baja | Se mantiene la forma de la cafeteria; el "+14" coincide con el "second message two weeks later" de OpenChair. Sin dato propio del rubro. |
| Irrecuperable | **211 dias** (~7 meses) | baja | Tras el ultimo mensaje. Equivale a ~4 ciclos promedio perdidos. Si el comercio lo prefiere, extender a 365 para cubrir un pico de fiestas (diciembre) — no hay dato de reactivacion estacional. |

Recomendacion de producto (hallazgo a decidir, no decision): dado lo bimodal del rubro, la escalera
ideal seria **relativa al intervalo propio del cliente** (OpenChair, Zenoti "breaks cadence"), no
fija. Con dias fijos, la opcion A sirve a barberias de fade y la B a las de corte clasico.

## 6) Lo que no se encontro

- **Mediana y distribucion** del intervalo entre visitas (solo promedio SQUIRE).
- **Datos primarios de Argentina/LatAm**: solo afirmaciones de proveedores (AgendaPro, Trak) sin
  muestra. Ninguna encuesta argentina de frecuencia de corte.
- **Umbrales en dias** de lapsed/at-risk de Booksy, Fresha, theCut o SQUIRE (existen las
  funciones, no el numero publicado).
- **% retenido a 90 dias** y tasa de segunda visita con horizonte temporal.
- **Tasa de reactivacion** de campañas win-back en barberias.
- Estacionalidad con datos del hemisferio sur.
- Datos de theCut: nada publico.

## 7) Fuentes

1. waitq.app — https://waitq.app/blog/barbershop-statistics (verificado por `curl`)
   - "48.5 days" … "based on SQUIRE's 2026 platform data across 9.79 million appointments, roughly every 7 weeks for customers who return at all"
   - "approximately 7 haircuts per year"
   - "around 48% of clients are one-and-done"
   - "44.63% of all visits on SQUIRE come from a client who previously visited the same shop"
   - "according to SQUIRE's State of Barbershops report covering 13.9 million appointments across 7,000 shops"
2. American Salon (resumen del buscador; pagina con Cloudflare, no leida directo) — https://www.americansalon.com/barbering/top-3-takeaways-squires-new-barbershop-data
   - "Clients book with their barber every 48.5 days on average"
3. Zenoti — https://www.zenoti.com/thecheckin/salon-and-barbershop-metrics-guide (verificado por `curl`)
   - "A barber client's natural cadence is 2–5 weeks; software should flag anyone who breaks cadence before they're gone."
   - "new guest visits fell 17% same-store — the steepest of any segment"
4. AgendaPro — https://agendapro.com/blog/plan-de-negocios-para-barberia/ (verificado por `curl`)
   - "El cliente de barbería tiene una frecuencia de visita natural de entre 2 y 4 semanas"
   - "Frecuencia: cada 2-3 semanas" / "Frecuencia: cada 3-4 semanas" (por segmento)
5. AgendaPro — https://agendapro.com/blog/fidelizar-clientes-en-barberias-y-peluquerias/ (verificado por `curl`)
   - "Un sistema de gestión que envíe un mensaje de WhatsApp o SMS 21 días después del último corte diciendo: «¡Hola! Ya pasaron tres semanas, ¿agendamos para mantener el look?», aumenta la frecuencia de visita hasta en un 20%"
6. Trak Booking — https://trakapp.io/blog/software-barberias-latinoamerica/ (verificado por `curl`)
   - "clientes recurrentes que vuelven cada 2-4 semanas"
7. Statista — https://www.statista.com/statistics/719264/average-barber-visit-frequency-in-the-uk
   - "Average frequency of barber visits in the United Kingdom (UK) in 2017 (in weeks)"; "UK men pay a visit to the barber shop as often as every two and a half weeks" (afeitado); restyling "every 5.8 weeks"
8. OpenChair — https://openchairpro.com/guides/how-to-win-back-lapsed-clients
   - "A lapsed client is one whose gap since their last visit exceeds their typical visit interval by a meaningful margin."
   - "most salons use 60 to 90 days as a starting point" / "Start with a 90-day window if you are unsure"
   - "A second message two weeks later — different angle, same warmth — significantly improves conversion."
9. dojobusiness [BLOG] — https://dojobusiness.com/blogs/news/barbershop-investment-recovery-time (verificado por `curl`)
   - "Revenue typically increases 20-40% in November and December as customers prepare for holiday gatherings and professional events"
   - "Summer months often see 10-20% revenue decreases as customers adopt more casual styles and vacation schedules disrupt regular appointments"
10. Mangomint — https://www.mangomint.com/blog/barbershop-booking-statistics/ (verificado por `curl`)
    - "Using recent sample data from 181,180 barbering appointments"; "The end of the work week is the busiest time to be behind the chair in a barbershop, accounting for nearly 40% of all barbering appointments"
11. YouGov UK 2012 (general, sin corte por genero; descartado para la escalera) — https://yougov.com/en-gb/articles/4494-haircut-habits
    - 36% "once every two months", 21% "once a month"
