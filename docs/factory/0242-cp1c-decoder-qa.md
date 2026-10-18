# 0242 CP1c.0 — QA independiente del decoder dormido

Resultado: **PASS** de entrega y combinación focal sobre candidato congelado `639aff67dc9ef79a16f52ff5d2d293033938ce22`. No declara CP1c completo ni activa V4/masa operacional.

- Base de integración aceptada: `0c7f503baa2e1d2372ba7fb6927b38a96a549210`.
- Entrega de autor: `9619567473a6c02c78cca8d695477761db41327c`; código `4a2d818760c98c7f22ecdff52b2263eaaf6327be`.
- Worktree QA: `/private/tmp/checkpass-pos-0242/pos-qa-0242`, limpio antes de verificar. Sin implementación de producto ni cambios de estados/índices.
- Runtime: Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`. Todos los comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use`.

## Revisión de aceptación e interacción

Leídos AGENTS, protocolos de paralelo/workflow/verificación, ficha completa CP1c.0, anexo0242 §4, tipos y helpers pertinentes de medidas/financial. Revisados diff de código/tests y handoff. El diff desde la base contiene únicamente los cuatro TS reservados y el handoff; `git diff 4a2d8187 HEAD -- apps/merchant/src/server/module-events` está vacío.

`SaleClosedEvent` y su decoder conservan V1–V3. El núcleo financiero extraído mantiene sus validaciones legacy; V4 lo reutiliza. La unión medida es wire y el decoder devuelve el payload original por identidad. La vista separada copia líneas, interpreta legacy como unit con quantity string y preserva payload/bloques originales, sin fabricar money V1. El límite safeInteger legacy no se estrecha a INT32. V4 exige versión, strings y measure explícitos, unit usa trusted INT32 y mass captura de nueve decimales; no hay selección por typeof ni fallback ante measure inválida.

Los tests observados cubren identidad/inmutabilidad V1–V3, cantidades legacy por encima de INT32, V4 unit/mass/mixta, USD/COP, cero sin pagos, libras/gramos exactos y originales racionales. Los negativos cubren versión externa/payload, medidas/unidades/conversión, cantidad/escala/rango, IDs/refs/fecha/duplicados, metadata y consistencia financiera/pagos. No se recalcula dinero desde cantidades ni desde una proyección redondeada.

Búsqueda `rg -n 'decodeMeasuredSaleClosedEvent|SaleClosedEventV4|MeasuredSaleClosedEvent' apps packages --glob '*.ts'`: usos limitados a tipos/decoder/test nuevo. `CapturedModuleEvent`, publish, subscribers y consumers siguen legacy. La combinación sobre dev aceptado no añade conexiones operacionales ni cambios DB.

## Evidencia reproducida

Ejecución única, sin skips/retries ni fallos:

- Desde `apps/merchant`: `pnpm exec vitest run src/server/module-events/decode.test.ts src/server/module-events/decode-measured.test.ts src/modules/pos/financial-measures.test.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts` → **5 archivos, 157 tests PASS**, exit0 (6 legacy + 68 medido + 28 financial-measures + 43 measure-contract + 12 financial).
- Desde raíz: `pnpm --filter @mi-pasaporte/merchant typecheck` y `pnpm --filter @mi-pasaporte/domain typecheck` → ambos exit0.
- Desde raíz: `pnpm exec vitest run tools/app-boundary.test.ts` → **1 archivo, 4 tests PASS**, exit0.
- `git diff --check` → exit0. Lint y formato de los cuatro TS se reutilizan del autor: mismos blobs de código, lockfile y configuración; sin ampliación de checks por ceremonia.

Identidad de entorno comprobada con `shasum -a 256 pnpm-lock.yaml apps/merchant/vitest.config.ts apps/merchant/vitest.setup.ts tsconfig.base.json apps/merchant/tsconfig.json packages/domain/tsconfig.json`; todos coinciden con el handoff:

| Archivo | SHA256 |
| --- | --- |
| pnpm-lock.yaml | `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821` |
| apps/merchant/vitest.config.ts | `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81` |
| apps/merchant/vitest.setup.ts | `1e1dc6157e3f976c83c10ff5d740fbfba6cf6b9aaec2df59a301c495dba26f5f` |
| tsconfig.base.json | `ad2cb8603f3deba9707ff74c7d2fd04b5512fd33b6b264ff9700365f544e4f02` |
| apps/merchant/tsconfig.json | `aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0` |
| packages/domain/tsconfig.json | `716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861` |

## Fallos, límites y cierre

Sin hallazgos ni pendientes de producto dentro del encargo. Sin Neon/DB/build/browser: cambio puro; esta evidencia no certifica futuros productores/consumidores V4 ni venta por masa operacional. Sin push/PROD, factory deliver/accept ni modificación de refs principales. Los tres comandos de verificación terminaron exit0; sin servidores, túneles o procesos persistentes propios. El coordinador conserva aceptación/integración y cleanup.
