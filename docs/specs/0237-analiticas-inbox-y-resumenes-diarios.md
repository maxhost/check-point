---
spec: 0237
fecha: 2026-10-17
estado: en revisión
resumen: Analíticas en tres etapas — resúmenes diarios por evento, inbox de hasta 5 tarjetas en el Dashboard, histórico en números y contexto externo guardado — para que el dueño accione cada mañana sin que abrir la pantalla calcule nada.
disjunta: no; G (0236) y N (0235) ya integradas en dev; comparte module_event, contrato de módulos, permisos, Dashboard y el corte de conteo de Stock
archivos: packages/db (esquema analytics, core.location.city_id, migraciones); packages/domain/src/analytics; apps/merchant/src/server/analytics; server/module-events; modules/{pos,recipes,expenses,stock}; app/backoffice (Dashboard, analytics); rutas api/analytics e api/internal/analytics; permissions-catalog
---

# 0237 — Analíticas: inbox, histórico y resúmenes diarios (AN)

Spec L3 (toca dinero, aislamiento entre comercios y migración a PROD). [ADR0144](../adr/0144-factory-local-por-tarea.md),
[verificación](../VERIFICACION.md). Diseño de producto cerrado en el [ADR0152](../adr/0152-analiticas-inbox-accionable.md),
que manda sobre esta spec con su addendum de ciclo de avisos del 2026-10-17; amplía el [ADR0021](../adr/0021-analiticas-universales-y-lentes-por-rubro.md). Eventos de
Gastos: [spec0236](0236-gastos-registro-de-pagos.md) y [ADR0151](../adr/0151-gastos-y-eventos-autosuficientes.md).
Decisiones citadas: `docs/plan-margen-ganancia-2026-10-14.md`, secciones «AN — …».

**Revisión posterior a AN-1/AN-2/AN-3 (owner, 2026-10-17):** se aprueban avisos persistentes, cierre explícito,
postergación y retención de 90 días/semanal de §3.7–§3.10. Sustituyen la copia diaria y «aceptar = navegar» del corte
original. La funcionalidad integrada anterior conserva sus handoffs y sus límites; esta revisión todavía no está
implementada. El catálogo §3.8 y los recordatorios tienen tres aclaraciones consultadas al owner; mientras figuren pendientes no se lanza
código. [Contrato de implementación](../factory/0237-inbox-lifecycle-contract.md),
[adversarial](../factory/0237-inbox-lifecycle-adversarial.md).

## Problema

El Dashboard del merchant muestra un cartel «Aquí verás cómo va todo» y accesos (`app/backoffice/page.tsx`). No hay
tablas, rutas ni UI de analíticas (`app/analytics.ts` son fixtures de demo del ADR0020). El dueño de barrio no sabe
su margen ni su punto de equilibrio y no anticipa la demanda; el ADR0152 decidió un inbox accionable y un histórico
en números, alimentados por resúmenes diarios.

Diagnóstico inicial anterior a la implementación de AN-1, leído el 2026-10-17 (se conserva como antecedente):

- **El único evento que existe es `sale.closed`** (POS, `server/module-events/publish.ts`, en la tx del cierre).
  Compras y ajustes de stock (`stock.movement`), anulaciones (`pos.pos_order.status='voided'`), canjes de cupón
  (`core.coupon_redemption`) y visitas (`core.order`, `core.business_customer.last_visit_at`) solo escriben su tabla.
- G ya está integrada en `dev` (verificado el 2026-10-17): `appendModuleEvent` genérico
  (`server/module-events/append.ts`), `GenericEventSubscription` con `eventType: string` y `dispatch`
  (`types.ts:74`), `module_event.location_id` nullable salvo para `sale.closed`, y Gastos publica `expense.*` siempre.
- La comisión de cada venta se congela en core al cerrar (`server/business/commission-close.ts`, tras N). El costo de
  lo vendido no viaja en el evento: lo calcula Stock al aplicar el consumo de Recetas
  (`modules/recipes/server/consumption-cost.ts` → `modules/stock/server/consumption-cost.ts`).
- El corte del conteo de Stock (`modules/stock/count.ts`) toma todos los eventos del local y bloquea si hay
  deliveries pendientes de esos eventos. G ya filtra captura y pendientes por `sale.closed`, pero de **cualquier
  suscriptor**: una delivery de Analíticas sobre una venta lo bloquearía (ver §2.4).
- La zona horaria es del comercio (`core.business.timezone`); el local no tiene zona ni ciudad. `address_snapshot`
  guarda el Details de Google Places (`addressComponents`), filas viejas de Geoapify o `{}` si el dueño tipeó.
- `sale.closed` solo se publica si `MODULE_EVENTS_ENABLED === "true"` (`publish.ts:61`); también lo leen
  `tools/payment-methods/preflight.ts` y tres soportes de test. Gastos ya publica sin esa variable.

## Decisiones del owner (no se reabren)

Del ADR0152 (13 tarjetas, hasta 5 a la vez con el resumen de ayer contando, peso = plata × urgencia × novedad, mínimo
de un mes y 4 ocurrencias para comparar días, rangos, dato faltante = invitación, atribución honesta, histórico
mes/3/6/9/12 con comparativa anual construida, contexto externo por ciudad sin acción, Visual Crossing gratis, sin
reconstruir ventas anteriores a los eventos). Del 2026-10-17 (plan, «AN — decisiones del owner para la spec»):

1. **Una spec, tres etapas**, cada una sale a live por separado (tabla de abajo).
2. **El inbox va en el Dashboard**, en lugar del cartel; **el histórico en un ítem de menú «Analíticas»**. Permiso
   nuevo `analytics`: dueño siempre, staff solo si se lo dan.
3. **Ventas = solo POS.** Un futuro módulo de citas será el equivalente para quien no vende productos: el vocabulario
   es genérico (`revenue` no sabe de qué módulo viene).
4. **Tarjeta 10 = tickets abiertos anulados** (el POS no anula ventas cobradas).
5. **Todo dato que alimenta Analíticas nace como evento**, guardado en la transacción de su origen, con el mismo patrón
   que `sale.closed`; los traductores solo leen el evento y Analíticas no lee tablas de origen
   ([ADR0153](../adr/0153-analiticas-solo-de-eventos.md)). Owner: «lo correcto es hacer que cada módulo guarde los
   datos como venta cerrada del POS para seguir un patrón consistente».
6. **Analíticas es core**: no se activa ni desactiva por switch de módulo ni por variable de entorno. Todo comercio la
   tiene. Por eso **se retira `MODULE_EVENTS_ENABLED`**: `sale.closed` se publica siempre, como `expense.*`; si no, la
   variable apagaría Analíticas por la puerta de atrás (§2.5).
7. **Hallazgos cerrados** (owner, 2026-10-17): la 6 y la 7 entran en AN-1 (H1); Analíticas empieza limpio en el deploy
   de AN-1, sin procesar eventos anteriores (H2); un local sin ciudad queda sin contexto y no se le pide nada al dueño
   (H3); «cuánto ahorraste» va a `docs/PARQUEADO.md` (H6).

8. **Ciclo posterior de avisos:** una tarjeta activa/pospuesta por asunto, sin copias por recálculo/día. Navegar no
   cierra. Solucionado/Ignorar eliminan contenido y conservan control mínimo del contexto atendido; Visto cierra
   informes. Recordarme luego conserva identidad y fecha elegida. Solo cambios pertinentes posteriores justifican
   reabrir; stock necesita evidencia propia del insumo/local, no una venta ajena ni un replay. La prioridad protege
   stock con riesgo ≤ 24 h frente a invitaciones. §3.7–§3.10 mandan para esta revisión (owner, 2026-10-17).
9. **Retención aprobada:** limpieza semanal,90 días móviles desde cierre/vencimiento probado, solo residuos
   cerrados/vencidos. Pendientes/pospuestos de cualquier edad y control anti-repetición necesario excluidos. Los
   cierres nuevos eliminan contenido al acto; no se crea un log para conservarlo 90 días. Histórico numérico y
   deduplicación de eventos fuera del cleanup.

## Etapas

