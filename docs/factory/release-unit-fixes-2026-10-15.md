# Entrega release-unit-fixes-20261015

- Base `main`: `f8358c904809050624e831ed155ab33e91a13f46`.
- Commit de tests comprobado: `b26182c57b76df0d52a791d359a88f9333323d7e`.
- Rama/worktree: `factory-release-fixes-20261015`, `/private/tmp/checkpass-release-fixes-20261015/factory-release-fixes-20261015`.

## Correcciones

El ensayo del hook de publicación encontró dos expectativas obsoletas, documentadas en `/private/tmp/checkpass-release-20261015/dry-run.log:1143`. Se corrigieron únicamente los dos tests asignados; ningún archivo de producto cambió.

- `apps/merchant/src/server/staff.test.ts`: el doble DB anterior exportaba solo `getDb`, aunque SPEC0231 trasladó `setStaffStatus` a una transacción con mantenimiento de identidad. Ahora exporta `withDbTransaction` y admite el lock `KEY SHARE` del negocio existente y el lookup de membresía sin resultados. Se ejecutan el writer y el helper de identidad reales, sin mockearlos. Se mantiene el 404 para integrante ajeno/inexistente, se exige además `staff_not_found` y se comprueba una transacción, el lock y ausencia de `insert`, `update` o `delete`. Las validaciones 400 siguen comprobadas y deben rechazar antes de abrir una transacción.
- `apps/merchant/src/modules/recipes/server/routes.test.ts`: se reemplaza la expectativa de navegación vacía por el contrato exacto restaurado por decisión del owner: `[{path:"",label:"Recetas",icon:"Book",permission:"recipes"}]`. Se actualiza el título del caso y se conservan las aserciones de locales, dependencia Stock y los restantes casos R1.

No se suprimieron casos ni se relajaron aserciones. No hubo cambios de backend, UI, esquema, migraciones, datos, permisos o reglas funcionales.

## Evidencia

En este worktree y sobre el contenido del commit de tests indicado, Node `v24.20.0`. Cada comando Node precedido de `source ~/.nvm/nvm.sh && nvm use`.

- `pnpm exec vitest run apps/merchant/src/server/staff.test.ts apps/merchant/src/modules/recipes/server/routes.test.ts`: 2 archivos, 25 tests PASS (3 Staff + 22 Recetas), sin skips ni retries.
- `pnpm exec eslint apps/merchant/src/server/staff.test.ts apps/merchant/src/modules/recipes/server/routes.test.ts`: exit 0.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: exit 0.
- Prettier de ambos tests y `git diff --check`: correctos.

El doble DB no accede a una base real. No se ejecutaron DB/Neon, browser, build o verify global en este worktree. La validación completa del hook de publicación corresponde al coordinador y no se declara aprobada por estos checks focales.

Sin servidores o procesos persistentes propios; sin push ni merge. Este handoff se añade después del commit de tests comprobado. Siguiente paso: revisión independiente del candidato congelado e integración por el coordinador antes de repetir la señal global afectada para publicación.

## Continuación: expectativas Neon del registro de módulos

Base actualizada por el coordinador a `05cf722ea1a4a0f9e88e9b0b5dfaf1d321b5a3a4`, con la entrega anterior integrada. Nuevos fallos globales observados en el mismo log del ensayo de publicación, líneas 2426 y 2441. Scope ampliado únicamente a los dos tests siguientes y este handoff; sin cambios de producto.

- `modules-fk.neon.integration.test.ts`: el piso exacto sigue comprobando esquemas y tablas, actualizado a POS7 y Rentabilidad5. Evidencia versionada: 0079 trasladó las cuatro tablas POS originales, 0091 añade `order_payment`, `payment_method_initialization` y `payment_method`; 0086 creó las tres tablas `fixed_cost*` de Rentabilidad y 0091 añade `commission_revision` y `payment_commission`. `profitability` consta en `modules/registry.ts`, por lo que es esquema de módulo, no core. No se alteraron la consulta de FKs ni el control que crea una FK core→stock dentro de una transacción revertida.
- `modules-registry.neon.integration.test.ts`: el contrato esperado de `GET /api/modules` conserva la comparación exacta de los cinco módulos y se actualizan únicamente tres textos aprobados en los manifiestos actuales: descripción de Recetas, descripción de su permiso y descripción de Rentabilidad. Las demás comprobaciones de permisos, apagado, dependencias y aislamiento permanecen intactas.

