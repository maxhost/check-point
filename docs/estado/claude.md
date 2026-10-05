# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05) — 0155/0156 EN `main` CON LA UI 0157 DE GPT; MIGRACION 0065 A PROD PENDIENTE. ADR 0123 (SISTEMA DE UI) ACEPTADO, FASE 0a SIN SPEC

**Hecho (verificado):**
- **0155 + 0156** (servidor del alta con Google Places; permiso de alta borrado; email en minusculas; programa sin email
  verificado, ADR 0122) con PASS de revisor; GPT las integro con su UI 0157 y pusheo: `origin/main` `87de5ff` contiene
  `1953afe` (`git merge-base --is-ancestor`, corrido 2026-10-05).
- **PROD (Neon, solo lectura, 2026-10-05):** 0 de 14 `merchant_auth.user` con mayusculas; `session.onboarding_grant_until`
  todavia existe (la 0065 no se aplico).
- **ADR 0123** (un solo sistema de UI: Tailwind v4 + React Aria por capas) aceptado con decisiones del owner: una paleta
  (la del panel), claro forzado hasta el cierre, kit/tokens/guard en zona Claude, modelo hibrido. Paso por revision
  adversarial; hallazgos centrales reproducidos (`globals.css` sin `@layer` pisa al kit; `onboarding.css` 43 hex; oscuro
  duplicado en `tokens.css`; `places-search.tsx` de la 0157 armado a mano).

**Siguiente, en orden:**
1. **Migracion 0065 a PROD** — falta que el owner confirme que el deploy de Vercel de `87de5ff` (merchant) esta READY
   (sin `gh` ni CLI de Vercel en esta maquina). Despues: re-correr `select count(*) from merchant_auth."user" where email
   <> lower(email)` → 0 y aplicar `packages/db/drizzle/0065_borrar_permiso_de_alta.sql` (owner aprueba la llamada;
   skill `gotchas-del-repo`, «migracion chica sin connection string»). **Desde ahi no hay rollback de codigo anterior a
   `3411fab` sin reponer la columna.**
2. Probar la regla de Vercel «Places por IP» (61 requests a `/api/places/autocomplete` → 429) y cerrar PARQUEADO #70
   con un ADR corto.
3. **Spec de la Fase 0a del ADR 0123** (N1, zona Claude): `@layer legacy` sobre el CSS propio de `globals.css` y
   `onboarding.css`, `--color-*: initial` antes de los roles, `light-dark()` y borrar duplicados de oscuro, claro forzado
   (`data-theme="light"` en `app/layout.tsx`), contraste en `verify`, y **capturas antes/despues por pantalla** (claro,
   390 y 1280) para la decision 5 del owner (medida canonica de los controles). Medir todo sobre `origin/main`.
4. Despues: Fase 0b (kit: Form/FormSection/FormActions, Dialog, Combobox + migrar `places-search.tsx`,
   SegmentedControl, Switch, Tabs, ProgressBar, Heading, Text, Card, PageHeader; harness en `tests/e2e/support/`),
   Fase 0c (guardias `tools/ui-guard.ts` + enmienda de zonas en `TRABAJO-EN-PARALELO.md`/`AGENTS.md`), Fase 1 (GPT).

**Pendientes del owner:** confirmar el deploy (paso 1); `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las
dos claves de Geoapify en Vercel; QA del alta/locales/programa sin verificar.

**Hallazgos abiertos:** PARQUEADO #74 (flake de catalogo); H4 de la 0155 (400 de Google por clave invalida en Details →
`place_not_found`). Worktree de trabajo: `motor-wt/onboarding-google`, rama `ui-sistema` (desde `origin/main` `87de5ff`).

**Descartado:**

| Camino | Por que |
|---|---|
| Trinquete con `tools/ui-baseline.json` | se puentea subiendo el JSON (y el repo empuja a GPT a hacerlo como «arreglo mecanico»): se compara contra el merge-base con git |
| Guardias antes de completar el kit | obliga a hacer a mano lo que el kit no tiene (paso con `places-search.tsx`) |
| Pagina de muestra en `/backoffice/_ui` | en Next una carpeta `_x` no se rutea: va como harness de e2e |
| Pantallas «solo layout» | el kit crece una pieza por cada combinacion visual; el owner eligio el hibrido |

**Prompt para retomar:** «Lee docs/estado/claude.md: migracion 0065 a PROD pendiente del deploy, y escribir la spec de la
Fase 0a del ADR 0123».
