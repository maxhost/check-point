# 0242 — CP2b.2 entrada exacta e intención canónica de órdenes V2

Estado: preparada, sin autor/reserva. Autor nuevo/contexto vacío; coordinador fija base/WT/factory antes de código. Puede avanzar sin DB en paralelo a0106. Leer protocolos/contrato0242 §1/3 y tipos/helpers pertinentes, no historia completa. No subdelegar.

## Resultado acotado

Helpers de servidor puros para parsear comando create/update V2, líneas nuevas/existentes y producir huella canónica de create. No conectar rutas/writers/readers, activar mass ni modificar V1 todavía. La siguiente entrega de API usará estos helpers con guard/scope/locks/filas autoritativas, y debe probar ese cableado por separado. No afirmar idempotencia DB ni venta por peso completa por tests puros.

Create exige createRequestId UUID, saleType table/pickup/delivery/counter (no legacy), referencias UUID/null, nota actual trim/null/límite1000, items[] explícito hasta200 (vacío válido). Mesa real referencia tableId; su local/nombre se resolverán en servicio y no se aceptan como autoridad del cliente. Mesa sin FK real exige orderLabel1–60. pickup/delivery exigen etiqueta1–60 y tableIdnull. Counter sin mesa ni etiqueta manual autoritativa; el servicio generará identificador estable. No lookup DB ni asignación de local/mesa en helpers. Update conserva version entera positiva dentro deINT32, contexto y lista completa; legacy solo se acepta con contexto existente legacy confiable suministrado por futuro servicio, no por elección arbitraria del cliente.

Línea nueva: productId UUID, quantity Decimal string estricta y quantityUnit conocida; catalogRevision string positivaINT32. Nada de unitPrice/name/measure arbitrarios del cliente. Entrada numérica/exponente/coma/null/fracciónunit/0/negativo/desconocidos/límite9dec se rechaza con error tipado seguro. Reutilizar captureQuantity y medidas aceptadas, nunca Number como autoridad. `items` no se fusiona por productId: misma ID puede tener snapshots distintos. Create rechaza lineId existente; update permite existentes con lineId UUID/productId UUID|null, sin catalogRevision cliente para alterar snapshot. IDs existentes repetidos se rechazan. Reutilizar tope actual200 sin cambiar el parser V1.

Validación de línea existente tiene dos pasos: sintaxis de entrada, y comparación contra contexto de snapshot confiable que aportará la fila DB del servicio. Nunca tratar datos del body como snapshot confiable. Conservar nombre/productId/precio/unidad tarifaria/factor de esa fuente; rechazar lineId/productId no coincidentes o cambio de dimensión unit↔mass. Masa puede recibir nueva captura en otra unidad compatible sin cambiar priceUnit/conversionVersion; no convertir una aproximación presentada como si fuera medición nueva. El cliente conserva fuente original cuando solo cambia presentación; helpers no inventan conversión.

Legacy unit alto: cantidad histórica hastaINT32 se puede conservar SIN cambio solo cuando coincide exactamente con snapshot autoritativo y unidad discreta; cantidad nueva o cambiada sigue límite nuevo. Como tarifas, esta conservación no autoriza introducir un entero alto nuevo ni confiar en un raw snapshot del caller HTTP. No ensanchar captureQuantity ni estrechar trustedUnitSnapshotQuantity. Comparar decimales exactos/canónicos con helpers. No cálculos financieros alternativos: aquí no se decide total/discount/costo/pago.

La huella de create se obtiene de estructura explícita canónica y SHA256 del servidor (node:crypto permitido en helper servidor), sin mutar input. Orden de claves del JSON recibido no importa; las posiciones y separación de items sí importan y se conservan. Incluir todos los campos semánticos del comando normalizado: tipo/etiqueta aplicable/local/mesa/nota/líneas con producto/cantidad/unidad/revisión. Valores de etiqueta de mesa real/counter que no tienen autoridad se normalizan explícitamente, no se leen nombres actuales de DB para formar huella. UUID normalizado; no normalizar Unicode/texto comercial más allá del contrato trim. Misma intención normalizada→misma huella, cualquier cambio semántico→distinta. No hash de catálogo/precio actual ni intento de resolverlo antes del replay; futuro servicio buscará clave propia/huella antes de recapturar catálogo. La huella no es credencial y la unicidad será por negocio+createRequestId; no loguear datos personales ni rawcomandos en evidencia pública.

Rechazar campos comerciales prohibidos en lugar de aceptar snapshot/importe del cliente. Normalización no depende del orden de propiedades ni muta/fusiona líneas. Errores uniformes con CounterError/PosError existentes si son pertinentes, sin otra jerarquía global. No cambiar tipos/financial/helpers aceptados para hacer pasar fixtures. Tipos de retorno reutilizan contratos puros y pueden ser internos normalizados, sin nuevo DTO público paralelo.

## Paths autorizables

- apps/merchant/src/modules/pos/server/measured-input.ts y measured-input.test.ts, nuevos
- apps/merchant/src/modules/pos/server/measured-line-input.ts y measured-line-input.test.ts, nuevos
- apps/merchant/src/modules/pos/server/create-intent.ts y create-intent.test.ts, nuevos
- docs/factory/0242-cp2b-command-input-handoff.md

Sin schema/journal/órdenes/rutas/listado/read/UI/kit/guardias/tooling/deps/estados/índices/financial/measures/contratos compartidos. Si no hacen falta seis archivos, mantener menos; no crear capas por ceremonia. Ampliaciones concretas a root antes de editar.

## Gate

Node24, tipos3/lint/formato/guardias pertinentes y pruebas puras de invariantes reales. Casos createcuatro tipos/legacyrechazado/etiquetas/localmesa/UUID/nota, updateversion ylegacycontextoautoritativo, array vacío200/201, payloads malformados/comercialesprohibidos, masa9dec y fracciónunit negativa, duplicadoID e idéntico producto sinfusión, snapshot inexistente/ajeno/mismatch, conversión de captura conserva tarifa/factor, qtylegacyalta sin cambio vs nueva/cambiada rechazada. Huella estable entre claves desordenadas y normalizaciones contratadas, diferente ante tipo/local/label/nota/producto/cantidad/unidad/revisión/orden o cardinalidad, input no mutado. Valor de pruebas es proteger autoridad/identidad, no espejar helpers.

SIN DB/env/wrapper ni migraciones; no mocks que se presenten como guard/DB/tenant real. Sin browser/build/fullverify/M0/M1. Congelar SHA para checks; logs completos fueraWT con SHA/comando/exit, fallos/skips/limites. Guardias backlog24/2 separadas y sin nuevos offenders. Entrega limpia/0procesos, QA nuevo independiente y autor conserva fixes. Factory/integración del coordinador. Sin push/PROD ni3201/túnel/M0/demos. Próximo API V2 integrará y probará estas piezas sobre0106 aceptada con otro autor limpio.
