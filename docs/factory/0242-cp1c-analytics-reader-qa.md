# 0242 CP1c.5 — QA independiente del lector analytics

Resultado: **PASS focal de entrega e interacción**, sin hallazgos pendientes. Candidato final revisado `f2d192ebc59d71763f5681bc307b940f4274c631`; producto autor `9b62b86ce0d16e668c340eb494a28f1195c7830c`, handoff final `be66d39ea0c342373fc117cd734fece678beaab4`. QA en rama/WT `pos-qa-0242`, `/private/tmp/checkpass-pos-0242/pos-qa-0242`, contexto nuevo, sin implementar producto ni modificar tests.

La primera revisión/comprobaciones se hicieron sobre `97a22acc42bc748845fd8620fa6a15619d54b2cc`. Se comprobó después que `git diff 97a22acc HEAD -- apps packages tests tools` era vacío: el candidato final añade únicamente el handoff. Esa identidad conserva la validez de la evidencia. Base de producto y archivos constan en el handoff del autor.

## Revisión de aceptación

Leídos protocolos, ficha CP1c.5, contrato0242 §4 y ficha/handoff de la base financiera anterior. Revisados los cuatro paths de producto y su consumo exacto en dominio. El decoder conserva la cadena SQL antes de Number y solo fabrica cadena legacy desde enteros seguros. No reconstruye fracciones/unsafe ni usa parser de captura. Los casos flat/grouped mantienen tuplas, duplicados y orden; la validación de ordinales sigue vigente. Los selects adicionales de día/customer-promo convierten quantity a texto.

Las allowlists reference/extended preservan local para ambas métricas mass y mantienen producto/día/moneda/minorUnit. Las ventanas/unions no cambiaron: reference y extended son disjuntas en su borde28, las unidades same-weekday se excluyen de extended cuando ya están en reference; masa no entra en esa extensión discreta. El oráculo cambia solo allowlists mass y propiedad exacta, conservando las comparaciones completas y orden de tarjetas. Analytics usa `numeric("quantity")` sin escala en el esquema actual; no hay DDL en el diff.

## Evidencia independiente

Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`, hooks `.githooks`; lockfile blob `abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`, intacto. Comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use &&` en el WT QA:

```sh
pnpm exec vitest run apps/merchant/src/server/analytics/queries/quantity-exact.test.ts
pnpm --filter @mi-pasaporte/domain typecheck
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec eslint apps/merchant/src/server/analytics/queries/index.ts apps/merchant/src/server/analytics/queries/quantity-exact.test.ts apps/merchant/src/server/analytics/queries/monthly-finance.neon.integration.test.ts apps/merchant/src/server/analytics/evaluation/snapshot-equivalence.test-support.ts
pnpm exec prettier --check apps/merchant/src/server/analytics/queries/index.ts apps/merchant/src/server/analytics/queries/quantity-exact.test.ts apps/merchant/src/server/analytics/queries/monthly-finance.neon.integration.test.ts apps/merchant/src/server/analytics/evaluation/snapshot-equivalence.test-support.ts
git diff --check
```

Todos exit0: decoder12/12 (inicio16:13:31, duración896ms), sin skips/retries/fallos; ambos typechecks y lint/formato de los cuatro archivos PASS. El decoder reproduce discrepancia14dec invisible a Number, agregado grande, orden/tuplas, fallback y rechazo de agrupación inválida.

## Evidencia compatible reutilizada

Revisados handoff y logs reales `/private/tmp/0242-analytics-reader-monthly.log` y `/private/tmp/0242-analytics-reader-evaluation.log`, sobre código autor congelado idéntico. CI exclusiva del autor, wrapper `tools/neon-test.sh`, env privado asignado `/private/tmp/checkpass-pos-0242/private/ci.env`, siempre `--no-file-parallelism`; no se abrió/mostró el env en QA.

- Monthly completo:4/4 PASS, wrapper exit0, inicio16:14:52,12.84s. Incluye históricos tenant/local/currency/minorUnit/HTTP y nuevos mass/unit mixtos, discrepancia14dec, negativos producto/día/local/dimensión y dinero ajeno. Bordes0/1/28/29/45 incluidos una vez,46 fuera,49 same-weekday solo units; snapshots todos/local.
- Evaluation seleccionado:2 PASS y7 skipped deliberados por `-t 'bounded windows retain|preserves complete snapshots and card ordering'`, wrapper exit0, inicio16:15:11,7.24s. Los seleccionados dependen de beforeAll/siembra propia, no de escrituras de los siete excluidos. No se certifica la suite completa.
- Ambas invocaciones verificaron URLs CI/migraciones y finalizaron sin fallos/retries/errores de teardown. `limpiarNegocios` retira negocios/owners y dependientes por cascada; no hubo consulta posterior independiente de huérfanos. Aviso de consumer URL ausente: no cubre el oráculo de rol consumidor, ajeno a la selección.
- Autor:69/69 puras (decoder12, consumidores53, app-boundary4), tipos/lint/formato PASS. La guardia fue `tools/app-boundary.test.ts`4/4; no son las tres guardias de módulos. Backlog ajeno comunicado: dependencia expenses→stock y cinco literals core; no se ejecutaron ni se declaran verdes esas guardias.

No surgió duda concreta que requiriese duplicar DB: revisión independiente, reproducción decisiva del decoder y evidencia DB compatible bastan para este alcance. QA no ejecutó wrapper/DB ni accedió a env/PROD. El recurso CI quedó reservado exclusivamente a QA al terminar autor y se devuelve libre al coordinador, sin sesión DB propia.

## Límites y cierre

Sin fullverify, build/browser/M0/M1, mediciones de latencia ni certificación global/V4 operativo. No hubo cambios de esquema, traductores/eventos, tooling/kit/UI, estados/índices, refs principales, factory, push ni PROD. Sin procesos persistentes propios: todas las sesiones de tests/tipos/lint terminaron; inspección `lsof` desde fuera del WT no encontró CWD QA. El único archivo escrito por QA es este reporte. Aceptación e integración corresponden al coordinador.
