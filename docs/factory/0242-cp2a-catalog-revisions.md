# 0242 — CP2a.3 atomicidad y revisiones comerciales del catálogo actual

Estado: preparada, sin autor/reserva. Depende de metadatos0105 aceptados. Coordinador fija base/WT y autor nuevo/contexto vacío; no subdelegar. Leer protocolos, contrato0242 §2 y archivos pertinentes. Es un paso de servidor previo al contrato HTTPv2, sin nueva UI ni activación mass.

## Resultado acotado

Los writers actuales de producto conservan firmas/DTOv1/validación legacy, pero create/update y sincronización de product_location pasan a una transacción atómica. Validación de categoría/locales y lectura actual deben usar la misma transacción que escribe. Una falla no puede dejar cabecera guardada con disponibilidad antigua o enlaces parciales.

Adquirir business-config/<businessId> antes de lock de producto/importación y antes de validar/escribir; mismo advisory mutex usado por configuración regional/fiscal/unidades. Update relee y bloquea la fila autorizada dentro de la transacción. Delete usa el mismo orden. Importación adquiere business-config antes del lock existente de import, conservando accepted/no-op/idempotencia/relectura y limpieza aftercommit. No introducir lock invertido ni sostener transacción durante proveedor/R2/email.

salesRevision inicia1 en productos nuevos y aumenta una vez por cambio comercial real: nombre, precio/costo, availableAllLocations o conjunto de locales efectivos. Comparar valores decimales equivalentes sin pérdida y conjuntos normalizados sin depender del orden; un no-op no cambia revisión. Imagen/atribución y categoría sin cambio comercial no invalidan cotización. Cambios simultáneos de nombre/tarifa/disponibilidad no pierden incrementos ni enlaces y deben reflejarse en revisión. Mantener updatedAt según comportamiento actual. Metadatos soldByWeight/pricingUnit no son editables por estos writers legacy; conservarlos, sin reset implícito.

La importación vigente es aditiva: nuevos productos unit/revisión1; productos omitidos/reutilizados quedan intactos, incluso metadatos y revisiones. No inventar update/reconciliación destructiva que hoy no existe. Sigue la protección de import abierto y recuperación de categorías concurrentes. No declarar cerrada toda carrera de inicio de import si ese writer no está reservado aquí.

Preparar/cerrar efectos externos de imágenes fuera de la transacción. Si una imagen preparada se basa en una observación que cambió, detectar conflicto antes de sustituir y limpiar solo prefijos propios preparados; no borrar el asset vigente de otro writer. No reimplementar procesador/R2 ni abrir un pool paralelo. Mantener rollback/aftercommit existentes; si el helper actual impide atomicidad segura, pedir ampliación concreta antes de editarlo.

## Paths previstos

- packages/domain/src/server/catalog/products.ts
- packages/domain/src/server/catalog/import-guard.ts, permitir lectura con tx opcional conservando callers actuales
- apps/merchant/src/server/catalog-import/write.ts
- apps/merchant/src/modules/pos/server/catalog-revisions.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2a-catalog-revisions-handoff.md

Sin schema/journal/HTTPv2/DTOv2/parser preciso/mode writer/hook/composición/publicación/UI/kit/tooling/deps/guardias/estados/índices. La inyección del hook y el lock común de publicaciones se conectan con el writer medido posterior; no afirmar esa carrera certificada ahora. Barreras unit y precisión siguen intactas. Paths adicionales vuelven a root con razón antes de editar.

## Gate

Node24, tipos domain/db/merchant y estáticos/focales/guardias pertinentes. CI exclusiva solo por transferencia root, tools/neon-test.sh --no-file-parallelism/env privado, teardown incluido owners. Casos reales de producto create1; cambios comerciales incrementan exactamente una vez; no-op/orden locales/imagen y categoría conservan revisión; unitPrice/cost padded equivalentes no generan delta ficticio; dos actualizaciones simultáneas no pierden revisiones/enlaces; tenant/local/categoría ajenos no escriben. Observar transacción completa y rollback ante fallo posterior a escritura de cabecera con fixture posible/controlada, sin truncar ni debilitar restricciones globales. Si hace falta ampliación de test/harness para esa señal, pedirla antes.

Importación real conserva nuevo unit1 e idempotencia/replay sin duplicados ni incrementos en productos omitidos. Reutilizar regresiones legacy compatibles, sin R2 real/proveedor externo ni fullverify/browser/build/M0/M1 por ceremonia. Pruebas de modo mass/unidad en uso/publicación y contratoHTTPv2 quedan en entregas posteriores, no alegarlas aquí.

Handoff SHA/config/runtime/resultados/fallos/skips/límites, commit limpio/0procesos; QA independiente de candidato congelado y factory/integración del coordinador. Sin push/PROD. Correcciones con su autor; siguiente contrato medido con autor nuevo.

Autorización de test DDL por coordinador: función en esquema propio único y trigger de nombre único sobre core.product_location, filtrado estrictamente a productId/locationId exclusivos del fixture, para RAISE controlado tras header. Solo tools/neon-test.sh con CI exclusiva/serial; finally/afterAll elimina trigger, función/esquema y fixtures incluso fallo. No constraints debilitadas, migración canónica ni datos ajenos.
