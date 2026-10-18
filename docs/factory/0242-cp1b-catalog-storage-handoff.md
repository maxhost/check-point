# 0242 CP1b.2 — expansión física de tarifas

Base exacta: `a389e1417225202f0b9649f69432531a6fc1abee`; worktree `/private/tmp/checkpass-pos-0242/pos-data-0242`, rama `pos-data-0242`. Candidato offline: commit de implementación inmediatamente anterior a la evidencia CI final; SHA se fija antes de conectar. Sin push ni operación PROD.

## Alcance

`catalog.ts`: exclusivamente unit_price/unit_cost numeric(24,9), conservando modo string Drizzle y checks no negativos. `0102_catalog_legacy_storage_expand.sql` generado desde journal real0101 añade barreras temporales `product_unit_{price,cost}_legacy_check`: null o valor <=9999999999.99 y exactamente igual a trunc(valor,2). No activan precisión operativa nueva; conservan todo valor legacy válido, 0 y null. Ningún campo/modo/unidad/revisión, writer comercial o quantity cambia.

Generación offline con `env -u DATABASE_URL -u DATABASE_URL_UNPOOLED pnpm --filter @mi-pasaporte/db db:generate --name catalog_legacy_storage_expand`; config existente sin cambios, sin conexiones DB. JSONdiff 0101→0102 muestra únicamente dos tipos y dos constraints de core.product, además de id/prevId de snapshot. SQL SHA256 `6f31334e92856929b2bf0b783c3a0e512aaf76de39d29c92bdd60dd6256763fa`.

Writer actual: tipos DB/precios de catálogo e importación son string|null; catálogo normaliza a centavos con parseOptionalMoney y mantiene su DTO público number|null; importación conserva PlannedProduct.unitPrice string|null. No se modifica captura pública legacy ni se habilita catálogoV2. La barrera DB protege todos los writers.

## Verificación offline

Node24.20.0, pnpm11.4.0, Vitest4.0.18. Lock SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; drizzle.config.ts `e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc`; merchant vitest.config.ts `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`.

- `pnpm --filter @mi-pasaporte/db typecheck`, domain typecheck y merchant typecheck: EXIT0.
- ESLint focal de schema y test nuevo: EXIT0.
- Prettier focal schema/test/journal/snapshot y `git diff --check`: EXIT0.
- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/pos/unit-expand-compat.test.ts src/modules/pos/server/lines.test.ts`: 2 archivos,46 tests PASS,0 skips.

## CI pendiente de transferencia explícita

No conexión CI ni DDL ejecutados mientras B cliente posee CI/servidor. Comando previsto, después de transferencia y freeze: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/server/catalog-storage-expand.neon.integration.test.ts --no-file-parallelism`. Suite lectores existente puede reutilizarse sobre schema migrado por wrapper en invocación serial.

Test nuevo verifica hash canónico de0102 y tipos reales; crea esquema propio aleatorio catalog_expand_<UUID> con tabla anterior mínima y constraints no negativos. Inserta IDs propios con extremos/0/null; ejecuta exactamente las cuatro sentencias SQL cambiando exclusivamente el identificador cualificado core.product, sin retroceder DDL global. Compara IDs/valores antes y después con padding9. Adicionalmente prueba negativos/rango/no centavos en ambas columnas reales, persistencia sin mutación tras rechazo y lectura catálogo/POS/adición con precio máximo×1 legal. POS sigue omitiendo precio null y mostrando precio0 conforme contrato actual.

Fixture seedPosWorld propia; teardown dropPosWorld y borrado explícito del owner, aserciones negocio/owner ausentes y DROP del esquema propio. Sin fixtures persistentes/control/M0. Estado actual: no procesos propios vivos; ningún servidor lanzado. CI y teardown todavía pendientes, no se afirma PASS de integración.

Límite: numeric(24,9) conserva semántica PostgreSQL de typmod; barrera impide valores almacenados fuera de centavos/rango legacy. Nuevas capturas precisas/mass siguen apagadas. No quantity/snapshots, V4 ni migraciónPROD. QA independiente pendiente sobre SHA congelado.
