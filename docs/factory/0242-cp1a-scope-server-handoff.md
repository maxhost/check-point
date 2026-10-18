# 0242 CP1a — Scope servidor, entrega

Base: `00efff814a1939b25006af36c7dbfb04758f3256`. Código congelado: `27ec722d13afb6f84b7f4b44ccd1eaa38ca314d0`. Rama/worktree propios: `pos-ui-0242`, `/private/tmp/checkpass-pos-0242/pos-ui-0242`. El commit posterior de este handoff solo añade documentación. Sin push, PROD, UI, schema, cliente ni cutover.

## Cambio y contrato

`ModuleRoute.backofficeScope?: 'optional'|'required'` es genérico. Sin metadato no se compara scope ni se cambia caché de la ruta. Optional admite ausencia y rechaza cabecera vacía/malformed/ajena; required también rechaza ausencia. La cabecera nunca selecciona negocio ni concede permiso. El dispatcher conserva diagnóstico `measureRequestPhase('module-guard')`, ejecuta guard completo → scope → handler y aplica `private, no-store` a respuestas adoptadas de acceso/scope/dominio. Errores anteriores a encontrar una ruta (404/405 de matching) conservan su contrato: no hay ruta adoptada para ellos.

El helper reutiliza el contexto Request y HMAC existentes. `posRoute` declara optional; cubre también el spread `paymentRoutes`. No se añade literal de módulo a core. Reporter/auth y el toggle genérico mantienen su contrato anterior. No se exige `X-Pos-Contract` ni se modifica DTO/operación unit.

Archivos reales: `apps/merchant/src/modules/{route-table.ts,dispatch.ts,route-table.test.ts,dispatch.test.ts}`, `apps/merchant/src/server/{backoffice-scope-http.ts,backoffice-scope-http.test.ts}`, `apps/merchant/src/modules/pos/server/{http.ts,pos-scope.neon.integration.test.ts}` y este handoff. Ningún otro archivo cambiado.

## Inventario POS

El test compara la tabla real completa en orden y exige optional en todas sus **15** rutas/verbs (el conteo preliminar 16 se corrigió):

| Método | Path |
|---|---|
| GET | payment-methods |
| GET | catalog |
| GET | orders |
| POST | orders |
| GET | orders/:id |
| PUT | orders/:id |
| POST | orders/:id/close |
| POST | orders/:id/void |
| POST | resolve |
| GET | coupon-state |
| POST | coupon-remove |
| GET | tables |
| GET | ticket |
| GET | ticket-settings |
| PUT | ticket-settings |

Consumidores futuros: transporte/consola POS para catálogo/órdenes/resolución/cupones/mesas/pagos; impresión para ticket; ajustes owner para ticket-settings. Adoptar esos clientes/seed/cache corresponde a otra entrega antes de required en CP3.

## Evidencia y entorno

Fecha: 2026-10-18. Node `24.20.0` mediante `source ~/.nvm/nvm.sh && nvm use`; pnpm `11.4.0`. Lockfile SHA256 `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`.

Config privada seleccionada sin imprimir valores: `/private/tmp/checkpass-pos-0242/private/selected.json` SHA256 `535be4b240effc5b8e0f0e8079a3ec77aa605c7710da54ae0b8289c84a66ce47`; `ci.env` SHA256 `2f5feba61ffc64659e7faac8afe917e68f5326256dd0ec6a37d4c2fd5cf13280`. No se modificaron fixtures M0, control/RAW ni cookies guardadas. Se crean mundos propios con UUID vía `seedPosWorld`, sesiones reales `openMerchantSession`/Better Auth y staff válido con permiso counter sin pos. Schema del candidato termina en `0101_analytics_inbox_lifecycle`; wrapper migró CI satisfactoriamente sin cambios de esquema de esta entrega.

- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/dispatch.test.ts src/modules/route-table.test.ts src/server/backoffice-scope-http.test.ts`: 128 PASS (26+7+95), cero skips. Primer pase antes de ampliar malformed required:125 PASS. Último pase compartió invocación con las guardias fallidas indicadas abajo; estos tres archivos pasaron íntegros.
- `pnpm --filter @mi-pasaporte/merchant exec vitest run src/modules/modules-boundary.test.ts`:10 PASS.
- `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/pos/server/pos-scope.neon.integration.test.ts --no-file-parallelism`: último pase final4 PASS, cero skips,23.19s total/21.56s tests. Recurso CI exclusivo incluido teardown; ninguna otra suite DB concurrente. El wrapper avisa falta de credencial consumer opcional, que esta suite no usa.
- `pnpm --filter @mi-pasaporte/merchant typecheck` y `pnpm --filter @mi-pasaporte/domain typecheck`:PASS. Merchant repetido sobre los archivos finales.
- `pnpm exec eslint` y `pnpm exec prettier --check` sobre los ocho archivos cambiados:PASS; `git diff --check`:PASS.

La suite DB ejecuta **dispatch real + Request/cookies nativas + DB CI**, sin navegador ni build/HTTP listener. Intención A/cookie B devuelve exactamente409 `backoffice_context_changed` en GET orders y POST orders con payload válido para B, sin datos B; snapshot SQL completo de posOrders de A/B permanece idéntico. Matching/legacy leen datos A sin B; matching permite escritura201 cuyo businessId se verifica por SQL. Staff counter mantiene403 missing_permission y403 not_owner antes de scope ajeno/malformed. Cabeceras vacía/malformed rechazan409 sin cambios. Todas esas respuestas son privadas/no-store. Teardown elimina mundos/usuarios propios y verifica cero businesses, posOrders y users propios restantes. No se afirma prueba navegador/build ni mejora de rendimiento.

### Intento fallido de montaje, saneado

Primer pase CI:3 tests PASS,1 FAIL y afterAll FAIL. Negativo cruzado y positivo ya pasaron. El fixture staff `[]` violó constraint real `business_membership_staff_has_permission_check`: estado imposible, sustituido por `['counter']`. `dropPosWorld` existente elimina negocios y extraUsers, pero conserva owners; la nueva suite borra explícitamente todos sus userIds y verifica ausencia. No se cambia el helper compartido.

Tres usuarios propios del intento quedaron huérfanos: `counter-int-9ca89239-c9a8-420d-a685-a2158bafda7e`, `counter-int-c79f0d60-41e4-49a2-a0cf-85855b645189`, `counter-int-e2002ab4-e5d4-4ed2-b842-ca768eade211`. Se borraron únicamente esos IDs en un bloque temporal de recuperación de esta misma suite, exclusivamente mediante wrapper CI; SELECT posterior verificó0. Pase corregido4/4 PASS con teardown0. Se retiró ese bloque temporal y se repitió el archivo final:4/4 PASS y teardown0. Ningún ID fijo ni mecanismo de recuperación quedó en producto/test final.

### Guardias fuera de scope: FAIL preexistente demostrado

`vitest run src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts`:2 FAIL/14 PASS. No se afirma PASS de todas las guardias.

- Between: `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`.
- Literals: cinco archivos adicionales a sus excepciones actuales: `app/backoffice/backoffice-context-controller.test.ts` (3), `app/backoffice/backoffice-context-refresh.test.ts` (1), `app/backoffice/onboarding/checklist-context-resource.test.ts` (1), `server/analytics/evaluation/policy-simulation.test.ts` (2), `server/analytics/lifecycle/index.ts` (1).

Prueba de preexistencia: script Python comparó `subprocess.check_output(['git','show','00efff81:'+path])` con bytes del working tree para los seis archivos infractores; todos `base==working True`. SHA256 respectivos, mismo orden anterior:

```text
73f85ff198e379d8e79718da6f8baa188721de6a0b19311c0bdcb44f82ea1d05
2456e5eaf77cba32812e2622f5d6fe5c99c8e5ceb8ce5a1efcf50f3e1201a51e
1b8829636cdcb79f14d541cb0cffdd9b27dd6e723c26bc7046f507a533c01b86
7b031ab9d81eaf69aa3618d6ab97edcb7f0b96823ae1ffb758d997484c736931
ee0c7225fa4c1b4f993bd22400d8b2befdca549d9494d1534799596d8e7e3162
8168e48d8c14e7bb962419f24a48623730d035d1633e2f226adf545941a08353
```

`git diff --quiet 00efff81 -- apps/merchant/src/modules/modules-boundary-between.test.ts apps/merchant/src/modules/modules-boundary-literals.test.ts apps/merchant/src/modules/modules-boundary-support.ts`:EXIT0. No guard modificado para ocultar rojo.

## Cierre y siguiente paso

Candidato de código congelado, checkout limpio antes de añadir este documento; commit de código propio sin escalación. El add del handoff encontró bloqueo sandbox de index.lock; escalación acotada para add/commit solo de este documento autorizada y completada. Coordinador ejecuta factory deliver y QA independiente nueva sobre SHA entregado; no aceptación declarada aquí. Tests/teardown terminados, sin servidor propio ni launcher. `lsof -nP -iTCP:43242 -iTCP:43243 -sTCP:LISTEN`:sin listeners. CWD scan solo encontró sus propios procesos lsof efímeros. DB disponible tras el pase final. No retirar worktree hasta aceptación/integración conforme factory.
