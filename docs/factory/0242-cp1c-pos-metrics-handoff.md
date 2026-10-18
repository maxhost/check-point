# 0242 CP1c.6 — traductor POS medido

Entrega de autor, pendiente QA independiente/aceptación. No activa masa ni publicación V4.

- Base exacta y limpia inicial: `7428fe197d8481644e24d459e0b4fe9e2f4fca41`.
- Worktree/rama: `/private/tmp/checkpass-pos-0242/pos-metrics-0242`, `pos-metrics-0242`.
- Código POS: `d3c40dfcdffda050bc96de4673ffc5c4a1c376f6`.
- Código final con fixture corregido: `3e1bffed6303cfed3a3114c44355262a3b3bea20`. El commit siguiente solo añade este handoff; SHA final comunicado al coordinador.
- Paths: `apps/merchant/src/modules/pos/server/metrics.ts`, `metrics-measured.test.ts`, este documento y `apps/merchant/src/modules/analytics-an3-translators.test.ts`. El último path se amplió explícitamente por el coordinador, con reserva/ficha principal en `f56f1bdc`, antes de editarlo. No se incorporó esa ref ni se alteraron refs principales.

## Cambio y criterios

El traductor puro usa `decodeMeasuredSaleClosedEvent(payload, eventVersion)`; rechaza desacuerdo con envelope antes de generar resultado. Mantiene resultados completos legacy1–3, ausencia financiera V1, sourceKey/revision1 de venta y sourceRevision2 por cupón. V4 unit conserva units_sold; V4 mass emite mass_sold_g mediante exactGrams desde quantity/quantityUnit capturados. Ningún Number, redondeo ni parser9dec sobre gramos derivados; lb9dec conserva14dec. priceUnit no cambia masa y campos extra medidos en legacy no cambian la interpretación unitaria histórica.

Ingresos, netos/campañas, normalización/originales y pagos siguen los snapshots sin recálculo ni mutación. Frecuencia product_revenue cuenta una vez por producto/orden aun con líneas mixtas duplicadas. Se conserva agrupación por cupón y rechazo de campañas inconsistentes para un mismo sourceId. No hay resultados parciales ante error.

28 casos nuevos: traducciones completas esperadas1–3; V4 unit igual a3; legacy safeInteger sobre INT32; kg/lb/g equivalentes; extremos lb9dec→14dec; mezcla del mismo producto; USD/COP; neto0 totalmente descontado; original racional no terminante normalizado a0; priceUnit independiente; replay puro estable; negativos de versión externa, medida, conversión/cantidad/origen. El decoder aporta negativos de envoltura, procedencia y settlement en la suite focal existente.

## Entorno y reproducción

Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`. Cada comando Node/pnpm precedido por `source ~/.nvm/nvm.sh && nvm use` desde el worktree. Dependencias propias existentes, sin cambios de deps/config/env. Config merchant `apps/merchant/vitest.config.ts`, setup `apps/merchant/vitest.setup.ts` fija AI_PROVIDER=fake y elimina OPENAI_API_KEY; no DB ni proveedores reales.

Identidad SHA256:

| Archivo | SHA256 |
| --- | --- |
| pnpm-lock.yaml | `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821` |
| apps/merchant/vitest.config.ts | `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81` |
| apps/merchant/vitest.setup.ts | `1e1dc6157e3f976c83c10ff5d740fbfba6cf6b9aaec2df59a301c495dba26f5f` |
| tsconfig.base.json | `ad2cb8603f3deba9707ff74c7d2fd04b5512fd33b6b264ff9700365f544e4f02` |
| apps/merchant/tsconfig.json | `aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0` |
| packages/domain/tsconfig.json | `716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861` |

Resultados sin skips/retries:

- En cwd `apps/merchant`, `pnpm exec vitest run src/modules/pos/server/metrics-measured.test.ts src/server/module-events/decode-measured.test.ts src/server/module-events/decode.test.ts src/modules/pos/financial-measures.test.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts`: **6 archivos/185 tests PASS**, reproducido en d3c40dfc. Evidencia reutilizada en3e1bffed: ninguno de esos archivos/código/dependencias/config cambió.
- En cwd `apps/merchant`, `pnpm exec vitest run src/modules/analytics-an3-translators.test.ts`: **1 archivo/7 tests PASS**, reproducido sobre3e1bffed. Solo se corrigió helper: antes envelope1/payload3; ahora versión real del payload con parámetro genérico que exige eventVersion. Casos/aserciones intactos.
- En raíz, `pnpm --filter @mi-pasaporte/domain typecheck`: exit0; dominio sin cambios posteriores. `pnpm --filter @mi-pasaporte/merchant typecheck`: exit0 tras la corrección final del helper.
- En raíz, `pnpm exec eslint apps/merchant/src/modules/pos/server/metrics.ts apps/merchant/src/modules/pos/server/metrics-measured.test.ts`: exit0; `pnpm exec eslint apps/merchant/src/modules/analytics-an3-translators.test.ts`: exit0 sobre helper final.
- En raíz, `pnpm exec prettier --check` sobre los tres TS y este handoff, y `git diff --check`: exit0 al cierre.
- En cwd `apps/merchant`, `pnpm exec vitest run src/modules/modules-boundary.test.ts src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts`: **24 PASS/2 FAIL**, sin skips. Boundary10 PASS. Los otros dos reproducen exactamente backlog conocido, sin offenders propios. No se modificó guardia ni se sustituyó la comprobación por app-boundary.

Backlog observado: between rechaza `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`; literals añade cinco archivos core: `app/backoffice/backoffice-context-controller.test.ts`(3), `app/backoffice/backoffice-context-refresh.test.ts`(1), `app/backoffice/onboarding/checklist-context-resource.test.ts`(1), `server/analytics/evaluation/policy-simulation.test.ts`(2), `server/analytics/lifecycle/index.ts`(1). Fuera de scope; no declarar todas las guardias verdes.

Fallos intermedios resueltos: invocación Vitest desde raíz con config merchant no encuentra tests (corregido cwd); test nuevo compartía referencia de origin y la mutación alteraba ambas líneas (ahora copia un origen para producir inconsistencia real); narrow de unión en test/tres bindings sin uso corregidos para tipos/lint; helper tipado sin genérico causó excess-property en un caso y se corrigió con genérico. Fixture ajeno inicialmente falló por envelope1/payload3: identificado y reportado antes de ampliación, corregido después sin relajar decoder. No se contabilizaron fallos como PASS.

Git add encontró EPERM sobre index.lock: informado inmediatamente al coordinador; add/commits propios acotados funcionaron con escalación auto-review, sin bypass de hooks ni permisos generales.

## Límites y siguiente paso

Sin DB/Neon/env/build/browser/M0/M1/CI, sin prueba de idempotencia DB; replay puro solo comprueba resultado determinista. Sin productor/framework/decoder/schema/ingestion/reader/Stock/Recetas/UI/kit/tooling/estados/índices. No publicación4 ni habilitación de masa. Sin push/PROD/factory/integración/ref principal. Sin servidores/túneles/procesos persistentes propios: sesiones de tests/tipos terminadas; lsof consultado desde `/private/tmp` sin entradas cwd del worktree.

Coordinador: registrar entrega y asignar QA independiente sobre SHA final limpio, evaluar aceptación/integración. El autor queda disponible para corregir hallazgos hasta aceptación.
