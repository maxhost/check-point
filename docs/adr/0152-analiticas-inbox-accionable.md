---
adr: 0152
fecha: 2026-10-16
estado: propuesta
resumen: Analíticas es un inbox de hasta 5 tarjetas accionables con peso por contexto más un histórico en números con filtros de período; todo sale de resúmenes diarios con vocabulario de métricas del core que los módulos alimentan por eventos, y el contexto externo se guarda desde ya sin acción.
---

# 0152 — Analíticas: inbox accionable, histórico en números y resúmenes diarios

**Estado: propuesta.** Borrador de Claude para revisión del owner (pedido el 2026-10-16: «escribilo vos»). Diseño
documental: no autoriza implementación, migración, push ni operación PROD. Amplía el ADR 0021 (núcleo universal, lentes
por rubro, calidad de cada métrica), que sigue vigente salvo donde este lo reemplaza.

Fuentes: decisiones del owner en `docs/plan-margen-ganancia-2026-10-14.md` (secciones «AN — …», 2026-10-16, citadas
abajo) e investigación de mercado en `docs/analisis-analiticas-mercado-2026-10-16.md` (evidencia casi toda de
proveedores; lo independiente está marcado).

## Contexto

El comerciante de barrio hace todo, con uno o dos empleados, en libreta o excel; no sabe sus márgenes ni su punto de
equilibrio, pierde y gana dinero sin saberlo y no anticipa la demanda. Owner: «La analítica es lo que el dueño de un
comercio local abre cada mañana antes de abrir las puertas y ve "hoy espero que suceda esto, necesito preparar esto,
tengo que lograr esto antes de esto"». Y: «Lo que queremos es que el dueño pueda accionar, no solamente ver gráficos».

Investigación: los grandes (Toast IQ, Square Managerbot, Shopify Sidekick Pulse) llegaron en 2025-26 a un feed de pocas
tarjetas con acción, descartables, que no aparece sin datos suficientes; ninguno habla de margen por plato, insumo que se
acaba o meta del día, y en LatAm no hay nada proactivo. Las cuentas son simples; lo difícil es la frase, la honestidad
y la fricción para alguien que carga poco.

Criterio de valor (owner): el comerciante quiere **ahorrar dinero, ahorrar tiempo o ganar más**; «quizás un cliente que
te deja $5 de ganancia no sea ni siquiera tan rentable como ahorrarle $10 optimizando su stock». Orden de valor
acordado: **margen → costos → stock → clientes**.

## Decisión

### 1. Una pantalla, dos partes

**Analíticas** (core) contiene:

- **Inbox:** mensajes accionables. Owner: es «la parte más smart», como si el dueño tuviera un empleado por
  departamento y este fuera el email donde le mandan lo que hay y las acciones concretas que necesitan de él. Invita a
  hacer lo que falta, corregir, completar, crear.
- **Histórico en números**, con filtro de período: **mes en curso, 3, 6, 9 y 12 meses** (reemplaza «año en curso,
  3/6/9» de la opción C). Owner: «esto sería un filtro, no para las tarjetas… para ver cómo crecieron las ventas en 3
  meses, cómo subió nuestro costo de stock en 6 meses, cuánto dinero ahorramos en 9 meses». Se cuenta en cifras y frases
  que el comerciante entiende, no en gráficos de picos. Comparación contra el mismo período del año anterior: *a decidir*.

### 2. Las 13 tarjetas de la primera versión

Aprobadas por el owner («no son 100 posibilidades, son 13, es genial»); se suman más aprendiendo. El «empleado» es el
remitente que ve el dueño.