| Etapa | Entra | Tarjetas | Eventos nuevos |
|---|---|---|---|
| **AN-1** | resúmenes diarios, suscriptor core, inbox, histórico, contexto externo (ciudades, clima, calendario) | 1, 2, 3, 4, 6, 7, 13 | `sale.closed` v3 (nombre del producto por línea), `sale.commission.frozen` (core), `recipes.consumption.applied`; traduce también `expense.*` de G |
| **AN-2** | stock y costos | 5, 8, 9 | `stock.purchase.recorded`, `stock.adjustment.recorded`, `recipes.product_cost.changed` |
| **AN-3** | anulaciones, clientes y promos | 10, 11, 12 | `pos.order.voided`, `visit.recorded` y `coupon.redeemed` (core) |

La 7 (producto sin costo) y la 6 (margen bajo) entran en AN-1 (owner, H1): la meta del día necesita saber qué parte de
lo vendido tiene costo, y las dos salen de los mismos datos de venta.

## Alcance y diseño

### 1. Vocabulario de métricas (core)

`packages/domain/src/analytics/metrics.ts` define el vocabulario; ningún nombre de módulo aparece en él. Cada métrica
tiene tipo (`sum` o `gauge`: último valor del día), unidad (`money` en unidades menores + moneda, `quantity` decimal
exacto, `count`) y tipo de dimensión (`none`, `product`, `item`, `concept`, `customer`, `campaign`).

| Métrica | Tipo | Unidad | Dimensión | Etapa | Qué es |
|---|---|---|---|---|---|
| Métrica | Tipo | Unidad | Dimensión | Etapa | Evento de origen → qué es |
|---|---|---|---|---|---|
| `revenue` | sum | money | none | 1 | `sale.closed` → cobrado neto (`money.collected`); `count` = tickets |
| `product_revenue` | sum | money | product | 1 | `sale.closed` → neto de la línea (`lines[].money.net`) |
| `units_sold` | sum | quantity | product | 1 | `sale.closed` → cantidad vendida |
| `payment_commission` | sum | money | none | 1 | `sale.commission.frozen` → comisión congelada de la venta |
| `cost_of_goods` | sum | money | product | 1 | `recipes.consumption.applied` → costo del consumo de la línea; `count` cuenta las líneas con costo conocido |
| `units_with_cost` | sum | quantity | product | 1 | `recipes.consumption.applied` → unidades con costo conocido; cobertura = `units_with_cost / units_sold` |
| `revenue_with_cost` | sum | money | product | 1 | `recipes.consumption.applied` → neto exacto de las líneas cuyo costo se conoce; `count` cuenta esas líneas |
| `payment_commission_with_cost` | sum | money | product | 1 | `recipes.consumption.applied` → comisión congelada asignada a esas líneas; `count` cuenta solo líneas con comisión conocida, incluido cero explícito |
| `expense_fixed` / `expense_variable` | sum | money | concept | 1 | `expense.*` → gasto por concepto según `isFixed` |
| `stock_purchase` | sum | money + quantity | item | 2 | `stock.purchase.recorded` |
| `stock_unit_cost` | gauge | money | item | 2 | `stock.purchase.recorded` → costo promedio por unidad después de la compra |
| `stock_on_hand` | gauge | quantity | item | 2 | existencia después, de cualquier evento de stock o de consumo |
| `stock_consumption` | sum | quantity | item | 2 | `recipes.consumption.applied` → insumos consumidos |
| `stock_count_gap` | sum | money + quantity | item | 2 | `stock.adjustment.recorded` → diferencia contra el teórico, al costo promedio |
| `product_unit_cost_change` | sum | money | product | 2 | `recipes.product_cost.changed` |
| `voided_tickets` | sum | money + count | none | 3 | `pos.order.voided` → tickets abiertos anulados y lo que tenían cargado |
| `visits` | sum | count | customer | 3 | `visit.recorded` → acreditaciones del cliente (no la bienvenida) |
| `promo_discount` / `promo_sales` | sum | money | campaign | 3 | `sale.closed` v2+ (`discountOrigin`) y `coupon.redeemed` |

Los nombres de la dimensión (producto, insumo, concepto, cliente, campaña) **viajan en el evento** y se guardan en
`analytics.dimension_label`. Por eso `sale.closed` pasa a **v3** = v2 + `lines[].productLabel` (nombre al cerrar);
decodificadores de POS, Recetas y core aceptan v1–v3. El contrato v3, todavía sin desplegar, incluye también
`lines[].commissionMinor: string | null`: comisión de la venta asignada a cada línea en unidades menores, cero
conocido si no hay cargo y null si falta configuración. La asignación proporcional al neto de **todas** las líneas
usa el reparto exacto existente del dominio financiero y conserva el total congelado, incluidos sus centavos.

### 2. Resúmenes diarios

#### 2.1 Tablas (esquema `analytics`, core)

| Tabla | Forma |
|---|---|
| `metric_contribution` | aporte vigente de una fuente: `business_id`, `source_key` (`sale:<orderId>`, `expense:<expenseId>`, …), `source_revision` int, métrica, `location_id` nullable, `day` DATE local, dimensión (`kind`, `id` uuid nullable), `amount_minor` bigint, `currency_code`, `minor_unit`, `quantity` numeric, `count` int. Índice (`business_id`, `source_key`). |
| `daily_metric` | suma por comercio × local × día × métrica × dimensión × moneda: `amount_minor`, `quantity`, `count`. Único con `NULLS NOT DISTINCT` (local y dimensión pueden ser null). Índice por (`business_id`, `day`). |
| `daily_gauge` | último valor del día por comercio × local × día × métrica × dimensión, con `observed_at` (gana el más nuevo). AN-2. |
| `dimension_label` | (`business_id`, kind, id) → etiqueta y `updated_at`; gana la más nueva. |

El «día» es el día calendario en `core.business.timezone` del instante del hecho (`closedAt` de la venta; `paidOn`
del gasto ya es día local y se usa tal cual). Un cambio futuro de zona no mueve lo ya guardado.

#### 2.2 Todo nace como evento; el traductor solo lee el evento

**Regla (ADR0153):** todo dato que alimenta Analíticas se guarda como `module_event` **en la misma transacción que
su origen**, igual que `sale.closed` en el cierre del POS. Analíticas no lee tablas de módulos ni de core para armar
resúmenes; si un dato falta en un evento, se agrega al evento (nueva versión), no se lee de una tabla.

`ModuleServer` (`modules/route-table.ts`) suma `metricTranslators?: readonly MetricTranslator[]`:
`{ eventType, translate(event) → { sourceKey, sourceRevision, rows[] } }`. **Función pura**: sin `tx`, sin lectura de
base, sin reloj; la misma entrada da siempre la misma salida. Lo declara el dueño del tipo de evento. Core declara los
suyos en `server/analytics/core-translators.ts` (`sale.commission.frozen`; en AN-3 `visit.recorded` y
`coupon.redeemed`).

Eventos nuevos de AN-1 (append genérico de G, `source_id` único por comercio y tipo):

- **`sale.closed` v3** (POS): v2 + `lines[].productLabel`.
- **`sale.commission.frozen`** (core): en la tx del cierre, justo después de `freezeSaleCommission`
  (`pos/server/close.ts:270`): orden, local, `closedAt`, comisión total en unidades menores, moneda y unidad.
  `source_id` = orden. Sin comisión configurada no se publica.
- **`recipes.consumption.applied`** (Recetas): en la tx en que su handler de `sale.closed` aplica el consumo: orden,
  local, `closedAt`, por línea `{ sourceLineId, productId, productLabel, quantity, cost | null }` (null = sin receta
  o sin costo de algún insumo) y por insumo `{ itemId, itemLabel, quantity, onHandAfter }`. `source_id` = orden. Si la
  delivery de Recetas queda `skipped` (módulos apagados), no hay evento y esas unidades cuentan como sin costo
  (`units_sold` sin `units_with_cost`).

