# Ciclo de vida del cliente — Rubro: Restaurante (`gcid:restaurant`)

Investigacion del 2026-09-29. Presupuesto: ~20 busquedas/fetches, agotado. Cada numero lleva su
fuente en la seccion 7. **Etiquetas:** [PRIMARIO] = dato de un proveedor o estudio con muestra
declarada; [PRODUCTO] = default o feature documentado por el proveedor en su propia pagina (no es
un estudio, pero es como la industria configura sus herramientas); [BLOG] = opinion o
generalizacion sin muestra; [NO VERIFICADO] = aparece en un snippet de busqueda pero no pude leerlo
en la pagina original.

Alcance: "restaurante" aca es **servicio de mesa / comida casual** (no cafeteria ni fast food, que
tienen su propia escalera). Es un rubro con alta varianza: hay un "habitual de barrio" que va
semanal y un comensal de ocasion (cumpleaños, salida) que va cada varios meses.

---

## 1) Intervalo de visita

No encontre **ningun** dato publico de "mediana de dias entre visitas al mismo restaurante" con
muestra declarada. Lo que hay son frecuencias declaradas y conteos de visitas por periodo, de los
que el intervalo se deriva (la derivacion es mia y se marca).

| # | Dato | Tipo | Intervalo implicito |
|---|------|------|---------------------|
| 1.1 | Toast (encuesta Pollfish, 1.500 adultos de EE.UU. que comen afuera ≥2 veces/mes, abril 2026): "37% of these regulars say that they visit their favorite spot at least once a week, and 40% say they are through the doors multiple times a week." | [PRIMARIO], autodeclarado, sesgado a la muestra de "regulars" | Habitual declarado: **≤7 dias** a su lugar favorito |
| 1.2 | Resy (reservas completadas en 7 ciudades de EE.UU., 2023–2025): regulars promediaron "8.3 reservations at an average of 1.45 restaurants over the three-year period" vs non-regulars "5.45 visits at an average of 2.4 restaurants." Regular = "three or more visits to the same venue" en esos 3 años. | [PRIMARIO], datos transaccionales | Derivado por mi: 8,3/1,45 ≈ **5,7 visitas por restaurante en ~1.095 dias → ~1 cada 190 dias** para un "regular" de reserva (mesa, gama media-alta). No-regular: ≈2,3 visitas/restaurante en 3 años. |
| 1.3 | Thanx (18,3 M transacciones, 10,3 M clientes, 54 marcas, 877 locales, 2014): "3-4% 'super loyal' who return monthly at minimum". | [PRIMARIO] | El nucleo super-leal vuelve **≤30 dias**; es solo el 3–4% de la base |
| 1.4 | Kantar Insights, Argentina, marzo 2025: "el 76% de los argentinos disminuyó su frecuencia de salidas a comer en el último año"; "un 42% todavía se da el gusto de salir a comer varias veces al mes o, incluso, una vez por semana". Preferencia: restaurantes casuales 61%. | [PRIMARIO] (encuesta; no se publica n en las notas) | Frecuencia de **salir a comer en general**, no al mismo local. Si el 42% sale "varias veces al mes", y reparte entre 2–3 lugares (Toast: "a mental shortlist of two or three places"), el intervalo al MISMO restaurante del cliente activo argentino ronda **2–6 semanas** (derivacion mia, confianza baja). |

