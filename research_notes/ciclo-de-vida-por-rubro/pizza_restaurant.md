# Ciclo de vida del cliente — Pizzería (`gcid:pizza_restaurant`)

Investigado 2026-09-29. ~20 búsquedas/fetches (presupuesto agotado). Las citas son textuales de lo que
devolvieron las páginas; en los fetches las extrajo un modelo resumidor, así que antes de pasar un número
a una spec o a un ADR hay que abrir la URL y reproducirlo (regla del repo sobre hallazgos de subagentes).

Leyenda: **[P]** = dato primario (datos de un proveedor con muestra declarada, o encuesta con n y fecha).
**[O]** = opinión/recomendación de un blog de proveedor, sin datos detrás.

---

## 1) Intervalo de visita

| # | Número | Qué mide | Tipo | Fuente |
|---|---|---|---|---|
| 1 | **8,9 días**, mediana entre pedidos repetidos | Todos los rubros de la plataforma; la pizza es ~30% del volumen. Solo quienes repitieron dentro de 6 meses | [P] 4M+ pedidos, 479 marcas, 2.126 locales, mar-2025 a mar-2026, mayormente EE.UU. | Restolabs, Online Ordering Report |
| 2 | **3,2 pedidos por cliente** (nuevos + repetidores) | Promedio en el período del informe | [P] misma muestra | Restolabs |
| 3 | **8%** pide pizza al menos una vez por semana; **~30%** al menos una vez por mes; **79%** al menos algunas veces por año | Frecuencia de la **categoría** (cualquier pizzería), adultos de EE.UU. | [P] encuesta CivicScience (2023 y 2026; n no declarado para esta pregunta) | CivicScience |
| 4 | **31%** come pizza una vez por semana o más; **70%** al menos algunas veces por mes | **Comer** pizza (incluye congelada), EE.UU. | [P] encuesta, n=1.026, 12–13 ene 2020 | CouponFollow |
| 5 | **~60%** come pizza congelada o de delivery entre una vez por semana y 2–3 veces por mes | Categoría, EE.UU. | [P débil] encuesta propia de una consultora, sin n publicado | Brisan Group |

**Lectura.**
- **Cliente habitual de un local: pide cada ~7–14 días.** Lo apoya la mediana de 8,9 días de Restolabs, que
  además está sesgada hacia abajo: solo cuenta a quienes repitieron dentro de una ventana de 6 meses.
  Confianza **media**: el número es de todos los rubros, no solo de pizza, aunque la pizza sea el 30%.
- **Cliente promedio: pide cada ~30 días o más.** CivicScience dice que solo ~3 de cada 10 adultos piden
  pizza al menos una vez por mes, y eso es la frecuencia de toda la categoría. Hacia un local en particular
  el intervalo es igual o más largo. Restolabs también: 3,2 pedidos por cliente en un año, y solo el 38,2%
  repite en 6 meses. Confianza **media**.
- **Distribución:** muy asimétrica. Hay un núcleo semanal (8–31% según la encuesta y según se mida
  «pedir» o «comer») y una cola larga de clientes que piden «algunas veces por año» (el 79% acumulado de
  CivicScience).
- No hay ningún número de **salón** separado de delivery/retiro. Todos los datos primarios son de pedidos
  online o de la categoría en general.

## 2) Definiciones de la industria

| Estado | Días | Quién lo dice | Tipo |
|---|---|---|---|
| Momento de reenganche | **día 7–10** después de la compra | Restolabs: «re-engage customers who haven't ordered in 7–10 days» | [P→recomendación] derivado de su mediana de 8,9 días |
| En riesgo de abandono («churn risk») | **30+ días** | Restolabs: día 30+ = «Churn risk», con «aggressive re-engagement» | Recomendación de un proveedor apoyada en su dataset |
| Inactivo («lapsed») | **30+ días** | Restolabs, blog de marketing para pizzerías: «Win-back campaign for lapsed customers (30+ days inactive)» | [O] |
| Segmentos de reactivación | 30 vs 90 días | Paytronix, blog de ROI de fidelización (el texto viene del resumen del buscador, sin fetch propio): distingue «slowing down», «lapsing», «lapsed» | [O] |
| Inactivo o perdido, para campañas de recuperación | **3–6 meses** | FoodTec Solutions, POS específico de pizzerías: «customers who haven't ordered in 3-6 months» | [O] |

