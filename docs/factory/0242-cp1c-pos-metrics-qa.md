# 0242 CP1c.6 — QA independiente del traductor POS

**PASS focal** sobre candidato congelado `d2d4cdd1635cf66c40d8758c15d4eb3f3614dc6d`, 2026-10-18. No se encontraron defectos del encargo. Las guardias de módulos conservan dos FAIL de backlog; no se declara una batería global verde ni cadena V4 lista.

## Identidad y alcance

- QA nuevo, sin subdelegación, worktree `/private/tmp/checkpass-pos-0242/pos-qa-0242`, rama `pos-qa-0242`, inicialmente limpio.
- Autor final `6dc4b6218003c5495fee5d44d4b2e96aeb9337ec`; código `d3c40dfcdffda050bc96de4673ffc5c4a1c376f6`; helper autorizado `3e1bffed6303cfed3a3114c44355262a3b3bea20`. Los cuatro archivos de entrega no tienen diff entre autor final y candidato QA. El candidato contiene además captura de Recetas aceptada; los tipos se verificaron sobre esa combinación.
- Lecturas: AGENTS, los tres protocolos, ficha/handoff CP1c.6, contrato0242 §4, diff real, decoder medido y helper exactGrams. Única escritura QA: este informe. No cambios de producto, guardias, configuración o dependencias.
- Runtime observado: Node `v24.20.0`, pnpm `11.4.0`, Vitest `4.0.18`. Todos los comandos Node/pnpm precedidos por `source ~/.nvm/nvm.sh && nvm use`.
- Vitest merchant: `apps/merchant/vitest.config.ts`, entorno node, setup local fija `AI_PROVIDER=fake` y elimina `OPENAI_API_KEY`. Sin archivos env copiados ni proveedores reales.

SHA256 verificados, idénticos al handoff del autor:

| Archivo | SHA256 |
| --- | --- |
| pnpm-lock.yaml | `4cfe18864f12af4fe3b0cd84ab477e936ecd52d96847579cc087e6e13b020821` |
| apps/merchant/vitest.config.ts | `073bf307a361c779b82c9b696e3918a5a1a8cdd0e01dd4838117470d654f7e81` |
| apps/merchant/vitest.setup.ts | `1e1dc6157e3f976c83c10ff5d740fbfba6cf6b9aaec2df59a301c495dba26f5f` |
| tsconfig.base.json | `ad2cb8603f3deba9707ff74c7d2fd04b5512fd33b6b264ff9700365f544e4f02` |
| apps/merchant/tsconfig.json | `aa69450b965de9cde9d78ec8493843669979dd585801e30d19bf7515da5ad8f0` |
| packages/domain/tsconfig.json | `716d299ef0e71f9555b06529000c2db8cf7122bdd52350a29d451a75862c7861` |

## Evidencia reproducida

Desde `apps/merchant`:

```sh
pnpm exec vitest run src/modules/pos/server/metrics-measured.test.ts src/server/module-events/decode-measured.test.ts src/server/module-events/decode.test.ts src/modules/pos/financial-measures.test.ts src/modules/pos/measure-contract.test.ts src/server/financial.test.ts src/modules/analytics-an3-translators.test.ts
```

Exit0: **7 archivos / 192 tests PASS**, sin skips ni retries (28 traductor, 68 decoder medido, 6 decoder legacy, 28 financial measures, 43 measure contract, 12 financial, 7 AN3). Corrida 16:25:57 local, duración 1.23 s.

Desde raíz:

```sh
pnpm --filter @mi-pasaporte/domain typecheck
pnpm --filter @mi-pasaporte/merchant typecheck
pnpm exec eslint apps/merchant/src/modules/pos/server/metrics.ts apps/merchant/src/modules/pos/server/metrics-measured.test.ts apps/merchant/src/modules/analytics-an3-translators.test.ts
pnpm exec prettier --check apps/merchant/src/modules/pos/server/metrics.ts apps/merchant/src/modules/pos/server/metrics-measured.test.ts apps/merchant/src/modules/analytics-an3-translators.test.ts
git diff --check
```