**Lectura:** la distribucion es muy asimetrica (Toast: "just 7% of a business's guest base is
multi-visit, yet this cohort could generate up to 50% of the total order volume"). Un habitual va
semanal o quincenal; el cliente "promedio" de un restaurante de mesa vuelve cada varios meses o no
vuelve. En Argentina 2025 la frecuencia viene **bajando** (Kantar), lo que estira los intervalos.

## 2) Definiciones de la industria (en dias)

| Proveedor | Definicion | Tipo |
|-----------|-----------|------|
| SevenRooms (CRM de restaurantes) | "Lapsed and first-timer targeting: identify guests who haven't returned and trigger the right message at 30, 60 or 90 days." | [PRODUCTO] |
| Paytronix (fidelizacion de restaurantes) | "In restaurants and retail, 'churn' is when a regular customer hasn't transacted in 90+ days." | [PRODUCTO/BLOG del proveedor] |
| Paytronix | Caso: "A casual dining brand...reduced churn by 40% within a single quarter" interviniendo en la marca de **30 dias** de ausencia. | [BLOG del proveedor, caso sin muestra] |
| Square (Customer Directory) | Default "lapsed" = 3 compras en 6 meses y sin volver en las ultimas **6 semanas (42 dias)**, editable. | **[NO VERIFICADO]**: aparece en snippets de busqueda atribuido a Square; la pagina de Square que lo contendria no lo muestra hoy. No usar como cita dura. |
| Thanx | No publica umbral fijo: su winback predice churn con "nearly 40 data points, including spend and visit frequency compared to past behavior". | [PRODUCTO] — relevante: la industria madura mide ausencia **relativa al ritmo propio** del cliente. |

**Consenso:** tres escalones en **30 / 60 / 90 dias**, con **90 dias = perdido/churn**. Ningun
proveedor define "irrecuperable"; nadie publica cuando dejar de escribir.

## 3) Retencion / abandono

- Thanx (2014, 10,3 M clientes): "70% of previously loyal customers are 'at-risk' and unlikely to
  return"; "The top 25% contributing 64% of revenue"; "77% of customers visit only one location". [PRIMARIO]
- Paytronix Data Insights (2017): "it is 90% likely that those who visit a restaurant for the
  fourth time will continue to visit on a regular basis." No publica muestra ni el % de retorno
  tras la 1ª/2ª/3ª visita. [PRIMARIO, metodologia no divulgada]
- Toast Regulars Report 2026: "just 7% of a business's guest base is multi-visit, yet this cohort
  could generate up to 50% of the total order volume." [PRIMARIO, datos POS agregados Q1 2026]
- Paytronix: "For a restaurant, aim for a monthly attrition rate below 5%." [BLOG del proveedor]
- **No encontrado:** % que vuelve por segunda vez con cita primaria verificable, ni % retenido a
  90 dias.

## 4) Particularidades del rubro

- **Visita por ocasion:** en Argentina el principal motivo es socializar (66%) y celebraciones
  (33%; 44% entre 35–49) (Kantar 2025). Una parte de la base va solo en fechas: un cumpleaños al
  año no es un cliente "perdido" a los 90 dias.
- **Contexto argentino:** 76% redujo salidas; 85% en sectores de menores ingresos; motivos:
  precios 74%, esperas 41%, malas experiencias 30% (Kantar 2025). Intervalos mas largos que en
  EE.UU.; mensajes de descuento pesan mas.
- **Estacionalidad** (no cuantificada con fuente en este trabajo): fechas pico (Dia de la Madre,
  Dia del Padre, fiestas de fin de año, San Valentin) y vacaciones de enero/julio vacian la
  clientela urbana. Declarado como no medido.
- **Concentracion:** 2–3 lugares favoritos por comensal (Toast) → el "Te extrañamos" compite con
  pocos rivales conocidos; conviene llegar antes de que el hueco lo ocupe otro.

## 5) Escalera propuesta — Restaurante

| Etapa | Propuesta | Confianza |
|-------|-----------|-----------|
| Te extrañamos — opcion A | **14 dias** | media |
| Te extrañamos — opcion B | **30 dias** | media |
| En riesgo — arranque R | **45 dias** | media |
| En riesgo — cadencia X | **cada 21 dias** (45, 66, 87) | baja |
| Perdido — arranque P | **90 dias** | alta |
| Perdido — 4 mensajes | **91, 105, 151, 211** (P+1, +14, +60, +120 desde el primero) | baja |
| Irrecuperable | **~240 dias** (8 meses) | baja |

**Justificacion:**

- **Te extrañamos 14 (A):** para el restaurante de barrio/almuerzo con habituales semanales; Toast
  1.1 dice que el 77% de los regulars va al menos semanal a su favorito → dos semanas sin venir ya
  es el doble de su ciclo. **30 (B):** para el restaurante de salida/cena; coincide con el primer
  escalon de SevenRooms (30) y con el umbral de "super loyal" de Thanx (mensual). El 7 de la
  cafeteria es demasiado corto: casi ningun comensal de restaurante vuelve en una semana.
- **R = 45:** entre el escalon de 30 y el de 60 de SevenRooms; tambien cerca de las 6 semanas que
  se atribuyen a Square (no verificado). Con A=14 o B=30 deja al menos 2 semanas de "Te
  extrañamos" antes del riesgo.
- **X = 21:** tres toques (45, 66, 87) antes de Perdido; respeta que el escalon de 60 de SevenRooms
  quede cubierto. Confianza baja: la cadencia no la publica nadie.
- **P = 90:** es el umbral mas repetido y el unico con dos fuentes que lo nombran explicitamente
  (SevenRooms 90, Paytronix "90+ days"). Alta.
- **Mensajes 91 / 105 / 151 / 211:** mantengo la estructura del cafe en los tres primeros pero
  estiro el ultimo a +120 porque el restaurante tiene clientes de ocasion (celebraciones, Kantar) y
  un "regular" de reserva vuelve cada ~190 dias (derivado de Resy 1.2): un ultimo mensaje a los ~7
  meses alcanza la proxima ocasion anual del comensal de fecha fija. Baja.
- **Irrecuperable ~240:** ningun proveedor lo define; lo pongo 1 mes despues del ultimo mensaje y
  por encima del intervalo ~190 de Resy. Baja. **Alternativa conservadora:** 181 (igual que cafe)
  si el comercio es de almuerzo/barrio con opcion A=14.

**Recomendacion de producto (hallazgo, no decision):** dado que la industria madura (Thanx) mide
ausencia relativa al ritmo propio del cliente, y la varianza del rubro es alta, el restaurante es
el rubro donde mas pesaria una escalera relativa (p. ej. "2× su intervalo habitual"). Queda como
hallazgo a decidir.

## 6) Lo que no se encontro

- Mediana/promedio de **dias entre visitas al mismo restaurante** con muestra publica (ni EE.UU.
  ni LatAm). Toast, OpenTable y SevenRooms tienen el reporte ("Guest Frequency Report" de
  OpenTable) pero no publican benchmarks.
- % de primeros comensales que vuelven una segunda vez, con cita primaria leida (Paytronix tiene el
  grafico pero la nota de prensa no trae los valores).
- % retenido a 90 dias.
- Black Box Intelligence y Technomic: no encontre datos publicos de frecuencia por comensal
  (reportes pagos).
- Default de "lapsed" de Square: visto solo en snippets; no confirmado en pagina de Square.
- Estacionalidad cuantificada para Argentina.
- Un dato atribuido a Argentina 2019 (ABC1 sale a comer 2,9 veces/mes, C2 2,4, C3 1,6) aparecio en
  un snippet de busqueda pero no en las notas que abri (La Nacion, Fortuna, Ambito): **no usado**.

## 7) Fuentes

1. Toast / Resy — "Report: 7% of guests can drive up to 50% of restaurant order volume" (Stacker,
   sep 2026; el original en pos.toasttab.com/blog/data/regulars-report devolvio 403).
   https://kesq.com/stacker-business-economy/2026/09/05/report-7-of-guests-can-drive-up-to-50-of-restaurant-order-volume/
   - "37% of these regulars say that they visit their favorite spot at least once a week, and 40% say they are through the doors multiple times a week."
   - "just 7% of a business's guest base is multi-visit, yet this cohort could generate up to 50% of the total order volume."
   - Regular (Resy) = "a user with three or more visits to the same venue within Jan. 1, 2023, and Dec. 31, 2025."
   - "8.3 reservations at an average of 1.45 restaurants over the three-year period" / "5.45 visits at an average of 2.4 restaurants."
   - "a mental shortlist of two or three places where they feel at home."
   - Metodologia: datos POS agregados Toast Q1 2026; encuesta Pollfish de 1.500 adultos EE.UU. (2 abr 2026); reservas Resy en 7 ciudades 2023–2025.
2. SevenRooms — Marketing Automation. https://sevenrooms.com/platform/marketing-automation/
   - "Lapsed and first-timer targeting: identify guests who haven't returned and trigger the right message at 30, 60 or 90 days."
3. Paytronix — Customer Attrition Analysis. https://www.paytronix.com/blog/customer-attrition-analysis
   - "In restaurants and retail, 'churn' is when a regular customer hasn't transacted in 90+ days."
   - "For a restaurant, aim for a monthly attrition rate below 5%."
   - "A casual dining brand...reduced churn by 40% within a single quarter"
4. Thanx (PR Newswire, 2015, datos 2014). https://www.prnewswire.com/news-releases/study-finds-70-of-retail-and-restaurant-customers-never-make-a-return-visit-300027410.html
   - "70% of previously loyal customers are 'at-risk' and unlikely to return."
   - "3-4% 'super loyal' who return monthly at minimum"
   - "The top 25% contributing 64% of revenue"; "77% of customers visit only one location"
   - Muestra: 18,3 M transacciones, 10,3 M clientes, 54 negocios, 877 locales.
5. Paytronix Data Insights (GlobeNewswire, 2017). https://www.globenewswire.com/news-release/2017/02/16/949530/0/en/Paytronix-Data-Insights-Finds-Brand-Loyalty-Established-With-Fourth-Visit.html
   - "it is 90% likely that those who visit a restaurant for the fourth time will continue to visit on a regular basis."
6. Thanx Personalized Winback (Business Wire, 2019). https://www.businesswire.com/news/home/20191120005123/en/Thanx-Enhances-Machine-Learning-Platform-with-Personalized-Winback-to-Reduce-Churn-for-Restaurants-and-Retailers
   - "nearly 40 data points, including spend and visit frequency compared to past behavior" (cita tomada del resultado de busqueda; pagina no abierta).
7. Kantar Insights Argentina, marzo 2025 (via Ambito y La Nacion).
   https://www.ambito.com/informacion-general/salir-comer-se-convirtio-un-lujo-el-76-los-argentinos-redujo-sus-visitas-bares-y-restaurantes-n6146139
   https://www.lanacion.com.ar/economia/negocios/consumo-ajustado-la-crisis-achica-la-cuenta-pero-no-termina-con-el-habito-de-comer-afuera-nid23052025/
   - "el 76% de los argentinos disminuyó su frecuencia de salidas a comer en el último año"
   - "un 42% todavía se da el gusto de salir a comer varias veces al mes o, incluso, una vez por semana"
   - Motivos: precios 74%, esperas 41%, malas experiencias 30%; socializar 66%, celebraciones 33%; restaurantes casuales 61%.
8. [NO VERIFICADO] Square — default "lapsed" 3 compras/6 meses/6 semanas: solo en snippets de
   busqueda sobre https://squareup.com/us/en/the-bottom-line/reaching-customers/lapsed-email-best-practices ;
   la pagina leida no contiene esa definicion.
