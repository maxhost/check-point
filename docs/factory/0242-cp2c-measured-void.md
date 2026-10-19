# 0242 — CP2c.8 anulación interna V2 y lectura congelada

Estado: preparada, sin autor/reserva. Autor NUEVO/contexto vacío después de aceptar ensamblado HTTPclose; coordinador fija base/factory. Bloque coherente de anulación interna+su evento/lectura, sin conectar handler ni activar masa. Leer protocolos, contrato0242 void/históricos y funciones actuales. No subdelegar.

## Resultado

voidMeasuredPosOrder(business,userId,id,raw?,now?) retorna PosOrderV2. Conservar transición abierta→voided, anulada→respuesta canónica idempotente, cerrada→409not_open; no reabrir ni cancelar citas. PosVoidV2 permite version opcional; si enviada, validar sintaxis y en abierta comprobarla, stale409 con ordenV2 después rollback. Guard/scope quedan en futuro handler; función valida pertenencia bajo lock. Proponer diseño/parsing/locks/snapshot antes código.

Orden de locks compatible con create/PUT/close, sin invertir módulo/config/business/POS. Replay de ya anulada no reobserva catálogo/medidas/moneda, no vuelve a publicar ni crear efectos. Abierta usa snapshots propios en orden estable, qty/tarifa string y adaptadores históricos unit; no recapturar catálogo ni normalizar cada línea por separado. Kernel buildFinancialAmountsFromSnapshots fija gross/originales/asignación por línea según moneda autoritativa actual. Vacía mantiene anulación permitida. No construir un FinancialSettlement inválido con neto positivo y payments=[]: anulación NO es venta/cobro.

En la misma transacción congelar importes por línea donde corresponda, total_snapshot y evento pos.order.voided con versión nueva2 explícita y metadata medida; mantener wire legacy1 intacto. Evento2 conserva fuente/lugar/operador/hora, líneas con qty/measure/posición/fuente/producto/nombre y dinero/originales exactos, más amountMinor/currencyCode/minorUnit que usa voided_tickets. No Number como autoridad, sin sale.closed/core.order/pagos/loyalty/cupón/stock/comisión ficticios. Append y cambio estado/timestamp son atómicos e idempotentes por clave existente business/eventType/sourceId.

Leer nueva anulación con dinero y moneda congelados, incluso después de editar moneda/precio/producto actual. Opciones técnicas existentes antes de proponer DDL: posOrders.totalSnapshot y financial_snapshot de líneas; evento voided2 único por business/type/source ya guarda moneda/minorUnit/amountMinor. Puede usarse join único por esas claves y versión2, proyectando solo escalares monetarios para listado; no descargar payload/líneas del evento por cada summary ni añadir GET/N+1. Detalle puede usar esa misma autoridad y snapshots de línea. No recalcular una anulada nueva desde moneda vigente ni inventar settlement/pagos para guardar moneda. Legacyvoid1 conserva lectura monetaria anterior y alias/tipo; no backfill/rewrite de historia ni schema dentro de este bloque. Si nada de lo existente permite autoridad correcta, volver al coordinador con propuesta concreta antes ampliar scope.

Traductor métricas acepta version2 explícita sin estrechar legacy1; voided_tickets usa dinero congelado y count1, sin revenue/mass_sold/units_sold de venta ni consumo. Validar versión del envelope contra payload y campos realmente consumidos; no confundir sale.closedV4 con voided2 ni cambiar decoder de ventas. No publicar evento2 si algún consumidor relevante no es compatible en el mismo candidato.

## Paths autorizables

- apps/merchant/src/modules/pos/server/measured-void.ts
- apps/merchant/src/modules/pos/server/measured-void.test.ts
- apps/merchant/src/modules/pos/server/measured-void.neon.integration.test.ts
- apps/merchant/src/modules/pos/server/void-snapshot.ts, solo proyección/validación compartida del snapshot voided2 si necesaria
- apps/merchant/src/modules/pos/server/read.ts, solo lectura voided2 congelada
- apps/merchant/src/modules/pos/server/list.ts, solo lectura voided2 congelada agregada
- apps/merchant/src/modules/pos/server/metrics.ts, solo tipo/versión voided2 compatible
- apps/merchant/src/modules/analytics-an3-translators.test.ts, solo regresiones de voided1/2
- docs/factory/0242-cp2c-measured-void-handoff.md

Sin routes/voidlegacy/orders/close/accredit/publisher de ventas/contratos públicos/schema/journal/consumers ajenos/UI/kit/guardias/tooling/deps/estados/índices. Extensión concreta antes cualquier otro path. Si surge límite file-size, proponer helper pequeño dentro scope en lugar de esconderlo o editar guardias.

## Gate

Node24 tiposdb/domain/merchant/lint/formato/UIguard/guardias pertinentes y puros exactos/decoder. CI exclusiva wrapper seleccionado hasta teardown: orden unit real creadaV2, void y replay únicos, vacía, versión stale/no-open/tenant sin efectos; fallo SQL después append antes estado revierte todo y permite mismo intento; listado/detalle conservan importes/nombres/medida/moneda tras cambios posteriores. Verificar sin filas de venta/pagos/accrual/redención/stock/comisión; evento/deliveryanalytics real y métrica voided_tickets correcta sin revenue, legacy1 compatible. Masa positiva pura con snapshots sintéticos mientras barreras activas, NOmass canónica/HTTP/Next/auth. No repetir matriz financiera/close por ceremonia.

Logs SHA/base/config/comandos/exits/fallos/skips fueraWT; fuente congelada antes tests, no editar mientras corren; teardown IDs propios completos incl owners/sesiones,0procesos. Sin browser/build/fullverify/M0/M1/activación/migración. QA NUEVO independiente, fixes autor; factory/integración coordinador. Sin push/PROD/3201/túnel/M0/demos/artefactos ajenos.
