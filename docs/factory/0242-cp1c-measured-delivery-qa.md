# 0242 CP1c.9 — QA independiente

**PASS de entrega y combinación**, sin hallazgos bloqueantes dentro del contrato. Candidato final congelado `0f65de5516b43124943264f243cf0414da9e97ec`, base aceptada `993390ca29edbec8d33f220557b93fdb5cc9c343`. Autor final `0ba07ce7201d731f22fadb5a41cb8c152047d238`; producto inicial `dd47524f40ba683a3bafc8243b351efdc8c8456a`, corrección exclusivamente de tests `80414cf92ca372525c387497ff31e48cb75e4317`. QA nueva en `/private/tmp/checkpass-pos-0242/pos-qa-0242`, rama `pos-qa-0242`, sin subdelegar ni implementar producto.

## Revisión y aceptación

Leídos AGENTS/protocolos, ficha, contrato0242 §4, ADR0148 §3–4, diff y dependencias pertinentes. Se confirmó limpieza y SHA antes de comprobar los candidatos temprano `d7cbf500`, corregido `1a9e5ea1` y final. Los tres archivos productivos, gate nuevo y modelo legacy son idénticos entre autor inicial y final. El último refresco solo añade handoff; los siete paths TS y configuración están congelados.

- Recipes adopta decoder/helper medidos por dispatch tipado, conserva resourceType/slot/requiredModules y V1–3 legacy. Ledger, procedencia, derivado y ACK permanecen dentro de la transacción del framework. Sin cast V4→V3 ni ampliación del union legacy.
- La comprobación genérica de forma/versión/local de `sale.closed` precede analytics, dispatch y handler legacy; claims, locks, diagnóstico y restricciones legacy se conservan.
- El lector1–4 conserva read-only repeatable-read, filtros negocio/local/orden y snapshots capturados. Captura/envelope inválidos dejan delivery unknown y contexto seguro, nunca cobertura vacía completa. No consulta precio/receta actuales.
- Fixtures raw4 usan refs reales de composición/resolución/revisiones y Stock; los IDs de orden/línea no fingen filas POS/core. Mixta prueba ACK Recipes+analytics, ledger3 consolidado, sources2 con ambos ratios, derivado2 y su delivery analytics, unidades y gramos exactos separados. Neto0/costo0 conserva comisión capturada0; tiny positivo sin ledger sigue incompleto.
- Replay compara efectos completos y delivery derivada después de compras nuevas: no duplicación, revaloración ni cambio de observedAt. Conflicto derivado ocurre después de ledger/procedencia y exige rollback de efectos más ACK pendiente/diagnóstico. Negativos de envelope ejercitan ambas ramas; skipped, tenant/local ajenos e invalidez del lector tienen aserciones observables.
- Las tres adaptaciones handler→dispatch conservan aserciones y añaden versión externa. Las correcciones posteriores limitan dos retries a Recipes, comprueban el array exacto de ambas deliveries reales y buscan traductor por eventType con aserción de existencia; no relajan costos/negativos.

## Evidencia y fallos explícitos

QA ejecutó offline Node24.20.0, pnpm11.4.0, Vitest4.0.18. Comando desde `apps/merchant`: `pnpm exec vitest run --config vitest.config.ts src/server/module-events/decode-measured.test.ts src/server/module-events/decode.test.ts src/modules/recipes/server/model/expand-measured.test.ts src/modules/stock/server/consumption-cost.test.ts src/server/module-events/subscription.test.ts`: **103PASS/0FAIL/0skip**, cinco archivos, sobre `d7cbf500`; reutilizable por identidad en el candidato final. Dos intentos previos abortaron por selector de proyecto/config CLI, sin ejecutar tests; no se cuentan como PASS. ESLint/Prettier de los seis paths iniciales y de los dos legacy corregidos, más `git diff --check`: EXIT0.

Revisados el handoff final y los logs completos del autor; no hubo duda concreta que justificara duplicar DB:

