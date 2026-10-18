# 0242 — CP1c.7 evento de consumo medido y métricas de costo

Estado: preparada, sin reserva/autor. Entradas: captura/procedencia y replay de Recetas aceptados, vocabulario/base financiera y lector exactos aceptados. Coordinador fijará baseSHA/WT y asignará autor nuevo/contexto vacío. No subdelegar. Leer protocolos, contrato0242 §4, ADR0148 §3 y archivos pertinentes; sin históricos completos.

## Contrato de evento aditivo

Conservar `ConsumptionApplied` actual como contrato de `recipes.consumption.applied` versión1 y su exportación existente. Añadir versión2 para ventasV4: mismo contexto financiero, items ledger3 e identidad de orden/líneas, pero cada línea incluye quantity string y LineMeasure explícita capturada. Versiones1–3 de venta siguen produciendo exactamente el evento derivado1; venta4 produce derivado2 exclusivamente cuando se invoque el publisher con un evento medido validado. No conectar todavía la suscripción a4 ni cambiar productor de venta.

El publisher puede aceptar un contexto estructural local con payload `MeasuredSaleClosedEvent`; no ampliar `CapturedModuleEvent` ni unions del framework para hacer compilar otros consumidores. Preservar cost states, ledger y lectura de costo actual. Versionar el envelope externo y payload de forma consistente. Comisión por línea deV4 conserva su snapshot igual queV3; no recalcular dinero desde tarifas ni catálogo.

Conservar el fix de replay aceptado: mismo evento completo/ID/observedAt/deliveries, sin reobservar costos/inventario. La comparación de identidad ahora incluye versión derivada esperada y medida de cada líneaV2; línea1 no inventa medidas en el wire histórico. Cualquier diferencia de medida, quantity o identidad/dinero capturado produce conflicto, no overwrite ni append duplicado. Una derivación histórica1 no se reemplaza por2 para la misma orden.

ParaV4, cotejar además el contexto/payload completo del caller con el parent module_event persistido (id, negocio, tipo/versión, orden/local y JSONB completo). Esto detecta originales financieros racionales diferentes que normalizan al mismo importe, sin añadir un hash/campo de identidad al wire derivado ni reconstruirlo desde minor units. Igualdad JSONB parametrizada, no Number ni comparación dependiente del orden de keys. La rama histórica1–3 conserva su semántica aceptada. Negativo de originales subminor distintos pero normalizados iguales debe rechazar y mantener evento/deliveries originales sin efectos parciales.

## Traducción de métricas

El traductor `recipes.consumption.applied` distingue1/2. Legacy mantiene su comportamiento, sourceKey/sourceRevision y tolerancia de campos aditivos antiguos; no convertir esta entrega en una validación retrospectiva de todos sus fixtures/históricos. Algunos tests legacy omiten campos no usados por su caso: no ampliarlos ni rechazarlos por una nueva validación global ajena al cambio. La rama nuevaV2 requiere versión externa/payload coherentes y medidas explícitas válidas en cada línea, sin fallback a unit. Se puede extraer tipo/decoder puro en `consumption-applied.ts`, manteniendo exportaciones compatibles.

Solo líneas con costo completo no null emiten cost_of_goods y cobertura. ParaV2, unit→units_with_cost con cantidad discreta confiable; mass→mass_with_cost_g mediante gramos exactos derivados de la captura. Usar helpers existentes, sin Number/toFixed ni parser9dec sobre gramos14dec. Cambiar priceUnit no cambia cobertura física. No sumar piezas y gramos ni usar cantidad de insumo como cantidad vendida. Costos completos0 son válidos; costo null/incompleto/redondeo_sin_consumo no produce cobertura ficticia aunque alguna proyección sea0.

Revenue_with_cost y payment_commission_with_cost conservan moneda/minorUnit/conteos/originales capturados. Stock_consumption y gauges mantienen cantidades de insumo ledger3, su unidad propia, instante de venta para suma e instante observado para saldo, sin reinterpretarlos como masa vendida. Product_cost_changed permanece intacto. Este bloque no adapta costos de catálogo por unidad tarifaria ni publicación de base de composición.

## Paths previstos

- `apps/merchant/src/modules/recipes/server/consumption-event.ts`.
- `apps/merchant/src/modules/recipes/server/consumption-applied.ts`, tipos/decoder nuevo si hace falta.
- `apps/merchant/src/modules/recipes/server/metrics.ts`, solo traductor de consumo.
- `apps/merchant/src/modules/recipes/server/metrics-measured.test.ts`, nuevo.
- `apps/merchant/src/modules/recipes/server/consumption-measured.neon.integration.test.ts`, nuevo.
- `docs/factory/0242-cp1c-recipes-events-handoff.md`.

Sin captura/provenance/expansores ya aceptados, schema/journal, framework/retry/append, subscription/producerV4, Stock/analytics ingestion/reader/dominio, UI/auth/kit/tooling/deps/estados/índices. Cualquier ajuste de fixture fuera de estos paths vuelve al coordinador antes de editar.

## Gate

Equivalencia del publisher/traductor legacy y replay congelado. V4 mixto produce derivado2 con medidas/cantidades/finanzas capturadas correctas y cobertura unit/mass separada; gramos derivados14dec y priceUnit distinto no cambian dimensión. Costo0 completo sí cubre, costo incompleto/tiny sin ledger no cubre. Versiones/medidas inválidas y replay con identidad física alterada fallan sin nuevos eventos/deliveries ni cambios de snapshots. Ítems/gauges de Stock siguen iguales.

Node24, tests puros nuevos y traductores legacy pertinentes, tipos db/domain/merchant, lint/formato/diff y tres guardias con backlog separado. CI exclusiva por `tools/neon-test.sh --no-file-parallelism`, incluidas fixtures/teardown/owners; eventoV4 raw y refs reales del mismo negocio, limitación sin órdenesPOS igual que entrega capturada. Probar el publisher y persistencia del derivado, no afirmar cierre real ni chainV4 activada. No build/browser/M0/M1. QA nuevo en candidato congelado con evidencia SHA/config/runtime/resultados/fallos/skips/límites, commit limpio y0procesos. Factory e integración del coordinador; sin push/PROD.
