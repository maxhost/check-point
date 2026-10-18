---
spec: 0241
fecha: 2026-10-18
estado: contrato funcional cerrado; implementación autorizada
nivel: L2
resumen: Conciliar gastos registrados y estimación mensual; definir ventas adicionales para equilibrio con contexto y calidad de datos explícitos.
disjunta: no; cambia potencialmente el cálculo compartido por Histórico, resumen e Inbox0237/0239.
---

# 0241 — Gastos y equilibrio mensual comprensibles

Owner autorizó avanzar con el plan: primero conciliar cifras y proponer reglas, antes de cambiar cálculos/UI. Este documento conserva la primera etapa y cierra abajo el contrato tras la respuesta del owner. La reserva documental no modifica DB, fórmulas, HTTP, kit o UI. Push/PROD no autorizados. Demos/diferidos anteriores se conservan.

## Evidencia de origen

Revisión sobre código `4e588895b05e087654c3b912af37f8fbcd4f1015`, Node24.20.0. Lectura local protegida por `localDbUrlOrExit`, identidad del negocio y owner; consultas fuente en transacción REPEATABLE READ READ ONLY. Lectura puntual de readInput/readHistory real, Todos/Principal, mes/3meses. No test DB ni escritura ni migración. Snapshot2026-10-18T16:04:08.968Z, negocio Joyas de Cutilan, monedaUSD, zona America/Mexico_City, corte local18octubre.

Scripts/snapshot y comprobaciones en `/private/tmp/checkpass-finance-review/`: build.cjs, audit.mjs, audit.json, checks.cjs y checks.json. Las lecturas del endpoint de dominio usan conexiones separadas de la transacción fuente: no afirmar un único snapshot atómico de todas las conexiones ni una prueba Next autenticada. No afirmar cobertura general de producción con esta muestra.

## Conciliación de cifras

Gastos registrados del 1 al18octubre, local Principal (Todos da lo mismo):

| Origen USD, fecha de pago17oct | Clasificación | Importe |
|---|---|---:|
| Alquiler | Fijo | $450,00 |
| Agua de septiembre | Variable | $11,00 |
| Internet de octubre | Variable | $21,00 |
| Luz de septiembre | Variable | $31,00 |
| Tubo de gas | Variable | $3,75 |
| Total | $450,00 fijos + $66,75 variables | **$516,75** |

Estos cinco gastos fuente concilian con metric_contribution y daily_metric, sin diferencias de importe/claves para las métricas de gastos de la muestra. Se agrupan por paidOn, no por createdAt ni por el mes mencionado en el nombre. Existen dos gastos fuente legacyMXN sin proyección en la muestra; no se convierten ni se suman en esta conciliación USD. Su ausencia no demuestra un filtro de moneda general correcto.

La proyección actual **$570,00** se reconstruye como alquiler450 + `[DEMO] Servicios`120 estimado desde15septiembre + variables históricos0. El demo es una proyección sintética local deliberada, no un gasto fuente real pagado este mes. Los66,75 actuales no entran en esa parte del cálculo. Aritméticamente:516,75 −66,75 +120 =570. No es un error de suma; la regla usa otro conjunto y otro propósito.

El equilibrio actual **$680,23** se reproduce exactamente, con redondeo hacia arriba al centavo: `570 / (45,25 /54)`. El margen de referencia es83,796296…%, sobre ventas conocidas54 menos costo vendido8,75 y comisiones0, en los28días anteriores a hoy. No usar84% redondeado para recalcular dinero.

La base cambió desde las primeras capturas: hoy el mes suma **$569,00** en ventas (54 del17oct +515 del18oct). Solo5de12unidades tienen costo conocido (41,7%); por importe, solo54de569 (9,49%) tienen costo. Histórico devuelve resultado null. Sin embargo, goal conserva margen histórico válido del período anterior a hoy y devuelve E680,23, atRiskfalse y targetnull. Eso no demuestra que el mes esté cubierto ni que haya margen actual de83,8%: es una extrapolación histórica y la UI no explicita esa diferencia.