En resumen: los proveedores del rubro coinciden en tres umbrales, **~7–10 días** (primer empujón),
**30 días** (en riesgo / inactivo) y **90–180 días** (perdido, candidato a recuperación). Ninguno publica
un umbral de «irrecuperable».

## 3) Retención

- **38,2%** de los clientes hizo más de un pedido dentro de una ventana de 6 meses. Es el único dato de
  «% que vuelve» que encontré. [P] Restolabs, mismos 4M pedidos, multi-rubro.
- **No encontré**: % que vuelve por segunda vez medido por separado, % retenido a 90 días ni curvas de
  cohorte específicas de pizzerías.
- Contexto que no es de retención pero sí de peso: el loyalty de Papa John's explica «nearly half» de las
  transacciones de la cadena (resumen del buscador de Restaurant Business y Yahoo Finance; los fetches
  directos dieron 403, así que **no está verificado**).

## 4) Particularidades del rubro

- **Día de la semana (fuerte):** «Friday is by far the most common day of the week people report ordering
  pizza (43%)… Saturday is the next most common day at 19%» [P] CivicScience. Implicancia para el motor:
  el push de pizzería conviene mandarlo **jueves o viernes antes de la cena**, no el día exacto en que
  vence la etapa.
- **Canal:** 60,1% retiro y 39,9% delivery en la plataforma Restolabs [P]. Es un rubro de pedido más que
  de visita al salón. Si el pase se sella solo en el mostrador, se van a perder visitas por delivery de
  terceros (Rappi/PedidosYa), y el cliente va a parecer inactivo sin estarlo. Esto es una inferencia mía
  sobre el producto, no un dato.
- **Familias:** 26% de quienes tienen hijos come pizza cerca de una vez por semana, contra 17% de quienes
  no tienen [P] CouponFollow.
- **Saturación:** según el resumen del buscador, un material de Slice advierte que el exceso de mensajes
  «drives churn as high as 75% within 90 days». **No lo verifiqué con fetch; tomarlo como [O] no
  confirmado.** Es un argumento para cadencias más espaciadas.
- **Argentina:** el único dato es cualitativo. Forbes Argentina dice «Argentina is the country in the world
  with the most pizzerias per capita», sin cifras de frecuencia. **No encontré** encuestas de frecuencia
  argentinas ni de LatAm (APYCE no apareció).
- **Estacionalidad (meses):** **no encontré** datos citables. No se asume nada.

## 5) Escalera propuesta

| Etapa | Valor | Justificación | Confianza |
|---|---|---|---|
| Te extrañamos, opción A | **día 14** | ~1,5× la mediana de 8,9 días del cliente habitual (Restolabs). Queda después de la ventana de 7–10 días que recomienda el proveedor, así que no molesta a quien pide cada semana o cada dos | media |
| Te extrañamos, opción B | **día 21** | Para locales con clientela de frecuencia mensual (el ~30% «al menos una vez por mes» de CivicScience). Deja un solo recordatorio antes de pasar a «En riesgo» | baja-media |
| En riesgo: R | **día 30** | El umbral que repiten dos proveedores del rubro (Restolabs «Churn risk» 30+, «lapsed 30+ days») | media |
| En riesgo: cadencia X | **cada 20 días** (30, 50, 70) | Acompaña la frecuencia mensual del cliente promedio sin llegar a mensajes quincenales. La advertencia de saturación de Slice (no verificada) empuja a espaciar. Es criterio mío, sin dato directo | baja |
| Perdido: P | **día 90** | Límite inferior de la ventana «3–6 months» de FoodTec, y corte de 90 días de Paytronix | media |
| Perdido: 4 mensajes | **91, 105, 151, 181** (P+1, +14, +60, +90) | Igual que en la cafetería. El último cae en ~6 meses, el borde superior de la ventana de recuperación de FoodTec. No encontré evidencia para otra forma de repartirlos | baja-media |
| Irrecuperable | **día ~181** | Pasados los 6 meses ya no hay proveedor del rubro que siga tratando al cliente como recuperable. Hay que tener en cuenta que la cola «algunas veces por año» (CivicScience) incluye a gente que vuelve sola cada 4–6 meses | baja-media |

Con los datos, la escalera de pizzería queda **casi igual a la referencia de cafetería en el tramo
«Perdido»**. Donde difiere es **al principio**: «Te extrañamos» arranca en 14/21 y no en 7/14, porque el
cliente promedio de pizza pide aproximadamente una vez por mes y no cada pocos días. Además, la cadencia
de «En riesgo» es más corta (20 contra 21, prácticamente igual).

