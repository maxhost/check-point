# 0242 CP1b.1 — entrega de lectores unit antes del expand

Base: `7c16236f79aae8716ee6d0fc395edcb1290475ac`. Implementación y tests congelados en `9074ad96f0628637d16b2d74bdf908dc50f8ebf7`; commit posterior solo añade este handoff. Worktree `/private/tmp/checkpass-pos-0242/pos-data-0242`, rama `pos-data-0242`. Sin push ni operación PROD.

## Cambio y alcance

Los adaptadores adicionales `trustedUnitQuantityNumber`, `trustedUnitLegacyPrice` y `trustedUnitLineCents` validan datos confiables DB antes de proyectar DTOv1. Admiten número anterior y string con padding hasta9dec, conservan cantidad positiva hastaINT32 y tarifa legacy numeric(12,2); la proyección v1 rechaza fracciones precisas incompatibles sin redondear. Los helpers CP0 que aceptan snapshots medidos precisos permanecen intactos. El Number de cantidad se aplica después de validar INT32; el Number de catálogo se aplica después de validar/formatear centavos compatibles, solo como proyección del DTO legacy existente.

Read/list/linesForClose y cantidades de purchaseShortcuts normalizan lecturas DB. Snapshots, línea y agregado se calculan exactamente en centavos BigInt y se validan contra numeric(12,2); buildDetailed no usa Number/toFixed en esa aritmética ni para su precio DB. parseMoney público mantiene su comportamiento HTTP anterior. Quantity HTTP conserva números enteros y ahora acota explícitamente INT32 antes de SQL, sin admitir strings/padding/exponentes nuevos. Cero sigue distinto de null.

Errores de precisión incompatible se convierten en CounterError409 `pos_client_upgrade_required`; overflow monetario en422 `invalid_amount`; validación quantity HTTP en422 `invalid_input`. MeasureError no escapa por las superficies modificadas. JSON financiero histórico, selección de descuentos y eventos V1–V3 conservan sus formas.

El coordinador autorizó durante implementación ampliar únicamente el bloque updatePosOrder para validar el total exacto del merge dentro de su transacción, antes de persistir líneas. La cabecera/version ya actualizada revierte con el error. Dos negativos reales comprueban igualdad SQL completa de cabecera y líneas tras overflow por aumentar cantidad existente y por combinar línea existente con nueva.

Archivos: `packages/domain/src/measures/legacy.ts`; `apps/merchant/src/modules/pos/server/{read,list,orders,lines,lines.test}.ts`; `apps/merchant/src/server/counter/{grant-input,resolve-catalog}.ts`; pruebas nuevas `apps/merchant/src/modules/pos/unit-expand-compat.test.ts` y `apps/merchant/src/modules/pos/server/unit-expand-compat.neon.integration.test.ts`. No schema/DDL/migraciones/journal, writers string, V4, masa operativa, UI, auth, kit, tooling, dependencias ni estados/índices comunes.

## Evidencia reproducible

Ejecución sobre el contenido exacto del commit de implementación indicado; runtime Node v24.20.0 (`source ~/.nvm/nvm.sh && nvm use`), pnpm11.4.0, Vitest4.0.18. Config merchant existente `apps/merchant/vitest.config.ts`, entorno Node y setup existente. Sin cambios de lock/config/esquema.

Identidades SHA256:

- `pnpm-lock.yaml`: `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`.
- `apps/merchant/vitest.config.ts`: `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`.
- `packages/db/drizzle/meta/_journal.json`: `d55e693032f1dc4a0ead296946f2ca81f4ece58af5433dc576f573bbb7935225`; última entrada `0101_analytics_inbox_lifecycle`.

Comandos y resultados:

- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/pos/unit-expand-compat.test.ts src/modules/pos/server/lines.test.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts`: EXIT0,101/101,4archivos;28compatibilidad nuevos,18lines,43measure-contract y12financial. Sin skips/retries. Corrida inicial96/96 antes de añadir5negativos HTTP merge; ambas verdes.
- `pnpm --filter @mi-pasaporte/merchant typecheck` y `pnpm --filter @mi-pasaporte/domain typecheck`: EXIT0. Merchant se repitió después de añadir la suiteCI y la validación transaccional, EXIT0.
- `pnpm exec eslint` sobre los diez archivos TS de entrega: EXIT0. `pnpm exec prettier --check` sobre esos archivos: EXIT0; `git diff --check`: EXIT0.
- `node tools/check-numbers.ts`: EXIT0, sin duplicados; warning MODULE_TYPELESS_PACKAGE_JSON preexistente. Un intento informativo `node tools/factory.ts --help` respondió `Unknown task`/EXIT1; no mutó registro ni es check de producto.
- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/unit-expand-compat.neon.integration.test.ts --no-file-parallelism`: EXIT0,6/6,1archivo, sin skips/retries;46,50s en Vitest. Wrapper protegido comprobó endpoint noPROD y migró CI idempotentemente antes de ejecutar. Aviso de URL consumer-role ausente: esa suite/oráculo no se seleccionó, no se declaró cubierto.

CI `db:ci-integration` estuvo reservada exclusivamente hasta finalizar teardown. Schema fuente actual: quantity integer y tarifa snapshot numeric(12,2), sin cambios de esta entrega. Para formato futuro, SELECT SQL numeric(24,9)::text devolvió padding9, máximoINT32, máximo legacy, cero y fracción nueva, pasados por los mismos adaptadores de producción; ningún ALTER temporal.

Fixture propia `seedPosWorld("CP1b unit readers")`, identificadores aleatorios, sin tocar fixturesM0. Los seis casos prueban proyección SQL futura; lectura/listado/nota con precio máximo y quantity máxima a precio0; negativos reales de creación por overflow de línea/agregado y string HTTP; rollback de edición; cierres exactos0.30 con y sin pase, cupón0.10 con neto0.20, replay sin duplicar evento/orden/redención, forma quantity number de evento≤V3 y purchaseShortcuts con cantidad entera. Precio máximo×cantidad máxima se rechaza por overflow en pruebas puras, sin intentar persistirlo como importe legal.

Teardown completo: dropPosWorld seguido de borrado explícito de consumidores propios y owner que el helper deja; aserciones finales consultan y verifican ausencia de business, owner y consumidores. No se imprimieron secretos, cookies, QR ni PII. No hubo fallos de aserción de producto ni tests reintentados u omitidos. Lecturas exploratorias de dos nombres inexistentes de tests/support fallaron antes de localizar los archivos reales; no se usan como evidencia.

## Límites y continuación

Sin servidores ni procesos persistentes. lsof posterior aCI solo encontró los procesos transitorios del propio chequeo (shell/Python/lsof), finalizados. Coordinador fue avisado para transferir CI después del teardown; no hay más uso DB previsto por este worker.

No certifica cambio Drizzle ni antes/después del DDL, consumidores medidos, catálogoV2, masa/V4, cutover, UI/browser, producción ni gates globales de publicación. SQL casting acredita únicamente el adaptador de lectura futuro con esquema actual. QA independiente nueva corresponde sobre candidato congelado; esta entrega no se autoacepta ni inicia el siguiente checkpoint.
