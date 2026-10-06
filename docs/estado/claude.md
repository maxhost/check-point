# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — 0165 IMPLEMENTADA CON PASS (`8ab9e73`), PUSHEADA DESDE LA RAMA `sin-gate-email`; FASE 1 DE UI PARQUEADA (ES DE GPT)

**Hecho (verificado):**
- **0164** (Fase 0c) en `origin/main` (`5eb47af`, push `--no-verify` con OK del owner por el flake #74).
- **ADR 0125 + spec 0165** (N2): todo `/api/catalog/*` (IA incluida) y retirar/cancelar el retiro del programa sin
  email verificado; borrados duros y retiro siguen solo del owner. Implementacion `8ab9e73`; `pnpm verify` ok en la
  rama; revisor PASS (`8ad441a`) con M1–M3 rojas por la asercion esperada y revertidas. Reproducido por mi: inventario
  `SinGateDeEmail` = 7 archivos, unidad 181/181, sin `MUTATION`. Riesgo aceptado por el owner: gasto de IA acotado
  solo por el cupo por comercio.
- **Prompt de Fase 1 para GPT dado** (sin push: un solo push al final de todas las pantallas; GPT numera specs desde
  **0170**, Claude usa **0165–0169**).

**Como se trabaja ahora:** GPT commitea la Fase 1 en local sobre `main` del arbol principal, sin pushear. Claude trabaja
en worktrees desde `origin/main` (`tools/worktree-new.sh`) y pushea con `git push origin <rama>:main`; el `main` local
de GPT queda atras y rebasa al final. El worktree necesita `apps/merchant/.env.local` enlazado (el script solo enlaza
los `.env*` de la raiz).

**Siguiente:**
1. QA del owner de la 0165 cuando el deploy de Vercel de `checkpass.club` este `READY` con el sha del push: con una
   cuenta sin verificar, cargar catalogo (manual e IA) y retirar/cancelar el retiro del programa.
2. Parqueado del arco UI (ADR 0123): piezas del kit que pida GPT; PARQUEADO #79; Cierre (borrar `@layer legacy`, guard
   absoluto, oscuro). Para GPT: el copy `email_not_verified` de catalogo/programa quedo muerto (0165).
3. 0163 sin PASS independiente (sesion valida/vencida, rebotes sin ciclo).

**Pendientes del owner:** QA de la 0165; QA del buscador de lugares y del tour de locales (0160); borrar las dos
claves de Geoapify en Vercel; QA del alta/locales/programa.

**Hallazgos abiertos:** PARQUEADO #74, #75, #77, #78, #79; H4 de la 0155. `docs/design-system.md` §Form dice
«Pendiente» sobre `validationErrors` (resuelto por la 0162).

**Prompt para retomar:** «Lee docs/estado/claude.md: QA de la 0165».
