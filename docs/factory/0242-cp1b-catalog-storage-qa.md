# 0242 CP1b.2 — QA independiente de almacenamiento de catálogo

Dictamen: **PASS de entrega y combinación focal** sobre candidato congelado `9f82f7501a338302424859c2edad9d1bf5ca4966`. Entrega `ad9df221a92154f072ce5eadfcadd6c0eef08026`, código `f41987712572651e39cf7bd3b8684b6958ff5c7e`, base `a389e1417225202f0b9649f69432531a6fc1abee`. QA en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, inicialmente limpio; único archivo escrito: este informe. Sin cambios de producto, tests, refs principales, estados o índices.

## Revisión de contrato y entrega

Leídos AGENTS, protocolos de trabajo/roles/verificación, ficha completa, handoff, anexo0242 y contratos/evidencia de lectores y cliente scope aceptados. Diff de implementación limitado a seis paths autorizados: schema, SQL0102, snapshot, journal, test CI y handoff.

SQL0102 amplía exclusivamente `core.product.unit_price/unit_cost` de numeric(12,2) a numeric(24,9). Drizzle conserva string y nullabilidad. Los dos CHECK no negativos anteriores quedan intactos; añade dos CHECK temporales null o valor <=9999999999.99 y valor = trunc(valor,2). Todo valor válido anterior es representable exactamente y cumple las barreras nuevas; 0 y null no se confunden. No cambia quantity, totales, pagos, medidas, revisiones, writers ni captura HTTP. Los writers catálogo/importación existentes siguen enviando string|null a DB y normalizando a centavos mediante parseOptionalMoney; su DTO legacy conserva number|null.

Comparación JSON recursiva del snapshot0101→0102: exactamente seis diferencias, id/prevId, dos tipos y dos checks de core.product; sin drift restante. prevId enlaza el id anterior. Journal conserva íntegramente sus entradas anteriores y añade únicamente0102; ningún SQL histórico cambiado. SQL SHA256 `6f31334e92856929b2bf0b783c3a0e512aaf76de39d29c92bdd60dd6256763fa`; journal actual `88bb66216c64c4abd7d8c03d3d98fc4a3c365890f2246c4c3bfcadcbb5f10d0b`.

## Evidencia reproducida

Node v24.20.0, pnpm11.4.0, Vitest4.0.18. Todos los comandos Node precedidos por `source ~/.nvm/nvm.sh && nvm use`. Lock SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; drizzle.config.ts `e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc`; merchant vitest.config.ts `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`; los tres sin cambios respecto de base/autor.

- `pnpm --filter @mi-pasaporte/db typecheck`, domain typecheck y merchant typecheck: EXIT0 los tres.
- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/pos/unit-expand-compat.test.ts src/modules/pos/server/lines.test.ts`: EXIT0, 46/46 PASS, dos archivos, 600ms.
- `pnpm exec eslint packages/db/src/schema/catalog.ts apps/merchant/src/server/catalog-storage-expand.neon.integration.test.ts`: EXIT0.
- `pnpm exec prettier --check packages/db/src/schema/catalog.ts apps/merchant/src/server/catalog-storage-expand.neon.integration.test.ts packages/db/drizzle/meta/_journal.json packages/db/drizzle/meta/0102_snapshot.json`: EXIT0.
- `git diff --check a389e141..HEAD`: EXIT0; comparación semántica JSON y preservación de journal: EXIT0.
- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/server/catalog-storage-expand.neon.integration.test.ts --no-file-parallelism`: EXIT0, 4/4 PASS, un archivo, 17.44s.
- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/unit-expand-compat.neon.integration.test.ts --no-file-parallelism`: EXIT0, 6/6 PASS, un archivo, 45.85s.

Todos los tests seleccionados pasaron al primer intento, cero skips/retries y cero fallos de producto/setup. Las invocaciones CI fueron secuenciales, exclusivamente mediante wrapper y env privado seleccionado, después de transferencia explícita del recurso exclusivo incluido teardown. El interlock antiPROD pasó y la sincronización de migraciones fue idempotente:0102 ya estaba aplicada por el autor. Aviso sobre URL consumer-role ausente; ese oráculo no se seleccionó ni se declara cubierto. No se imprimieron secretos ni se conectó PROD.

La suite nueva comprueba contra DB real el hash canónico0102 en drizzle.__drizzle_migrations y las dos columnas nullable numeric(24,9), además del retorno string. La prueba antes/después crea un esquema propio aleatorio y tabla mínima numeric(12,2) con constraints no negativos; inserta IDs propios, null,0 y máximo legacy en ambos campos. Ejecuta las cuatro sentencias canónicas mediante sustitución estricta únicamente del identificador cualificado de tabla, y verifica IDs/valores preservados con padding9. Esta capa aislada no retrocede DDL global y se complementa con la identidad/tipos canónicos reales.

En las columnas reales rechaza negativos, fuera de rango, fracciones no representables en centavos y NaN con23514; tras cada rechazo la fila permanece idéntica. Catálogo/POS proyectan máximo/0/null conforme contrato legacy; adición real de máximo×1 mantiene total y snapshot exactos. La suite de lectores sobre0102 confirma lectura/listado/edición de nota, INT32×0, rechazos de overflow y quantity HTTP string, rollback completo de cabecera/versión/líneas en dos ediciones inválidas, cierre0.30 con/sin pase (cupón0.10→neto0.20) y replay sin duplicar evento, core.order o redención. Eventos≤V3 conservan quantity number.

## Combinación, limpieza y límites

Comparación Git confirmó UI idéntica a cliente aceptado b0127037 y readers principales idénticos a8624cda8. Se reutiliza evidencia compatible de QA cliente7f9dce96:15 pruebas puras,16 browser y señal nativa con teardown. Almacenamiento mantiene el mismo DTO legacy; los checks SQL/lectores/tipos reproducidos cubren la interacción afectada. No se repitieron build/browser ni verify global por ceremonia.

Ambas suites usaron seedPosWorld propio y completaron teardown con aserciones de ausencia de business/owner/consumidores propios; la suite de almacenamiento también confirmó ausencia del esquema aleatorio. Cero fixtures persistentes y ningún servidor levantado. Inspección ps inicial bloqueada por sandbox (`operation not permitted`), notificada al coordinador; inspección escalada completada, sin vitest/drizzle/neon-test ni servidor de este worktree. lsof distinguió servidores preexistentes del checkout principal y central-hill ajeno; no se tocaron. Cero procesos propios pendientes; CI liberada al coordinador tras finalizar ambas suites.

PASS focal CP1b.2, sin hallazgos pendientes. Numeric(24,9) conserva coerción typmod PostgreSQL: las barreras restringen los valores almacenados; no constituyen parser de captura V2. No se certifica catálogoV2, precisión operativa nueva, mass, quantity/snapshots, V4, cutover, M0/M1, publicación ni producción. Las barreras temporales solo se retiran mediante migración posterior en activación CP2c compatible; no se implementó aquí la specV2.
