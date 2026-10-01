# Ciclo de vida del cliente — Tienda de mascotas / pet shop (`gcid:pet_store`)

Investigacion: 2026-09-29. Presupuesto usado: ~20 busquedas/fetches. Marcas de fuente:
**[P]** = dato primario (estudio con muestra, filing regulatorio, panel); **[B]** = blog / opinion de
proveedor sin muestra publicada; **[C]** = calculo propio sobre datos citados.

Resumen: el pet shop es un rubro de **reposicion** — la visita la marca la bolsa de alimento
balanceado, no el antojo. El ciclo modal es **~4 semanas**, con una cola de compradores frecuentes
(semanal/quincenal, bolsas chicas) y una cola de "stock-up" (bolsas grandes, menos de una vez por mes).

---

## 1) Intervalo de visita

| # | Dato | Tipo | Fuente |
|---|------|------|--------|
| 1 | EE.UU., duenos de perro que compran alimento seco: **29% compra semanalmente**, ~**50% cada 2–3 semanas o al menos mensualmente**, ~**20% menos de una vez por mes**. | [P] encuesta Packaged Facts, julio 2016 (citada por PetfoodIndustry) | F1 |
| 2 | Italia, n=1.446 compradores de alimento seco: **64,4% tarda al menos 4 semanas** en terminar una bolsa; 22,5% menos de 2 semanas; 13,1% entre 2 y 4 semanas. Perros: **71,8%** tarda un mes o mas. | [P] estudio revisado por pares, n=2.221 (2018–19) | F2 |
| 3 | Mismo estudio: **50,1%** compra **una sola bolsa por vez**; el tamano mas comun es **>11 kg (36,1%)**. | [P] | F2 |
| 4 | Reorden de alimento **cada 28–45 dias**, snacks cada 14–21, antipulgas cada 30. | [B] blog de proveedor de retencion | F3 |
| 5 | Chewy Autoship: frecuencias configurables por producto desde **cada 2 semanas hasta varios meses**; ejemplos "4 semanas para una bolsa de 30 lb de perro mediano", "6 semanas para 15 lb de gato". | [B] blogs de terceros (la pagina de Chewy devolvio 429; NO verificado en la fuente oficial) | F4, F5 |
| 6 | UK: **52%** de los duenos de 25–34 anos visita su pet shop local **al menos una vez por semana**. | [P] encuesta Johnsons, >1.000 duenos, feb-2026 (segmento etario, no el total) | F6 |

**Lectura:** 3 numeros independientes (F1 EE.UU., F2 Italia, F3 blog) convergen en que el ciclo
**tipico es ~30 dias** (cliente promedio) y el **habitual/frecuente es 7–21 dias** (29% semanal en F1,
22,5% termina la bolsa en <2 semanas en F2). La mediana exacta en dias **no** se encontro publicada:
se infiere de las distribuciones (la mitad de F1 esta en "2–3 semanas o mensual"; el 64% de F2 en ">=4 semanas").

**Argentina:** no se encontro frecuencia de compra publicada. Lo mas cercano:
- Kantar (2015): el pet shop gana peso cuanto mas grande el perro; "el almacén y el mayorista es el lugar de compra preferido para hogares con un perro chico" [P, F7]. Implica que el pet shop captura sobre todo **bolsas grandes = ciclos mas largos**.
- "el 87% de los dueños compra alimento balanceado" (Kantar via Forbes AR) [P, F8]; el alimento absorbe "el 90% del presupuesto destinado a sus animales" (Kantar via Forbes AR) [P, F9].
- Un snippet de busqueda decia que en Argentina la frecuencia de compra de alimento baja y sube el volumen por acto (y que en pet shops 7,5% fue online y 2,3% suscripcion en 2024), **pero no pude abrir la fuente con esa frase** — NO se usa como dato.

## 2) Definiciones de la industria (en riesgo / inactivo / perdido)

| Concepto | Definicion | Tipo | Fuente |
|---|---|---|---|
| Cliente activo (Chewy, lider del rubro) | pidio "at least once during the preceding 364-day period"; quien no compro en 364 dias sale del conteo. | [P] 10-K ante la SEC | F10 |
| En riesgo | "If a customer who orders every 30 days hasn't ordered in 45 days, they're already at risk"; alertar "at 1.5x the normal purchase cycle" en vez de esperar 90 dias. | [B] | F3 |
| En riesgo / lapsed (retail general) | "1.5x past their median order interval ... at risk, and a customer at 2x is lapsed"; ventana de win-back 60–90 dias. | [B] (no especifico de pet) | F11 |

No se encontro una definicion en dias publicada por un POS especifico de pet shop (eTailPet, Pomodo,
BMC revisados: hablan de segmentar por historial, sin umbrales).

## 3) Retencion / abandono

