# 0242 CP2b.3 — catálogo y detalle V2

Base c72630a0308ee56d00f0928af3bf3dab5d862884; rama pos-readers-v2-0242, worktree /private/tmp/checkpass-pos-0242/pos-readers-v2-0242. Ficha 0242-cp2b-readers. Implementación acotada a GETcatalog y GETorders/:id; listado y comandos quedan separados.

Los dos handlers seleccionan X-Pos-Contract tras guard/scope; ausente/1 conserva shape V1, 2 devuelve DTO V2 y desconocido409 upgrade. Dispatcher conserva private,no-store también en errores/auth/tenant. Detalle comparte consulta tenant con reader legacy, usa snapshots confiables/exactos y núcleo financial existente, mantiene items y tipo persistido/fallback FK real, sin claves idempotentes públicas. Settlement y líneas cerradas congelados; total sigue gross y sale.total collected. readSale calcula gross legacy con rational, sin toResult/Number/toFixed. V1 valida metadata antes de números.

Catálogo proyecta solo campos POS, tarifas string/revisión/imagen pública, sin costo/objectKey. Incluye salesMassUnits bajo permiso POS; defaultkg solo sin fila. Precio0 sí/null no, filtros locales/categorías vigentes. Frecuencia usa COUNT DISTINCT orden cerrada/producto,30d/local, desempate fecha/id y catálogo autorizado; ranking V1 preserva unidades y rechaza medidas incompatibles.

Revisión posterior corrige fallback histórico cerrado/anulado unit sin settlement (centavos legacy sin normalización por moneda actual) y mantiene financialSnapshot null en abiertas calculadas; settlement.lines es fuente congelada alternativa por sourceLineId. Añade regresiones COP0.98, combine abierto, FKmesa real/cantidad2147483647 y duplicados recientes en frecuencia.

Checks y SHA final: pendientes de completar con evidencia antes de entregar. Puros iniciales measured-read+lines24PASS; typecheck merchant inicial PASS. Un intento de Vitest desde raíz con --project merchant falló por nombre inexistente; comando corregido desde apps/merchant pasó. No se afirma PASS de ese intento.

Masa/precisión operativas siguen bloqueadas hastaCP2c: pruebas masa solo helper puro; no filas POS imposibles, cambios schema/barreras/eventos ni writers/UI. Sin browser/build/fullverify/M0/M1/3201/túnel/push/PROD. Factory/QA/integración del coordinador; autor retiene fixes.

Corrida congelada inicial64815917258cb42870f399c7b0741aa2e7ad0a69: Neon4archivos18PASS/0skips/EXIT0, static tipos3/lint/formato+puros24PASS/EXIT0, app-boundary/UIguardtests17PASS, UIguard sin aumentos; guardias24PASS2FAIL por backlog exacto. Logs completos fueraWT en /private/tmp/checkpass-pos-0242/readers-evidence/64815917-*.log. Esta corrida no sustituye las nuevas regresiones.

Revisión producto23cf4a2188d127304a0ab32475a562c304eaff0c: static merchant/lint/formato y puros26PASS/EXIT0. Neon13tests12PASS1FAIL/0skips/EXIT1: unit-expand6PASS y GETs6PASS; caso descuento falló al preparar fixture intentando borrar financialSnapshot cerrado, rechazado23514 `P1 line settlement is immutable`. Fallo de fixture conservado en23cf4a21-neon.log; no trigger desactivado ni bypass. La siguiente revisión solo corrige esa fixture para conservar ambas fuentes reales y cubre fallback settlement.lines defensivo en helper puro. Producto23cf no cambia. CI se libera al coordinador después del teardown antes de otra corrida.
