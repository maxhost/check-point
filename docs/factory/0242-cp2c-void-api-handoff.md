# 0242 CP2c.9 — entrega HTTP void V2

TaskID: `pos-void-api-v2-0242`. Base: `b68127aa9fbb0beb2121af26e5609eb1702df68b`. Worktree/ref: `/private/tmp/checkpass-pos-0242/pos-void-api-v2-0242`, `pos-void-api-v2-0242`.

Fuente verificada: `e6c9bbed381e9489ec50e65b2f374882d02e200f` (implementación `065e1122cc106c0533e6483bc46c866e33a08643` más corrección de pruebas). El commit que añade esta entrega cambia solo documentación; no altera fuente verificada. Coordinador registra entrega/QA/aceptación/integración y mantiene la reserva hasta cierre.

## Archivos y comportamiento

- `apps/merchant/src/modules/pos/server/routes.ts`: solo import de `voidMeasuredPosOrder` y handler POST void. Negociación tras guard/scope, antes de UUID/body/dominio. Ausente/1 mantiene escritor/DTO legacy y cuerpo ignorado. Header2 usa dominio interno aceptado; body ausente pasa `undefined`, body presente pasa `readPosBody` estricto. Header desconocido409 sin consumir stream ni ejecutar dominio.
- `apps/merchant/src/modules/pos/server/void-api-v2.neon.integration.test.ts`: harness dispatcher/guard explícito como close V2, dominio/transacciones reales. Comprueba optional body, `{}` y versión, replay/evento único, DTO V2 completo, legacy, JSON/shape/version inválidos, stale409 canónico, UUID404, tenant404, guard/scope/módulo y private/no-store; cerrada409 `pos_order_not_open` preserva pagos/venta.
- Este handoff.

La solución local de body fue propuesta/aprobada antes del código y confirmada con Request real Node24: ausencia produce `body === null` sin consumirlo; string vacío, espacios, JSON inválido y `{}` tienen stream. No se modificó lector ni dominio aceptado CP2c.8. No se activa masa ni se retira legacy. Harness no certifica autenticación nativa Next.

## Evidencia congelada

Logs externos: `/private/tmp/checkpass-pos-0242/void-api-v2-evidence/`. Runtime Node `24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`. SHA256 lockfile: `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821` (registrado en `typecheck.log`). Config CI seleccionada: `/private/tmp/checkpass-pos-0242/private/ci.env`; no copiada ni impresa. Checks sobre fuente congelada sin ediciones simultáneas.

| Check | Comando | Resultado/log |
| --- | --- | --- |
| Tipos merchant | `pnpm --filter @mi-pasaporte/merchant typecheck` | EXIT0, `static-r2.log` |
| Lint focal | `pnpm exec eslint apps/merchant/src/modules/pos/server/routes.ts apps/merchant/src/modules/pos/server/void-api-v2.neon.integration.test.ts` | EXIT0, `static-r2.log` |
| Formato focal | `pnpm exec prettier --check apps/merchant/src/modules/pos/server/routes.ts apps/merchant/src/modules/pos/server/void-api-v2.neon.integration.test.ts` | EXIT0, `static-r2.log` |
| Guardia UI | `node tools/ui-guard.ts --base b68127aa9fbb0beb2121af26e5609eb1702df68b` | EXIT0, 1 archivo sin aumentos, `static-r2.log` |
| Neon focal exclusiva | `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env bash tools/neon-test.sh src/modules/pos/server/void-api-v2.neon.integration.test.ts --no-file-parallelism` | EXIT0, 5/5 tests, 0 skips/retries; duración50.43s, `neon-r2.log` |

Primera revisión `065e1122` conservada en `static.log`, `typecheck.log`, `neon.log`: tipos/formato/guardia EXIT0; lint falló por dos imports sin uso y Neon EXIT1 (3 PASS/2 FAIL). Causa test: expectativas erróneas de UUID422/`invalid_input` y cerrada `not_open`; comportamiento aprobado existente es UUID404/`unknown_pos_order` y cerrada409/`pos_order_not_open`. Se corrigieron esos oráculos, consulta de métodos limitada al negocio y registro explícito de limpieza; handler sin cambios. Segunda revisión corrige esos fallos, no es un retry sin cambios.

Avisos no fatales: wrapper informa que no hay `NEON_CI_CONSUMER_DATABASE_URL` (esta selección no ejecuta oráculo de rol consumer); warning habitual driver websocket/Neon y módulo TS sin tipo. No browser/build/fullverify ni nueva matriz financiera/locks: se reutiliza dependencia interna aceptada `3511c9d28852b5e88604e4986363379cc8dd9441`/QA `10fd918484268191de9ffce308cc5f1253c6f826` de CP2c.8.

## Teardown y límites

`neon-r2.log` registra identidades y verifica cero negocio/membership, owners y sesiones tras teardown:

- Negocios `721cdb36-7760-487d-878a-175b7d3afa90`, `14d09821-da7f-4bf0-aeb1-6f784a0f7e54`.
- Owners `counter-int-2ea65e06-317a-41eb-93d5-6ff3fe4fc57d`, `counter-int-e080235d-54b7-417c-8040-1ab58a08cc1d`.

Las dos invocaciones Neon finalizaron y ejecutaron afterAll sin fallo; reserva DB se conservó durante ambas limpiezas. `processes.log`: comprobación `ps` y `lsof -a -d cwd -Fn` desde `/private/tmp`, cero procesos de prueba y cero CWD del worktree; solo aparecen el shell/rg de inspección. Sandbox bloqueó gitdir y ps con EPERM, comunicado inmediatamente al coordinador; escalación acotada aprobada para commits locales y lectura de procesos, sin bypass de hooks.

Sin pendientes de implementación. QA independiente pendiente; conservar worktree/ref para fixes. No se modificaron factory/refs/estados comunes, dominio, dependencias, schema ni otros paths. Sin push/PROD/servidores/túneles/demos. El siguiente paso corresponde al coordinador: registrar entrega y asignar QA sobre la revisión final con fuente idéntica a `e6c9bbed`.
