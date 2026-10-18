# Entrega finance-data-0241 — modelo mensual v2

Base `34263158f6ed8ee87d1c6d3a4a74952fcedcb611`; rama `finance-data-0241`. La revisión entregada es el commit que contiene este handoff; SHA exacto en factory y `/private/tmp/checkpass-0241-evidence/data/revision.txt`.

## Alcance y contrato

- Contrato `monthly-finance-contract.ts` consumido sin modificarlo (writer coordinador).
- Nuevos `monthly-finance.ts`, `financial-metrics.ts` y tests de dominio dentro de `packages/domain/src/analytics`.
- Consumidores comunes: `cards/index.ts`, `history.ts`, summary cálculo/contrato/tests; política/config revisión `monthly-finance-2`, contextos de meta y calculationKey versión2. Contexto de invitación gastos también identifica cálculo2.
- Servidor: `queries/index.ts` conserva local de ingresos/costos/comisiones/unidades conocidas en proyección principal/extendida, sin consultas adicionales. Ajuste autorizado del oracle SQL independiente `snapshot-equivalence.test-support.ts` para la misma segmentación; no se afirma equivalencia con el modelo1 que borraba esos locales. Nuevos negativos reales `queries/monthly-finance.neon.integration.test.ts`.
- Regresiones v1 actualizadas en `evaluation/domain.test.ts` y `evaluation/policy-simulation.test.ts` por el cierre normativo, sin modificar tooling/guards/kit/UI ni módulos origen.

Finance separa registrado/referencia/pendiente/previsión por concepto fijo y agregado variable. Referencias exclusivamente en los tres meses calendario previos por defecto con total positivo observado, cada media redondeada una vez a unidades menores, y totales sumados exactamente. Desconocido permanece null. Sin referencia del fijo actual o del agregado variable no se publica previsión/meta.

Costos completos por producto y segmento día/local: unidades exactas racionales, ventas y ventas conocidas iguales, coherencia de contadores de costo/ingreso/comisión conocidos, y comisión total concordante. No compensar exceso conocido de otro producto/local/día. Sin ventas actuales, aporte0 válido; referencias exigen ventas positivas completas en28días hasta ayer por defecto (overrides de política se comparten con las ventanas del lector). Filas residuales0 de fuentes revertidas no inventan ventas. Costo/comisión0 explícitos son válidos.

Adicionales = ceil(max(previsión−aporte actual,0) × ventas referencia / aporte referencia); objetivo total = ventas actuales + adicionales. Sin floats para decidir dinero. Coberturas/ratio de margen son informativos. Ejemplo real CI: previsión550, aporte actual60, margen referencia50%, adicionales980, objetivo total1080. Goal legado `expensesMinor=forecast??recorded`, `breakEvenMinor=totalSalesTargetMinor`; ritmo/riesgo/meta diaria conservan condición previa usando restantes nuevos. No extrapolación de ventas sin costo ni compras stock añadidas como gasto.

Summary conserva version1: `sales_costs→cost_coverage`, `reference_sales→closed_month` (alias legado, no cierre contable), `expense_history→expense_history`, `positive_margin→positive_margin`. Prioridad coherente costos/referencia/gastos/margen. Today revenue y sumas de Histórico/goal/resumen/Inbox filtran moneda+minorUnit propios; métricas de cantidades permanecen. Ingestión conserva monedas ajenas segregadas sin cambiar DB/legacy. Inbox3 sólo con meta válida; Inbox4 mantiene condición/invitación y ya no promete que un primer cierre basta para calcular. Revisión de política invalida lecturas previas por la reevaluación normal existente; no reset manual de decisiones ni DB.

## Checks y evidencia

Node24.20.0, pnpm11.4.0; lockfile/base sin cambios. Artefactos fuera WT `/private/tmp/checkpass-0241-evidence/data/`.

- PASS dominio: configuración Vitest temporal externa `vitest.domain.config.mts` por include del repo. `monthly-finance.test.ts`20 + `dashboard-summary.test.ts`11 =31 tests, cero skips (`domain.log`). Referencias, parciales, meses ausentes/antiguos, rounding por entrada, costos incompletos/hoy, todos los componentes faltantes, compensación producto/día/local, fracciones0.1+0.2=0.3, overrides de ventana de política coherentes con lector, cero, sin ventas, margen nulo/negativo, cubierto, monedas/unidades, consumidores, contextversion2 y no mutación.
- PASS regresiones focales: `pnpm --filter @mi-pasaporte/merchant exec vitest run src/server/analytics/evaluation/domain.test.ts src/server/analytics/evaluation/policy.test.ts src/server/analytics/evaluation/policy-simulation.test.ts src/server/analytics/http/history.test.ts src/server/analytics/summary.test.ts`:59 tests/5archivos, cero skips (`regression.log`).
- PASS NeonCI aislado: `NEON_TEST_ENV_FILE=/Users/maxi/Documents/claude-workspace/check-point/apps/merchant/.env.local tools/neon-test.sh src/server/analytics/queries/monthly-finance.neon.integration.test.ts --no-file-parallelism`:2tests, cero skips, teardown de dos tenants/usuarios y tres locales completado (`neon.log`). Wrapper protegido antiPROD, migraciones existentes únicamente. Tenant/local/moneda/minorUnit reales, segmentos preservados, sin compensación local, wiring history/summary/Inbox, invariancia mes/3m, endpoint autenticado DTO/private-no-store y rechazo404 local ajeno.
- PASS typecheck dominio (`domain-types.log`).
- FAIL LIMITADO typecheck merchant (`merchant-types.log`): único TS7053 en UI base `src/app/backoffice/analytics/dashboard-summary.tsx:90`, map de copy sin `expense_history`. Path pertenece al implementadorB; coordinador informado y autoriza entrega con límite explícito. No se declara PASS; debe repetir en combinación conB.
- PASS ESLint focal sobre archivos propios (`lint.log`), Prettier (`format.log`), `git diff --check`, app-boundary4/4 (`boundary.log`).

## Fallos encontrados y resueltos

Primera tanda v2: nuevos17tests PASS, seis expectativas summaryv1 FAIL porque fixtures no tenían referencias completas/comisión/product revenue. Se completaron fixtures válidas y expectativas de objetivo dinámico/cubierto.

Primera regresión merchant:50PASS/9FAIL por expectativas/fixtures modelo1: referencia de meses antiguos, promedio variable dividido siempre3, costos parciales tratados como margen suficiente, comisiones explícitas ausentes y equivalencia literal al oracle legado. Se sustituyeron por aserciones del cierre aprobado: calendario observado3meses, costos completos y referencias requeridas. Overflow sigue probado con snapshot completo válido; datos incompletos siguen negativos y no producen metas. Resultado final59PASS sin skips. Primer ESLint señaló import/argumento sin uso tras quitar modelo1; resuelto. Revisión del coordinador preservó los overrides de ventanas financieras de política con un caso focal: defaults28/3, configuraciones personalizadas compartidas entre lector y cálculo.

## Límites y siguiente paso

Pendiente QA independiente/combinación conB y typecheck merchant combinado. No browsers/UI ni métricas nuevas M1/performance certificadas: preservar locales puede aumentar payload respecto de agrupación previa; no hay promesa de rendimiento ni campañas globales. Sin verify global ni semillas/reflejos de demos, DB local, reset de decisiones, migraciones nuevas, dependencias, push o PROD. Procesos de pruebas propios terminados, teardown CI completo; coordinador gestiona reserva/QA/factory e integración. Evidencia de datos no certifica la UI.