Cambiar filtro a3meses lleva gastos registrados a636,75 (incluye demo120 de septiembre), pero goal sigue siendo del mes actual con570 y E680,23. El mes debe identificarse dentro de la tarjeta mensual; el filtro histórico no debe aparentar cambiar su ventana.

## Hallazgos separados por capa

1. **Origen local conciliado:** no se encontró duplicación de los516,75; Gastos usa pagos. No confundir este resultado con validación de todos los comercios.
2. **Regla histórica deliberada pero insuficiente:** spec0237§3.4 manda promedio variable de3meses cerrados. El código divide siempre entre3, aunque no haya prueba de información de los tres. Reproducción pura: agregar un mes observado con90 de variables incrementa el estimado30, no90. Falta distinguir ausencia de información y cero real.
3. **Conceptos parciales:** cualquier importe positivo de un fijo del mes sustituye toda su referencia histórica; no existe saldo esperado ni señal de pago completo. No inferir que un primer pago liquida el mes.
4. **Mes cerrado no equivale a completitud:** hasClosedExpenseMonth solo acredita algún gasto positivo anterior al inicio del mes. Una fila demo es suficiente para habilitarlo; no hay cierre contable ni confirmación de que se cargaron todos los gastos.
5. **Calidad de costos con ventanas distintas:** el margen usa28días hasta ayer; las ventas del mes incluyen hoy. Coverage actual por unidades no equivale a cobertura por dinero. Un objetivo predictivo no debe presentarse como resultado observado ni como equilibrio ya logrado.
6. **Fallo técnico de monedas:** readHistory agrupa pero no excluye monedas/unidades menores ajenas. summarizeHistory/cards suman por métrica sin moneda; apply valida moneda soportada, no coincidencia con negocio. Reproducción en memoria del worker con inputUSD2: variableUSD100minor +MXN900minor →1000minor; fijoUSD100 +MXN1350 →1450. Confirmado defecto latente; no se observó mezcla monetaria en la proyección local analizada. No convertir implícitamente ni corregir registros legacy de oficio.
7. **Compras y costo vendido son distintos:** Stock emite stock_purchase y gauges, no expense_*. Costo vendido proviene del snapshot de consumo al cerrar la venta. No hay doble descuento automático de compras. Si alguien registra manualmente una compra/comisión también como gasto, no existe vínculo para deduplicarla. La clasificación no puede deducirse del texto libre.
8. **Alcance del resultado:** se combinan gastos por fecha de pago con costos/comisiones reconocidos al vender. No presentarlo como caja disponible ni resultado contable auditado. Edición/borrado de gastos reemplaza contribución histórica; delivery es durable/asíncrona. POS revisado anula abiertas; no se encontró flujo explícito de reembolso de venta cerrada. No crear reversos imaginarios.

Referencias: `packages/domain/src/analytics/history.ts` (sumas/períodos), `cards/index.ts` (contribution/calculateGoal), `apps/merchant/src/server/analytics/queries/index.ts` (lecturas), `ingestion/apply.ts` (monedas/revisiones), módulos expenses/server/metrics.ts (paidOn/isFixed), stock/server/metrics.ts (compras) y recipes/server/metrics.ts (costo vendido).

## Propuesta para cerrar el contrato L2

### Tres conceptos, tres preguntas

| Concepto | Pregunta del merchant | Presentación propuesta |
|---|---|---|
| Gastos registrados | ¿Cuánto cargué como gasto pagado en este período? | Importe observado y rango del filtro; desglose fijos/variables. |
| Gastos previstos del mes | ¿Qué gastos del mes conocemos y cuáles faltaría cubrir según la estimación? | Registrados del mes + pendientes estimados, mismo local/moneda; mes explícito y calidad. |
| Ventas adicionales estimadas | ¿Cuánto me falta vender para cubrir esos gastos después de los costos de vender? | Cifra restante, explicando costo de productos y comisiones; no llamar ganancia a ventas. |

