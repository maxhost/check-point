# Ciclo de vida del cliente — Salón de belleza / peluquería (`gcid:beauty_salon`)

Investigación: 2026-09-29. Presupuesto usado: ~19 búsquedas/fetches. Condición de corte alcanzada:
hay 4 números independientes y citados para el intervalo de visita (sección 1).

Convención: **[PRIMARIO]** = estudio o dato de proveedor con muestra/metodología declarada.
**[PROVEEDOR s/muestra]** = cifra de un proveedor del rubro sin muestra publicada.
**[OPINIÓN]** = blog/consultoría sin datos. **[SNIPPET]** = solo lo vi en el resumen del buscador,
no pude abrir la página: no tratarlo como verificado.

---

## 1) Intervalo de visita

| Dato | Días aprox. | Tipo | Fuente |
|---|---|---|---|
| Corte mujer: cada **6,2 semanas** (2017); color cada **6,6 semanas** | 43 / 46 | [PRIMARIO] encuesta a 2.557 salones clientes de Salon Services (UK). Ojo: es lo que *estiman los salones*, no un log de turnos | Statista / Salon Services |
| Serie 2014–2017 corte: 5,8 / 7,3 / 6,0 / 6,2 semanas | 41–51 | idem | idem |
| Mujeres: «every six weeks for a standard trim, every 10 weeks for a colour» | 42 / 70 | [PRIMARIO débil] encuesta de PromotionalCodes.org.uk, muestra no publicada | HJI |
| Frecuencia promedio de visita (FOV) de la industria: **4,88 visitas/año** | ~75 | [PROVEEDOR s/muestra] Meevo (software de salones) | Meevo |
| **Argentina**: 7 de cada 10 argentinas van «como mínimo cinco veces al año» | ≤73 | [PRIMARIO] Beauty Report de L'Oréal (2016), muestra no especificada | Beauty Market America |

**Lectura:**
- **Cliente habitual (fiel, de mantenimiento):** ~6 semanas = **~42–46 días**. Tres fuentes independientes convergen (UK salones 43 d, encuesta UK 42 d; y el caso de «regla» mencionado por Zoca más abajo).
- **Cliente promedio (mezcla corte + color + esporádico):** ~10–11 semanas = **~70–75 días** (color cada 10 semanas; FOV 4,88/año; Argentina ≥5/año).
- **Distribución:** no encontré una distribución real (percentiles) de días entre turnos. Solo hay puntos medios.
- **Particularidad Argentina (no verificado):** el buscador devolvió que «si antes un cliente iba cada 30 días, ahora lo hace cada 45 o 60 días» (rodolfourrea.com, 2026). **[SNIPPET]**, no abrí la página ni tiene datos: no lo uso para calibrar.

## 2) Definiciones de la industria

- **Ventana estándar de retención = 90 días.** Strategies (consultora de salones): «90 days because it captures the frequency of visit for the majority of hair salons that do cuts and color». Meevo: retención de clientes nuevos = vuelven «within 90 days of their initial appointment». Phorest: «return for a second visit within a specified period (usually ninety days)». Boulevard (via búsqueda): cliente nuevo retenido = vuelve dentro de 90 días. → **Quien no volvió en 90 días, para la industria, no fue retenido.**
- **«Overdue / at risk» relativo al ciclo propio (Phorest, Client Reconnect):** «A client is marked as at risk/overdue when they go beyond their typical booking interval», calculado tras 3 turnos en la misma categoría de servicio. Sin días fijos. [PROVEEDOR, documentación]
- **«Lapsed» = 90 días, o 2× el ciclo propio; «deeply lapsed» = 180+ días** (Zoca): «any client who has not visited in 90 days or more»; «A hair colour client who books every eight weeks lapses at 16 weeks». Clientes ausentes 180+ días son «deeply lapsed». [OPINIÓN de proveedor, sin datos]
- **Vagaro «Lost Customer» campaign:** slider en semanas desde la última visita, hasta **24 semanas (168 días)**. [SNIPPET: la página de soporte devolvió 403; el dato viene del resumen del buscador]
- **SalonBiz:** «a 'we miss you' note at 60 days quiet, followed by an incentive if they still haven't rebooked». [OPINIÓN de proveedor]
- **Zenoti:** «loyal clients (those visiting more than once a year)». [PROVEEDOR, benchmark 2025 sobre datos 2024 de su plataforma EE.UU./Canadá, sin tamaño de muestra publicado]

## 3) Retención

