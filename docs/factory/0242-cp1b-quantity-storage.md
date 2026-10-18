# 0242 — CP1b.3 quantity/snapshots string con operación unit conservada

Estado: preparada; no código hasta aceptar catálogo storage y reserva explícita. Autor nuevo/contexto vacío. Lectores unit8624cda8/QA745bff45 aceptados; catálogo storage tiene su gate separado. Base/journal exactos se verifican al despachar. No acumular esta tarea en el autor de0102.

## Cambio acotado

Ampliar `pos.pos_order_item.quantity` y `core.order_item.quantity` a numeric(24,9) string y sus tarifas snapshot a numeric(24,9) string. Mantener importes de línea/totales/pagos y JSON financieros sin cambio. Añadir por línea metadatos escalares `measure_kind`, `quantity_unit`, `price_unit`, `conversion_version` (Drizzle camelCase) con defaults históricos unit/unit/unit/mass-si-1. Son representación preparada, no activación comercial de masa.

Conservar integralidad/rango positivo INT32 del circuito unit mediante constraints temporales genéricas; preservar toda fila anterior válida. Mantener tarifas snapshot dentro de numeric(12,2) y centavos exactos por constraints temporales, como catálogo. Metadatos temporalmente admiten únicamente el default histórico coherente. No admitir una fila mass operativa que los readersV1 interpreten como piezas. Las barreras temporales se retiran por migración serial de activación compatible CP2c, junto con validaciones finales unit/mass del anexo y todos los consumidores. No retirar barreras aquí.

Precisión detectada en schema real: core.order_item no tenía CHECK de precio no negativo; su barrera temporal conserva el rango signed anterior de numeric(12,2), sin convertir un negativo en captura válida del dominio. POS conserva su CHECK no negativo. Ambas tablas sí mantienen cantidad positiva; no añadir un saneamiento destructivo de historia como parte del expand.

Writer Drizzle POS convierte cantidades validadas unit a string al insertar y editar, en el mismo candidato que cambia el tipo de schema. Core counter cambia solo cast de cantidad `::integer` a `::numeric`, después de validar el contrato unit; puntos/sellos siguen integer. Readers aceptados convierten DBstring validada a DTO/eventos unit anteriores. No cambiar payloadHTTP a quantity:string ni publicar V4 por este expand.

## Paths previstos para reservar

- `packages/db/src/schema/modules/pos.ts`
- `packages/db/src/schema/order.ts`
- `packages/db/drizzle`, únicamente migración nueva y journal/snapshot generados sin editar historia
- `apps/merchant/src/modules/pos/server/orders.ts`, writers insert/update quantity y adaptación de lectura solo si imprescindible
- `apps/merchant/src/server/counter/orders.ts`, cast de cantidad y validación de writer unit
- `apps/merchant/src/modules/pos/server/pos-measurement.neon.integration.test.ts`, inserción Drizzle quantity a string; no reejecutar setup M0 ni tocar evidencia congelada
- `apps/merchant/src/modules/pos/server/quantity-storage-expand.neon.integration.test.ts` nuevo
- `apps/merchant/src/modules/pos/server/unit-expand-compat.neon.integration.test.ts`, solo las dos aserciones de representación DB de precio/quantity (`stored` y `ordersWithItems`) a strings padded9; payloadHTTP/DTO/eventos y pruebas de rollback/retry intactos
- Mover íntegra `apps/merchant/src/server/catalog-storage-expand.neon.integration.test.ts` a `apps/merchant/src/modules/pos/server/catalog-storage-expand.neon.integration.test.ts`, ajustando únicamente imports y ubicación relativa del SQL, para respetar frontera core→módulo; todos los casos/oráculos intactos
- `apps/merchant/src/server/module-events/decode-measured.test.ts`, solo proveedor de fixture `recipes`→`provider-a` y referencias asociadas, sin cambiar shape/ref/negativos
- `docs/factory/0242-cp1b-quantity-storage-handoff.md`

Ampliaciones para fixtures/aserciones de almacenamiento en suites existentes se solicitan antes de editar con archivo/caso/motivo. No normalizar ciegamente todos los tests ni modificar payload HTTP para satisfacer tipo DB. Adaptadores ya aceptados no se duplican. No catálogo/business/config UI, scope/transporte, Recetas/Stock/analytics/decoders/publisher/V4/kit/guardias/tooling/deps/estados/índices. Si surge un consumidor real incompatible por la expansión, se identifica y reserva explícitamente, sin tomar CP1c entero.

Las dos correcciones de fixture anteriores eliminan regresiones introducidas en entregas previas de0242: no son backlog anterior al encargo aunque ya existieran en la base de este writer. Root reprodujo guard principal por import POS desde core y literals por ambos tests. No editar guardias/excepciones ni eliminar aserciones. Terminar primero cualquier corrida activa; congelar revisión nueva y repetir catálogo4/decoder focal/tipos/guardias afectados. Los between/literals de los seis archivos idénticos a00efff81 conservan su atribución previa. No ampliar afterAll de suites ajenas: los seis casos unit-expand cubren cierre/cupón/retry con teardown completo.

## Checks y límites

AGENTS/protocolos, anexo0242 compatibilidad/medidas y esta ficha; Node24. Un escritor exclusivo schema/journal, generación offline sin drift ajeno. CI exclusivamente tools/neon-test.sh, recurso reservado incluido DDL/teardown, sin otro servidor/suite conectado y --no-file-parallelism. Ningún DBPROD/push autorizado.

Verificar migración canónica real/tipos/constraints/defaults y preservación de IDs/snapshots financieros. Para antes/después, tablas/esquema propios con definición antigua y sustitución estricta solo de identificadores de tabla en las sentencias, documentando esa capa; no revertir tipos globales ni truncar datos ajenos. Conservar FKs/índices y no agregar FK core→módulo.

Casos reales sobre esquema migrado: lectura/listado/edición de nota de historia, adición y edición unit, precio legacy máximo×1, INT32 máximo×0,0≠null; cerrar con/sin pase/cupón y reintento idempotente sin duplicación; overflow de edición422 revierte cabecera/version/líneas; fracción/quantity fuera de rango/metadato incoherente/precisión prematura rechazados. Core order y evento V1–V3 conservan cantidades unit enteras y dinero exacto. Fixtures propias/teardown completo, incluidos owners; no usar fixtures M0 como mutación de prueba.

Tipos db/domain/merchant y suites focales existentes de lectores/cierre/settlement/catálogo afectadas, lint/formato/diff/boundary por schema. QA nuevo en candidato congelado; reutilizar evidencia compatible, sin verify global/M0/M1 por ceremonia. Conservar fallos/skips/límites y no esconder errores de fixtures. Comprobar compatibilidad del control archivado antes de M1 en esta nueva forma de almacenamiento: el driver Drizzle integer instalado convierte strings con parseInt, pero esa lectura de fuente no certifica el control; nunca asumir PASS sin smoke equivalente y freeze actualizado.

Handoff base/SHA/runtime/config/lock/schema/fixture/comandos/resultados, campos/constraints temporales, procesos/teardown. Después otros agentes nuevos implementan consumidores/V4 dormido y configuración/POSV2 por los cortes del plan. Mass/V4/precisión comercial nueva no quedan habilitados por esta entrega.