La tarjeta mensual respondería primero «Te falta vender para cubrir el mes», con apoyo «Estimación después de descontar el costo de los productos y las comisiones». Sin porcentaje técnico obligatorio a la vista. Las ventas del mes, gastos previstos y cobertura quedarían de apoyo; detalle por concepto detrás de una consulta explícita. Se conserva el lenguaje/tokens/kit existente y el masonry. No otro párrafo permanente para compensar una fórmula ambigua.

### Reglas recomendadas y decisiones que deben cerrarse antes de código

- **Moneda:** filtrar moneda y minorUnit del negocio en toda ruta de sumas/cobertura, sin conversión. Preservar métricas de cantidad sin moneda. Resolver si la ingestión rechaza nuevas filas incompatibles o las conserva segregadas; jamás perder el tratamiento de reversión de fuentes antiguas al corregirlas.
- **Registrado + pendiente:** construir un desglose auditable por concepto que enlace importe observado, referencia histórica, pendiente estimado y estado desconocido. El total previsto no puede omitir gastos actuales de una categoría ni sumar otra vez un concepto ya incorporado. Lo estimado no es deuda confirmada.
- **Variables:** referencia mensual a partir de historia identificada; no dividir por3 por defecto sin conocer qué representan los meses faltantes. Como piso, conservar siempre los variables ya registrados. Si no se puede estimar el resto del mes, marcar previsión parcial, no convertir el resto en0. Definir la evidencia mínima de historia utilizable sin inventar un cierre contable que el sistema no tiene.
- **Pagos parciales de fijos:** recomendar usar la referencia como estimación pendiente cuando lo registrado es inferior, claramente como suposición, hasta disponer de un importe mensual esperado. Decidir cómo tratar cambios reales de alquiler/importes y conceptos fijos que no se repiten cada mes. No afirmar pago completo a partir de un importe positivo.
- **Equilibrio:** priorizar ventas adicionales, no un objetivo total sin contexto. Propuesta matemática para cerrar: brecha = gastos previstos − aporte de las ventas del mes después de costos/comisiones; ventas adicionales = max(brecha,0) / margen esperado de las próximas ventas. Esto exige decidir cuándo el aporte actual es suficientemente conocido y cuándo se admite una estimación explícita. No restar simplemente ventas brutas a gastos ni volver a descontar COGS dos veces.
- **Calidad:** distinguir resultado observado y escenario estimado. Recomendación conservadora: si el mes tiene costos tan incompletos como la muestra (9,49% por importe), no mostrar una cifra fiable de ventas restantes. Proponer umbral por importe además del de unidades existente; cerrar el tratamiento de la fracción sin costo antes de implementar. Mantener precisión/racionales y redondeo monetario único al final.
- **Días restantes/meta diaria:** mantenerlos secundarios y solo cuando hay patrón suficiente. Dos días calculados a partir de poquísimas ventas no acreditan un calendario real de apertura. No declarar equilibrio alcanzado cuando faltan costos.

En la muestra, registrados516,75 +servicios estimados120 darían **636,75 como subtotal conocido más esa estimación**, no un gasto mensual completo probado. Si se aplica la fórmula antigua y el mismo margen, eso daría759,88 de objetivo total. Ambos son escenarios aritméticos condicionados, no nuevas metas para publicar: faltan costes de515 en ventas y una previsión defendible del resto de variables. No sustituir570/680,23 por esas cifras sin cerrar el modelo.

## Secuencia de implementación posterior

1. Cerrar reglas pendientes anteriores y contrato HTTP aditivo con desglose, período, calidad, cobertura por importe y razones de indisponibilidad; contrato compartido antes de dos implementadores. No cambiar la semántica silenciosamente de los campos goal existentes.
2. Implementador de dominio/servidor corrige agregación de moneda y modelo, con checks focales y negativos tenant/local/moneda en NeonCI protegido cuando se cambie query. UI en su WT consume contrato cerrado y estados, sin inferir fórmulas en cliente. No migraciones/kit/tooling por defecto.
3. Revisar TODOS los consumidores compartidos: Histórico, resumen Dashboard, tarjetas3/4 del Inbox, fingerprints y estado/contexto. No basta cambiar la tarjeta visible. Si cambia política/contexto, definir versión e invalidación/recomputación sin alterar decisiones del owner de oficio.
4. QA independiente de entregas y combinación, integración local tras gates proporcionales; main local solo tras aceptación. Sin push/PROD.