- **Boulevard 2023** [PRIMARIO: «more than 11 million appointments and 4 million unique clients across more than 30,000 businesses», ene-2022 a mar-2023]: salones promedio convierten **45%** de primeras visitas en segunda y **39%** en tercera; top: 70% / 57%. «70 percent of clients who complete a second appointment go on to book a third»; «79 percent of clients who book a third appointment go on to book a fourth». Online vs walk-in: 78% vs 39% vuelven.
- **Phorest** [PROVEEDOR s/muestra]: «New Client Retention: 30%», «Existing Client Retention: 68%», «Overall Client Retention: 58%».
- **Meevo** [PROVEEDOR s/muestra]: primeras visitas 45%; clientes repetidos 75% (meta 85%).
- **Boulevard 2025** (vía resumen de búsqueda) primera visita 35%. [SNIPPET]
- **Zenoti 2025**: «Top-earning salons rebook 30% of clients within 24 hours. Industry average for salons is 10%»; 42% de clientes (los que van >1 vez/año) generan 80% del ingreso.

**Conclusión:** el abandono se concentra entre la 1.ª y la 2.ª visita (55–70% no vuelve). Una vez en la 3.ª–4.ª visita, la retención visita-a-visita sube a 70–80%. La escalera importa sobre todo para el cliente con 1 visita.

## 4) Particularidades del rubro

