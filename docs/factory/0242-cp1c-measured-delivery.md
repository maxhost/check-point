# 0242 — CP1c.9 conexión compatible de consumidores medidos

Estado: preparada, sin reserva/autor. Entradas obligatorias: decoder, captura/provenance, POS metrics y evento derivado2 aceptados. Nuevo implementador/contexto vacío; coordinador fijará baseSHA/WT. No subdelegar. Leer protocolos, contrato0242 §4, ADR0148 §3 y archivos pertinentes.

## Conexión y seguridad

La suscripción Recipes de sale.closed adopta el helper medido mediante defineEventSubscription y decodeMeasuredSaleClosedEvent, preservando resourceType/slot/requiredModules y transacción de ledger/provenance/evento derivado/ACK. V1–3 usan el camino legacy aceptado; V4 usa base/revisiones/racionales capturados, Stock recibe únicamente ledger3 positivo, ambos ratios se persisten y el derivado2 cubre unidades/gramos por separado. No ampliar el union legacy CapturedModuleEvent ni forzar casts de V4 aV3.

Antes de efectos, `applyClaimedDelivery` conserva la comprobación genérica de envelope para sale.closed en TODAS sus ramas, incluido core.analytics y dispatch genérico: versión externa igual a payload.eventVersion y locationId externo igual al capturado. Comprobar objeto/campos antes de leerlos; luego cada decoder del consumidor valida contenido completo. La rama legacy sigue rechazando versiones no soportadas. No añadir nombres ni imports de módulo al framework ni debilitar claimToken/locks, estado/diagnóstico/reintentos o elegibilidad por módulos.

El productor operacional sigue publicando versión3 y barreras unit permanecen. Este bloque prepara consumidores que admiten4, no habilita captura/cierre mass ni crea una API alternativa de emisión. La emisión raw4 solo existe en fixturesCI propias usando append/eventos genéricos para ejercitar el camino real de deliveries.

## Lector de costo compatible

`readSaleConsumptionCost` lee eventos1–4 mediante decoder medido/envelope y capturedMeasuredConsumption, sin consultar receta/base/precio vigentes. Misma transacción read-only repeatable-read y filtros negocio/local/orden. Conservar estados pending/applied/skipped/modules_disabled y razones de receta/rounding; una proyección0 con racional positivo no equivale a costo completo0.

Evento inválido/envelope inconsistente no se interpreta como una venta vacía completa: conservar contexto autorizado disponible y estado unknown/pending o incompleto, sin filtrar datos ni fabricar consumos. No desactivar validación para permitir un fallback truncado. No adaptar el lector histórico de comisiones sin necesidad: el camino nuevo usa cabecera/snapshots congelados antes de su fallback de eventoslegacy; demostrarlo en el cierre realCP2c.

## Paths previstos

- `apps/merchant/src/server/module-events/retry.ts`, solo envelope compartido antes de efectos.
- `apps/merchant/src/modules/recipes/server/consumption.ts`, conexión de suscripción y helper medido.
- `apps/merchant/src/modules/recipes/server/consumption-cost.ts`, lector1–4 y fallback seguro.
- `apps/merchant/src/modules/recipes/server/consumption-measured-delivery.neon.integration.test.ts`, nuevo.
- `docs/factory/0242-cp1c-measured-delivery-handoff.md`.

Sin schema/journal, productor/publish/close POS, helpers/expansores/provenance/evento derivado ya aceptados, Stock, analytics ingestion/reader/dominio, UI/auth/kit/tooling/deps/estados/índices. Si otro archivo necesita adaptación, presentar path/razón y reproducción al coordinador antes de editar. No modificar guardias ni tests para ocultar un error.

## Gate real de consumidores

CI exclusiva, Node24, solo tools/neon-test.sh --no-file-parallelism y env privado seleccionado, incluido teardown de negocio/owners. Fixtures raw4 persistidas con refs reales del mismo negocio, composición/base/revisiones y costos de Stock; IDs orden/línea del contrato no representan filasPOS/core. No afirmar cierre HTTP/E2E ni masa operativa; ese gate sigueCP2c.

Probar deliveries reales de venta mixta4: ACK de Recipes y analytics, ledger3 exacto por línea/insumo, sourcesV2 con ambos ratios, derivado2 con delivery analytics real, métricas sold/with_cost unit/mass y dinero separado. Para comprobar completitud usar también fixture de comisión capturada0 si corresponde al settlement0 elegido; no inferirla desde catálogo ni omitir requisito monetario. Venta neto0/costo0 completo es válida; tiny positivo con ledger0 permanece incompleto por redondeo sin cobertura ficticia.

Replay por framework no duplica movimientos/sources/eventos/deliveries ni revalúa costos/observedAt después de cambiar costo actual. Rollback ante fallo conserva ACK pendiente y no deja efectos parciales. Negativos de envelope versión/local ejecutan ambas ramas (Recipes/core.analytics) sin deltas/ledger/provenance/derivado; comprobar diagnóstico/estado reales. Módulo apagado/skipped y lector de costo antes/después preservan semántica legacy; evento inválido no retorna completo por lista vacía. Tenant/local ajenos no producen ni exponen efectos. Reutilizar/reproducir regresión legacy proporcionalmente.

Tipos3, focales/guardias/estáticos pertinentes y evidencia SHA/config/runtime/SQL/resultados/fallos/skips/límites. Sin build/browser/M0/M1 ni testsglobales por ceremonia. QA nuevo sobre candidato congelado; commit limpio y0procesos. Factory/aceptación/integración del coordinador; sin push/PROD.