## Casos de aceptación a concretar con el contrato

- Conciliación local516,75 y explicación de570/680,23 reproducibles; demo separado de datos fuente.
- Gastos actuales mayores que la referencia, pago parcial, nuevo concepto, tres meses con información vs meses ausentes, cero confirmado distinto de desconocido.
- Costos completos/incompletos por unidades y por importe, venta de hoy sin costo, cambio de mezcla/precio/comisión, margen0/negativo, equilibrio alcanzado y exceso de gasto.
- Correcciones/borrados/fechas/locales, monedas y minorUnit ajenos, datos legacy, días futuros; no fabricar un reembolso que no existe en producto.
- Compras de stock no sumadas como gasto por automatismo; posible registro manual duplicado identificado como límite, no deduplicación por nombre.
- Referencia de cálculo monetario exacta a mano, cobertura/rounding, móvil/desktop con cifras positivas/negativas y estados parciales claros.

## Límites conservados

No modifica ni certifica PROD, CI remoto rojo90ebe18f, QAmanual0237, guardias24PASS2FAIL, FAILfrío1817.621042ms ni M1previo66067758. Diferidos ciudades/weather/calendarios/crons/Marketingcupón11/realtimeinfra y demos previos intactos. Servidor3201/túnel intactos. Esta etapa no implementa ni certifica el nuevo cálculo.


## Revisión independiente de esta etapa

QA existente revisó documento/INDEX y evidencia readonly: conformidad documental acotada, sin errores concretos de conciliación. No ejecutó DB, tests, env ni modificó producto/refs. La revisión valida la separación de hechos/escenarios/propuestas, no aprueba un nuevo algoritmo. Pregunta de producto enviada al owner para cerrar calidad: ante costos de ventas o gastos pendientes desconocidos, mostrar «Aún no podemos estimarlo» (recomendado) o permitir escenario parcial claramente incompleto. No implementar esa decisión antes de resolverla.

## Contrato funcional cerrado tras respuesta del owner

Owner eligió «Aún no podemos estimarlo» con motivo breve cuando faltan costos o referencias de gastos; no escenarios parciales como metas. Se autoriza implementar este alcance L2. Las preguntas anteriores quedan resueltas para esta versión mediante las reglas conservadoras siguientes, sin nuevas tablas ni captura de presupuestos/cierres.

