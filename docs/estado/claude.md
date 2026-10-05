# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — SPEC 0162 (N1, #76) CERRADA (`2cc6071`), SIN IMPLEMENTAR

**Hecho (verificado):**
- **Spec 0162** `docs/specs/0162-errores-del-servidor-en-los-campos-del-kit.md` (`2cc6071`, fila en INDEX): los
  cinco campos pasan a `isInvalid={props.isInvalid ?? (errorMessage ? true : undefined)}`. Numero 0162 porque la
  0160 y la 0161 estan reservadas en el ADR 0123.
- **Medido con harness temporal (Chromium), ya borrado:** codigo actual + `Form validationErrors` → nada en los
  cinco (sin mensaje, sin `aria-invalid`, descripcion vacia). Con el fix → descripcion accesible = mensaje en los
  cinco; `aria-invalid` en todos menos el boton del `Select`. Con el fix, `isRequired` vacio y email invalido en
  modo `aria` siguen sin marcarse y el envio llega (la medicion de la 0159 estaba confundida por este bug, pero
  la conclusion aguanta). `validationErrors`/`validate` no se usan en pantallas → sin cambio visible esperado.
- CI de `main` (`464ef0c`) estaba `in_progress` al arrancar; no se sondeo (regla del owner).

**Siguiente, en orden:**
1. **Implementar la 0162** (N1, sin subagentes): tests rojos primero (`?case=server-errors` + «Email»), fix en
   los cinco campos, 2 mutaciones, `pnpm verify` una vez, cerrar #76 en PARQUEADO, push.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161: se
   escriben al empezar cada una, sumando piezas al final de `ui-kit-entry.tsx` (pagina por defecto).
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploys de `b1ab123` y `d797c21` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #76 (spec 0162), #77 (diferido por el owner);
H4 de la 0155.

**Gotchas de esta sesion:** en zsh `for f in $F` no parte la variable (lista literal); `next dev` del
`webServer` de Playwright reescribe los tres `next-env.d.ts` (revertir antes de commitear); `rg -n MUTATION`
sobre `tests` choca con `E2E_LOYALTY_MUTATION_TEST` (usar `-w`).

**Descartado:**

| Camino | Por que |
|---|---|
| Caso `server-errors` en la pagina por defecto del harness | cambia las 8 capturas de la 0159; con `?case=` quedan igual |
| Capturas del caso `server-errors` | el oraculo es de accesibilidad; el aspecto ya lo cubre «Email» |

**Prompt para retomar:** «Lee docs/estado/claude.md: implementar la spec 0162».