Precisión técnica AN-1 (hallazgo comunicado durante implementación, ADR0153): cada línea del consumo conserva
también `revenueMinor` y `allocatedCommissionMinor` del snapshot de la venta, con moneda/unidad. Sus métricas de
dinero conocido se emiten únicamente cuando `cost` no es null; una comisión desconocida no se transforma en cero.
Preparar el cálculo de comisión desde revisiones capturadas → publicar v3 con el reparto → congelar/persistir la
comisión y su evento ocurre en la misma transacción de cierre, sin lecturas de tablas de origen en Analíticas.

Traductores de AN-1: POS (`sale.closed` → `revenue`, `product_revenue`, `units_sold`, promos desde `discountOrigin`
en AN-3), Recetas (`recipes.consumption.applied` → `cost_of_goods`, `units_with_cost`; en AN-2 también
`stock_consumption`, `stock_on_hand`), Gastos (`expense.*`) y core (`sale.commission.frozen`). Cada evento tiene su
`sourceKey` (`sale.closed:<orden>`, `recipes.consumption.applied:<orden>`, `expense:<gasto>`…): reemplazar uno no
borra el de otro.

#### 2.3 Suscriptor core `core.analytics`

- `server/module-events/` suma suscriptores **core** (lista en core, no en `SERVER_MODULES`). Al publicar cualquier
  evento con al menos un traductor, se crea una delivery `core.analytics` además de las de módulos; nunca
  `skipped` por módulos apagados.
- Aplicar = en una tx: lock advisory por (`business_id`, `source_key`); si `source_revision` ≤ la guardada, no hace
  nada (un `expense.updated` viejo que llega tarde no pisa uno nuevo); si no, resta de `daily_metric` los aportes
  previos de ese `source_key`, los borra, inserta los nuevos y los suma (`on conflict do update`, filas en orden de
  clave para no trabarse). Un `expense.deleted` deja cero aportes. Reaplicar la misma delivery no cambia nada.
- **Empieza limpio** (owner, H2): las deliveries `core.analytics` se crean al publicar; los `module_event` guardados
  antes del deploy de AN-1 no reciben ninguna y no se procesan.
- Los eventos derivados declaran `causationEventId` al publicarse. Su delivery `core.analytics` solo se crea si
  el padre del mismo comercio ya tiene una delivery core, en cualquier estado. Así un consumo tardío de una venta
  predeploy puede completar Stock sin introducir costos históricos huérfanos en Analíticas. No usa la versión
  del evento como fecha ni exige que la delivery padre ya esté aplicada; no añade flag ni migración.

#### 2.4 Corte del conteo de Stock

`validateCountCut` bloquea con deliveries pendientes de los eventos del corte. Una delivery `core.analytics`
pendiente (p. ej. una que falló y espera su reintento) no cambia el stock y **no debe** bloquear un conteo: el chequeo de
pendientes se limita a suscriptores de módulos que requieren `stock`. Test de regresión obligatorio (§Pruebas).

#### 2.5 Sin switch: se retira `MODULE_EVENTS_ENABLED`

Analíticas no tiene flag, módulo ni variable de entorno (decisión 6). `publishSaleClosed` publica siempre; se borran
la lectura de `publish.ts`, el campo `publicationEnabled` de `tools/payment-methods/preflight.ts` y el manejo de la
variable en los soportes de test (`module-events-integration-support.ts`, `module-events.neon.integration.test.ts`,
`stock-average.neon.integration.test.ts`), con sus casos de «flag apagado» reescritos o borrados con motivo (no se
borra un test para que el gate pase: si el caso deja de tener sentido, se dice por qué). La variable se quita de Vercel
**después** del deploy, con autorización del owner. Lo que sí sigue dependiendo de switches son los **módulos que
alimentan**: sin POS no hay ventas, sin Recetas no hay costo; Analíticas lo dice con sus invitaciones.

### 3. Inbox (Dashboard)

#### 3.1 Evaluación y persistencia

- Se mantiene la evaluación diaria por `GET /api/internal/analytics/evaluate` (Bearer `CRON_SECRET`, cron-job.org,
  ADR0118), cada 30 min de 00:00 a 08:00 America/Guayaquil. Claim por comercio/día con SKIP LOCKED, presupuesto de 20 s
  y exclusión de evaluaciones concurrentes. `evaluation_run` registra trabajo, no la vigencia del inbox.
- Evaluar lee solo resúmenes/contexto de Analíticas, calcula las funciones puras y sincroniza los asuntos. Una
  tarjeta activa/pospuesta conserva `id` entre días, deliveries y recordatorios. Un recálculo idéntico no inserta
  una fila ni crea un episodio. La unicidad de contenido vigente pasa de (comercio,tipo,sujeto,día) a
  (comercio,tipo,asunto);9 distingue conteos diferentes, no se los colapsa por insumo.
- `card_candidate` contiene contenido vigente, no un archivo diario. `card_state` conserva estado/control
  compacto de contexto, evidencia de frescura, episodio, fechas de decisión/recordatorio y novedad. El `fingerprint`
  monetario anterior puede ayudar al peso, pero no prueba frescura ni resolución. §3.7–§3.9 precisan invariantes.
- Abrir Dashboard lee avisos persistentes elegibles, incluidos los pospuestos cuyo instante llegó. No requiere una
  candidata de hoy/ayer ni crea copias. Si falta la tanda, conserva lo vigente con «Preparando lo de hoy» y usa el
  fallback existente, con umbral de 3 s/after(); no presenta datos viejos como si fueran de hoy.
- El cron sigue atendiendo comercios activos con datos recientes de 35 días o sin datos, y además pendientes que
  requieren revalidación temporal/recordatorio aunque no haya actividad reciente. El mero paso de 35 días no borra
  ni vuelve inaccesible un aviso. Un comercio inactivo conserva estado para revalidar al volver.
- Tarjetas por hecho 5/9 y reconciliación de 12 sincronizan el mismo ciclo dentro de la delivery, sin reabrir un run
  ready ni pisar snoozes. Fuentes5/9 no dependen de copiar el texto de otra candidata: se conserva el contexto
  factual necesario del episodio dentro del estado estructurado existente y su control de orden/revisión.

#### 3.2 Peso, novedad y tope

**Pendiente del owner:** al vencer un recordatorio, renovar la novedad para recuperar elegibilidad o mantener el
decaimiento anterior. QA detectó que una informativa con peso base 0,1 y dos exposiciones puede quedar en
0,036, bajo el mínimo 0,05, aunque el usuario haya elegido volver a verla. Revisión detenida hasta respuesta;
no implementar una política implícita.

`packages/domain/src/analytics/weights.ts` mantiene los coeficientes y dinero exacto:

- Plata `p = min(3,monto en juego / venta diaria promedio de 28 días)`; sin ventas, referencia de 20 unidades mayores de
  la moneda del comercio, sin FX. Tarjetas sin monto conservan el p fijo de §3.4/§6/§7.
- Urgencia `u ∈ [0,2;1]`, por tipo. Peso normal `p × u × n`, con los multiplicadores existentes de cada tarjeta.
- Novedad de un episodio abierto:1 inicialmente y `0,6^días mostrada` según exposiciones reales, no cada lectura o
  corrida. Solucionado/Ignorar/Visto cierran ese contexto y no dejan una tarjeta con peso0 copiándose. Reabrir exige
  el comparador del catálogo §3.8, no que cambió un texto/fecha o faltó una fila limpiada.
- Se muestran hasta 5, incluido el resumen actual de ayer con peso fijo 10 cuando exista. Entre los otros cupos,
  una 8 abierta con extremo corto de agotamiento≤1 día tiene precedencia sobre invitaciones a completar datos 4/7
  y la variante de aprendizaje de 2. Su novedad no puede volver invisible el riesgo crítico abierto. Esto no anula
  cierres, recordatorios, permisos ni disponibilidad de acción. Otras candidatas conservan orden por peso y umbral
  mínimo0,05. Si hay más riesgos reales que cupos no se promete mostrarlos todos simultáneamente.
- Un recordatorio informativo de un período pasado conserva su período y no suplanta al resumen actual ni recibe
  el privilegio fijo 10 de «ayer». Compite en los demás cupos con el peso informativo de 2 (0,1) y el mismo límite de 5.
  **La vigencia de estos informes se cierra con la aclaración pendiente de §3.8.**

#### 3.3 Acciones sin nombrar módulos

