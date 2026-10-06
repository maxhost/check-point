# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — 0160 IMPLEMENTADA EN `motor` (`c335035`), SIN PUSHEAR; SIGUE LA 0161

**Hecho (verificado):**
- **0160** (Fase 0b, rebanada 2): spec `ca18ef4`, implementacion `c335035`. El kit suma `Dialog`/`ConfirmDialog`,
  `Combobox`, `Tabs`/`TabList`/`Tab`/`TabPanel`, `SegmentedControl`, `Switch`, `ProgressBar` y `Link`.
  `places-search.tsx` pasa a `Combobox` (alta y locales): roles `combobox`/`option`, e2e de Places migrados en el
  mismo commit; 9 reglas `.places-search*` borradas de `globals.css`; excepcion de pointer-events para el popover en el
  paso de direccion del tour de locales. Rojo primero (harness sin exports; Places sin `combobox`); M1–M4 rojas por la
  asercion esperada y revertidas. Kit `40 passed`; `CI=1` `12 passed`/`28 skipped`; `pnpm verify` → `verify: ok`
  (e2e `160 passed`) en la segunda corrida (la primera: Prettier en 3 archivos + flake #78). Capturas (16):
  https://claude.ai/artifact/BxFSXFFqCUUd3e8YHxUmy4 . Desvios medidos en la seccion «Implementacion» de la spec
  (lo mas importante: React Aria no abre la lista cuando las opciones llegan async → `OpenWhenItemsArrive`; al elegir
  escribe el texto de la opcion → guardia + test con `details` lento).
- **Sin pushear** (memoria: no pushear por commit). `origin/main` sigue en `3177450`.

**Siguiente, en orden:**
1. Push de `ca18ef4..` cuando el owner lo pida (pre-push corre `verify`; ojo flake #78).
2. **0161** (campos `file`/`color`/`time`/`datetime-local`/`range`/`search`): se escribe al empezar, mismo harness.
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`. Avisar a GPT el sha de la 0160
   antes de que toque alta o locales (`places-search.tsx` y `globals.css` cambiaron).

**Pendientes del owner:** QA del buscador de lugares en el alta y en locales (aspecto del kit, flechas + Enter), y del
**tour de locales** paso «Busca la dirección»: escribir y elegir una direccion con el tour abierto (excepcion de CSS sin
e2e). Borrar las dos claves de Geoapify en Vercel; QA del alta/locales/programa; deploys de `b1ab123` y `d797c21`.

**Decidido por el owner (2026-10-05):** `.env.example` queda como esta (todavia lista Geoapify). No volver a pedirlo.

**Hallazgos abiertos:** PARQUEADO #74, #75, **#78 (nuevo: teardown de `loyaltyHarness` > 30 s, visto 2 veces)**, #77
(diferido por el owner); H4 de la 0155. `docs/design-system.md` §Form todavia dice «Pendiente» sobre `validationErrors`
(lo resolvio la 0162): texto viejo, sin tocar.

**Gotchas de esta sesion:** en un e2e, `fill`/`click` sobre un `Combobox` lejos en la pagina hace scroll DESPUES de la
primera tecla y React Aria cierra la lista y repone el texto («cu» → «u»): scroll antes + dos rAF. La `listbox` del
`Combobox` mide 10 px menos que el input (el ancho es del `Popover`). `rg -nw MUTATION` encuentra la caché de `.next`:
excluirla. `next dev` del e2e reescribe los `next-env.d.ts` (revertir).

**Prompt para retomar:** «Lee docs/estado/claude.md: spec 0161».
