# Ciclo de vida del cliente — Tienda de ropa (`gcid:clothing_store`)

Investigacion: 2026-09-29. Presupuesto usado: ~19 busquedas/fetches. Condicion de corte alcanzada:
hay 3+ numeros independientes y citados sobre intervalo de compra (Kantar UK, Demokratia/Mendoza,
Beans, mas dos blogs). **Advertencia de fondo:** ninguna fuente mide el intervalo entre visitas a
UNA tienda de ropa fisica chica en LatAm. Lo que hay es: (a) frecuencia de compra de ropa como
categoria (en cualquier tienda), (b) frecuencia por marca (Kantar), (c) datos de e-commerce DTC.
La escalera propuesta extrapola de ahi; por eso la confianza general es media-baja.

Clave de tipo de fuente: **[P]** = dato primario (encuesta, panel o datos de proveedor con muestra
declarada). **[B]** = blog/opinion o sintesis sin muestra declarada.

---

## 1) Intervalo de visita / compra

| # | Dato | Nivel | Tipo | Traduccion a dias |
|---|------|-------|------|-------------------|
| 1 | Kantar UK: «On average, fashion shoppers make a purchase every two weeks.» | Categoria (todas las tiendas) | [P] panel Kantar | ~14 d entre compras de moda en CUALQUIER tienda — no aplica a una tienda sola |
| 2 | Kantar UK: «heavy shoppers – loyal shoppers buying on five or more occasions» (con una marca, en 12 meses) y «light, infrequent shoppers - those who buy only once or twice a year» | Marca | [P] panel Kantar | Habitual (5+/año) ≈ ≤73 d; ocasional (1–2/año) ≈ 180–365 d |
| 3 | Demokratia, Gran Mendoza, mar-2025: 11,36% compra ropa/calzado «una o dos veces por mes»; 31,06% «una o dos veces cada seis meses»; 29,13% «una o dos veces al año»; 28,45% con menor frecuencia («cada varios años») | Categoria, Argentina | [P] encuesta (tamaño de muestra no publicado en la nota) | Mediana del consumidor argentino: entre 1–2 veces por semestre y 1–2 veces por año → ~90–365 d |
| 4 | Beans (495 tiendas online, 2,6 M ordenes, 1,6 M clientes): los clientes fieles compran «between 3 and 4 times per year» | Tienda (promedio de todos los rubros, no solo moda) | [P] datos de proveedor | ~90–120 d |
| 5 | Opensend: «Fashion and apparel: 3-6 purchases per year» | Tienda (e-commerce) | [B] | ~60–120 d |
| 6 | Eightx: «Apparel and fashion (about 90 to 180 days). Not depletion-driven at all.» (punto medio ~120 d) | Tienda (DTC) | [B] sintesis, lo declara: «best estimates synthesized… not single-source figures» | 90–180 d |
| 7 | Eightx citando a BS&Co (156.110 clientes DTC, 2024): mediana de tiempo a la 2a compra en apparel 15–27 dias; nota: «sample composition by vertical is not disclosed» | Tienda (DTC online) | [B→P parcial] | 15–27 d **a la 2a compra**, sesgado por e-commerce (carrito repetido, regalos). No representativo de tienda fisica |

**Lectura:**
- **Cliente habitual de una tienda**: 4–6 compras/año → **~60–90 dias** (Kantar «heavy» 5+/año; Opensend 3–6; Beans 3–4).
- **Cliente promedio**: 1–2 compras/año a la tienda → **~180–365 dias** (Kantar «light»; Mendoza: ~60% compra ropa 1–2 veces al año o menos, EN TOTAL, no solo en una tienda).
- **Distribucion**: muy asimetrica. La encuesta de Mendoza da la unica distribucion argentina: 11% mensual, 31% semestral, 29% anual, 28% menos que anual.
- No se encontro una mediana medida en dias para tienda fisica de ropa.

## 2) Definiciones de la industria (riesgo / inactivo / perdido)

