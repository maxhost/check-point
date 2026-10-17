# Analíticas — investigación de mercado (2026-10-16)

> Tres informes de subagentes (web). Evidencia casi toda de los propios proveedores; las cifras de uso/precisión son de ellos, no verificadas. Las dos fórmulas (meta del día y promo) las recalculó Claude. Insumo de la sesión de diseño de AN (`docs/plan-margen-ganancia-2026-10-14.md`).


---

## Investigación 1 — Asistentes / insights en lenguaje natural para pequeños comercios (2025-2026)

Fecha: 2026-10-16. Fuente: búsqueda web. Varias páginas oficiales (Toast, BusinessWire) devolvieron 403; en esos casos cito lo que reproducen buscadores/prensa. **Casi todo es material del propio proveedor**: no encontré reseñas independientes ni hilos de Reddit con críticas concretas.

## Hallazgo general
El mercado pasó en 2025-2026 de **chat reactivo** («preguntá a tus datos») a **feed proactivo de tarjetas con acción + aprobación** (Square Managerbot, Shopify Pulse, Toast «For you», Xero JAX). El formato que se repite: **qué pasa → por qué importa → botón de acción**, con **máximo ~5 tarjetas**, **descartar con feedback** y **nunca ejecutar sin aprobación del dueño**. En LatAm casi nadie tiene insights proactivos: son reportes clásicos o chat por WhatsApp/MCP.

## Por plataforma

**Toast IQ** (EE.UU., conversacional desde oct-2025; incluido sin costo)
- Proactivo: feed «For you» + prompts «Explore» basados en los datos del local (ventas, personal, menú).
- Textual: «A major event in your area this weekend may increase late-night crowds. Want to check how your staffing looks?»; prompt sugerido «Identify 10 items with the largest sales fluctuations»; pregunta tipo «Who's working Friday night?».
- Acción: ejecuta tareas (agregar ítem al menú con un prompt, sumar persona a un turno).
- Uso (dato de Toast): 40.000 usuarios activos semanales y 21M+ hilos en T1-2026; el 47% de los restaurantes pregunta sobre ventas/ingresos.
- https://restauranttechnologynews.com/2025/10/toast-launches-conversational-ai-assistant-to-help-restaurant-operators-work-faster-and-smarter/ · https://pos.toasttab.com/news/toast-iq-restaurant-trends-report-ai-assistant

**Square AI → Managerbot** (beta jun-2025; Managerbot beta abierta 28-abr-2026, sin costo extra)
- Reactivo al inicio: «best-selling items» en una franja horaria de ayer, anulaciones del fin de semana. Desde oct-2025 trae **clima, eventos y reseñas locales**: «Will this Fourth of July be warmer or cooler than last year?» → recomienda inventario y personal. Se pueden **fijar gráficos generados como widgets**.
- Proactivo (Managerbot): home con «Ideas» = snapshot + «Improvement opportunities» que traen el siguiente paso; botón **«Show me something else»** para descartar; «Threads» con prompts sugeridos. Cruza **inventario con velocidad de venta** y avisa antes del quiebre; detecta clientes habituales que no volvieron y arma una campaña; marca problemas del catálogo («items without photos, duplicate tax rates, missing descriptions»).
- Principio: «Managerbot proposes an action, and sellers approve», con vista previa del cambio.
- Evidencia: decenas de miles de vendedores en 2 meses, ~200.000 preguntas; usan más los comercios grandes. Testimonios (curados): un café no sacó platos que «rendían más de lo que creía»; otro atrasó 30 min la apertura tras cruzar ventas y mano de obra por hora; «Managerbot has already told me how the previous day went». Crítica: VentureBeat recoge que el error «never going to be zero» y el riesgo de que sirva para vender productos financieros de Block.
- https://squareup.com/us/en/press/square-ai-beta-insights · https://squareup.com/us/en/press/square-releases-ai · https://squareup.com/us/en/press/managerbot-open-beta · https://squareup.com/help/us/en/article/8516-use-ask-ai-to-get-insights-about-your-business · https://venturebeat.com/data/block-introduces-managerbot-a-proactive-square-ai-agent-and-the-clearest

