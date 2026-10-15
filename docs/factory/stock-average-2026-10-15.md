# Stock average — entrega focal 2026-10-15

Tarea `stock-average-fix-20261015`; base `a050c25eae8aaecb58637efbc6725131c6cf0932`. Código congelado `4cb0dcc92cd1469c5e7a7c365fa9b2ccdb57bec4`. Scope: `apps/merchant/src/modules/stock/stock-average.neon.integration.test.ts` y este handoff. Sin cambios de producto, reglas monetarias, motor de retries, relojes, presupuestos, límites, skips, dependencias, migraciones, refs principales o push.

## Fallo y diagnóstico

Suite completa original: un fallo en stock-average,3940PASS y282skips; no se presenta esa corrida como aprobada. El caso esperaba12.000 y promedio2.833333, pero obtuvo15.000 y2.666667. Eso demuestra ausencia de consumo confirmado antes de ponderar, **no demuestra por sí solo la causa** de la ausencia. Spec0228 permite que el intento de2s deje consumos pendientes y exige usar el ledger visible, sin rechazar la compra.

La fixture utiliza un subscriber temporal habilitado, un evento/delivery reales y `applyConsumption` real. No depende de la antigua UI ni del modelo de recetas anterior a R1; el publicador crea la delivery por elegibilidad de módulos. La hipótesis de fixture R1 incompatible quedó descartada por lectura y por ejecución observada.

Observación temporal, delegando siempre al retry real con los mismos argumentos: PASS10/10,92.81s. Registró negocio/local correctos, `budgetMs:2000`, `force:true`,2116ms, `{claimed:1,applied:1,pending:0,failed:0}`; delivery aplicada con un intento, ledger10/−3/5, saldo12 y promedio2.833333. Log saneado `/private/tmp/checkpass-stock-average-fix-20261015/average-observer.log`. Esta corrida **no reprodujo el fallo ni confirmó una causa de latencia para el rojo original**.

## Corrección de la prueba

El caso verifica una sola llamada al intento real con negocio/local/force/presupuesto2s exactos, conserva resultado o rechazo sin sustituirlo y restaura el spy en `finally`. Según la delivery persistida:

- Aplicada: exige resultado aplicado1, un único débito−3, saldo12 y promedio2.833333. El promedio y el ledger juntos prueban que el consumo precedió a la compra.
- Pendiente/en proceso: exige ningún débito parcial, resultado no aplicado o rechazo observado, saldo15 y promedio2.666667. Luego recupera la delivery real, exige un único débito−3, saldo12 y promedio conservado2.666667, y prueba replay sin duplicar consumo/reponderar.

La recuperación es el mismo helper ejecutado por los casos reales de fallo y timeout existentes; no queda como rama opcional sin prueba. Se conservan la compra del segundo local, el aislamiento404, los casos explícitos fallo/timeout y sus límites originales. No se aceptan dos importes sueltos ni se drena manualmente antes de la compra. La corrección adapta la expectativa al contrato y agrega comprobaciones de intento, atomicidad, orden y recuperación.

## Evidencia

- Node24.20.0, mismas dependencias/lockfile de la base.
- `pnpm exec eslint apps/merchant/src/modules/stock/stock-average.neon.integration.test.ts`: PASS exit0.
- `pnpm --filter @mi-pasaporte/merchant typecheck`: PASS exit0; `final-typecheck.log` externo.
- Diffcheck limpio.
- Antes de la corrida observacional, API pública GitHub confirmó0runs `in_progress` y0`queued`. `gh` no está instalado. CI reservada por coordinación, solo wrapper y archivo seleccionado `/private/tmp/checkpass-recipes-margin/0234-ci.env`; sin PROD ni acceso DB alternativo.
- La invocación final desde el worker fue rechazada **antes de crear proceso** por auto-review, que no vio la autorización del owner para la suite completa en el contexto del coordinador. No se intentó bypass. Coordinación ejecutó la misma selección acotada desde la conversación con autorización visible: average10 + average-rollback1 + concurrency1, `--no-file-parallelism`, sobre `4cb0dcc92cd1469c5e7a7c365fa9b2ccdb57bec4` congelado → **PASS3archivos/12tests**,0skips/0retries, exit0,121.8s, incluido teardown. Evidencia: `/private/tmp/checkpass-full-suite-20261015/stock-average-focal.log` y `stock-average-results.json`, con SHA/comando.

El wrapper conserva sus candados y migraciones habituales en CI; no se genera ni modifica SQL. Los logs del worker se sanearon antes de guardarlos. QA independiente pendiente del candidato final; aceptación/integración y liberación de CI quedan en coordinación. No procesos DB propios activos tras la observación; no se cambiaron fuentes entre el SHA probado y esta entrega documental.