`ModuleManifest` suma `analyticsActions?: { key, label, href }[]` (p. ej. Gastos declara `record_expense`, Recetas
`set_product_cost`); el core declara las suyas (`edit_product_price` → catálogo, `/backoffice/catalog`). La tarjeta
pide una clave; el core resuelve el `href` en el core o en un módulo **encendido** que la declare
y que el usuario pueda abrir (permiso). Si ninguno la declara encendida, el botón lleva al catálogo de módulos; si el
usuario no tiene permiso, la tarjeta sale sin botón.

#### 3.4 Tarjetas de AN-1 (texto en tuteo, montos en la moneda del comercio)

| # | Remitente | Aparece si | Texto (ejemplo) | p · u | Acción |
|---|---|---|---|---|---|
| 1 | Ventas | hubo `revenue` ayer | «Ayer vendiste $210 en 34 tickets, 12% más que el martes pasado. Lo que más salió: café con leche (40).» La comparación solo si el mismo día de la semana anterior tuvo ventas. Con más de un local, una línea por local. | fijo 10 | «Ver el día» → histórico de ese día |
| 2 | Ventas | ≥ 28 días desde la primera venta y ≥ 4 días iguales con venta | «Los martes se suelen vender unas 30 medialunas, 22 cafés con leche y 15 empanadas.» Mediana de los últimos 4–8 días iguales, top 3 por unidades. Antes del mínimo, como mucho una vez por semana: «Necesito 3 martes más para decirte qué se vende los martes.» | 0,1 · 1 | — |
| 3 | Finanzas | hay ≥ 1 mes cerrado con gastos, cobertura de costo ≥ 80% de lo vendido en 28 días y la venta del mes va por debajo del ritmo | «Hoy necesitas vender $106 para cubrir el mes: te faltan $1.272 en 12 días de venta.» Marca «estimado» si algún concepto lo es. | brecha contra el ritmo · `1 − días restantes/días del mes`, ×1,5 en los últimos 10 días | «Ver el cálculo» → histórico, bloque del mes |
| 4 | Finanzas | sin gastos fijos en 45 días, o sin mes cerrado con gastos | «Carga tus gastos fijos (alquiler, sueldos, luz) y te digo cuánto tienes que vender cada día para cubrir el mes.» Primer mes con gastos: «La meta se calcula al cerrar tu primer mes con gastos.» | 1 · 0,5 (0,8 en los últimos 10 días) | `record_expense` |
| 6 | Costos | ganancia unitaria de 28 días negativa, o menor a la mitad de la mediana del comercio, con ≥ 10 ventas y costo conocido | «La empanada de queso te deja $0,05 por unidad, contra $1,20 de tus otros productos: vendiste 80 este mes.» Negativa: «Cada empanada de queso te hace perder $0,15.» | `p` = pérdida semanal o brecha semanal contra la mediana · 0,3 (1 si la meta del mes está en riesgo) | `edit_product_price` |
| 7 | Costos | productos con `units_sold` mayor que `units_with_cost` en 28 días | «No sé cuánto ganas con café con leche y 4 productos más: vendiste $640 de ellos en 4 semanas.» Sujeto = el producto que más vendió. | monto = venta sin costo de 28 días / 4 · 0,6 (1 si la cobertura impide la meta) | `set_product_cost` |
| 13 | Ventas | mismo mínimo que la 2; la venta esperada de hoy (mediana de días iguales) < 75% del promedio diario de 28 días; hay ≥ 2 productos con costo y ≥ 10 ventas en 28 días | «Los martes suelen ser flojos (unos $140, contra $210 de un día promedio). Si te piden recomendación: la pizza muzza te deja $3,10 por unidad y el flan $2,40.» Top 2 por ganancia unitaria. | `p` = promedio − esperado · 0,7 (1 si la 3 está activa) | — |

**Meta del día (3), cálculo** (owner, plan «Preguntas de G» 1): gastos fijos del mes por concepto = lo pagado este mes
si el concepto ya se pagó; si no, promedio de los meses (hasta 3) en que se pagó, marcado «estimado»; variables y
sueltos = promedio mensual de los últimos 3 meses cerrados. Margen de contribución `m = (revenue − cost_of_goods −
payment_commission) / revenue` de 28 días, solo sobre lo vendido con costo. Equilibrio del mes `E = gastos / m`.
Días de venta restantes = días del resto del mes cuyo día de la semana tuvo ventas en las últimas 4 semanas, hoy
incluido. Meta de hoy = `(E − revenue del mes) / días restantes`. Si ya se cubrió, no aparece. Si `m ≤ 0`, no hay meta
y ganan peso la 6 y la 7.

Para conservar exactamente «solo sobre lo vendido con costo», el numerador y denominador de `m` usan
`revenue_with_cost`, `cost_of_goods` y `payment_commission_with_cost`. No se prorratea el neto agregado por
unidades ni por precio promedio: cambiar precios entre ventas no cambia qué líneas tenían costo conocido.
Si los `count` de costo, neto conocido y comisión conocida no coinciden, no se promete margen/meta exactos
(incluye eventos legacy sin neto y comisiones desconocidas). La ganancia unitaria de las tarjetas 6/13 usa esas mismas métricas
por producto y `units_with_cost`. El bruto del histórico conserva la fórmula literal del §4 con revenue y comisión
totales; las métricas auxiliares no vuelven a sumarse allí.

**Composición:** sin mecanismo extra; a fin de mes, bajo el equilibrio, 3 + 6 + 13 suben juntas por peso.

#### 3.5 HTTP (core)

Contrato v2 del inbox, sin flag ni variable de entorno. `id` persistente identifica la tarjeta; `version` opaca
identifica el contexto y la revisión de decisión/recordatorio que vio el usuario; cambiar estado o remindAt
invalida comandos anteriores, aunque los datos de negocio coincidan. Una lectura/exposición no cambia esa revisión
por sí sola. Las decisiones envían `{ expectedVersion, operationId }`; posponer añade
`remindAt`, ISO8601 con zona/offset convertido a instante UTC, futuro válido sin máximo artificial de 90 días. Se
muestra/elige en zona del comercio, conservando el instante elegido si después cambia la zona.

| Ruta | Contrato |
|---|---|
| `GET /api/analytics/inbox` | 200 `{ contractVersion:2,state,preparedAt,nextReminderAt,cards:[{ id,version,cardKey,sender,title,body,period,quality,amountAtStake,action,decisions }] }`. `period` indica origen y se muestra si no corresponde a hoy/ayer. `nextReminderAt` es el mínimo instante estrictamente futuro de pospuestos vigentes/autorizados, o null; los ya debidos van en cards, no en ese campo. |
| `POST /api/analytics/inbox/:id/resolve` | Solucionado: 200 `{ cards,nextReminderAt }`, elimina contenido y guarda control/decisión sin afirmar resolución observada. |
| `POST /api/analytics/inbox/:id/ignore` | Ignorar: mismo cierre técnico, motivo distinto; no cambia stock ni datos de negocio. |
| `POST /api/analytics/inbox/:id/seen` | Visto para informes; mismo contrato de cierre, permitido según capacidades del tipo. |
| `POST /api/analytics/inbox/:id/snooze` | Recordarme luego:200 `{ cards,nextReminderAt }`, mismo id y contexto vigente; guarda instante y excluye hasta ese momento. |
| `POST /api/analytics/inbox/:id/accept` y `/dismiss` antiguos | 409 `inbox_contract_changed`, sin modificar estado; el cliente recarga contrato. No reinterpretar una navegación de un cliente antiguo como Solucionado. |
| `GET /api/analytics/history?period=month\|3m\|6m\|9m\|12m&locationId=` | Sin cambios:200 bloques §4; local ajeno 404. |
| `GET /api/analytics/day?date=YYYY-MM-DD&locationId=` | Sin cambios:200 ventas por producto del día. |
| `GET /api/internal/analytics/evaluate` y `/context` | Sin cambios de autenticación: Bearer CRON_SECRET; 401 sin él; 200 `{ processed,skipped }`. |
| `GET /api/internal/analytics/cleanup` | Bearer CRON_SECRET; 401 sin él; 200 `{ cutoff,deleted,skipped,budgetExhausted }`; limpieza acotada §3.10, sin exponer datos personales. |

