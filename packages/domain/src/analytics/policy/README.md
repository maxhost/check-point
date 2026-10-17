# Guía de configuración de Analíticas

Configuración versionada de la spec 0237 §3.11. Valores históricos de referencia: `65b5152e`; la fuente editable es `config.ts`. Las recetas y simulación se ejecutan en local con Node 24. No hay edición de configuración en la DB ni desde HTTP.

## Qué puedes cambiar y dónde

Empieza en `packages/domain/src/analytics/policy/config.ts`. Allí están el balance, las reglas y las decisiones disponibles. Para cambiar un umbral o un peso existente no tienes que recorrer consultas, rutas y pantalla. La configuración debe validarse como una unidad; una configuración inválida se rechaza, no se reemplaza silenciosamente por otra.

| Archivo     | Para qué sirve                                                                                       | Cuándo editarlo                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `config.ts` | Valores y reglas de producto; único catálogo editable.                                               | Ajustar pesos, ventanas, caducidad, acciones registradas, textos o reglas activas.      |
| `schema.ts` | Forma de la configuración, unidades y validaciones.                                                  | Incorporar una capacidad nueva con sus comprobaciones; no para saltarse una validación. |
| `rules.ts`  | Algoritmos y parámetros que el programa sabe ejecutar. No tiene otra copia de los valores iniciales. | Registrar un cálculo nuevo ya implementado y probado.                                   |
| `index.ts`  | Valida y entrega una versión inmutable de toda la política.                                          | Integración técnica; no es el lugar de editar el balance.                               |
| `simulation.ts` | Simulación pura sobre datos y controles explícitos, sin DB ni escrituras. | Comparar elegibilidad, componentes del peso, orden y vencimiento con otra política. |
| `README.md` | Esta guía, ejemplos e instrucciones comprobadas.                                                     | Explicar una nueva capacidad o una receta.                                              |

La pantalla recibe del servidor categoría, decisiones, versión, fecha de caducidad y próxima revisión. No tiene una segunda lista de reglas. Los permisos siguen siendo obligatorios: cambiar `actionKey` no concede acceso ni permite navegar a una URL arbitraria.

Editar un archivo **no actualiza automáticamente una aplicación publicada ni un servidor que ya está ejecutándose**. Prueba en local con Node 24 y recarga el proceso local. No hay pantalla de edición, API de configuración, política por comercio ni lectura dinámica de una tabla de configuración. Publicar sigue siendo una operación separada que requiere autorización.

## Cómo se decide qué aparece

1. Los eventos de negocio alimentan los resúmenes de Analíticas, sin copiar los datos de origen cada vez que abres el panel.
2. Las reglas habilitadas calculan los avisos que cumplen sus condiciones. Las ventanas leídas deben derivarse de la misma política.
3. Cada asunto conserva una identidad. Datos pertinentes actualizan la tarjeta; un recálculo idéntico no crea otra.
4. El peso combina monto, urgencia y novedad. Hay un mínimo y un cupo; ser elegible no garantiza aparecer.
5. La decisión del owner y la caducidad siguen teniendo efecto aunque cambies el balance.

Una venta de otro insumo, un cambio de texto o cambiar un peso no son datos nuevos para reabrir un asunto ya atendido. En stock, un consumo posterior pertinente del mismo insumo/local o recuperación seguida de otra escasez sí pueden justificar un episodio nuevo.

## Cambios y avisos existentes

| Cambio                       | Efecto esperado                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Peso/urgencia/umbral/ventana | Se reevalúa lo afectado con una nueva `policyVersion`; no cambia la edad ni borra decisiones previas.          |
| Regla deshabilitada          | Deja de generar y de mostrar su contenido; conserva datos de negocio y control mínimo contra repetición.       |
| Regla habilitada de nuevo    | Respeta lo ya atendido y lo vencido; no resucita el mismo contexto por haber cambiado la configuración.        |
| Caducidad menor              | Revalida avisos vigentes y puede vencerlos antes. El lector los oculta sin esperar la limpieza semanal.        |
| Caducidad mayor              | Solo beneficia episodios nuevos. No prorroga los abiertos, atendidos o vencidos.                               |
| Recordatorio vencido         | La misma tarjeta vuelve a competir con novedad 1 una sola vez; no renueva edad/caducidad ni garantiza un cupo. |
| Revertir el archivo          | Restaura el balance, no vuelve atrás decisiones ni recupera textos eliminados.                                 |

El máximo inicial es 90 días desde el inicio fijo del episodio. También vence un pendiente o pospuesto. El recordatorio debe ser futuro y no posterior a `expiresAt`; no puedes usarlo para prolongar la vida del aviso. Solucionado, Ignorar y Visto eliminan el texto inmediatamente; solo queda el control mínimo necesario. No se crea un historial de copias.

El resumen de ayer es una sola tarjeta renovable: marcado se retira; si no se marcó, se reemplaza su contenido por el siguiente día. No se pospone y no acumula resúmenes anteriores. El histórico numérico permanece.

## Parámetros generales

En estas tablas, «positivo» significa finito y mayor que cero; «entero» excluye decimales. La validación técnica evita valores imposibles, pero no demuestra que cualquier combinación resulte útil. Los límites exactos canónicos están en `schema.ts`/`rules.ts`.