| Fuente | Definicion | Tipo |
|--------|------------|------|
| Endear (software de clienteling para retail/moda) | Fast fashion: «A customer might be considered lapsed after just 3-6 months of inactivity.» Abrigos de gama alta: «The window might be 12-18 months, as people don't buy new winter coats every season.» | [B] opinion de proveedor del rubro |
| Bluecore (plataforma de retail marketing) | Segmenta inactivos: 0–12 meses «Freshly inactive buyers»; 12–24 meses «moderate dormancy»; 24+ meses «Long-term lapsed buyers». Y: «reactivated buyers spend 12.7% more on average than new ones.» | [B] proveedor, sin muestra publicada |
| Busqueda general (resumen de varios resultados, p.ej. Treasure Data / Eastside Co) | «customers are considered "lapsed" once 12 months has passed since their last purchase»; «a fashion retailer might set it at 90 days» | [B] |
| Klaviyo (comunidad) | Ejemplos de winback con «Expected Date of Next Order» + 35/40 dias; recomendacion de demorar el winback por encima del ciclo de compra («90 days for a brand whose customers typically reorder every 45–60 days») | [B] |

**Lectura:** el consenso de proveedores es **inactivo/lapsed a los 3–6 meses en moda de rotacion**
y **12 meses como estandar generico de «lapsed»**; Bluecore sigue tratando como reactivables a
clientes de 12–24 meses, lo que sugiere no declarar «irrecuperable» antes del año.

## 3) Retencion / abandono

| Dato | Tipo |
|------|------|
| Beans: en Fashion (193 tiendas: apparel, joyeria, madre-bebe) el 16% de los clientes compro mas de una vez en el año (definicion: «Customers who have bought from the store more than once»). | [P] proveedor con muestra |
| Mageloyalty: «Fashion and apparel as a category typically shows repeat purchase rates between 12-26%»; «Over half of all repeat purchases happen within 30 days of the first order»; «Three-quarters happen within 90 days». | [B] sin fuente atribuida |
| Amp: 180-day repurchase para «Fashion Accessory brands» 27–37% en clientes recurrentes vs 10–15% en nuevos. | [B] benchmark de proveedor, pagina sin muestra |

**Lectura:** solo ~1 de cada 6 clientes nuevos de moda vuelve en el año (e-commerce). La mayoria
de las segundas compras que ocurren, ocurren en los primeros 90 dias. Implicacion: el cliente que
no volvio en ~4 meses ya esta en la cola de la distribucion. No se encontro retencion a 90 dias de
tienda fisica ni dato de LatAm.

## 4) Particularidades del rubro

- **Estacionalidad por temporada, no por consumo.** Eightx: «Not depletion-driven at all.» Endear: la gente «don't buy new winter coats every season». En Argentina el ciclo natural es semestral (otoño-invierno / primavera-verano) con picos de fechas: CAME reporta el Dia de la Madre como impulso para indumentaria (2025: ventas de Dia de la Madre en indumentaria -3,3% i.a., pero con «leve impulso estacional») y el cambio de temporada en septiembre con baja estacional («Textil e indumentaria el más afectado con -10,9%»).
- **Contexto macro argentino alarga el ciclo.** CAME nov-2025: «Las ventas bajaron 4.3% interanual por la pérdida de ingresos reales, que llevó a postergar la renovación del guardarropa.» Un cliente silencioso no necesariamente se fue a otra tienda: puede estar postergando.
- **Aniversario de temporada.** Un cliente semestral/anual vuelve naturalmente cerca de los 180 y 365 dias de su ultima compra (misma temporada). Conviene que algun mensaje de «Perdido» caiga cerca del dia ~365.
- **Implicacion para el motor:** el disparo por dias desde la ultima visita no ve la temporada. Recomendacion (fuera de alcance de este informe, a decidir): permitir que el comercio suprima/adelante mensajes en cambio de temporada y fechas (Dia de la Madre, Padre, Navidad, vuelta a clases).

## 5) Escalera propuesta