No se accedió a CI ni se ejecutaron estas suites Neon durante esta continuación: la DB seguía reservada por el coordinador para la corrida global. La revisión de SQL/manifiestos explica el ajuste, pero no se presenta como PASS DB. La ejecución focal DB queda pendiente de liberar CI/asignación del coordinador.

Checks de esta revisión con Node `v24.20.0`, precedidos de `source ~/.nvm/nvm.sh && nvm use`: `pnpm exec eslint apps/merchant/src/modules/modules-fk.neon.integration.test.ts apps/merchant/src/modules/modules-registry.neon.integration.test.ts` y `pnpm --filter @mi-pasaporte/merchant typecheck`, ambos exit 0; `git diff --check` correcto. Sin skips/retries presentados como evidencia DB y sin repetir la batería global.

## Continuación: tres fixtures Neon y cierre del foco DB

Base actualizada por el coordinador a `c0d71c12a296f6b416681b94364b65b3a10af8b5`, con la revisión anterior integrada. Commit de las tres fixtures comprobadas: `5b949c19b58ace5f03c7815caed643220478f519`. El log global original conserva las causas: cleanup `23503 staff_person_membership_fk`, ranking con tres productos en vez de dos y delivery `applied:2` en vez de `1`. No se alteró ningún comportamiento de producto, límite, retry ni oráculo original.

- `server/onboarding-checklist.neon.integration.test.ts`: SPEC0231 crea una persona enlazada a la membresía del integrante. El teardown ahora elimina las personas **del negocio sintético propio** antes de sus membresías/usuarios; conserva los once casos originales y termina sin la infracción de FK. No se cambió la constraint ni el writer.
- `modules/pos/server/pos-best-sellers.neon.integration.test.ts`: la fixture usaba `locationId:null` como si representara otro local, pero el trigger `pos_legacy_location` de 0083 lo asigna al único local activo. Ahora crea un segundo local real del mismo comercio, asigna allí la orden excluida y comprueba esa asignación. El ranking exacto de dos productos y los restantes controles permanecen intactos.
- `modules/recipes/server/consumption-cost.neon.integration.test.ts`: ambos UPDATE de claim/release se limitan al delivery `subscriberId='recipes'` del evento. Antes también reactivaban el delivery `profitability` que debía seguir skipped, provocando dos aplicaciones. Se conserva `applied:1` y la valoración COP de cero completo; se añade comprobación de que Rentabilidad permanece skipped.

El coordinador transfirió el recurso CI a esta tarea tras terminar el foco Stock del otro worker. Se ejecutó **una sola corrida focal**, sin cambios de fuentes mientras corría, usando `NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env`, el wrapper protegido y `--no-file-parallelism`:

```sh
source ~/.nvm/nvm.sh && nvm use
NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh \
  src/modules/modules-fk.neon.integration.test.ts \
  src/modules/modules-registry.neon.integration.test.ts \
  src/server/onboarding-checklist.neon.integration.test.ts \
  src/modules/pos/server/pos-best-sellers.neon.integration.test.ts \
  src/modules/recipes/server/consumption-cost.neon.integration.test.ts \
  --no-file-parallelism
```

Node `v24.20.0`. Wrapper/migración CI exit 0; **5 archivos, 28 tests PASS, sin skips ni retries**, duración 162,05 s: Onboarding11, costo congelado5, registro7, ranking2 y FK3. Incluye los controles positivos de FK y cierra la validación DB pendiente de la continuación anterior. Salida saneada, con URLs PostgreSQL redactadas y `pipefail`, en `/private/tmp/checkpass-release-fixes-neon-focused-20261015.log`.

También `pnpm exec eslint apps/merchant/src/server/onboarding-checklist.neon.integration.test.ts apps/merchant/src/modules/pos/server/pos-best-sellers.neon.integration.test.ts apps/merchant/src/modules/recipes/server/consumption-cost.neon.integration.test.ts` y `pnpm --filter @mi-pasaporte/merchant typecheck`: ambos exit 0, precedidos de Node24. Prettier de los tres tests y `git diff --check` correctos.

La corrida terminó y no quedan procesos propios usando DB; se avisó al coordinador para transferir el recurso. Sin DB PROD, browser, build, verify global, push o merge por este worker. El hook completo de publicación sigue siendo responsabilidad del coordinador; este foco no lo sustituye. Siguiente paso: QA independiente del commit congelado y su integración local.