| Campo de `config.ts`        | Unidad / valor inicial         | Rango técnico observado                              | Qué cambia / consumidor                                                                                                                                                       |
| --------------------------- | ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `revision`                  | Texto `inbox-lifecycle-1`      | Texto no vacío.                                      | Nombre legible de la revisión. La versión completa también incluye contenido, registro y versión de algoritmos; no basta con mantener el mismo nombre para ocultar un cambio. |
| `weights.minimum`           | Peso `0.05`                    | Positivo.                                            | Piso del ranking/lector; subirlo deja menos avisos visibles.                                                                                                                  |
| `weights.maximumCards`      | Tarjetas `5`                   | Entero 1–100.                                        | Cupo total del inbox, incluido el resumen diario. El valor aprobado inicial es cinco.                                                                                         |
| `weights.noveltyDecay`      | Factor `0.6`                   | Mayor que 0 y menor o igual a 1.                     | Multiplicador por días de exposición real: 1 → 0,6 → 0,36. No por cada GET. Ranking y estado de exposición.                                                                   |
| `weights.maximumPlata`      | Factor `3`                     | Positivo.                                            | Tope del componente monetario de peso. No cambia precios, costos ni ventas.                                                                                                   |
| `weights.noSalesDailyMajor` | Moneda del comercio `20`       | Positivo.                                            | Referencia de peso sin ventas; 20 unidades mayores de su moneda, sin FX. No es el umbral monetario de merma.                                                                  |
| `weights.averageDailyDays`  | Días `28`                      | Entero 1–3650.                                       | Ventana de venta diaria promedio que sirve de referencia al peso; consultas y pesos. Es distinta de las ventanas particulares de cada regla.                                  |
| `weights.minimumUrgency`    | Factor `0.2`                   | Mayor que 0 y menor o igual a 1, no mayor al máximo. | Piso de urgencia normalizada.                                                                                                                                                 |
| `weights.maximumUrgency`    | Factor `1`                     | Mayor que 0 y menor o igual a 1, no menor al mínimo. | Techo de urgencia normalizada.                                                                                                                                                |
| `weights.summaryFixed`      | Peso `10`                      | Positivo.                                            | Privilegio del resumen vigente de ayer; no da el privilegio a reportes viejos.                                                                                                |
| `lifetime.days`             | Días de 24 h `90`              | Entero 1–3650.                                       | Edad máxima del episodio; sincronización, lectura, comandos y limpieza. Este encargo conserva 90.                                                                             |
| `snooze.noveltyOnDue`       | `reset`                        | Único modo soportado hoy: `reset`.                   | Renueva novedad una vez al vencer un recordatorio; no restablece el decaimiento por antigüedad del hecho.                                                                     |
| `decisions.resolve.label`   | `Solucionado`                  | Texto no vacío.                                      | Texto del botón, no altera el significado de la operación.                                                                                                                    |
| `decisions.ignore.label`    | `Ignorar`                      | Texto no vacío.                                      | Texto del botón.                                                                                                                                                              |
| `decisions.seen.label`      | `Visto`                        | Texto no vacío.                                      | Texto del botón informativo.                                                                                                                                                  |
| `decisions.snooze.label`    | `Recordarme luego`             | Texto no vacío.                                      | Texto del botón de recordatorio.                                                                                                                                              |
| `categories.informational`  | `[seen, ignore]`               | Subconjunto sin repetidos de esas dos decisiones.    | Capacidades enviadas por servidor y validadas al decidir; nunca snooze/resolve.                                                                                               |
| `categories.actionable`     | `[resolve, ignore, snooze]`    | Subconjunto sin repetidos de esas tres.              | Capacidades operativas; quitar una la retira de UI y el servidor la rechaza.                                                                                                  |
| `categories.marketing`      | `[]`                           | Vacío por ahora.                                     | Marketing parqueado; no habilita una acción inexistente.                                                                                                                      |
| `texts.periodDay`           | `Datos del {{from}}`           | Plantilla registrada, campos declarados.             | Etiqueta de un día en el DTO.                                                                                                                                                 |
| `texts.periodRange`         | `Datos del {{from}} al {{to}}` | Plantilla registrada, campos declarados.             | Etiqueta de período en el DTO.                                                                                                                                                |

### Materialidad del monto y finanzas compartidas

| Campo | Unidad / inicial | Rango validado | Efecto / consumidores |
|---|---|---|---|
| `weights.materialBucketBase` | Base `2` | Finita y mayor que 1. | Agrupa la magnitud monetaria por tramos. Sirve de señal material en los comparadores; no demuestra datos nuevos ni resolución por sí sola. Cambiarla no reabre un contexto atendido sin evidencia pertinente. Pesos y comparadores de meta/margen/costos faltantes. |
| `finance.salesDays` | Días `28` | Entero 1–3650. | Ventana compartida de margen/cobertura y días habituales de venta para la meta. La usan finanzas, consultas y reglas que consultan riesgo/meta. |
| `finance.closedMonths` | Meses `3` | Entero 1–120. | Meses cerrados para estimar gastos fijos y variables; se calcula con dinero racional exacto, sin el divisor fijo antiguo. No pertenece a una tarjeta 3 individual. |
| `finance.minimumCoverage` | Proporción `0.8` | [0,1]. | Cobertura mínima de costo para equilibrio/meta. No vuelve conocido un costo null ni habilita margen sin soporte monetario exacto. |

La ficha 3 solo configura su fase/multiplicador de peso. Dos reglas de meta pueden tener pesos distintos y compartir el mismo cálculo financiero: duplicar una regla no duplica ni altera ventas, gastos o la meta base. `7.minimumCoverage` es su umbral particular de urgencia; no sustituye `finance.minimumCoverage`.

## Textos y plantillas: inventario completo del congelado

Los valores completos se leen/editan en `config.ts`; `rules.ts` declara únicamente sus campos permitidos, sin otra copia de defaults. La validación rechaza una clave requerida ausente o placeholders que esa plantilla no soporta. Una cadena vacía puede ser un fragmento deliberado (`card_expenses_6`), no debe rellenarse por intuición. Las seis etiquetas core sí requieren texto no vacío.

Puedes cambiar redacción, pero no convertir un estimado en dato observado ni afirmar causalidad de una promo. Conserva tuteo. Los placeholders `{{nombre}}` se rellenan por el motor: quitar un dato del texto cambia la comunicación, no el cálculo; añadir un campo no soportado se rechaza. No pegues valores fijos de un comercio como si fueran una plantilla.

| Clave canónica | Campos permitidos (`—` = ninguno) |
|---|---|
| `product_unlisted` | — |
| `product_generic` | — |
| `expense_generic` | — |
| `stock_item_generic` | — |
| `stock_units_generic` | — |
| `stock_today` | — |
| `summary_comparison` | `percent`, `direction`, `reference` |
| `summary_more` | — |
| `summary_less` | — |
| `summary_comparison_week` | — |
| `summary_comparison_days` | `days` |
| `summary_location` | `label`, `amount`, `tickets` |
| `demand_history_missing` | `days` |
| `stock_range_open` | `from` |
| `stock_range_closed` | `from`, `to` |
| `window_weeks` | `weeks` |
| `window_days` | `days` |
| `anomaly_this_week` | — |
| `anomaly_days` | `days` |
| `anomaly_baseline_weeks` | `windows` |
| `anomaly_baseline_days` | `windows`, `days` |
| `impact_week` | — |
| `impact_days` | `days` |
| `card_summary_1` | — |
| `card_summary_2` | `v0`, `v1` |
| `card_summary_3` | `v0` |
| `card_summary_4` | `v0`, `v1`, `v2`, `v3`, `v4` |
| `card_demand_1` | — |
| `card_demand_2` | `v0`, `v1` |
| `card_demand_3` | `v0`, `v1` |
| `card_demand_4` | — |
| `card_demand_5` | `v0`, `v1`, `v2`, `v3` |
| `card_goal_1` | — |
| `card_goal_2` | `v0`, `v1`, `v2` |
| `card_expenses_1` | — |
| `card_expenses_2` | — |
| `card_expenses_3` | — |
| `card_expenses_4` | — |
| `card_expenses_5` | — |
| `card_expenses_6` | — |
| `card_margin_1` | — |
| `card_margin_2` | — |
| `card_margin_3` | `v0`, `v1`, `v2`, `window` |
| `card_margin_4` | `v0`, `v1`, `v2`, `v3`, `window` |
| `card_unknown_cost_1` | — |
| `card_unknown_cost_2` | `v0` |
| `card_unknown_cost_3` | `v0`, `v1`, `v2`, `window` |
| `card_slow_day_1` | — |
| `card_slow_day_2` | `v0`, `v1` |
| `card_slow_day_3` | `v0`, `v1`, `v2`, `v3` |
| `card_stock_buildStockRule_1` | `v0` |
| `card_stock_buildStockRule_2` | `v0` |
| `card_stock_buildStockRule_3` | `v0` |
| `card_stock_buildStockRule_4` | `v0`, `v1`, `v2`, `v3` |
| `card_stock_buildFactCandidates_1` | `v0` |
| `card_stock_buildFactCandidates_2` | `v0`, `v1`, `v2`, `v3`, `v4`, `impact` |
| `card_stock_buildFactCandidates_3` | `v0` |
| `card_stock_buildFactCandidates_4` | `v0` |
| `card_stock_buildFactCandidates_5` | `v0`, `v1`, `v2`, `v3` |
| `card_customer_promo_buildRule_1` | — |
| `card_customer_promo_buildRule_2` | `window`, `v0`, `v1`, `v2`, `baseline`, `v3` |
| `card_customer_promo_buildRule_3` | — |
| `card_customer_promo_buildRule_4` | `v0`, `v1`, `v2` |
| `action_view_day` | — |
| `action_view_calculation` | — |
| `action_view_customer` | — |
| `action_view_campaign_results` | — |
| `action_edit_product_price` | — |
| `action_view_modules` | — |
| `periodDay` | `from` |
| `periodRange` | `from`, `to` |

