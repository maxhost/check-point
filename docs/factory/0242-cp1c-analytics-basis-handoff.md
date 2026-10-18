# 0242 CP1c.4 — Base financiera con cantidades exactas separadas

- Task/rama: `pos-recipes-exact-0242`; ficha `0242-cp1c-analytics-basis.md`.
- Base confirmada limpia: `1f207a0cb569659ae1a2f2715c5cf732a782ee5f`.
- Código congelado: `00c8fd265f311b450e1de905e7900d0074a7c044`. El commit documental que contiene este handoff es la revisión final entregada, con código idéntico.
- WT: `/private/tmp/checkpass-pos-0242/pos-recipes-exact-0242`.
- Archivos: analytics `metrics.ts`, `types.ts`, `monthly-finance.ts`, `quantity.ts`, `monthly-finance.test.ts`, `quantity.test.ts` y este handoff. No fue necesario modificar `financial-metrics.ts`: reconoce automáticamente el vocabulario quantity agregado.

## Contrato y comportamiento

`quantityExact` es la autoridad cuando existe, incluso con proyección Number contradictoria, cero o NaN. El helper puro usa decimal/racional BigInt existentes, admite gramos derivados de 14 decimales y agregados superiores a límites de captura, sin parser de entrada ni reconstrucción desde Number. `units_sold`/`units_with_cost` admiten solo cantidades discretas no negativas; el fallback legacy exige entero seguro. `mass_sold_g`/`mass_with_cost_g` requieren cadena exacta no negativa.

Una cantidad inválida devuelve `null` internamente y propaga `complete:false`, `contribution:null`; en la API mensual produce `sales_costs`, conservando montos capturados. No se sustituye por cero ni se añade un nuevo contrato público de diagnóstico/cobertura. `unitCoverage` conserva piezas, incluida cobertura0 para ventas solo mass completas. La igualdad exacta por ambas dimensiones gobierna completitud global, por producto y por día/local; el filtro monetario propio currency/minorUnit sigue operando antes del cálculo mensual. No se extrapolan ingresos, costos ni comisiones.

La detección de ventas y filas relevantes reconoce cantidades exactas positivas aunque su proyección sea0, incluidas ventas neto0/costo0. Cantidades huérfanas conocidas y cantidades inválidas no certifican completitud. Agregados vacíos y ceros exactos conservan contribución0.

El test anterior aceptaba piezas fraccionarias legacy sumadas desde Number (`0.1+0.2=0.3`). El contrato cerrado solo permite fallback entero seguro y piezas discretas: ahora ese caso exige `sales_costs`, con autorización del coordinador. Se conserva su negativo de compensación día/local y su caso de agregados eliminados en cero. Se añade cobertura válida de masa decimal exacta, sin perder los casos monetarios existentes.

## Evidencia focal

Entorno Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`; lockfile intacto blob `abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`; hooks configurados `.githooks`. Todos los comandos Node/pnpm se ejecutaron con `source ~/.nvm/nvm.sh && nvm use &&` en el WT asignado.

Sobre código congelado: dominio 62/62 (monthly48, dashboard11, helper3), consumidores merchant53/53 (summary1, domain25, policy7, simulation20), sin fallos/retries/skips. Tipos domain y merchant PASS exit0. Lint/formato de los seis archivos de código y `git diff --check` PASS antes de congelar, sobre contenido idéntico.

```sh
pnpm exec vitest run --config /private/tmp/0242-analytics-basis-vitest.mjs packages/domain/src/analytics/monthly-finance.test.ts packages/domain/src/analytics/quantity.test.ts packages/domain/src/analytics/dashboard-summary.test.ts
pnpm exec vitest run apps/merchant/src/server/analytics/summary.test.ts apps/merchant/src/server/analytics/evaluation/domain.test.ts apps/merchant/src/server/analytics/evaluation/policy.test.ts apps/merchant/src/server/analytics/evaluation/policy-simulation.test.ts
pnpm --filter @mi-pasaporte/domain typecheck
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec eslint packages/domain/src/analytics/{metrics.ts,types.ts,quantity.ts,monthly-finance.ts,quantity.test.ts,monthly-finance.test.ts}
pnpm exec prettier --check packages/domain/src/analytics/{metrics.ts,types.ts,quantity.ts,monthly-finance.ts,quantity.test.ts,monthly-finance.test.ts}
git diff --check
```

El primer intento Vitest con configuración raíz devolvió exit1 «No test files found»: los proyectos vigentes no descubren tests de dominio. No es PASS ni fallo de producto. Para reproducir los 62 casos se creó exclusivamente fuera del repo `/private/tmp/0242-analytics-basis-vitest.mjs`, sin cambiar tooling:

```js
export default {
  root: '/private/tmp/checkpass-pos-0242/pos-recipes-exact-0242',
  test: {
    environment: 'node',
    include: ['packages/domain/src/analytics/*.test.ts'],
  },
};
```

Los gates cubren ventas unit/mass/mixtas (también ambas dimensiones en el mismo producto), diferencias sub-Number/14dec y agregados grandes, autoridad exacta, masa sin exacto, unidades fraccionarias/unsafe/no finitas, compensación producto/día/local y entre dimensiones, moneda/minorUnit ajenos, neto/costo0, ausencia y huérfanos.

## Límites y siguiente paso

Sin DB/Neon, migraciones, lectores merchant, SQL, traductores/eventos, runtime mass/V4, UI/ranking, kit/auth, deps/tooling repo, estados/índices, push ni PROD. Esta base pura no habilita V4: otro autor debe conectar almacenamiento, reader exacto y eventos antes de activarlo. No se ejecutó fullverify, build, DB ni browser por scope.

El primer `git add` documental fue bloqueado por sandbox (`index.lock: Operation not permitted`); se avisó inmediatamente al coordinador y se completó mediante escalación limitada a add/commit del handoff propio. `ps` también quedó bloqueado; `lsof -a -d cwd -Fpcn` desde el checkout principal confirmó cero procesos con CWD del WT tras finalizar comandos.

Sin procesos persistentes propios; tests y typechecks terminaron. Sin pendiente conocido de este bloque; falta QA independiente sobre revisión congelada y aceptación/integración del coordinador. Factory y refs principales quedan al coordinador. Conservar WT/entrega hasta aceptación; no iniciar siguiente bloque con este agente.