## 6) Lo que no se encontró (declarado)

- Frecuencia de clientes de Domino's o Papa John's en documentos para inversores: las búsquedas no la
  mostraron, el 10-K FY2024 de Domino's no la trae en lo que se leyó, y QSR Magazine, Restaurant Business y
  Meat+Poultry devolvieron 403.
- Statista «Order frequency from pizza restaurants in the U.S. 2023» (n=1.057, Q1 2023): está detrás del
  paywall; los porcentajes no se leyeron.
- Datos de Slice, Toast y PMQ con muestra sobre intervalos o umbrales de inactividad: no aparecieron.
- Toda cifra argentina o latinoamericana de frecuencia, retención o estacionalidad.
- Mediana de intervalo **solo de pizza** (el 8,9 es multi-rubro), separada por salón y delivery.
- % de retención a 90 días y % de segunda visita.
- Estacionalidad mensual.

## 7) Fuentes

1. Restolabs, *Online Ordering Report 2025–2026*. https://www.restolabs.com/lp/online-ordering-report
   - «The median interval between repeat orders is 8.9 days»
   - «38.2% of customers placed more than one order within a 6-month lookback window»
   - Muestra: 4M+ pedidos, 479 marcas, 2.126 locales, marzo 2025 – marzo 2026, 10+ países (mayoría EE.UU.)
   - Pizza: «1.35M orders — nearly 30% of all platform volume»
   - «60.1% of orders are fulfilled via pickup»; 3,2 pedidos por cliente
   - Día 30+: «Churn risk» → «Aggressive re-engagement: automated email or push notification with a
     stronger discount or free-item offer for lapsed customers»
   - Resumen del buscador de la misma página: «re-engage customers who haven't ordered in 7–10 days»
2. CivicScience, *Demand for pizza delivery on the decline…* (22-05-2023).
   https://civicscience.com/demand-for-pizza-delivery-on-the-decline-plus-more-pizza-industry-insights/
   - «79% of U.S. adults order pizza at least a few times a year, and 8% report ordering at least once a week.»
   - «Friday is by far the most common day of the week people report ordering pizza (43%). Unsurprisingly,
     Saturday is the next most common day at 19%.»
3. CivicScience, *How Americans Order Pizza Today* (10-02-2026).
   https://civicscience.com/how-americans-order-pizza-today-trends-for-marketers/
   - «about 3 in 10 U.S. adults telling CivicScience they order pizza at least once a month»
4. CouponFollow, *National Pizza Study* (n=1.026, 12–13 ene 2020). https://couponfollow.com/research/national-pizza-study
   - «70% of Americans eat pizza at least a few times a month, with 31% admitting to eating it once a week or more.»
   - «26% of Americans with children said they eat pizza about once a week, compared to 17% of Americans with no children.»
5. Brisan Group (2020). https://brisangroup.com/food-industry-thoughts-articles/how-consumers-are-eating-pizza
   - «Approximately, 60% of consumers reported eating frozen or delivery pizza once per week to 2-3 times per month.»
6. FoodTec Solutions (POS de pizzerías), 21-07-2025.
   https://foodtecsolutions.com/blog/2025/07/21/how-to-win-back-customers-who-havent-ordered-from-your-pizzeria-in-months/
   - «customers who haven't ordered in 3-6 months» [O]
7. Restolabs, blog de marketing para pizzerías. https://www.restolabs.com/blog/top-pizza-restaurant-marketing-ideas
   - «Win-back campaign for lapsed customers (30+ days inactive)» [O]
8. Paytronix, *Restaurant Loyalty Program ROI*. https://www.paytronix.com/blog/restaurant-loyalty-program-roi-guide
   - Según el resumen del buscador, sin fetch: la segmentación entre «slowing down», «lapsing» y «lapsed», y
     la diferencia entre un cliente de 30 días y uno de 90 días. [O, no verificado]
9. Slice. https://slice.com/products/marketing-for-pizza-shops/
   - Según el resumen del buscador, sin fetch: «win-back offers for customers who haven't ordered in a
     while»; el exceso de mensajes «drives churn as high as 75% within 90 days». [O, no verificado]
10. Forbes Argentina. https://www.forbesargentina.com/lifestyle/la-reconversion-pizza-argentina-sector-ya-tiene-limites-n33827
    - «Argentina is the country in the world with the most pizzerias per capita» (cualitativo)
11. Statista (paywall, no leído). https://www.statista.com/statistics/1414399/pizza-restaurant-order-frequency-us
