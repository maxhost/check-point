# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — 0161 Y 0163 EN `origin/main` (`42f1516`, CI verde); PROMPT DE FASE 1 PARA GPT DADO; SIGUE LA FASE 0c

**Hecho (verificado):**
- `main` = `origin/main` = `42f1516`; `pnpm ci:status` → VERDE. Ahi estan la 0161 (`fede9d2`) y la 0163 (GPT,
  `bc8f3fd`: `business.checkpass.club/` sin sesion → 307 a `/es/business/onboarding`). No hubo push en esta sesion:
  ya estaba todo arriba.
- **Prompt de GPT para la Fase 1 dado en la sesion** (owner lo pidio ahora, antes de la 0c: cambia el orden «GPT
  recien despues de la 0c»). Primera pantalla: **mostrador** (orden del ADR 0123), solo forma; kit 0159–0162; las
  reglas de la 0c van escritas en el prompt porque el guard todavia no existe.

**Siguiente, en orden:**
1. **Fase 0c** (guardias, `tools/ui-guard.ts`): spec nueva. Al aterrizar, avisarle a GPT que el guard corre en
   `verify`. Ahi tambien el `type` de `TextField` (8 `datetime-local` en marketing) o a la Fase 1.
2. **0163 sin PASS independiente** (la spec sigue `cerrada`): el handoff pide probar sesion valida/vencida y que los
   rebotes del guard no hagan ciclo. Decidir quien la revisa.

**Pendientes del owner:** QA del buscador de lugares (alta y locales) y del tour de locales paso «Busca la
direccion» (0160). Borrar las dos claves de Geoapify en Vercel; QA del alta/locales/programa.

**Hallazgos abiertos:** PARQUEADO #74, #75, #78, #77 (diferido); H4 de la 0155. `docs/design-system.md` §Form
todavia dice «Pendiente» sobre `validationErrors` (texto viejo, ya resuelto por la 0162).

**Gotchas:** los de la 0161 estan en el bloque historico de arriba de `claude-historico.md`.

**Prompt para retomar:** «Lee docs/estado/claude.md: spec de la Fase 0c».