Lectura de las variables más frecuentes: en resumen, `v0..v4` del cuerpo son venta formateada, tickets, comparación, producto más vendido y detalle por local; en meta son meta de hoy, faltante del mes y días restantes. En suba de costo son insumo, porcentaje, producto, delta por unidad y monto de impacto, más `impact` como texto del horizonte. En stock son cantidad, unidad, local y rango. En merma son cantidad faltante, unidad, insumo y costo. En promo son nombre, descuento y venta conjunta. Los fragmentos auxiliares usan los nombres descriptivos del cuadro; sus valores se calculan, no se editan a mano.

No se puede añadir un placeholder solo por escribir su nombre. Para agregar un dato no existente se implementa/proporciona y registra ese campo con su prueba. Las etiquetas de navegación `action_*` no cambian los permisos ni el destino. Para una acción declarada genérica, un override opcional `action_<key>` conserva fallback a su declaración cuando no está configurado; es una etiqueta simple sin placeholders. No se copian nombres/catálogos de módulos al core. La validación exige etiquetas simples, no vacías y sin llaves.

## Frecuencias, horarios y presupuestos

Estos parámetros no son ventas ni reglas nuevas. Cambian cuánto trabajo se procesa o cuándo se desea programar. Un presupuesto menor puede dejar trabajo pendiente; no autoriza presentar datos parciales como completos.

| Campo bajo `operation`     | Unidad / inicial    | Rango técnico observado | Consumidor / impacto                                                                                                     |
| -------------------------- | ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `evaluationBudgetMs`       | ms `20000`          | Entero positivo.        | Presupuesto de la evaluación/transacción por comercio. El cron también usa su límite operativo; no es una garantía de latencia del GET.        |
| `evaluationBatchSize`      | Comercios `20`      | Entero positivo.        | Máximo por tanda del evaluador programado.                                                                               |
| `recentActivityDays`       | Días `35`           | Entero positivo.        | Selección de comercios recientes; no vuelve inaccesible un pendiente/recordatorio válido de un comercio inactivo.        |
| `earliestEvaluationHour`   | Hora local `3`      | Entero 0–23.            | Hora mínima de evaluación según zona del comercio. No confundir con la zona del scheduler de limpieza.                   |
| `fallbackWaitMs`           | ms `3000`           | Entero positivo.        | Espera del primer GET y `refreshAfterMs` de preparación. La UI usa el valor del DTO y deja de repetir cuando está ready. |
| `desiredEvaluationMinutes` | Minutos `30`        | Entero positivo.        | Cadencia deseada del scheduler externo. Editarla no modifica un cron desplegado.                                         |
| `cleanupBudgetMs`          | ms `10000`          | Entero positivo.        | Máximo de trabajo del servicio de limpieza por invocación.                                                               |
| `cleanupBatchSize`         | Filas `500`         | Entero positivo.        | Lote máximo de limpieza; no elimina controles necesarios por adelantado, eventos ni resúmenes de negocio.                                          |
| `cleanupWeekday`           | Día semanal `0`     | Entero 0–6, domingo=0.  | Frecuencia semanal deseada de limpieza.                                                                                  |
| `cleanupHour`              | Hora `3`            | Entero 0–23.            | Hora deseada de limpieza en `schedulerTimezone`.                                                                         |
| `cleanupMinute`            | Minuto `30`         | Entero 0–59.            | Minuto deseado de limpieza.                                                                                              |
| `schedulerTimezone`        | `America/Guayaquil` | Zona IANA válida.       | Interpreta el horario deseado del cron, no mueve recordatorios guardados como instantes UTC.                             |

El endpoint interno de limpieza requiere `CRON_SECRET` existente. No se crea ni activa un cron remoto en este encargo. La frecuencia deseada y la programación externa deben concordar cuando se publique con autorización. Un fallo o backlog puede retrasar el borrado físico; la caducidad de lectura no se retrasa y no se promete que todo se borre exactamente al día 97.

## Campos comunes de una regla

