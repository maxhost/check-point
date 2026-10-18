# 0242 — CP2b.3 lecturas V2 de catálogo y detalle

Estado: preparada, sin autor/reserva. Requiere0106 aceptada (main4322456d, LOCAL107 protegida). Autor nuevo/contexto vacío; coordinador fija base/WT/factory antes de código. Puede avanzar junto al helper puro de comandos, sin tocar sus archivos. Leer protocolos/contrato0242 §1/3/5, performance de listado y código pertinente. No subdelegar.

## Superficie acotada

Adoptar X-Pos-Contract2 solo en dos lecturas GET catalog y orders/:id existentes. Mantener v1 compatible seguro y el guard→scope del dispatcher intacto; selector de versión en capa POS después del guard, no nombres de módulo en core. Ausente/1 conserva v1,2 usa V2, versión no soportada409 pos_client_upgrade_required sin efectos. private,no-store ya aplicado a todas las respuestas adoptadas, también errores/auth/tenant. No conectar POST/PUT/close/void/UI ni exigir scope required todavía.

Detalle V2 reutiliza PosOrderV2 y colección **items**, sin alias lines. quantity/unitPrice strings exactas, measure explícita y sourceLineId reales; preserves nombres/tarifas/factores de filas, orden de position/id, producto borrado|null y snapshots financieros históricos. contractVersion2, version/saleType/orderLabel/tableLabelalias/local/note/business/operadores/fechas/sale/settlement compatibles. saleType persistido se usa como autoridad; NULL transición solo fallback tableId real→table/sinFK→legacy, nunca texto. orderLabel usa table_label físico. No devolver create_request_id/huella/objectKey/credenciales/PII adicional.

No pasar lectura V2 por decoder v1 ni Number: unit histórico usa wrappers confiables, mass usa medidas/cálculo racional aceptado. Para total/línea abierta usar núcleo financiero existente con fuentes confiables; cerrada usa settlement/financialSnapshot congelados, sin consultar catálogo actual para reinterpretar. readOrderByRequest actual lee resumen core, no cantidades; puede reutilizarse para identidad/créditos/cupón sin recapturar productos. Si se comparte readSale, eliminar aritmética Number/toFixed de esa proyección y mantener cifras legacy con helpers exactos. No crear otro núcleo monetario.

En estas dos lecturas, V1 también debe examinar metadata antes de cualquier proyección numérica: masa con cantidad entera y tarifa de centavos sigue siendo masa. Rechazar medida no unit/unit/version válida y precio/cantidad no representables,409 upgrade sin convertir ni ocultar líneas. No basta validar cantidad/precio ignorando kind. Preserve shape/cifras v1 compatibles, incl permisos/tenant y producto eliminado.

## Listado en una entrega independiente

La agregación de GETorders tiene ficha propia0242-cp2b-list.md y autor nuevo. Esta entrega no toca list.ts ni el handler GETorders. La capacidad V2 de ese listado se conectará al ensamblar API V2 después de aceptar su proyección independiente; no se afirma cubierta por este PASS. Masa sigue bloqueada hastaCP2c.

## Catálogo V2 y frecuencia

GETcatalog mantiene filtro disponibilidad/local/categoría, excluye sin precio y admite precio0, imagen pública y strings/revisión/medida de producto. Solo PosCatalogProductV2, sin unitCost/objectKey ni resto de DTO administrativo. Añadir salesMassUnits al DTO PosCatalogV2 bajo el mismo permiso POS, defaultkg solo ausencia de configuración, sin GETbusiness ni permiso extra; root reflejará esa adición técnica de contrato antes de código. No paginar/truncar catálogo para benchmark.

frequentProductIds sustituye ranking de cantidades en V2: COUNT DISTINCT orden cerrada por producto en ventana30d/local actual. Dos líneas/snapshots del mismo producto en una orden cuentan1; solo IDs del catálogo autorizado, empate última venta/id estable. Unit/mass no se mezclan como cantidad. V1 conserva bestSellingProductIds/semántica previa mientras sea representable; lectura POSv1 detecta masa antes de usar ranking incompatible. No modificar dominio Counter/atajos/resolveScan en esta entrega. Gate de activación CP2c debe retirar o rechazar también writers legacy de Counter antes de permitir masa; sigue pendiente, no sobreclaim ahora.

## Paths autorizables

- apps/merchant/src/modules/pos/server/routes.ts, solo dos GET descritos
- apps/merchant/src/modules/pos/server/http.ts, solo selector de contrato/errores reutilizables
- apps/merchant/src/modules/pos/server/read.ts, compartir lectura de venta exacta/guardia metadata v1, sin cambiar writes
- apps/merchant/src/modules/pos/server/best-sellers.ts, función frecuencia V2 y legacy preservado
- apps/merchant/src/modules/pos/server/measured-read.ts y measured-read.test.ts, nuevos
- apps/merchant/src/modules/pos/server/measured-catalog.ts, nuevo
- apps/merchant/src/modules/pos/server/measured-read.neon.integration.test.ts, nuevo
- apps/merchant/src/modules/pos/contracts.ts, solo salesMassUnits de PosCatalogV2
- docs/factory/0242-cp2b-readers-handoff.md

Sin list.ts/handlerGETorders ni measured-input/measured-line-input/create-intent del otro autor, schema/journal/Counterdominio/close/orderswriters/UI/financial/measures/kit/guardias/tooling/deps/estados/índices. Ampliaciones concretas a root antes de editar.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias, puros de proyección equivalentes al núcleo financiero. Semántica real GETs/guard/scope/tenant/401403/version desconocida/404privacidad/defaultmetadata/revisiones, legacyunitalto y producto borrado, detalle open/closedconysincliente/voided y settlementcongelado, frecuencia pororden/catálogo/local. SQL/carga de listado y timezone90d corresponden a ficha independiente.

CI exclusivamente wrapper/envseleccionado/recurso asignado por root hasta teardown. Congelar SHA y guardar stdout completo fueraWT con SHA/comando/exit; fallos/skips/límites explícitos. Sin browser/build/M0/M1/fullverify por ceremonia. Mass real y tarifa precisa en órdenes canónicas siguen bloqueados hastaCP2c; no fabricar fixture imposible ni afirmar ese recorrido probado. QA nuevo independiente sobre combinado y evidencia compatible; entrega limpia/0procesos, factory del coordinador. Sin push/PROD/3201/túnel/M0/demos.
