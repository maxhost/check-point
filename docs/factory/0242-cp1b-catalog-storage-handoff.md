# 0242 CP1b.2 — expansión física de tarifas

Base exacta: `a389e1417225202f0b9649f69432531a6fc1abee`; worktree `/private/tmp/checkpass-pos-0242/pos-data-0242`, rama `pos-data-0242`. Candidato de código congelado antes de CI: `f41987712572651e39cf7bd3b8684b6958ff5c7e`. La revisión final sólo añade esta evidencia documental; mismo árbol de código/SQL/config/lock. Sin push ni operación PROD.

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

## CI protegida y teardown completos

El coordinador transfirió explícitamente CI tras detener servidor B/teardown, antes de cualquier conexión de este autor. Ambas invocaciones usaron exclusivamente wrapper y env privado `/private/tmp/checkpass-pos-0242/private/ci.env`, DDL serial sin otro writer:

- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/server/catalog-storage-expand.neon.integration.test.ts --no-file-parallelism`: migración canónica0102 aplicada,4/4 tests PASS al primer intento,0skips, EXIT0 (16.39s).
- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/unit-expand-compat.neon.integration.test.ts --no-file-parallelism`: migración idempotente,6/6 tests PASS al primer intento,0skips, EXIT0 (43.83s), incluidos overflow, rollback de edición y cierre con/sin pase y replay.
- Merchant typecheck confirmado también después de los últimos ajustes del test: EXIT0.

Identidad real CI: journal0102 tiene el hash SQL SHA256 anterior (aserción contra drizzle.__drizzle_migrations por timestamp del journal generado); ambas columnas reales nullable numeric(24,9). Endpoint privado validado por interlock del wrapper; no se muestran credenciales ni se conecta PROD. Aviso del wrapper sobre URL consumer ausente: no afecta estas suites; no se ejecutó ni se afirma cubierto el oráculo de rol consumer. Ningún fallo de producto/setup, retry ni skip en las suites ejecutadas.

Test nuevo verifica hash canónico de0102 y tipos reales; crea esquema propio aleatorio catalog_expand_<UUID> con tabla anterior mínima y constraints no negativos. Inserta IDs propios con extremos/0/null; ejecuta exactamente las cuatro sentencias SQL cambiando exclusivamente el identificador cualificado core.product, sin retroceder DDL global. Compara IDs/valores antes y después con padding9. Adicionalmente prueba negativos/rango/no centavos en ambas columnas reales, persistencia sin mutación tras rechazo y lectura catálogo/POS/adición con precio máximo×1 legal. POS sigue omitiendo precio null y mostrando precio0 conforme contrato actual.

Fixture seedPosWorld propia; teardown dropPosWorld y borrado explícito del owner, aserciones negocio/owner ausentes y DROP del esquema propio. Sin fixtures persistentes/control/M0. Teardown completo verificado por ambas suites. Inventario OS mediante ps escalado tras terminar muestra sólo el propio ps/rg,0vitest/drizzle/servidores de este worktree; ningún servidor lanzado. Todos los comandos terminaron. CI liberable; no quedan fixtures ni esquema propios. El primer git add recibió EPERM de sandbox; escalación acotada permitió commit. La primera inspección ps sin escalación también fue bloqueada; inspección escalada final completada.

Límite: numeric(24,9) conserva semántica PostgreSQL de typmod; barrera impide valores almacenados fuera de centavos/rango legacy. Nuevas capturas precisas/mass siguen apagadas. No quantity/snapshots, V4 ni migraciónPROD. QA independiente pendiente sobre SHA congelado.
