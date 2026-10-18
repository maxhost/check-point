# 0242 CP1c.2 — QA independiente de almacenamiento Recetas

Veredicto: **PASS de esta entrega**, con dos fallos de guardias preexistentes identificados abajo; no se afirma PASS global. Candidato congelado `dcbc9f98035067f0e69484fdd8fb061d5573ea94`, entrega autor `285662df9f34ad4e0596618724a3d07fce49cfea`, código comprobado `3bfe68e60c6b47afb81e22c029a827430c1a6d9e`, base autor `86c5ad009e64b7a12e7088f482ed6d47c630f132`. Worktree/rama QA: `/private/tmp/checkpass-pos-0242/pos-qa-0242`, `pos-qa-0242`. Fecha: 2026-10-18. No se modificaron producto ni tests.

## Contrato y revisión independiente

Leídos AGENTS, TRABAJO-EN-PARALELO, AGENT-WORKFLOW, VERIFICACION, ficha/handoff, contrato0242 §4 y ADR0148 §3. El rango de entrega contiene solo descriptor, SQL0104, snapshot/journal, test nuevo y handoff. La combinación contiene el expansor puro ya aceptado; no conecta ningún writer V4, consumer medido ni runtime mass. Los archivos de almacenamiento/test son idénticos entre código autor y candidato QA.

Diff JSON recursivo0103→0104: además de `id/prevId`, únicamente tres tablas, once columnas y tres checks (dos añadidos y uno sustituido). Sin cambios en índices, FKs, otras columnas/tablas ni metadata restante. Journal append-only:105entradas, idx104, tag `0104_recipes_measurement_storage_expand`, when1792356040612. SQL canónico:15ALTER, sin DML/backfill ni cambios de JSON/IDs/referencias. Historia anterior intacta.

Descriptor/SQL conservan precisiones exact20,6, recipe30,3 y allocated14,3; bases numeric24,9 default1/unit/mass-si-1, positivas y acotadas, unit entera. V1 conserva positividad y exige cuatroNULL; V2 requiere ambos racionales completos como textos canónicos positivos y permite proyecciones0. Allocated permanece>=0 y ninguna proyección admiteNaN. Reducción y correspondencia matemática del racional quedan en helpers de aplicación futuros, como exige el contrato; no se inventa precisión histórica.

Revisión del fixture: recetas/revisiones/producto/insumo/resolución/evento/línea propios, mismo negocio; V4 raw existe solo en test y pasa decoder. Para1g/base1lb, composición.001 e ingrediente.001g, receta100/45359237 e insumo1/453592370 se persisten/releen como strings, ambas proyecciones0, allocated0 y sin movimiento. Negativas usan referencias coherentes y fallan por23514, no por FK accidental. Trigger inmutable probado en las tres tablas. Comparación de filas pre/post conserva todas las columnas antiguas, IDs y JSON; comparación de catálogo vivo conserva FKs/índices/triggers. Los clones usan columnas/checks0103 y sustitución estricta de identificadores de tabla del SQL canónico, sin rollbackDDL global.

## Evidencia reproducida

Node24.20.0, pnpm11.4.0, Vitest4.0.18, configuración merchant/setup con proveedorIAfake. CI exclusiva durante ejecución y teardown. Único env DB: `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env`; solo `tools/neon-test.sh`, sin local/PROD ni env copiados. Wrapper verificó huellas antiPROD, migración y entradasCI; la suite confirmó el hashSQL en `drizzle.__drizzle_migrations`. No se imprimieron secretos/PII. Falta URL del rolconsumer, cuyo oráculo no se ejecutó ni se afirma certificado.

