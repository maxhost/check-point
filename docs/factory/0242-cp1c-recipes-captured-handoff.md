# 0242 CP1c.3 — captura medida y procedencia dormidas

WT `/private/tmp/checkpass-pos-0242/pos-data-0242`, rama/task `pos-data-0242`, base `e7454217641003dac486008cbc8de390e84ac461`. Autor sustituto recibió y preservó cuatro archivos sin commit del implementador que perdió capacidad de servicio. La entrega completa queda identificada por el HEAD documental; SHA de código congelado `f9a35b9fae04d1cce442c1c821d3d525ae7127fb`, tree `b215839110cd0e6b83d66d5f14dad96e8bb2851f`. Factory/QA/aceptación/integración son del coordinador. Sin push/PROD.

## Contrato y cambios

`capturedMeasuredConsumption` es una entrada explícita sin suscripciones ni productor V4. V1–3 delegan sin usar parser de captura; V4 usa resolución/base/revisiones capturadas del negocio y producto, con el expansor racional aceptado. Unit elige explícitamente snapshot INT32 confiable; masa valida captura. Slot legacy recipe admite solamente unit. Referencias ausentes conservan receta ausente; duplicadas, ajenas, incompatibles o incompletas fallan. Consolidación por línea; ledger positivo solamente; positivos diminutos conservan sources y `roundingOmissions`.

`CapturedSource` incorpora versión y dos racionales sin modificar el resultado legacy. `persistProvenance` recibe contexto estructural mínimo, normaliza V1/cuatro null, exige V2 con cuatro textos positivos/canónicos/reducidos y compara todos los campos exactamente con DB. No convierte racionales a Number ni los reconstruye desde proyecciones. Replay conserva IDs; omitir, cambiar o añadir sources a un snapshot existente falla antes de insertar. No añade markers para snapshots vacíos.

Ampliaciones del coordinador: tres expectativas obsoletas de delivery1 se sustituyen por resultado exacto2 y comprobación de recipes/core.analytics aplicadas; el retry tras fallo de provenance sigue esperando1. Las aserciones de ledger, costo y procedencia permanecen. `consumption-event.ts` admite únicamente el arreglo de replay derivado autorizado: conservar evento/deliveries/observedAt y validar identidad sin ampliar versión/contrato ni modificar framework.

## Entorno y evidencia

Node24.20.0 (`source ~/.nvm/nvm.sh && nvm use`), pnpm11.4.0, Vitest4.0.18. Todos los testsDB usan exclusivamente `NEON_TEST_ENV_FILE=/private/tmp/checkpass-pos-0242/private/ci.env tools/neon-test.sh`, reservaCI exclusiva incluyendo teardown y `--no-file-parallelism`. No se copia env, no se ejecuta SQL/manualmigraciones. El wrapper verifica antiPROD y aplica pendientes idempotentemente. EntradasCI/local105 confirmadas por el coordinador, migración0104 ya aceptada; no se repite SQL de inventario; SQL0104 SHA256 `3864ac582df786d573cfde7e0b76bf22097f51c3d2dfcd92319c8ec66d69d06a`. URLconsumer ausente: no se ejecuta ese oráculo. Setup merchant fija IA fake y elimina claveOpenAI.

Fixtures: module_event V4 raw persistido, líneas identificadas en payload y referencias reales de negocio/producto/insumo/recetas/composición/resolución/revisiones. sourceOrderId/sourceLineId son UUID capturados; no hay filasPOS order/orderLine ni certificación de cierre end-to-end. El coordinador aclaró este gate de capa; órdenes reales corresponden al checkpoint posterior. Ningún productor o barrera unit se modifica para preparar fixtures.

Comandos focales, precedidos de activaciónNode24:

- `pnpm exec vitest run apps/merchant/src/modules/recipes/server/model/expand.test.ts apps/merchant/src/modules/recipes/server/model/expand-measured.test.ts apps/merchant/src/modules/recipes/server/consumption-snapshot.test.ts apps/merchant/src/modules/pos/unit-expand-compat.test.ts`: **59PASS**, cuatro archivos, cero fallos/skips. Expansores/legacy intactos desde esa corrida hasta SHA congelado.
- `pnpm --filter @mi-pasaporte/db typecheck`, domain y merchant: **EXIT0** sobre helper final. Tras arreglo derivado, merchant se repitió **EXIT0**; DB/domain no modificados. Lint focal de los seis archivos y formato/diff limpios.
- Wrapper, rutas `src/modules/recipes/server/model/captured-measured.neon.integration.test.ts src/modules/recipes/server/model/consumption.neon.integration.test.ts --no-file-parallelism`: `/private/tmp/captured-neon-final.log`, **10PASS/1FAIL** de11 sin skips. Suite medida6PASS sobre sus archivos finales, legacy4PASS/1FAIL por duplicado derivado; corrida conserva ese fallo y no se llama verde. Duración159.26s, inicio18oct2026 16:10:18 local.
- Tras autorización del fix derivado, solo se repite caso legacy afectado con el wrapper y `src/modules/recipes/server/model/consumption.neon.integration.test.ts --no-file-parallelism -t 'shared ingredient creates one ledger row'`, `/private/tmp/captured-derived-replay-final.log`: **1PASS/4skipped por filtro**, EXIT0,23.94s, inicio18oct2026 16:13:43 local; teardown propio PASS. No se afirma corrida íntegra11PASS. La evidencia compuesta distingue los6medidos finales,4legacy previos y replay focal posterior; coordinador decide reutilización y QA valida combinación. Entre corrida completa y foco solo cambiaron `consumption-event.ts` y aserciones de replay del caso compartido; los cuatro tests legacy restantes, helper medido/provenance y suite medida permanecen idénticos. El cambio de primera emisión derivada conserva los mismos campos/cálculos y el caso repetido comprueba su snapshot de costo congelado. La corrida completa anterior continúa registrada como FAIL; QA debe revisar la reutilización, no asumir batería íntegra ejecutada de nuevo.

