# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — SPEC 0162 (#76) IMPLEMENTADA Y EN `origin/main` (`deb8cc5`); SIGUE LA 0160

**Hecho (verificado):**
- **0162** implementada en `deb8cc5`, pusheada a `origin/main` (`464ef0c..deb8cc5`) CON el pre-push: `pnpm verify`
  completo en verde (typecheck, lint, format, test, build, e2e, neon merchant). Los cinco campos pasan a
  `isInvalid={props.isInvalid ?? (errorMessage ? true : undefined)}`; harness `?case=server-errors` + tests
  «Form: validationErrors del servidor llegan a los campos» (soft, un caso por campo) y «errorMessage marca el
  campo», en Chromium y WebKit; capturas de la 0159 sin cambios. Rojo primero en los cinco; M1 (`choice-group`)
  y M2 (`text-field`) rojas por la asercion esperada y revertidas. Detalle en la seccion «Implementacion».
  #76 resuelto en PARQUEADO. Deploy de Vercel de `deb8cc5` sin verificar (sin cambio visible esperado).
- El primer `pnpm verify` dio `test:e2e` ROJO por `EADDRINUSE :3002`: el `next dev` de `sintetica/apps/panel`
  lo lanza OTRA sesion de Claude y lo relanza a los ~30 s. Con OK del owner se mato (kill pegado al arranque).

**Siguiente, en orden:**
1. **0160** (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link): se escribe
   al empezar, sumando piezas al final de la pagina por defecto de `ui-kit-entry.tsx`. Despues la 0161.
2. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploys de `b1ab123` y `d797c21` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #77 (diferido por el owner); H4 de la 0155.

**Gotchas de esta sesion:** otra sesion (sintetica) ocupa el 3002 y lo relanza: matarlo en el MISMO comando que
lanza la e2e/el push; `next dev` del `webServer` reescribe los tres `next-env.d.ts` (revertir antes de commitear);
`rg -n MUTATION` sobre `tests` choca con `E2E_LOYALTY_MUTATION_TEST` (usar `-w`); este commit de estado queda
local hasta el proximo push (Hobby).

**Descartado:**

| Camino | Por que |
|---|---|
| Caso `server-errors` en la pagina por defecto del harness | cambia las 8 capturas de la 0159; con `?case=` quedan igual |
| `expect` duro en el bucle de campos | corta en el primero: no muestra el rojo de los cinco |

**Prompt para retomar:** «Lee docs/estado/claude.md: spec 0160».
