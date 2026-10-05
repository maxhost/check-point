# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, tarde) — SPEC 0159 (FASE 0b, REBANADA 1: TIPOGRAFIA, SUPERFICIES, FORMULARIOS) CERRADA, SIN IMPLEMENTAR

**Hecho (verificado):**
- **0158** en `origin/main` `b1ab123` (push con `--no-verify`, OK del owner por los flakes #74/#75). Deploy de Vercel
  sin verificar.
- Rama `motor` (worktree `check-point-wt/motor`) adelantada por fast-forward a `ui-sistema` `78d1829`; ahora es el
  punto de trabajo. `764718b`: spec 0159 `cerrada` + enmienda del ADR 0123 (particion de la 0b en 0159/0160/0161;
  capturas solo de Mac, owner: «no me interesa linux, me interesa que se vean en windows y mac») + fila en INDEX.
  Sin push.

**Siguiente, en orden:**
1. **Implementar la 0159** (N1, sesion principal, sin subagentes): `docs/specs/0159-kit-tipografia-superficies-y-formularios.md`.
   Primero el rojo (harness sin piezas), despues piezas, capturas `--update-snapshots` mirandolas + Artifact para el
   owner, M1–M4, `pnpm verify` una vez al final. Ojo: el pre-push puede caer por los flakes #74/#75.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161 (campos
   file/color/time/datetime-local/range/search): se escriben al empezar cada una.
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar.

**Hallazgos abiertos:** PARQUEADO #74 y #75 (flakes que bloquean el pre-push; spec chica pendiente); H4 de la 0155.
Rama `ui-sistema` (worktree `motor-wt/onboarding-google`) queda detras de `motor`.

**Descartado:**

| Camino | Por que |
|---|---|
| Trinquete con `tools/ui-baseline.json` | se puentea subiendo el JSON: se compara contra el merge-base con git |
| Guardias antes de completar el kit | obliga a hacer a mano lo que el kit no tiene (paso con `places-search.tsx`) |
| Pagina de muestra en `/backoffice/_ui` | en Next una carpeta `_x` no se rutea: va como harness de e2e |
| `driver.css` sin capa (como decia la spec) | sus reglas sin capa le ganan a `legacy`: rompio los tours |
| No reindentar `globals.css` | `format:check` lo exige dentro de `@layer` |
| Capturas de Linux / en CI | owner: sus usuarios usan Windows y Mac; sin Docker no se generan aca |
| La 0b en una sola spec | ~13 piezas: se parte en tres rebanadas N1 |

**Prompt para retomar:** «Lee docs/estado/claude.md: implementar la 0159».