- GET history añade `goal.finance: MonthlyFinance` (contrato puro `packages/domain/src/analytics/monthly-finance-contract.ts`). Versión2 explícita; datos por mes calendario actual en zona del negocio/local seleccionado, independiente del filtro histórico. Registrados/pending/forecast, aporte neto del mes, ventas adicionales/objetivo total, estado/reasons, coberturas de unidades e importe y desglose de referencias por concepto. Desconocido=null, nunca0.
- Fijos: conceptos con importe positivo actual o en los3meses calendario anteriores. Referencia = media de los meses con importe positivo observado de ese concepto dentro de esa ventana. No inventar meses0 ni usar referencias más antiguas. Sin referencia de un fijo actual: pendiente/forecast de ese concepto desconocido. Con referencia: previsto=max(registrado,referencia), pendiente=max(referencia−registrado,0). Es suposición histórica explícita, no deuda ni confirmación de pago completo.
- Variables: una referencia agregada del total variable por mes, usando sólo meses con importe positivo observado de los3anteriores. Sin meses observados: referencia/pendiente/forecast desconocidos. Si existe: previsto=max(variables actuales,referencia), pendiente=diferencia. Nunca omitir gastos actuales ni sumar promedio completo encima de lo ya registrado. Meses sin filas no son ceros confirmados; cantidad de meses observados visible en detalle. No prometer completitud contable de esos meses.
- Referencias por concepto/agregado se redondean una vez a centavos con moneyRatio; totales son suma exacta de esas referencias/resultados monetarios. Ventas adicionales se redondean hacia arriba una sola vez al final del cociente. Sin floats para decidir dinero; los ratios de cobertura sólo informan.
- Previsión del mes disponible sólo si todas esas referencias existen, incluido el agregado variable. De lo contrario puede mostrarse lo pagado y el desglose incompleto, pero previsión y ventas adicionales permanecen null. No pedir un mes contable cerrado inexistente ni convertir el flag hasClosedExpenseMonth en garantía de completitud.
- Costos de ventas: para publicar meta, todas las ventas del mes y de la referencia deben tener costo y comisión conocidos, con unidades, importes y contadores coherentes. Sin ventas en el mes, aporte actual0 es válido; referencia siempre exige ventas positivas conocidas. No extrapolar una parte sin costo; sustituye el umbral80% para esta meta. Si falta algo: reason sales_costs. Referencia de28días hasta ayer; inexistente reason reference_sales; margen<=0 reason positive_margin. Pueden coexistir motivos con expense_history; UI muestra una explicación breve coherente.
- Con previsión P y aporte actual C (ventas netas menos costo vendido y comisiones): ventas adicionales=max(P−C,0)/margen de referencia. Objetivo total de ventas=ventas netas actuales+adicionales. Si C>=P: covered y adicionales0, siempre identificado como cobertura de gastos previstos. No sumar compras stock ni tomar ventas brutas como aporte.
- Compatibilidad explícita: goal conserva campos legados, ahora bajo `finance.version=2`. breakEvenMinor será alias del objetivo total dinámico (o null si unavailable); expensesMinor será previsión cuando exista y subtotal registrado cuando no, no usarlo como previsión sin consultar finance. targetMinor conserva condición de ritmo/riesgo y usa restantes/días cuando sea calculable. Datos nuevos UI usan finance y nunca derivan fórmulas en cliente. Se actualizan las expectativas de tests de versión anterior por cambio aprobado, sin ocultar fallos.
- Moneda: sumas financieras de Histórico/calculateGoal/resumen/Inbox sólo moneda+minorUnit del negocio; métricas de cantidades sin moneda se conservan. Sin conversión ni borrado de filas ajenas. Ingestión puede conservar monedas soportadas segregadas; esta entrega corrige lectura/cálculo, no migración ni limpieza de datos. DB CI prueba negativos de moneda/unidad/tenant/local; no SQL/GET adicionales por UI.
- Dashboard conserva contrato summary.version1 y campos monetarios; reflejan objetivo total v2 y promedio diario calendario existente (no meta de hoy), y añade motivo expense_history a unavailableReason/validador/copy. todayRevenue también filtra moneda. Histórico, resumen e Inbox dejan de emitir metas numéricas si unavailable. Tarjeta3 sólo con meta válida; tarjeta4 mantiene condición/invitación existente sin afirmar que ya se puede calcular. Cambiar revision de política para reevaluación normal, sin resetear decisiones/manualDB; contextos de meta incluyen versión de cálculo. Sin procesar/resembrar demos locales de oficio.
- UI mensual: título «Para cubrir los gastos del mes», mes y corte explícitos; cifra principal «Te falta vender» y ventas netas del mes como apoyo. Se aclara brevemente que se descuentan costo de productos y comisiones; desglose de registrado/referencia/pendiente estimado con kit existente, opcional. Unavailable: texto elegido por owner y motivo; no680,23 ni759,88 como placeholders. Movimientos recientes permanecen.

Checks: unidad pura con referencias/pagos parciales/meses ausentes, moneda/unidad, comisiones/precisión/costos incompletos, margen0, cubierto y sin ventas; regresión de consumidores/política afectados; query CI tenant/local/moneda aislada, browser focal390/1440 estados y detalle. Dos implementadores en WT propios y QA independiente. No módulos ajenos, kit/guardias/tooling/migraciones/dependencias/PROD/push en esta implementación.
