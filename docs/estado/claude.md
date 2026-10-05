# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, mediodia) — SPEC 0158 (FASE 0a, CAPAS DE CSS) EN `origin/main` (`b1ab123`), DECISION 5: MEDIDA DEL KIT

**Hecho (verificado):**
- **0158** en `e4e8d4f` (rama `ui-sistema`, worktree `motor-wt/onboarding-google`, sobre `origin/main` `87de5ff`):
  `globals.css`/`onboarding.css` en `@layer legacy`, `driver.css` en `@layer base`, `--color-*: initial`, onboarding con
  la paleta del panel, un solo bloque oscuro + `data-theme="light"`, `tokens.test.ts` (contraste 38 pares, capas,
  paleta) en `pnpm test`. Rojo de `ui-layers.spec.ts` transcripto ANTES (padding 13, radio 11, borde `#cbd7ce`,
  «Continuar» `#1d332c`); M1–M4 ejecutadas, las cuatro rojas, revertidas con `diff`. Detalle en la spec.
- **`pnpm verify` final:** todo ok salvo `neon (full)` = flake PARQUEADO #74 (`catalog-import-reconcile`; suelto 8/8).
- **Hallazgo medido y arreglado:** `driver.css` sin capa rompia 5 e2e de tours (overlay sobre la listbox); va en `base`
  (enmienda en ADR 0123: todo CSS de terceros en `base`).
- **Capturas antes/despues** (8 superficies × 390/1280): https://claude.ai/artifact/LmvL6MiGUJoWhRvGxFy5Ju

**Siguiente, en orden:**
1. **Decision 5 tomada** (owner, 2026-10-05): la medida del KIT. **Pusheado** `ui-sistema` → `origin/main` `b1ab123` con `--no-verify` (OK del owner: el pre-push cayo solo por los flakes
   #74 y #75; todos los demas gates verdes). Deploy de Vercel sin verificar todavia.
   GPT recibe el prompt para empezar la Fase 1 en paralelo SOLO con piezas que el kit ya tiene (`globals.css` quedo
   reindentado por Prettier: rebase con `-Xignore-space-change`).
2. Fase 0b (kit: Form/FormSection/FormActions, Dialog, Combobox + migrar `places-search.tsx`, SegmentedControl, Switch,
   Tabs, ProgressBar, Heading, Text, Card, PageHeader; harness en `tests/e2e/support/`), Fase 0c (guardias), Fase 1 (GPT).

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar.

**Hallazgos abiertos:** PARQUEADO #74 y #75 (flakes que bloquean el pre-push; spec chica para los dos, antes de la 0b); H4 de la 0155. La rama
`motor` (worktree `check-point-wt/motor`) tiene un estado viejo (0153): no es el punto de retorno.

**Descartado:**

| Camino | Por que |
|---|---|
| Trinquete con `tools/ui-baseline.json` | se puentea subiendo el JSON: se compara contra el merge-base con git |
| Guardias antes de completar el kit | obliga a hacer a mano lo que el kit no tiene (paso con `places-search.tsx`) |
| Pagina de muestra en `/backoffice/_ui` | en Next una carpeta `_x` no se rutea: va como harness de e2e |
| `driver.css` sin capa (como decia la spec) | sus reglas sin capa le ganan a `legacy`: rompio los tours |
| No reindentar `globals.css` | `format:check` lo exige dentro de `@layer` |

**Prompt para retomar:** «Lee docs/estado/claude.md: escribir la spec de la Fase 0b (kit completo)».
