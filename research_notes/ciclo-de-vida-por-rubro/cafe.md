# Ciclo de vida del cliente — Cafeteria (`gcid:cafe`)

Investigacion: 2026-09-29. Presupuesto: ~20 busquedas/fetches (usado: ~21). Las citas se
obtuvieron con WebFetch (que extrae el texto con un modelo chico); las del paper argentino se
extrajeron directamente del PDF descomprimido y son textuales. Etiquetas: **[PRIMARIO]** = estudio
o dato de proveedor con muestra/metodologia; **[PROVEEDOR-CONFIG]** = default de producto de un
POS/CRM (no es un dato de comportamiento, es una convencion de la industria); **[BLOG]** = opinion
o cifra sin fuente verificable.

## 1. Intervalo de visita

No se encontro ninguna fuente que publique la **mediana de dias entre visitas a UNA cafeteria**.
Lo que existe son distribuciones de frecuencia (auto-reportadas o por geolocalizacion), de las que
se infiere el intervalo:

| Fuente | Tipo | Dato | Intervalo implicito |
|---|---|---|---|
| Cutrera et al. 2024, UNMDP (Mar del Plata, n=327, 2023) | [PRIMARIO] LatAm/AR | Consumo semanal de cafe de especialidad: <1 vez 34,25%; 1-2 veces 40,06%; 3-4 veces 15,60%; >4 veces 7,03%; NS/NR 3,06%. «la frecuencia de consumo imperante es de hasta 2 veces por semana (74,31%)», con preferencia por cafeterias | Moda: 1-2 veces/semana → **3,5 a 7 dias**. Un tercio consume menos de 1 vez/semana (>7 dias) |
| Drive Research 2026 (EE.UU., n=1.000, jun-2026) | [PRIMARIO] | Compra en cafeteria: todos los dias 7%; unas veces/semana 15%; 1 vez/semana 11%; cada algunas semanas 13%; 1 vez/mes 10%; menos de 1 vez/mes 24%; nunca 20%. Semanal o mas: 33% (51% en 2024) | Entre quienes compran (80%): ~41% cada ≤7 dias, ~29% cada 2-4 semanas, ~30% cada >30 dias |
| Placer.ai, oct-2025 (geolocalizacion) | [PRIMARIO] | «nearly one quarter of visitors to Aroma Joe's stopped at the chain at least four times during the month – a much higher loyalty rate than that seen by other leading coffee brands» | Aun en la cadena MAS leal, <25% de visitantes va ≥ semanalmente; en las demas, menos |
| Starbucks (Q2 2026, citado por CX Dive/Starbucks) | [PRIMARIO, cualitativo] | «a growing number of customers are visiting four or more times a week» | Existe un nucleo diario (intervalo 1-2 dias), sin tamaño publicado |

**Lectura:** la distribucion es **bimodal/larga**: un nucleo de habituales que va cada 1-7 dias
(el «cliente habitual» de cafe: 1-2 veces por semana en AR, ~intervalo 3-7 dias) y una cola grande
de ocasionales que va cada 2-8 semanas o menos. El «cliente promedio» de una cafeteria, medido por
persona y no por visita, esta mas cerca de **2-4 semanas** que de 1 semana. Advertencia: el dato
argentino mide consumo de cafe de especialidad en general, no visitas a un mismo local; el de
Drive Research mide cualquier cafeteria. El intervalo a UN local es necesariamente igual o mayor.

## 2. Definiciones de la industria (en dias)

| Proveedor | Tipo | Definicion | Dias |
|---|---|---|---|
| Square (Customer Directory, smart groups por defecto) | [PROVEEDOR-CONFIG] | Regulars: «customers who've visited your business three times in the last six months». Lapsed: «customers who were regulars, but haven't visited in the last six weeks» | Regular = 3 visitas/180 d; **Lapsed = 42 d** sin visita |
| Square (blog UK, customer groups) | [PROVEEDOR-CONFIG] | Regulars: «customers who have visited your business at least three times and who have visited within the last eight weeks» | Ultima visita ≤ **56 d** |
| Toast (campaña automatica «Miss You») | [PROVEEDOR-CONFIG] | «Targets guests that have not visited in 30 days or more.» | **30 d** (editable) |
| Toast (tope de frecuencia) | [PROVEEDOR-CONFIG] | «if any guest has gotten an automated marketing campaign from you in the past 28 days, they cannot receive another one.» | Max. 1 automatico cada **28 d** |
| Starbucks Rewards (8-K SEC, FY2024) | [PRIMARIO, definicion de KPI] | «Starbucks Rewards loyalty program 90-day active members in the U.S. totaled 33.8 million» | Activo = visita en ultimos **90 d** |
| Paytronix, Loyalty Report 2026 | [PRIMARIO, datos de clientes] | Los 90 dias posteriores al alta son la ventana critica; «securing a fourth visit» es el mejor marcador de valor | Ventana de **90 d** |

