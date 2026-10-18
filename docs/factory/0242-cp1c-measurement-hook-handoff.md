# 0242 CP1c.8 — entrega measurement-hook-0242

Base: `deb4f13171fcbc08bd73ad0e4906fe0d751627b7`. Código inicial: `70361885d85a7b76831b70611b3856b228834ab8`; revisión corregida: `61dca7448959a99b7cbf77b05644926fa7271171`. WT `/private/tmp/checkpass-pos-0242/measurement-hook-0242`, rama `measurement-hook-0242`. Node24.20.0, pnpm11.4.0, lockfile sin cambios, dependencias propias; configuración no heredada (solo `.env.example`). Commit posterior de este handoff no modifica producto ni tests.

## Resultado y scope

Se modifica solo metadata de `modules/route-table.ts` y aporte de `modules/server-registry.ts`. Nuevos `server/resource-measurement.ts` y prueba pura, más `modules/recipes/server/measurement-validator.ts` y suite Neon. Sin otros paths de producto.

El ensamblador consulta módulos activos del negocio con `change.tx`, filtra resourceType y recorre módulo por id ordenado/declaración; devuelve primer error y propaga excepciones. Pasa el objeto original completo y no omite `oldMeasure==newMeasure`. Solo importa el registro permitido, tipos puros/domain y DB; pruebas usan proveedores sintéticos.

Proveedor product: slot vigente recipes y puntero actual deben coincidir con resolución/revisión capturadas, negocio/producto/base. Valida componentes/revisiones capturados con expansión pura de una cantidad equivalente a su propia base (factor1). Nunca consulta receta/precio actuales. Unit solo unit; mass admite kg/lb/g sin reescribir base. Legacy recipe implica1unit. Ausencia verdadera devuelve null; referencias/base/componentes incoherentes lanzan excepción. No writes, pool/getDb ni transacción propia en código de producto.

## Evidencia reproducible

Desde el WT, prefijar comandos Node con `source ~/.nvm/nvm.sh && nvm use`.

- `pnpm exec vitest run apps/merchant/src/server/resource-measurement.test.ts`: **4PASS**, 0FAIL/0skip. Filtro tenant SQL/activo/resourceType, ausencia, misma identidad contexto/tx, old==new, orden del primer error, excepción proveedor/DB.
- `pnpm --filter @mi-pasaporte/domain typecheck`, `pnpm --filter @mi-pasaporte/db typecheck`, `pnpm --filter @mi-pasaporte/merchant typecheck`: **PASS**. Merchant repetido tras corregir inferencia discriminada de LineMeasure.
- `pnpm exec eslint` y `pnpm exec prettier --check` sobre los seis archivos TS: **PASS**; `git diff --check`: **PASS**. Lint/formato de suite Neon revalidados tras última mejora de fixtures.
- `pnpm exec vitest run apps/merchant/src/modules/modules-boundary.test.ts apps/merchant/src/modules/modules-boundary-between.test.ts apps/merchant/src/modules/modules-boundary-literals.test.ts apps/merchant/src/server/resource-measurement.test.ts`: **28PASS/2FAIL**, 0skip. Guardias solas24PASS/2FAIL. Backlog intacto: expenses immediate test→stock/count, y cinco archivos core adicionales en literales (`backoffice-context-controller`, `backoffice-context-refresh`, `checklist-context-resource`, `analytics/evaluation/policy-simulation`, `analytics/lifecycle/index`). Ningún nuevo offender del encargo; sin editar guardias. Log local `/private/tmp/checkpass-pos-0242/measurement-hook-guard.log`.

## CI real

CI transferida explícitamente por coordinador después del teardown y0procesos de recipes-events, exclusiva hasta teardown propio. No se ejecutó Neon ni wrapper antes de la transferencia. Comando:

```sh
source ~/.nvm/nvm.sh && nvm use
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/recipes/server/measurement-validator.neon.integration.test.ts --no-file-parallelism
```

Suite final6casos: unit rechaza mass y old==new incompatible; bases kg/lb/g aceptan las tres tarifas mass y rechazan unit; ausencia/tenant; legacy y referencias ajenas; inconsistencia slot/pointer/base/component; revisión con duplicados[A,A] frente a resolución con componentes válidos[A,B]. Snapshots conservan producto, IDs, slots, revisiones/resoluciones/base tras validación. Teardown borra ambos mundos y comprueba ausencia de negocio y usuario owner.

Corrida original sobre `70361885`: **1PASS/4FAIL**, duración55.71s (timeout5000ms en cuatro casos que omitían timeout explícito), sin skip; matriz mass con timeout120000 PASS. Teardown sin error comprobó ausencia de ambos negocios/owners. No se considera aceptación. Log preservado `/private/tmp/checkpass-pos-0242/measurement-hook-neon.log`.

QA temprano identificó una inconsistencia aceptable por DB que la búsqueda `.some` no distinguía: revisión[A,A] frente a resolución[A,B]. Coordinador autorizó descongelación acotada provider/test; `61dca744` exige unicidad de ambos lados y correspondencia biyectiva por recipeId/cantidad, añade negativo persistido con revisiones reales y asigna120000ms explícitos a cada caso remoto. Lint focal y tipos merchant PASS tras corrección. GitEPERM al guardar índice compartido se avisó inmediatamente y se resolvió con escalación acotada de add/commit de esos dos archivos.

R2 sobre `61dca744`: **6PASS/0FAIL/0skip**, exit0, duración92.64s (tests90.86s). Tiempos por caso: unit8.608s, matrizmass30.094s, ausencia/tenant6.570s, legacy6.073s, referencias23.522s, negativo duplicados12.078s. Teardown completado sin error y verificó ausencia de ambos negocios y usuarios owner; migracionesCI aplicadas por wrapper sin cambios nuevos de schema/journal. Se comprobó0procesos con CWD en este WT después de finalizar wrapper. Código/producto/tests siguen congelados en61dca744. Aviso wrapper: falta NEON_CI_CONSUMER_DATABASE_URL; la selección merchant no ejecuta oráculo de rol consumer y no tuvo skips. No se afirma cobertura consumer. Log `/private/tmp/checkpass-pos-0242/measurement-hook-neon-r2.log`.

## Límites y siguiente paso

No se conectan catálogo/importación, no adquisición de locks business-config/recurso, no certificación de carreras ni cambio real de modo. Inyección/locks juntos en CP2a. No schema/journal/V4/mass operativo, UI/build/browser/M0/M1 ni push/PROD. Coordinador realiza factory/QA nuevo/aceptación/integración. No inicia otro bloque en este contexto tras aceptación.