Todas las rutas públicas mantienen sesión, membresía activa y permiso analytics; comercio derivado del guard,
nunca del cuerpo/query. ID ajeno o desconocido 404; sin sesión 401/sin permiso 403. Versión presentada obsoleta 409
`card_context_changed`, sin cerrar datos nuevos no vistos. Fecha de recordatorio inválida/pasada 422. Repetir la
misma operación ya reconocida es idempotente, incluso sin contenido: devuelve estado actual sin volver a aplicar.
El control retiene la última operación/digest y la revisión de estado; reutilizar su operationId con otro cuerpo
no modifica nada y devuelve 409. Un retry antiguo ya sustituido que no se pueda reconocer devuelve 409 por revisión
obsoleta (o 404 si el ID ya no existe), nunca sobrescribe una postergación/decisión posterior. No se promete guardar
respuestas de todas las operaciones ni se crea un log. Otro comando sobre una tarjeta cerrada no la resucita.

#### 3.6 UI

Dashboard conserva remitente, título, cuerpo, monto/estimado, hasta 5 y vacío honesto. Navegación «Registrar compra»,
«Ver cliente», etc. solo abre el destino resuelto por contrato/permiso; no POST de cierre. Decisiones visibles:
Solucionado, Ignorar, Recordarme luego; en informes se usa Visto en lugar de Solucionado. Se retira la X ambigua.
Capacidades: Visto en 1/2/9/12/13 y en la variante informativa «Tu primer mes con gastos» de 4; Solucionado en
3/4 accionable/5/6/7/8/10/11. Ignorar y Recordarme luego disponibles en ambos grupos según vigencia del catálogo.
El servidor declara decisiones disponibles; una decisión incompatible con el tipo devuelve 422 sin efectos.

Recordarme luego permite elegir fecha/hora con kit existente, sin límite de 90 días; error de versión actualiza el contexto
antes de pedir otra decisión. No hacer doble envío mientras la acción esté pendiente.

El recordatorio se vuelve elegible al llegar su instante sin cron externo por cada tarjeta. El cliente usa
nextReminderAt para refrescar al vencer si está abierto, y al volver al foco; al abrir lee pendientes ya debidos.
No se implementan notificaciones OS/email/push ni un polling constante nuevo. Revalidar condiciones en la
sincronización temporal/factual y antes de mostrar, sin cálculo pesado sobre tablas de origen al abrir.

La página Analíticas/histórico y sus permisos siguen §4. UI con kit existente, COPY.md/tuteo, sin CSS/paleta o kit
nuevos. Un informe pospuesto de un período pasado dice su fecha, no «hoy»/«ayer» falsos.

#### 3.7 Ciclo y concurrencia

Estados semánticos: abierto, pospuesto, solucionado, ignorado, visto y vencido. Contenido solo para abierto o
pospuesto; los otros conservan exclusivamente el control mínimo aún necesario. Cerrar se ejecuta atómicamente con
la eliminación del texto y la memoria del contexto atendido. Una condición que se resuelve de forma observada
retira la tarjeta y cancela el recordatorio, sin atribuirle una acción al owner.

Mientras exista aviso abierto/pospuesto de un asunto, nuevos datos actualizan el mismo id; no se crea otro por
cada venta o día. Tras cierre, contexto idéntico no vuelve. Una 8 se reabre por consumo real posterior del mismo
insumo/local que reduce existencias y mantiene el riesgo, o por reposición→nueva escasez. Venta ajena, texto
recalculado, reloj por sí solo, replay o evento ocurrido antes del cierre no reabren 8. Capturar la recuperación
intermedia en las deliveries de gauges: no depender solo del último stock del día, que puede perder una reposición
intradiaria. Traductores siguen puros y core no lee tablas de origen ni nombra módulos.

Posponer conserva id y remindAt; actualizaciones no anticipan ni reinician el recordatorio. Al vencer, se presenta
la versión vigente de ese mismo asunto, con período explícito. La condición realmente resuelta lo cancela; la mera
salida de la ventana de emisión no prueba resolución. §3.8 diferencia ambas cosas.

Acción, evaluación, ingesta, reconciliación y limpieza comparten exclusión por comercio/tipo/asunto y un orden
estable de locks; el lock por día no basta para tarjetas que cruzan medianoche. Usar versión/CAS para que cerrar
A no cierre B publicada a la vez. La limpieza revalida estado/versión/fecha dentro de la tx; omite filas ocupadas y
retoma luego. No cerrar un contexto posterior no visto ni reiniciar estado desde un replay antiguo.

#### 3.8 Catálogo obligatorio de asunto y contexto

No usar un hash de todo el input, una revisión global del comercio o el importe null como identidad del contexto.
Cada comparador declara sus métricas/dimensiones/período, orden de la fuente y criterio de cambio pertinente.
El esquema concreto se diseña dentro de las tablas actuales; no inventar observaciones que el evento no capturó.
Los umbrales originales de emisión de §3.4/§6/§7 se conservan.

| Tarjeta | Asunto / evidencia pertinente | Vigencia y reaparición después del cierre |
|---|---|---|
|1 Resumen | Día de ventas concreto, informes ligados a ese día; distinguir asunto de un cursor compacto de períodos ya atendidos. | **Pendiente de aclaración del owner:** retiro al terminar período salvo pospuesto, o conservación hasta Visto. Si se conserva, la fecha original se muestra y no reemplaza «ayer» actual. |
|2 Demanda / aprendizaje | Proyección para día concreto y su soporte de días comparables; aprendizaje con progreso real y frecuencia máxima semanal original. No crear control nuevo cada fecha por mera repetición del mismo aprendizaje. | **Misma aclaración pendiente de informes del día.** Alcanzar el mínimo de historia retira aprendizaje. Reemitir demanda en otro día es otro contexto de proyección, no copia de la tarjeta vieja. |
|3 Meta | Comercio/mes; brecha, margen/cobertura y fase temporal ya definida (últimos 10 días). | Mes vigente y condición de meta aplicable; cubierta/meta inválida retira. Datos pertinentes o entrada a fase temporal relevante pueden justificar otro contexto, sin reaviso por cada día igual. Pasar de mes vence ese asunto, no borra histórico. |
|4 Gastos | Comercio/configuración faltante; estado de carga e historia necesaria, no importe null ni día. | Mientras falte la información que se invita a completar; cerrada no vuelve por calendario solo. Un cambio real de configuración/condición puede habilitar otra invitación. |
|5 Suba | Local/insumo/producto; hecho de cambio de costo, ocurrióEn+eventId/revisión, antes/después conocidos. | El hecho sigue siendo consultable si está abierto/pospuesto; mantiene decaimiento original sin copiar. Cierre elimina texto y no lleva el hecho a otro día. Otro hecho pertinente posterior puede habilitar otra tarjeta; un replay no. |
|6 Margen | Producto y contexto de margen/pérdida calculado con las mismas métricas exactas; cambio de signo/escalón material con soporte pertinente. | Mientras la condición se mantenga; recuperado/costo desconocido por regla original retira. Un contexto pertinente agravado puede reabrir, no una venta ajena ni texto/fecha nuevos. |
|7 Sin costo | Producto y cobertura faltante de su venta; evidencia de consumo/costo y escalón material de venta sin costo, no simple ranking de otros productos. | Se retira al conocerse el costo pertinente/dejar de cumplir condición. Nuevos datos pertinentes que agraven la cobertura pueden justificar reabrir. No prometer datos faltantes como cero. |
|8 Stock | Insumo/local; gauge observado/revisión, cantidad, consumo pertinente y recuperación del episodio; no fingerprint por importe null. | Mes mínimo y riesgo original presentes. Cierre silencia versión atendida; consumo posterior menor y reposición→escasez permiten nuevo episodio. Se retira al desaparecer riesgo. Snooze respeta fecha; crítico no anula cierre/snooze. |
|9 Conteo | Conteo/evento+insumo+local. Conteos distintos son asuntos distintos, aunque el insumo coincida. | Informe factual abierto/pospuesto no caduca por cambiar el día o tener poco peso. Otro conteo pertinente emite asunto nuevo; mismo evento no se duplica. No agrupar mermas diferentes para reducir filas. |
|10 Anulaciones | Local y anomalía del conjunto pertinente de anulaciones/ventanas originales; soporte de conteo/monto y referencias. | Mientras se cumpla anomalía; resuelta retira. Nuevas anulaciones pertinentes que cambien el contexto habilitan otro, no ventas o movimientos ajenos. |
|11 Habitual | Cliente del comercio y episodio desde su última visita, mediana y ausencia; fechas unidas entre locales como en AN-3. | Nueva visita resuelve ausencia; >90 días de última visita deja de cumplir condición original y retira, incluso con recordatorio. **Pendiente de aclaración del owner:** reaviso al duplicarse ausencia atendida o solo otro episodio tras visita. Sin reaviso diario implícito. |
|12 Promo | Campaña/ciclo terminado, snapshot causal y métricas asociadas sin doble conteo. Emisión al día siguiente no es caducidad. | Informe sigue vigente abierto/pospuesto después de ese día. Canje tardío actualiza mismo id y respeta remindAt. Snapshot que invalida fin retira; nuevo fin/ciclo pertinente puede emitir. Cierre no permite que el replay del viejo ciclo lo resucite. |
|13 Día flojo | Día objetivo, previsión y productos/márgenes pertinentes; no día de consulta. | **Misma aclaración pendiente de informes del día.** Si se conserva/pospone se identifica el período original, sin recomendar retrospectivamente como si fuera hoy. |

