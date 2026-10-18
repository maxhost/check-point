# 0242 CP2a.3 — catálogo atómico y revisiones comerciales

Base: `9b462a7aec57ff13028fa172c96676f864bf89b2`. Rama/WT: `catalog-revisions-0242`, `/private/tmp/checkpass-pos-0242/catalog-revisions-0242`. Runtime Node24.20.0/pnpm11.4.0, dependencias propias/lockfile sin cambios, sin env heredado.

Writers legacy conservan firmas/DTO/validación monetaria. Header y enlaces en una transacción; validación tenant/categoría/locales y relectura bloqueada dentro de ella. Mutex `business-config/<businessId>` antes producto/import; delete mismo orden. Nuevos productos unit/revisión1; actualización incrementa una vez por cambio comercial real, comparando decimales sin floating point y conjuntos normalizados. Imagen/categoría/no-op no invalidan. Import estrictamente aditivo conserva relectura/accepted/replay/recuperación de categorías y limpieza aftercommit. Metadatos no se editan en update.

Preparación de imagen/proveedor/R2 fuera de tx; al releer se compara key/version observados, conflicto409 limpia solo prefijo preparado propio. Después de commit se limpia el prefijo anterior; esa limpieza no revierte el nuevo asset.

Test nuevo: create1; cambios comerciales/no-op/decimales padded/orden+duplicados/case locales; concurrencia de updates y enlaces; tenant/categoría/local ajenos; guard import abierto; rollback real de update/create posterior a header por trigger temporal; conflicto de imágenes con efectos R2 sustituidos; import concurrente accepted/replay, nuevos unit1 y reutilizados/omitidos intactos. Mass continúa bloqueado por0105. El trigger y función usan nombres UUID, esquema propio y filtro locationId+businessId de fixture exclusiva; autorización explícita root recibida antes de escribir DDL. `finally` y `afterAll` retiran DDL; teardown elimina negocios/owners.

## Verificación offline previa a CI

- Tipos domain/db/merchant: PASS (merchant repetido tras última edición de test).
- ESLint cuatro archivos TypeScript propios y Prettier: PASS; diff whitespace PASS.
- Puros catálogo/import-plan/import-price: 47PASS. Carga offline de suites revisions/import-guard:12SKIP esperados, sin evidencia DB.
- app-boundary/ui-guard-rules:23PASS; ui-guard74archivos sin aumentos.
- modules-boundary/literals:18PASS/1FAIL por los cinco archivos core de backlog declarados. Primera corrida entre-módulos:5PASS/2FAIL, uno de backlog expenses→stock/count y otro nuevo por fixture imageAction stock. Corregida esa fixture a replace/uploadId, conservando el mismo pipeline de preparación simulado; no se cambian guardias.

## CI en código congelado `90e491d0a9ba126c3270882178596e77b14eba94`

Wrapper selección5 suites, serial: EXIT1,25PASS/4FAIL/0SKIP; no se declara PASS global. Suite propia6PASS, catalog legacy7PASS, import-guard6PASS, import-write2PASS/3FAIL, import-write-races4PASS/1FAIL. Los cuatro fallos son aserciones legacy de escala2 contra almacenamiento numeric(24,9) de0102: write líneas113 (`3.25` vs `3.250000000`),186 (`1.00` vs `1.000000000`),243 (`5.00` vs `5.000000000`), races170 (`9.99` vs `9.990000000`). En esa corrida no se cambiaron tests fuera de scope; las aserciones posteriores al fallo no se alegan cubiertas. La suite propia compara escala9, filas completas y replay.

Suite propia6PASS observó incremento exacto/concurrencia, normalización decimales/locales, aislamiento, rollback real por señal controlada, conflicto imagen y prefijo propio, import nuevo/reutilizado/omitido. Su afterAll comprobó ausencia de owners/negocios/esquema; sin errores de teardown. DDL test retirada también en finally.

Tras corregir únicamente fixture de imagen en test, guardias completas24PASS/2FAIL exactamente backlog expenses→stock/count y5core literales, sin nuevos offenders. Suite propia repetida sobre `0e0d7d6c53e864c00f2928ddeb7e7cd3e8d49b02`:6PASS/0FAIL/0SKIP, EXIT0; trigger/esquema/owners/negocios retirados con aserciones y sin errores de teardown.

Root transfirió reserva exclusiva; selección propia únicamente por `tools/neon-test.sh --no-file-parallelism` y `/private/tmp/checkpass-pos-0242/private/ci.env`. Se compartirá SHA congelado antes de ejecutar. No afirmar PASS DB por skips. Sin publicación/push/PROD ni certificación de HTTPv2, mass, hooks/composición/publicación o carrera de inicio de import no asignada.


## Ampliación root para expectativas legacy

Root amplió reserva a `apps/merchant/src/server/catalog-import-write.neon.integration.test.ts` y `apps/merchant/src/server/catalog-import-write-races.neon.integration.test.ts` después de la primera corrida. Único cambio autorizado: seis expectativas SQL unitPrice exactas pasan de escala2 a escala9 de0102 (3.25,1250.00,1.00,3.00,5.00,9.99 conservan exactamente su valor). Sin cambiar inputs ni assertions tenant/concurrencia ni usar Number/comparación relajada. Sobre `620431e14b68ce97adbf0e58480291bd346046f7`, wrapper de solo esas dos suites:10PASS/0FAIL/0SKIP, EXIT0, sin errores de teardown. No se repitieron suites compatibles.


## Entrega final y reproducción

Identidades: producto en `90e491d0`; test propio corregido y6PASS en `0e0d7d6c`; expectativas legacy corregidas y10PASS en `620431e1`. El commit final posterior solo completa este handoff. Fuentes/runtime/config iguales en las comprobaciones reutilizadas; no hubo cambios de producto tras90e491d0. Los seis archivos TypeScript no incluyen cambios de schema/tooling/kit: tres fuentes (`packages/domain/src/server/catalog/products.ts`, `packages/domain/src/server/catalog/import-guard.ts`, `apps/merchant/src/server/catalog-import/write.ts`), nuevo test (`apps/merchant/src/modules/pos/server/catalog-revisions.neon.integration.test.ts`) más los dos tests legacy autorizados. Séptimo path: este handoff.

Comandos de DB, siempre Node24, env privado y reserva exclusiva:

```sh
source ~/.nvm/nvm.sh && nvm use
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/catalog-revisions.neon.integration.test.ts --no-file-parallelism
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/server/catalog-import-write.neon.integration.test.ts src/server/catalog-import-write-races.neon.integration.test.ts --no-file-parallelism
```

Se preservan primera corrida25PASS/4FAIL y skips offline12; no se presentan como una corrida integral verde. Evidencia compatible final: propia6PASS, catálogo7PASS, importguard6PASS, write/races10PASS. Estáticos y puros descritos arriba; guardias24PASS/2FAIL exactamente backlog declarado, sin nuevos offenders. Advertencia del wrapper: env sin rol consumer (no se seleccionó su suite; no se certifica ese rol). R2/proveedor sustituidos en tests, sin llamadas externas reales.

Tres wrappers terminados. Cero procesos con CWD en este worktree comprobado con ps/lsof, excluyendo únicamente inspectores y sus ancestros; ps requirió escalación de solo lectura por sandbox. No servidores/túneles propios ni sesiones creadas por estas fixtures. DDL transitoria/owners/negocios propios retirados; sin procesos/pools de pruebas vivos. No hubo push ni operaciónPROD. Retengo fixes y WT hasta aceptación; coordinador gestiona factory/QA/integración/retirada.