| # | Empleado | Tarjeta | Datos | Acción |
|---|---|---|---|---|
| 1 | Ventas | Resumen de ayer («vendiste $210, 12% más que el martes pasado; lo que más salió: café con leche») | POS | ver el día |
| 2 | Ventas | Qué se vende hoy («los martes se suelen vender 30 medialunas») | POS por día de semana | aviso |
| 3 | Finanzas | Meta del día («hoy necesitás vender $106 para cubrir el mes») | Gastos + margen | ver el cálculo |
| 4 | Finanzas | Invitación a cargar gastos fijos | — | ir a Gastos |
| 5 | Costos | Suba de insumo llevada al plato («la harina subió 12%: tu muzza te cuesta $0,18 más») | compras + recetas | revisar precio |
| 6 | Costos | Margen bajo o negativo por producto | recetas + precio | revisar precio |
| 7 | Costos | Producto sin costo («sin eso no sé cuánto ganás con ellos») | — | cargar receta |
| 8 | Stock | Insumo que se acaba, con rango («hasta entre el jueves y el sábado») | stock teórico + consumo | registrar compra |
| 9 | Stock | Merma por conteo («faltaron 3 kg de harina, ~$4, que no explican las ventas») | ajustes × costo | ver detalle |
| 10 | Ventas | Anulaciones fuera de lo normal del propio local | POS | ver cuáles |
| 11 | Clientes | Habitual que pasó su frecuencia («Juan venía cada 12 días; van 25») | pases/sellos | mandar cupón |
| 12 | Clientes | Resultado de una promo («el cupón te costó $30 y vino con $140 en ventas») | cupones + POS | repetir o no |
| 13 | Ventas | Día flojo → recomendar los de mayor margen | POS + márgenes | aviso |

Reglas de contenido:

- **Lo vendido, no lo que hay que producir.** Owner: «no necesitamos decir usualmente vendés 40, hoy hacé 20 más…
  avisamos simplemente "los martes se suelen vender 30 medialunas"».
- **Rangos, no puntos**, donde hay proyección (tarjeta 8). Sin plazo del proveedor: obligaría a cargarlo y mantenerlo.
- **Dato faltante = invitación**, nunca se oculta en silencio ni se inventa (tarjetas 4 y 7; ADR 0021: «la UI no estima
  ni sustituye una fuente no disponible»).
- **Mínimo de historia:** las tarjetas que comparan días (2, 8, 13) no aparecen con menos de 4 ocurrencias del mismo día
  de semana; mientras tanto, a lo sumo, «necesito 3 martes más para decirte qué se vende los martes» (propuesta de
  Claude; el umbral se ajusta con uso real).
- **Atribución honesta:** la tarjeta 12 dice lo que costó y lo que vino junto con el cupón, no que el cupón lo causó
  (ADR 0021: sin atribución causal sin baseline). El simulador de una promo antes de lanzarla **no es de Analíticas**:
  vive en fidelización/marketing (owner).
- **Cada tarjeta dice el monto en juego** cuando lo hay.

### 3. Peso por contexto y tope de 5

Owner: «cada una de estas acciones tiene que tener un peso… estas tarjetas tienen que tener contexto para que aparezcan
cuando se necesitan, no cuando yo quiera». Ejemplo del owner: margen bajo no se muestra a diario; tiene sentido a 10 días
del cierre del mes y a $x del punto de equilibrio.

- **Hasta 5 tarjetas a la vez**, incluida la de resumen de ayer (owner: «es una de las 5, cuenta»). Al aceptar o
  descartar una, entra la siguiente de más peso **si hay algo que avisar**; si no, quedan menos de 5.
- **Peso = plata en juego × urgencia × novedad** (diseño de Claude):
  - *plata en juego*: USD que cuesta no actuar (faltante para el equilibrio, pérdida semanal de un producto, merma);
  - *urgencia*: cercanía del hecho (días hasta agotar un insumo, días al cierre del mes);
  - *novedad*: una tarjeta descartada no vuelve hasta que su contexto cambie de forma material (p. ej. el monto se
    duplica o cambia el insumo). Una tarjeta repetida a diario es ruido.
- **Disparadores de contexto** (cuándo gana peso cada una):

| Tarjeta | Gana peso cuando |
|---|---|
| 1 Resumen de ayer | cada mañana; peso alto fijo |
| 2 Qué se vende hoy | peso bajo fijo; rellena si no hay nada urgente |
| 3 Meta del día | se acerca el fin de mes y la venta acumulada va por debajo |
| 4 Cargar gastos fijos | falta el dato y la meta no se puede calcular |
| 5 Suba de insumo | el día que se carga la compra; después decae |
| 6 Margen bajo | la meta del mes está en riesgo, o un producto a pérdida se vende mucho |
| 7 Producto sin costo | proporcional a cuánto se vende ese producto |
| 8 Insumo que se acaba | quedan pocos días |
| 9 Merma por conteo | según el monto; una diferencia chica no aparece |
| 10 Anulaciones | fuera de lo normal del propio local |
| 11 Habitual que se va | gasto del cliente × cuánto se pasó de su frecuencia |
| 12 Resultado de promo | el día que termina la promo |
| 13 Día flojo | el día pinta flojo según el propio historial |