| Campo        | Qué significa                           | Cambio permitido / límite                                                                                                 |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`         | Identidad del tipo de aviso.            | Único, letras/números/guion/guion bajo; no renombrar una regla existente para aparentar datos nuevos.                     |
| `handler`    | Algoritmo registrado.                   | Debe existir en `rules.ts`; no es una expresión ejecutable ni SQL.                                                        |
| `enabled`    | Activa o retira la regla.               | `false` no apaga Analíticas core ni borra métricas. 11 no puede ponerse en true hoy.                                      |
| `category`   | Informativa, accionable o Marketing.    | Debe ser compatible con el algoritmo; de aquí salen las decisiones permitidas.                                            |
| `sender`     | Remitente visible, p. ej. Stock.        | Texto no vacío; no cambia fuentes, permisos ni categoría.                                                                 |
| `actionKey`  | Acción de navegación registrada o null. | Clave soportada; se resuelve con permisos y declaraciones encendidas, no con una URL libre. El enlace no cierra el aviso. |
| `parameters` | Valores del algoritmo.                  | Todos los requeridos y ninguno desconocido; límites del registro.                                                         |

En los siguientes cuadros, `N+` = entero de 1 a 3650; `R+` = finito ≥0 (hasta Number.MAX_SAFE_INTEGER si no se declara otro máximo); `ratio` = [0,1]. Son los límites del registro soportado en `rules.ts`. Las relaciones mínimo≤máximo, cuantil lento≤rápido y criticidad≤riesgo también se validan.

## 1 — Resumen diario (`summary`)

Informativa, Ventas, acción `view_day`. Fuente anterior: `cards/index.ts`, resumen de ayer/comparación por mismo día semanal. Consumidores: generador, ventana de consulta, sincronización del único resumen renovable y lector.

| Parámetro        | Unidad / inicial | Rango | Efecto                                                                                                                                     |
| ---------------- | ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `comparisonDays` | Días `7`         | N+    | Distancia de comparación; solo se informa si hubo ventas en ese día. Consultar al menos comparación+1 días evita una comparación truncada. |

Monto y tickets siguen siendo hechos; cambiar el parámetro no los altera. El resumen vigente usa `weights.summaryFixed`. No se pospone.

## 2 — Demanda habitual (`demand`)

Informativa, Ventas, sin enlace. Fuente anterior: `cards/index.ts`, historia suficiente, mediana de días iguales y aprendizaje semanal. Consumidores: generador, consultas de días comparables y control de frecuencia del aprendizaje.

| Parámetro              | Unidad / inicial      | Rango        | Efecto                                                                               |
| ---------------------- | --------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `historyDays`          | Días `28`             | N+           | Antigüedad mínima desde la primera venta antes de prometer un patrón.                |
| `minimumOccurrences`   | Días equivalentes `4` | N+, ≤ máximo | Cantidad mínima de días de la semana con venta.                                      |
| `maximumOccurrences`   | Días equivalentes `8` | N+, ≥ mínimo | Tope de muestras para la mediana.                                                    |
| `topProducts`          | Productos `3`         | N+           | Cuántos se mencionan, ordenados por unidades.                                        |
| `learningCooldownDays` | Días `7`              | N+           | Intervalo mínimo de la invitación de aprendizaje; no replica la tarjeta diariamente. |
| `fixedPlata`           | Factor `0.1`          | R+           | Peso base sin monto monetario.                                                       |
| `urgency`              | Factor `1`            | ratio        | Urgencia de la información.                                                          |

## 3 — Meta para cubrir el mes (`goal`)

Accionable, Finanzas, acción `view_calculation`. Fuente anterior: `cards/index.ts`/`calculateGoal`. Consumidores: cálculo de meta, consultas de gastos/margen y generador. El cálculo común está en `finance`, no duplicado dentro de esta regla. No se cambia la definición de dinero exacto/costo conocido por editar cobertura.

| Parámetro           | Unidad / inicial | Rango | Efecto                                                                                                                    |
| ------------------- | ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| `closingPhaseDays`  | Días `10`        | N+    | Desde cuándo considerar el tramo final del mes para el multiplicador.                                                     |
| `closingMultiplier` | Factor `1.5`     | R+    | Refuerzo del peso en ese tramo.                                                                                           |

No se muestra una meta monetaria imposible cuando el margen no permite calcularla; las invitaciones y costos siguen sus reglas propias.

## 4 — Completar gastos / primer mes (`expenses`)

Finanzas, acción `record_expense`. La invitación a cargar es accionable; la variante «Tu primer mes con gastos» es informativa. Fuente anterior: `cards/index.ts`, falta de gastos y fase del mes. Consumidores: generador, consultas de gastos y capacidades de la variante.

| Parámetro          | Unidad / inicial | Rango | Efecto                                       |
| ------------------ | ---------------- | ----- | -------------------------------------------- |
| `missingFixedDays` | Días `45`        | N+    | Ventana para decidir si faltan gastos fijos. |
| `closingPhaseDays` | Días `10`        | N+    | Tramo final del mes que cambia urgencia.     |
| `fixedPlata`       | Factor `1`       | R+    | Componente monetario fijo de la invitación.  |
| `normalUrgency`    | Factor `0.5`     | ratio | Urgencia antes del tramo final.              |
| `closingUrgency`   | Factor `0.8`     | ratio | Urgencia dentro del tramo final.             |

## 5 — Subió un insumo (`cost-rise`)

Accionable, Costos, acción `edit_product_price`. Fuente anterior: `cards/stock.ts`, `unit_cost_change` y carry factual. Consumidores: delivery de cambio de costo, consultas de ventas, cálculo puro de costo/peso, contexto factual y lector. Solo se calcula delta si ambos costos son conocidos; null no es cero.

| Parámetro          | Unidad / inicial    | Rango | Efecto                                                                                              |
| ------------------ | ------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| `salesDays`        | Días `28`           | N+    | Ventana de unidades vendidas para estimar impacto semanal.                                          |
| `minimumRiseRatio` | Proporción `0.05`   | R+    | Suba mínima del insumo; 0,05 significa 5%. Requiere costo anterior positivo y aumento del producto. |
| `ageDecay`         | Factor diario `0.7` | ratio | Multiplicador por edad del hecho. Es independiente de la novedad por exposición.                    |
| `impactDays` | Días `7` | N+ | Horizonte del impacto monetario. Se escala como impacto de la ventana × impactDays/salesDays; con 28/7 conserva el divisor histórico 4. |
| `urgency`          | Factor `1`          | ratio | Urgencia base de la alerta.                                                                         |

## 6 — Margen bajo / pérdida (`margin`)

Accionable, Costos, acción `edit_product_price`. Fuente anterior: `cards/index.ts`, productos con costo y ganancia unitaria. Consumidores: resúmenes de producto, cálculo de meta/riesgo, generador/peso.

| Parámetro       | Unidad / inicial | Rango | Efecto                                                                                |
| --------------- | ---------------- | ----- | ------------------------------------------------------------------------------------- |
| `salesDays`     | Días `28`        | N+    | Ventana de ventas, costos y medianas.                                                 |
| `minimumSales`  | Ventas `10`      | N+    | Evidencia mínima por producto.                                                        |
| `medianRatio`   | Proporción `0.5` | ratio | Marca bajo margen respecto de la mediana del comercio; negativo sigue siendo pérdida. |
| `impactDays` | Días `7` | N+ | Horizonte del impacto monetario. Se escala como impacto de la ventana × impactDays/salesDays; con 28/7 conserva el divisor histórico 4. |
| `normalUrgency` | Factor `0.3`     | ratio | Urgencia habitual.                                                                    |
| `riskUrgency`   | Factor `1`       | ratio | Urgencia cuando la meta/margen del comercio está en riesgo.                           |

## 7 — Costos desconocidos (`unknown-cost`)

Accionable, Costos, acción `set_product_cost`. Fuente anterior: `cards/index.ts`, unidades sin costo y producto de mayor venta. Consumidores: resumen de productos, cobertura/meta, generador/peso.

| Parámetro         | Unidad / inicial | Rango | Efecto                                                     |
| ----------------- | ---------------- | ----- | ---------------------------------------------------------- |
| `salesDays`       | Días `28`        | N+    | Ventana de venta con costo faltante.                       |
| `minimumCoverage` | Proporción `0.8` | ratio | Debajo de ella el faltante impide la meta y gana urgencia. |
| `impactDays` | Días `7` | N+ | Horizonte del impacto monetario. Se escala como impacto de la ventana × impactDays/salesDays; con 28/7 conserva el divisor histórico 4. |
| `normalUrgency`   | Factor `0.6`     | ratio | Urgencia habitual.                                         |
| `riskUrgency`     | Factor `1`       | ratio | Urgencia cuando afecta cobertura/meta.                     |

## 8 — Stock que se acaba (`stock`)

Accionable, Stock, acción `record_purchase`. Fuente anterior: `cards/stock.ts`, gauges y consumo diario por insumo/local. Consumidores: consulta de consumo/gauges, generador de rango, contexto causal/reapertura, prioridad y lector.

| Parámetro         | Unidad / inicial | Rango           | Efecto                                                                                                                                              |
| ----------------- | ---------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `historyDays`     | Días `28`        | N+              | Historia mínima de consumo antes de estimar duración.                                                                                               |
| `consumptionDays` | Días `28`        | N+              | Muestras diarias de consumo utilizadas para estimar el rango.                                                                                       |
| `slowQuantile`    | Cuantil `0.25`   | ratio, ≤ rápido | Extremo de consumo lento; influye en el extremo largo del rango.                                                                                    |
| `fastQuantile`    | Cuantil `0.75`   | ratio, ≥ lento  | Extremo de consumo rápido; influye en el extremo corto.                                                                                             |
| `riskDays`        | Días `4`         | R+, ≥ crítico   | Aparece si el extremo corto no supera esta duración.                                                                                                |
| `criticalDays`    | Días `1`         | R+, ≤ riesgo    | Prioridad del riesgo crítico sobre invitaciones dentro del cupo.                                                                                    |
| `urgencyScale` | Días `5` | Finito estrictamente positivo; no admite cero. | Escala de urgencia: 1 − extremo corto/escala, antes de los límites globales de urgencia. |
| `fixedPlata`      | Factor `1`       | R+              | Peso base sin monto de venta.                                                                                                                       |

Si hay días sin consumo el extremo largo puede no ser acotable; la guía no promete una fecha exacta. La prioridad no ignora un cierre ni una postergación vigente. Reabrir requiere datos pertinentes, no bajar un umbral arbitrariamente sobre el mismo aviso atendido.

## 9 — Merma de un conteo (`count-gap`)

Informativa, Stock, acción `view_count_detail`. Fuente anterior: `cards/stock.ts`, hecho de ajuste por conteo. Consumidores: delivery factual, ticket/promedio local, ventana semanal, control por evento de conteo y lector. Conteos distintos son asuntos distintos, aunque se trate del mismo insumo.

| Parámetro          | Unidad / inicial    | Rango | Efecto                                                                  |
| ------------------ | ------------------- | ----- | ----------------------------------------------------------------------- |
| `salesDays`        | Días `28`           | N+    | Ventana del ticket promedio del local.                                  |
| `weeklyDays`       | Días `7`            | N+    | Venta previa al conteo usada como referencia semanal.                   |
| `weeklySalesRatio` | Proporción `0.01`   | ratio | Piso proporcional de venta: 0,01 es 1%.                                 |
| `ageDecay`         | Factor diario `0.7` | ratio | Pérdida de peso por antigüedad del conteo, independiente de exposición. |
| `urgency`          | Factor `1`          | ratio | Urgencia del informe.                                                   |

Piso inicial: faltante al costo ≥ max(ticket promedio local, 1% de venta semanal). Si no hubo ventas en los 28 días, cualquier faltante con costo conocido puede ser elegible, sujeto al ranking. Todo en moneda del comercio, sin convertir COP a USD ni volver al antiguo mínimo fijo de 3 unidades.

## 10 — Tickets anulados (`voids`)

Accionable, Ventas, acción `view_voided_orders`. Fuente anterior: `cards/customer-promo.ts`, anomalía por local y semanas previas. Consumidores: consulta de anulaciones, generador/contexto por local y lector.

| Parámetro            | Unidad / inicial  | Rango         | Efecto                                                                                                                             |
| -------------------- | ----------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `historyDays`        | Días `28`         | N+            | Historia mínima desde primera venta del local.                                                                                     |
| `windowDays`         | Días `7`          | N+            | Tamaño de la ventana actual y cada bloque previo.                                                                                  |
| `baselineWindows`    | Ventanas `8`      | N+            | Número de bloques previos para media y desvío.                                                                                     |
| `minimumCount` | Anulaciones `3` | R+ | Piso numérico del umbral estadístico; el conteo observado sigue siendo entero y debe superar max(piso, media+desvíos×sd). |
| `standardDeviations` | Multiplicador `2` | R+            | Cuántos desvíos por encima de la media se consideran anómalos.                                                                     |
| `urgency`            | Factor `0.8`      | ratio         | Urgencia de la anomalía.                                                                                                           |

La ventana de lectura debe incluir el bloque actual más ocho previos: 7×(8+1)=63 días con los valores iniciales. Cambiar un parámetro no puede dejar SQL leyendo solo 28 días.

## 11 — Clientes / Marketing (`customers`)

**Parqueada**, categoría Marketing, remitente Clientes, `enabled:false`, `actionKey:null`, sin parámetros activos. Fuente histórica anterior: `cards/customer-promo.ts`, regla individual por días distintos/mediana; queda como antecedente, no regla de Marketing que debamos seguir usando.

No reactivar cambiando un booleano. Hoy la validación lo rechaza. No hay envío manual individual de cupones ni se inventa una tarjeta por cada cliente o una audiencia agregada. Conserva eventos, métricas e histórico de clientes. Reabrir este trabajo requiere reglas oficiales, presentación y una acción real de Marketing en otro encargo.

## 12 — Resultado de campaña (`campaign`)

Informativa, Promos, acción `view_campaign_results`. Fuente anterior: `cards/customer-promo.ts`, snapshot de campaña y métricas de promoción. Consumidores: consulta de campañas/promos, generador y reconciliación tardía sobre la misma tarjeta/ID.

| Parámetro           | Unidad / inicial | Rango | Efecto                                                                                                         |
| ------------------- | ---------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `emissionDelayDays` | Días `1`         | N+    | Cuándo emitir respecto del fin de campaña; salir de esa ventana no significa resolver un informe ya pendiente. |
| `urgency`           | Factor `0.6`     | ratio | Urgencia del informe.                                                                                          |
| `zeroDiscountPlata` | Factor `1` | R+ | Peso monetario fijo cuando el descuento total es cero; no inventa un descuento ni divide por cero. |

Canjes tardíos pueden actualizar la misma tarjeta; no crean copias ni adelantan un recordatorio. No se suman dos veces canjes que ya viajaron en venta POS. Las ventas con promo no se presentan como causadas por ella.

## 13 — Día flojo / recomendación (`slow-day`)

Informativa, Ventas, sin enlace. Fuente anterior: `cards/index.ts`, comparación de día esperado con promedio y productos con ganancia conocida. Consumidores: consultas de días equivalentes/productos y generador/peso.

| Parámetro            | Unidad / inicial      | Rango        | Efecto                                                           |
| -------------------- | --------------------- | ------------ | ---------------------------------------------------------------- |
| `salesDays`          | Días `28`             | N+           | Ventana de promedio, ventas y costos de productos.               |
| `historyDays`        | Días `28`             | N+           | Historia mínima para prometer patrón.                            |
| `minimumOccurrences` | Días equivalentes `4` | N+, ≤ máximo | Evidencia mínima para la mediana.                                |
| `maximumOccurrences` | Días equivalentes `8` | N+, ≥ mínimo | Tope de muestras comparables.                                    |
| `minimumProducts`    | Productos `2`         | N+           | Productos con costo conocido necesarios para recomendar.         |
| `minimumSales`       | Ventas `10`           | N+           | Evidencia mínima de ventas.                                      |
| `slowRatio`          | Proporción `0.75`     | ratio        | Se considera flojo si el esperado es menor que 75% del promedio. |
| `topProducts`        | Productos `2`         | N+           | Cuántas alternativas se mencionan por ganancia unitaria.         |
| `normalUrgency`      | Factor `0.7`          | ratio        | Urgencia habitual.                                               |
| `riskUrgency`        | Factor `1`            | ratio        | Urgencia si existe meta del mes.                                 |

## Addendum de cierre: cambio de cálculo y poda de campañas

Estas salvaguardas forman parte del motor y de la limpieza; no modifican las métricas ni las fuentes de negocio.

### Cambiar el cálculo no demuestra que el problema empeoró

Las reglas 3/4/6/7 distinguen una `calculationKey` formada por los parámetros que intervienen en el cálculo. Cambiar etiquetas, remitente o peso no forma otra base de cálculo. La clave no es una prueba de una venta, gasto o costo nuevo.

Si cambian parámetros y el contexto anterior deja de ser comparable, se registra una nueva referencia de comparación (baseline) conservando el cierre previo, inicio del episodio y caducidad. El cambio de configuración por sí solo no reabre el aviso ni reinicia los 90 días. Después, los nuevos datos pertinentes pueden justificar una reapertura con el comparador correspondiente.

Si llegan datos nuevos al mismo tiempo que cambian parámetros y no se puede separar su efecto, se toma la misma salida conservadora: establecer baseline sin inventar evidencia de agravamiento. No se atribuye a una operación comercial un cambio que también puede explicarse por el nuevo cálculo. Las evaluaciones posteriores vuelven a comparar contra esa referencia con las reglas vigentes.

Ejemplo: marcaste como atendido un margen bajo. Cambias la ventana de 28 a 42 días y el monto estimado aumenta porque entraron días distintos. El monto mayor no prueba por sí solo que hubo nuevas pérdidas posteriores al cierre: se conserva el cierre y se toma referencia comparable. Una venta/cambio de costo posterior que cumpla el comparador sí puede justificar otro episodio. Cambiar solo el texto del botón no establece otro cálculo ni genera un aviso.

### Los 90 días del aviso y la prueba de poda son cosas diferentes

El contenido y los recordatorios de la tarjeta 12 caducan con el máximo configurado del episodio, **90 días por defecto**, aunque estén pendientes o pospuestos. Al llegar a ese corte se compacta el último control por campaña a su ciclo/cursor de snapshot (capturedAt/eventId y revisión de fuente) necesario: sin venta, descuento, texto de notificación ni log de decisiones. No se conserva una notificación visible durante diez años.

Eliminar incluso ese control compacto exige una prueba más fuerte. Una configuración válida puede retrasar la emisión de una campaña usando `emissionDelayDays`. Por eso la poda definitiva de la 12 solo es segura después de `finishDay + máximo emissionDelayDays admitido por el registro`, y además tras `finishOccurredAt` UTC demostrado + máximo TTL admitido ×24h, cumpliendo las demás pruebas de fuente/CAS/ausencia de contenido y recordatorio. Se requieren ambas fronteras: cambiar la zona horaria no puede volver elegible un ciclo ya podado. Si no se demuestra el instante UTC, se conserva el cursor compacto, sin inventarlo desde una fecha local. El máximo estructural actual del registro es **3650 días**. Purgar el control a los 90 y luego aceptar una configuración con retraso mayor podría volver a presentar el mismo ciclo como si nunca hubiera sido atendido.

Ese límite de 3650 describe cuánto debe cubrir la demostración de no repetición; no es la vida de una tarjeta ni un recordatorio permitido. Durante ese intervalo solo queda el último ciclo/cursor compacto imprescindible. Una campaña con datos tardíos del mismo ciclo no se convierte en un informe nuevo ni vuelve a guardar sus totales en ese control compactado.

**Elevar un límite estructural exige revisar la prueba de poda y sus tests.** No se trata como ajustar un peso. Solo se conserva el ciclo y su cursor de origen, hasta que ninguna política admitida pueda volver a seleccionarlo.

## Control del episodio: qué evita avisos repetidos

`cards/context.ts` comparte `planEpisode` entre la sincronización real y la simulación. Se le pasan explícitamente contexto anterior, contexto nuevo, instante, vigencia y origen; no consulta DB ni inventa un reloj. Decide elegibilidad, episodio nuevo, período viejo, cierre y caducidad. No es una regla nueva editable en texto arbitrario: cambiar el significado requiere código/versión de algoritmo.

| Dato de control | Para qué se conserva | Qué no hace |
|---|---|---|
| Asunto/ID y último contexto pertinente | Reconocer el mismo problema aunque se borre su texto. | No crea un archivo de todas las versiones. |
| Estado y `decidedAt` | Respetar Solucionado/Ignorar/Visto frente al contexto atendido. | No demuestra que el negocio se haya arreglado por marcar un botón. |
| `episodeStartedAt` / `expiresAt` | Mantener edad fija y aplicar la menor vigencia efectiva. | No se reinician por exponer, recalcular o posponer. |
| `remindAt` / recordatorio consumido | Esperar el instante y renovar novedad una sola vez. | No genera otra tarjeta ni garantiza uno de los cinco cupos. |
| Revisiones/última operación/digest | Evitar cerrar datos nuevos con una pantalla vieja y repetir una operación. | No es un log ilimitado de decisiones/respuestas. |
| Contexto factual/cursor 5/9 y evidencia stock | Conservar solo la prueba necesaria para recalcular/reabrir con fundamento. | No guarda el texto del aviso como fuente ni lee tablas de Stock desde core. |

Una ampliación de TTL se limita al vencimiento guardado de episodios existentes. Exactamente en expiresAt sigue vigente; justo después vence. Períodos anteriores del resumen/demanda no desplazan los nuevos. En la simulación los motivos por candidata son `eligible`, `expired`, `attended_context`, `snoozed` o `below_weight`; por regla se informa `disabled`, `evaluated` o `condition_not_met`. La lista `order` solo contiene las seleccionadas tras mínimo, prioridad y cupo.

## Hechos 5/9: el origen no se mueve cuando cambia el balance

Una suba de insumo o un conteo son hechos de un instante/local. Se conserva su origen y la evidencia de emisión de forma estructurada. No se cambia su fecha al reimprimir el texto y no se reemplazan las ventas de aquella ventana por las ventas actuales. El decaimiento por antigüedad sigue partiendo del origen, aunque cambie una etiqueta, peso o recordatorio.

El motor y el simulador comparten la restauración y el rebase factual. El día local capturado de origen no cambia si después cambia la zona horaria del comercio; las métricas guardadas mantienen su corte.

- Para 5 se captura `salesDays` y `impactDays`, junto con cantidad vendida racional (numerador/denominador). Cambiar solo el horizonte `impactDays` manteniendo la ventana permite reescalar exactamente esa cantidad; no hay que inventar ventas de hoy.
- Para 9 se capturan `salesDays` y `weeklyDays`, más venta/tickets/venta semanal del origen. Cambiar una ventana exige volver a disponer de sus resúmenes de origen, no solo del total anterior.
- Si la nueva ventana no puede justificarse con la captura existente, se necesita un snapshot suficiente del día de origen. Se aporta por evento en `input.factSnapshots`, con `today=originDay` y cobertura `input.readWindows.recentDays` al menos igual a los días requeridos.
- La evaluación puede preparar esos snapshots desde resúmenes de Analíticas; el GET del inbox no hace una relectura pesada de historia para simular.

La simulación devuelve `unavailableFacts` con entradas `{cardKey,subjectKey,eventId,originDay,requiredDays}` y para esa regla el motivo `requires_origin_snapshot` cuando falte evidencia suficiente. La candidata no aparece fingiendo monto cero ni como condición falsa demostrada. Son datos insuficientes para comparar ese hecho con esa política; aporta el snapshot correcto y vuelve a simular.

## Recetas para probar un balance

Trabaja en una rama/copia local y modifica una variable por vez. Revisa el diff para confirmar que no cambiaste ventas, permisos, el esquema ni otras reglas. Para comparar balances utiliza el mismo snapshot de datos y el mismo instante; nunca compares dos días distintos atribuyendo el resultado solo al peso.

### Cambiar un peso

Ejemplo: en la regla 8, `fixedPlata: 1` → `fixedPlata: 1.2`. Aumenta su componente base; no cambia cuánto stock queda ni su elegibilidad. No modifica el cupo ni salta cierres/snooze/caducidad. Para un balance global cambia `weights.noveltyDecay` o `weights.minimum`, entendiendo que afectas a todas las reglas.

### Cambiar un umbral

Ejemplo: en 8, `riskDays: 4` → `riskDays: 3`. Solo avisa cuando el extremo corto cae dentro de tres días. Conserva `criticalDays ≤ riskDays`. No reemplaces el número por otro en el evaluador o en SQL.

### Cambiar una ventana

Ejemplo: en 8, `consumptionDays: 28` → `consumptionDays: 42`. La consulta debe ampliar sus datos y el generador usar 42 muestras. `historyDays` sigue siendo un requisito distinto; decide explícitamente si también quieres cambiarlo. En 5/6/7, `impactDays` define el horizonte de impacto: 28 días de datos y 7 de impacto equivalen al divisor histórico 4. Si cambias a 14 días de impacto, el texto deja de llamarlo semanal. Cambiar la ventana de un hecho antiguo 5/9 exige datos suficientes del origen; no se recalcula con ventas de hoy.

### Cambiar una frecuencia

Ejemplo: en 2, `learningCooldownDays: 7` → `learningCooldownDays: 14`. Reduce la frecuencia del mensaje de aprendizaje, no convierte una informativa en recordatorio. Para la evaluación programada, `operation.desiredEvaluationMinutes` es la frecuencia deseada; cambiar el archivo no reconfigura el scheduler externo.

### Elegir otra acción o retirar un botón

Ejemplo de referencia ya soportada: `actionKey: "record_purchase"` → `"edit_product_price"` en una prueba de balance; el validador permite claves registradas. El destino se resuelve con permisos, no con el contenido de un href libre. Para una regla sin navegación usa `null` si el catálogo lo admite. No cambies una etiqueta para hacer parecer que existe «Enviar cupón»: esa capacidad no está implementada. Navegar nunca marca el aviso como atendido.

Los textos de las acciones core se configuran con `texts.action_view_day`, `action_view_calculation`, `action_view_customer`, `action_view_campaign_results`, `action_edit_product_price` y `action_view_modules`. Sus valores iniciales conservan las etiquetas existentes. Para una acción declarada externamente, un `texts.action_<actionKey>` opcional puede reemplazar su etiqueta; si no existe, se conserva la etiqueta de su declaración. No copies nombres de módulos ni sus catálogos al core. Un override cambia el texto, nunca las rutas seguras, los permisos o el hecho de que navegar no cierra.

Para retirar una decisión, quítala del subconjunto de la categoría correspondiente. Por ejemplo, quitar snooze de accionables la elimina de UI y el servidor debe rechazarla; no basta con ocultar el botón. No se admite añadir snooze a informativas ni acciones a Marketing parqueado.

### Reducir o ampliar caducidad

Ejemplo: `lifetime.days: 90` → `60` puede vencer antes episodios abiertos; el lector y cleanup usan la misma fecha efectiva. Volver a 90 no revive los que ya vencieron. Si pruebas una ampliación, solo afecta episodios nuevos; nunca rejuvenece lo abierto ni recupera el contenido borrado. `remindAt` siempre debe quedar dentro del vencimiento efectivo.

### Retirar una regla

Cambia su `enabled` a false. No borres tablas, métricas ni controles de deduplicación. Después de validar/reevaluar, no debe aparecer desde candidatas viejas ni fallback. Volver a true no crea un episodio sin datos nuevos pertinentes. No uses esto para activar la 11: está parqueada de forma deliberada y validada.

### Añadir una regla de un algoritmo registrado

El motor recorre todas las reglas habilitadas por su ID; `rulesFor` devuelve todas las que comparten un algoritmo. No toma solo la primera. La prueba congelada `composes two IDs of the same handler...` comprueba una primera regla de stock deshabilitada y otra activa con nuevo ID, y dos reglas de meta con multiplicadores distintos sin alterar las finanzas comunes.

Receta de experimento, dentro de un test/snapshot local:

```ts
const candidate = structuredClone(ANALYTICS_POLICY);
const stock = candidate.rules.find((rule) => rule.id === "8")!;
stock.enabled = false;
candidate.rules = [
  ...candidate.rules,
  { ...stock, id: "stock_experiment", enabled: true,
    parameters: { ...stock.parameters, riskDays: 3 } },
];
const experimentalPolicy = createAnalyticsPolicy(candidate);
const comparison = simulateAnalytics(input, controls, fixedInstant, experimentalPolicy);
```

El código es un ejemplo de uso de las funciones reales, no un comando de CLI. En el catálogo editas el objeto equivalente y validas. Mantén un ID estable una vez que una regla tiene avisos; no renombres una regla atendida para burlar sus controles. Para un ajuste normal conviene editar la regla existente; la receta nueva sirve para registrar un comportamiento distinto ya soportado. Revisa que no dejes dos reglas equivalentes activas por accidente.

Una regla nueva puede reutilizar un handler, categoría, parámetros, plantillas y acción ya soportados. Si necesitas datos, cálculo o acción nuevos, hay que implementar/probar esa capacidad y registrarla. No se permite código, SQL o JavaScript arbitrario escrito en configuración. Selección, HTTP y UI no reciben ramas por cada ID nuevo.

## Validar, comparar y revertir

No existe una CLI adicional de simulación. Las funciones puras están en `policy/simulation.ts`; el caso reproducible y su snapshot viven en `evaluation/policy-simulation.test.ts` (`simulationFixture`). No requieren credenciales, DB, reloj oculto ni escrituras.

Primero valida e inspecciona el catálogo modificado con este comando, que **no exige los valores iniciales**:

```sh
source ~/.nvm/nvm.sh && nvm use
pnpm --filter @mi-pasaporte/merchant exec vitest run \
  src/server/analytics/evaluation/policy-simulation.test.ts \
  -t "inspects the configured catalog without assuming the initial balance"
