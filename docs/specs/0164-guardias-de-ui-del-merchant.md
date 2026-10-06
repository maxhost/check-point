---
spec: 0164
fecha: 2026-10-05
estado: implementada
resumen: Fase 0c del ADR 0123. `tools/ui-guard.ts` en `pnpm verify` (trinquete sin baseline: por archivo cambiado de `apps/merchant/src`, cada categoria ≤ la base del merge-base con `origin/main`) con ESLint `Linter` (`noInlineConfig`) para TS/TSX y postcss para CSS; `--report` cuenta todo el merchant; `tools/zone-audit.ts` avisa al arrancar sesion de commits sin trailer de Claude sobre el kit y las guardias.
disjunta: si
archivos: tools/ui-guard.ts, tools/ui-guard-counts.ts, tools/ui-guard-tsx.ts, tools/ui-guard.test.ts, tools/ui-guard-rules.test.ts, tools/zone-audit.ts, tools/zone-audit.test.ts, tools/verify.ts, tools/verify.test.ts, package.json, pnpm-lock.yaml, .claude/settings.json, AGENTS.md, docs/TRABAJO-EN-PARALELO.md, docs/design-system.md, docs/PARQUEADO.md
---

# 0164 — Guardias de UI del merchant (Fase 0c)

> N1 (tooling, sin datos ni auth). Zona Claude (`tools/**`, `.claude/**`). Las reglas son las del ADR 0123
> §«Fase 0c» y capa 4; esta spec fija como se miden. Owner (2026-10-05): «vamos con Fase 0c».

## Problema

- Las reglas del ADR 0123 (controles y tipografia solo con el kit, sin paleta cruda, sin CSS nuevo) no las chequea
  nada: `pnpm verify` (`tools/verify.ts:160-175`) corre typecheck, lint, formato, unit, build, e2e y Neon, y
  `eslint.config.mjs` solo trae `recommended`. La Fase 1 (GPT) arranca con el prompt del 2026-10-05.
- **Medido (2026-10-05, `rg`, aproximado; el guard da el numero exacto con `--report`):** en
  `apps/merchant/src/app`, 49 aperturas de `button|input|select|textarea|label|form|dialog|a` en una linea en 28
  archivos; 11 `style={` en 10; 122 clases `text-{tamaño}`/`font-{peso}`/`leading-*`; 8 valores arbitrarios
  (`data-[focus-visible]` es variante, `max-w-[var(--content-form)]` y `duration-[var(--duration-fast)]` son tokens);
  7 archivos importan React Aria fuera de `ui/`; 9 importan `next/link` fuera de `ui/` (el kit tiene `Link`, que lo
  envuelve: `ui/link.tsx:1`); 2 `import "*.css"` en `app/` (`layout.tsx:2`, `onboarding/page.tsx:3`).
- 3 commits de GPT tocaron `apps/merchant/src/ui/**` sin trailer de Claude (`4a69db7`, `a3221de`, `bd3a7b8`, antes
  de que esa zona fuera de Claude).
- **Medido para el diseño:** `Linter` de `eslint` 9.39.1 con `typescript-eslint` 8.70.0 como parser corre desde un
  `.ts` de `tools/` en Node 24.20.0; con `linterOptions.noInlineConfig: true` un `// eslint-disable-next-line`
  no apaga la regla (sale el aviso «has no effect» y el reporte de la regla). `postcss` NO resuelve desde la raiz
  (`node_modules/postcss` no existe; esta en el store, 8.5.26).

## Alcance

**Entra:**

1. `tools/ui-guard.ts` (autocontenido como `verify.ts`): modo trinquete (por defecto) y `--report`.
2. Gate `ui-guard` en `pnpm verify`.
3. `postcss` 8.5.26 como devDependency de la raiz.
4. `tools/zone-audit.ts` + hook `SessionStart` en `.claude/settings.json`.
5. Docs: §5 de `TRABAJO-EN-PARALELO.md` y `AGENTS.md` (zona del kit y el guard), seccion «Guardia» de
   `docs/design-system.md`, fila de `TASKS.md` del `type` de `TextField`.