Nota: Toast y Square son restaurante/retail general, no especificos de cafe; son los defaults que
un comerciante de cafe ve en su POS. No se encontro una definicion de «perdido» (lost/churned) en
dias de ningun proveedor; el corte mas largo publicado es el de «activo = 90 dias» (Starbucks) y
la ventana de 6 meses de «regular» (Square).

## 3. Retencion

- Paytronix 2026 [PRIMARIO, sin muestra publicada]: «Beverage and snack, specialty, and sandwich
  and Mexican concepts recorded active rates of 66% to 72%». La nota no define la ventana de
  «active rate» (por contexto, los 90 dias post-alta). Para contraste, en bar/grill «nearly three in
  four new members» no vuelven en 90 dias. → **Bebidas/cafe es de los rubros con mejor retencion.**
- Paytronix (misma nota): «If your loyalty program can move your repeat rate from 30% to 40%,
  you've fundamentally changed your business economics» — opinion, no benchmark medido.
- Square/Restaurant Business (encuesta a 450+ decisores, QSR) [PRIMARIO, auto-reporte de
  operadores]: «loyalty members spend 40% more per visit and visit 64% more often than non-members».
- [BLOG, NO VERIFICADO] Varias paginas (regulr.ai, BusinessDojo, loyaltypass) repiten «40-50% de los
  primeros clientes vuelve en 30 dias» y «solo 20-30% vuelve a una segunda visita en 30 dias»,
  atribuido a un «Square Coffee Report 2024». **No se pudo localizar ese reporte**; ademas las dos
  cifras se contradicen. No se usan para la escalera.

## 4. Particularidades del rubro

- **Habito atado a rutina** (trayecto al trabajo, horario): la frecuencia alta depende de que la
  persona pase por la zona. Vacaciones, cambio de trabajo o home office cortan el habito de golpe
  sin que haya insatisfaccion → un silencio de 1-2 semanas en un habitual es señal real, pero un
  silencio de 3-4 semanas en verano puede ser solo vacaciones. (Inferencia, sin cita.)
- **Alta infidelidad cruzada**: Placer.ai reporta que en Q1 2025 «65.7% of Dutch Bros visitors also
  visited a Starbucks» — el cliente de cafe reparte visitas entre locales; la ausencia en un local no
  implica que dejo de tomar cafe.
- **Repeticion del pedido** (Drive Research 2026): «84% of coffee shop customers usually stick with
  the same drink» → un push que nombre «su» bebida es plausible y relevante.
- **Estacionalidad**: no se encontro dato citable de estacionalidad de visitas de cafe para
  Argentina (enero y receso invernal de julio son candidatos obvios, sin evidencia medida).
- **Caida de frecuencia reciente en EE.UU.**: Drive Research mide que la compra semanal o mayor bajo
  de 51% (2024) a 33% (2026), por precio. Refuerza no ser agresivo con umbrales cortos.

## 5. Escalera propuesta

| Etapa | Propuesta | Referencia actual | Confianza |
|---|---|---|---|
| Te extrañamos — opcion A | **7 dias** (repite cada 7) | 7 | Media |
| Te extrañamos — opcion B (recomendada por defecto) | **14 dias** (repite cada 14) | 14 | Media |
| En riesgo — R | **30 dias** | 30 | Media-alta |
| En riesgo — cadencia X | **cada 21 dias** (30, 51, 72) | 21 | Baja-media |
| Perdido — P | **90 dias** | 90 | Alta (como convencion) |
| Perdido — 4 mensajes | **91 / 105 / 151 / 181** | 91/105/151/181 | Baja |
| Irrecuperable | **despues del mensaje de 181 (~182 d)** | ~181 | Media |

