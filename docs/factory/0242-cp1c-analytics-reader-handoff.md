# 0242 CP1c.5 — Reader analytics exacto y segmentos SQL

- Task/rama: `pos-recipes-exact-0242`; ficha `0242-cp1c-analytics-reader.md`.
- WT: `/private/tmp/checkpass-pos-0242/pos-recipes-exact-0242`.
- Base confirmada limpia: `cf5db4a9f1a5138e42857a40fc2e77c33e265a8e`.
- Código congelado: `9b62b86ce0d16e668c340eb494a28f1195c7830c`.
- Archivos: `queries/index.ts`, `queries/quantity-exact.test.ts`, `queries/monthly-finance.neon.integration.test.ts`, `evaluation/snapshot-equivalence.test-support.ts` y este handoff, dentro del directorio analytics merchant salvo el documento.

## Comportamiento

El decoder conserva `quantityExact` desde la cadena SQL antes de convertir la proyección `quantity` a Number. Para representaciones legacy numéricas solo construye cadena desde enteros seguros; fracciones, unsafe, NaN/infinito y valores ausentes no reciben exactitud inventada. No pasa agregados ni gramos14dec por parsers de captura. Flat/grouped conservan todas las tuplas y su orden; agrupaciones malformadas siguen rechazándose. Los select adicionales de `readDay` e histórico customer/promo también piden `quantity::text` al usar el mismo decoder.

Las allowlists de SELECT/GROUP BY reference/extended conservan local para `mass_sold_g` y `mass_with_cost_g`. Sin cambios en ventanas, unions, cantidad de roundtrips ni same-weekday discreto. Producto/día/local/currency/minorUnit siguen en GROUP BY. El oráculo portable aplica únicamente las mismas allowlists mass y verifica además la cadena exacta en su comparación de bolsas de filas; no relaja equivalencia ni oculta divergencias.

Las métricas nuevas del fixture son sintéticas sobre tablas actuales. No hay productores/traductores/eventos nuevos, migración ni activación de V4.

## Evidencia pura

Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`; lockfile intacto blob `abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`; hooks `.githooks`. Todos los comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use &&` en el WT.

Sobre el contenido del código congelado:

- Decoder12/12 y consumidores53/53 PASS; `tools/app-boundary.test.ts`4/4 PASS: total69/69, cero retries/skips/fallos.
- Tipos domain y merchant PASS exit0.
- ESLint de los cuatro archivos de código, Prettier y `git diff --check` PASS. Un intento inicial de formato detectó el test nuevo; se formateó y repitió correctamente antes del commit, sin cambiar semántica.
- La guardia ejecutada es específicamente `tools/app-boundary.test.ts`, no todas las guardias de módulos. El coordinador informa backlog ajeno conocido de dos guardias (between expenses→stock y cinco core literals); no se ejecutaron ni se declaran verdes aquí.

```sh
pnpm exec vitest run apps/merchant/src/server/analytics/queries/quantity-exact.test.ts apps/merchant/src/server/analytics/summary.test.ts apps/merchant/src/server/analytics/evaluation/domain.test.ts apps/merchant/src/server/analytics/evaluation/policy.test.ts apps/merchant/src/server/analytics/evaluation/policy-simulation.test.ts tools/app-boundary.test.ts
pnpm --filter @mi-pasaporte/domain typecheck
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec eslint apps/merchant/src/server/analytics/queries/{index.ts,quantity-exact.test.ts,monthly-finance.neon.integration.test.ts} apps/merchant/src/server/analytics/evaluation/snapshot-equivalence.test-support.ts
pnpm exec prettier --check apps/merchant/src/server/analytics/queries/{index.ts,quantity-exact.test.ts,monthly-finance.neon.integration.test.ts} apps/merchant/src/server/analytics/evaluation/snapshot-equivalence.test-support.ts
git diff --check
```

## CI protegida focal

Recurso exclusivo transferido explícitamente por el coordinador después de cerrar la corrida/teardown del otro autor. Ambas invocaciones se ejecutaron serialmente sobre el código congelado, con el wrapper/env privado autorizado y sin paralelismo entre archivos:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/server/analytics/queries/monthly-finance.neon.integration.test.ts --no-file-parallelism
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/server/analytics/evaluation/evaluation.neon.integration.test.ts --no-file-parallelism -t 'bounded windows retain|preserves complete snapshots and card ordering'
```

Resultados reales: monthly4/4 PASS (dos históricos y dos nuevos), exit0,12.84s; evaluación2 PASS/7 skipped por filtro deliberado, exit0,7.24s. Ningún fallo/retry; no se certifica la suite completa de evaluación. Los dos casos seleccionados usan solo beforeAll y siembras propias, sin depender de writes de los otros siete it excluidos. Los asserts reales de equivalencia se ejecutaron para los scopes todos/local.

Logs reproducibles de esta ejecución local: `/private/tmp/0242-analytics-reader-monthly.log` y `/private/tmp/0242-analytics-reader-evaluation.log`, inicios16:14:52 y16:15:11 del18oct2026, respectivamente. El wrapper verificó ambos URLs CI y aplicó/verificó migraciones con éxito. Avisó ausencia de `NEON_CI_CONSUMER_DATABASE_URL`; no se seleccionó el oráculo de rol consumidor, por lo que no se afirma cubrirlo. No se leyeron/copiaron envPROD ni se usó DB fuera del wrapper.

Ambos afterAll terminaron sin error: `limpiarNegocios` borra las raíces de negocio y luego los owners; los FKs/cascadas actuales retiran los fixtures asociados. No hubo error de teardown ni proceso persistente. No se ejecutó consulta posterior independiente de conteo de huérfanos.

Fixture exacto: contribución mixta completa, discrepancia14dec sub-Number, excedente mass frente a déficit unit, negativos producto/día/local, dinero MXN/minorUnit0 que no cubre USD2; bordes0/1/28/29/45 incluidos una vez,46 excluido y49 same-weekday solo unidades. Oráculo snapshots ambos scopes más histórico unit/HTTP existentes. Teardown por `limpiarNegocios` borra negocio agregado y owner; suites sin servidor persistente.

## Límites y entrega

Sin build/browser/M0/M1, fullverify, nuevas mediciones de latencia, UI/auth/kit/tooling/deps, dominio financiero/schema/journal/ingestion/traductores, estados/índices, push ni PROD. Factory/QA/aceptación/integración quedan al coordinador. No se modificó fixture de shape fuera de scope.

Git add inicial falló por sandbox con `index.lock: Operation not permitted`; se avisó inmediatamente al coordinador y se resolvió con escalación limitada a add/commit de los cuatro paths propios. Sin bypass de hooks. Las dos sesiones de CI terminaron (exit0) y `lsof -a -d cwd -Fpcn | rg -B 2 -F /private/tmp/checkpass-pos-0242/pos-recipes-exact-0242`, ejecutado desde el checkout principal, no encontró procesos (rg exit1 sin matches). Se notificó cierre/teardown/cero procesos al coordinador antes de liberar CI. Sin más operaciones DB del autor. Pendiente QA independiente final y aceptación/integración por coordinador; no iniciar siguiente bloque en este contexto.

El commit final de esta entrega contiene solo este handoff además del commit de código citado. Las comprobaciones corresponden al mismo árbol de producto: ninguna modificación de código después de congelarlo.
