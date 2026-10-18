# 0242 CP1c.0 — contrato/decoder V4 dormido

Entrega de autor; pendiente QA independiente sobre candidato congelado. No declara CP1c completo ni activa masa/productores/subscribers.

- Base: `a75c90b2a32b260b8cf915eb1de68c79d1e64391`.
- Revisión de código verificada: `4a2d818760c98c7f22ecdff52b2263eaaf6327be`; árbol `7955d60cb1b077a0bb7d2f7f363ed0dc40b279d6`. El commit posterior añade únicamente este handoff; el SHA de entrega se comunica al coordinador al cerrarlo.
- Worktree: `/private/tmp/checkpass-pos-0242/pos-ui-0242`, rama local `pos-ui-0242`; limpio al inicio sobre la base indicada.
- Paths reales: `apps/merchant/src/server/module-events/{types.ts,decode.ts,decode.test.ts,decode-measured.test.ts}` y este documento. Sin cambios de índices/estado común.

## Contrato entregado

`SaleClosedEventV4` deriva de V3: cambia eventVersion y quantity decimal string, añade measure explícita y conserva los campos monetarios, originales, pagos, provenance, etiqueta y comisión. No añade unitPrice.

`MeasuredSaleClosedEvent = SaleClosedEvent | SaleClosedEventV4` es una unión **wire**: V1–V3 conservan su shape histórico. `decodeMeasuredSaleClosedEvent(value, eventVersion?)` devuelve el payload validado original por identidad; la versión externa opcional debe coincidir. La API legacy `SaleClosedEvent`/`decodeSaleClosedEvent` continúa admitiendo solo V1–V3 y rechazando V4. CapturedModuleEvent, subscriptions y wiring no cambian.

La vista explícita separada `toMeasuredSaleClosedEventView(payload)` devuelve `MeasuredSaleClosedEventView {payload, lines}` para un payload ya validado. Conserva acceso al original y copia las líneas; legacy interpreta quantity como string y measure unit sin inventar money V1. Esa vista no es un payload durable. Los bloques financieros/referencias anidados conservan la evidencia original; no hay recálculo ni redistribución monetaria.

V1–V3 mantienen el rango histórico entero positivo safeInteger, incluso `Number.MAX_SAFE_INTEGER`; la vista no aplica el límite INT32 de DB. V4 exige strings/measure y valida unit con el helper de snapshot confiable INT32 y mass con captureQuantity de hasta 9 decimales/límite vigente. parseMeasure valida unidades y conversionVersion. No decide contrato por typeof string ni UUID. El núcleo financiero y los metadatos V3/V4 se validan en funciones compartidas; V4 valida también UUID de originales de pago inefectivos.

## Evidencia

Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`. Antes de comandos Node/pnpm: `source ~/.nvm/nvm.sh && nvm use`. Sin cambio de dependencias/configuración. Config merchant: `apps/merchant/vitest.config.ts`; setup `AI_PROVIDER=fake` y elimina OPENAI_API_KEY; no DB ni proveedor real.

SHA256 de archivos de identidad:

| Archivo | SHA256 |
| --- | --- |
| pnpm-lock.yaml | `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821` |
| apps/merchant/vitest.config.ts | `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81` |
| apps/merchant/vitest.setup.ts | `1e1dc6157e3f976c83c10ff5d740fbfba6cf6b9aaec2df59a301c495dba26f5f` |
| tsconfig.base.json | `ad2cb8603f3deba9707ff74c7d2fd04b5512fd33b6b264ff9700365f544e4f02` |
| apps/merchant/tsconfig.json | `aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0` |
| packages/domain/tsconfig.json | `716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861` |

Resultados finales, sin skips/retries:

- Desde `apps/merchant`: `pnpm exec vitest run src/server/module-events/decode.test.ts src/server/module-events/decode-measured.test.ts src/modules/pos/financial-measures.test.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts`: **5 archivos, 157 tests PASS** (6 + 68 + 28 + 43 + 12). Reproducido tras congelar el commit de código.
- Desde raíz: `pnpm --filter @mi-pasaporte/merchant typecheck` y `pnpm --filter @mi-pasaporte/domain typecheck`: ambos exit0.
- `pnpm exec eslint apps/merchant/src/server/module-events/types.ts apps/merchant/src/server/module-events/decode.ts apps/merchant/src/server/module-events/decode.test.ts apps/merchant/src/server/module-events/decode-measured.test.ts`: exit0.
- `pnpm exec vitest run tools/app-boundary.test.ts`: **1 archivo, 4 tests PASS**, sin skips/retries. La importación nueva es exclusivamente del dominio compartido.
- `pnpm exec prettier --check` sobre los cuatro TS cambiados: exit0; `git diff --check`: exit0. Formato de este handoff comprobado al cierre.

Casos decisivos: igualdad/identidad completa wire V1–V3 y ausencia de mutación/dinero fabricado; vista separada y safeInteger sobre INT32; V4 unit/mass/mixta en USD/COP, cero sin pagos, 1lb→453.59237g, captura 9dec→gramos 14dec, originales racionales no terminantes, pagos inefectivos auditados. Negativos: versiones desconocidas/envelope mismatch, string en legacy, medidas ausentes/incoherentes/conversión ajena, quantity número/fractional unit/exponente/escala/rango inválidos, IDs/refs/fecha, sourceLineId duplicado, metadatos/comisión, position, originales/money/pagos corruptos y overflow monetario.

Fallos intermedios resueltos: selector inicial `--project apps/merchant` no coincide con un proyecto nombrado (startup sin tests); ejecución correcta desde cwd merchant. Typecheck detectó acceso a money sin narrow de versión en un test y ESLint detectó tres bindings de fixture sin uso; corregidos antes del PASS final. No se relajó ningún test ni se contabilizó un fallo como PASS.

## Límites y siguiente paso

Sin Neon, DB, build, browser ni activación operacional: bloque puro. Sin push/PROD, factory deliver/accept, integración, migraciones o refs principales. Sin servidores/túneles/procesos persistentes propios. Ningún pendiente de implementación dentro de estos paths; el coordinador entrega el candidato congelado a QA independiente y controla aceptación/integración. Productor V4 y consumidores requieren otras fichas/autores.
