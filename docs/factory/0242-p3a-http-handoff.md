# 0242 P3a A — barrera HTTP y retiro Counter

- Reserva continuada: `pos-ui-card-0242`; WT `/private/tmp/checkpass-pos-0242/pos-ui-card-0242`.
- Base: `7feef6cc04312ec039a05b19d7fcb0c424742c95`.
- Commit de implementación: `54fdc2789150f5af4ff9e7c11236780d27ceb240`.
- Revisión de código final: `8752e955ed27f3322f949ad78d0450d5188426bf` (sólo añade timeout120000 explícito a la nueva suite DB, pedido por coordinador).
- Contrato: sección A de `0242-p3a-cutover.md`, spec0242/anexo HTTP. Ampliaciones de tests autorizadas por coordinador antes de editar.

## Comportamiento y archivos

`apps/merchant/src/modules/pos/server/http.ts` exige scope `required` mediante metadato del dispatcher; dentro de `posRoute`, exige exactamente `X-Pos-Contract: 2` antes de invocar cualquier handler. Orden efectivo: guard completo → scope → contrato → body/dominio. Ausente/1/desconocido devuelve409 `pos_client_upgrade_required`. Dispatcher conserva respuestas privadas/no-store, también denegaciones del guard, scope y errores.

`routes.ts` elimina imports/dispatch HTTP hacia `createPosOrder`, `updatePosOrder`, `closePosOrder`, `voidPosOrder`, `getPosOrder` y `resolveScan`; rutas activas usan V2. No se eliminan dominio compartido ni readers históricos.

Las cinco rutas bajo `apps/merchant/src/app/api/counter/{resolve,grant,redeem,coupon-state,coupon-remove}/route.ts` conservan `requireOperator` primero y responden410 `feature_retired`, sin parsear body, dominio ni redirección. Guard401/403 conserva respuesta y también private/no-store. No hay cambios en `_auth`, guards, kit, UI, tooling ni esquema.

Tests nuevos bajo `apps/merchant/src/modules/pos/server/`:

- `http.test.ts`: tabla real completa de15 rutas + dispatcher real + spies de guard/dominio/session. Ausente/1/desconocido, scope ausente/malformado/ajeno, denegación401/403, settings owner, pagos, mesas, body inválido sin consumir y positivo contrato2.166 casos efectivos.
- `legacy-retirement.test.ts`:15 casos efectivos sobre las cinco rutas Counter con guard/dominio/body spies.
- `legacy-cutover.neon.integration.test.ts`: preparado para QA; guard/auth/scope nativos sin dobles, seeds propios, sin `pos.*` antiguo. Captura scope real, old client ausente/1/99 antes body y resolve válido sin efectos; Counter410 tras guard,401/403 preservados; scope requerido, tenant mismatch, POS apagado y permiso revocado. Snapshot de órdenes POS/core, membresías/balances, clientes/last_scan, redenciones de premio/cupón, cupones y selección. Limpieza por ownership. **No ejecutado contra DB en esta entrega.**

Adaptaciones autorizadas: `measured-read.test.ts` cambia sólo negociación al cutover; conserva tests de readers históricos. `pos-scope.neon.integration.test.ts` requiere scope/contrato2 y mantiene negativos; fixtures se crean por dominio V2 y POST positivo usa payload V2 explícito, sin modificar el helper histórico global. **No ejecutado contra DB.**

## Evidencia focal

Entorno: macOS local, Node24.20.0 (`source ~/.nvm/nvm.sh && nvm use`), pnpm11.4.0, lockfile existente sin cambios (`git hash-object pnpm-lock.yaml`: `abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`), Vitest4.0.18. No DB, servidores, túnel, capturas, push ni PROD. Checks funcionales puros y typecheck sobre el árbol de54fdc278;8752e955 sólo añade el timeout de la suite DB no ejecutada, con lint/format/diff focal repetidos. Commit posterior de handoff es sólo documental.

- `pnpm exec vitest run apps/merchant/src/modules/pos/server/http.test.ts apps/merchant/src/modules/pos/server/legacy-retirement.test.ts apps/merchant/src/modules/pos/server/measured-read.test.ts apps/merchant/src/modules/dispatch.test.ts apps/merchant/src/modules/modules-boundary.test.ts`: **PASS226/226,5 archivos, cero skips**.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: PASS, incluyendo compilación de ambas suites Neon adaptada/nueva.
- ESLint focal sobre los12 archivos de código/tests entregados: PASS.
- Prettier focal y `git diff --check`: PASS.
- Invocación inicial Vitest con `--project merchant`: error de configuración, ningún proyecto coincide con ese nombre. Corregida usando selección de paths; no fue fallo de aserción ni retry de producto.

## Fallos fuera de scope y límites

Se ejecutaron además `modules-boundary-between.test.ts` y `modules-boundary-literals.test.ts`: **FAIL**, no presentar el conjunto como PASS. Los ofensores y esas guardias ya están en la base y no cambian en esta entrega; no se alteraron guardias para ocultar rojo.

- Between: `apps/merchant/src/modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`. Último cambio del archivo: `beeb1339231b18701a316a70045bc9729dcb64ce`.
- Literals: diferencias adicionales en `app/backoffice/backoffice-context-controller.test.ts` (3), `app/backoffice/backoffice-context-refresh.test.ts` (1), `app/backoffice/onboarding/checklist-context-resource.test.ts` (1), `server/analytics/evaluation/policy-simulation.test.ts` (2), `server/analytics/lifecycle/index.ts` (1), todos bajo `apps/merchant/src/`. Coordinador cotejó commits previos `5d7d601f`/`64c9f5a4`/`88df2147`/`7da87404`; P6 distingue precedencia histórica respecto a0242.

Por decisión del coordinador, quedan para P6 seis suites HTTP Neon históricas bajo `apps/merchant/src/modules/pos/server/`: `measured-create.neon.integration.test.ts`, `measured-update.neon.integration.test.ts`, `measured-read.neon.integration.test.ts`, `read-api-v2.neon.integration.test.ts`, `close-api-v2.neon.integration.test.ts`, `void-api-v2.neon.integration.test.ts`. Contienen expectativas expand V1/scope opcional y/o dependen de `pos-integration-support.ts` y `pos-payment-integration-support.ts` con clientes/payloads anteriores. No se convierten helpers globalmente ni se inyecta scope que anule negativos. No se afirma PASS de estas suites ni se reutiliza su evidencia como validación del corte. La nueva suite `legacy-cutover` es la evidencia real acotada que QA debe ejecutar.

Sandbox bloqueó inicialmente crear `.git/worktrees/pos-ui-card-0242/index.lock`; se avisó inmediatamente y se resolvió con escalación acotada de git add/commit propios, aprobada automáticamente. Ninguna guardia/hook fue deshabilitada.

Siguiente paso: coordinador registra entrega; QA sobre candidato congelado combinado ejecuta las suites Neon focales cuando B libere la DB protegida, siempre con `tools/neon-test.sh`. Esta entrega no certifica QA independiente ni autoriza publicación/mass. Sin procesos propios que detener.
