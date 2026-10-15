# Entrega release-ddl-fix-20261015

- Base `main/dev`: `f5d5702db781cac13bd391323aa25de5af6f209c`.
- Commit de fixture comprobado: `3d6f7e377203e57e84765e4ff845af94461a822f`.
- Rama/worktree: `factory-release-ddl-fix-20261015`, `/private/tmp/checkpass-release-ddl-fix-20261015/factory-release-ddl-fix-20261015`.
- Scope: únicamente `apps/merchant/src/modules/profitability-migration.neon.integration.test.ts` y este handoff.

## Causa y corrección

El ensayo DDL del coordinador terminó con 29 tests PASS y un fallo en la preparación histórica de 0086 (`/private/tmp/checkpass-release-20261015/ddl.log:53`). La fixture intentaba eliminar el esquema Rentabilidad después de quitar solo sus tres tablas originales. El estado actual incluye también `commission_revision` y `payment_commission` de 0091 y la función `profitability.p1_immutable()` de 0092, por lo que ese esquema ya no estaba vacío.

La preparación, dentro de la misma transacción que debe revertirse, ahora retira explícitamente esas dos tablas y después la función. Los triggers propios desaparecen junto con sus tablas; no se usa `CASCADE` amplio ni se toca `pos.p1_immutable`. Después continúa la preparación/reaplicación original de 0086/0087.

Se comprueba que las dos tablas P1 y la función existen antes del replay, capturando sus OIDs, y que esos mismos OIDs están presentes después del rollback. Conserva la exigencia de rechazar exactamente con el error de rollback de la fixture: un fallo SQL distinto no puede pasar como éxito. Los hashes de journal, backfill de identidad únicamente, datos de persona y bytes de membresías/sesiones siguen comprobados; todos los casos de fechas, importes y meses finitos permanecen intactos.

No cambió ningún SQL de migración, journal, esquema, algoritmo o archivo de producto. No se ajustaron límites, retries ni aserciones para ocultar fallos.

## Evidencia

CI fue reservada exclusivamente a esta tarea por el coordinador; sin otro writer durante el DDL. Node `v24.20.0`, comandos precedidos de `source ~/.nvm/nvm.sh && nvm use`.

- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-recipes-margin/0234-ci.env tools/neon-test.sh src/modules/profitability-migration.neon.integration.test.ts --no-file-parallelism`: wrapper/migrador CI exit 0, 1 archivo y **2/2 tests PASS**, sin skips ni retries. Duración 14,17 s. Comprueba también la restauración de objetos P1 tras rollback.
- `pnpm exec eslint apps/merchant/src/modules/profitability-migration.neon.integration.test.ts`: exit 0.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: exit 0.
- Prettier del único test y `git diff --check`: correctos.

Salida con URLs PostgreSQL redactadas, pipeline sin buffering y `pipefail`, en `/private/tmp/checkpass-release-ddl-fix-neon-20261015.log`. No se modificaron fuentes mientras corría el foco. La evidencia corresponde al contenido del commit de fixture indicado; este handoff se añade después.

La corrida terminó y no quedan procesos propios usando CI; se avisó al coordinador para transferir el recurso. No se accedió a PROD ni se ejecutaron browser, build o batería global; sin push o merge por este worker. El foco no sustituye el cierre completo de publicación del coordinador. Siguiente paso: revisión independiente del candidato congelado e integración local por el coordinador.
