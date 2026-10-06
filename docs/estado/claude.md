# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — 0164 (FASE 0c) IMPLEMENTADA (`5eb47af`), SIN PUSHEAR: `verify` ROJO SOLO POR #74

**Hecho (verificado):**
- **0164** (Fase 0c, cierra la parte de Claude antes de la Fase 1): spec `6da1e6d` (pusheada), implementacion `5eb47af`
  (local). `tools/ui-guard.ts` (+ `ui-guard-counts.ts`, `ui-guard-tsx.ts`): trinquete por archivo cambiado de
  `apps/merchant/src`, 17 categorias, gate `ui-guard` en `pnpm verify`; `--report` = linea de partida de la Fase 1
  (257 nativos, 193 handlers, 122 `type-scale`, 1491 selectores y 480 colores en CSS). `tools/zone-audit.ts` en hook
  `SessionStart`. `postcss` 8.5.26 devDep de la raiz. Docs: AGENTS.md, TRABAJO-EN-PARALELO §5, design-system §Guardia,
  PARQUEADO #79 (`type` de `TextField`). 37 tests de tools; M1–M3 rojas por la asercion esperada y revertidas. Sobre el
  repo real: `<button onClick>` temporal en el mostrador → exit 1 con lineas; revertido → exit 0.
- **`pnpm verify` → ROJO solo en `neon (full)`**: 1 de 3362, `catalog-import-reconcile` = PARQUEADO #74; ese archivo
  solo → `8 passed`. Todo lo demas ok.
- Antes, en esta sesion: prompt de Fase 1 para GPT dado (mostrador primero).

**Siguiente, en orden:**
1. **Push de `5eb47af` + este estado**: pedir OK del owner para `--no-verify` (como en 0160/0161) o reintentar `verify`.
2. Tras el push: `node tools/zone-audit.ts` → sin salida (el ancla queda en `origin/main`). Avisarle a GPT que el guard
   ya corre en `verify` (el prompt ya lista las reglas).
3. **0163 sin PASS independiente** (spec `cerrada`): sesion valida/vencida y rebotes del guard sin ciclo.
4. Lo que queda del arco ADR 0123: Fase 1 (GPT) → piezas del kit que pida → Cierre (Claude: borrar `@layer legacy`,
   guard absoluto, oscuro con capturas). PARQUEADO #79 cuando marketing pase a `DateTimeField`.

**Pendientes del owner:** QA del buscador de lugares (alta y locales) y del tour de locales (0160). Borrar las dos claves
de Geoapify en Vercel; QA del alta/locales/programa.

**Hallazgos abiertos:** PARQUEADO #74 (otra vez hoy), #75, #77, #78, #79; H4 de la 0155. `docs/design-system.md` §Form
todavia dice «Pendiente» sobre `validationErrors` (resuelto por la 0162).

**Gotchas:** el hook `file-size.sh` corta en 300 lineas (partir antes de escribir). `document.createElement` y los
selectores `[data-tour=…]` son falsos positivos ya excluidos del guard. `pnpm verify` deja `next-env.d.ts` modificados
(build): `git checkout` antes de commitear.

**Prompt para retomar:** «Lee docs/estado/claude.md: push de la 0164».