| Dato | Tipo | Fuente |
|---|---|---|
| Chewy FY2024: ventas de clientes Autoship = **79,2%** de las ventas netas (76,2% FY23, 73,2% FY22); 20,5 M clientes activos; US$578 por cliente activo/ano. | [P] 10-K | F10 |
| Chewy FY2025: Autoship = **83,3%** de ventas netas; 21,3 M activos; US$591 por activo. | [P] via Subscription Insider (resumen de resultados) | F12 |
| Recompra en pet supplies ecommerce **30–45%** "because of natural replenishment cycles". | [B] | F13 |

**No se encontro:** % que vuelve por segunda vez ni % retenido a 90 dias para pet shops fisicos, ni
nada de LatAm. El dato Chewy muestra que la base es casi toda reposicion recurrente, no que un
pet shop de barrio retenga igual.

## 4) Particularidades del rubro

- **El ciclo lo fija el tamano de bolsa x tamano del perro**, no el cliente (F2: perros tardan mas que gatos; 71,8% vs 53,8% un mes o mas). Un mismo pet shop tiene clientes de 10 dias (bolsa de 3 kg, perro mediano) y de 60+ (bolsa de 20 kg, perro chico). [C] Esto es aritmetica de racion; **no busque una fuente de gramos/dia**, asi que no afirmo dias por bolsa concretos.
- **Estacionalidad antipulgas/garrapatas:** ventas online de EE.UU. para perros de "$11.8 million ... in January to $42 million ... in May" (Similarweb/Amazon) [P-panel, F14]. En Argentina el pico equivalente seria **primavera-verano austral (sep–mar)** [C, hemisferio invertido; no verificado con datos AR]. Aumenta visitas extra, no cambia el ciclo del alimento.
- **Fin de ano** (regalos, nov–dic) sube trafico [B, F15].
- **Fuga de canal, no de relacion:** el cliente que "se pierde" suele seguir comprando alimento en supermercado, mayorista u online (F7). La mascota sigue viva → el cliente es recuperable mucho mas tiempo que en un cafe (Chewy usa 364 dias como ventana de actividad, F10).
- **Crisis/inflacion AR:** la frase sobre "más frecuencia baja, más volumen" no la pude verificar (ver §1). Si fuera cierta, alargaria el ciclo.

## 5) Escalera propuesta

Ciclo base asumido: **~30 dias** (cliente promedio). Reglas de la industria usadas: en riesgo a
**1,5x** el ciclo (F3, F11), lapsed a **2x** (F11), fuera de "activo" a **364 dias** (F10).

| Etapa | Valor | Justificacion | Confianza |
|---|---|---|---|
| Te extranamos — opcion A | **21 dias** | Para pet shops con clientela de bolsa chica / compra semanal-quincenal (29% semanal F1; 22,5% termina bolsa en <2 sem F2): 21 dias = perdio al menos una reposicion. Se repite en 42. | media |
| Te extranamos — opcion B | **35 dias** | Ciclo modal ~30 dias (F1, F2, F3 28–45) + margen: a los 35 ya deberia haber repuesto. Un solo mensaje antes de R. | media |
| En riesgo — R | **45 dias** | 1,5x del ciclo de 30 = 45; F3 lo dice textual ("hasn't ordered in 45 days ... at risk"). | media (regla de blog, pero coincide con dos fuentes) |
| En riesgo — cadencia X | **cada 15 dias** (45, 60, 75) | Medio ciclo: 3 contactos antes de P, sin spamear a quien compra bolsa grande. Sin fuente directa. | baja |
| Perdido — P | **90 dias** | 3 ciclos sin volver; > 2x (lapsed de F11 = 60) para no tirar a "perdido" al ~20% que compra menos que mensual (F1) o bolsas >11 kg (F2). Coincide con el techo de la ventana win-back 60–90 (F11). | media |
| Perdido — 4 mensajes | **91, 120, 180, 270** | Uno inmediato; despues espaciados porque la mascota sigue existiendo y el cliente probablemente compra en otro canal (F7) → recuperable por mucho tiempo. Espaciado propio. | baja |
| Irrecuperable | **365 dias** | Ventana de actividad del lider del rubro: 364 dias (F10). Tambien cubre al comprador estacional de antipulgas que vuelve una vez por temporada (F14). | media |

Diferencias contra la referencia de cafeteria: todo arranca mas tarde (ciclo de reposicion 30 vs ~7)
y la cola de Perdido es el doble de larga (365 vs 181) porque el motivo de compra no desaparece.

## 6) Lo que no se encontro

- Mediana/promedio de dias entre visitas publicada para pet shops fisicos (solo distribuciones de frecuencia de compra de alimento).
- Cualquier dato de frecuencia de compra de Argentina/LatAm con fuente abrible. El PDF de Kantar "Mascotas argentinas" (anunciantes.org.ar) se descargo pero no se pudo extraer texto (sin herramientas PDF en el entorno).
- Umbrales en dias de POS/CRM especificos de pet shop.
- % de segunda visita y retencion a 90 dias en pet retail.
- Datos APPA de frecuencia de visita (no busque la encuesta paga; el presupuesto se uso en otras).
- Frecuencias de Chewy Autoship en la pagina oficial (HTTP 429); lo citado viene de blogs.
- Gramos/dia por tamano de perro para convertir bolsas de 3/7/15/20 kg en semanas (no buscado).