```

Busca `ANALYTICS_CATALOG_INSPECTION`: muestra versión, elegibilidad, componentes, orden y caducidad reales de tu configuración sobre la fixture pura. La importación rechaza un catálogo inválido. Para simular datos propios, llama `simulateAnalytics(input, estados, instante, createAnalyticsPolicy(config))` con un snapshot completo explícito.

Después de revertir el experimento al catálogo inicial, ejecuta la regresión completa. Esas pruebas sí fijan valores iniciales aprobados (por ejemplo TTL90 o plata1): un cambio de balance deliberado puede hacerlas fallar, y no corresponde relajar sus aserciones para inspeccionar un experimento. Desde la raíz, con Node24:

```sh
source ~/.nvm/nvm.sh && nvm use
pnpm --filter @mi-pasaporte/merchant exec vitest run \
  src/server/analytics/evaluation/policy.test.ts \
  src/server/analytics/evaluation/policy-simulation.test.ts \
  src/server/analytics/evaluation/domain.test.ts \
  src/server/analytics/evaluation/stock-domain.test.ts \
  src/server/analytics/evaluation/customer-promo.test.ts
```

La ejecución y el SHA exactos se registran en `docs/factory/0237-inbox-lifecycle-data.md`; los comandos de esta guía no prueban por sí mismos el entorno Neon ni QA combinado. Los casos incluyen equivalencia financiera, configuración y composición, límites de tarjetas, origen factual, cambio de ventanas y simulación de exposición/reapertura.

Para inspeccionar solo el ejemplo que imprime la comparación:

```sh
source ~/.nvm/nvm.sh && nvm use
pnpm --filter @mi-pasaporte/merchant exec vitest run \
  src/server/analytics/evaluation/policy-simulation.test.ts \
  -t "shows actual default/custom order and weight components"