**No entra:** migrar pantallas o sus e2e (Fase 1, GPT); el modo absoluto y el borrado de `@layer legacy` (Cierre);
restringir el `type` de `TextField` (romperia los 8 `datetime-local` de marketing, zona GPT: va a `TASKS.md` y se
hace cuando marketing pase a `DateTimeField`); correr el guard en la CI de GitHub (en `main` la base es el propio
HEAD: no compara nada; el que muerde es el pre-push); reglas sobre `apps/consumer`, `public`, `platform`.

## Diseño

### Que archivos mira

`apps/merchant/src/**` con extension `.ts`, `.tsx` o `.css`, **menos** `ui/**` (el kit), `server/**`, `app/api/**`
y `**/*.test.ts(x)`. Exentos de las categorias de color/estilo (`native-style`, `dangerous-html`, `raw-palette`,
`arbitrary-value`, `type-scale`, `css-color`), por ruta (ADR 0123 §2): `app/backoffice/brand/kit/templates/**` y
todo archivo `poster-preview.tsx`; en CSS, las declaraciones dentro de `@media print`.

### Categorias (cada una es un conteo por archivo)

TS/TSX, con ESLint `Linter` + parser de `typescript-eslint` (`jsx: true`), reglas definidas dentro del guard,
`noInlineConfig: true`. «Nativo» = `JSXOpeningElement` cuyo nombre es un `JSXIdentifier` en minuscula.

| Categoria | Cuenta |
|---|---|
| `native-element` | nativo que NO esta en la lista blanca (abajo) |
| `native-handler` | atributo `on[A-Z]…` en cualquier nativo |
| `native-style` | atributo `style` en un nativo, salvo un objeto literal con todas sus claves `"--…"` |
| `dangerous-html` | `dangerouslySetInnerHTML` en un nativo |
| `native-spread` | `{...props}` en un nativo |
| `create-element` | llamada a `createElement`, `jsx`, `jsxs` o `jsxDEV` (identificador o `X.createElement`) |
| `tag-variable` | variable con nombre en Mayuscula cuyo valor es un string literal o un `?:`/`&&`/`\|\|` de strings |
| `restricted-import` | import de `react-aria-components`, `react-aria`, `react-stately`, `@react-aria/*`, `@react-stately/*` o `next/link` |
| `css-import` | `import "….css"` en `app/**` |
| `raw-palette` | token de clase de paleta cruda (abajo) |
| `arbitrary-value` | token de clase con valor arbitrario (abajo) |
| `type-scale` | token `text-{xs,sm,base,lg,xl,2xl…9xl}`, `font-{thin…black}` o `leading-*` |

**Lista blanca de nativos:** `div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd section article header footer main nav
aside strong em small b i u s mark sub sup br hr figure figcaption blockquote q cite abbr time code pre kbd table
thead tbody tfoot tr th td caption colgroup col img picture source video canvas` y SVG (`svg g path circle ellipse
line polyline polygon rect text tspan defs linearGradient radialGradient stop clipPath mask pattern symbol use title
desc`).

**Tokens de clase:** se miran TODOS los string literales y `TemplateElement` (no solo `className`), salvo la fuente de
un `import`. Cada uno se parte por espacios; de cada token se descartan las variantes (lo anterior al ultimo `:` que no
este entre corchetes/parentesis) y un `!` o `-` inicial. Sobre la utilidad que queda:

- `raw-palette`: `^(bg|text|border(-[xytrblse])?|ring(-offset)?|fill|stroke|from|via|to|outline|divide|decoration|
  placeholder|caret|accent|shadow)-((slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|
  cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(/.*)?$`.
- `arbitrary-value`: la utilidad empieza con `[`, o contiene `-[`/`-(`, **salvo** que el valor sea exactamente
  `[var(--…)]` o `(--…)` (un token: `max-w-[var(--content-form)]` pasa).