## 7) Fuentes

- **F1** [P] Packaged Facts, jul-2016, via Animal Health Digest — https://animalhealthdigest.com/the-impact-of-pet-food-purchase-frequency/ — "Among dog owners who buy dry pet food, three out of 10 (29%) do so weekly, and another half do so either every two to three weeks or at least monthly." (original: https://www.petfoodindustry.com/pet-food-market/article/15462721/how-dog-cat-owners-pet-food-purchasing-frequency-varies , 403 al abrir). El resumen de la pagina agrega "only approximately 20% of dry dog food purchasers stock up less frequently than once monthly" (parafrasis del extractor, no cita literal).
- **F2** [P] "A Survey among Dog and Cat Owners on Pet Food Storage and Preservation in the Households", PMC7911149 — https://pmc.ncbi.nlm.nih.gov/articles/PMC7911149/ — "Most animals took at least four weeks to consume an entire dry food pack (64.4%, 931/1446) while some required less than two weeks (22.5%, 326/1446) or two to four weeks (13.1%, 189/1446)." / "Half of the owners purchasing dry pet food for their dog or cat habitually bought one pack at a time (50.1%, 724/1446)".
- **F3** [B] Jericommerce — https://blog.jericommerce.com/resources/retention-strategies-pet-supplies — "Pet food reorders every 28-45 days, treats every 14-21 days, flea prevention every 30 days." / "If a customer who orders every 30 days hasn't ordered in 45 days, they're already at risk."
- **F4** [B] Slickdeals — https://daily.slickdeals.net/stores/chewy-autoship-guide/ — "options generally range from every couple of weeks to several months, depending on the product."
- **F5** [B] ShopBack (snippet de busqueda, no abierto) — https://www.shopback.com/blog/savings/chewy-autoship-us — "4-week for a 30lb bag of dog food for a medium dog, 6-week for a 15lb bag of cat food for one cat". Confianza baja.
- **F6** [P] Johnsons Veterinary Products, feb-2026 — https://johnsons-vet.com/pet-owner-survey-report/ — "52% visiting their local pet shop at least once a week" (segmento 25–34 anos).
- **F7** [P] Kantar Worldpanel via Diario Jornada, 2015 — https://www.diariojornada.com.ar/126033/economia/se_gastan_90_pesos_en_cada_compra_de_alimentos_para_perros/ — "el almacén y el mayorista es el lugar de compra preferido para hogares con un perro chico."
- **F8** [P] Kantar via Forbes Argentina — https://www.forbesargentina.com/negocios/del-alimento-balanceado-capuchinos-perros-como-crece-multimillonario-negocio-mascotas-argentina-n77809 — "el 87% de los dueños compra alimento balanceado, el 68% compra vacunas y el 57%, pulguicidas o garrapaticidas".
- **F9** [P] Kantar via Forbes Argentina — https://www.forbesargentina.com/negocios/cifras-tendencias-mercado-alimentos-mascotas-argentina-n51845 — "absorbiendo el 90% del presupuesto destinado a sus animales".
- **F10** [P] Chewy, Form 10-K FY2024 (SEC) — https://www.sec.gov/Archives/edgar/data/1766502/000176650225000014/chwy-20250202.htm — "individual customers who have ordered a product or service ... at least once during the preceding 364-day period" / "Autoship customer sales as a percentage of net sales 79.2 % 76.2 % 73.2 %".
- **F11** [B] Finsi — https://www.finsi.ai/blog/win-back-email-campaign-guide/ — (snippet de busqueda) "a customer who has gone 1.5x past their median order interval without ordering is at risk, and a customer at 2x is lapsed"; ventana win-back 60–90 dias.
- **F12** [P, via medio] Subscription Insider — https://www.subscriptioninsider.com/article-type/news/chewys-autoship-customer-sales-reached-83-3-of-net-sales-in-fiscal-2025 — Autoship "83.3% of net sales" en FY2025 (snippet de busqueda).
- **F13** [B] (snippet de busqueda, agregado de blogs de benchmark, p.ej. https://www.mageloyalty.com/blog/pet-industry-repeat-purchase-rates-and-clv-benchmarks-for-2026) — "Pet supplies typically achieve repeat purchase rates of 30–45% because of natural replenishment cycles." Confianza baja.
- **F14** [P-panel] GlobalPETS / Similarweb — https://globalpetindustry.com/article/the-online-flea-and-tick-market-when-is-best-to-strike/ — "sales of flea and tick products for dogs surged from $11.8 million (€10.9M) in January to $42 million (€38.8M) in May".
- **F15** [B] Penn-Plax — https://www.pennplax.com/post/holiday-prep-for-pet-stores-how-to-maximize-november-sales — (snippet) los pet shops esperan un aumento de trafico en noviembre y diciembre.