Los seis casos medidos cubren V1–3 con refs reales y safeInteger sin refs, V4unit equivalente,1g/base1lb con ambos racionales100000/45359237, dos recetas/insumo consolidadas por cada una de dos líneas, venta mixta, snapshot independiente de receta vigente, persistencia/lectura de cuatro textos, IDs/conteos invariantes al replay, cambios de versión/referencias/proyecciones/racionales, fuente adicional rechazada, positivos diminutos con tres proyecciones0/sin movimiento, razones inválidas para ambos pares y ausencia/tenant/producto/revisión/slots/base incompatibles. La suite legacy conserva costo congelado, ledger, rollback y ACK/retry; replay derivado añade igualdad de evento completo y deliveries, y negativo por identidad closedAt diferente.

Configuración intacta SHA256:

| Archivo | SHA256 |
| --- | --- |
| pnpm-lock.yaml | 4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821 |
| vitest.config.ts | a5ce128adf14f6a0953701dbec7b8eb00defbb361043fc99800fdf8ab57c28ea |
| apps/merchant/vitest.config.ts | 073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81 |
| apps/merchant/tsconfig.json | aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0 |
| packages/domain/tsconfig.json | 716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861 |
| packages/db/tsconfig.json | 3b1e20e6fcf3c40e324438440315cfb899e4bf4cdcdcba0c262804d417b2a8d0 |
| tools/neon-test.sh | 5547fd5bfc5fa137b0a247c64790b31d83d24146d932d2ef95afd084b5da8132 |

## Incidencias conservadas

- Corrida heredada `/private/tmp/captured-neon.log`: 4FAIL/5PASS; fuente esperada1 frente a2 y tres expectativas obsoletas de delivery. No es PASS.
- Primera recuperación `/private/tmp/captured-neon-recovery.log`: 9PASS/1FAIL de10, suite medida5PASS/legacy4PASS+1FAIL. Fallo descubierto al superar expectativas antiguas: replay directo del handler vuelve a insertar `recipes.consumption.applied` y viola `module_event_source_unique`.
- Reproducción `/private/tmp/captured-replay-repro.log`: filtro `-t 'rejects adding sources'`, 1FAIL/5skipped porque el helper heredado aceptaba extender snapshot. Añadido rechazo de cardinalidad; no se cuentan skips como cobertura.
- Primer tipo merchant falló por fixture mixto que extendía union legacy sin metadataV4. Corregido usando líneaV4 completa y refs legacy reales; repetición merchant/lint EXIT0.

## Guardias y límites

Tres guardias repetidas sobre SHA de código, `/private/tmp/captured-guards-final.log`: 24PASS/2FAIL de26, 1archivoPASS/2FAIL. Backlog exacto, ningún nuevo offender:

- Between: `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`.
- Literales core adicionales: backoffice-context-controller.test.ts3, backoffice-context-refresh.test.ts1, onboarding/checklist-context-resource.test.ts1, analytics/evaluation/policy-simulation.test.ts2, analytics/lifecycle/index.ts1.

Todos esos paths permanecen idénticos a base por `git diff --exit-code <base> -- <paths>` EXIT0. No se declara guardias verdes. Sin cambios schema/migraciones, runtimeV4, Stock/analytics/framework, UI, kit, tooling, deps, estados o índices. No build/browser/M0/M1. No habilita masa ni V4. Teardown propio comprueba ausencia de business y owner después del helper común, sin modificar ese helper. Sesiones de checks terminadas; sin servidores. `lsof -a -d cwd +D <WT> -F pc` después del último test mostró solo zsh/lsof transitorios del propio check:0procesos persistentes. CI liberada al coordinador antes del commit documental. Árbol limpio tras commit de este handoff; ninguna operación factory/refs principales ni push/PROD.