Las tarjetas se componen: a 10 días del cierre y abajo del equilibrio, 3 + 6 + 13 juntas son el plan para llegar.
Los coeficientes exactos no se fijan acá: van en la spec y se ajustan con uso real.

### 4. De dónde salen los datos: resúmenes diarios con vocabulario del core

Se mantiene la **opción C** del owner (plan, «Decisiones del owner sobre la revisión» 2): cada módulo es dueño de su
detalle; Analíticas guarda **resúmenes por día** que actualiza con eventos y que el inbox y el histórico leen. Entrar a
Analíticas no calcula sobre el detalle.

- **El core define el vocabulario de métricas** (p. ej. `revenue`, `units_sold` por producto, `cost_of_goods`,
  `expense` por concepto y fijo/variable, `stock_purchase_cost` por insumo, `stock_count_gap`, `voids`, `visits` por
  cliente). Los nombres concretos los cierra la spec.
- **Cada módulo traduce sus eventos a ese vocabulario** y lo declara en su contrato (`SERVER_MODULES`), como hoy declara
  `eventSubscriptions`. El core nunca nombra un módulo ni su id (ADR 0138/0139): agrega métricas genéricas con
  dimensión genérica (producto, insumo, concepto, cliente pseudónimo).
- **Forma del resumen:** comercio × local × día local × métrica × dimensión opcional → suma y cantidad. El «día» es el
  día calendario en la zona horaria del comercio.
- **Las tarjetas se evalúan una vez por día y por comercio**, antes de la mañana local, y quedan guardadas como
  candidatas con su peso; abrir Analíticas solo lee. Disparo externo por cron-job.org (ADR 0118), en tandas. Si la
  tanda no corrió, la primera apertura del día la calcula para ese comercio. Las tarjetas que dependen de un hecho
  (5 al cargar una compra, 12 al terminar una promo) pueden entrar en el momento.
- **Estado del inbox** por tarjeta: mostrada, aceptada, descartada, con la huella del contexto que la generó (para
  decidir si «cambió de forma material»).

**Eventos que Gastos (G) tiene que publicar** (revisa la decisión 13 del prompt de G):

- `expense.recorded`, `expense.updated`, `expense.deleted`, versionados, con: fecha de pago (día local), monto en
  unidades menores y moneda del comercio, categoría, **concepto estable**, fijo/variable, local o «todo el negocio».
- `updated` y `deleted` llevan el **estado completo resultante**, no un delta: el resumen se recalcula para el día y el
  concepto, de forma idempotente.
- **Hallazgos para la spec de G** (leídos en `packages/db/src/schema/module-event.ts`, 2026-10-16):
  - `module_event` es único por (comercio, tipo, `source_id`): dos ediciones del mismo gasto chocan si `source_id` es
    el id del gasto. El `source_id` de `expense.updated` tiene que ser el de la revisión o edición, no el del gasto.
  - `location_id` es obligatorio: un gasto de «todo el negocio» no tiene local. Hay que decidir entre columna nullable
    o una convención explícita; no un local elegido al azar.

### 5. Contexto externo: dato guardado desde ya, sin acción

Owner: «el contexto externo tiene que empezar como dato dentro de la DB asociado a actividades pero sin que permita
accionar nada al owner… podemos empezar a cargar ya ventas con clima… esto empieza a dar histórico».

- **Una fila por local y día local:** clima observado (máxima, mínima, lluvia, condición), feriado (nacional, local o
  trasladado, con nombre) y marcas de calendario curado. Se une a las ventas por (local, día); no se copia a cada venta.
- **Clima:** por coordenadas del local (`location.latitude/longitude`, que pueden ser nulas: sin coordenadas, sin clima
  y sin inventar). Fuente candidata: WeatherAPI.com (plan gratis declarado con uso comercial; **verificar sus términos
  antes de implementar**). Open-Meteo gratis queda descartado: sus términos (leídos el 2026-10-16) dicen «You may only
  use the free API services for non-commercial purposes».
- **Feriados:** reglas nacionales con traslado (librería `holidays`) + **tabla propia curada** con feriados locales y
  decretos (Nager.Date, consultado el 2026-10-16, no trae fundación de Quito ni de Guayaquil y no traslada el 24 de
  mayo).
