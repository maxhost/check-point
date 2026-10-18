# 0242 CP1c.3 — QA independiente de captura medida y replay

Resultado: **aceptación funcional focal cubierta, sin hallazgos de producto**. La corrida íntegra sigue **FAIL de infraestructura: 10PASS/1FAIL de11**; el caso afectado pasó después en selección focal **1PASS/4skipped**. No se declara una corrida completa11PASS ni se convierte el retry en PASS global. Aceptación/integración corresponde al coordinador con esta evidencia explícita.

Candidato congelado `e9dd2d4847c01e663fe33efd58460ae78ecc4420`, combinación con lector analytics aceptado `7428fe19`. Autor documental `637ae1f24f704f8209e97b8b0a7c8c5f05b8c3ee`, código `f9a35b9fae04d1cce442c1c821d3d525ae7127fb`, base de producto `e7454217641003dac486008cbc8de390e84ac461`. QA nuevo en WT `/private/tmp/checkpass-pos-0242/pos-qa-0242`, rama `pos-qa-0242`; no implementó producto ni editó tests. `git diff --exit-code 637ae1f2 HEAD -- apps/merchant/src/modules/recipes packages/db pnpm-lock.yaml tools/neon-test.sh` exit0. La combinación sí modifica domain analytics: se repitieron tipos domain/merchant y la señal DB de interacción.

## Revisión y aceptación

Leídos AGENTS/protocolos, ficha vigente con sus ampliaciones/fixture, handoff, contrato0242 §4, ADR0148 §3, seis archivos de producto/tests y helpers pertinentes. V1–3 delegan al helper intacto sin parser nuevo; V4 composition usa resolución/revisiones del tenant/producto y base capturada. Unit usa snapshot INT32 explícito; masa usa captura estricta. El slot legacy recipe solo admite unit. No hay callers de runtime del helper medido: la búsqueda encuentra únicamente declaración y tests. Suscripciones siguen usando `capturedConsumption`.

La expansión conserva ambos racionales exactos y consolida por línea/insumo. Proyecciones0 de fuentes positivas conservan procedencia y `roundingOmissions`, sin movimientos. El test medido comprueba esas señales de costo incompleto; el test legacy de redondeo comprueba el lector de costo. No se certifica un lector runtimeV4.

Persistencia valida V2 positivo/canónico/reducido por ambos pares, normaliza V1/cuatro null y compara textos/referencias/proyecciones sin Number. Cardinalidad y claves comparan el conjunto completo existente: añadir, omitir o cambiar fuente genera conflicto, sin insertar parcialmente. Snapshot vacío no tiene marker, limitación explícita del diseño entregado. Los tests SQL observan textos exactos, IDs/filas estables al replay, rollback frente a cambios y fuente adicional, y negativos tenant/producto/revisión/slot/base/ratios. Receta actual modificada no altera el resultado capturado.

Publisher busca el derivado existente por negocio/tipo/orden, valida envelope y campos de identidad del payload y retorna antes de releer costos/inventario. El replay mantiene la fila completa, observedAt y deliveries; el negativo closedAt distinto falla. La entrega existente se serializa mediante lock de delivery en framework vigente; este cambio no añade locks ni pretende aceptar invocaciones directas concurrentes fuera de ese camino. Las tres expectativas legacy exigen exactamente2 deliveries aplicadas recipes/core.analytics; el retry tras fallo de procedencia conserva1. No se debilitan aserciones de ledger/costo/rollback.