- **Dos ciclos mezclados en el mismo comercio:** corte (~6 sem) y color (~6,6–10 sem); uñas/depilación son más cortos (manicura 3,7 sem, depilación 4,4 sem según Salon Services 2017). Un salón con mucha manicura tendría un ciclo más corto que uno de solo color.
- **La personalización por ciclo propio es el estándar de los proveedores** (Phorest calcula intervalo por cliente; Zoca: 2× el ciclo). Nuestra escalera es fija por rubro; es una simplificación consciente.
- **Estacionalidad: no encontré datos citables** (ver sección 6). No se afirma nada.
- **Argentina:** el único dato duro (L'Oréal 2016, ≥5 visitas/año en 70% de mujeres) es consistente con el promedio internacional (~73–75 días).

## 5) Escalera propuesta

| Etapa | Valor | Confianza |
|---|---|---|
| Te extrañamos — opción A | **día 45**, se repite cada 45 hasta R (⇒ 1 mensaje en 45) | media |
| Te extrañamos — opción B | **día 60**, se repite cada 60 hasta R (⇒ 1 mensaje en 60) | media |
| En riesgo (R) | **día 90** | alta |
| Cadencia en riesgo (X) | **cada 30 días** (mensajes en 90, 120, 150) | media-baja |
| Perdido (P) | **día 180** | media |
| Mensajes de Perdido | **181, 211, 271, 361** (P+1; +30; +90; +180 desde el primero) | baja |
| Irrecuperable | **~día 365** (después del 4.º mensaje) | media-baja |

**Justificación:**
- **45 (opción A):** apenas pasado el ciclo del cliente habitual (~42–46 días: Salon Services 6,2–6,6 sem; HJI 6 sem). Es el equivalente al «se pasó de su intervalo» de Phorest para un cliente de corte. Para el comercio con clientela fiel de mantenimiento.
- **60 (opción B):** para clientela de color/mixta (color cada 10 sem = 70 d; FOV 4,88/año ≈ 75 d). Coincide con el «we miss you at 60 days» de SalonBiz. Escribir antes de 60 a un cliente de color es escribirle antes de su turno normal.
- **R = 90:** es la ventana de retención que usan Strategies, Meevo, Phorest y Boulevard; además ≈ 2× el ciclo habitual (regla de Zoca) y ~1,2× el ciclo promedio. Confianza alta porque es la definición más consensuada del rubro.
- **X = 30:** no encontré una cadencia medida. Se elige ~medio ciclo habitual para que entre 90 y 180 haya 3 contactos sin saturar. Baja-media.
- **P = 180:** Zoca separa «deeply lapsed» a 180+; Vagaro permite campañas de «lost customer» hasta 168 días (24 sem), lo que sugiere que después de ~6 meses el proveedor ya no lo modela como «perdido reciente»; 180 ≈ 2,4× el ciclo promedio (75 d). Media.
- **Mensajes 181/211/271/361 e Irrecuperable ~365:** escalado del patrón del café a la escala de peluquería. El corte en ~1 año se apoya en que Zenoti define al cliente fiel como «más de una vez al año» (quien no vino en 12 meses dejó de serlo). No hay dato de tasa de recuperación por antigüedad → baja.

## 6) Lo que no se encontró

- **Distribución** (percentiles) de días entre turnos con datos de logs de turnos; solo hay promedios y estimaciones de encuestas.
- **Definición en días de «perdido» de Fresha, Mindbody, Boulevard o Milady**: no apareció. Phorest no usa días fijos.
- **Tasas de recuperación por antigüedad de inactividad** (qué % vuelve si se le escribe a los 90 vs 180 vs 365 días): solo la afirmación sin datos de Zoca (15–25% en 30 días) y un snippet de «<20% después de 3 meses» sin fuente abierta.
- **Estacionalidad** (picos de diciembre, fiestas, casamientos, verano): no encontré datos citables; no se afirma.
- **Datos de LatAm/Argentina con logs de turnos**: solo L'Oréal 2016 (encuesta, sin muestra publicada). El cambio «de 30 a 45–60 días» en Argentina es un snippet sin verificar.
- **Salon Today / Milady con benchmarks propios**: solo apareció Salon Today como difusor del informe de Boulevard.
- Documentación de Vagaro (403): el máximo de 24 semanas es de snippet.

## 7) Fuentes

1. Statista / Salon Services — https://www.statista.com/statistics/458307/average-price-hair-beauty-salon-treatments-united-kingdom-uk/ — «Average number of weeks between female visits for hair and beauty salon treatments in the United Kingdom (UK) in 2014 and 2017, by type»; haircuts 2017: 6.2; hair color 2017: 6.6; «2,557 respondents». [PRIMARIO]
2. HJI — https://hji.co.uk/hairdressing-industry-statistics-reveal-women-see-regular-salon-visits-as-a-necessity — «women visit the salon on average every six weeks for a standard trim, every 10 weeks for a colour and twice a year for a special event». [PRIMARIO débil]
3. Meevo — https://www.meevo.com/blog/calculating-client-retention-rate/ — «The industry average is 4.88 visits annually, but achieving 7–8 per client is ideal»; «return for a second visit within 90 days of their initial appointment»; «industry average for retaining first-time visitors is 45%»; «repeat client retention rate of 75%». [PROVEEDOR s/muestra]
4. Beauty Market America (L'Oréal Beauty Report, 2016) — https://www.beautymarketamerica.com/la-peluqueria-mueve-millones-de-dolares-anuales-en-argentina-11005.php — «siete de cada diez argentinas acuden a la peluquería con cierta frecuencia, como mínimo cinco veces al año». [PRIMARIO, muestra no publicada]
5. Salon Today (informe Boulevard) — https://www.salontoday.com/articles/boulevard-report-reveals-top-performing-salons-retain-56-more-first-time-visitors-than-average — «Spanning more than 11 million appointments and 4 million unique clients across more than 30,000 businesses»; «Top-performing salons convert 70 percent of first-time visits into a second appointment and 57 percent into a third»; «just 45 percent and 39 percent, respectively, for salons with average retention rates». [PRIMARIO]
6. Strategies — https://strategies.com/whats-best-date-range-tracking-salon-spa-client-retention — «90 days because it captures the frequency of visit for the majority of hair salons that do cuts and color». [OPINIÓN experta / consultora]
7. Strategies — https://strategies.com/what-client-retention-rates-say-about-your-salon-or-spa — benchmarks de primera visita: 50% «good», 60% «excellent»; medición a 90 días. [OPINIÓN experta]
8. Phorest (blog) — https://www.phorest.com/us/blog/fully-booked-salon-client-retention/ — «New Client Retention: 30%», «Existing Client Retention: 68%», «Overall Client Retention: 58%»; «within a specified period (usually ninety days)». [PROVEEDOR s/muestra]
9. Phorest (soporte) — https://support.phorest.com/hc/en-us/articles/360017457179-What-is-Client-Reconnect-and-how-does-it-work — «A client is marked as at risk/overdue when they go beyond their typical booking interval». [PROVEEDOR, documentación de producto]
10. Zoca — https://zoca.com/post/how-to-win-back-lapsed-salon-clients — «any client who has not visited in 90 days or more»; «A hair colour client who books every eight weeks lapses at 16 weeks»; 180+ días = «deeply lapsed». [OPINIÓN de proveedor]
11. SalonBiz — https://salonbizsoftware.com/blog/how-to-win-back-salon-clients-7-strategies-that-work/ — «a 'we miss you' note at 60 days quiet, followed by an incentive if they still haven't rebooked». [OPINIÓN de proveedor]
12. Zenoti 2025 Benchmark — https://www.zenoti.com/thecheckin/beauty-wellness-industry-statistics-2025 — «42% of loyal clients (those visiting more than once a year) drive 80% of total revenue»; «Top-earning salons rebook 30% of clients within 24 hours. Industry average for salons is 10%». [PROVEEDOR, datos de plataforma sin muestra publicada]
13. Boulevard (blog) — https://www.joinblvd.com/blog/client-retention-formula — «salons average about 45% customer retention, while high-performing salons reach 70%». [PROVEEDOR]
14. Vagaro (soporte, 403) — https://support.vagaro.com/hc/en-us/articles/26168603819547-Reclaim-Lost-Customers-with-a-Text-Campaign — según resumen del buscador: campañas «up to 24 weeks (five and a half months) after your customers' last appointment». [SNIPPET, no verificado]
