---
spec: 0133
fecha: 2026-10-02
estado: implementada
resumen: `pnpm verify` (gates segun lo que cambio, ADR 0113) y `pnpm ci:status` (estado de la CI del ultimo `main`); `neon-test.sh` gana `--related`; CLAUDE.md, plantillas y agentes pasan a usar `pnpm verify`.
disjunta: si
archivos: tools/verify.ts, tools/verify.test.ts, tools/ci-status.ts, tools/ci-status.test.ts, tools/neon-test.sh, package.json, CLAUDE.md, docs/specs/TEMPLATE.md, docs/specs/TEMPLATE-CHICA.md, .claude/agents/implementador.md, .claude/agents/revisor.md
---

# 0133 — `pnpm verify`: los gates según lo que cambió

> Implementa el **ADR 0113**. Pedido del owner el 2026-10-02. Tooling: un dominio, sin migraciones, sin decisión abierta.

## Problema

- Toda spec corre los 6 gates completos más, cuando toca servidor, las 153 suites Neon (~20 min, medido 2026-10-02).
- `vitest related` selecciona 11/153 suites para `template-store.ts` y 0 para `composer.tsx` (medido).
- `tools/neon-test.sh:76-81` solo sabe correr toda la suite o una lista explícita de archivos.
- La CI de `main` falló en `49c7c9e` (job `verify`, paso «Unit + integracion Neon») y nadie lo vio. La API pública de
  GitHub lo expone sin credenciales: `GET /repos/maxhost/check-point/actions/runs?branch=main` y
  `/check-runs/{id}/annotations` (medido).

## Alcance

**Entra:**
1. **`tools/verify.ts`** (Node 24 lo corre quitando tipos; autocontenido, como `tools/google-wallet-callback.ts`):
   - **Puro y exportado:** `planVerify(files: string[]): VerifyPlan` con
     `{ e2e: boolean; neon: { mode: "none" | "related" | "full"; merchant: string[]; consumer: string[] }; reasons: string[] }`.
     Reglas (rutas relativas a la raíz del repo):
     - **full** si algún archivo matchea: `packages/db/**`, `**/*.sql`, `**/drizzle.config.*`, `**/vitest.config.*`,
       `vitest.workspace.*`, `package.json` (cualquiera), `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tools/neon-test.sh`.
       `full` también implica `e2e: true`.
     - **e2e** si alguno matchea: `apps/*/src/app/**` **fuera de** `apps/*/src/app/api/**`; `**/*.css`;
       `apps/*/public/**`; `tests/e2e/**`; `playwright.config.*`.
     - **related** (si no es full): `.ts`/`.tsx` bajo `apps/merchant/src/**` → `merchant`; bajo `apps/consumer/src/**` →
       `consumer`; bajo `packages/domain/**` → **las dos** apps. Los archivos de `tests/e2e/**`, `docs/**`, `tools/**`
       (salvo `neon-test.sh`) y `apps/public|platform/**` no disparan Neon.
     - `reasons`: una línea legible por cada decisión («e2e: apps/merchant/src/app/globals.css», «neon full:
       packages/db/src/schema/x.ts»…).
   - **`main`** (CLI): calcula los cambiados = `git diff --name-only $(git merge-base origin/main HEAD)` ∪
     `git diff --name-only HEAD` ∪ `git ls-files --others --exclude-standard` (sin duplicados, sin `.pnpm-store/`).
     Flags: `--base <ref>` (default `origin/main`), `--files a,b,c` (reemplaza el cálculo; para pruebas), `--full`
     (todo), `--dry-run` (solo imprime el plan). Corre en orden: `pnpm run typecheck`, `lint`, `format:check`, `test`,
     `build`; después `pnpm run test:e2e` si `e2e`; después Neon: `full` → `tools/neon-test.sh` UNA vez
     (corregido al implementar: sin archivos corre `pnpm run test` de root, que ya incluye la app del cliente); `related` → `tools/neon-test.sh --app <app> --related <archivos absolutos de
     esa app + de packages/domain>`. **No corta en el primer rojo**: corre todo lo planeado y al final imprime una tabla
     `gate | corrió/salteado (motivo) | ok/ROJO | segundos`; exit 1 si hubo algún rojo.
   - No imprime credenciales (las maneja `neon-test.sh`, que ya solo imprime claves y largos).
2. **`tools/neon-test.sh --related <archivos>`**: misma receta (interlock contra `DATABASE_URL`, migrar la rama de CI),
   pero ejecuta `pnpm --filter @mi-pasaporte/$APP exec vitest related --run <archivos>`. Si la lista queda vacía, sale 0
   sin correr nada.
