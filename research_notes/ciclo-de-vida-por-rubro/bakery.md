# Ciclo de vida del cliente — Panaderia (`gcid:bakery`)

Investigacion: 2026-09-29. Presupuesto usado: ~22 busquedas/fetches (se paso levemente del tope de ~20).
Leyenda de tipo de fuente: **[P]** dato primario (encuesta con muestra, datos de POS, default de producto documentado) ·
**[V]** afirmacion de proveedor sin metodologia · **[B]** blog/opinion · **[NV]** visto solo en un resumen de buscador, NO verificado en la fuente (no se usa para decidir).

---

## 1) Intervalo de visita

No se encontro ningun dato de **dias entre visitas medido en POS** para panaderias (ni mediana ni distribucion). Lo que hay son
encuestas de **frecuencia de compra/consumo de pan**, que son un proxy del intervalo:

| # | Dato | Intervalo implicito | Tipo | Fuente |
|---|------|---------------------|------|--------|
| 1 | Argentina: «77% de los argentinos lo consume diariamente o al menos una vez por semana» (Puratos Taste Tomorrow 2019, >400 encuestados en AR) | ≤ 7 dias para ~3/4 de la poblacion (es consumo, no visita a UNA panaderia) | [P] | Revista Mercado / Infobae |
| 2 | Argentina: «los argentinos, en un 67%, compran el pan en panaderías, contra un 29% que lo adquiere "recién horneado" en los supermercados» | la panaderia de barrio es el canal dominante del proxy anterior | [P] | Revista Mercado |
| 3 | España: «El 40% de los entrevistados se compra una barra de pan al día, como media» (Innograin, dic-2020/feb-2021, n=432) | ~1 dia para el comprador diario; otro 16% compra 3-4 barras por semana (~2 dias) | [P] | pandecalidad.com |
| 4 | Proveedor de fidelizacion: «Daily or near-daily customers» llenan «a 10-stamp card in 2-3 weeks, compared to 3-6 months for restaurants» | habitual: 10 visitas en 14-21 dias → **~1,5-2 dias entre visitas** | [V] | FaveCard |
| 5 | Square define «regular» como una relacion con transacciones «on four or more distinct dates within a year» | umbral muy bajo (≤ 91 dias promedio); no es una medida del rubro | [P] (definicion metodologica) | Square 2026 Local Economy Report |
| — | Mexico: «37% tres veces por semana, 24,2% diario, 19% dos veces por semana» | ~2-3 dias | **[NV]** — aparece en resumen de buscador atribuido a blog.europan.mx; al abrir la pagina el dato NO estaba. No se usa. | — |
| — | EE.UU., panaderia dentro de supermercado: «about once per month, or about 12 times per year» (FMI Power of In-Store Bakery) | ~30 dias | **[NV]** — el post de FMI abierto solo dice «purchase frequency (+3.6%)». No se usa. | — |

**Lectura:** el cliente **habitual** de una panaderia de barrio compra entre **diario y 2-3 veces por semana (intervalo 1-3 dias)**;
un segmento grande compra **semanal** (fin de semana: facturas/medialunas del domingo — esto ultimo es inferencia, sin fuente).
El cliente **promedio** de una panaderia puntual no tiene dato: el 77% semanal-o-mas es consumo de pan en general, repartido
entre panaderias y supermercado. Estimacion (confianza baja): cliente promedio 7-14 dias.

## 2) Definiciones de la industria (riesgo / lapsed / perdido)

| Proveedor | Definicion | Tipo |
|-----------|-----------|------|
| **Square** (grupos automaticos del Customer Directory, default para todo rubro) | Regulars: «customers who've visited your business three times in the last six months». Lapsed: «customers who were regulars, but haven't visited in the last six weeks» → **lapsed = 42 dias** sin visita | [P] default documentado |
| Square (comunidad, respuesta de usuario) | «Set your timeframe (e.g., 60 days without a purchase)» — el win-back es configurable | [B] |

No se encontro ninguna definicion **especifica de panaderia** de «en riesgo» o «perdido» en dias (ni Square, ni Toast, ni proveedores
LatAm). FaveCard (proveedor con pagina para panaderias) **no** define lapsed/win-back en dias.

## 3) Retencion y benchmarks

