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