3. **`tools/ci-status.ts`**: consulta el último run del workflow `CI` en `main` (API pública, sin token) e imprime sha,
   estado y conclusión; si falló, los pasos fallidos y hasta 10 anotaciones (`path:línea | mensaje` recortado). Puro y
   exportado: `summarizeRun(run, jobs, annotations): string[]`. Si la red falla, lo dice y sale 0 (es informativo, no
   un gate).
4. **`package.json` (root):** `"verify": "node tools/verify.ts"`, `"ci:status": "node tools/ci-status.ts"`.
5. **Docs que prescriben los gates**, para que digan `pnpm verify`:
   - `CLAUDE.md`: el bullet «LOS GATES DE CI SON SEIS…» se reemplaza por uno corto de `pnpm verify` (ADR 0113); el
     paso 1 del flujo de trabajo suma «correr `pnpm ci:status`: si el último `main` está rojo, se arregla primero».
   - `docs/specs/TEMPLATE.md` y `TEMPLATE-CHICA.md`: la línea de gates de la DoD pasa a `pnpm verify` en verde (con su
     tabla final transcripta).
   - `.claude/agents/implementador.md` y `.claude/agents/revisor.md`: donde listan los gates, `pnpm verify`.

**No entra:** la CI de GitHub (sigue corriendo todo), los hooks de Stop, `docs/AGENT-WORKFLOW.md` y las skills (se
actualizan en el handoff si citan los 6 gates), arreglar las 4 suites rojas de la CI (spec aparte).

## Diseño

Lo de arriba es el diseño completo. Las reglas de `planVerify` son la única lógica con decisiones y por eso son puras y
con tabla de casos; `main` solo orquesta procesos.

## Archivos

| Archivo | Acción |
|---|---|
| `tools/verify.ts`, `tools/verify.test.ts` | crear |
| `tools/ci-status.ts`, `tools/ci-status.test.ts` | crear |
| `tools/neon-test.sh` | editar (`--related`) |
| `package.json` | editar (2 scripts) |
| `CLAUDE.md`, `docs/specs/TEMPLATE.md`, `docs/specs/TEMPLATE-CHICA.md` | editar |
| `.claude/agents/implementador.md`, `.claude/agents/revisor.md` | editar |

**Disjunta?** Sí.

## Definition of Done

- [x] `tools/verify.test.ts`: tabla de casos de `planVerify`, al menos: solo `docs/x.md` → nada extra; `composer.tsx`
      → e2e + related merchant (que selecciona 0 suites Neon; corregido al implementar: hay suites Neon que importan
      pantallas, p. ej. `locations-backoffice-pages`, asi que sacarlas del related perderia cobertura); `apps/merchant/src/app/api/x/route.ts` → related merchant, sin e2e; `packages/domain/src/x.ts` →
      related en las dos apps; `packages/db/src/schema/x.ts` → full + e2e; `apps/merchant/src/app/globals.css` → e2e;
      `tests/e2e/x.spec.ts` → e2e sin Neon; `tools/neon-test.sh` → full.
- [x] `tools/ci-status.test.ts`: `summarizeRun` con un run verde y uno rojo con anotaciones.
- [x] `pnpm verify --dry-run --files apps/merchant/src/server/marketing/template-store.ts` imprime related merchant,
      sin e2e (transcripto).
- [x] **Corrida REAL:** `pnpm verify --files apps/merchant/src/server/marketing/template-store.ts` → tabla final con
      tiempos (transcripta), Neon selectivo incluido. Es la medición de que el ahorro existe.
- [x] `pnpm ci:status` contra el GitHub real (transcripto).
- [x] (Declarado: por decision del owner no se corrio el Neon completo; gates rapidos verdes) `pnpm verify` sobre el propio cambio de esta spec (toca `package.json` → full: es lo esperado y se acepta UNA vez;
      o, si el owner no quiere los 20 min, los gates rápidos + los dos tests nuevos, declarándolo).
- [x] `rg -n MUTATION apps tools packages` → vacío.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutación | Oráculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `planVerify`: sacar `packages/db/**` de las reglas de full | `verify.test.ts`, caso `packages/db/src/schema/x.ts` |
| M2 | `planVerify`: no excluir `app/api/**` de la regla de e2e | `verify.test.ts`, caso `route.ts` → sin e2e |

**Protocolo:** `shasum` limpio → bitácora antes de medir → etiqueta `MUTATION` → medir y transcribir → revertir con
`diff`. Leer la aserción del rojo.

## Declarado AFUERA

- El acoplamiento que no pasa por imports (ADR 0113, Consecuencias): lo caza la CI completa + `ci:status`.
- `main` de `verify.ts` (orquestación de procesos) no tiene test unitario: se verifica con las corridas reales de la DoD.

## Handoff

UN implementador; revisión liviana del orquestador (tooling, sin código de producto).

## Abierto

Nada.
