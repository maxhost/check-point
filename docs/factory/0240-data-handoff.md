# Entrega stock-cost-data-0240

Base: `ac5fedf860df80af74f33a482a714cf5293631b2`. Rama: `stock-cost-data-0240`.
La revisión entregada es el commit que contiene este handoff; SHA exacto registrado por `factory deliver` y en `/private/tmp/checkpass-0240-evidence/data/revision.txt`.

## Alcance

- Builder puro `packages/domain/src/analytics/stock-cost-history.ts` y ocho casos de dominio en su `.test.ts`.
- `apps/merchant/src/server/analytics/queries/index.ts`: añade `stockCosts` usando las filas ya leídas, labels y locations del input. No cambia SQL, `summarizeStockHistory`, guards, permisos ni endpoints.
- Tres pruebas reales en `apps/merchant/src/server/analytics/queries/stock-cost.neon.integration.test.ts`.
- Contrato compartido `stock-cost-contract.ts` consumido sin modificarlo.

Cada serie conserva el par insumo/local y su unidad base (`g`, `ml`, `unit`), con ID estable mediante tupla JSON. Filtra moneda/minorUnit/unidades ajenas, fechas inválidas/futuras y decimales inválidos/negativos. Los costos se conservan como string exacto, incluidos cero/subcentavo; no pasan por number. Mantiene una observación por día, elegida por instante observado y eventId, más una sola observación anterior real con su fecha original. No rellena días. El default prioriza comparables, última observación y etiqueta/id estables. También admite un único baseline sin registros nuevos; no inventa una observación en el período.

## Evidencia

Entorno: Node `v24.20.0`, pnpm `11.4.0`, lockfile de la base sin cambios. Evidencia fuera del WT: `/private/tmp/checkpass-0240-evidence/data/`.

- PASS: `pnpm exec vitest run --config /private/tmp/checkpass-0240-evidence/data/vitest.domain.config.mts`: 8 tests, 1 archivo, 0 skips (`domain.log`). Config temporal externa necesaria porque el proyecto raíz no incluye tests de dominio.
- PASS: `NEON_TEST_ENV_FILE=/Users/maxi/Documents/claude-workspace/check-point/apps/merchant/.env.local tools/neon-test.sh src/server/analytics/queries/stock-cost.neon.integration.test.ts --no-file-parallelism`: 3 tests, 1 archivo, 0 skips (`neon.log`). Wrapper con interlock antiPROD; únicamente claves CI seleccionadas. Migraciones existentes aplicadas por wrapper, sin DDL nuevo. Fixtures de dos tenants y tres locales borradas en `afterAll` completado.
- Neon verifica fechas/importe exacto, baseline real, período 3m, ausencia de moneda/unidad/futuro ajenos, negativos, no mezcla tenant/local/labels y 404 de local ajeno antes de lecturas históricas. Spy observa ejecuciones reales sin sustituir transporte/SQL/resultados: 5 queries para history, 1 para rechazo de local ajeno.
- PASS: `pnpm --filter @mi-pasaporte/domain typecheck` y `pnpm --filter @mi-pasaporte/merchant typecheck` (`domain-types.log`, `merchant-types.log`).
- PASS: ESLint focal sobre los cuatro archivos TypeScript (`lint.log`); Prettier check sobre esos archivos; `git diff --check`.
- PASS: `pnpm exec vitest run --config tools/vitest.config.ts tools/app-boundary.test.ts` (`boundary.log`).

Los ocho casos de dominio cubren meses/períodos/año bisiesto, baseline real, observaciones escasas, orden/desempate diario, prioridad/default estable, separación insumo/local/unidad, fallback de etiquetas/local, empty/singleton/baseline-only/plano/cero/subcentavo, filtros inválidos/futuros y no mutación/ID estable.

## Límites y siguiente paso

Sin fallos conocidos ni procesos propios pendientes. No se ejecutaron verify global, campañas M1, browsers, servidores, demos, túneles ni operaciones PROD. El recurso DB queda sin procesos de esta entrega; la reserva la gestiona el coordinador. Pendiente QA independiente y combinación con la entrega UI; esta evidencia de datos no certifica UI. No se integra, actualiza main/dev ni se publica desde este WT.