Antes de código se congelan comparadores y ejemplos de aceptación por tipo. Los controles de asuntos permanentes
se actualizan; para asuntos de períodos/hechos se retiran solo cuando se prueba que el contexto no puede volver a
entrar y no tiene aviso/recordatorio/reconciliación pendiente. No usar el hecho de que ya no se muestra entre los 5
como prueba de que está vencido. Una tabla contenida por asuntos reales no tiene tamaño constante si se acumulan
hechos distintos sin atender.

#### 3.9 Transición y datos

Reutilizar card_candidate/card_state/evaluation_run y resúmenes existentes mediante una migración acotada, sin nueva
tabla de historial ni archivo, particionado o copia paralela. La migración debe preservar datos/identidades y
separar contexto factual (5/9), presentación y control de atención; no reconstruir hechos parseando textos.

El legado no tiene closedAt/expiredAt por candidata ni contexto completo visto en cada interacción. accepted antiguo
significaba navegar: no convertirlo en Solucionado observado o declarado. Clasificar de manera conservadora las
versiones vigentes/duplicadas/cerradas solo con evidencia; desconocidos se conservan y no entran al cleanup. Un
updatedAt de otra versión, fecha antigua, importe bajo o ausencia de mostrada no prueba cierre. No inventar tiempos
ni borrar potenciales pendientes para simplificar una restricción nueva.

No modificar métricas, source_revision/metric_contribution, dinero/currency/minorUnit, H2, gauges exactos, permisos,
histórico, contratos de eventos de origen ni corte Stock. Fuentes nuevas de contexto, si faltan, deben respetar
ADR0153: completar eventos, nunca leer tablas de origen desde Analíticas. Si hace falta ampliar productores,
contrato y asignación explícita del coordinador antes de editar; sin decidir producto por cuenta propia.

#### 3.10 Limpieza semanal

`GET /api/internal/analytics/cleanup`, autenticada por CRON_SECRET. Frecuencia semanal; horario operativo propuesto
domingo 03:30 America/Guayaquil (configurarlo remotamente requiere otro encargo autorizado). Corte único por llamada:
instante UTC de inicio menos 90×24 h. Elegible solo resto cerrado/vencido con fecha efectiva probada **estrictamente
anterior** al corte; igualdad se conserva. Nunca por mes, createdAt, fecha de candidata o actualización automática.
El 10 de abril de 2026 el corte por fecha es 10 de enero: no borrar febrero/marzo enteros.

Cierres nuevos eliminan contenido inmediatamente. Los 90 días son red de seguridad/restos históricos, no obligación
de conservar un log nuevo. Pendientes/pospuestos válidos, incluso de seis meses o con recordatorio futuro > 90 días,
no se borran por edad. El control mínimo anti-repetición no tiene TTL ciego: solo se depura con prueba de que ya no
hará falta. Si esa prueba no existe, se conserva su único estado por asunto. Eventos, revisiones/contribuciones,
resúmenes numéricos e histórico del negocio quedan fuera.

Lotes iniciales de hasta 500, presupuesto de 10 s por invocación, búsqueda indexada por elegibilidad/corte y desempate
estable. Transacciones cortas, omitir ocupadas/revalidar bajo lock/CAS y volver a intentarlas; progreso solo después
del commit. Corridas concurrentes/repetidas son idempotentes, sin barridos o locks globales. Si se agota presupuesto,
se conserva el resto y se informa budgetExhausted; siguiente corrida retoma. Medir elegibles/procesadas/omitidas y
último éxito sin exponer datos personales; fallos/backlog nunca justifican vaciar pendientes. Semanal no garantiza
borrado antes de 97 días si hay backlog o fallos; en duda se retiene. No habilitar esta ruta sobre el modelo legado
sin completar su transición y pruebas.

### 4. Histórico en números

Filtro de período (mes en curso, 3, 6, 9, 12 meses) y de local (todos o uno). En AN-1, en cifras y frases:

- Ventas: total, tickets, ticket promedio, variación contra el período anterior de igual largo y los 5 productos que
  más vendieron.
- Ganancia bruta: `revenue − cost_of_goods − payment_commission`, con su cobertura («calculada sobre el 86% de lo
  vendido»).
- Gastos: fijos y variables; resultado = ganancia bruta − gastos, solo si la cobertura es ≥ 80%.
- **Comparación con el mismo período del año anterior: construida**; se muestra solo si `daily_metric` del comercio
  cubre todo ese período anterior. Hoy no aparece.

AN-2 suma valor del stock y subas de insumos («en 6 meses tus insumos subieron en promedio 10%, cada unos 21 días»);
AN-3 suma clientes y promos. «Cuánto ahorraste» no tiene medición en la v1 (H6).

### 5. Contexto externo (AN-1, sin acción)

| Tabla | Forma |
|---|---|
| `analytics.city` | país, provincia/estado, nombre, clave normalizada única (país, provincia, nombre), centro lat/lon, zona horaria, `active_since`, `active_until` |
| `analytics.zone`, `analytics.city_zone` | zonas curadas por país (Ecuador: Sierra, Costa, Amazonía, Galápagos) y pertenencia de cada ciudad (por su provincia) |
| `core.location.city_id` | nullable, FK a `analytics.city` |
| `analytics.weather` (`eventos_clima`) | ciudad, fecha, tipo `forecast` \| `observed`, máxima, mínima, lluvia mm, probabilidad de lluvia, condición, fuente, `fetched_at`; único (ciudad, fecha, tipo, fuente) |
| `analytics.calendar_event` (`eventos_calendario`) | fecha, alcance `country` \| `region` \| `zone` \| `city` + referencia, tipo `holiday` \| `holiday_moved` \| `payday` \| `school` \| `commercial` \| `sports`, nombre, fuente `rule` \| `curated`; único (fecha, alcance, referencia, tipo, nombre) |

- **Ciudad del local:** al crear o editar un local se resuelve desde `address_snapshot` (Google: `locality`, si no
  `administrative_area_level_2`; provincia = `administrative_area_level_1`; Geoapify: `city`/`state`). Local tipeado sin
  datos: `city_id` null, sin contexto (H3). Script único para los locales existentes. Una ciudad se activa con su
  primer local activo de un comercio activo y se desactiva sin ninguno; su histórico queda.
- **Clima — Visual Crossing:** primer paso de AN-1, **probar la API** con la clave del owner para Cuenca (pronóstico
  de hoy y dato de ayer, `include=days`) y confirmar cuántos registros cuenta cada llamada; si no sirve, se para y se
  avisa (plan B pago: Open-Meteo Standard). Cron `GET /api/internal/analytics/context` cada hora: para cada ciudad
  activa cuya hora local pasó las 06:00 sin dato de hoy, guarda el pronóstico de hoy y el observado de ayer (2 registros
  por ciudad por día). Clave en `VISUAL_CROSSING_API_KEY` (la carga el owner en Vercel). Falla del proveedor = se
  reintenta en la próxima hora; un pronóstico que no se tomó ese día no se rellena después.
