# 0242 — CP2b.3 lecturas V2 de catálogo, detalle y resumen agregado

Estado: preparada, sin autor/reserva. Requiere0106 aceptada (main4322456d, LOCAL107 protegida). Autor nuevo/contexto vacío; coordinador fija base/WT/factory antes de código. Puede avanzar junto al helper puro de comandos, sin tocar sus archivos. Leer protocolos/contrato0242 §1/3/5, performance de listado y código pertinente. No subdelegar.

## Superficie acotada

Adoptar X-Pos-Contract2 solo en tres lecturas GET catalog/orders/orders/:id existentes. Mantener v1 compatible seguro y el guard→scope del dispatcher intacto; selector de versión en capa POS después del guard, no nombres de módulo en core. Ausente/1 conserva v1,2 usa V2, versión no soportada409 pos_client_upgrade_required sin efectos. private,no-store ya aplicado a todas las respuestas adoptadas, también errores/auth/tenant. No conectar POST/PUT/close/void/UI ni exigir scope required todavía.

Detalle V2 reutiliza PosOrderV2 y colección **items**, sin alias lines. quantity/unitPrice strings exactas, measure explícita y sourceLineId reales; preserves nombres/tarifas/factores de filas, orden de position/id, producto borrado|null y snapshots financieros históricos. contractVersion2, version/saleType/orderLabel/tableLabelalias/local/note/business/operadores/fechas/sale/settlement compatibles. saleType persistido se usa como autoridad; NULL transición solo fallback tableId real→table/sinFK→legacy, nunca texto. orderLabel usa table_label físico. No devolver create_request_id/huella/objectKey/credenciales/PII adicional.

No pasar lectura V2 por decoder v1 ni Number: unit histórico usa wrappers confiables, mass usa medidas/cálculo racional aceptado. Para total/línea abierta usar núcleo financiero existente con fuentes confiables; cerrada usa settlement/financialSnapshot congelados, sin consultar catálogo actual para reinterpretar. readOrderByRequest actual lee resumen core, no cantidades; puede reutilizarse para identidad/créditos/cupón sin recapturar productos. Si se comparte readSale, eliminar aritmética Number/toFixed de esa proyección y mantener cifras legacy con helpers exactos. No crear otro núcleo monetario.

V1 también debe examinar metadata antes de cualquier proyección numérica: masa con cantidad entera y tarifa de centavos sigue siendo masa. Rechazar medida no unit/unit/version válida y precio/cantidad no representables,409 upgrade sin convertir ni ocultar líneas. No basta validar cantidad/precio ignorando kind. Preserve shape/cifras v1 compatibles, incl permisos/tenant y producto eliminado.

## Resumen y agregación exacta

GETorders V2 entrega PosSummaryV2: version/saleType/orderLabel/lineCount y campos actuales pertinentes. lineCount cuenta filas, no sumar piezas+masa. Opcional physicalTotals puede omitirse para mantener entrega acotada. Abiertas todas/antiguas primero; cerradas/anuladas día local/recientes primero; statusvoided conserva90d. Mismo timezone/DST/límites, sin nueva paginación/truncar abiertas/índices. Orden vacío tiene0líneas/total0, no desaparece por JOIN.

Total de resumen cerrado viene de settlement.collected aun sin pase; si no hay settlement, neto core enlazado o snapshot legacy explícito. No inventar settlement ni redondear dinero histórico. Anulada conserva snapshot de importe y no se presenta como ingreso. Abierta normaliza originales exactos con moneda vigente y helpers financieros aceptados, sin recuperarlas líneas individuales por orden ni N+1.

Agregación SQL es proyección de **originales racionales**, no otra política financiera: SUMNUMERIC de numeradores enteros en denominador común derivado de gramsFactor/ratios aceptados para pares quantityUnit/priceUnit y escala fuente9+9. No hardcode duplicado de factores, división NUMERIC aproximada, SUM de importes de línea ya redondeados, float ni redondeo monetario SQL. Query devuelve por orden numerador/flags/contadores; normalización y rango ocurren una vez con financial/rational/measures comunes en JS BigInt. Equivalencia obligatoria contra buildFinancialAmountsFromSnapshots en tests. Si conviene otra forma algebraica exacta con el mismo gate, describirla a root antes de implementar. No traer arrays JSON de todas las líneas para sortear el requisito de agregación.