- `/private/tmp/0242-measured-delivery-neon.log`, autor `dd47524f`: **11PASS/6FAIL/0skip, EXIT1**,331.30s. Gate nuevo5PASS y modelo legacy5PASS; origins1PASS. Costo5 falla antes de sus asserts de costo por esperar applied1 frente a dos deliveries reales; origins1 falla por seleccionar el traductor `recipes.product_cost.changed` por índice0 (`p.products.flatMap`). Sin timeout.
- `/private/tmp/0242-measured-delivery-neon-legacy-fixed.log`, autor `80414cf9`: solo costo5 y origins2, **7PASS/0FAIL/0skip, EXIT0**,100.92s. Se reutilizan nuevo5/modelo5 por identidad de producto/tests/config. Es evidencia compuesta; la primera corrida integral sigue fallida.
- Tipos db/domain/merchant EXIT0 y 122 puros PASS del autor reutilizados según handoff. Merchant tuvo antes tres TS2339 corregidos en callers; no se declara ese intento PASS.
- `/private/tmp/0242-measured-delivery-guards.log`: **24PASS/2FAIL**, backlog exacto: expenses/immediate test→stock/count; cinco archivos core de literales (backoffice-context-controller, backoffice-context-refresh, checklist-context-resource, policy-simulation y analytics/lifecycle). Sin offenders nuevos de esta entrega ni cambios de guardias. No equivale a verify global verde.

## Identidad de entorno y SQL

CI exclusiva del autor, wrapper `tools/neon-test.sh --no-file-parallelism`, env seleccionado `/private/tmp/checkpass-pos-0242/private/ci.env`; QA no abrió env ni conectó DB/ejecutó DDL. Ambos logs muestran migraciones CI aplicadas y selección real sin skips. Falta consumer URL en ese env: oráculo de rol consumer fuera de selección y no certificado. Teardown y liberación de CI constan en handoff/coordinador; recurso transferido a otra tarea.

SHA256 comprobados contra handoff y árbol final: lock `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821`; wrapper `5547fd5bfc5fa137b0a247c64790b31d83d24146d932d2ef95afd084b5da8132`; vitest raíz `a5ce128adf14f6a0953701dbec7b8eb00defbb361043fc99800fdf8ab57c28ea`; merchantconfig `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81`; setup `1e1dc6157e3f976c83c10ff5d740fbfba6cf6b9aaec2df59a301c495dba26f5f`; drizzleconfig `e53ee9595e5f28ecb1034088a2ead25255dfb9f42c6a6b1281707a37f69721cc`.

SQL0103 `370a8472343161f0dc2e551c72d4b7868316286fc75a5bb8fa193e6eab58873b`; SQL0104 `3864ac582df786d573cfde7e0b76bf22097f51c3d2dfcd92319c8ec66d69d06a`. Journal autor hasta0104 `906cab05d31eb501c5478d86dd468fcbb4583ac1f26f0e5665e9a207c387dda4`. DB CI ya incluía0105 aceptada al transferirla según handoff; candidato incluye esa misma base aceptada: SQL0105 `bc45625df27153b41a45aa96bc0798e39b9acfbac6d26a3604fd636af6a3f562`, journal `d31e5e90fdbfb96e282b5aac53c9dd24d4dc83e84c53795bd291fe9b4968637f`, ambos sin diff contra993390ca. Sin migraciones nuevas de CP1c.9; diferencia de journal explícita y compatible.

## Límites y entrega

Productor sigueV3 y barreras unit permanecen; mass operativa y cierre HTTP/E2E siguenCP2c. Sin build/browser/fullverify/M0/M1 ni oráculo consumer. Sin push/PROD. QA solo escribe este informe; comprobación `lsof -a -d cwd +D /private/tmp/checkpass-pos-0242/pos-qa-0242 -F pc` no mostró procesos persistentes (solo lsof transitorio): **0procesos propios persistentes**. Worktree limpio antes del informe y conservado para aceptación/cleanup del coordinador.