**Shopify Sidekick Pulse** (Winter '26, acceso anticipado)
- Proactivo: hasta 5 tarjetas en el Home. Requiere ventas recientes y activar «Network Intelligence» (datos compartidos). Botón → Sidekick abre una conversación con una lista de tareas; nada cambia sin aprobación; **X para descartar diciendo por qué** (alimenta lo que sugiere después).
- Shopify no publica ejemplos textuales. Un blog de terceros los ilustra así: «At current velocity, you'll run out in three days»; la conversión cayó 8% por la carga de la página → revertir el tema. El mismo blog dice que la calidad es despareja: algunas tarjetas sirven y otras son vagas.
- https://help.shopify.com/en/manual/shopify-admin/productivity-tools/sidekick/pulse · https://www.shopify.com/news/winter-26-edition-merchant · https://easysellapp.com/blogs/wiki/shopify-sidekick-pulse-setup-first-actions-2026

**Lightspeed AI** (ene-2026): chat en el POS; «last weekend's top sellers», «which menu items are driving margin?»; acepta repreguntas. Reactivo. https://www.lightspeedhq.com/news/lightspeed-commerce-launches-lightspeed-ai-a-new-ai-powered-intelligence-layer-for-retail-and-hospitality/

**Intuit Assist (QuickBooks)**: resumen diario al iniciar sesión con insights y próximos pasos; marca «cash flow hotspots» cuando proyecta un hueco de ingresos y propone cómo cerrarlo; redacta recordatorios de cobro. Gran parte se anunció como beta. https://www.cpapracticeadvisor.com/2023/09/06/introducing-intuit-assist-for-quickbooks-a-trusted-business-assistant-by-your-side/94111/ · https://fitsmallbusiness.com/intuit-assist-explained/

**Xero JAX**: «Cash Flow actions» detecta un hueco de caja antes de que pase y arma un plan (postergar facturas no esenciales, proteger sueldos); predice cuándo paga cada cliente y le manda recordatorios en ese momento; corre sobre Claude. Disponibilidad gradual (jul-2026). https://www.xero.com/media-releases/xero-announces-new-ai-innovations-xerocon-london/ · https://www.techrepublic.com/es/article/xero-jax-significant-updates/

**Clover**: no encontré un asistente propio de IA. Solo integraciones de terceros vía MCP.

**Loyverse**: sin IA. Alerta de stock bajo **por email diario** con umbral por artículo; los compuestos alertan por componente. https://help.loyverse.com/help/low-stocks

**Mercado Pago «Mago»** (Brasil oct-2025, Chile 2026): ventas por período, días y horarios pico; pagar proveedores y sueldos. «Prepara una acción que el usuario revisa y confirma». Consejo de ejemplo: «atender hasta una hora más tarde los jueves, porque el peak de ventas ocurre el jueves en la tarde». No vi alertas proactivas. https://chocale.cl/2026/09/mercado-pago-lanzo-mago-su-asistente-con-ia-para-gestionar-finanzas-y-negocios/

**Fudo**: agentes de IA para ventas/delivery; «Recetas con costeo automático», «rentabilidad por producto», «Cada pedido descuenta automáticamente los insumos»; maqueta con la etiqueta «Tomate Stock Bajo». No encontré insights en lenguaje natural. https://fu.do/es-ar/

**Alegra**: **MCP de solo lectura** para conectarlo a Claude/ChatGPT. Preguntas textuales: «¿Cuánto vendí esta semana y qué día tuvo mejor desempeño?», «¿Qué productos tienen bajo stock y ventas recientes?», «Compara ingresos cobrados y gastos pagados este mes». Asistente de facturación por WhatsApp. Reactivo. https://blog.alegra.com/colombia/chatgpt-para-negocios-ventas-cartera-gastos-ia/

**Contífico (Ecuador)**: contifico.com redirige a siigo.com/ec («Siigo Contífico»). No menciona IA ni alertas; ofrece «+20 reportes». **Siigo**: IA en facturación + facturar por WhatsApp; «reportes inteligentes» sin detalle. **Bsale, Kyte, Treinta**: no encontré insights con IA (Kyte la usa solo para descripciones de productos).

## Ideas que van MÁS ALLÁ de nuestros ejemplos
1. **Contexto externo**: clima/feriados/eventos del barrio → «este finde hay evento cerca, revisá personal/stock» (Square, Toast).
2. **Clientes que no volvieron** → «X habituales no vinieron este mes» + botón de campaña de recuperación (Square). Nos encaja directo con la fidelización de CheckPass.
3. **Horario de apertura según rentabilidad por hora** (ventas vs. costo de personal por franja) → «abrir 30 min más tarde» o «cerrar 1 h más tarde los jueves» (Square, Mago).
4. **No saques ese plato**: rinde mejor de lo que creés (testimonio de Square). Insight que confirma o rompe una creencia.
5. **Brecha de caja anticipada + plan** (qué pago postergar), y **cuándo te paga cada cliente** (Xero, Intuit). Útil para talleres y odontólogos que fían.
6. **Alerta de suba de precio de un insumo** al cargar la factura, con umbral por ítem (MarginEdge: https://www.marginedge.com/how-it-works), unida al costeo de la receta → «tu pizza muzza perdió 4 puntos de margen».
7. **Higiene de datos como insight**: «3 productos sin costo cargado, sin eso no puedo calcular tu margen» (Square marca el catálogo incompleto). Esto es clave para nosotros porque el dueño carga poco.
8. **Resumen de ayer al abrir la app** (Square, Intuit).
9. **Reconocer a un empleado** con datos (Toast: barista con 76 bebidas/hora → bono).

## Patrones de UI a copiar
Máx. 5 tarjetas, cada una con hecho + por qué + un botón; «mostrame otra» / descartar con motivo; aprobación con vista previa antes de cualquier escritura; fijar un insight como widget; prompts sugeridos sacados de sus propios datos; frase de cautela («verificá antes de decidir compras»). Requisito que se repite: datos mínimos (Pulse no aparece en tiendas con pocas ventas), así que hay que diseñar el estado «todavía no sé lo suficiente».

## Lo que no encontré
Textos reales de tarjetas de Pulse, el texto del feed de Toast más allá de los 2 ejemplos, críticas independientes de comerciantes, e IA de insights en Clover, Bsale, Kyte, Treinta y Contífico.

---

## Investigación: stock, costo de recetas, inflación de insumos, márgenes y punto de equilibrio (2025-2026)

Fuentes: casi todo sale de páginas de marketing o de ayuda de cada producto. Donde no encontré documentación, lo digo.

## 1. Días de cobertura / «se acaba el X»

- **Lightspeed (Retail/Analytics, no la versión de restaurante):** el informe de reposición promedia la venta diaria de las **últimas 6 semanas, sin contar los días en que el producto estuvo agotado**. Con eso calcula «días de cobertura» (cuántos días alcanza el stock al ritmo actual si no se repone) y un punto de pedido que tiene en cuenta los **días de entrega del proveedor**. Pedido sugerido = demanda prevista − stock − lo que ya está en camino. El constructor de métricas usa una ventana de **90 días**: stock deseado = días objetivo × venta diaria promedio. https://retail-support.lightspeedhq.com/hc/en-us/articles/40248964530075-Creating-dynamic-reorder-point-calculations · https://retail-support.lightspeedhq.com/hc/en-us/articles/9865730296603
- **Restaurant365:** no mide por día sino **«consumo por cada $1.000 vendidos»** (ventana de unos 90 días, se recalcula cada noche) y un «stock teórico» desde el último conteo. Su blog dice que lo típico es tener **5-7 días de inventario**. https://docs.restaurant365.com/docs/usage-per-1000 · https://www.restaurant365.com/blog/inventory-forecasting-guide/
- **Supy:** arma el pedido con un **pronóstico de demanda a 14 días**, no con un stock mínimo fijo. Por cada ítem muestra el stock actual y el **stock proyectado para el día de la entrega**. El usuario puede ajustar por eventos y promociones, y ningún pedido sale sin que alguien lo revise. https://supy.io/product-features/ai-predictive-ordering
- **Square:** el «stock forecasting» («qué stock está en riesgo de agotarse según qué tan rápido lo vendés») existe **solo en los planes de Retail**. Para restaurantes solo hay alerta de stock bajo con un umbral manual, y el email llega **90 minutos después del cierre**. Square Recipes (beta, Restaurants Plus/Premium) descuenta los ingredientes de cada venta y marca el plato como agotado. https://squareup.com/ca/en/point-of-sale/features/inventory-management · https://squareup.com/help/us/en/article/8629-beta-track-ingredient-costs-with-square-recipes
- **MarketMan, BlueCart, Fudo:** alertas por stock mínimo y pedido automático hasta el nivel objetivo. No encontré que proyecten una fecha de agotamiento. https://www.marketman.com/perpetual-inventory · https://www.trustradius.com/products/fudo/details
- **Incertidumbre:** **ningún producto documenta cómo comunica la incertidumbre** (rangos, «entre jueves y sábado»). Lo más parecido es que los propios productos admiten que el pronóstico falla: Lightspeed saca los días agotados del promedio y Supy deja corregir a mano.

**Para nosotros (fórmula simple):** `días que alcanza = stock ÷ consumo diario promedio (últimas 4-6 semanas, sin contar días agotados)`. Si hay receta: `masas que salen = stock de harina ÷ harina por masa`. **Más allá de nuestros ejemplos:** (a) restar los días de entrega del proveedor: «pedila HOY, tu proveedor tarda 2 días»; (b) dar un rango cuando hay pocos datos: «se acaba entre el jueves y el sábado»; (c) no mostrar nada con menos de unos 14 días de historia.

## 2. Alertas de suba de precio de proveedor

- **xtraCHEF (Toast):** el «Price Tracker» toma los precios de las facturas: variación promedio en %, **impacto en $** y comparación entre períodos (semana contra semana anterior, 4 semanas contra las 4 anteriores). Se puede marcar ítems «de vigilancia estrecha». Empieza a funcionar «con las primeras facturas». No hay umbral de alerta documentado: es un informe, no un aviso automático. Lo que propone: cambiar de proveedor o sustituir el insumo. https://support.toasttab.com/en/article/xtraCHEF-Price-Tracker
- **MarginEdge:** manda un **email a los admins cuando una factura trae un precio «inesperado»** (el umbral lo define el usuario). Tiene «Price Movers»: los insumos que más subieron, **ponderados por cuánto se compra**. Y alertas de **costo por plato** que avisan cuando sube o baja el costo de un plato; un cliente cuenta que las recibe a diario. https://help.marginedge.com/hc/en-us/articles/360057072773-MarginEdge-At-A-Glance-An-Overview · https://www.marginedge.com/lp/plate-cost-alerts
- **MarketMan:** alertas de suba de precio y topes de precio por ítem en las compras. https://MarketMan.com/platform/restaurant-purchasing-software-and-order-management
- **meez / Galley:** cuando cambia el precio de un insumo, **se recalculan solas todas las recetas y menús** que lo usan. meez deja probar un cambio de ingrediente y ver cómo afecta el margen. https://getmeez.com/costing · https://www.galleysolutions.com/recipe-food-costing-software-for-foodservice
- **«Cada cuántos días sube»:** ningún producto calcula esa frecuencia. **Sería algo propio**: `frecuencia = días entre cambios de precio registrados` y `suba acumulada = precio de hoy ÷ precio de hace 6 meses − 1`.

**Más allá de nuestros ejemplos:** traducir la suba de un insumo a cada plato: «La harina subió 12%: tu pizza ahora te cuesta $0,18 más; para mantener el margen, cobrala $X». Es la idea de las alertas de costo por plato de MarginEdge, dicha en una frase.

## 3. Valor de stock y merma

- **Valor de stock:** MarketMan habla de un inventario perpetuo «en tiempo real» con el costo de lo vendido. Alegra tiene «Inventario valorizado» (cantidad × costo promedio) y «Rentabilidad por producto». https://www.marketman.com/perpetual-inventory · https://siemprealdia.co/mexico/contabilidad/reportes-inteligentes-que-todo-contador-debe-conocer-y-generar/
- **Merma = consumo real contra consumo teórico:** Restaurant365, Craftable y WISK comparan lo que **debió consumirse según las ventas y las recetas** con lo que **falta según el conteo**. Craftable explica cómo leer el resultado: si el conteo da menos de lo esperado, suele haber salidas que no se registraron; si da más, facturas mal cargadas. WISK además pone la diferencia **en dinero perdido**, a costo y a precio de venta. https://docs.restaurant365.com/docs/theoretical-vs-actual-report · https://help.craftable.com/learning/actual-vs-theoretical-cost-details-report · https://www.wisk.ai/actual-vs-theoretical
- **Datos mínimos:** recetas cargadas + ventas + **dos conteos físicos**. Sin conteos no hay merma, solo stock teórico.

**Frase posible:** «Según tus ventas debías tener 8 kg de queso; contaste 6. Esos 2 kg son $14 que se fueron (porciones grandes, desperdicio o algo sin registrar)».

## 4. Menu engineering (estrella / caballo / puzzle / perro)

Toast y Loaded usan la misma matriz: **cuánto se vende** contra **ganancia por unidad**, comparando cada plato con el promedio del menú. Lo que recomienda Toast para cada tipo:
- Estrella: protegerla y destacarla.
- Puzzle (gana mucho, se vende poco): darle visibilidad, mejorar la descripción y que el personal lo recomiende.
- Caballo (se vende mucho, gana poco): ajustar precio o porción, o venderlo en combo con algo de más margen.
- Perro: probar un solo cambio y, si no mejora, sacarlo.

https://pos.toasttab.com/blog/on-the-line/menu-engineering-matrix · https://www.loadedhub.com/resources/menu-engineering-matrix-restaurant

No encontré documentación de un informe con nombre de matriz en Restaurant365 ni en Apicbase. Restaurant365 lo presenta como algo que se arma combinando costeo de recetas con la mezcla de ventas. https://www.restaurant365.com/blog/6-key-restaurant-operational-reports-to-boost-your-menu-engineering/

**Para nosotros:** no mostrar la matriz; dar **una acción por plato**. «Tu lasaña deja $4,10 por plato y casi nadie la pide: recomendala hoy». «El café con leche se vende muchísimo pero deja $0,30: subilo $0,25 o armá un combo con medialuna». Datos mínimos: precio, costo de la receta y unidades vendidas (unas 4 semanas). Para un barbero o un dentista, lo mismo por servicio: tiempo + insumos contra precio.

## 5. Punto de equilibrio diario / meta de ventas de hoy

- **Fórmula estándar:** `PE = costos fijos ÷ margen de contribución %`, donde el margen es lo que queda de cada $1 vendido después de insumos, comisión de tarjeta y mano de obra variable. Las calculadoras gratuitas (Connecteam, gosnappy) dan PE diario y **clientes por día**. https://connecteam.com/free-tools/restaurant-break-even-calculator/ · https://gosnappy.io/blog/restaurant-break-even-calculator/
- **7shifts:** el dueño carga la venta proyectada del día y una meta de costo laboral en %. Al armar los turnos, el día se pinta **verde si está en la meta, rojo si se pasa**. https://kb.7shifts.com/hc/en-us/articles/4417514442771
- **Tenzo:** alertas de **venta contra presupuesto** («en riesgo de no llegar a la meta semanal»), alertas de costo laboral durante el día y un resumen diario antes de abrir. https://www.gotenzo.com/?p=5943
- Ningún producto documenta una frase tipo «hoy necesitás vender $X». Es una ventaja posible.

**Fórmula para el comerciante:** `meta de hoy = (gastos fijos del mes ÷ días que abrís) ÷ (1 − costo de insumos %)`. Ejemplo: $1.800 de gastos fijos ÷ 26 días = $69; con insumos al 35%, la meta es $69 ÷ 0,65 = **$106 hoy**. **Más allá:** mostrar el avance durante el día («vas $62 de $106, te faltan unos 9 cafés con medialuna») y pasarlo a clientes con el ticket promedio.

## 6. Impacto de un descuento o promoción

- **No encontré ningún software de restaurante que calcule esto antes de lanzar la promo.** Lo más cercano es un simulador de precios en planilla (Payhip) y la herramienta «Sales Mix» de SpeedLine para modelar precios. https://payhip.com/b/Djl2q · https://www.speedlinesolutions.com/blog/reviewing-prices-using-the-speedline-sales-mix-for-price-modeling-and-cost-analysis
- **Fórmula verificada:** `ventas extra necesarias = descuento % ÷ (margen % − descuento %)`. Con 20% off y 40% de margen hay que vender **el doble** (+100%). Con 55% de margen, +57%. La guía oficial de Victoria (Australia) trae la tabla margen × descuento. Supone que todas esas ventas son nuevas. https://business.vic.gov.au/business-information/finance/pricing-for-profit/develop-discount-strategies · https://www.growthsuite.net/resources/shopify-discount/percentage-off-discounts-guide/break-even-calculator

**Frase:** «Con 20% off en la pizza (margen 45%), para ganar lo mismo tenés que vender 80% más: de 10 a 18 por día. Si el descuento es más del margen, perdés plata en cada una». Encaja con los cupones que ya tiene el producto: calcularlo **al crear el cupón** y medir después si la meta se cumplió.

## Datos mínimos (resumen)

| Frase | Necesita |
|---|---|
| Valor de stock | cantidad + costo unitario |
| Se acaba el X | stock + receta + ventas de 14 días o más (+ días de entrega del proveedor) |
| Suba de insumos | 2 compras o más del mismo insumo con precio y fecha |
| Margen por plato | receta + costos + precio |
| Merma | lo anterior + 2 conteos físicos |
| Meta de hoy | gastos fijos mensuales + días que abre + % de insumos |
| Promo | margen del producto + % de descuento |

## Huecos

- Bsale, Contífico y Fudo: no encontré la ayuda oficial. Lo de Fudo (alerta de stock bajo, stock mínimo por ingrediente) viene de TrustRadius y de guías de su API.
- Alegra: los informes vienen de un blog de terceros.
- Apicbase: solo directorios de software.
- En LatAm no vi ningún producto que hable en frases accionables. Es una diferencia a nuestro favor.

---

## Investigación 3: pronóstico de demanda, conocer clientes, qué cambia por rubro (2025-2026)

Aviso: casi todo sale de páginas de los propios proveedores. Las cifras de precisión o de mejora son lo que ellos dicen, nadie las auditó por fuera. "[no abierta]" quiere decir que solo vi el resumen del buscador y no pude cargar la página.

## 1. Pronóstico de demanda

| Producto | Qué muestra / cómo calcula | Datos mínimos | Acción que propone |
|---|---|---|---|
| **Sling (proyección con datos de Toast)** | Solo historial de ventas de Toast. **No** tiene en cuenta clima, feriados ni eventos. Avisa por escrito: «a discrepancy of 30%-40% is normal». Mejora a medida que se acerca la fecha | Las ventas que ya están en Toast; mejora con más historia | Armar los turnos del personal. https://support.getsling.com/en/articles/8614345-projected-sales-forecasting-for-toast-integration |
| **Toast IQ (oct-2025) / IQ Team (oct-2026)** | Un feed "For You" que avisa de tendencias, «changes in item sales or local events that may impact your business». IQ Team agrega pronóstico de ventas al armado de turnos | Datos propios del local | Ajustar el personal. El agente de ofertas propone promos para clientes nuevos o para «lapsed diners». https://pos.toasttab.com/news/toast-expands-toast-iq-smart-ai-assistant · https://support.toasttab.com/en/article/Toast-IQ-Overview · https://www.fastcasual.com/news/toast-expands-ai-tools-for-labor-management-marketing/ |
| **Square AI (oct-2025)** | Chat que suma clima, eventos, noticias y reseñas de la zona. Ejemplos textuales: «What items are trending locally?», «Will this Fourth of July be warmer or cooler than last year?». En UK pone de ejemplo «a wet weekend or a local football match» | Datos propios + web | Recomendaciones de inventario y personal. Los gráficos se pueden fijar como widgets. https://squareup.com/us/en/press/square-releases-ai · https://www.businesswire.com/news/home/20260210922162/en/ |
| **Tenzo** | Seis capas: historial, estacionalidad, **día de semana**, eventos (Día de la Madre, finales deportivas), clima, **ajuste manual del gerente** («roadworks, broken equipment»). Dicen que el ajuste humano baja el error «up to 10%» | Usa toda la historia que haya | Ventas por hora → personal y compras. https://support.gotenzo.com/docs/forecasting-overview-what-it-is-and-how-it-works/ |
| **Lineup.ai** | Historial + clima + eventos. Encontraron que los **eventos pesan más que el clima**. Su base de comparación: «on ~33% of days sales are 20% above or below the 4-week rolling average» | Historial del POS | Pronóstico diario y semanal → personal. https://www.businesswire.com/news/home/20201209005074/en |
| **5-Out** | Historial, franja horaria, mix de productos, clima, eventos. Por hora, día y semana | Fuentes de terceros hablan de 3-6 meses de historia [no confirmado por el proveedor] | Lista de preparación, compras, personal. https://www.5out.io/faq |
| **Crunchtime** | El clima entra **dentro** de un único número: no se muestra aparte ni se explica | — | "Ideal hours" por turno y pedido sugerido por producto. https://www.crunchtime.com/blog/introducing-weather-driven-ai-forecasting-for-restaurants |
| **Lightspeed (UK, may-2025)** | "Benchmarks & Trends": compara contra locales de tamaño parecido de la zona, más un pronóstico con ML | 4 semanas visibles | Planificar. https://www.lightspeedhq.com/uk/blog/shaping-the-future-of-hospitality/ |
| **Fourth** | Recomienda historial + clima + feriados + **conocimiento local del gerente** | — | https://www.fourth.com/blog/achieving-accurate-forecasting-blog/ |

**Incertidumbre.** Ninguno de los productos revisados muestra un rango de confianza en pantalla. Lo más honesto es el aviso por escrito de Sling («30-40% es normal»). La base contra la que todos se comparan es el **promedio de las últimas 4 semanas / mismo día de semana**. MarginEdge (página bloqueada, solo resumen) usa hasta 3 años de historia y ubicación para el clima, y aclara que todavía no usa el pronóstico del clima.

**Lo que nos sirve:** con pocos datos alcanza un pronóstico por **mismo día de semana de las últimas 4-8 semanas**, y conviene decirlo en lenguaje común («suele», «probablemente»). El dueño puede anotar a mano lo que él sabe y el sistema no («hay feria», «calle cortada»), como hacen Tenzo y Fourth. Un resumen académico [no abierto, https://galitshmueli.com/node/1253] dice que con **ventas diarias** el clima y los feriados mejoran poco el pronóstico; ayudan más cuando se pronostica una franja horaria. Eso respalda empezar sin clima.

## 2. Conocer clientes

| Producto | Segmentos / disparadores (textuales) | Acción |
|---|---|---|
| **Square** | Grupos automáticos. **Regulars** = «visited three times in the last six months». **Lapsed** = «were regulars, but haven't visited in the last six weeks». Los dos se pueden editar | Campaña automática «Bring back your lapsed customers» + recordatorio a los 5 días si no se abrió. Cupón que vence a los 2 meses. https://squareup.com/help/us/en/article/6245-manage-customer-groups-and-filters · https://squareup.com/help/us/en/article/5660 |
| **Toast Marketing** | Módulos armados: **Welcome**, **Miss You** («not visited in 30 days or more»), **Repeat Guest** (cada 5ª visita), **Big Spender** (ticket mayor a un umbral), Follow up, pedir reseña después de un comentario positivo. Tope: un envío automático por mes por cliente | Email automático diario. https://support.toasttab.com/article/Building-an-Automated-Email-Campaign |
| **Thanx** | Win-back con ML: se fija en clientes **de alto valor y con alto riesgo**. Mide la frecuencia *contra la propia historia del cliente* en lugar de un corte fijo de 90 días. Advierte que descontar a todos «trains guests to wait» | Oferta personalizada. https://www.thanx.com/thanx-announces-personalized-winback-powered-by-machine-learning/ |
| **Paytronix** | Tres estados: "slowing down / lapsing / lapsed". Cuando la ausencia llega a **2-3 veces la frecuencia habitual del cliente**, la oferta sube. Ventana clave: unos 80-90 días. **Grupo de control**: un grupo sin oferta para medir el efecto real. El caso Primanti probó $5 / $8 / $10 contra ese grupo | https://paytronix.com/blog/whered-they-go-4-steps-for-winning-back-lapsed-guests · https://paytronix.com/resources/case-studies/primanti-bros-drives-double-digit-lift-in-visits-and-spend-with-ai |
| **NCR Voyix** | Corte de abandono personalizado por cliente. "At risk" y "churned" con recompensa más grande para churned | https://docs.ncrvoyix.com/restaurant/consumer-marketing/using/managing_customer_churn_portal |
| **SumUp (ex Fivestars)** | "AutoPilot": bienvenida + reactivación por app, SMS o email | https://sumup.com/en-us/loyalty-program |
| **Loopy Loyalty** (sellos en wallet, el más parecido a nosotros) | Solo una tabla «who joined, who's active, who's redeemed» y un ingreso estimado (valor del sello − costo de la recompensa). **No encontré reactivación automática por inactividad** | Push al wallet a mano o vía Zapier. https://www.loopyloyalty.com/features/analytics/ |

Stamp Me y Belly: no encontré documentación actual.

## 3. Rubros con turnos

**Barbería.** *Booksy*: lista de espera automática, avisos masivos de horario libre, la cita cancelada vuelve a quedar disponible al instante, promo para horas libres, y protección contra ausencias (seña %, cargo por cancelación, ventana de aviso, "Trusted Clients" exentos). Dicen «20% fewer cancellations» (https://biz.booksy.com/blog/use-booksy-to-reduce-no-shows-and-cancellations). *Squire*: «Reactivate Lapsed Clients» y **Smart Rebooking**, que aprende cada cuánto vuelve cada cliente y le manda un aviso personal. El reporte de retención se puede ver por barbero. Asistente en lenguaje natural («which service has the highest rebook rate?»). Referencia del sector: 48,5 días promedio entre visitas, 44,6% de las visitas son de clientes que vuelven (https://getsquire.com/business-edge/engage-with-smart-rebooking [no abierta], https://getsquire.com/business-edge/barbershop-reporting-software [no abierta]). *Boulevard*: reserva bloques para servicios de alto valor y tiene en cuenta si el cliente suele llegar a horario (https://www.joinblvd.com/blog/ai-powered-scheduling). *Zenoti* (competidor): un salón promedio agenda la próxima cita dentro de las 24 h con ~10% de sus clientes, los mejores con ~30% (https://www.zenoti.com/thecheckin/salon-crm-guest-data-playbook). *Fresha*: dice que después de la 3ª cita vuelve más del 83%; no encontré un reporte de retención documentado.

**Odontología.** El patrón del sector es la **reunión corta de la mañana con el equipo** ("morning huddle"): huecos de hoy, tratamiento sin agendar ($), controles vencidos, pacientes que faltan seguido, cuánto llevamos de la meta del mes. Ejemplos: el velocímetro de Denticon, Dentrix Daily Huddle (producción, cobros, aceptación de tratamientos, pacientes nuevos), Dental Intel (lo agendado contra la meta diaria de cada profesional) (https://planetdds.com/resource-library/morning-huddle-dashboard-within-denticon-start-your-day-with-insights · https://henryschein.com/us-es/dental/business-solutions/practice-services-knowledge-center-articles/use-daily-huddle-to-track-practice-progress.aspx). Truco: llenar un hueco de higiene con un paciente que **ya viene hoy** y tiene la limpieza vencida. *Weave*: "Quick Fill", lista de pacientes que quieren un turno antes y reciben un SMS cuando alguien cancela (https://getweave.com/industry/dental). *Dentalink* (LatAm): recordatorio por WhatsApp con link para confirmar o anular (https://intercom.help/softwaredentalink/es/articles/9493137-como-notificar-cita-por-whatsapp). No encontré cómo maneja Dentalink los controles periódicos.

**Taller mecánico.** *Tekmetric*: automatizaciones «Declined Service Reminder» (seguir los trabajos que el cliente rechazó) y recordatorios de mantenimiento, solo a quien aceptó recibirlos y con tope de frecuencia. Métricas: Car Count, ARO (ticket promedio), Declined Sales en dólares. Ante pocos autos pregunta «¿es captación o retención? Are declined jobs being followed up?» (https://tours.tekmetric.com/answers/how-to-act-on-your-tekmetric-shop-index-results). *AutoLeap*: el trabajo postergado queda pegado a la ficha del cliente para «fill slow days»; recordatorios según historial y **kilometraje** (https://autoleap.com/features/crm/). Shopmonkey: nada confirmado.

## 4. Universal vs. propio de cada rubro

**Universal:** (a) el pronóstico como "mismo día de semana, últimas N semanas"; (b) los segmentos nuevo / habitual / perdiendo / perdido; (c) bienvenida y "te extrañamos" automáticos; (d) un tope de envíos por cliente; (e) que el dueño pueda corregir el pronóstico.

**Propio:** *Comida*: unidades por producto y franja horaria, preparación y compras, clima y eventos. *Turnos (barbería, odontología)*: la meta es **llenar huecos** (lista de espera, avisar que hay lugar), ausencias y señas, volver a agendar al salir, ciclo personal de vuelta del cliente. *Odonto y taller*: **lo pendiente** (tratamiento sin agendar, trabajo rechazado) y los **controles periódicos o por kilometraje**, con monto en dólares.

## 5. Ideas que van MÁS ALLÁ de nuestros ejemplos

1. **Ausencia relativa al propio cliente** en lugar de un corte fijo: «Juan suele venir cada 12 días; hoy van 25» (Thanx, Paytronix, Squire). Encaja con sellos, que ya registran la frecuencia de cada uno.
2. **Oferta escalonada con grupo de control**: medir si el cupón *de verdad* trajo al cliente (Paytronix). Y **no mandar reactivación a quien igual iba a volver**.
3. **Valor en riesgo**: «3 clientes de alto gasto están dejando de venir».
4. **"Lo pendiente" con monto**, para rubros que dejan cosas abiertas: «Tenés $X en trabajos que rechazaron» (Tekmetric, Dental Intel). Para nosotros: sellos a 1 de completar, cupones sin canjear.
5. **Llenar el hueco de hoy con quien ya está por venir o vencido**: «Hoy hay hueco a las 16 h; María tiene el corte vencido» (odonto + Booksy).
6. **Nota manual del dueño** que corrige el pronóstico («feria el sábado»), como Tenzo y Fourth.
7. **Avisar el error en lenguaje común**: «estimación aproximada, puede variar ±30%» (Sling).
8. **Comparación con locales parecidos de la zona** (Lightspeed). Hoy no tenemos suficientes comercios para hacerlo.
9. **Reseña después de un comentario positivo** (Toast "Thank guests for positive feedback").
10. **Proporción de clientes con próxima cita agendada** como indicador de salud del negocio (Timely, Zenoti).

---

## Contexto externo (informes 4 y 5, 2026-10-16)

> Verificado por Claude el 2026-10-16: términos de Open-Meteo («You may only use the free API services for non-commercial purposes») y Nager.Date EC 2026 (11 fechas nacionales, sin Quito 6-dic ni Guayaquil 25-jul, 24-may sin trasladar). El resto es de los subagentes; precios mayormente de directorios de terceros.

---

### Contexto externo (clima, eventos, feriados) en software para comercios: quien lo usa y con que resultado

Investigacion web, 2026-10-16. Marcas: **[P]** = cifra del proveedor o su socio; **[I]** = independiente/academica. Todo lo marcado [P] es marketing sin metodologia publicada. Si no encontre algo, lo digo.

## 1. Restauracion

| Proveedor | Fuentes externas | Como se lo muestra al dueño | Resultado declarado |
|---|---|---|---|
| **PredictHQ** (API de eventos; clientes citados: Domino's, Uber, Accor) | eventos en 18+ categorias (deportes, conciertos, feriados escolares), ranqueados por impacto previsto | no tiene UI para el dueño: lo integran otros (Lineup, Duetto, RELEX, RoomPriceGenie) | «minimo 10% de mejora en precision» [P] ([fuente](https://www.predicthq.com/customers/lineup)). **Domino's: no encontre ninguna cifra publicada.** Solo aparece como cliente y como uso previsto (repartidores, stock por local) ([Startup Daily 2018](https://www.startupdaily.net/2018/11/auckland-startup-predicthq-raises-us10-million-series-round/)) |
| **Lineup.ai** (ahora dentro de TimeForge) | ventas POS, clima, reservas, eventos (PredictHQ) | la UI destaca «los eventos de mayor impacto» y lo traduce a turnos de personal | piloto de 4 semanas, 5 restaurantes junto al United Center (Chicago): «35% más preciso» que el promedio movil de 4 semanas, hasta 65% en uno [P] ([PredictHQ/Lineup](https://www.predicthq.com/customers/lineup)). Dato util: ~33% de los dias se desvian ±20% del promedio de 4 semanas, y ahi dicen ganar «hasta 60%» [P] ([BusinessWire 2020](https://www.businesswire.com/news/home/20201209005074/en)) |
| **Tenzo** | historico, clima, estacionalidad, eventos, feriados; minimo 90 dias de datos | el gerente revisa y ajusta el pronostico cada semana («clima inusual») | «30-50% más preciso» u otra pagina «50-75% más que el promedio de 4 semanas», cifras inconsistentes entre si [P]; el ajuste del gerente suma 5-10% [P] ([soporte Tenzo](https://support.gotenzo.com/docs/forecasting-overview-what-it-is-and-how-it-works/)) |
| **Fourth (iQ)** | historico, transacciones, promos, feriados. **No encontre el clima documentado como entrada** | horas de personal e inventario sugeridos | Noodles & Co: +20% de precision, US$4M menos en costo laboral; PizzaExpress +25% [P] ([Fourth](https://www.fourth.com/solution/ai-labor-inventory-forecasting)) |
| **5-Out** | ventas, clima, eventos locales; CSV de feriados/partidos (segun una guia de terceros) | pronostico de ventas y personal | sin cifra verificable ([FAQ](https://www.5out.io/faq)) |
| **Crunchtime** | historico + pronostico del clima local (desde 2024-25); API para importar datos externos | no hay una vista del clima: se transforma en «horas ideales» al armar turnos y en «pedido sugerido» | el anuncio del clima **no trae ninguna cifra** ([blog](https://www.crunchtime.com/blog/introducing-weather-driven-ai-forecasting-for-restaurants)); «98-99% de precision» en algunos clientes [P, vía terceros] |
| **Toast IQ** (oct-2025) | datos del POS + clima y eventos locales | ejemplo textual: *«A major event in your area this weekend may increase late-night crowds. Want to check how your staffing looks?»* ([RTN](https://restauranttechnologynews.com/2025/10/toast-launches-conversational-ai-assistant-to-help-restaurant-operators-work-faster-and-smarter/)) | **dato de uso real [P]:** en el 1T-2026 solo **5%** de los operadores le preguntó por eventos o clima y 1% por pronostico; el 47% pregunta por ventas, y el prompt más usado es «armame un resumen diario» (blog de Toast, visto solo en el snippet de busqueda porque la pagina dio 403) |
| **Square AI** (oct-2025) | búsqueda web: clima, eventos cercanos, reseñas | conversacional: *«Will this Fourth of July be warmer or cooler than last year?»*; en el Reino Unido: «cómo te afecta un fin de semana lluvioso o un partido de fútbol local» | ~200.000 preguntas en la beta; ninguna cifra de precision ([prensa](https://squareup.com/us/en/press/square-releases-ai), [UK](https://www.barchart.com/story/news/123694/introducing-square-ai-helping-uk-small-businesses-turn-instinct-into-confident-decisions)) |
| **Planalytics** | clima → «demanda impulsada por el clima» (Chipotle aparece como cliente) | insights para marketing y reposicion | ejemplo ilustrativo: una promo de pasta que suele dar +15% dio +40% con clima favorable [P, sin nombre de cliente] ([Planalytics](https://planalytics.com/?p=9396)) |
| **Weather Unlocked** | **no encontre ningun caso en restauracion o retail**; solo un producto para energia de 2014 | — | — |

## 2. Hoteleria y alquiler temporario

- **Duetto + PredictHQ:** los eventos entran a la optimizacion de precios y a alertas en el tablero *CommandCenter*. El problema que dicen resolver es que cada hotel llevaba su calendario de eventos «a intuicion». No publican cifras ([Duetto](https://www.duettocloud.com/library/duetto-and-predicthq-empower-hotels-with-events-data), [PredictHQ](https://www.predicthq.com/customers/duetto)).
- **RoomPriceGenie (hoteles chicos), el caso más relevante para nosotros:** integra PredictHQ, pero su propia ayuda dice *«Events are essentially informational and do not directly influence [the] dynamic price calculation»*. El precio lo mueven el ritmo de reservas y el mercado. Advierte que un festival de publico local puede no mover la demanda ([ayuda](https://help.roompricegenie.com/en/knowledge/events)). Es decir: el evento se usa como **contexto explicativo para el dueño**, no como variable del modelo.
- **IDeaS G3:** usa datos de mercado (TravelClick/Demand360, STR); los eventos los carga el equipo del hotel. No encontre una integracion con PredictHQ ([Info-Tech](https://www.infotech.com/research/data-informed-decisions-to-increase-revenue-with-ideas-g3-revenue-management-system)).
- **Atomize (Mews):** historico, reservas en cartera, competidores, búsquedas de vuelos y «presion de búsqueda». No encontre logica de eventos documentada. RevPAR +15-20% en 6-12 meses [P] ([Mews](https://help.mews.com/s/article/How-are-the-price-recommendations-calculated)).
- **PriceLabs:** «Event Detection» y tableros de mercado; caso en Nashville con ADR +250% en fines de semana de conciertos [P, un solo caso] ([PriceLabs](https://hello.pricelabs.co/event-pricing-for-airbnb/?amp=1)).
- **Beyond:** mezcla la demanda historica del evento con la demanda futura a medida que se acerca la fecha, *«so that in the rare cases where events are smaller than previous years, we won't overprice»*; también mira precios de hoteles cercanos ([blog](https://www.beyondpricing.com/eu-blog/how-beyonds-dynamic-pricing-algorithm-works-for-you)). Ocupacion +12%, ingresos +15% [P].

## 3. Retail, panaderias y supermercados

- **RELEX + PredictHQ:** «mejora significativa» al agregar feriados escolares, deportes y feriados nacionales, sin porcentaje ([MarTech Series](https://martechseries.com/predictive-ai/ai-platforms-machine-learning/relex-solutions-and-predicthq-partner-to-drive-more-accurate-forecasts-with-ai-and-data-driven-demand-planning/)). Un piloto europeo (Horizon 2020) concluyó que las variables de clima dan pronosticos «más estables y precisos», también sin cifra ([RELEX](https://www.relexsolutions.com/horizon-2020/)). Merma −10-30% con reposicion automatica en general (no atribuida al clima); Bünting −24% [P].
- **Blue Yonder:** precision «hasta 12%» o «hasta 20%» [P]. **No encontre ninguna cifra atribuible al clima** ([hoja](https://blueyonder.com/knowledge-center/collateral/demand-360-solution-sheet)).
- **Soluciones chicas para panaderias:** **Foodforecast** (Colonia) usa ventas, devoluciones, clima, eventos locales, vacaciones escolares y dia de la semana, y entrega un **pedido sugerido para el dia siguiente**; una panaderia cita −30% de merma [P] ([Foodforecast](https://foodforecast.com/en/bakeries)). **CatsAI** (Reino Unido, integrado a Cybake) usa obras viales, vacaciones escolares y clima, y declara «hasta −80% de merma» [P, agresivo] ([British Baker](https://bakeryinfo.co.uk/equipment/redblack-signs-deal-with-artificial-intelligence-start-up-catsai/646614.article)). **meteolytix** (Alemania) nacio de una panaderia que pidió pronosticos segun el clima, sin cifras publicadas.

## 4. Odontologia, salud, barberias y talleres

- **Software comercial:** **no encontre ninguno** (Fresha, Booksy, Boulevard ni software dental) que use clima, feriados o eventos para predecir ausencias o huecos. Lo que hay son recordatorios, señas y lista de espera; Fresha dice «hasta −70% de ausencias» con esas herramientas [P] ([Fresha](https://www.fresha.com/for-business/barber/how-to-run-a-fully-booked-barbershop-with-fresha)). Talleres: no encontre nada.
- **Academico [I]:** la evidencia es mixta.
  - Pediatria (Liu et al., *npj Digital Medicine* 2022): agregar el clima local «mejora la precision», sobre todo la presion atmosferica ([Healthcare IT News](https://www.healthcareitnews.com/news/researchers-create-ai-model-predict-pediatric-no-shows)).
  - Medicina familiar en Pensilvania (15 clinicas, 2019-2023, con datos climaticos): AUC 0,85, pero el predictor dominante es **la anticipacion con que se reservó el turno**, no el clima ([Ann Fam Med](https://www.annfammed.org/content/annalsfm/23/4/294.full-text.pdf)).
  - Una clinica estudiantil cita una revision sistematica en la que **1 estudio encontro asociacion con el clima y 6 no** ([Starnes, STFM](https://journals.stfm.org/media/2727/starnes-2019-0049.pdf); lo tomé del snippet, no pude extraer el PDF).
  - Odontologia (Arabia Saudita, 2022): AUC 0,72, sin clima ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9680883/)).

## 5. Estudios independientes: cuanto aporta y cuando no

**Aporta:**
- Steinker, Hoberg y Thonemann (*POM* 2017, retailer de moda online): el clima reduce el error **8,6-12,2% en promedio y hasta 50,6% en fines de semana de verano** [I] ([Univ. Colonia](https://www.wiso.uni-koeln.de/en/news/news-faculty/what-role-does-weather-play-in-e-commerce-operations/)).
- Badorf y Hoberg (*JRCS* 2020, 673 tiendas fisicas): el efecto del clima en las ventas diarias llega a 23% segun la ubicacion y a 41% segun la categoria; **su signo y tamaño cambian por tienda**; el pronostico mejora hasta 7 dias adelante y la ganancia cae con el horizonte [I] ([RePEc](https://ideas.repec.org/a/eee/joreco/v52y2020ics0969698919303236.html)).
- Huber y Stuckenschmidt (*IJF* 2020, cadena de panaderias): los **dias especiales del calendario** son el desafio principal y el ML con esas variables supera a los metodos clasicos [I] ([RePEc](https://ideas.repec.org/a/eee/intfor/v36y2020i4p1420-1438.html)).

**No aporta o aporta poco:**
- Shmueli con datos de iChef Taiwan, **restaurantes chicos**: en las ventas diarias por restaurante, clima y feriados dan **«poca precision adicional»**; sí mejoran el pronostico de **una franja de 3 horas** (la cena) [I] ([resumen](https://galitshmueli.com/node/1253); no encontre el paper completo).
- Competencias de Kaggle (Bojer y Meldgaard, *IJF*): el ganador reportó que el clima real (no un pronostico) «no ayudó mucho», y otros finalistas coincidieron [I] ([arXiv](https://arxiv.org/pdf/2009.07701); tomado del snippet).
- Schmidt et al. (MDPI 2022, un restaurante mediano): tras la diferenciacion semanal, **los feriados pesan más que la mayoria de las variables** [I] ([MDPI](https://www.mdpi.com/2504-4990/4/1/6)).
- **Quincena y dia de pago en LatAm: no encontre ningun estudio medido**, solo cronicas periodisticas. Partidos de Ecuador y efectos de lluvia en Ecuador: no encontre nada.

## Conclusiones para el inbox (lectura propia, a decidir)

1. Las cifras «30-65% más preciso» son todas del proveedor y se comparan contra un promedio de 4 semanas, una base debil. La evidencia independiente da **~10% de mejora promedio**, concentrada en **dias extremos y fines de semana**, y a veces **≈0 a nivel diario en restaurantes chicos**.
2. Los feriados y los dias especiales son la señal externa más robusta; el clima depende del local y del rubro (incluso cambia de signo); los eventos sirven si el local esta cerca y el publico es de afuera (aviso de RoomPriceGenie).
3. El patron de comunicacion que domina no es «vas a vender X% menos». Es **contexto más una pregunta o una accion** (Toast: «¿revisás el personal?»; Crunchtime: turnos y pedido sugerido; Foodforecast: pedido de mañana). RoomPriceGenie muestra eventos **sin meterlos en el modelo**.
4. La demanda real es baja: en Toast solo el 5% preguntó por clima o eventos; lo más usado es el resumen diario.
5. En agendas (odontologia, barberia) nadie lo comercializa. La anticipacion de la reserva predice mejor que el clima.
6. Para afirmar «los sábados así vendés 30% menos» hace falta historial propio con varios casos comparables. Con 90-180 dias de datos (los minimos de Tenzo y Crunchtime) habra pocos sábados de lluvia con partido: la cifra seria ruido.

---

### Fuentes externas para pronóstico de ventas/afluencia — Ecuador y LatAm (investigación 2026-10-16)

Alcance: comercios de barrio en Ecuador. Consumo esperado: una consulta por ciudad (o por celda geográfica) por día, cacheada. "No visto" significa que no encontré el dato en la fuente oficial.

## 1. Clima

| Fuente | Gratis | Pago | Histórico | Uso comercial |
|---|---|---|---|---|
| **Open-Meteo** | 10.000/día, 300k/mes | Standard USD 29/mes, 1M llamadas (blog oficial); Professional ~€99 (fuente de terceros) | ERA5 desde 1940; según la página de precios, histórico/clima piden Professional o más | **Gratis = NO comercial**: un SaaS con suscripción cuenta como comercial. Licencia de datos CC BY 4.0 |
| **WeatherAPI.com** | 100k/mes, 3 días, 1 día de histórico | Starter USD 7, Pro+ USD 25 (365 días de histórico), Business USD 65 (histórico desde 2010) | Sí, según plan | **Comercial permitido en gratis**, sin atribución obligatoria |
| **Visual Crossing** | 30k registros/mes (la página no da el tope diario) | Precios no visibles en la página (calculadora) | **50+ años en todos los planes, gratis incluido** | **Comercial permitido en gratis**, sin atribución |
| **OpenWeather** | 60/min, 1M/mes; One Call 4.0: 1.000/día gratis, después USD 0,0015 por llamada | Startup USD 40 … Expert USD 1.200 | Historia solo en Professional (USD 470) o más; bulk USD 10 por ubicación (desde 1979) | No está claro en la página |
| **Tomorrow.io** | 500/día, 25/hora | Precio no publicado (contactar) | 24 h en gratis | Probablemente no comercial (fuente vieja, sin verificar) |
| **INAMHI** | Visor web (AdaptaClima), ~90–170 estaciones | — | — | **No encontré API ni datos abiertos documentados** |

Fuentes: https://open-meteo.com/en/pricing · https://open-meteo.com/en/terms · https://openmeteo.substack.com/p/api-subscriptions-for-commercial · https://www.weatherapi.com/pricing.aspx · https://www.visualcrossing.com/weather-data-editions/ · https://openweathermap.org/price · https://support.tomorrow.io/hc/en-us/articles/20273728362644-Free-API-Plan-Rate-Limits · https://www.elcomercio.com/actualidad/ecuador/como-pronostica-el-inamhi-el-clima-la-tecnologia-detras-de-sus-alertas.html

**Lectura:** el clima es fácil, como piensa el owner, pero **Open-Meteo gratis no se puede usar legalmente en un SaaS pago**. Las dos opciones gratis con uso comercial son WeatherAPI (pronóstico diario) y Visual Crossing (histórico para cargar el pasado de cada ciudad una sola vez). Con pocas ciudades en Ecuador (~10–30 celdas), 1 llamada por ciudad por día entra holgado en cualquier plan gratis. Si en algún momento hace falta un solo proveedor, Open-Meteo Standard a USD 29/mes es lo más barato con licencia limpia. Hay que confirmar si el Standard incluye el histórico: la página de precios dice que no.

## 2. Feriados

- **Nager.Date** (gratis, sin clave): consulté `GET /api/v3/PublicHolidays/2026/EC`. Devuelve 11 fechas, **todas `global:true` y ninguna con `counties`**. Trae Guayaquil 9-oct y Cuenca 3-nov, que en Ecuador son nacionales. **No trae Quito 6-dic ni Guayaquil 25-jul.** **No aplica traslados**: devuelve 24-may (domingo) cuando el descanso real fue el lunes 25. https://date.nager.at/api/v3/PublicHolidays/2026/EC
- **`holidays` (Python, vacanza)**: Ecuador **no tiene subdivisiones**. Sí implementa la regla de traslado de la ley de 2016, vigente desde 2017 (mar→lun anterior, mié/jue→vie siguiente, sáb→vie, dom→lun, con excepciones para 1-ene, 25-dic y martes de carnaval). **No puede saber de puentes por decreto.** https://github.com/vacanza/holidays/blob/dev/holidays/countries/ecuador.py
- **Calendarific**: gratis 500 llamadas/mes con atribución; Starter USD 12/mes. Dice cubrir "3.300+ estados y regiones". **No verifiqué que tenga cantones de Ecuador.** https://calendarific.com/pricing
- **Abstract Holidays y Google Calendar público**: no los verifiqué. El calendario de Google suele traer solo los nacionales; no está confirmado.
- **Realidad en Ecuador 2026, según prensa**: el Viceministerio de Turismo publicó el cronograma 2026–2030 (1-sep-2025). En el año aparecieron **decretos ad hoc**: DE 249 (puente de Año Nuevo), DE 354 (30-abr) y DE 507 (20-nov). Los feriados locales se trasladan: Quito pasó al **lunes 7-dic-2026** y Guayaquil al **viernes 24-jul**. https://www.expreso.ec/servicios/feriados-en-ecuador-2026-2030-descarga-aqui-el-calendario-oficial-255574.html · https://www.teleamazonas.com/actualidad/noticias/ecuador/proximos-feriados-ecuador-2026-agosto-diciembre-124862/ · https://www.elcomercio.com/actualidad/ecuador/ecuador-dia-descanso-feriados-2026/ · https://www.eluniverso.com/noticias/ecuador/estos-son-los-feriados-locales-para-julio-nota/

**Conclusión:** el owner tiene razón. **Ninguna API cubre bien Ecuador a nivel cantonal ni sigue los decretos.** Hace falta una tabla propia `feriados(pais, provincia?, canton?, fecha_real, fecha_original, fuente_url)`. Se arranca con `holidays`/Nager y alguien la corrige a mano cuando sale un decreto, unas 3–5 veces por año. El costo es bajo. Para otros países, `holidays` sí tiene subdivisiones en varios (AR, BR, MX, CO, entre otros); habría que verificarlo país por país.

## 3. Eventos

- **PredictHQ**: no publica precios. Los directorios de software dicen que arranca en **~USD 500 por usuario por año** y que el precio depende de las categorías y ciudades contratadas; hay trial. No encontré un plan para startups. **No verifiqué cobertura en Ecuador.** https://www.capterra.com/p/153702/PredictHQ/
- **Ticketmaster Discovery**: la lista de países de su feed oficial no incluye Ecuador; en LatAm solo aparece **MX**. https://developer.ticketmaster.com/products-and-docs/apis/discovery-feed/
- **Eventbrite**: **quitó la búsqueda pública en feb-2020**. Hoy solo se consulta por evento, venue u organizador conocido. Lo que queda son scrapers de terceros (Apify).
- **Meetup**: la API (GraphQL) requiere Meetup Pro según su propia página. https://www.meetup.com/meetup_api/auth
- **Google Events vía SerpAPI**: gratis 250 búsquedas/mes, Starter USD 25 por 1.000. Con una búsqueda por ciudad por día, 10 ciudades son unas 300/mes: apenas se pasa del plan gratis. Es la vía más realista para conciertos y ferias grandes en Quito y Guayaquil. https://serpapi.com/pricing
- **Facebook Events, SeatGeek, Songkick, Bandsintown**: no verifiqué su estado actual. Facebook cerró la búsqueda pública de eventos hace años, pero no lo confirmé en esta pasada. Bandsintown y Songkick buscan por artista, no por ciudad.

**Conclusión:** para eventos de barrio (ferias, procesiones, fiestas parroquiales) **no hay fuente**. Lo grande (conciertos, estadio) se cubre parcialmente con SerpAPI y fútbol.

## 4. Fútbol

- **API-Football**: gratis ~100 requests/día (según su guía). Pro cuesta USD 19/mes en su sitio o USD 15 en RapidAPI, con 7.500/día. Dice cubrir 1.200+ ligas. **LigaPro no está confirmada**: se prueba con `/leagues?country=Ecuador` usando la clave gratis. https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide
- **football-data.org**: el plan gratis "para siempre" cubre 12 competencias (Mundial incluido, Brasil Serie A). **No tiene LigaPro.** Libertadores y Eliminatorias aparecen solo en planes pagos. https://www.football-data.org/coverage
- **TheSportsDB**: gratis con tope de 30 req/min y consultas limitadas; USD 9 o 20/mes. https://www.thesportsdb.com/pricing

El calendario de la Selección (Eliminatorias, Mundial 2026) se puede curar a mano: son pocos partidos al año y pesan mucho. Para LigaPro y Libertadores (Barcelona, Emelec, LDU, IDV), API-Football gratis alcanza con una consulta diaria.

## 5. Calendario socioeconómico (todo curado a mano)

No hay API para esto. Son fechas fijas o publicadas una vez al año:
- **Décimo cuarto**: Costa y Galápagos hasta el 15-mar; Sierra y Amazonía hasta el 15-ago (USD 482 en 2026). **Décimo tercero**: diciembre (por ley hasta el 24-dic; verificar en el Ministerio del Trabajo). Quincena y fin de mes. https://www.expreso.ec/actualidad/economia/decimo-cuarto-sueldo-en-ecuador-2026-cuanto-deben-pagarte-275386.html
- **Clases**: Sierra y Amazonía arrancaron el 1–3 de septiembre de 2026, de forma escalonada; Costa y Galápagos en mayo de 2026 (fechas de prensa; confirmar en MinEduc). Las escuelas particulares pueden variar. https://www.elcomercio.com/actualidad/ecuador/estas-fechas-clave-nuevo-calendario-escolar/
- **Comerciales**: Día de la Madre (2.º domingo de mayo), Padre, San Valentín, Black Friday, Navidad, fiestas de Quito, Carnaval. Además, el pago de bonos estatales, que hay que verificar.

Todo esto entra en una sola tabla `calendario_contexto(region, tipo, fecha, peso)` que se revisa una vez al año.

## 6. El dueño como fuente

No encontré un producto que use la nota libre del dueño para entrenar el pronóstico. Lo que existe:
- herramientas para restaurantes que avisan de picos o caídas por la noche (https://qamarero.com/en/restaurant-ai-analytics/);
- otras que meten eventos y clima en el modelo (Tenzo https://www.gotenzo.com/product-predict/, 5-Out https://www.5out.io/post/how-restaurant-forecasting-software-can-boost-your-profits);
- y PredictHQ, que vende el análisis de impacto de eventos.

El flujo "el 12 vendiste el doble, ¿qué pasó?" con respuestas rápidas (feria/evento, partido, clima, promo, cerré, otro) **no lo encontré en ningún producto que revisé, así que es diferenciador**. Además tiene dos usos:
1. **Etiquetar outliers**, para que no contaminen el modelo.
2. **Crear eventos recurrentes por barrio**: si varios comercios cercanos marcan "feria" el mismo día, se infiere un evento de zona y se avisa a los demás.

## Recomendación

**Día 1 (USD 0):**
- **Clima**: WeatherAPI gratis para el pronóstico diario por ciudad y Visual Crossing gratis para cargar el histórico. Ambos permiten uso comercial. No usar Open-Meteo gratis.
- **Feriados**: librería `holidays` (aplica la regla de traslado) más una **tabla propia curada** con locales y cantonales (Quito, Guayaquil 25-jul, fundaciones de cada cantón donde haya clientes) y decretos.
- **Calendario curado**: décimos por región, quincenas, inicio y fin de clases Sierra/Costa, fechas comerciales y partidos de la Selección.
- **El dueño**: botón "marcar evento" y la pregunta automática ante una anomalía.

**Después (cuando haya volumen o tracción):**
- API-Football gratis para LigaPro y Libertadores, después de confirmar cobertura con una llamada de prueba.
- SerpAPI Google Events para Quito y Guayaquil (USD 0–25/mes).
- Open-Meteo Standard (USD 29/mes) si conviene un solo proveedor.
- PredictHQ solo si la expansión a ciudades grandes de LatAm lo justifica; pedir cotización y verificar cobertura en EC.

**No vale la pena:** Ticketmaster, Eventbrite y Meetup para Ecuador, ni INAMHI como API.

**Pendientes de verificar:** precio de Visual Crossing Professional, tope diario del plan gratis, licencia comercial de Tomorrow.io, Calendarific a nivel cantonal, cobertura de PredictHQ en EC y LigaPro en API-Football.

---

## Capacidades → valor (informes 6 y 7, 2026-10-16)

> [P]/[PROV] = cifra del proveedor; [I]/[IND] = independiente. Los USD son aritmética de los subagentes sobre las cifras citadas. Varios números vienen de resúmenes secundarios, sin abrir el original.

---

### Para qué se usa el software de food/retail chico y qué le deja al dueño (investigación 2026-10-16)

Local de referencia: vende $6.000/mes con food cost del 35%, o sea **$2.100/mes en insumos** y $3.900 de margen bruto. Etiquetas: **[P]** = cifra del proveedor (marketing, casos elegidos por él), **[I]** = independiente (estudio, ONG, paper). Casi todo lo que se publica es [P].

## 1. Catálogo de capacidades (deduplicado)

| # | Capacidad | Quién la tiene | Qué ve el dueño | Datos que exige | Fricción |
|---|---|---|---|---|---|
| C1 | **Costeo de receta y margen por plato** | meez, Apicbase, MarketMan, MarginEdge, xtraCHEF, R365, Fudo, Supy | costo y % de cada producto; margen en $ | recetas con gramajes + precio por insumo | **Alta al inicio** (cargar recetas), baja después |
| C2 | **Captura de facturas → precio vivo de insumos** | MarginEdge (foto/email/EDI, línea a línea en 24–48 h), xtraCHEF, Supy (foto o email, ~5 s), MarketMan, R365 | lo gastado por proveedor/categoría | factura (foto) | Baja **si** la foto alcanza; alta si hay que tipear |
| C3 | **Alerta de suba de proveedor** | xtraCHEF Price Tracker y alertas, MarginEdge, Supy (marca en naranja diferencias de precio/cantidad) | «el queso subió 12% vs. las últimas 4 semanas» | C2 | Ninguna extra sobre C2 |
| C4 | **Conteo de inventario y valor de stock** | WISK, MarketMan, Apicbase, Lightspeed, Loyverse (Advanced Inventory $25/mes), Fudo | stock en unidades y $ | conteo físico periódico (WISK recomienda semanal) | **Alta y repetitiva** |
| C5 | **Stock mínimo / pedido sugerido** | Loyverse (alerta de stock bajo por email, gratis; órdenes de compra son pagas), MarketMan (pedido por par + pronóstico), Supy | «pedí 3 kg de harina» | stock teórico (ventas − recetas) + mínimos | Media (definir mínimos) |
| C6 | **Merma teórica vs. real (AvT)** | R365, MarginEdge, MarketMan, xtraCHEF | brecha entre lo que debiste gastar y lo que gastaste; porciones grandes, robo, desperdicio | C1 + C2 + C4 + ventas | **Muy alta** (suma todas) |
| C7 | **Medición de desperdicio** | Winnow (balanza + cámara), Apicbase, Supy | kg/$ tirados por producto y motivo | registrar cada descarte | Alta sin hardware |
| C8 | **Pronóstico de ventas/producción** | Foodforecast (panadería), Tenzo, Supy, MarketMan | «mañana hornea 40 medialunas, no 60» | historial de ventas (+ clima, feriados) | **Baja**: sale del POS |
| C9 | **Venta del excedente** | Too Good To Go | plata por lo que sobró | publicar bolsas | Baja |
| C10 | **Turnos y costo laboral** | 7shifts, Tenzo, Toast, Square | horarios, % de mano de obra, horas extra | plantilla, ventas por hora | Media |
| C11 | **Resumen diario / cierre** | Toast (email diario, reporte Z), Square (Daily Sales Summary por email), Loyverse, Fudo | ventas, tickets, descuentos, anulaciones, medios de pago | ninguno (sale del POS) | **Nula** |
| C12 | **Conciliación de caja / anulaciones** | Toast (Sales Summary usado para cuadrar caja y vigilar descuentos/anulaciones), Fudo (movimientos de caja), Square | diferencia de caja; quién anula o descuenta | apertura/cierre de caja | Baja |
| C13 | **P&L y punto de equilibrio** | R365, MarginEdge (P&L semanal), Tenzo («prime cost») | ganancia de la semana; cuánto hay que vender para no perder | ventas + compras + gastos fijos | Media (los gastos fijos hay que cargarlos) |
| C14 | **Menu engineering** | meez, Apicbase, MarginEdge, Toast | matriz popularidad × margen: estrellas, caballos, perros | C1 + ventas por producto | Ninguna extra sobre C1 |
| C15 | **Fidelización y recuperación de clientes** | Square Loyalty/Marketing («We Miss You»), Toast, Lightspeed, Loyverse | clientes perdidos, campaña automática, ventas atribuidas | identidad del cliente en la venta | Baja si el POS lo captura |

## 2. Impacto medido

- **C1/C2/C6, food cost.** MarketMan dice 2–5 puntos menos de food cost en el primer año (QSR Magazine) y «4% promedio» [P] ([QSR](https://www.qsrmagazine.com/news/streamlined-solution-help-minimize-food-waste/), [MarketMan](https://marketman.com/restaurant-inventory-management)). meez se contradice sola: 3–5% de COGS en un lugar y 15–25% de «plated food cost» en otro [P] ([meez ROI](https://www.getmeez.com/calculate-your-roi)). Apicbase: 8% (Bright Kitchen), 2% (CitizenM) y «hasta 28%» [P] ([casestudies](https://www.casestudies.com/company/apicbase), [Eposnow](https://www.eposnow.com/uk/store/software/apps/apicbase/)). Tenzo: un cliente dice «unos 3 puntos de prime cost» [P]. MarginEdge **no publica cifra de ahorro**, solo testimonios cualitativos ([CFO Club](https://thecfoclub.com/tools/marginedge-review/)). No encontré un estudio independiente sobre costeo + AvT. **En USD:** 2 puntos sobre $6.000 son **$120/mes**; 4 puntos, $240/mes.
- **C3, alerta de suba.** No hay ninguna cifra publicada, ni [P] ni [I] ([Toast xtraCHEF](https://support.toasttab.com/en/article/xtraCHEF-Price-Tracker)). Ejemplo hipotético: si el 20% del gasto ($420) sube 10% y no se reacciona, se pierden ~$42/mes.
- **C7, desperdicio.** Este es el dato independiente más sólido. WRAP/WRI para Champions 12.3 estudiaron 114 restaurantes: **$7 de retorno por cada $1 invertido**, **−26% de desperdicio en el primer año** y más del 75% recuperó la inversión en un año [I] ([WRAP](https://www.wrap.ngo/resources/business-case-reducing-food-loss-and-waste/restaurants), [Waste360](https://www.waste360.com/food-waste/report-how-restaurants-saved-money-reducing-food-waste)). Según Winnow, el desperdicio es el **4–13% del costo de comida**, se reduce más de 50% y baja el food cost 2–8 puntos [P, sobre ~400 cocinas] ([EPA/Winnow](https://www.epa.gov/sites/default/files/2019-12/documents/winnow_presentation_12_19_19.pdf)). ReFED pone el *tracking & analytics* como la primera solución para foodservice, con ≥$1.000 M de ahorro en EE.UU. [I] ([ReFED](https://refed.org/foodservice)). **En USD:** desperdicio de $84–273/mes; un −26% da **$22–71/mes**.
- **C8, pronóstico (panadería).** Un análisis de ciclo de vida *peer-reviewed* mide **−30% de devoluciones de pan** con Foodforecast [I] ([Journal of Industrial Ecology vía IDEAS](https://ideas.repec.org/a/bla/inecol/v28y2024i5p1117-1131.html)); un caso propio llega a −35% [P] ([Düsmann](https://foodforecast.com/en/bestpractice/backerei-duesmann---handwerksbackerei-aus-gronau)). Tenzo dice que sus pronósticos aciertan 30–50% más que el promedio de 4 semanas y que Nando's subió 15% la productividad laboral [P] ([Nando's PDF](https://www.gotenzo.com/wp-content/uploads/2023/05/Nandos-Case-Study.pdf)). **En USD:** a una panadería que tira el 8% de $2.100 ($168), un −30% le deja **~$50/mes**.
- **C9, excedente.** Solo hay agregados: $57 M ganados por los socios en total [P] ([Boston Globe](https://mobileapp.bostonglobe.com/01292025_31074bf8-dce2-11ef-89e2-f5a4a587b4e6/content.html)). La comisión ronda $1,79 por bolsa más ~$89 al año (dato de terceros, sin verificar) ([MoneyPantry](https://moneypantry.com/too-good-to-go-review/)). No hay cifra por local.
- **C10, turnos.** 7shifts promete ahorrar 14 h/mes a los gerentes, bajar 1–3% el costo laboral y «hasta $3.000/año»; tiene un caso con −8% (Snakes & Lattes) [P] ([7shifts](https://www.7shifts.com/blog/snakes-and-lattes)). Con 1–2 empleados de horario fijo esto pierde casi todo el sentido.
- **C4, tiempo de conteo.** Los testimonios de WISK hablan de 2 h → 10–20 min y de 4,5 h/semana ahorradas [P] ([WISK](https://www.wisk.ai/stories)). Ojo: es tiempo ahorrado **frente a contar a mano**, no frente a no contar.
- **C12, caja/robo.** Se repite «4% de las ventas» y «75% del faltante de inventario es robo interno», atribuido a la NRA pero siempre citado por vendedores; no encontré la fuente primaria ([Restroworks](https://www.restroworks.com/blog/restaurant-employee-theft-statistics/), [Avero](https://averoinc.com/avero-restaurant-software-white-paper-stop-fraud-and-prevent-theft-using-pos-data/)). Si fuera cierto, el 4% de $6.000 serían $240/mes, pero la cifra no está verificada.
- **C13, tiempo administrativo.** Un estudio de Square y AmEx en el Reino Unido dice que los dueños dedican **13 h/semana** a tareas administrativas [P, encuesta gated] ([Restaurant Online](https://www.restaurantonline.co.uk/All-products/Reclaim-your-time-your-guide-to-streamlining-operations/)).
- **C14, menu engineering.** El «+10% de rentabilidad (Cornell 2014)» no se puede verificar; solo hay un caso en Odesa con +15,8% de ventas, que mezcla rediseño y menu engineering [I, n=1] ([journals.uran.ua](https://journals.uran.ua/tarp/article/view/253040)). La cifra del «+27% por etiquetas descriptivas» viene de Wansink y está desacreditada ([Duck-Hub](https://www.duck-hub.com/blog/menu-engineering-statistics)).
- **C15, fidelización.** Square dice que los inscriptos gastan **53% más y visitan 40% más** [P, con sesgo de selección: se inscriben los que ya son fieles] ([Square](https://square.com/us/en/software/loyalty)). En campañas de recuperación, se vuelve a activar el **8–18%** de los inactivos (12–18% a 30 días, 4–7% a 90 días) [P, Chowly] ([Chowly](https://chowly.com/resources/blogs/restaurant-win-back-emails-recover-lapsed-customers/)). **En USD:** recuperar 10 de 80 inactivos × 4 visitas × $5 de ticket da $200 de venta y unos **$130 de margen bruto** al mes. Es un supuesto mío, no una cifra medida.

**Sobre la hipótesis del owner.** Es correcta si se compara contra el margen de contribución, no contra la venta. $10 ahorrados en insumos son $10 de ganancia. Para ganar esos $10 con ventas nuevas hacen falta ~$15,4 de venta (margen bruto del 65%), sin contar el descuento o premio que cuesta atraerlas. En la práctica, un cliente que «deja $5 de ganancia» equivale a $5 de ahorro, ni más ni menos. Lo que inclina la balanza a favor del ahorro es la **certeza**: no depende de la conducta de un tercero y se repite todos los meses. En montos para este local, el costeo + la alerta de suba (~$40–240) y la merma (~$20–70) quedan en el mismo orden que la recuperación de clientes (~$50–130). Ninguno domina con claridad.

## 3. Clasificación para un micro-comercio

| Capacidad | Categoría | Impacto | Por qué |
|---|---|---|---|
| C1 Costeo/margen por producto | Ganar más (precio) y ahorrar dinero | **Alto** | El dueño no sabe sus márgenes; un solo producto vendido a pérdida o la falta de un ajuste de precio pesan más que todo lo demás. Una vez cargado, se mantiene solo |
| C3 Alerta de suba | Ahorrar dinero | **Alto** | Con la inflación de insumos es lo más accionable («subí el precio» o «cambiá de proveedor»). Depende de C2 |
| C2 Captura de facturas | Ahorrar tiempo | Medio | Vale como habilitador; Gastos por foto/dictado ya lo cubre |
| C11 Resumen diario | Ahorrar tiempo | **Alto** (por adopción) | Sin fricción; es el hábito que sostiene el inbox |
| C13 Punto de equilibrio / P&L simple | Ganar más y ahorrar dinero | **Alto** | Es la pregunta que el dueño no sabe contestar: «¿cuánto tengo que vender por día?». Pide gastos fijos (Gastos) |
| C8 Pronóstico de producción | Ahorrar dinero | **Alto en panadería**, medio en cafetería | La merma de perecibles del día es la mayor fuga; los datos salen del POS |
| C5 Stock mínimo / qué comprar | Ahorrar tiempo y evitar quiebres (ganar más) | Medio | Se puede inferir de ventas × recetas sin contar |
| C15 Recuperación de clientes | Ganar más | Medio | Ya existe en CheckPass (fidelidad); medir lo atribuido evita sobrevalorarlo |
| C14 Menu engineering | Ganar más | Medio | Sale gratis de C1 + ventas; con 20–40 productos se lee a simple vista |
| C12 Conciliación de caja | Ahorrar dinero | Medio | Con 1–2 empleados el robo es posible, pero la cifra del sector no está verificada |
| C7 Medición de desperdicio | Ahorrar dinero | Medio | Es el mejor ROI independiente (7:1), pero exige registrar cada descarte |
| C9 Venta de excedente | Ganar más | Bajo-medio | Es un canal externo, no analítica |
| C6 AvT completo | Ahorrar dinero | Bajo (por fricción) | Exige conteos + facturas + recetas exactas |
| C4 Conteo completo | Ahorrar dinero | Bajo | Mucho trabajo para un dueño solo |
| C10 Turnos/costo laboral | Ahorrar dinero y tiempo | **Bajo** | 1–2 empleados de horario fijo |

## 4. Qué fracasa por fricción y los trucos que usan los productos

**Lo que fracasa con micro-comercios:** el AvT completo (C6), el conteo total semanal (C4), el registro de cada descarte (C7) y las recetas al gramo de todo el menú (C1 completo). Las herramientas de esta clase apuntan a cadenas: MarginEdge arranca en ~$330 por local al mes ([CFO Club](https://thecfoclub.com/tools/marginedge-review/)); meez y R365 se venden a grupos con «culinary directors». Su premisa es que hay un gerente que cuenta.

**Trucos para bajar la fricción (con fuente):**
- **Foto o email de la factura** con extracción línea a línea: MarginEdge, Supy (96%+ de precisión y ~5 s, [P]) ([Supy](https://supy.io/product-features/invoice-receiving)). Para CheckPass equivale a Gastos por foto/dictado.
- **Excepciones en vez de revisión**: Supy y xtraCHEF solo muestran lo que difiere (precio o cantidad) y lo marcan con color, y permiten filtrar los insumos «close watch» elegidos por el dueño. Es lo que pide el inbox: pocos ítems vigilados.
- **Conteo parcial o de los ítems clave**: los «close watch items» de xtraCHEF y los conteos rápidos con varios usuarios de WISK. Contar 5–10 insumos caros en vez de todo.
- **Stock inferido desde ventas × recetas**: el inventario teórico de MarketMan/Loyverse con alerta de mínimo por email. No hace falta contar para avisar «se te acaba».
- **Pronóstico solo con el POS**: Foodforecast/Tenzo no piden carga manual; el dato ya existe.
- **Receta aproximada**: el truco implícito en todos es arrancar con los 5–10 productos más vendidos (resuelve la mayor parte del margen) y no con el menú completo. Es una inferencia mía; ningún proveedor publica la cifra.
- **Resumen empujado** por email (Toast, Square) en lugar de un tablero que hay que ir a mirar. En los foros de Square, los usuarios piden que el resumen incluya más (% laboral, desglose por medio de pago), lo que confirma que es el canal que realmente leen ([Square Community](https://community.squareup.com/t5/Feedback-Discussions/How-can-a-better-version-of-the-Daily-Summary-email-help-you/m-p/722261/highlight/true)).

**Límites:** casi todas las cifras de ahorro son de proveedores, y de casos elegidos por ellos. Las independientes son WRAP/Champions 12.3 (desperdicio, 7:1 y −26%), el ciclo de vida de Foodforecast (−30% de devoluciones de pan) y ReFED (ranking de soluciones). No encontré cifras publicadas para la alerta de suba, la conciliación de caja ni el punto de equilibrio. Los montos en USD son aritmética sobre esas cifras, no mediciones.

---

### Qué le da realmente cada software al dueño (turnos, finanzas, fidelidad)

Investigación web del 2026-10-16. Etiquetas: **[IND]** = cifra independiente (académica o de un organismo), **[PROV]** = la publica el proveedor o un blog de proveedor, sin metodología. **«sin dato»** = no encontré ninguna cifra que se pueda citar.

## Conclusión corta

1. Casi todas las cifras de impacto que circulan son **[PROV]**. Solo cuatro son independientes y sirven para decidir: recordatorios (−25% de inasistencias en salud), reseñas (+5-9% de ingresos por estrella en restaurantes independientes), referidos (+16% de valor del cliente, −18% de abandono) y tarjetas de sellos con progreso regalado (la tasa de completar casi se duplica).
2. La frase «retener cuesta 5-25 veces menos» y el «+5% de retención = +25-95% de ganancia» **no tienen base empírica**. Vienen de un experimento mental de Reichheld y Sasser (HBR, 1990), y Byron Sharp lo critica ([marketingscience.info](https://marketingscience.info/news-and-insights/loyalty-myths)). No conviene usarlas en la UI.
3. **La hipótesis del owner se sostiene en comida y en negocios con stock.** Cada dólar de merma ahorrado es ganancia neta. Un cliente nuevo aporta solo su margen y además cuesta traerlo. En barbería y odontología, en cambio, la palanca grande es el **turno vacío**, porque el costo variable de un servicio es casi nulo.

## 1. Catálogo de capacidades

| Capacidad | Productos | Qué ve el dueño | Datos que exige | Carga manual |
|---|---|---|---|---|
| Recordatorios y confirmación de turno | Booksy, Fresha, Vagaro, Squire, Boulevard, Weave, Dentalink, Tekmetric, AutoLeap | turnos confirmados o sin confirmar, % de inasistencias | agenda y teléfono del cliente | nula (automático) |
| Seña o cobro por inasistencia | Booksy (No-Show Protection), Fresha, Vagaro, Squire | dinero retenido por inasistencias | tarjeta guardada o pago anticipado | baja, pero genera fricción con el cliente |
| Llenar huecos (lista de espera) | Fresha, Vagaro, Boulevard | horas libres, aviso a quienes esperan | agenda y lista de espera | baja |
| Recall o servicio periódico | Weave, Dentrix, Open Dental, Dentalink, Tekmetric, Shopmonkey, AutoLeap | «X pacientes o autos vencidos» | fecha del último servicio y el intervalo de cada servicio | nula si el servicio queda registrado |
| Presupuestos rechazados para seguir | Tekmetric, AutoLeap, Shopmonkey, Dentrix (tratamiento no agendado) | lista de trabajos que el cliente dejó para después | presupuesto por ítem marcado como aprobado o rechazado | media (cargar el presupuesto) |
| Inspección con fotos para aprobar | Tekmetric, AutoLeap, Shopmonkey | tasa de aprobación, ticket promedio | fotos y presupuesto | media |
| Recuperar clientes inactivos | Squire, Booksy, Fresha, Thanx, Square Loyalty, Weave | «N clientes no vuelven hace 60 días» | historial de visitas por cliente identificado | nula una vez identificado el cliente |
| Retención de clientes nuevos (2.ª visita) | Boulevard, Phorest | % de primerizos que vuelven | cliente identificado en cada visita | nula |
| Fidelidad (sellos o puntos) | Square Loyalty, Toast, Thanx, SumUp/Fivestars, Loopy, Stamp Me | socios, canjes, frecuencia de socios contra no socios | identificar al cliente en el cobro | baja a media (ese paso en caja) |
| Referidos | Thanx, Squire, Fresha, Booksy | quién trajo a quién | enlace o código | baja |
| Reseñas | Weave, Booksy, Fresha, Squire, Tekmetric | cantidad y nota de reseñas | teléfono y un pedido después de la visita | nula |
| Stock: alertas, merma y costo | Square, Kyte, Treinta, Alegra, Siigo, Toast | faltantes, sobrestock, margen por producto | compras y conteos | **alta** (conteos y carga de compras) |
| P&L simple | QuickBooks, Xero, Wave, Alegra, Siigo, Treinta | ingresos − gastos = ganancia | ventas (ya están en el POS) y **gastos** | alta sin captura fácil de gastos |
| Captura de gastos (foto o voz) | QuickBooks, Xero (Hubdoc), Wave, Alegra | gastos por categoría | foto del comprobante | baja si hay lectura automática (OCR) |
| Conciliación bancaria | QuickBooks, Xero, Wave, Alegra, Siigo | movimientos sin cuadrar | feed del banco | media |
| Flujo de caja proyectado | Float, Fathom, Pulse, QuickBooks | saldo previsto a 30-90 días | ventas recurrentes, gastos fijos, cuentas por cobrar | media a alta |
| Fiado y cuentas por cobrar | Treinta, Kyte, Alegra, Siigo, Xero, Wave | quién debe, cuánto y desde cuándo, con recordatorio | venta a crédito asociada a un cliente | baja |
| Factura electrónica SRI | Alegra, Siigo (Ecuador) | comprobantes emitidos | RUC y datos del cliente | media |
| Adelanto o crédito sobre las ventas | Square Capital, Mercado Pago | oferta de préstamo | historial de cobros | nula (pero el préstamo es caro) |

## 2. Impacto medido

- **Recordatorios.** En un metaanálisis de 21 estudios en salud, las inasistencias bajaron de 21% a 15% (RR 0,75). Varios avisos funcionan mejor que uno **[IND]** ([PubMed 27798006](https://pubmed.ncbi.nlm.nih.gov/27798006/)). Otra revisión encontró que el recordatorio automático baja la inasistencia 29% y la llamada manual 39% **[IND]** ([PMC3188816](https://pmc.ncbi.nlm.nih.gov/articles/PMC3188816/)).
- **Seña por inasistencia.** −20% de cancelaciones al mes de activarla **[PROV]** ([BarberEVO/Booksy](https://www.barberevo.com/reduce-the-pain-of-client-no-shows-and-cancellations)).
- **Lista de espera.** «Llena el 80% de los huecos» **[PROV, no se puede rastrear]** ([schedulingkit](https://schedulingkit.com/statistics/waitlist-management-statistics)).
- **Segunda visita en salones.** Los salones promedio retienen 45% de los primerizos y los mejores 70%. Base: 4 millones de clientes de su propia plataforma **[PROV con muestra grande]** ([Boulevard](https://www.joinblvd.com/newsroom/boulevard-report-reveals-top-performing-salons-retain-56-percent-more-first-time-visitora)).
- **Recall dental.** Cumplimiento del 60-70%; la reactivación logra que agende entre 10% y 40% de los inactivos **[PROV sin fuente primaria]** ([ainora](https://ainora.lt/blog/dental-recall-reactivation-statistics-benchmarks), [clerri](https://clerri.com/blog/dental-patient-reactivation-statistics/)).
- **Talleres.** Con inspección digital la aprobación se duplica **[PROV, no verificado]** ([ustechautomations](https://ustechautomations.com/resources/blog/automate-tekmetric-vs-shopmonkey-for-auto-repair-shops-2026)). Para el seguimiento de presupuestos rechazados: **sin dato**.
- **Reseñas.** Una estrella más en Yelp equivale a +5-9% de ingresos, y el efecto aparece solo en restaurantes independientes, no en cadenas **[IND]** ([Harvard Magazine/Luca](https://www.harvardmagazine.com/node/33472)).
- **Referidos.** El cliente referido vale al menos 16% más, abandona 18% más lento y la diferencia en retención no se borra con el tiempo. El dato es de un banco alemán **[IND]** ([Schmitt, Skiera y Van den Bulte, J. Marketing 2011](https://faculty.wharton.upenn.edu/wp-content/uploads/2012/04/Schmitt-Skiera-vandenBulte-2011-Referral-Programs-Customer-Value.pdf)).
- **Fidelidad: lo que dice el proveedor.** Los socios gastan +53% y vienen +40% más seguido **[PROV, con sesgo de autoselección]** ([Square](https://square.com/us/en/software/loyalty)). Thanx reporta +30% de frecuencia **[PROV, cadenas]** ([Thanx](https://www.thanx.com/increase-visit-frequency)).
- **Fidelidad: lo independiente.** El programa produce «poca lealtad extra», y en supermercados el cambio se diluye a los 6-9 meses **[IND]** (Sharp y Sharp 1997, [resumen](https://en.wikipedia.org/wiki/Byron_Sharp)). **Lo que sí funciona es el diseño de la tarjeta:**
  - Con 2 sellos regalados de entrada, la tasa de completar la tarjeta sube de 19% a 34% **[IND]** (Nunes y Drèze 2006, lavadero de autos; [resumen](https://www.coglode.com/nuggets/endowed-progress-effect)).
  - Los clientes compran más seguido a medida que se acercan al premio, y quien acelera hacia el primer premio tiene más probabilidad de quedarse **[IND]** ([Kivetz, Urminsky y Zheng 2006](https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf)).
- **Adopción de fidelidad.** El 73% de los comercios chicos no tiene programa de fidelidad **[PROV, encuesta]** ([SumUp](https://www.newswire.com/view/content/73-of-small-businesses-still-operate-without-loyalty-programs-sumup-22688969)).
- **Stock y merma.**
  - Entre 4% y 10% de la comida que compra un restaurante no llega a servirse; lo razonable sería 2-4% **[IND en parte]** ([therestauranthq](https://therestauranthq.com/?p=2827249), [FSR](https://www.fsrmagazine.com/feature/save-your-restaurant-thousands-following-one-system/)).
  - En retail, la merma es 1,6% de las ventas y el 65% es robo **[IND]** ([NRF 2023](https://www.nrf.com/research/national-retail-security-survey-2023)).
- **Flujo de caja.** El 61% tiene problemas de caja y el 32% no pudo pagar a proveedores, sueldos o a sí mismo **[PROV: encuesta encargada por Intuit]** ([Intuit](https://investors.intuit.com/news-events/press-releases/detail/282/quickbooks-study-cash-flow-woes-mean-a-third-of-small-businesses-cant-make-payroll-pay-bills)).
- **Cobranza.** Las facturas tardan 28,5 días en cobrarse y llegan 9,8 días tarde. Son datos agregados de usuarios de Xero en EE. UU. **[PROV]** ([Xero](https://www.xero.com/us/media-releases/xero-data-reveals-sales-show-signs-of-recovery)). Para el fiado de barrio: **sin dato**.
- **Horas ahorradas en contabilidad.** **Sin dato confiable.** El 54% de las microempresas del Reino Unido lleva las cuentas en papel o Excel **[PROV, YouGov]** ([AccountancyAge](https://www.accountancyage.com/aa/news/1748408/only-smes-accounting-software)). Treinta afirma que «el 90% de los micronegocios de LatAm usa cuaderno» **[PROV]** ([Forbes Co](https://forbes.co/2021/06/29/emprendedores/treinta-recauda-us-14-3-millones-para-facilitar-el-manejo-de-las-finanzas-en-las-microempresas/)).

**Traducción a USD para un local de $5.000/mes.** Son cálculos ilustrativos; los supuestos están marcados.

- **Comida, merma.** Con un costo de mercadería del 30% ($1.500 al mes), pasar de 6-8% de merma a 3% ahorra **$45-75 al mes de ganancia neta**. Es el margen de 9 a 15 clientes nuevos de $5 cada uno. Respalda la hipótesis del owner.
- **Barbería, inasistencias.** Supuestos: ticket de $10, 500 servicios al mes, 10% de inasistencias. Son 50 turnos perdidos ($500). Con −25% gracias a los recordatorios se recuperan unos **$125 al mes**, siempre que esa hora no se hubiera vuelto a ocupar igual.
- **Reseñas.** Un restaurante independiente que sube una estrella completa ganaría **+$250-450 al mes**. Subir una estrella entera es difícil.
- **Segunda visita.** Supuesto: 30 clientes nuevos al mes. Subir la retención de 45% a 55% suma 3 clientes recurrentes por mes. Como el efecto se acumula, al año son unos 36 clientes de ~$10 al mes, es decir **~$360 al mes al cabo del año**.

## 3. Clasificación para un micro-comercio

| Capacidad | Eje | Impacto | Por qué |
|---|---|---|---|
| Stock: merma, faltantes, sobrestock | ahorrar dinero | **alto** (comida y reventa), bajo (servicios) | el ahorro va directo a ganancia |
| Recordatorios y confirmación | ganar más | **alto** (servicios con turno) | es la única evidencia independiente fuerte y la carga es nula |
| Recall o servicio periódico | ganar más | **alto** (odontología, taller), medio (barbería) | ingreso que se pierde por olvido |
| Segunda visita y recuperar inactivos | ganar más | **alto** | más barato que captar (sin cifra independiente de cuánto) |
| Fiado y cuentas por cobrar | ahorrar dinero | **alto** donde hay fiado | plata ya ganada que no se cobra |
| P&L con gastos | ahorrar dinero y tiempo | medio-alto | muestra la fuga, pero no actúa solo |
| Flujo de caja proyectado | ahorrar dinero | medio | útil, pero exige datos que el micro no carga |
| Reseñas | ganar más | medio | IND, pero el efecto aparece por saltos de rating |
| Presupuestos rechazados | ganar más | medio-alto (taller, odontología) | sin dato; la lógica es sólida |
| Fidelidad (sellos) | ganar más | **bajo-medio** | el efecto IND es chico, salvo con buen diseño de tarjeta y para identificar al cliente |
| Referidos | ganar más | medio | IND +16% de valor, pero el volumen es bajo |
| Seña por inasistencia | ahorrar dinero | medio | funciona, pero tensiona con el cliente de barrio |
| Lista de espera | ganar más | bajo-medio | sirve solo si hay demanda sobrante |
| Conciliación y factura SRI | ahorrar tiempo | medio | ver el punto 5 |
| Adelanto sobre ventas | — | bajo o negativo | crédito caro |

**El valor oculto de la fidelidad:** sirve menos para «generar lealtad» y más para **identificar al cliente**. Con eso se habilitan la segunda visita, la recuperación de inactivos, el recall y los referidos, que son las capacidades de impacto alto.

## 4. Universales y propias de cada rubro

**Universales (incluida comida):**
- P&L con gastos
- caja y fiado
- stock de lo que se vende o se usa como insumo
- retención de clientes nuevos y recuperación de inactivos (exige cliente identificado)
- reseñas
- referidos
- fidelidad
- factura SRI

**Propias de cada rubro:**
- **Con turnos** (barbería, odontología, taller): recordatorios, seña, lista de espera.
- **Odontología y taller:** recall por intervalo de servicio, presupuestos rechazados, inspección o fotos.
- **Comida:** merma, costo por plato y margen por producto. Este es el eje dominante del rubro.

## 5. Qué fracasa por fricción y cómo reducirla

- **Contabilidad completa** (conciliación, plan de cuentas): fracasa. La mayoría lleva registros «solo para el contador» ([AccountancyAge](https://www.accountancyage.com/aa/news/1748408/only-smes-accounting-software)). **Truco:** P&L que sale solo de las ventas del POS más gastos dictados o fotografiados, con categorías sugeridas, sin asientos contables.
- **Flujo de caja proyectado:** depende de datos que nadie carga. **Truco:** proyectar solo con gastos recurrentes detectados automáticamente y la venta promedio por día de la semana.
- **Stock con conteos:** es la capacidad de mayor carga manual. **Truco:**
  - descontar el stock solo a partir de la venta;
  - contar solo los 10 productos de mayor rotación o costo;
  - cargar la compra con foto de la factura.
- **Fidelidad que exige pasos en caja:** fracasa si el dueño se olvida de sellar. **Truco:**
  - sellar automáticamente al cobrar;
  - regalar 2 sellos de entrada (19%→34%);
  - tarjeta corta.
- **Seña por inasistencia:** en el barrio choca con el pago en efectivo. **Truco:** activarla solo para clientes con historial de faltas.
- **Presupuestos rechazados:** si el presupuesto no se carga por ítem, la capacidad no existe. **Truco:** convertir el presupuesto en venta con un toque.
- **Mensajes del inbox de Analíticas en general.** Funcionan cuando:
  - el dato sale de algo que el dueño ya hace (cobrar);
  - el mensaje trae la acción lista («enviar recordatorio a 12»);
  - el mensaje dice cuánto dinero hay en juego.

**Dato regulatorio a verificar con el SRI:** un local que factura $4.000-6.000 al mes ($48-72k al año) supera el tope de $20k de «negocio popular». Quedaría entonces en RIMPE Emprendedor, con factura electrónica obligatoria y, según una fuente secundaria, contabilidad formal desde 2024 ([Primicias](https://primicias.ec/noticias/economia/facturacion-electronica-obligatoria-noviembre), [lookuptax](https://lookuptax.com/docs/es/numero-identificacion-fiscal/guia-ruc-ecuador)).
