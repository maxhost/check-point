# 0242 CP1b.1 — QA independiente de lectores unit

Dictamen: **PASS** de entrega y combinación focal sobre candidato congelado `0cf6d209851749cadb87f7e7a841d8c6fd927624`, base documental `746099975f633e4b6b8f4ff3c5148c6142073f91`. Código `9074ad96f0628637d16b2d74bdf908dc50f8ebf7`, entrega `8624cda80e74d24761a3f8be2d42eddcd91fb2c2`. QA en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, inicialmente limpio; no se modificó producto ni tests.

## Revisión y aceptación

Leídos contrato completo y ampliación transaccional, protocolos, anexo0242 de exactitud/compatibilidad y helpers financial/measures. Diff limitado a los diez TS autorizados y handoff; sin cambios de schema, migraciones, writers string, DTO unit, auth/scope, UI, dependencias o productores V4. Los contratos financial y scope servidor aceptados se conservan; la combinación ejercitada cubre lectura, edición, cierre, cupón y reintento reales.

- Adaptadores confiables DB admiten number previo y string padding9; comprueban entero positivo INT32 antes de convertir cantidad a number. Tarifa legacy12,2 se valida/formatea en centavos exactos, con rechazo explícito de fracción incompatible. No hay BigInt directo de string decimal ni Number/toFixed monetario nuevo; Number de catálogo es proyección legacy posterior a validación.
- Precio0 y null conservan caminos distintos. INT32 máximo×0 y tarifa9999999999.99×1 son legales; fracción, exponente, escala excesiva y overflow se rechazan. HTTP quantity sigue admitiendo solo number entero positivo dentro de INT32; los formatos DB string no amplían su captura. parseMoney público conserva su contrato anterior.
- `updatePosOrder` valida el merge completo con precios snapshot leídos dentro de la misma transacción, antes de escribir líneas. Dos negativos reales devolvieron422 `invalid_amount`: aumento de cantidad existente y combinación con línea nueva. En ambos, comparación SQL completa de cabecera (incluida versión) y líneas contra el estado previo fue idéntica; el UPDATE previo de cabecera revierte.
- Cierres con/sin pase conservaron0.30 exactos; cupón0.10 produjo neto0.20. Reintento no duplicó evento, core.order ni redención; quantity siguió number en eventos≤V3 y purchaseShortcuts. Lectura/listado/edición de nota mantuvieron snapshots legacy extremos.

## Evidencia reproducida por QA

Node v24.20.0, pnpm11.4.0, Vitest4.0.18, configuración merchant existente. Identidades SHA256 coinciden con autor: lock `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; vitest merchant `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`; journal `d55e693032f1dc4a0ead296946f2ca81f4ece58af5433dc576f573bbb7935225` (0101). Se reutilizan lint/formato y tipos domain del autor, compatibles por identidad de candidato/configuración.

- `source ~/.nvm/nvm.sh && nvm use && pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/pos/unit-expand-compat.test.ts src/modules/pos/server/lines.test.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts`: EXIT0,101/101,4archivos,611ms, sin skips/retries.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: EXIT0.
- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/unit-expand-compat.neon.integration.test.ts --no-file-parallelism`: EXIT0,6/6,1archivo,43.94s, sin skips/retries. Exclusividad CI transferida expresamente por coordinador. Wrapper antiPROD y sincronización idempotente de migraciones PASS; sin DDL de la entrega ni ALTER temporal. Aviso de URL consumer-role ausente: ese oráculo no se seleccionó y no se declara cubierto.
- `git diff --check 74609997..HEAD`: EXIT0. Revisión estática del diff y contratos sin hallazgos.

Fixture propia `seedPosWorld("CP1b unit readers")`; SQL numeric(24,9)::text se pasó a los mismos adaptadores sin cambiar schema actual integer/numeric12,2. Teardown completo verificó ausencia de business, owner y consumidores propios. No se usó M0. Tras CI, lsof solo encontró Python/lsof transitorios del propio chequeo; cero procesos persistentes y recurso liberado al coordinador inmediatamente. No se imprimieron secretos. Una lectura exploratoria de un nombre inexistente `close-financial.ts` falló antes de leer el cierre real; no es evidencia de producto.

## Límites

PASS focal de este candidato y alcance CP1b.1. No certifica cambio Drizzle/DDL real ni prueba antes/después del expand, writers futuros, catálogoV2, masa/V4, cutover, UI/browser, scope cliente pendiente, M0, publicación o producción. No se ejecutó verify global por no aportar señal proporcional. Sin hallazgos ni pendientes de corrección dentro del encargo; sin push ni operación PROD.