- **Calendario Ecuador:** feriados nacionales con traslado por regla (librería JS a elegir y comparar contra el decreto
  oficial del año; `holidays` del ADR es Python) + archivo curado versionado con feriados locales (fundación de
  Cuenca, Quito, Guayaquil), décimo tercero (nacional) y cuarto (por zona), quincenas, inicio de clases (Sierra y
  Costa) y fechas comerciales, cada una con su fuente oficial anotada al cargarla. Tipo `sports` definido, sin carga.
- **Nada de esto genera tarjetas, entra en un cálculo ni se le muestra al comerciante** (atribución de Visual Crossing
  no aplica mientras no se muestre; antes de mostrarlo se revisan sus términos, ADR0152 §5).

### 6. AN-2 — stock y costos

- Stock publica en la tx de cada movimiento `stock.purchase.recorded` (insumo, local, cantidad, costo total, costo
  promedio anterior y posterior, existencia después, `occurredAt`, etiqueta) y `stock.adjustment.recorded` (contado,
  teórico anterior, diferencia en cantidad y al costo promedio, existencia después). `source_id` = id del movimiento;
  ambos con local. Las entradas por lote (`stock/entries.ts`) publican uno por línea.
- Recetas traduce `recipes.consumption.applied` también a `stock_consumption` y `stock_on_hand` por insumo.
- Recetas **se suscribe** a `stock.purchase.recorded` (como hoy a `sale.closed`; `EventSubscription.eventType` pasa a
  aceptar los tipos registrados) y, si cambió el costo promedio, publica en esa tx **`recipes.product_cost.changed`**:
  por producto cuya receta usa el insumo `{ productId, productLabel, unitCostBefore, unitCostAfter, itemId,
  itemLabel }`. `source_id` = id de la compra. Su traductor da `product_unit_cost_change`.
  Aclaración técnica del owner (2026-10-17): `unitCostBefore` y `unitCostAfter` son null cuando desconocidos
  (null nunca es cero); no se incluye un producto si ambos son null y no se emite un evento sin productos.
  El delta, `product_unit_cost_change` y la tarjeta5 se calculan solo con ambos costos conocidos.
  Prueba: desconocido→conocido emite el evento sin generar delta ni tarjeta.
- Tarjetas (mismo formato que §3.4):
  - **5 Suba de insumo**, evaluada en la delivery de `recipes.product_cost.changed`: costo unitario +5% o más contra el promedio anterior →
    «La harina subió 12%: tu muzza te cuesta $0,18 más por unidad (≈$9 por semana con lo que vendes).» `p` = impacto
    semanal; `u` = 1 el día de la compra, ×0,7 por día después. Acción `edit_product_price` (core).
  - **8 Insumo que se acaba:** existencia teórica / consumo diario (p25 y p75 de los últimos 28 días) → «Te estás
    quedando sin harina: queda para unas 20 masas y se acabaría entre el jueves y el sábado.» Aparece si el extremo
    corto es ≤ 4 días; requiere el mes mínimo. `u = 1 − días/5`. Acción `record_purchase`.
  - **9 Merma por conteo,** el día del conteo: diferencia al costo ≥ max(un ticket promedio de los últimos 28 días del local, 1% de la venta semanal del local), sin
    conversión de moneda; sin ventas en esos 28 días, cualquier faltante con costo (owner, 2026-10-17) → «Faltaron 3 kg de
    harina (~$4) que no explican las ventas.» Decae ×0,7 por día. Acción: ver detalle del conteo.
- El corte del conteo ya filtra `sale.closed` (G): los eventos nuevos de stock no lo alteran.

### 7. AN-3 — anulaciones, clientes y promos

- POS publica `pos.order.voided` (orden, local, `voidedAt`, líneas y monto cargado, usuario) en la tx de
  `voidPosOrder`; traduce a `voided_tickets`.
- Core publica en la misma tx de su origen **`visit.recorded`** al crear un `core.order` que es visita (cliente
  pseudónimo = UUID v5 determinístico de `(businessId, consumerId)` con namespace fijo propio de Analíticas,
  calculado en el productor sin columna nueva ni backfill de `business_customer`; nombre, local, instante, monto si lo hay; `source_id` = orden) y
  **`coupon.redeemed`** al crear un `core.coupon_redemption` (campaña y su nombre, descuento, costo, orden, local).
  Promos: `promo_discount`/`promo_sales` desde `sale.closed` v2+ (`discountOrigin`) y `coupon.redeemed`, sin contar dos
  veces un canje que ya viajó en la venta POS (clave por canje).
- Core publica además snapshots del ciclo de campaña en sus escrituras (alta, edición y transiciones), con
  `endsAt`/`endedAt`. La tarjeta12 se evalúa al día siguiente del fin desde esos resúmenes, sin leer campañas
  ni cambiar su ciclo existente (aclaración técnica del owner, 2026-10-17).
- Tarjetas:
  - **10 Anulaciones:** tickets anulados en 7 días por local > max(3, media + 2 desvíos de las 8 semanas previas) →
    «Esta semana se anularon 9 tickets en Centro ($64 cargados), el triple de lo normal.» Requiere el mes mínimo.
    Acción: ver anulados (la declara POS).
  - **11 Habitual que se va:** ≥ 4 días distintos con visitas, días desde el último día visitado > 2 × la mediana
    de los intervalos entre esos días y ≥ mediana + 7; última visita en 90 días → «Juan solía venir cada 12 días.
    Su última visita fue hace 25 días.» Para esta tarjeta, varias visitas en la misma fecha local cuentan como
    un solo día visitado; las operaciones y sus importes se conservan completos (owner, 2026-10-17).
    `p` = gasto promedio por día visitado × días de visita esperados perdidos del mes. Acción: «Ver cliente»; H5 verificado en AN-3: Marketing no ofrece envío manual individual.
  - **12 Resultado de promo,** el día después de `ends_at` o de pasar a `ended`: «El cupón 20% te costó $30 en
    descuentos y vino con $140 en ventas en los mismos tickets.» Sin decir que el cupón las causó. Acción: ver
    resultados de la campaña (existente).

## Archivos y paralelismo

- **Esquema y eventos (writer único):** `packages/db/src/schema/analytics.ts`, `core.location.city_id`, migraciones;
  `server/module-events/` (suscriptor core, deliveries, pendientes del conteo); contrato `modules/route-table.ts` y
  `modules/contract.ts`; `permissions-catalog.ts`.
- **Dominio puro:** `packages/domain/src/analytics/` (vocabulario, pesos, tarjetas, meta).
- **Servidor:** `apps/merchant/src/server/analytics/` (aplicación de aportes, evaluación, contexto, lecturas);
  `app/api/analytics/*`, `app/api/internal/analytics/*`; traductores en `modules/{pos,recipes,expenses}` (AN-1) y
  `modules/stock` (AN-2).
- **UI:** `app/backoffice/page.tsx`, `app/backoffice/analytics/`.
- Orden en AN-1: esquema + suscriptor (uno) → en paralelo dominio/evaluación/HTTP y contexto externo (dos) → UI cuando
  el HTTP esté fijado. QA independiente sobre la combinación. Core nunca importa ni nombra módulos (ADR0138/0139):
  traductores y acciones se registran por contrato.
- G (0236) y N (0235) ya están en `dev`. Reserva de rama Neon y migración: coordinador.

## Definition of Done

AN-1 (criterios del corte integrado original; ciclo nuevo en §3.7–§3.10):
- [x] Una venta POS y un gasto (alta, edición que mueve día/concepto/local, borrado) dejan `daily_metric` exacto en el
  día local del comercio; reaplicar o recibir una revisión vieja no cambia nada.