total_snapshot0106 es proyección nullable futura, no se puede usar como única autoridad de dinero abierto: no captura moneda/original racional y una moneda puede cambiar. Evitar doble redondeo de precio preciso (por ejemplo bruto0.499→USD0.50→COP1 sería incorrecto). Usar originales agregados y normalizar a moneda actual, cerrado usa settlement congelado. No agregar schema/cache/invalidation financiera por esta entrega ni escribir datos al leer. V1 agregado conserva semántica de centavos histórica y itemCount solo cuando todas las líneas/total son representables; detectar incompatibilidad antes de Number. Manejar ausencias/metadata inválida con error seguro, no total0 inventado.

## Catálogo V2 y frecuencia

GETcatalog mantiene filtro disponibilidad/local/categoría, excluye sin precio y admite precio0, imagen pública y strings/revisión/medida de producto. Solo PosCatalogProductV2, sin unitCost/objectKey ni resto de DTO administrativo. Añadir salesMassUnits al DTO PosCatalogV2 bajo el mismo permiso POS, defaultkg solo ausencia de configuración, sin GETbusiness ni permiso extra; root reflejará esa adición técnica de contrato antes de código. No paginar/truncar catálogo para benchmark.

frequentProductIds sustituye ranking de cantidades en V2: COUNT DISTINCT orden cerrada por producto en ventana30d/local actual. Dos líneas/snapshots del mismo producto en una orden cuentan1; solo IDs del catálogo autorizado, empate última venta/id estable. Unit/mass no se mezclan como cantidad. V1 conserva bestSellingProductIds/semántica previa mientras sea representable; lectura POSv1 detecta masa antes de usar ranking incompatible. No modificar dominio Counter/atajos/resolveScan en esta entrega. Gate de activación CP2c debe retirar o rechazar también writers legacy de Counter antes de permitir masa; sigue pendiente, no sobreclaim ahora.

## Paths autorizables

- apps/merchant/src/modules/pos/server/routes.ts, solo tres GET descritos
- apps/merchant/src/modules/pos/server/http.ts, solo selector de contrato/errores reutilizables
- apps/merchant/src/modules/pos/server/read.ts, compartir lectura de venta exacta/guardia metadata v1, sin cambiar writes
- apps/merchant/src/modules/pos/server/list.ts, proyección agregada V1/V2 preservando contrato
- apps/merchant/src/modules/pos/server/best-sellers.ts, función frecuencia V2 y legacy preservado
- apps/merchant/src/modules/pos/server/measured-read.ts y measured-read.test.ts, nuevos
- apps/merchant/src/modules/pos/server/measured-catalog.ts, nuevo
- apps/merchant/src/modules/pos/server/measured-summary.ts y measured-summary.test.ts, nuevos si separar SQL/normalización
- apps/merchant/src/modules/pos/server/measured-read.neon.integration.test.ts, nuevo
- apps/merchant/src/modules/pos/contracts.ts, solo salesMassUnits de PosCatalogV2
- docs/factory/0242-cp2b-readers-handoff.md

Sin measured-input/measured-line-input/create-intent del otro autor, schema/journal/Counterdominio/close/orderswriters/UI/financial/measures/kit/guardias/tooling/deps/estados/índices. Ampliaciones concretas a root antes de editar.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias, puros de proyección equivalentes al núcleo financiero. SQL exacto probado en CI con VALUES/filas aisladas de entrada para paresg/kg/lb, mezclasunit/mass,9dec, no terminante, umbralesUSD/COP,0.499dobleredondeo,0/overflow/invalidmetadata; no retirar barreras de tablas canónicas. Semántica real GETs/guard/scope/tenant/401403/version desconocida/404privacidad/defaultmetadata/revisiones, legacyunitalto y producto borrado, open/closedconysincliente/voided/timezoneDST/90d y settlementneto, frecuencia pororden/catálogo/local. Mostrar agregado sin SELECT individual de líneas y sin N+1; volumen sintético acotado demuestra todas las abiertas, no latenciaM1.

CI exclusivamente wrapper/envseleccionado/recurso asignado por root hasta teardown. Congelar SHA y guardar stdout completo fueraWT con SHA/comando/exit; fallos/skips/límites explícitos. Sin browser/build/M0/M1/fullverify por ceremonia. Mass real y tarifa precisa en órdenes canónicas siguen bloqueados hastaCP2c; no fabricar fixture imposible ni afirmar ese recorrido probado. QA nuevo independiente sobre combinado y evidencia compatible; entrega limpia/0procesos, factory del coordinador. Sin push/PROD/3201/túnel/M0/demos.