- Square (POS EE.UU. 2019-2025 + encuesta n=994): «regular customers generate six times more revenue for local businesses than more transient shoppers» [P].
- Motivos para volver (misma encuesta): «proximity to their homes» 56%; «discounts, deals, or loyalty programs» 37% [P]. La cercania pesa mas que el programa: un cliente que se muda o cambia de recorrido se pierde rapido.
- Square QSR: «loyalty members spend 40% more per visit and visit 64% more often than non-members» (estudio de >450 decisores, no de panaderias) [V].
- **% que vuelve por segunda vez / % retenido a 90 dias en panaderia fisica: NO ENCONTRADO.** Los numeros que aparecen («30-40% de repeticion a 3 meses») son de blogs de panaderias caseras/por encargo, sin muestra [B] — no se usan.

## 4) Particularidades del rubro

- **Frecuencia altisima y compra de proximidad**: es de los rubros con intervalo mas corto (fuentes 1, 3, 4). Consecuencia: una ausencia de 1-2 semanas en un habitual ya es señal, mucho antes que en un cafe de visita semanal.
- **Segmento semanal (fin de semana)**: el 77% es «diario **o al menos una vez por semana**»; si el primer aviso cae ≤ 7 dias, le escribe «te extrañamos» a un cliente semanal sano. Por eso el primer valor arranca en 8, no en 5.
- **Sustitucion facil**: 29% compra pan en supermercado (fuente 2); ademas la gente congela pan (Argentina: «el 26% almacena pan semanalmente en su congelador», Mercado/Puratos) → hay ausencias cortas «normales» por stock en casa.
- **Estacionalidad (sin fuente con numeros, declarado como hipotesis):** picos en Pascua (rosca) y Navidad (pan dulce); vacaciones de enero/febrero en Argentina pueden producir ausencias de 2-4 semanas en clientes sanos. No se encontro dato cuantitativo. Recomendacion de producto: no bloquear, pero el comercio deberia poder pausar el motor en su propio cierre por vacaciones.
- **Contexto 2024-2026**: titulares de caida del consumo de pan en Argentina (Ambito: «se consume menos pan, lácteos y carnes»; Perfil: en las panaderias «desaparecieron los jubilados»). Solo se vieron los titulares; no se extrajeron numeros. Implica frecuencia a la baja respecto de 2019.

## 5) Escalera propuesta

| Etapa | Valor | Justificacion | Confianza |
|-------|-------|---------------|-----------|
| Te extrañamos — opcion A | **8 dias** | Un ciclo semanal + 1 dia de gracia: no molesta al cliente semanal sano (77% «al menos una vez por semana») y para un habitual de 1-3 dias ya son 3-8 visitas salteadas (fuentes 1, 3, 4). Para panaderias con clientela diaria. | media |
| Te extrañamos — opcion B | **15 dias** | Dos ciclos semanales salteados. Para panaderias/pastelerias de clientela de fin de semana. | media-baja |
| Cadencia de Te extrañamos | igual al valor elegido (8 → dias 8, 16, 24; 15 → dia 15) | Regla del motor. Con A son 3 mensajes antes de R; aceptable porque el habitual visita cada 1-3 dias. | media |
| En riesgo — R | **30 dias** | ~4 ciclos semanales sin comprar; queda por debajo del «lapsed» generico de Square (42 dias), correcto para un rubro mas frecuente que el promedio de Square. | media |
| En riesgo — cadencia X | **cada 14 dias** (dias 30, 44) | Dos avisos antes de P; mas corto que el cafe (21) porque el ciclo base es mas corto. | baja |
| Perdido — P | **60 dias** | ≈ 1,4× el lapsed de Square (42 d). Dos meses sin comprar pan en la panaderia de barrio, con la proximidad como motivo #1 de regreso (56%), indica que cambio de panaderia/recorrido. | baja-media |
| Perdido — 4 mensajes | **61, 75, 121, 151** (P+1, +14, +60, +90 desde el primero) | Se mantiene la forma del cafe (+14/+60/+90), desplazada a P=60. No hay dato especifico de win-back en panaderias para ajustar los intervalos internos. | baja |
| Irrecuperable | **~151 dias** (tras el 4.º mensaje) | ~5 meses sin comprar un producto de compra diaria/semanal. Sin dato directo. | baja |

Comparacion con la referencia de cafe: todo se comprime ~1/3 (R 30→30 igual, P 90→60, Irrecuperable 181→151), porque el intervalo
habitual de panaderia (1-3 dias) es igual o mas corto que el de cafe. R no se baja de 30 para no castigar ausencias por vacaciones/pan congelado.