Comando DB, tras `source ~/.nvm/nvm.sh && nvm use`:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/recipes/server/model/measurement-storage.neon.integration.test.ts --no-file-parallelism
```

Resultado QA: **3PASS/0FAIL/0SKIP**, exit0,54.28s (52.00s tests). Casos: migración canónica/historia/metadata; writer-consumer legacy real y bases; racionalesV2/proyecciones0/negativas. La equivalencia legacy es real: creación/publicación/consumidor actuales, dos deliveries aplicadas (recipes y core.analytics), fuenteV1 con cuatroNULL y un movimiento por venta. No se sustituyó por fixture decimal inventado. El teardown borra esquema privado, negocio y todos los owners y comprueba su ausencia; pasó. Log: `/private/tmp/checkpass-pos-0242/private/recipes-storage-qa-ci-dcbc9f98.log`.

El fallo inicial del autor está preservado en `recipes-storage-ci-a73cec07.log`:3FAIL/0PASS, esperado1delivery y observado2,38.70s. Inspeccionado ese log y la corrección: resultado exacto `{claimed:2,applied:2,pending:0,failed:0}` y comprobación de ambas deliveries. No se relajó almacenamiento ni se cuenta esa corrida comoPASS. La entrega corregida y la reproducción QA son evidencia separada.

Regresión pura focal, comando `pnpm --filter @mi-pasaporte/merchant exec vitest run` con `src/modules/recipes/server/model/{expand,expand-measured,preflight,schema-owner}.test.ts` y `src/modules/recipes/server/consumption-snapshot.test.ts`: **5suites/34PASS/0FAIL/0SKIP**, exit0,816ms. Log `recipes-storage-qa-legacy-unit-dcbc9f98.log`. No se ejecutaron suites legacyDB con aserciones delivery obsoletas; la suite nueva cubre writer/consumer real y teardown completo sin editar tests ajenos.

Tipos `@mi-pasaporte/db`, `@mi-pasaporte/domain`, `@mi-pasaporte/merchant`:PASS. ESLint descriptor/test:PASS. Prettier descriptor/test/snapshot0104/journal:PASS. `git diff --check`:PASS. Checks sobre el candidato exacto, sin build/browser/M0/M1 ni batería global por ceremonia.

Tres guardias con `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/modules-boundary.test.ts src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts`: **24PASS/2FAIL**, exit1,3.48s. Principal10PASS; between6PASS/1FAIL por `expenses/server/immediate.neon.integration.test.ts → stock/count.ts`; literals8PASS/1FAIL por cinco archivoscore: `backoffice-context-controller.test.ts`(3), `backoffice-context-refresh.test.ts`(1), `checklist-context-resource.test.ts`(1), `analytics/evaluation/policy-simulation.test.ts`(2), `analytics/lifecycle/index.ts`(1). Coinciden exactamente con backlog del handoff y están fuera del diff entregado: **cero nuevos offenders**. No se alteraron guardias. Log `recipes-storage-qa-guards-dcbc9f98.log`, mismo directorio privado.

## Identidad y cierre

SHA256 reproducidos, iguales al handoff:

| Artefacto | SHA256 |
| --- | --- |
| pnpm-lock.yaml | 4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821 |
| merchant/vitest.config.ts | 073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81 |
| merchant/vitest.setup.ts | 1e1dc6157e3f976c83c10ff5d740fbfba6cf6b9aaec2df59a301c495dba26f5f |
| db/drizzle.config.ts | e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc |
| SQL0104 | 3864ac582df786d573cfde7e0b76bf22097f51c3d2dfcd92319c8ec66d69d06a |
| fixture/test | c1954fe650859657b628346ba843a6bf792207af3973aab85fd10d4d15080d42 |

CI liberada al coordinador después del exit0/teardown. `lsof -nP -d cwd -Fpcn`, desde `/private/tmp`, filtrado por este worktree: **0procesos**. No servidores iniciados. `ps/pgrep` están restringidos por sandbox; lsof proporciona la comprobación observable de CWD. Aceptación/factory/integración y migración LOCAL protegida posterior corresponden al coordinador. No se operaron main refs, push ni PROD. Esta evidencia aprueba expansión de almacenamiento; no certifica activación V4, consumidor medido, costo completo ni rolconsumer.
