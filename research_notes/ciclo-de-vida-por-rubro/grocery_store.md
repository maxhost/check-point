# Ciclo de vida del cliente — Tienda de abarrotes / almacen de barrio (`gcid:grocery_store`)

Fecha: 2026-09-29. Presupuesto usado: ~20 busquedas/fetches. Tipo de fuente marcado en cada dato:
**[PRIMARIO]** = estudio/panel/proveedor con muestra declarada; **[PRENSA de primario]** = nota de prensa
que cita un estudio que no pude abrir; **[BLOG/PROVEEDOR]** = opinion o cifra sin metodologia.

> Advertencia de lectura que atraviesa todo el informe: casi todos los numeros de frecuencia miden
> **visitas del hogar al CANAL** (todos los almacenes, o todos los supermercados), no **visitas de un
> cliente a UN comercio**. El motor mide lo segundo. Un hogar que va "al almacen cada 4 dias" puede
> repartir esas visitas entre 2 o 3 almacenes, asi que el intervalo por comercio es mas largo que el del canal.

## 1) Intervalo de visita

| # | Dato | Alcance | Tipo |
|---|------|---------|------|
| 1 | Hogar colombiano visita tiendas de barrio **cada 4 dias, 91 veces al año**; 99% de los hogares las visita; 4 unidades por ocasion | Canal, LatAm (Colombia), 2022 | PRIMARIO (Kantar Worldpanel, panel de hogares) |
| 2 | EE.UU.: **1,6 viajes individuales por semana** (≈ cada 4,4 dias); hogares **2,8 viajes/semana** (≈ cada 2,5 dias) | Canal (todas las tiendas de alimentos), n=2.023, feb-2026 | PRIMARIO (FMI U.S. Grocery Shopper Trends 2026) |
| 3 | Argentina: **54%** va a minimercados **al menos una vez por semana**; solo 11% va a un mayorista semanalmente | Canal, n=350, jun-2025 | PRENSA de primario (IPSOS, Observatorio del Shopper Argentino) |
| 4 | Argentina: **62%** compra para una semana, **16%** repone a diario, 18% compra para un mes | Habito de compra, sin n declarado, may-2025 | PRENSA de primario (Focus Market para Naranja X) |
| 5 | EE.UU., **por cadena**: solo **21,2%** de los visitantes de Aldi hace **3+ visitas en un mes promedio** (14,3% en Trader Joe's) | UN comercio/cadena, H1-2026 | PRIMARIO (Placer.ai, datos de movilidad) |
| 6 | Argentina: el 46% de quienes compran guiados por precio prefiere tiendas de cercania "y lo hace de manera diaria" | Preferencia declarada | PRENSA de primario (Infobae) |

**Lectura:**
- **Cliente habitual de almacen** (el que el comercio conoce): visita **cada 2 a 4 dias** a nivel canal
  (datos 1, 2, 6). Para su almacen principal, razonablemente **1 a 3 veces por semana**. Confianza **media**:
  ningun dato mide un almacen argentino individual.
- **Cliente promedio de un comercio**: el dato 5 es el unico a nivel tienda y muestra que ~79% de los visitantes
  de una cadena de alimentos va **2 veces o menos por mes** → intervalo tipico por comercio de **~1 a 2 semanas**
  (inferencia mia, no cita). En un almacen de barrio la cercania deberia acortarlo, pero no encontre dato que lo pruebe.
- **Distribucion**: bimodal segun los datos 3–4: un segmento de reposicion diaria (16%) y un grueso semanal (62%),
  mas una cola mensual (18%) que usa el almacen como complemento del mayorista/super.

## 2) Definiciones de la industria (riesgo / inactivo / perdido)

- **Unico numero especifico de alimentos encontrado**: *"a customer who hasn't purchased in 60 days is meaningfully
  lapsed"* para marcas de compra semanal o quincenal — BOOM Group. **[BLOG/PROVEEDOR]**, sin muestra.
- Mismo proveedor, criterio cualitativo: riesgo = recencia "falling behind the typical pattern"; lapsed =
  "fallen significantly below the typical pattern". No da multiplos.
- Umbrex (consultora): 90 dias de riesgo para **belleza mensual** — no aplica a almacen, sirve solo como contraste
  de que el umbral escala con el ciclo del rubro. **[BLOG/PROVEEDOR]**
- Kantar Colombia mide el abandono como **perdida de frecuencia** del canal tradicional (−12% a largo plazo), no
  como dias de inactividad. **[PRIMARIO]**
- **No encontre** definiciones en dias de POS/CRM de almacen (ni LatAm ni EE.UU.) ni de dunnhumby/Tesco.

## 3) Retencion

- Birdzi (proveedor de fidelizacion para supermercados): *"A healthy retention rate in grocery retail typically falls
  between 60% and 80%"*. **[BLOG/PROVEEDOR]**, sin definicion de ventana ni muestra.
- Envive AI via Sender: tasa de recompra "Grocery & food delivery" **65,2%** — es **e-commerce**, no tienda fisica.
  **[BLOG/PROVEEDOR]**
- Kantar Worldpanel Argentina (via Infobae): la **frecuencia de visita a las tiendas cayo 5,4%** en el 1er trimestre
  de 2026; NielsenIQ: transacciones −9% en 2025. **[PRENSA de primario]** — contexto: el cliente argentino esta
  espaciando visitas, lo que empuja a no disparar alertas demasiado pronto.
- **No encontre** "% que vuelve por segunda vez" ni "% retenido a 90 dias" medido en almacenes o supermercados
  fisicos con muestra.

## 4) Particularidades del rubro

1. **Multi-tienda estructural**: el cliente reparte la compra (almacen para reponer, mayorista/super para el
   grueso — dato 3). Una ausencia de 7 dias puede ser una semana de "compra grande" en otro canal, no un abandono.
2. **Frecuencia alta** → la escalera tiene que ser **mucho mas corta** que la del cafe en Riesgo/Perdido, pero el
   primer aviso no puede ser mas corto que ~1 semana sin volverse ruido para el comprador semanal (62%).
3. **Contexto argentino de consumo en baja** (Kantar −5,4% frecuencia 1T-2026): intervalos alargandose.
4. **Estacionalidad**: no encontre datos citables. Hipotesis **sin fuente** a validar con datos propios: vacaciones
   de enero (el hogar se va 1–3 semanas → falso "Te extrañamos"/"En riesgo") y efecto cobro de sueldo a principio
   de mes. El paper de arXiv 2608.18174 advierte en general que las etiquetas de abandono basadas en ventanas
   *"fire on seasonal descent and heal on seasonal ascent"* — argumento para que Irrecuperable no caiga antes de
   que pase una temporada de vacaciones.

## 5) Escalera propuesta

| Etapa | Valor | Justificacion | Confianza |
|---|---|---|---|
| Te extrañamos — opcion A | **7 dias** | Cliente habitual (cada 2–4 dias, datos 1, 2, 6): 7 dias = 2–3 ciclos perdidos. No baja de 7 porque el 62% compra semanal (dato 4). | media |
| Te extrañamos — opcion B | **14 dias** | Cliente promedio por comercio (~1–2 semanas, dato 5): 14 dias = al menos un ciclo perdido; comercio con clientela mixta almacen+mayorista. | media |
| Cadencia de Te extrañamos | 7 o 14 (la elegida) | Regla del motor. Con A se manda en 7, 14, 21, 28; con B en 14, 28. | — |
| En riesgo: R | **30 dias** | 4+ semanas sin venir = ~4 ciclos semanales perdidos; mitad del umbral "meaningfully lapsed" de 60 dias (BOOM). | media-baja |
| En riesgo: cadencia X | **cada 14 dias** (30, 44) | Dos toques antes de Perdido; mas corto que los 21 del cafe porque el rubro es mas frecuente. | baja |
| Perdido: P | **60 dias** | Unico umbral citado para compra semanal/quincenal: 60 dias "meaningfully lapsed" (BOOM, blog de proveedor). | media-baja |
| Perdido: 4 mensajes | **dias 61, 75, 90, 120** (P+1, +14, +29, +59 desde el primero) | Compresion de la escalera del cafe (+1/+14/+60/+90) proporcional al ciclo mas corto; el ultimo a los 4 meses cubre una temporada de vacaciones de enero completa. | baja |
| Irrecuperable | **~121 dias** | Un cliente de almacen de barrio que no vuelve en 4 meses probablemente se mudo o cambio de almacen; ninguna fuente lo mide. | baja |

Nota de diseño: los numeros de 1 y 2 son de **canal**; si el motor ya tiene visitas reales por comercio, la
mejor calibracion es la mediana del intervalo entre visitas de los clientes con 3+ visitas (habitual) y la de
todos (promedio), y fijar Te extrañamos ≈ 2× mediana, R ≈ 4–5×, P ≈ 8–10×. Eso es criterio mio, no de una fuente.

## 6) Lo que no se encontro (declarado)

- Intervalo entre visitas **a un almacen individual** en Argentina/LatAm (solo hay datos de canal).
- Definiciones en dias de riesgo/lapsed/perdido de **POS o CRM de almacenes** (ni LatAm ni EE.UU.). El 60 dias es
  de un blog de proveedor sin muestra.
- % de segunda visita y % retenido a 90 dias en almacen fisico.
- Estacionalidad medida del canal almacen en Argentina (vacaciones, cobro de sueldo): queda como hipotesis.
- Datos de Scentia con frecuencia absoluta (solo encontre variaciones de volumen). La FMI 2024 esta tras paywall;
  use la 2026.

## 7) Fuentes

1. Kantar Worldpanel Colombia (2022) — PRIMARIO — https://www.kantar.com/latin-america/inspiracion/retail/2022-co-todos-los-hogares-siguen-visitando-tiendas-de-barrio
   - «en el ultimo año un hogar colombiano visita en promedio este canal cada 4 días; es decir 91 veces en un año»
   - «en el último año en promedio el 99% de los hogares en Colombia visitan las tiendas de barrio»
   - «lleva en promedio 4 unidades por ocasión»
2. FMI, U.S. Grocery Shopper Trends 2026 — PRIMARIO — https://www.fmi.org/newsroom/news-archive/view/2026/05/20/fmi-s-signature-research-examines-the-evolving-physical-store-experience
   - «Americans make 1.6 individual grocery shopping trips per week, with men making 1.6 trips and women making 1.5 trips.»
   - «In total, American households make 2.8 grocery shopping trips per week.»
   - «a nationally representative survey fielded February 4-18, 2026, of 2,023 respondents»
3. Placer.ai (H1 2026) — PRIMARIO (movilidad) — https://www.placer.ai/anchor/articles/aldi-and-trader-joes-take-different-roads-to-growth-in-2026
   - «More than one-fifth (21.2%) of Aldi visitors made three or more visits in an average month, compared with 14.3% for Trader Joe's.»
4. Perfil / IPSOS Observatorio del Shopper Argentino (jun-2025, n=350) — PRENSA de primario — https://www.perfil.com/noticias/nea/como-compran-los-argentinos-mas-visitas-al-minimarket-y-compras-grandes-en-mayoristas.phtml
   - «54% que va a minimarkets con esa frecuencia» [semanal]; «el 11% de los encuestados visita un mayorista al menos una vez por semana»
5. Los Andes / Focus Market para Naranja X (may-2025) — PRENSA de primario — https://www.losandes.com.ar/economia/seis-cada-diez-argentinos-compra-alimentos-una-vez-semana-n5947986
   - «el 62% compra lo que necesita para una semana» (18% mensual, 16% reposicion diaria, 4% varios meses)
6. Infobae (jun-2026) citando Worldpanel by Numerator y NielsenIQ — PRENSA de primario — https://www.infobae.com/economia/2026/06/02/compras-mas-chicas-menos-visitas-al-super-y-mas-descuentos-asi-cambio-el-consumo-argentino-segun-un-informe-privado/
   - «la frecuencia de visita a las tiendas cayó 5,4% en el primer trimestre»
   - «las transacciones bajaron 9% durante 2025»
   - «el 46% de quienes compran guiados por el precio prefiere tiendas de cercanía y lo hace de manera diaria»
7. Kantar Worldpanel Colombia (2023) — PRIMARIO — https://www.kantar.com/latin-america/Inspiracion/Consumidor/2023-WP-CO-Que-esta-pasando-con-el-canal-tradicional
   - «el canal Tradicional se enfrenta a una pérdida de su frecuencia de compra en el largo plazo del 12%»
8. BOOM Group — BLOG/PROVEEDOR — https://www.boomgroup.com/post/how-to-reduce-retail-churn-identifying-lapsed-customers-and-winning-them-back
   - «a customer who hasn't purchased in 60 days is meaningfully lapsed» [compra semanal/quincenal]
   - «An at-risk customer is one whose purchase recency is falling behind the typical pattern for customers like them»
9. Umbrex — BLOG/PROVEEDOR — https://umbrex.com/resources/retail-industry-playbooks/retail-loyalty-program-design-optimization-playbook/loyalty-strategy-and-customer-economics/
   - «A monthly beauty buyer may be at risk after 90 days of inactivity.»
10. Birdzi — BLOG/PROVEEDOR — https://birdzi.com/measure-and-improve-shopper-retention-in-grocery-retail/
    - «A healthy retention rate in grocery retail typically falls between 60% and 80%»
11. Sender (citando Envive AI) — BLOG/PROVEEDOR, e-commerce — https://www.sender.net/marketing-glossary/repeat-purchase-rate/statistics/
    - «Grocery & food delivery repeat rate: 65.2%»
12. arXiv 2608.18174 (Islam y Mohammed) — paper — https://arxiv.org/html/2608.18174
    - «For a seasonal entity the two windows sit at different points of the seasonal cycle. The label therefore fires on seasonal descent and heals on seasonal ascent.»