## 6) Lo que NO se encontro (declarado)

- Mediana/promedio/distribucion de **dias entre visitas** medida en POS para panaderias (Square, Toast, Fudo, etc.). Ninguna fuente publica.
- Dato argentino de **frecuencia de visita a una misma panaderia** (el de Puratos es consumo de pan en general).
- Definicion de «en riesgo» o «perdido» en dias propia del rubro por algun proveedor.
- % que vuelve por segunda vez y % retenido a 90 dias para panaderias fisicas.
- Estacionalidad cuantificada (Pascua, Navidad, vacaciones).
- El dato de Mexico (37% tres veces/semana) y el de FMI (compra mensual en in-store bakery) no pudieron verificarse en la fuente; quedan fuera.
- El documento de Innograin (fuente 3) no menciona explicitamente el pais en lo leido; se asume España por el contexto del sitio.

## 7) Fuentes

1. Revista Mercado, «Los argentinos y su relación con el pan» (Puratos Taste Tomorrow 2019, publicado 8-ene-2020) — https://mercado.com.ar/marketing/los-argentinos-y-su-relacion-con-el-pan/ — «77% de los argentinos lo consume diariamente o al menos una vez por semana»; «los argentinos, en un 67%, compran el pan en panaderías, contra un 29% que lo adquiere "recién horneado" en los supermercados»; «en la Argentina el 26% almacena pan semanalmente en su congelador». [P]
2. Infobae, Día del Panadero (2021) — https://www.infobae.com/tendencias/2021/08/04/dia-del-panadero-el-77-de-los-argentinos-lo-consume-de-forma-diaria-o-al-menos-una-vez-por-semana/ — «el 77% de los argentinos lo consume de forma diaria o al menos una vez por semana»; encuesta Taste Tomorrow en 40 paises, >400 consumidores en Argentina. [P]
3. Pan de Calidad / Innograin, «Hábitos de consumo y percepción de los consumidores» — https://pandecalidad.com/habitos-de-consumo-y-percepcion-de-los-consumidores — «El 40% de los entrevistados se compra una barra de pan al día, como media»; «62% de los encuestados compra el pan en panaderías principalmente». n=432, dic-2020 a feb-2021. [P]
4. FaveCard, Bakery Loyalty Cards — https://www.favecard.co/en/solutions/bakeries/ — «Daily or near-daily customers» … «a 10-stamp card in 2-3 weeks, compared to 3-6 months for restaurants». Sin metodologia. [V]
5. Square Support, «Create customer groups and filters» — https://squareup.com/help/us/en/article/6245-manage-customer-groups-and-filters — Regulars: «customers who've visited your business three times in the last six months»; Lapsed: «customers who were regulars, but haven't visited in the last six weeks». [P]
6. Square, 2026 Local Economy Report (press) — https://squareup.com/us/en/press/2026-local-economy-report — «A buyer-seller relationship was considered to be 'regular' if there were transactions between them on four or more distinct dates within a year.» Datos ene-2019 a dic-2025; encuesta n=994. [P]
7. Digital Transactions sobre el mismo reporte — https://www.digitaltransactions.net/squares-pos-data-pinpoint-the-value-of-regular-customers/ — «regular customers generate six times more revenue for local businesses than more transient shoppers»; motivos: «proximity to their homes» 56%, «discounts, deals, or loyalty programs» 37%. (Menciona que las panaderias siguen a los cafes en cantidad de regulares, pero la frase textual no se pudo confirmar.) [P, via prensa]
8. Square, Scaling QSR Loyalty — https://squareup.com/us/en/the-bottom-line/reaching-customers/scaling-qsr-loyalty — «loyalty members spend 40% more per visit and visit 64% more often than non-members». [V]
9. Square Community, «Winback lapsed customers» — https://community.squareup.com/t5/Square-Marketing/Winback-lapsed-customers/m-p/807680 — «Set your timeframe (e.g., 60 days without a purchase)». [B]
10. Titulares de contexto (solo titular leido): Ambito — https://www.ambito.com/economia/la-crisis-la-mesa-los-argentinos-se-consume-menos-pan-lacteos-y-carnes-n6026710 ; Perfil — https://www.perfil.com/noticias/economia/consumo-en-crisis-en-las-panaderias-desaparecieron-los-jubilados-y-ya-hay-mas-gente-pidiendo-al-final-del-dia-que-comprando-a40.phtml