```

Busca `ANALYTICS_POLICY_SIMULATION` en stdout. El ejemplo usa exactamente el mismo input y fecha con dos políticas: la inicial y otra con `weights.maximumCards=1`. En ese ejemplo, la inicial ordena resumen/meta/stock/demanda; la experimental conserva solo el resumen. El stock inicial muestra plata 1, urgencia 0,6, novedad 1 y multiplicador 1. El programa no modifica el input ni persiste avisos. Es una comparación de un snapshot ficticio declarado, no resultado de un comercio real.

Al modificar otros parámetros, conserva el mismo input/controles/instante para atribuir el cambio al balance. El snapshot debe incluir las ventanas requeridas por ambas políticas; datos recortados no demuestran que un período fuera del recorte tuvo venta cero. Los casos de tests existentes muestran cómo crear la copia con `structuredClone`, validarla con `createAnalyticsPolicy` y pasarla explícitamente al simulador.

Para revertir una prueba sin descartar trabajo ajeno:

1. Guarda la revisión local exacta del catálogo antes de editar y revisa `git diff -- packages/domain/src/analytics/policy/config.ts` después.
2. Deshaz solo las líneas de tu experimento, o crea un commit de reversión del commit propio si ya lo guardaste. No hagas reset/checkout global sobre cambios de otro agente.
3. Ejecuta de nuevo la validación pura y recarga el proceso local para que use la versión recuperada.
4. Comprueba que no quedaron cambios fuera del catálogo/guía. No se ha publicado nada por hacer estos pasos.

La versión es una huella determinista de configuración, definiciones registradas, campos permitidos de plantillas y `ANALYTICS_EVALUATOR_VERSION`; ordenar las claves de un objeto no debe alterarla. Si cambia el significado del algoritmo aunque los valores sigan iguales, el implementador actualiza su versión. Una política inválida no sirve parcialmente. Un trabajo ready de otra versión se debe invalidar/reevaluar; no se presenta como preparado con el balance nuevo.

## Inventario de consumidores y orígenes

| Bloque                  | Antes en `65b5152e`                                                            | Consumidores finales que deben usar la política                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Peso y ranking          | `analytics/weights.ts`, más promedio28/fijo10/límites de urgencia en builders. | Pesos puros, generadores, lector/ranking; sin otra copia de defaults en SQL o UI.                                   |
| 1/2/3/4/6/7/13          | `analytics/cards/index.ts` (7/28/4/8/3/0.8/45/10/1.5/0.5/etc.).                | Generadores y cálculo de meta; lectura de métricas por `policyWindows`; contexto/caducidad de sincronización.       |
| 5/8/9                   | `analytics/cards/stock.ts` (28/0.25/0.75/4/5%/0.7/7/1%).                       | Generadores/facts, delivery, contexto factual sin texto, ventanas SQL y lector crítico.                             |
| 10/12                   | `analytics/cards/customer-promo.ts` (28/7/8/3/2 y urgencias0.8/0.6, fin+1).    | Generadores/anomalías/campañas, reconciliación y consultas de ventanas completas.                                   |
| 11                      | Antigua regla individual/mediana en `customer-promo.ts`.                       | Ningún aviso activo ni fallback; métricas/histórico de clientes conservados.                                        |
| Ventanas de lectura     | `server/analytics/queries/index.ts`, constantes28/45/56/63 y 3meses.           | Ventanas derivadas de reglas habilitadas, sin truncar una configuración mayor.                                      |
| Cron/evaluación         | `server/analytics/evaluation/index.ts`, 20s/20comercios/35d/03:00.             | Ejecución/selección y metadata de frecuencia programada.                                                            |
| HTTP y cliente          | Presupuesto3s y refresco3s separados.                                          | HTTP usa fallbackWaitMs y DTO refreshAfterMs; UI consume fechas/capacidades, sin catálogo propio ni crypto de Node. |
| Retención/recordatorios | Antes no existía este ciclo único.                                             | Sync/read/command/cleanup con snapshot/version único, caducidad fija y CAS.                                         |

El handoff de datos registra las fuentes congeladas, pruebas reales y límites de evidencia. La configuración no modifica precios, costos, comisiones, permisos, métricas guardadas ni el corte de conteo de Stock.
