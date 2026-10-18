# 0242 CP1c.2 — almacenamiento de base/procedencia racional

Base limpia confirmada: `86c5ad009e64b7a12e7088f482ed6d47c630f132`, worktree `/private/tmp/checkpass-pos-0242/pos-data-0242`, rama `pos-data-0242`. Implementación inicial `a73cec076f729fea92b95643710bd9cdf136d51c`; candidato corregido y congelado antes de CI `3bfe68e60c6b47afb81e22c029a827430c1a6d9e`. El commit posterior modifica únicamente este handoff; código, test y SQL conservan las identidades comprobadas.

## Alcance y contrato

Se modificaron únicamente el descriptor `packages/db/src/schema/modules/recipes-compositions.ts`, migración `0104_recipes_measurement_storage_expand.sql`, snapshot0104/journal, test nuevo `apps/merchant/src/modules/recipes/server/model/measurement-storage.neon.integration.test.ts` y este handoff. El coordinador confirmó el path real del test y autorizó el fixtureV4 raw dentro de él.

Bases capturadas default1/unit/mass-si-1, positivas hasta999999999.999999999, unit entera y unidades kg/lb/g. Procedencia defaultV1 conserva proyecciones positivas y cuatro null. V2 requiere cuatro strings enteros canónicos positivos y proyecciones>=0; allocated>=0, sin NaN. La reducción de fracciones corresponde a aplicación futura; DB no la inventa ni reconstruye desde proyecciones.

Migración generada con `pnpm --filter @mi-pasaporte/db exec drizzle-kit generate --name recipes_measurement_storage_expand` desde última entrada real0103. Journal observado105entradas, última idx104/tag0104/when1792356040612.15sentencias. JSONdiff semántico0103→0104: únicamente11columnas y3checks en `recipes.composition_revision`, `recipes.sale_resolution`, `recipes.consumption_source`; sin cambios a índices/FKs/triggers, tipos anteriores ni otras tablas. No se cargó el snapshot completo en contexto ni se editó historia.

No hay productoresV4, consumidores/lectores medidos, backfill, movimientos en migración, ni cambios de UI/auth/kit/tooling/deps/estados/índices. DB local y PROD no fueron usadas.

## Evidencia observable

Runtime Node24.20.0 y pnpm11.4.0. Vitest4.0.18, configuración merchant con proveedorIAfake obligatorio y claveOpenAI eliminada por setup. Todas las operacionesDB mediante `tools/neon-test.sh`, usando exclusivamente `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env` y `--no-file-parallelism`; reservaCI exclusiva también durante DDL/teardown. Wrapper confirmó huellas antiPROD, migración aplicada y entradasCI presentes; el test verificó el hashSQL canónico en `drizzle.__drizzle_migrations`. No se expusieron credenciales. La URL de rolconsumer no está configurada; esta suite no ejecuta ese oráculo.

ComandoDB de ambas revisiones:

```sh
source ~/.nvm/nvm.sh && nvm use
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/recipes/server/model/measurement-storage.neon.integration.test.ts --no-file-parallelism
```

- Primera ejecución sobre `a73cec07`:3FAIL/0PASS,38.70s. Error de fixture: esperaba1delivery aplicada y observó2 (Recetas y core.analytics). Teardown pasó. Log original preservado en `/private/tmp/checkpass-pos-0242/private/recipes-storage-ci-a73cec07.log`. No fue un fallo del esquema.
- Corrección en `3bfe68e6`: aserción exacta `{claimed:2,applied:2,pending:0,failed:0}` y comprobación explícita de ambas deliveries aplicadas; no se debilitó ninguna aserción de almacenamiento.
- Ejecución final sobre `3bfe68e6`:3PASS/0FAIL/0SKIP,54.23s (52.18s tests). Log `/private/tmp/checkpass-pos-0242/private/recipes-storage-ci-3bfe68e6.log`. La corrida anterior no cuenta comoPASS ni es un retry oculto.