- **Calendario curado de Ecuador:** décimo tercero y cuarto (por región), quincenas, inicio de clases (Sierra y Costa),
  fechas comerciales. Fechas a confirmar con fuentes oficiales al cargarlas.
- **Nada de esto genera tarjetas ni entra en un pronóstico en la primera versión.**

### 6. Fuera de la primera versión

| Qué | Por qué | Dónde |
|---|---|---|
| Proyecciones: flujo de caja, plan de crecimiento con techo de capacidad | «solo es fiable con histórico, y es algo que hoy no hay» | `docs/PARQUEADO.md` |
| Cuadre o cierre de caja | owner: fuera; sí se usan las anulaciones | `docs/PARQUEADO.md` |
| El dueño como fuente de eventos del barrio | 5 locales en la red | `docs/PARQUEADO.md` |
| Inferir lo producido y no vendido (hora de agotamiento, foto, balanza) | «dejemos fuera esta inferencia hasta que se nos ocurra algo» | plan, «Merma y producción» |
| Turnos vacíos y recordatorios | no hay agenda | cuando exista |
| Turnos y costo de personal | owner: fuera | — |
| Facturación fiscal (SRI) | owner: CheckPass no factura ni busca reemplazar a quien lo hace | — |
| «Diseñar nueva carta» (qué platos sacar) | es de Smart Menu | Smart Menu |
| Simular una promo antes de lanzarla | es de fidelización/marketing; Analíticas solo mide el resultado | fidelización |

### 7. Escala (medido el 2026-10-16)

Owner preguntó si Neon soporta calcular esto cada día con muchos comercios y millones de registros. Medición de Claude
en un Postgres 17 local descartable (no Neon), con 1.000 comercios × 2 años × 40 productos con venta **todos los días**
(29,2 millones de filas producto × día, 2,6 GB con índices; el caso real es más ralo):

- consulta de un comercio, «qué se vende los martes» (4 días × 40 productos): **0,4 ms**;
- histórico de 12 meses por producto de un comercio: **7,5 ms** (510 páginas leídas);
- 12 meses por mes desde el resumen comercio × día: **1,9 ms**;
- **tanda nocturna de 7 consultas por comercio para los 1.000 comercios: 0,82 s.**

Lectura: con resúmenes diarios indexados por (comercio, día), el costo por comercio no crece con el tamaño total de la
tabla, y la tanda crece lineal con los comercios (10.000 ≈ 8 s). El costo que sí crece es el **almacenamiento**
(~2,6 GB por cada 1.000 comercios × 2 años en el peor caso). Límites de esta medición: Postgres local con caché
caliente, no Neon; en Neon, con caché fría, cada página se trae del almacenamiento remoto y la consulta más pesada puede
ser varias veces más lenta (no medido). Calcular las tarjetas sobre el detalle crudo (líneas de venta) en lugar de
resúmenes no se midió y no se recomienda. La decisión 2 del owner pedía que GPT midiera con datos de prueba antes del
ADR: esta medición la reemplaza para la propuesta; la spec repite la medición en una rama Neon.

## Consecuencias

- G se lanza después de aprobar este ADR, con los eventos `expense.*` del §4 y sus dos hallazgos.
- La spec de AN (L3: toca dinero) define el vocabulario de métricas, la tabla de resúmenes, la tabla de contexto, el
  estado del inbox, los coeficientes iniciales del peso y el texto de cada tarjeta.
- **Pendiente a decidir con el owner:**
  - ventas anteriores al encendido de los eventos: ¿se reconstruyen hacia atrás desde el detalle de los módulos o se
    cuenta desde el encendido? (PROD tenía 17 órdenes POS el 2026-10-16);
  - comparación contra el mismo período del año anterior en el histórico;
  - umbral mínimo de historia (4 ocurrencias propuestas).

## Referencias

- ADR 0021 (núcleo universal y lentes por rubro), 0118 (cron externo), 0138/0139 (módulos), 0145 (consumo de stock por
  evento), 0150 (Negocio y comisiones).
- `docs/plan-margen-ganancia-2026-10-14.md`, secciones «AN — …» del 2026-10-16.
- `docs/analisis-analiticas-mercado-2026-10-16.md`.