**Justificacion:**

- **7 dias (A)**: para el nucleo habitual (AR: 40% consume 1-2 veces/semana; 22% de los compradores
  en EE.UU. va varias veces por semana o diario), una semana sin venir equivale a 2-7 visitas
  perdidas. Solo sirve para cafes de paso con clientela diaria. Riesgo: con cadencia 7 manda 3
  mensajes antes del dia 30; Toast, por diseño, no permite mas de un automatico cada 28 dias. Por eso
  confianza media y no default.
- **14 dias (B, default)**: cubre al habitual semanal (2 ciclos perdidos) sin molestar a la
  franja que va cada 2-4 semanas (~29% de compradores, Drive Research). Con cadencia 14 manda 2
  mensajes antes del dia 30, mas cerca del tope de 28 dias que usa Toast.
- **R = 30**: coincide exacto con el default «Miss You» de Toast (30 d) y queda por debajo del
  «lapsed» de Square (42 d); a los 30 dias un habitual (intervalo 3-7 d) perdio 4-10 visitas.
  Alternativa defendible: 42 (Square). Media-alta porque dos proveedores independientes caen en 30-42.
- **X = 21**: no hay dato de cadencia de win-back para cafe. 21 respeta aproximadamente el tope de
  28 d de Toast y deja 2-3 mensajes entre 30 y 90. Si se quiere alinear con Toast estrictamente,
  X = 28 (30, 58, 86). Confianza baja-media.
- **P = 90**: es la definicion publica de «activo» de Starbucks Rewards (90-day active members) y la
  ventana critica de Paytronix. Pasado 90 dias el cliente ya no cuenta como activo para el mayor
  programa de fidelidad de cafe del mundo. Confianza alta como convencion (no hay dato de que el
  retorno caiga en el dia 90 exacto).
- **Mensajes 91/105/151/181**: no se encontro evidencia sobre la curva de respuesta a win-back en
  cafe; se mantiene la referencia. El ultimo en 181 coincide con la ventana de 6 meses que Square
  usa para definir «regular» (3 visitas en 6 meses): a los ~180 dias sin visita ya es imposible
  cumplir esa definicion con el historial previo. Confianza baja en los dias intermedios.
- **Irrecuperable ~182**: mismo argumento (ventana de 6 meses de Square). Media.

## 6. Lo que no se encontro

- **Mediana/promedio de dias entre visitas a un mismo local de cafe** (ni de Square, Toast ni
  Starbucks). Solo distribuciones de frecuencia auto-reportadas o por geolocalizacion.
- El supuesto «Square Coffee Report 2024» con 40-50% de retorno a 30 dias: no localizado.
- Porcentaje de clientes nuevos que vuelve una segunda vez en cafe, con fuente primaria.
- Definicion de «perdido»/churned en dias de algun proveedor del rubro.
- Tasas de respuesta de campañas de win-back por dias de inactividad.
- Estacionalidad medida para Argentina/LatAm.
- Datos de proveedores latinoamericanos (Fudo, Bistrosoft, Mercado Pago) sobre frecuencia de cafe:
  no se buscaron por presupuesto.
- La nota de Toast «90% of Guests Buy Coffee Out Weekly» (pos.toasttab.com) devolvio 403; no se
  pudo leer ni citar.
- YouGov tiene un tracker de frecuencia en cafes (1.002-1.057 adultos EE.UU. por ola), pero el fetch
  no devolvio los porcentajes.

## 7. Fuentes

1. Cutrera, Lupin, Rodriguez, Berges (2024). *Consumo de cafe de especialidad, evidencia desde una
   encuesta en el Partido de General Pueyrredon*. II Jornada de Investigadores en Formacion,
   FCEyS-UNMDP. https://nulan.mdp.edu.ar/4162/1/cutrera-etal-2024.pdf — [PRIMARIO]
   - «una encuesta autoadministrada y online, realizada durante agosto-noviembre 2023, la que se
     distribuyó a través de un código QR en cafeterías de especialidad [...] Participaron 327
     consumidores (n=327)»
   - «La mayoría de los encuestados consume CE de vez en cuando. De hecho, la frecuencia de consumo
     imperante es de hasta 2 veces por semana (74,31%) prefiriendo hacerlo en cafeterías»
   - Figura 1 (Frecuencia semanal de consumo de CE): «34,25% [...] 40,06% [...] 15,60% [...] 7,03%
     [...] 3,06% — Menos de 1 vez / 1-2 veces / 3-4 veces / Más de 4 veces / NS/NR»