Prueba1: verifica hash/journal, tipos/precisiones/defaults reales, clones privados pre0104 construidos desde columnas/checks del snapshot0103 y filas legacy propias coherentes, sustitución estricta de identificadores de tabla de la migración canónica; preserva IDs/JSON/cantidades y defaults históricos sin racional inventado. Sin rollbackDDL global ni filas ajenas. Captura/compara FKs/índices/triggers reales y exige el trigger inmutable de cada tabla.

Prueba2: writers y consumidor legacy reales, una procedencia y un movimiento por venta; defaults1unit en revisión/resolución yV1 con ratiosnull. Rechaza14bases/versiones inválidas entre ambas tablas; admite basesmass mínimas de9decimales; prueba inmutabilidad.

Prueba3: fixtureV4 raw solo de almacenamiento, validado por decoder y sin deliveries medidos.1g/base1lb, composición.001, ingrediente.001g: receta100/45359237 e insumo1/453592370. Ambos racionales completos se releen como strings exactos, ambas proyecciones0 y allocated0, sin movimiento para esa venta. Referencias a evento/línea/producto/insumo/receta/revisiones/composición/resolución reales y del mismo negocio.41rechazosV2/versiones/proyecciones/ratios (incluye cada campo parcial,0/negativo/ceros iniciales/signo/NaN/fracción/texto vacío) y6rechazosV1;61negativos de base/cantidades en total, más3rechazos por inmutabilidad. No se afirma costo completo ni ejecución de consumidor medido.

El `afterAll` propio elimina esquema privado, negocio y todos sus owners; verifica ausencia del esquema/negocio/owner. Las tres pruebas y ese teardown pasaron. No se ampliaron afterAll ajenos ni se ejecutaron suites legacy con limpieza incompleta.

## Estáticos y límites

Comandos ejecutados: `pnpm --filter @mi-pasaporte/db typecheck`, `pnpm --filter @mi-pasaporte/domain typecheck`, `pnpm --filter @mi-pasaporte/merchant typecheck`, `pnpm exec eslint` sobre descriptor/test, `pnpm exec prettier --check` sobre descriptor/test/snapshot0104/journal/handoff y `git diff --check`. TodosPASS. Tiposdb/domain sobre `a73cec07`, código de producto idéntico en `3bfe68e6`; merchant/lint/format/diff repetidos sobre `3bfe68e6`.

Guardias ejecutadas juntas con `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/modules-boundary.test.ts src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts`:24PASS/2FAIL sobre `a73cec07`, sin nuevos offenders. Principal10PASS; between6PASS/1FAIL por `expenses/server/immediate.neon.integration.test.ts → stock/count.ts`; literals8PASS/1FAIL por los cinco archivoscore ya identificados en base: backoffice-context-controller, backoffice-context-refresh, checklist-context-resource, analytics/evaluation/policy-simulation y analytics/lifecycle/index. Log `/private/tmp/checkpass-pos-0242/private/recipes-storage-guards-a73cec07.log`. El cambio posterior importa solo una tabla core adicional y ajusta aserciones, sin cambiar fronteras. No se tocaron guardias para aprobar ni se afirmaPASS global.

HuellasSHA256:

| Artefacto | SHA256 |
| --- | --- |
| pnpm-lock.yaml | 4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821 |
| merchant/vitest.config.ts | 073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81 |
| merchant/vitest.setup.ts | 1e1dc6157e3f976c83c10ff5d740fbfba6cf6b9aaec2df59a301c495dba26f5f |
| db/drizzle.config.ts | e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc |
| SQL0104 | 3864ac582df786d573cfde7e0b76bf22097f51c3d2dfcd92319c8ec66d69d06a |
| fixture/test final | c1954fe650859657b628346ba843a6bf792207af3973aab85fd10d4d15080d42 |

CI finalizada y liberada tras teardown. `lsof -nP -d cwd -Fpcn`, ejecutado desde `/private/tmp` al terminar:0procesos con CWD en este worktree. Ningún servidor iniciado. Git requirió escalación acotada para su gitdir compartido después deEPERM; se informó al coordinador y el auto-review autorizó los commits propios, sin bypass de hooks. Factory deliver/accept/integración corresponden al coordinador, QA nuevo pendiente. Root aplicará0104 en DB local protegida después dePASS y antes de integrar el descriptor. Publicación y producción siguen sin autorización.
