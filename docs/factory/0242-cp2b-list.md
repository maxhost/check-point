# 0242 — CP2b.4 proyección agregada de listado V1/V2

Estado: preparada, sin autor/reserva. Autor nuevo/contexto vacío después de aceptar helpers de comandos y liberar WT. Base mínima0106 aceptada; puede avanzar junto a catálogo/detalle sin tocar sus archivos. Coordinador fija base/paths/CI exclusiva. No subdelegar. Leer protocolos, contrato0242 §3 y performance listado; no historia completa.

## Alcance

Preparar listPosOrders con proyección V2 explícita y conservar overload/default V1 para handler actual. No tocar routes/http/read/contracts del autor catálogo/detalle; el ensamblado API V2 conectará GETorders tras aceptar esta proyección y esas lecturas. No afirmar contratoHTTPv2 cableado por pruebas directas de dominio. Tests HTTPv1 existentes pueden reutilizarse para regresión del caller actual; guard/scope V2 se certifica al ensamblar.

## Resumen y agregación exacta

GETorders V2 entrega PosSummaryV2: version/saleType/orderLabel/lineCount y campos actuales pertinentes. lineCount cuenta filas, no sumar piezas+masa. Opcional physicalTotals puede omitirse para mantener entrega acotada. Abiertas todas/antiguas primero; cerradas/anuladas día local/recientes primero; statusvoided conserva90d. Mismo timezone/DST/límites, sin nueva paginación/truncar abiertas/índices. Orden vacío tiene0líneas/total0, no desaparece por JOIN.

Total de resumen cerrado viene de settlement.collected aun sin pase; si no hay settlement, neto core enlazado o snapshot legacy explícito. No inventar settlement ni redondear dinero histórico. Anulada conserva snapshot de importe y no se presenta como ingreso. Abierta normaliza originales exactos con moneda vigente y helpers financieros aceptados, sin recuperarlas líneas individuales por orden ni N+1.

Agregación SQL es proyección de **originales racionales**, no otra política financiera: SUMNUMERIC de numeradores enteros en denominador común derivado de gramsFactor/ratios aceptados para pares quantityUnit/priceUnit y escala fuente9+9. No hardcode duplicado de factores, división NUMERIC aproximada, SUM de importes de línea ya redondeados, float ni redondeo monetario SQL. Query devuelve por orden numerador/flags/contadores; normalización y rango ocurren una vez con financial/rational/measures comunes en JS BigInt. Equivalencia obligatoria contra buildFinancialAmountsFromSnapshots en tests. Si conviene otra forma algebraica exacta con el mismo gate, describirla a root antes de implementar. No traer arrays JSON de todas las líneas para sortear el requisito de agregación.

total_snapshot0106 es proyección nullable futura, no se puede usar como única autoridad de dinero abierto: no captura moneda/original racional y una moneda puede cambiar. Evitar doble redondeo de precio preciso (por ejemplo bruto0.499→USD0.50→COP1 sería incorrecto). Usar originales agregados y normalizar a moneda actual, cerrado usa settlement congelado. No agregar schema/cache/invalidation financiera por esta entrega ni escribir datos al leer. V1 agregado conserva semántica de centavos histórica y itemCount solo cuando todas las líneas/total son representables; detectar incompatibilidad antes de Number. Manejar ausencias/metadata inválida con error seguro, no total0 inventado.

## Paths autorizables

- apps/merchant/src/modules/pos/server/list.ts
- apps/merchant/src/modules/pos/server/measured-summary.ts y measured-summary.test.ts, nuevos
- apps/merchant/src/modules/pos/server/measured-summary.neon.integration.test.ts, nuevo
- docs/factory/0242-cp2b-list-handoff.md

Sin rutas/http/read/best-sellers/catalog/contracts/commands de otros autores, schema/journal/writes/UI/financial/measures/kit/guards/tooling/deps/estados/índices. Ampliaciones concretas root antes de editar. No nuevas columnas/cache para eludir caso moneda, ni backfills monetarios. Proyección pura de lectura no activa mass.

## Gate

Node24, tipos3/lint/formato/UIguard/guardias pertinentes (backlog24/2 separado) y equivalencia pura contra núcleo financiero. SQLexactoCI con VALUES/CTE de entradas para paresg/kg/lb, mezclaunit/mass,9dec/no terminante, umbralesUSD/COP y0.499sin doble redondeo,0/rango/metadata inválida; no insertar masa en tablas canónicas ni retirar barreras para fabricar PASS. Derivar coeficientes enteros de gramsFactor/ratios aceptados, sin duplicar constantes ni política de redondeo. Si otra álgebra exacta más simple sirve, explicar a root antes de implementar.

CI dominio real listPosOrders V1/V2 con fixtures completas owner/staff/business/locales/órdenes: todas las abiertas incl vacías/antiguas, orden, timezone/día/DST90d, cerrado settlement neto aun sin pase, legacy sinsettlement y anuladas explícitas, tabla real/legacy sin inferir texto, producto borrado, lineCount vs itemCount seguro, no tenantleak/nuevos efectos. Probar volumen acotado y forma de agregación sin devolver arrays de líneas ni N+1; no latenciaM1. Los casos mass SQL sobreVALUES son prueba algebraica, no venta canónica real (gateCP2c pendiente).

DB exclusivamente tools/neon-test.sh/envCIseleccionado y reserva transferida por root hasta teardown, --no-file-parallelism. CongelarSHA antes de CI, stdoutcompleto privado con SHA/comando/exit, fallos/skips/compatibilidad explícitos. Sin browser/build/fullverify/M0/M1/3201/túnel/demos/push/PROD. Entrega limpia0procesos y handoff, QA nuevo independiente; autor conservafixes. Factory e integración del coordinador.

Ampliación coordinador tras CI f62609ef: nueva suite5PASS y regresión7PASS/1FAIL. CASO11 de pos-orders.neon.integration.test.ts espera unitPrice8.00 frente almacenamiento exacto8.000000000 desde0102; mismo importe, producto borrado y cierre correctos. Factory extend autoriza solo ese archivo y adaptación literal exacta a escala9, sin cambiar producto ni relajar assertion. Conservar fallo original y repetir únicamente CASO11; las cinco nuevas permanecen evidencia compatible. DB vuelve a lectores tras teardown, sin wrapper paralelo.
