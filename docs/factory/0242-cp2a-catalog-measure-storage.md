# 0242 — CP2a.1 metadatos de catálogo y configuración, expansión aditiva

Estado: preparada, sin autor/reserva. Nuevo implementador con contexto vacío después de liberar un WT aceptado; coordinador fijará baseSHA. Leer AGENTS/protocolos, contrato0242 §2 y esquema/tests pertinentes. No subdelegar. Writer de esquema/journal explícitamente asignado por esta ficha y factory antes de código.

## Resultado acotado

Añadir a core.product soldByWeight boolean no null defaultfalse, pricingUnit text no null defaultunit y salesRevision integer no null default1. Combinación permanente válida: unit cuando soldByWeight=false, kg/lb/g cuando true. Revisión positiva. Productos históricos conservan IDs, precios/costos exactos, imágenes, disponibilidad, FKs y timestamps; no recalcular revisión desde updatedAt ni reescribir órdenes/eventos/snapshots. Las tarifas y barreras temporales de centavos/rango anteriores permanecen intactas.

Agregar a core.business_configuration salesMassUnits como arreglo de unidades kg/lb/g, no null default['kg'], con validación de lista no vacía, única y sin desconocidos/null. Mantener businessId/revision y mutex compartido vigente. No insertar filas de configuración para negocios sin fila ni inventar una revisión nueva; el futuro lector usará defaultkg/revision1 cuando falte configuración como hoy regional/fiscal. No añadir configuración a otra tabla ni otro contador de revisión.

La nueva capacidad sigue dormida: constraint temporal explícita en producto obliga soldByWeight=false/pricingUnit=unit hasta activación compatible CP2c. La constraint permanente documenta el modelo final y la temporal evita datos mass que los lectores actuales no pueden servir. No retirar restricciones anteriores ni modificar writers/DTO/UI en este bloque. Configuración de unidades puede almacenarse sin habilitar productos mass.

## Paths para reservar

- packages/db/src/schema/catalog.ts
- packages/db/src/schema/sale-commission.ts, solo businessConfiguration
- packages/db/drizzle, solo SQL nuevo y journal/snapshot generados
- apps/merchant/src/modules/pos/server/catalog-measure-storage.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2a-catalog-measure-storage-handoff.md

Un solo writer serial de schema/journal; verificar última entrada real antes de generar. Generación offline sin tocar config/tooling/deps ni conectar DB. Revisar JSONdiff semántico solo tablas/columnas/constraints afectadas; no aceptar drift ajeno. Sin business/catalog/import/domain writers, módulos/validadores, auth/kit/UI/índices/estados. Cualquier ampliación vuelve al coordinador antes de editar.

## Evidencia y gate

Node24, tipos db/domain/merchant, lint/formato/diff y guardias pertinentes separando backlog probado. DB exclusivamente tools/neon-test.sh --no-file-parallelism, CI reservada por root hasta teardown incluido owners. No DB local/PROD por worker, ni servidores concurrentes conectados durante DDL.

Verificar migración canónica/journal/tipos/constraints reales por wrapper. Probar antes/después sobre tablas propias aisladas con sustitución estricta únicamente de identificadores de tabla del SQL canónico, sin retroceder definición global ni truncar datos ajenos. Defaults históricos y nuevas inserciones legacy funcionan sin campos nuevos; valores extremos previos/null/0 de tarifas permanecen exactos. Configuración existente conserva revision y columnas ajenas; ausencia sigue ausente. Rechazar revisiones0/negativas y unidades vacías/duplicadas/desconocidas/null en configuración; aceptar subconjuntos válidos en cualquier orden. Producto mass sigue rechazado en esquema canónico por barrera temporal.

En tabla aislada únicamente, quitar la barrera temporal propia para comprobar constraint permanente: unit/unit y mass/kg|lb|g válidos, combinaciones cruzadas/desconocidos rechazados. No quitar esa barrera de core real ni afirmar venta por peso operativa. Lectura/escritura legacy proporcional sobre CI migrada conserva contrato previo. No browser/build/M0/M1/globalverify por ceremonia.

Handoff con base/SHA/config/runtime/SQL/JSONdiff/evidencia/fallos/skips/límites y cero procesos. QA independiente nuevo sobre candidato congelado, aceptación del coordinador. Root aplica migración LOCAL protegida después de QA y antes de integrar descriptor que exige columnas; ninguna migraciónPROD/push autorizada. Siguiente bloque business API o catálogo con otro autor y ficha; este autor conserva correcciones hasta aceptación.