- `type-scale`: `^(text-(xs|sm|base|lg|[2-9]?xl)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|
  black)|leading-.+)(/.*)?$`.

CSS, con `postcss` (`.css` fuera de `ui/`):

| Categoria | Cuenta |
|---|---|
| `css-file` | 1 si el archivo no esta en la lista cerrada (`app/globals.css`, `app/[locale]/(merchant)/business/onboarding/onboarding.css`); `*.module.css` nunca esta |
| `css-selector` | suma de `rule.selectors.length` |
| `css-at-rule` | `@apply`, `@layer`, `@theme` |
| `css-color` | en valores de declaraciones fuera de `@media print`: hex `#…`, `rgb(`/`rgba(`/`hsl(`/`hsla(`/`oklch(`/`oklab(`/`lab(`/`lch(`/`color-mix(`, o un nombre de color CSS (lista de los 148; `transparent` y `currentcolor` no cuentan) como palabra suelta |
| `css-kit-selector` | selectores con `.cp-`, `[data-variant`, `[data-rac`, `.react-aria-` |

### Trinquete (modo por defecto)

`node tools/ui-guard.ts [--base <ref>]` (base por defecto `origin/main`):

1. `mergeBase = git merge-base <base> HEAD`. Cambios = `git diff -M --name-status <mergeBase>` (contra el arbol de
   trabajo: commits + sin commitear) + `git ls-files --others --exclude-standard` (nuevos), filtrados por «que archivos
   mira». `R` → se compara contra la ruta vieja; `A`/sin seguimiento → base 0; `D` → nada que contar (cabeza 0).
2. Por archivo y categoria: `cabeza ≤ base` (base = el contenido en `mergeBase` via `git show`). Y por categoria, la
   suma de cabezas de los cambiados ≤ la suma de sus bases.
3. Salida: una linea por violacion `ruta  categoria  base → cabeza`, y debajo las lineas (`ruta:linea`) donde la
   cabeza tiene esa categoria. Exit 1 con violaciones, 0 sin ellas («ui-guard: N archivos, sin aumentos»). Un archivo
   que no parsea → exit 1 con el error (no se saltea).

`--report`: cuenta TODOS los archivos que mira en el arbol de trabajo e imprime la tabla de totales por categoria y
los 10 archivos con mas conteo; exit 0. Es la medida de la Fase 1 y la del Cierre.

### En `pnpm verify`

Gate `ui-guard` = `node tools/ui-guard.ts --base <base>` despues de `lint`. Salteado si es solo docs («solo docs») o
si ningun archivo cambiado esta bajo `apps/merchant/src/` («no se toco el merchant»). `planVerify` gana el campo
`uiGuard: boolean`.

### Auditoria de zona al arrancar

`node tools/zone-audit.ts`: ancla = el primer commit que AGREGA `tools/ui-guard.ts`
(`git log --diff-filter=A --format=%H -- tools/ui-guard.ts`, el ultimo). Lista los commits de `<ancla>..origin/main`
que tocan `apps/merchant/src/ui/`, `eslint.config.mjs`, `tools/ui-guard.ts`, `tools/ui-guard.test.ts` o
`tools/zone-audit.ts` y cuyo mensaje no tiene `Co-Authored-By: Claude`. Imprime `AVISO zona Claude: <sha> <asunto>
(<archivos>)` por cada uno y «avisale al owner». Sin ancla o sin commits: no imprime nada. Exit 0 siempre (detecta,
no impide: ADR 0123). Hook `SessionStart` en `.claude/settings.json`.

## Archivos