- [x] Un conteo de Stock no se bloquea por una delivery de Analíticas pendiente.
- [x] `MODULE_EVENTS_ENABLED` no aparece en el código: `sale.closed` se publica siempre.
- [x] El Dashboard muestra hasta 5 tarjetas (1, 2, 3, 4, 6, 7, 13) con texto, monto y acción; aceptar/descartar trae la
  siguiente solo si supera el umbral; una descartada sin cambio material no vuelve.
- [x] La meta del día da el número correcto con conceptos reales y estimados, y no aparece sin mes cerrado ni con
  cobertura < 80%.
- [x] Histórico con los 5 períodos y filtro de local; comparativa anual oculta sin período previo completo.
- [x] Clima de Cuenca (pronóstico y observado, proveedor simulado) y calendario de Ecuador guardados por las rutas
  internas; nada visible. Prueba real de API cerrada en AN-3: una petición Cuenca, queryCost=2, forecast/observed persistidos.
- [ ] Medición en rama Neon (§Pruebas 9) dentro del criterio. **Diferida por el owner** al cerrar AN-1 local:
  último frío 2.082,39 ms; no cumple ≤1 s.
- [x] Aislamiento: comercio B no ve ni toca tarjetas, histórico ni locales de A; permiso `analytics` respetado.

Cierre local autorizado por el owner el 2026-10-17: «dejemos de momento las optimizaciones parqueadas, así podemos
cerrar esto e integrarlo en main local para poder avanzar al AN-2». Se acepta AN-1 funcional con QA independiente;
el requisito de rendimiento conserva su umbral y queda pendiente, sin declararlo PASS. [Handoff QA](../factory/0237-an1-qa.md)
y [contrato de ejecución](../factory/0237-an1-contract.md). Esta autorización alcanza `main` local; no push, deploy ni PROD.

AN-2: implementada con QA PASS en `672e7e1c`, [handoff](../factory/0237-an2-handoff.md).

AN-3: implementada con QA PASS de entregas y combinación `1713d942`; eventos atómicos, tarjetas 10/11/12,
histórico clientes/promos, UUIDv5 y snapshots de campaña. Tarjeta 11 por ≥4 días distintos, H5 «Ver cliente».
Prueba real de clima 1/1 PASS (una llamada, queryCost=2), contexto invisible. [Handoff](../factory/0237-an3-handoff.md)
y [QA](../factory/0237-an3-qa.md). Main local autorizado por el owner tras QA; sin push, deploy ni PROD.

Revisión de ciclo de avisos (posterior, todavía no implementada):

- [ ] Catálogo §3.8 cerrado por el owner y contratos v2 implementados sin ambigüedad de navegación/cierre.
- [ ] Una ID por asunto vigente/pospuesto, sin crecimiento diario artificial; fuentes 5/9 y llegada tardía12 seguras.
- [ ] Reapertura pertinente y controles anti-replay; stock posterior/recuperación, condiciones temporales y snoozes.
- [ ] Migración conservadora del legado, permisos/tenant/Stock/dinero/histórico intactos y carreras con CAS/locks.
- [ ] Cleanup de 90 días/semanal probado con límites exactos, pendientes/pospuestos/control protegidos y fallos/backlog.
- [ ] UI kit/tuteo, navegación independiente, decisiones explícitas, versión y recordatorio en 390/1280.
- [ ] QA independiente de entregas/combinación exacta; sin afirmar performance≤1s a partir del PASS funcional.

## Pruebas pertinentes

Recortadas a lo que detecta un defecto plausible; suites Neon con `tools/neon-test.sh`, nunca contra `DATABASE_URL`.

1. Neon: `sale.closed` v2 a las 23:30 locales (día UTC siguiente) cae en el día local; `revenue`, `product_revenue`,
   `units_sold`, `payment_commission` exactos; misma delivery dos veces = sin doble suma.
2. Neon: `expense.recorded` → `updated` que cambia día, concepto y local → `deleted`; el `updated` aplicado después del
   `deleted` (revisión vieja) se ignora; «todo el negocio» queda con local null.
3. Neon: `recipes.consumption.applied` y `sale.commission.frozen` se publican en la tx de su origen (si esa tx
   revierte, no hay evento); producto sin receta → línea con costo null y cobertura menor; módulos apagados → sin
   evento de consumo. Unit: cada traductor es puro (misma entrada, misma salida; sin acceso a base).
   Regresión H2: consumir una venta predeploy pendiente completa Stock sin aportes analytics; una venta nueva con
   delivery core pendiente conserva elegibilidad aunque el consumo se aplique antes del revenue.
4. Neon (regresión): conteo con delivery `core.analytics` pendiente no da 409; con consumo de Recetas pendiente sí.
5. Unit: pesos/selección — cinco con resumen, umbral y novedad; contexto atendido no vuelve sin cambio pertinente;
   stock crítico precede invitaciones y no decae hasta invisible, respetando cierre/snooze.
6. Unit: tarjetas 2, 3, 4, 6, 7 y 13 con fixtures: mínimo de historia, meta con conceptos estimados, primer mes →
   invitación, cobertura baja, ya cubierto, `m ≤ 0`.
   Precisión: mismo producto/día con precios distintos y cobertura parcial conserva el neto exacto costeado,
   comisión de un centavo repartida sin pérdida, null distinto de cero y datos legacy incompletos sin meta ficticia.
7. Neon: aislamiento y permisos de las rutas (§3.5), 404 por id ajeno, 401 del cron, evaluación idempotente por día y
   fallback al abrir.
8. Contexto: ciudad desde snapshots reales de Google (Cuenca) y Geoapify; ingesta de clima con proveedor simulado + una
   prueba real con la clave; carga del calendario curado y unicidades.
9. Medición en rama Neon efímera con datos sintéticos (repite ADR0152 §7): evaluación de un comercio ≤ 1 s con caché
   fría; si no, se para y se informa.
10. Navegador: Dashboard con datos de prueba — navegar sin cerrar, Solucionado/Ignorar/Visto, posponer con fecha
    y mantener ID, refresco al vencimiento y versión obsoleta; histórico con filtros intacto.
11. Neon: sin la variable de entorno, cerrar una venta publica `sale.closed` y crea la delivery `core.analytics`.

AN-2/AN-3: un caso Neon por evento nuevo (atómico con su movimiento, local correcto, sin alterar el corte) y unit por
tarjeta con sus bordes.

Pruebas adicionales de esta revisión:

12. Unit por cada tipo: contexto/episodio, dato relevante/ajeno/viejo, ventana de emisión distinta de vigencia,
    pospuesto fuera del período y temporalidad de 11 según decisión del catálogo. Ningún clock/hash global reabre8.
13. Neon focal: cerrar A mientras se publica B no cierra B; retry del POST tras borrar contenido es idempotente;
    posponer compite con cleanup/delivery de 12; medianoche no libera exclusión. Reposición y consumo intradiarios se
    conservan como episodio aunque el gauge final coincida con el atendido. Sin cambios al corte de Stock.
14. Neon de cleanup: 90 días exactos/justo antes, pendiente antiguo, snooze > 90 días, control necesario, legado desconocido,
    rollback parcial/concurrencia, lote ocupado que luego se retoma; no tocar métricas ni revisiones.
15. Migración/replay aislado: tablas existentes/punteros conservados, hashes previos intactos y 0100 coordinada;
    sin sembrar/reparar/replay global de CI compartida. Solo tools/neon-test.sh/Node24 en DB reservada.

## Pendientes que no bloquean

- **Rendimiento AN-1:** optimizaciones pausadas por decisión expresa del owner al autorizar el cierre y `main` local.
  Fríos reales: 12.767,59 → 4.795,88 → 2.082,39 ms TOTAL; §Pruebas 9 sigue sin cumplir, no se reduce su umbral.
- **Operación del clima:** la prueba real H4 quedó cerrada en AN-3. La carga de `VISUAL_CROSSING_API_KEY`
  en Vercel y cron remoto siguen siendo operaciones posteriores del owner; no se ejecutaron en este encargo.

## Handoff y abierto

Cada etapa: candidato en `dev` con QA independiente, `main` local y push solo con autorización; migración a PROD con
autorización explícita. Falla dentro del alcance vuelve a corrección; cambio material vuelve a acuerdo.
