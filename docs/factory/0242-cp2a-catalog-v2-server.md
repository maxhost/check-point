# 0242 — CP2a.5 contrato de catálogo v2 e inyección de medidas

Estado: preparada, sin autor/reserva. Depende de revisiones atómicas del catálogo, API de unidades y hook genérico aceptados. Coordinador fija base/WT y autor nuevo/contexto vacío. No subdelegar. Leer protocolos/contrato0242 §2, helpers measures y archivos pertinentes. No rediseño del writer ni segundo algoritmo de precios.

## Contrato y compatibilidad

GET /api/catalog y POST/PUT productos existentes adoptan X-Catalog-Contract:2 con tarifas Decimal strings/null, soldByWeight, pricingUnit y catalogRevision=String(salesRevision). PUTv2 exige expectedSalesRevision y coteja dentro de la transacción/relectura bloqueada antes de escribir;409 catalog_changed incluye solo DTO autorizado vigente para revisar intención. POST inicia1 y revisión sigue reglas aceptadas. Preservar categorías/locales/moneda/importInProgress/imagen pública sin filtrar objectKey. Selector de contrato es capacidad, nunca credencial.

DTOv1 conserva shape/numbers históricos únicamente cuando producto unit y tarifas representables en centavos/rango legacy. Masa o tarifa no representable→409 pos_client_upgrade_required antes de Number o escritura, sin downcast. Writer legacy sobre mass no cambia medidas/tarifa. Clientes v2 nunca reciben Number como autoridad de tarifa. Reutilizar parsePrice/parseNullablePrice y trustedUnitSnapshotPrice/trustedUnitLegacyPrice según autoridad: nuevos inputs string estrictos9dec/límite nuevo; lectura histórica y conservación exacta de tarifa unit legacy mayor al límite nuevo siguen compatibles. Una actualización de otros campos puede conservar tarifa legacy idéntica al snapshot autorizado; esa excepción no permite introducir una tarifa alta nueva ni trasladarla a mass.

Mantener guard catalog sin email (requireOwner histórico), DELETE owner-only y rutas existentes. V2 privado/no-store en éxito y errores guard/body/revisión/dominio/DB. Validar input y metadata unit/unit o mass/unidad habilitada con tipos/helpers comunes. No inferir unidad desde precio ni aceptar revisión inválida. Errores de dinero/medida seguros y tipados; no parsear texto del mensaje para decidirlos.

## Inyección y locks

Merchant inyecta validateResourceMeasurementChange al dominio; packages/domain no importa registro ni tablas/nombres de módulo. Writer usa misma tx/contexto con resourceType product, negocio/id y medida anterior/nueva. No omitir callback por old==new si se requiere validar composición actual. Incompatibilidad→409 measurement_basis_required; excepción proveedor revierte producto/revisión/locales. No consulta receta/precio actuales para inventar base. Validación de unidades y cambios siguen business-config antes de lock producto.

Publicaciones de composición adquieren business-config antes del lock existente del proveedor, compartiendo orden con catálogo/configuración; auditar callers de lockRecipes/publication. Se asigna únicamente ajuste de orden en model/common.ts, no nueva publicación/base/UI. Si un publisher real no pasa por ese helper, pedir path/razón antes de editar. Importación actual ya aditiva/unit y serializada: preservar comportamiento/revisiones, no inventar upsert mass.

## Capacidad dormida de esta entrega

No retirar constraints temporales de0102/0103/0105 ni activar productor4. Los handlers/helpers nuevos se preparan completos; las nuevas escrituras mass o de precisión no representable siguen bloqueadas por las barreras reales hasta CP2c. Traducir únicamente esa violación temporal conocida a respuesta segura409 pos_client_upgrade_required sin efectos (nunca coerción/éxito); no convertir cualquier fallo DB en ese código. Este comportamiento es transición local, no publicar la UI de captura mass hasta candidato completo. Las lecturas/modos se prueban puramente y la nueva API unit compatible sí funciona con DB real. Gate real mass/unidad habilitada/cambio modo/unidad en uso/carreras y tarifas precisas se completa al retirar barreras en CP2c; no debilitar DB para fabricar aprobación anticipada.

## Paths previstos

- packages/domain/src/server/catalog/core.ts
- packages/domain/src/server/catalog/products.ts
- packages/domain/src/server/catalog/validation.ts
- packages/domain/src/server/catalog/measured-contract.ts y measured-contract.test.ts, nuevos si se necesita separar contrato puro
- packages/domain/src/server/catalog.ts, exports compatibles
- apps/merchant/src/app/api/catalog/route.ts
- apps/merchant/src/app/api/catalog/product/route.ts
- apps/merchant/src/app/api/catalog/product/[id]/route.ts
- apps/merchant/src/app/api/catalog/_auth.ts, errores/metadata/cache solo rutas adoptadas
- apps/merchant/src/modules/recipes/server/model/common.ts, solo orden de locks
- apps/merchant/src/modules/pos/server/catalog-v2.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2a-catalog-v2-server-handoff.md

Sin schema/journal, kit/guardias/tooling/deps/UI/estados/índices/POS handlers ni implementación de base nueva. Helpers adicionales o ampliaciones deben volver a root antes de editar. Reutilizar writer atómico; si tamaño exige extracción concreta, proponer paths antes, sin meter todo en un archivo enorme.

## Gate

Node24, tipos3/lint/formato/focales/guardias pertinentes. Puros: formatter1/2, cadenas exactas/padding/limites/history, parser estricto y compatibilidad snapshot, unit/mass/precioUnit inválidos, revisión y objetos públicos sin keys privadas. CI exclusiva por root/tools/neon-test.sh --no-file-parallelism/env privado, teardown owners/negocios/sesiones incluido.

Request→ruta→guard→DB reales: v1 legacy preservado; v2 unit devuelve strings/medidas/revisión; create1/update/revisión/conflicto DTO; no-op comercial vs delta; dos PUT same expected solo1gana; tenantB404/permiso catalog/DELETE owner sin alterar emailgate. Contexto/tx callback idéntico y rechazo/proveedor excepción sin writes; proveedor real con base publicada incompatible puede probar old==new sobre producto unit sin eliminar barrera (inconsistencia capturada válida para rechazo), conservando snapshots. Test de orden mutex/catalog/config/pub proporcional sin alegar carrera mass todavía. Intentos de mass/precisión temporal bloqueados sin efectos ni revisión extra. Regresión catálogo/importación compatible reutilizable.

QA nuevo en candidato congelado, evidencia SHA/config/runtime/resultados/fallos/skips/límites y commit limpio/0procesos. No browser/build/M0/M1/fullverify por ceremonia. Factory/integración del coordinador; sin push/PROD. UI de catálogo y base de composición son otros entregables con autores nuevos.