| Archivo | Accion |
|---|---|
| `tools/ui-guard.ts` (trinquete, CLI), `tools/ui-guard-counts.ts` (categorias, clases, CSS), `tools/ui-guard-tsx.ts` (ESLint), `tools/ui-guard.test.ts`, `tools/ui-guard-rules.test.ts` | crear |
| `tools/zone-audit.ts`, `tools/zone-audit.test.ts` | crear |
| `tools/verify.ts`, `tools/verify.test.ts` | editar (gate y plan) |
| `package.json`, `pnpm-lock.yaml` | `postcss` 8.5.26 devDependency |
| `.claude/settings.json` | hook `SessionStart` |
| `AGENTS.md`, `docs/TRABAJO-EN-PARALELO.md`, `docs/design-system.md`, `docs/PARQUEADO.md` (#79) | editar |

**Disjunta?** Si: GPT trabaja en `apps/merchant/src/app/**` y `tests/e2e/**`.

## Definition of Done

- [x] `pnpm exec vitest run --project tools tools/ui-guard.test.ts tools/zone-audit.test.ts tools/verify.test.ts` en
      verde, con: un caso por categoria (cuenta 1 en el ejemplo minimo, 0 en su par permitido: `<div>` vs `<button>`,
      `style={{"--x": 1}}` vs `style={{color: "red"}}`, `max-w-[var(--a)]` vs `w-[13px]`, `data-[x]:flex` no cuenta,
      `text-content` no cuenta como `type-scale` ni `raw-palette`, `@media print { a { color: red } }` no cuenta,
      ruta de `templates/**` exenta); `// eslint-disable` no apaga ninguna; y un repo git temporal con base y cambios
      donde: archivo nuevo con un `<button>` → exit 1; renombrado sin cambios → exit 0; renombrado con un `<button>`
      mas → exit 1; violacion movida de un archivo a otro nuevo → exit 1; borrar una violacion → exit 0; archivo sin
      seguimiento → contado.
- [x] Sobre el repo real, arbol limpio: `node tools/ui-guard.ts` → exit 0. Con un `<button onClick>` temporal en
      `app/backoffice/counter/counter-home.tsx` → exit 1 nombrando `native-element` y `native-handler` con su linea;
      revertido → exit 0. Salidas transcriptas.
- [x] `node tools/ui-guard.ts --report` → tabla transcripta en la spec (la linea de partida de la Fase 1).
- [x] `node tools/zone-audit.ts` → sin salida tras el commit de esta spec (el ancla es ese commit).
- [x] `pnpm verify` en verde con Node 24 con el gate `ui-guard` en la tabla (salteado: no se toco el merchant), una
      sola vez al final; tabla transcripta. Si `neon (full)` (cambia el lockfile) da rojo SOLO por PARQUEADO #74, se
      declara y se pide el OK del owner para el push.
- [x] `rg -n MUTATION apps tools` → vacio.

## Mutaciones — presupuesto: 3. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | comparacion por archivo `cabeza > base` → `cabeza > base + 1` | caso «archivo con un `<button>` mas» del repo temporal |
| M2 | renombrado compara contra la ruta NUEVA (base 0) en vez de la vieja | caso «renombrado sin cambios → exit 0» |
| M3 | sin `noInlineConfig: true` | caso «`// eslint-disable` no apaga» |

**Protocolo:** el de la skill `protocolo-de-verificacion`.

## Declarado AFUERA (sin oraculo, a proposito)

- Que alguien edite el guard, `eslint.config.mjs`, `ui/**` o `tokens.css`: no se puede impedir; lo cubre la
  auditoria de zona (detecta despues del push).
- Elementos por prop (`<Box as="button">`), tags calculados en tiempo de ejecucion fuera de los patrones de
  `tag-variable`, clases armadas por concatenacion de pedazos (`"bg-" + color`): no se detectan.
- Falsos positivos en strings que no son clases (un texto que diga `leading-x`): con el trinquete solo molestan si se
  agregan; se ven en la linea reportada.

## Implementacion

**Bitacora de mutaciones** (filas abiertas ANTES de medir; copias limpias en el scratchpad de la sesion):

| # | Archivo | shasum limpio | Ataca | Resultado ejecutado |
|---|---|---|---|---|
| M1 | `tools/ui-guard.ts:118` | `c2a40462` | `cabeza > base` → `cabeza > base + 1` | **ROJO 4 de 31** (`ui-guard.test.ts`): «un `<button>` mas», «nuevo», «movida», «sin commitear»; `AssertionError: expected [] to deeply equal [ { …(5) } ]`. Revertida: `diff` vacio, shasum `c2a40462` |
| M2 | `tools/ui-guard.ts:83` | `c2a40462` | renombrado tratado como nuevo (`basePath: null`): la forma plausible del bug; comparar contra la ruta nueva haria lanzar a `git show` (rojo por el motivo equivocado) | **ROJO 3 de 31**: «renombrado sin cambios» y «renombrado sin commitear» (`expected { files: 1, violations: [ { …(5) } ] } to deeply equal { files: 1, violations: [] }`) y `parseChanges`. Revertida: `diff` vacio, shasum `c2a40462` |
| M3 | `tools/ui-guard-tsx.ts:165` | `1fab4a27` | sin `noInlineConfig: true` | **ROJO 1 de 31**: «`// eslint-disable` no apaga» (`expected +0 to be 1`). Revertida: `diff` vacio, shasum `1fab4a27` |

**Desvios de la spec (decididos al implementar, medidos):**

- `tools/ui-guard.ts` se parte en tres (`ui-guard.ts`, `ui-guard-counts.ts`, `ui-guard-tsx.ts`): el hook
  `file-size.sh` corta en 300 lineas (el primer borrador tenia 554).
- El «total por categoria ≤ base» no se implementa aparte: con `cabeza ≤ base` en cada archivo cambiado, la suma lo
  cumple sola (los no cambiados son iguales; un borrado da 0).
- `tag-variable` cuenta solo si el string es un nombre de tag HTML: con «cualquier string» contaba toda constante en
  Mayuscula (`const LABEL = "Guardar"`).
- `arbitrary-value` con `[` inicial cuenta solo la propiedad arbitraria `[prop:valor]`: los selectores de tours
  (`'[data-tour="staff-add"]'`, 3 en `staff-tour-definitions.ts` y otros) daban 56 falsos.
- `create-element` no cuenta `document.createElement` (DOM, `lib/crop-image.ts:152`).
- El tema de `TextField` va a `PARQUEADO.md` #79 (no hay lista de tareas en `TASKS.md`). Medido: 8 `datetime-local`
  en 4 archivos de `marketing/` (2 cada uno).

**Linea de partida de la Fase 1** (`node tools/ui-guard.ts --report`, 2026-10-05, 216 archivos):

| Categoria | Total |
|---|---|
| `native-element` | 257 |
| `native-handler` | 193 |
| `native-style` | 6 |
| `restricted-import` | 20 |
| `css-import` | 2 |
| `type-scale` | 122 |
| `css-selector` | 1491 |
| `css-at-rule` | 3 |
| `css-color` | 480 |
| `css-kit-selector` | 49 |
| `dangerous-html`, `native-spread`, `create-element`, `tag-variable`, `raw-palette`, `arbitrary-value`, `css-file` | 0 |

**`pnpm verify` (Node 24.20.0, una vez):** typecheck ok, lint ok, ui-guard salteado (no se toco el merchant),
format:check ok, test ok, build ok, test:e2e ok, **neon (full) ROJO**: 1 de 3362, solo
`catalog-import-reconcile.neon.integration.test.ts` «agotados los intentos…» (`expected [ Array(1) ] to have a length
of +0 but got 1`) = PARQUEADO #74. Ese archivo solo, en seguida: `8 passed`. `full` porque cambio el lockfile.

**Sobre el repo real:** arbol limpio → `ui-guard: 0 archivos, sin aumentos`, exit 0. Con
`<button onClick={() => undefined}>x</button>` en `counter-home.tsx:30` → exit 1:
`counter-home.tsx  native-element  3 → 4` (lineas 30, 39, 46, 47) y `native-handler  1 → 2` (30, 42); revertido
(shasum `94ac0057` igual al limpio) → exit 0. `node tools/zone-audit.ts` → sin salida, exit 0 (sin ancla todavia).

## Handoff

N1: sin subagentes. Implementa Claude en la sesion; `pnpm verify`; push en el dia.

## Abierto

Nada.
