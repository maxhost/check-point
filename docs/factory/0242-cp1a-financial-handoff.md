# 0242 CP1a — Financial puro medido

- Task/rama: `pos-data-0242`; ficha `docs/factory/0242-cp1a-financial.md`.
- Base exacta limpia: `00efff814a1939b25006af36c7dbfb04758f3256`.
- Código congelado: `7e13808d2f17cdbef75e95c58670c08ef0c525fa`. El commit documental que contiene este handoff es el candidato de entrega; no cambia código respecto de ese SHA.
- Worktree: `/private/tmp/checkpass-pos-0242/pos-data-0242`.
- Scope real: `packages/domain/src/financial.ts`, `financial/{types,settlement,validate}.ts`, `measures/types.ts`, `apps/merchant/src/server/financial.test.ts`, `apps/merchant/src/modules/pos/financial-measures.test.ts` y este handoff.

## Contrato implementado

Los builders públicos reciben `FinancialInput | FinancialInputV2`. Una medida presente siempre entra a validación medida; una cantidad string sin medida no activa ningún contexto confiable. El legacy conserva quantity number entero seguro y el parser monetario anterior, sin imponer INT32. V2 exige cantidad decimal string, medida explícita y parsers de captura/tarifa nuevos.

`buildFinancialAmountsFromSnapshots` y `buildFinancialSettlementFromSnapshots` son adaptadores explícitos para snapshots confiables con quantity string/measure. Reutilizan CP0: unit conserva INT32 y tarifa legacy numeric(12,2), mass conserva los límites nuevos. No se selecciona confianza por typeof string. `FinancialInputV2` se declara una vez en financial/types y se reexporta desde measures/types.

Ambos contextos producen originales racionales y comparten un núcleo de reparto/normalización/pagos. No se redondea tarifa o masa antes del total. Conserva IDs/posiciones, descuentos de orden/línea, pagos duplicados/requeridos/neto0, originales y ajustes. Rechaza dinero fuera de numeric(12,2) por línea/agregado, originales y salida normalizada; el validador durable también rechaza bloques fuera de rango. No cambia forma de settlements guardados ni agrega selección de cupones de negocio.

## Evidencia

Entorno: Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`; lockfile sin cambios, blob `abcbe3dcc0f110f6c2e5395da4360c32ca7ccf44`. Configs existentes raíz/merchant, sin cambios; setup merchant usa fake IA. Cada comando Node/pnpm se ejecutó con prefijo `source ~/.nvm/nvm.sh && nvm use &&` en el worktree asignado.

Comprobación final de comportamiento (mismo código que el SHA congelado):

```sh
pnpm exec vitest run apps/merchant/src/server/financial.test.ts apps/merchant/src/modules/pos/financial-measures.test.ts apps/merchant/src/modules/pos/measure-contract.test.ts apps/merchant/src/server/module-events/decode.test.ts
```

PASS: 4 archivos, 88 pruebas, 0 fallos/0 skips: financial existente+equivalencia 12, financial medido 28, CP0 medidas 43, decode durable 5. Ejemplos lb/g, conversiones equivalentes, cociente no terminante, tarifa9dec, subcentavo/masa+unit, monedas0/2, total0, reparto, pago auditado, negativos de medida/exponente/overflow y snapshots extremos. La equivalencia compara el settlement completo legacy/v2 de escenarios de descuento orden/línea con ambos minorUnit, sin copiar el algoritmo.

Checks adicionales PASS exit0:

```sh
pnpm --filter @mi-pasaporte/domain typecheck
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec prettier --check packages/domain/src/financial.ts packages/domain/src/financial/types.ts packages/domain/src/financial/settlement.ts packages/domain/src/financial/validate.ts packages/domain/src/measures/types.ts apps/merchant/src/server/financial.test.ts apps/merchant/src/modules/pos/financial-measures.test.ts
pnpm exec eslint packages/domain/src/financial.ts packages/domain/src/financial/types.ts packages/domain/src/financial/settlement.ts packages/domain/src/financial/validate.ts packages/domain/src/measures/types.ts apps/merchant/src/server/financial.test.ts apps/merchant/src/modules/pos/financial-measures.test.ts
git diff --check
```

Los typechecks se ejecutaron antes de añadir el último caso de rechazo durable/pagos al archivo nuevo; el código de producto ya era idéntico al congelado. Vitest, formato y lint finales incluyen ese caso. Corridas incrementales anteriores: 80/80 y 82/82 al añadir cobertura; ninguna prueba fallida, retry ni skip. Lectura inicial intentó archivos measures/index.ts y measures/money.ts inexistentes; se resolvió leyendo el barrel measures.ts y mass.ts reales, sin impacto de producto.

## Límites y siguiente paso

Sin DB/Neon, schema, HTTP, UI, auth, eventos producer, cupones de negocio, dependencias, tooling, estados/índices ni refs principales. Sin push/PROD. No hubo servidor ni proceso persistente propio; typechecks terminaron. No hay pendiente de implementación CP1a conocido; falta QA independiente sobre el candidato congelado y aceptación/integración del coordinador. No iniciar el siguiente bloque con este agente.
