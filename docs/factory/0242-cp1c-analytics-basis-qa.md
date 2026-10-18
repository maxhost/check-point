# 0242 CP1c.4 — QA independiente de base financiera analytics

Veredicto: **PASS** sobre candidato congelado `0a699913afcb11f0ab0b7a946953255ab781b3b7`, rama/WT `pos-qa-0242` en `/private/tmp/checkpass-pos-0242/pos-qa-0242`. Autor entregado `9bc8f49faead7f430286c57c405d0039598d80f7`, código `00c8fd265f311b450e1de905e7900d0074a7c044`: diff del directorio analytics contra ambos sin diferencias. QA con contexto nuevo, sin subdelegación ni correcciones de producto.

## Revisión contractual

Leídos AGENTS, protocolos de trabajo/roles/verificación, ficha, handoff y contrato0242 §4. Scope observado: seis archivos analytics y handoff del autor; sin ampliación a storage, lectores, eventos, runtimeV4 o UI.

- `quantityExact` manda incluso frente a Number cero, contradictorio o NaN; unidades exactas deben ser integrales. Fallback solo para unidades enteras seguras no negativas; masa requiere cadena exacta. Entradas inválidas propagan `complete:false` y contribución `null`, sin throw ni sustitución de la cantidad por cero; el diagnóstico mensual existente es `sales_costs`.
- Helper decimal/racional BigInt suma y compara masa derivada14dec y agregados superiores a límites de captura sin parser9dec. Ventas diminutas de proyección0 siguen siendo ventas y filas relevantes.
- Completitud compara piezas y gramos por separado globalmente, por producto y por segmento día/local. Déficits/excesos entre dimensiones, productos, días o locales no compensan. `financialMetrics` conserva el filtro del dinero propio currency/minorUnit; igualdad física no admite costos monetarios ajenos. Montos y conteos capturados conservan sus condiciones previas, sin extrapolación.
- `unitCoverage` sigue siendo discreto y vale0 en una venta solo mass completa. La contribución depende de igualdad exacta, no de esa cobertura.
- Revisado el cambio del test legacy fraccionario: la nueva negativa obedece al contrato de piezas discretas/fallback entero seguro autorizado; conserva el negativo de compensación día/local y las filas agregadas eliminadas a cero. Los nuevos casos mass preservan el caso financiero decimal válido. No se observó otra regresión oculta; suites históricas de finanzas/dashboard y consumidores siguen pasando.

## Reproducción

Fecha: 2026-10-18. Runtime Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18` darwin-arm64. Todos los comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use &&`, desde el WT QA. Lockfile blob `abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`, hooks `.githooks`.

Inspección de `vitest.config.ts`: la configuración raíz enumera apps/db/tools, no domain. No se contabilizó un descubrimiento vacío como PASS. Config propia temporal externa `/private/tmp/0242-analytics-basis-qa-vitest.mjs`:

```js
export default {
  root: '/private/tmp/checkpass-pos-0242/pos-qa-0242',
  test: { environment: 'node', include: ['packages/domain/src/analytics/*.test.ts'] },
};
```

Comandos reproducidos y resultados:

```sh
pnpm exec vitest run --config /private/tmp/0242-analytics-basis-qa-vitest.mjs packages/domain/src/analytics/monthly-finance.test.ts packages/domain/src/analytics/quantity.test.ts packages/domain/src/analytics/dashboard-summary.test.ts
# exit0: 3 archivos, 62 PASS (48 monthly + 3 quantity + 11 dashboard).
pnpm exec vitest run apps/merchant/src/server/analytics/summary.test.ts apps/merchant/src/server/analytics/evaluation/domain.test.ts apps/merchant/src/server/analytics/evaluation/policy.test.ts apps/merchant/src/server/analytics/evaluation/policy-simulation.test.ts
# exit0: 4 archivos, 53 PASS (1 summary + 25 domain + 7 policy + 20 simulation).
pnpm --filter @mi-pasaporte/domain typecheck
pnpm --filter @mi-pasaporte/merchant typecheck
# ambos exit0.
pnpm exec eslint packages/domain/src/analytics/{metrics.ts,types.ts,quantity.ts,monthly-finance.ts,quantity.test.ts,monthly-finance.test.ts}
pnpm exec prettier --check packages/domain/src/analytics/{metrics.ts,types.ts,quantity.ts,monthly-finance.ts,quantity.test.ts,monthly-finance.test.ts}
git diff --check
# todos exit0.
```

Total115/115, sin fallos, skips ni retries. No se modificaron tests ni tooling del repositorio. Evidencia del autor reproducida directamente sobre la combinación congelada; no se trasladó su PASS por identidad supuesta.

## Límites y cierre

Sin DB, Neon, env, CI, migraciones, browser, build, globalverify ni M0/M1; no certifica lectores/eventos/runtimeV4 ni activación de masa. No se tocó producto, estados/índices comunes, factory, refs principales, push o PROD. Solo este informe es entrega de QA. Ningún pendiente de producto identificado en este bloque; aceptación/integración corresponde al coordinador.

Los comandos propios terminaron; `lsof -a -d cwd -Fpcn` sin coincidencias del WT confirma cero procesos con CWD QA. El estado del WT era limpio antes del informe. Hubo una consulta read-only accidental de status/diff desde principal durante la inspección de procesos; se descartó esa salida y se repitieron identidad/diff/status en el WT correcto, sin mutar principal.
