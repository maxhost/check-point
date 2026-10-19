# 0242 CP2b.3 — catálogo y detalle V2

Base c72630a0308ee56d00f0928af3bf3dab5d862884. Rama pos-readers-v2-0242; WT /private/tmp/checkpass-pos-0242/pos-readers-v2-0242. Producto congelado en 23cf4a2188d127304a0ab32475a562c304eaff0c; tests finales en 143af6c74d887cc0b3e7c600d43fab06e554c436. El commit de cierre modifica solo este handoff. Ficha 0242-cp2b-readers; sin listado/commands/writers/UI/esquema.

GET catalog y GET orders/:id seleccionan X-Pos-Contract después de guard/scope: ausente/1 conserva V1 seguro,2 devuelve V2 y desconocido → 409 upgrade sin efectos. Dispatcher conserva private,no-store también para auth/tenant/errores. No se adopta GET orders aquí.

Detalle comparte joins y lookup tenant con V1, mantiene items, strings exactas, medida/revisión de conversión, snapshots/nombre/tarifa, producto eliminado y orden position/id. Tipo persistido manda; null usa solo FK de mesa real, nunca texto. orderLabel/tableLabel conservan table_label físico. No se exponen claves de idempotencia/huella ni PII nueva. V1 comprueba metadata antes de números. V2 usa núcleo financial de snapshots confiables para lineTotal abierto y conserva financialSnapshot null si DB no lo capturó: calcular no crea autoridad de cierre ni impide combinar. Capturas DB/settlement.lines por sourceLineId son fuentes congeladas; el fallback defensivo del settlement se prueba en puro. Cerrado/anulado unit histórico sin captura financiera conserva centavos legacy exactos, sin normalizar por moneda actual. Settlement manda cuando existe: total=gross y sale.total=collected. readSale conserva gross legacy con rational, sin toResult/Number/toFixed.

Catálogo solo proyecta PosCatalogProductV2 (sin costo/objectKey): tarifas string, revisión string e imagen pública. SalesMassUnits usa permiso POS, default kg solo sin configuración. Filtros de disponibilidad/local/categoría vigentes; precio0 sí/null no, sin truncar catálogo. Frecuencia cuenta órdenes cerradas distintas por producto/30d/local, desempata por fecha/id y filtra IDs del catálogo autorizado; duplicados recientes prueban que COUNT(*) sería incorrecto. V1 mantiene ranking por cantidades mientras sea representable y rechaza metadata incompatible.

Evidencia completa fueraWT: /private/tmp/checkpass-pos-0242/readers-evidence/. Node 24.20.0, lockfile/dependencias sin cambios. DB solo wrapper con NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env y reserva exclusiva hasta teardown.

| Archivo de evidencia | SHA | Resultado |
| --- | --- | --- |
| 64815917-static.log | 64815917258cb42870f399c7b0741aa2e7ad0a69 | Tipos db/domain/merchant, lint/formato de todo scope y puros: 24 PASS; EXIT 0 |
| 64815917-tool-guards.log | 64815917 | app-boundary/UIguard tests: 17 PASS; EXIT 0 |
| 64815917-guards.log | 64815917 | UIguard base c726 sin aumentos; guardias: 24 PASS / 2 FAIL, EXIT 1: backlog expenses immediate→stock/count y cinco archivos core con literales exactos, sin nuevos infractores |
| 64815917-neon.log | 64815917 | Catálogo/detalle inicial + unit-expand + scope + best-sellers: 18 PASS/0 skips; EXIT 0 |
| 23cf4a21-static.log | 23cf4a2188d127304a0ab32475a562c304eaff0c | Merchant tipos/lint/formato afectados y puros: 26 PASS; EXIT 0 |
| 23cf4a21-neon.log | 23cf4a21 | Unit-expand: 6 PASS y GETs: 6 PASS / 1 FAIL/0 skips; EXIT 1 por fixture inválida, 23514, ver debajo |
| 143af6c7-static.log | 143af6c74d887cc0b3e7c600d43fab06e554c436 | Merchant tipos/lint/formato de tests+handoff y puros: 27 PASS/0 skips; EXIT 0 |
| 143af6c7-neon.log | 143af6c7 | HTTP final: 7 PASS/0 skips, teardown completo; EXIT 0 |

Último comando DB: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env bash tools/neon-test.sh --no-file-parallelism src/modules/pos/server/measured-read.neon.integration.test.ts`. Logs incluyen SHA/comando/exit. Reutilización explícita: código db/domain sin cambios desde 648, guards sin nuevos paths ofensores; unit-expand sobre producto final 23cf pasó sus 6 casos. Última revisión 143 solo cambia tests/handoff. HTTP final cubre guard/scope/tenant/auth/no-store/unknownversion, catálogo mínimo/zero/null/unidades/revisión/local, legacy alto y borrado, mesa real/persistencia del tipo, abiertas vacías/voided, cierres con/sin cliente y descuento congelado, COP histórico y frecuencia distinta de cantidades.

El FAIL de 23cf no es de producto: la fixture intentó borrar financialSnapshot de una línea ya cerrada, y el trigger vigente rechazó con23514 `P1 line settlement is immutable`. Se conserva ese log; no se desactivó/bypasseó la barrera. Fixture corregida conserva ambas fuentes reales y fallback defensivo se cubre con settlement del núcleo financiero puro. Un intento prefreeze de Vitest con --project merchant falló por nombre inexistente; comando corregido desde apps/merchant pasó. No se atribuye PASS a esos intentos fallidos.

Límites: masa/precisión operativas siguen bloqueadas hasta CP2c; masa solo helper puro, sin filas POS imposibles ni activación V4. Sin browser/build/fullverify/M0/M1/3201/túnel/push/PROD. Wrapper advierte variable consumerCI ausente; las suites focales no usan ese rol y no se certifica su oráculo. Procesos propios finalizados: sesión HTTP terminó EXIT 0, ps acotado sin matches; CI liberable informado al coordinador tras teardown para CASO 11 del listado. Entrega limpia; autor retiene fixes hasta aceptación. QA independiente/factory/integración/cleanup corresponden al coordinador.