Todos exit0. Formato de este informe y diff comprobados también antes de entrega. No se ejecutó CI; corresponde al otro implementador.

Comparación legacy: se revisó `git diff d3c40dfc^ d3c40dfc -- apps/merchant/src/modules/pos/server/metrics.ts` y el traductor anterior mediante `git show`. La rama V1–3 conserva las mismas filas financieras/físicas, agrupación de cupones, sourceKey/revisions y Set de frecuencia por producto. El nuevo decoder delega V1–3 al decoder anterior, después de comprobar versión externa. Los tests reproducidos comparan el resultado completo esperado V1/2/3 (incluido count0 de la segunda línea del mismo producto), ausencia financiera V1, replay y payload intacto; V4 unit se compara completo con V3. No se afirma haber ejecutado dos implementaciones en un harness diferencial separado.

La rama mass usa solo `exactGrams({quantity, quantityUnit})`; se verificó el helper existente de racionales/terminatingDecimal. No añade factores, Number, toFixed ni parser de captura sobre gramos derivados. Las aserciones observadas incluyen `0.000000001 lb → 0.00000045359237 g` y el extremo de 14 decimales; equivalencias kg/lb/g, priceUnit independiente, mezcla del mismo producto con counts `[1,0,0]`, USD/COP, neto0, originales racionales no terminantes y payload conservado. Fallos de medida/cantidad/versiones/origen lanzan antes de devolver resultado; no existe side effect de emisión parcial en el traductor puro.

Helper AN3: el diff autorizado únicamente tipa el payload con eventVersion y reemplaza envelope fijo1 por payload.eventVersion. Casos y aserciones permanecen intactos, y los cuatro negativos de desacuerdo externo siguen pasando. Se preserva el primer FAIL obsoleto documentado por el autor: helper anterior enviaba envelope1/payload3 y el decoder rechazaba `Event version mismatch`; no se lo convierte retrospectivamente en PASS ni se relaja la validación. Esta QA no reintrodujo el fixture incorrecto.

## Guardias y fallos

Desde `apps/merchant`:

```sh
pnpm exec vitest run src/modules/modules-boundary.test.ts src/modules/modules-boundary-between.test.ts src/modules/modules-boundary-literals.test.ts
```

Exit1: **24 PASS / 2 FAIL**, cero skips/retries. Boundary: 10 PASS. Los dos FAIL reproducen exactamente el backlog declarado, sin offenders nuevos del encargo:

- Between: `modules/expenses/server/immediate.neon.integration.test.ts → modules/stock/count.ts`.
- Literals: cinco archivos extra core: `app/backoffice/backoffice-context-controller.test.ts` (3), `app/backoffice/backoffice-context-refresh.test.ts` (1), `app/backoffice/onboarding/checklist-context-resource.test.ts` (1), `server/analytics/evaluation/policy-simulation.test.ts` (2), `server/analytics/lifecycle/index.ts` (1).

No se modificaron guardias ni se usó app-boundary como sustitución. Incidencia operativa QA: una consulta Git se lanzó desde `/private/tmp` y respondió `fatal: not a git repository`; repetida desde el worktree dio el alcance/config correctos. No fue un fallo de producto ni un check contabilizado como PASS.

## Límites y entrega

Sin DB/Neon/env/build/browser/M0/M1, runtime productor4/mass, idempotencia DB, servidores o túneles. El replay certificado es puro. La revisión focal no certifica toda la cadena de subscribers/Stock/Recetas ni habilita publicación V4. Sin push/PROD/factory/aceptación/integración o cambios de refs principales. Hooks `.githooks`, sin bypass.

Los procesos de tests/tipos/lint finalizaron; comprobación lsof desde `/private/tmp` sin cwd dentro del worktree QA al cierre. Entrega mediante commit propio limpio; aceptación/integración corresponde al coordinador.

Git add del informe encontró EPERM al crear `.git/worktrees/pos-qa-0242/index.lock`; se avisó inmediatamente al coordinador. La escalación auto-review limitada a add/commit propios permitió registrar la entrega, sin cambiar permisos generales ni omitir hooks.