2. Drive Research, *2026 Coffee Statistics* (n=1.000, jun-2026).
   https://www.driveresearch.com/market-research-company-blog/coffee-survey/ — [PRIMARIO]
   - «n = 1,000 U.S. coffee drinkers · Fielded June 2026 · Published July 23, 2026»
   - Frecuencia de compra en cafeteria: Every day 7%; A few times a week 15%; Once a week 11%; Once
     every few weeks 13%; Once a month 10%; Less often than once a month 24%; Never 20%.
   - «84% of coffee shop customers usually stick with the same drink»
3. Square Support, *Create customer groups and filters*.
   https://squareup.com/help/us/en/article/6245-manage-customer-groups-and-filters — [PROVEEDOR-CONFIG]
   - «customers who've visited your business three times in the last six months» (Regulars)
   - «customers who were regulars, but haven't visited in the last six weeks» (Lapsed)
4. Square UK, *3 Ways To Manage Your Customer Groups*.
   https://squareup.com/gb/en/the-bottom-line/reaching-customers/customer-groups — [PROVEEDOR-CONFIG]
   - «customers who have visited your business at least three times and who have visited within the
     last eight weeks»
5. Toast Support, *Set Up an Ongoing Toast Marketing Campaign*.
   https://support.toasttab.com/en/article/Building-an-Automated-Email-Campaign — [PROVEEDOR-CONFIG]
   - «Targets guests that have not visited in 30 days or more.» (Miss You)
   - «if any guest has gotten an automated marketing campaign from you in the past 28 days, they
     cannot receive another one.»
6. Starbucks, Form 8-K exhibit 99.1 (Q3 FY2024), SEC.
   https://www.sec.gov/Archives/edgar/data/829224/000082922424000041/sbux-6302024xexhibit991.htm — [PRIMARIO]
   - «Starbucks Rewards loyalty program 90-day active members in the U.S. totaled 33.8 million, up 7%
     year-over-year»
7. Placer.ai, *6 Coffee-Inspired Strategies That Can Reshape Dining in 2026*.
   https://www.placer.ai/anchor/reports/6-coffee-inspired-strategies-that-can-reshape-dining-in-2026 — [PRIMARIO]
   - «In October 2025, nearly one quarter of visitors to Aroma Joe's stopped at the chain at least
     four times during the month – a much higher loyalty rate than that seen by other leading coffee
     brands.»
8. Placer.ai, *Dutch Bros Gains, But Starbucks Holds Top Spot* (via resultado de busqueda; no se hizo
   fetch directo — tratar como cita secundaria).
   https://www.placer.ai/anchor/articles/dutch-bros-gains-but-starbucks-holds-top-spot
   - «In Q1 2025, 65.7% of Dutch Bros visitors also visited a Starbucks»
9. e-commerce.news, *Paytronix loyalty report spotlights early retention gap* (sobre el Paytronix
   Loyalty Report 2026). https://e-commerce.news/story/paytronix-loyalty-report-spotlights-early-retention-gap — [PRIMARIO via prensa, sin muestra publicada]
   - «Beverage and snack, specialty, and sandwich and Mexican concepts recorded active rates of 66% to 72%»
   - «If your loyalty program can move your repeat rate from 30% to 40%, you've fundamentally changed
     your business economics»
10. Square, *Scaling Loyalty: Data-Driven Insights for Quick-Service Restaurants*.
    https://squareup.com/us/en/the-bottom-line/reaching-customers/scaling-qsr-loyalty — [PRIMARIO, encuesta a operadores]
    - «a restaurant industry study of more than 450 decision makers» / «loyalty members spend 40% more
      per visit and visit 64% more often than non-members»
11. Starbucks Q2 2026 (via resultado de busqueda de CX Dive; no se hizo fetch directo — cita secundaria).
    https://www.customerexperiencedive.com/news/starbucks-loyalty-update-driving-frequency-membership-grows/818864/
    - «a growing number of customers are visiting four or more times a week»