| Etapa | Valor | Justificacion | Confianza |
|-------|-------|---------------|-----------|
| Te extrañamos — opcion A | **45 d**, se repite cada 45 (45, 90) | Para tiendas de rotacion (fast fashion, basicos): habitual 5+/año ≈ ≤73 d (Kantar); 3–6/año (Opensend). 45 d esta por debajo del ciclo del habitual pero no molesta en la ventana de 15–30 d donde ocurren muchas segundas compras. | media |
| Te extrañamos — opcion B | **60 d**, se repite cada 60 (60) | Para tiendas de temporada / ticket alto: ciclo 90–180 d (Eightx), 3–4/año (Beans). | media |
| En riesgo (R) | **R = 120**, cada **X = 45** (120, 165, 210) | 120 d = 4 meses, dentro del «lapsed after just 3-6 months» de fast fashion (Endear); superado el ciclo del habitual 3–4/año (Beans) y ya pasada la ventana de 90 d en que ocurren ~3/4 de las recompras (Mageloyalty [B]). Cadencia 45 = 3 mensajes en el tramo, cubriendo un cambio de temporada. | media |
| Perdido (P) | **P = 240** | 8 meses: supera el ciclo semestral (~180 d, 31% de Mendoza compra 1–2 veces por semestre) con margen de una temporada; queda por debajo del estandar generico de 12 meses para no llegar tarde. | baja-media |
| Mensajes de Perdido | **241, 271, 331, 366** (P+1, +30, +90, +125 desde el primero) | El ultimo cae en el aniversario de la ultima compra (misma temporada del año siguiente), donde el cliente anual vuelve naturalmente. | baja-media |
| Irrecuperable | **~400 d** (~13 meses) | Coincide con el estandar de «lapsed» a 12 meses mas un mes de gracia post-aniversario. Bluecore aun ve reactivables de 12–24 meses, asi que es una decision conservadora de no-spam, no un limite medido. | baja |

Comparacion con la cafeteria (7/14; 30 c/21; 90; 181): la ropa escala ~4–6x en el tramo inicial y
~2,2x en Irrecuperable, coherente con un ciclo de 60–120 d vs ~7 d.

**Riesgo principal de la propuesta:** los datos de intervalo por tienda vienen de e-commerce
anglosajon; en Argentina la encuesta de Mendoza sugiere ciclos MAS largos (60% compra ropa 1–2
veces al año o menos en total). Si la tienda tiene clientela mayormente semestral, la opcion B
(60) y hasta un R de 150 serian mas prudentes. Validar con datos propios de la plataforma apenas
existan (mediana real de dias entre visitas por comercio del rubro).

## 6) Lo que no se encontro

- McKinsey State of Fashion: no se encontro dato de frecuencia de compra ni de intervalo (no se busco a fondo; no hubo resultados con cifras).
- CIAI (Camara Industrial Argentina de la Indumentaria): no se encontro dato de frecuencia de compra.
- Kantar Argentina / LatAm de moda: no se encontro frecuencia publica.
- Mediana medida en dias entre compras en tienda FISICA de ropa, en cualquier pais.
- Definiciones de riesgo/perdido de POS latinoamericanos del rubro (p.ej. Tiendanube, Fudo no aplica): no encontradas.
- Retencion a 90 dias de tienda fisica; tamaño de muestra de la encuesta Demokratia.
- Klaviyo no publica un benchmark propio de dias entre compras en apparel (solo ejemplos de la comunidad).

## 7) Fuentes

