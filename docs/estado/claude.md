# Estado de Claude

> Lo escribe **solo Claude** (ADR 0114, `docs/TRABAJO-EN-PARALELO.md`). Es su punto de retorno si la sesion se
> cae, se cierra o se compacta: se vuelve aca, no al chat. El bloque ESTADO de arriba se reescribe entero al
> cerrar, DESPUES del commit del trabajo y con su sha. Lo vigilan los hooks `tasks-fresh.sh` (aviso) y
> `state-uncommitted-lie.sh`. El estado de GPT esta en `gpt.md`; los bloques viejos, en `claude-historico.md`
> (spec 0151, no se lee al arrancar) y en `../TASKS.md`. **Aca queda un solo bloque ESTADO.**
>
> Regla: **marcar `hecho` solo con verificacion real** — tests que pasan, comando corrido, cosa vista en
> pantalla. El auto-reporte no es evidencia.

## ⇥ ESTADO (2026-10-05, noche) — SPEC 0159 IMPLEMENTADA (`d797c21`), PUSH A `origin/main` SIN VERIFY; SIGUE LA N1 DE #76

**Hecho (verificado):**
- **0159** en `motor` `d797c21`, pusheada a `origin/main` con `--no-verify` (owner: «hacemos el push sin verificar
  para que no falle», por los flakes #74/#75); deploy de Vercel sin verificar: `Heading`, `Text`, `Card`, `PageHeader`, `Form`/`FormSection`/
  `FormActions` en `apps/merchant/src/ui`; `BrandTheme`/`resolveBrandTheme` borrados. Harness
  `tests/e2e/support/ui-kit-entry.tsx` + `ui-kit-checks.ts`; `ui-kit.spec.ts` (Chromium) y `ui-kit.webkit.spec.ts`:
  16/16 local; `CI=1` → 4 passed / 12 skipped. Referencias 4 + 4 `*-darwin.png` (la spec decia 8 + 8: error de cuenta).
  Capturas para el owner: https://claude.ai/artifact/L9rd4vPQoGuNNMTkkYSeZ3
- M1–M3 rojas por la asercion esperada. **M4 sobrevivio** con la tolerancia por defecto → capturas con `threshold: 0`
  (estable 2/2 sin mutar; M4 8/8 roja). Oraculo de `Form` reescrito (el de la spec era imposible con `aria`): detalle
  en la seccion «Implementacion» de la spec.
- `pnpm verify`: todo ok salvo `typecheck` ROJO por cache viejo de `.next/types/validator.ts` (rutas borradas en la
  0155); el `build` lo regenero y `pnpm typecheck` despues → 6/6. Tabla en la spec.

**Siguiente, en orden:**
1. **Spec chica N1 para #76** (owner: «añade la spec chica N1 antes de 160»): `validationErrors` del `Form` llega a
   `TextField`, `SelectField`, `NumberField`, `TextAreaField`, `ChoiceGroup` (hoy `isInvalid={props.isInvalid ??
   Boolean(errorMessage)}` pisa el error del servidor; fix candidato `errorMessage ? true : undefined`). Rojo primero
   en el harness del kit (`ui-kit-checks.ts`), un caso por campo; correr los e2e de wizard/programa/Staff (usan esos
   campos). Si cambia el aspecto, regenerar capturas mirandolas.
2. 0160 (Dialog, Combobox + `places-search.tsx`, Tabs, SegmentedControl, Switch, ProgressBar, Link) y 0161: se
   escriben al empezar cada una, sumando piezas al final de `ui-kit-entry.tsx`.
3. Fase 0c (guardias); Fase 1 (GPT) con lo que cada rebanada deje en `origin/main`.

**Pendientes del owner:** `.env.example` (Geoapify → `GOOGLE_MAPS_API_KEY=`); borrar las dos claves de
Geoapify en Vercel; QA del alta/locales/programa sin verificar; deploy de `b1ab123` sin verificar.

**Hallazgos abiertos:** PARQUEADO #74, #75 (flakes del pre-push), #76 (siguiente), #77 (diferido por el owner: «quizas lo
cambiamos»); H4 de la 0155.

**Gotchas de esta sesion:** Tailwind del harness solo genera clases usadas en `apps/merchant` (layout del harness
inline); un `next dev` de otro proyecto en el 3001 cuelga el `webServer` de Playwright (se mato con OK del owner);
el hook `foreign-staged.sh` exige los paths borrados con `git rm` escritos literales en el `git commit --`.

**Descartado:**

| Camino | Por que |
|---|---|
| Tolerancia de captura por defecto | M4 (sombra) pasaba verde |
| Oraculo «requerido vacio → `aria-invalid`» en `Form` | con `aria` React Aria no lo marca ni frena el envio |
| Arreglar `isInvalid` de los campos en la 0159 | cambia campos en uso: fuera de alcance (#76) |
| Capturas de Linux / en CI | owner: sus usuarios usan Windows y Mac |

**Prompt para retomar:** «Lee docs/estado/claude.md: spec chica N1 de #76».