## Evidencia independiente reproducible

Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`, hooks `.githooks`. Cada comando Node/pnpm precedido por `source ~/.nvm/nvm.sh && nvm use`. CI exclusiva de QA, incluido teardown; únicamente wrapper autorizado y env privado, sin leer/imprimir credenciales ni abrir otra DB:

```sh
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/recipes/server/model/captured-measured.neon.integration.test.ts src/modules/recipes/server/model/consumption.neon.integration.test.ts --no-file-parallelism
NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh src/modules/recipes/server/model/consumption.neon.integration.test.ts --no-file-parallelism -t 'a combo with an empty recipe'
```

- Completa `/private/tmp/captured-qa-neon.log`: inicio18oct2026 16:18:24 -05,155.33s, exit1; medida6PASS, legacy4PASS/1FAIL, cero skips. Único fallo: combo con receta vacía, `Connection terminated due to connection timeout` en Neon `pool.connect`, `withDbTransaction:67`, `retryModuleEvents:44`, antes de assertion de deliveries. El replay derivado y rollback pasaron en esta corrida final.
- Recheck `/private/tmp/captured-qa-combo-recheck.log`: inicio16:21:36,19.36s, exit0,1PASS/4skipped deliberados por filtro. El caso combo vacío comprobó costos congelados y cobertura incompleta. No hubo cambio de código/config entre ejecuciones; se clasifica el fallo original como conexión/infraestructura, no como assertion corregida. Los cuatro excluidos no cuentan como cobertura de esta selección.
- Ambos wrappers validaron antiPROD y migraciones idempotentes exitosas; sin SQL/manual DDL. SQL0104 SHA256 `3864ac582df786d573cfde7e0b76bf22097f51c3d2dfcd92319c8ec66d69d06a`. No se repite inventario105 de CI aceptado previamente. Consumer URL ausente: oráculo de rol consumidor no ejecutado, ajeno a estas suites.
- Teardown sin errores: cada suite y el recheck consultan `businesses` y `users` después de `dropModuleWorld`, ambos resultados `[]` para sus IDs. Las queries de procedencia verificaron persistencia/rollback dentro de los casos; no se hizo inspección SQL ajena al wrapper.
- `pnpm exec vitest run` con `expand.test.ts`, `expand-measured.test.ts`, `consumption-snapshot.test.ts`, `unit-expand-compat.test.ts` (rutas del handoff):59PASS/4archivos,0skips,2.27s, `/private/tmp/captured-qa-pure.log`.
- `pnpm --filter @mi-pasaporte/{db,domain,merchant} typecheck` ejecutados individualmente: tres exit0, logs `/private/tmp/captured-qa-db-types.log`, `captured-qa-domain.log`, `captured-qa-merchant.log`.
- ESLint y Prettier sobre los seis archivos del diff de producto/tests, `git diff --check`: exit0; `/private/tmp/captured-qa-lint.log`, `captured-qa-format.log`.
- Tres `modules-boundary*.test.ts`:24PASS/2FAIL de26,0skips,3.14s, exit1, `/private/tmp/captured-qa-guards.log`. Backlog exacto: expenses/immediate→stock/count; core adicionales backoffice-context-controller3, backoffice-context-refresh1, onboarding/checklist-context-resource1, analytics/evaluation/policy-simulation2, analytics/lifecycle/index1. `git diff --exit-code <base> HEAD -- <esos seis paths>` exit0; ningún nuevo offender. No guardias verdes.

Configuración SHA256 comprobada e idéntica al handoff: lockfile `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; vitest root `a5ce128adf14f6a0953701dbec7b8eb00defbb361043fc99800fdf8ab57c28ea`; vitest merchant `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`; tsconfig merchant `aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0`; domain `716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861`; db `3b1e20e6fcf3c40e324438440315cfb899e4bf4cdcdcba0c262804d417b2a8d0`; wrapper `5547fd5bfc5fa137b0a247c64790b31d83d24146d932d2ef95afd084b5da8132`.

## Límites y cierre

Fixture acotado autorizado: module_event V4 raw persistido, líneas identificadas y referencias reales/coherentes del mismo negocio a productos/insumos/recetas/composición/resolución/revisiones. sourceOrderId/sourceLineId son UUID capturados **sin filas POS/core**. No es cierre end-to-end ni POS real PASS; CP2c exige órdenes reales. No productor/runtimeV4 ni habilitación de masa.

La evidencia del autor mantiene su completa10PASS/1FAIL por duplicado derivado y su foco posterior1PASS/4skipped; QA no la reetiqueta11PASS. Las incidencias heredadas permanecen en su handoff. La cobertura independiente final distingue el timeout nuevo del bug derivado ya corregido.

Sin cambios schema/framework/Stock/analytics/UI/kit/tooling, build/browser/M0/M1, factory, refs principales, push o PROD. Todas las sesiones propias finalizaron; `lsof -a -d cwd +D <WT> -F pc` desde `/private/tmp` sin resultados:0procesos persistentes. CI liberada al coordinador tras el recheck/teardown. Único archivo escrito: este reporte; commit local de QA con árbol limpio. Próxima QA corresponde a otro agente/contexto.