1. Kantar UK, «Four pillars for finding growth in the UK fashion landscape» — https://www.kantar.com/uki/inspiration/fashion-beauty/2022-wp-four-pillars-for-finding-growth-in-the-uk-fashion-landscape — «On average, fashion shoppers make a purchase every two weeks.» / «light, infrequent shoppers - those who buy only once or twice a year» / «heavy shoppers – loyal shoppers buying on five or more occasions» / «There are more than 1bn occasions per year where fashion is bought in the UK.» **[P]**
2. Los Andes (encuesta Demokratia, Gran Mendoza, 3–7 mar 2025) — https://www.losandes.com.ar/sociedad/seis-cada-10-mendocinos-se-compra-ropa-dos-veces-al-ano-o-menos-n5943665 — «el 28,45% compra con una frecuencia mayor al año o cada varios años, mientras que el 29,13% lo hace una o dos veces al año»; 31,06% «una o dos veces cada seis meses»; 11,36% «una o dos veces por mes». **[P]** (muestra no publicada)
3. Beans, «Analysis of ecommerce loyalty and purchase frequency by industry» — https://www.trybeans.com/blog/analysis-of-loyalty-and-purchase-frequency-by-industry — «2.6 million orders from 1.6 million customers» en 495 tiendas; Fashion (193 tiendas) 16% de clientes fieles («Customers who have bought from the store more than once»); fieles compran «between 3 and 4 times per year» (todas las industrias); «Purchase frequency is considered over a period of 1 year». **[P]**
4. Eightx, «Average Days Between Orders by Vertical: 2026» — https://eightx.co/blog/average-time-between-orders-by-vertical — «Apparel and fashion (about 90 to 180 days). Not depletion-driven at all.» / «the interval midpoints are best estimates synthesized… not single-source figures». **[B]**
5. Eightx, «Average time to second purchase by vertical (2026)» — https://eightx.co/blog/average-ecommerce-time-to-second-purchase-by-vertical-2026 — apparel 15–27 dias a la 2a compra, via BS&Co (156.110 clientes); «sample composition by vertical is not disclosed in the public summary». **[B]**
6. Opensend, «7 Purchase Frequency Statistics» — https://www.opensend.com/post/purchase-frequency-statistics-ecommerce — «Fashion and apparel: 3-6 purchases per year». **[B]**
7. Mageloyalty, «Fashion & Apparel Repeat Purchase Benchmarks 2026» — https://www.mageloyalty.com/blog/fashion-apparel-repeat-purchase-benchmarks-for-shopify-brands-in-2026 — «Fashion and apparel as a category typically shows repeat purchase rates between 12-26%»; «Over half of all repeat purchases happen within 30 days of the first order»; «Three-quarters happen within 90 days». **[B]**
8. Endear, «Use Clienteling to Win Back Your Lapsed Customers» — https://endearhq.com/blog/clienteling-to-lure-lapsed-customers — «A customer might be considered lapsed after just 3-6 months of inactivity» (fast fashion); «The window might be 12-18 months, as people don't buy new winter coats every season.» **[B]**
9. Bluecore, «Reactivation Roadmap» — https://www.bluecore.com/lp/reactivating-lapsed-buyers/ — 0–12 meses «Freshly inactive buyers», 12–24 «moderate dormancy», 24+ «Long-term lapsed buyers»; «reactivated buyers spend 12.7% more on average than new ones.» **[B]**
10. La Nacion (informe CAME, nov-2025) — https://www.lanacion.com.ar/economia/consumo-en-rojo-las-ventas-minoristas-pyme-cayeron-41-interanual-en-noviembre-y-91-frente-a-octubre-nid08122025/ — «Las ventas bajaron 4.3% interanual por la pérdida de ingresos reales, que llevó a postergar la renovación del guardarropa.» **[P]** (relevamiento CAME)
11. El Esquiu / La Nueva (CAME, Dia de la Madre y sep-2025) — https://www.elesquiu.com/nacionales/2025/10/19/las-ventas-por-el-dia-de-la-madre-2025-cayeron-35-suman-cuatro-anos-de-baja-consecutiva-segun-la-came-557945.html y https://www.lanueva.com/nota/2025-11-9-16-39-0-pese-al-impulso-del-dia-de-la-madre-las-ventas-en-comercios-minoristas-cayeron-en-octubre — indumentaria -3,3% en Dia de la Madre 2025; septiembre «marcada por el cambio de temporada… Textil e indumentaria el más afectado con -10,9%». **[P]** (citas tomadas del resumen del buscador, no del fetch directo de la nota: verificar antes de usar en una spec)
12. Klaviyo Community, «Winback Flow Benchmarks» — https://community.klaviyo.com/marketing-30/winback-flow-benchmarks-5148 — ejemplo de segmento «Expected Date of Next Order» + 35 dias. **[B]** (cita del resumen del buscador)
