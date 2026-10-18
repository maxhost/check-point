# 0242 — CP1c.8 validadores genéricos de cambio de medida

Estado: preparada, sin reserva/autor. Entradas: tipo puro resource-measurement y storage0104 aceptados. Coordinador fija baseSHA/WT al asignar nuevo implementador/contexto vacío. Bloque independiente de eventos derivados. No subdelegar. Leer protocolos, contrato0242 §2 y código pertinente.

## Resultado

Añadir a ModuleServer `resourceMeasurementValidators?: readonly {resourceType:string;validate:ResourceMeasurementValidator<DbTransaction>}[]`. El registro de servidor declara el aporte del proveedor de composición. Un ensamblador genérico merchant consulta solo los validadores del resourceType solicitado cuyos módulos estén activos para ese negocio, dentro de la transacción recibida. Usa el registro permitido; core/domain no importan carpetas/tablas ni literales del módulo concreto. Devuelve primer error o null; excepción inesperada se propaga y permite rollback del caller, sin convertirla en éxito.

API prevista del ensamblador: `validateResourceMeasurementChange(change)`, compatible con ResourceMeasurementValidator<DbTransaction>. Consulta businessModules por businessId usando change.tx y pasa el mismo contexto/tx al proveedor. Sin cookie/scope/auth/pool nuevos, sin transaction/getDb global ni writes. Orden determinista si varios proveedores y no llamar validadores de módulos apagados, resourceType ajeno o sin aporte. No inferir una receta cuando falta proveedor activo.

El aporte de Recetas solo maneja product. Lee la composición/resolución publicada de ese producto/negocio y su base inmutable; no receta/precio actual ni otra resolución por coincidencia de ID. Base unit solo compatible con newMeasure unit; cualquier base mass válida es compatible con mass kg/lb/g, incluida otra unidad tarifaria, sin reescribirla. Incompatibilidad devuelve measurement_basis_required con mensaje en tuteo. Un slot legacy recipe publicado sin base explícita representa1unit: también bloquea cambio a mass. Ausencia de composición/slot vigente devuelve null. Datos capturados inválidos o referencias inconsistentes no se interpretan como ausencia válida ni base inventada.

El helper no omite validación por oldMeasure==newMeasure si la composición actual resulta incompatible: queda preparado para validar contexto actual después de reactivar un proveedor. Esto no habilita un flujo nuevo ni cambia activación de módulos en esta entrega.

No llamar todavía el ensamblador desde writers de catálogo/importación ni publicar bases nuevas: esos writers y su inyección se adaptan junto con medidas/revisión/locks en CP2a. El caller futuro mantiene guard y locks business-config antes de recurso/publicación; este bloque no certifica esa carrera ni adquiere locks globales. No mass operativo, schema ni productor4.

## Paths previstos

- `apps/merchant/src/modules/route-table.ts`, solo metadata ModuleServer/tipo necesario.
- `apps/merchant/src/modules/server-registry.ts`, declarar aporte del proveedor.
- `apps/merchant/src/server/resource-measurement.ts`, ensamblador genérico nuevo.
- `apps/merchant/src/server/resource-measurement.test.ts`, nuevo, proveedores sintéticos sin nombres de módulos reales.
- `apps/merchant/src/modules/recipes/server/measurement-validator.ts`, nuevo.
- `apps/merchant/src/modules/recipes/server/measurement-validator.neon.integration.test.ts`, nuevo.
- `docs/factory/0242-cp1c-measurement-hook-handoff.md`.

El core puede importar server-registry pero no route-table ni un helper nuevo dentro de modules/: las guardias lo restringen. Mantener ensamblador en server/ e importar tipo puro de domain y tipos DB permitidos. No editar guardias para ampliar excepciones. Sin catálogo/domain/importación/publicación de bases/schema/journal/eventos/Stock/analytics/UI/auth/kit/tooling/deps/estados/índices.

## Gate

Puros prueban filtro por negocio/resourceType/módulo activo, ausencia de proveedor, primer error determinista, excepción propagada y misma transacción/contexto. CI real: composición publicada unit rechaza mass y conserva datos; bases mass aceptan kg/lb/g y cambio solo priceUnit; mass rechaza unit; producto sin composición acepta; slot legacy bloquea mass; referencias/tenant ajenos no se usan como composición propia. Validación sin writes, snapshots/IDs/base sin cambios. No afirmar cambio real de modo ni control de carrera de writers que todavía no llaman este hook.

Node24, focales, tipos domain/db/merchant, lint/formato/diff y tres guardias de módulos, separando dos fallos de backlog probado. CI solo cuando root asigne recurso exclusivo, por tools/neon-test.sh --no-file-parallelism y teardown propio incluido owner. Sin build/browser/M0/M1. QA nuevo sobre candidato congelado, evidencia SHA/config/runtime/resultados/fallos/skips/límites, commit limpio y0procesos. Factory/integración del coordinador; sin push/PROD.
