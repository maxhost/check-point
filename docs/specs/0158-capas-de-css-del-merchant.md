---
spec: 0158
fecha: 2026-10-05
estado: cerrada
resumen: Fase 0a del ADR 0123. El CSS propio de `globals.css` y `onboarding.css` pasa a `@layer legacy` (debajo de las utilidades), la paleta cruda de Tailwind deja de existir (`--color-*: initial`), el onboarding pierde su paleta propia, el oscuro queda en UN bloque de `tokens.css` con claro forzado en `<html>`, el contraste de tokens entra a `pnpm test`, y se publican capturas antes/despues (390 y 1280) para la decision 5 del owner.
disjunta: no
archivos: apps/merchant/src/app/globals.css, apps/merchant/src/app/[locale]/(merchant)/business/onboarding/onboarding.css, apps/merchant/src/ui/tokens.css, apps/merchant/src/ui/tokens.test.ts, apps/merchant/src/app/layout.tsx, apps/merchant/scripts/check-design-contrast.mjs, apps/merchant/package.json, tests/e2e/ui-layers.spec.ts, tests/e2e/ui-captures.spec.ts, tests/e2e/support/ui-layers-entry.tsx, tests/e2e/support/catalog-harness-server.ts, tests/e2e/brand-lifecycle.spec.ts, tests/e2e/loyalty-regression.spec.ts, docs/design-system.md, docs/ui-handoff.md
---

# 0158 — Capas de CSS del merchant (Fase 0a del ADR 0123)

> N1 (CSS + tooling, sin datos, sin auth). Zona Claude: `ui/tokens.css`, tooling y e2e de soporte. Decisiones del
> owner que aplica: 1 (una paleta), 2 (claro forzado) y 5 (se decide con las capturas que produce esta spec).

## Problema

Medido sobre `origin/main` `87de5ff` (rama `ui-sistema`), 2026-10-05:

- `apps/merchant/src/app/globals.css` (7.719 lineas) no tiene ningun `@layer` (`rg -c '@layer'` → 0 en los tres
  `.css` del merchant). Sus reglas sin capa le ganan a toda utilidad de Tailwind: `input:where(...)` (`globals.css:264`,
  padding 13 / radio 11 / borde `#cbd7ce`) y `label:where(...)` (`:247`) pisan al `TextField` del kit
  (`ui/text-field.tsx:46`: `px-3.5 py-2.5 rounded-md border-border-strong`, invalido `border-danger`). Hay 31
  `!important` en `globals.css`.
- `onboarding.css:1-15` redefine 13 tokens (primario `#1d332c` contra `#176548` del panel) y repite el oscuro dos
  veces (`:146-167` y `:169-188`); `:112-123` existen solo para ganarle a las reglas de `<p>` de `globals.css`.
- `ui/tokens.css`: el oscuro esta duplicado (`:77-120` bajo `prefers-color-scheme` y `:122-163` bajo
  `[data-theme="dark"]`, mismos valores). `app/layout.tsx:11` no pone `data-theme`. La paleta cruda de Tailwind
  (`bg-white`, `bg-emerald-600`…) compila: el `@theme inline` (`:166`) no la resetea. Uso actual de paleta cruda en
  `.ts/.tsx` del merchant: 0 (`bg-transparent` aparece 2 veces y es utilidad estatica, no depende de `--color-*`).
- `scripts/check-design-contrast.mjs` no corre en `pnpm verify` (es un script del paquete que nadie llama).

**Medido para el diseño** (compilando con `@tailwindcss/postcss` 4.3.3 del repo, scratch fuera del arbol):

- `@layer theme, base, legacy, components, utilities;` ANTES de `@import "tailwindcss"` deja el orden
  theme → base → legacy → components → utilities, con y sin `optimize`.
- `@theme { --color-*: initial; }` antes del `@theme inline` de roles: `bg-surface` se genera, `bg-white` no.
- `globals.css` usa `var(--color-primary|content|border|...)` 75 veces y Tailwind **si** emite esas variables
  (`--color-primary: var(--brand-primary-action)` en el CSS compilado): siguen validas tras el reset porque los roles
  se redeclaran despues.
- **`light-dark()` NO se transpila** dentro de custom properties, ni con `optimize` (Lightning CSS): la salida conserva
  `--ui-surface: light-dark(#fff, #14221c)`. En Safari < 17.5 / Chrome < 123 la variable queda invalida al usarse y
  TODO color cae a `unset`. Por eso esta spec no usa `light-dark()` (enmienda al ADR 0123, abajo).
- En este worktree `createRequire(apps/merchant/package.json)("postcss")` → `MODULE_NOT_FOUND` (postcss no es
  dependencia directa del merchant), y `tests/e2e/support/catalog-harness-server.ts:18` lo pide asi. Resolverlo
  desde `@tailwindcss/postcss` funciona: `createRequire(merchantRequire.resolve("@tailwindcss/postcss"))("postcss")`.

## Alcance

**Entra:**

1. `globals.css`: `@layer theme, base, legacy, components, utilities;` como primera linea; las dos `@import` quedan
   igual; TODO el resto del archivo (de `:root {` en adelante, incluidos `@media`, `@keyframes` y `@page`) dentro de un
   solo `@layer legacy { … }`. Sin cambiar ninguna regla adentro.
2. `onboarding.css`: borrar los 13 tokens y el `color-scheme` de `.merchant-onboarding` (`:2-15`; queda
   `background: var(--ui-canvas)`), las tres reglas `p.text-*` (`:112-123`) y los dos bloques oscuros (`:146-188`). Lo
   que queda, entero dentro de `@layer legacy { … }`. Los hex `#a55a43` y la sombra `rgb(...)` quedan (Fase 1).
3. `tokens.css`: `@theme { --color-*: initial; }` inmediatamente antes del `@theme inline`; borrar el bloque
   `@media (prefers-color-scheme: dark)` (`:77-120`); el oscuro queda solo en `:root[data-theme="dark"]` (para el
   cierre y para los e2e que lo fuerzan). `:root` y `:root[data-theme="dark"]` quedan SIN capa (solo custom
   properties y `color-scheme`).
4. `app/layout.tsx`: `<html lang="es" data-theme="light">`.
5. Contraste en `verify`: `apps/merchant/src/ui/tokens.test.ts` (vitest, lo corre `pnpm test`) con los mismos 19
   pares × claro/oscuro de `check-design-contrast.mjs`; se borran el `.mjs` y el script `check:design-contrast` de
   `apps/merchant/package.json`, y sus menciones en `docs/design-system.md:10,34,88` y `docs/ui-handoff.md:45,75`.
6. Oraculos nuevos (ver DoD) y capturas antes/despues.
7. `catalog-harness-server.ts:18`: resolver `postcss` desde `@tailwindcss/postcss` (arriba), para que el harness corra
   en cualquier worktree.
8. `brand-lifecycle.spec.ts:136` y `loyalty-regression.spec.ts:23` fuerzan el oscuro solo con `emulateMedia`: sin el
   bloque de media query pasarian a medir claro en silencio. Se les agrega
   `document.documentElement.dataset.theme = theme` (como ya hace `loyalty-design-system.spec.ts:190`). No cambia
   ninguna asercion.

**No entra:** tocar reglas dentro de `@layer legacy` (Fase 1, pantalla por pantalla); las reglas `cp-*` de
`globals.css` que parchean al kit (`:257`, `:277-302`, `:7301+`: con la capa quedan inofensivas, las barre la 0c);
ajustar el kit a «la medida de hoy» (si el owner elige eso en la decision 5 va en otra spec, ADR 0123); `light-dark()`;
seguir la preferencia del sistema (vuelve al cierre); `driver.js/dist/driver.css` (queda sin capa, solo `.driver-*`);
kit nuevo, guardias, `places-search.tsx`; pantallas server-side sin harness (abajo).

## Diseño

### Por que no `light-dark()` (enmienda al ADR 0123)

Con claro forzado durante toda la migracion, `light-dark()` no aporta nada hasta el cierre y sube el piso de navegadores
de Safari 16.4 (el de Tailwind v4) a 17.5, rompiendo TODO color en iPads viejos de mostrador. «Una vez por color» se
logra igual borrando la copia de media query: queda un solo bloque oscuro. Al cierre (oscuro habilitado) se decide como
seguir la preferencia del sistema con el dato de navegadores de ese momento.

### `tokens.test.ts`

- Lee `tokens.css` como texto. Bloques `:root {` y `:root[data-theme="dark"]` como hoy el `.mjs` (`block()` +
  `variables()` + `contrast()`), un `it` por modo con los 19 pares, mensaje con par y razon.
- **Capas:** compila `globals.css` con `@tailwindcss/postcss` (postcss resuelto como en Alcance 7; `from` = la ruta
  real para que resuelvan los `@import`) y parsea la salida con postcss. Aserciones:
  (a) el primer nodo es `@layer theme, base, legacy, components, utilities` (normalizando espacios);
  (b) todo nodo de primer nivel fuera de un `@layer` es una regla `:root` / `:root[data-theme="dark"]` o un `@media`
  cuyas reglas son `:root`, y TODAS sus declaraciones son `--*` o `color-scheme`;
  (c) parseando `onboarding.css` crudo: un unico nodo de primer nivel, `@layer legacy`.
- **Paleta:** compila un CSS de prueba `@import "tailwindcss" source(none); @import "./tokens.css";
  @source inline("bg-white bg-emerald-600 bg-surface text-content");` con `from` dentro de `src/ui/` y asevera que la
  salida tiene `.bg-surface` y `.text-content` y NO tiene `.bg-white` ni `.bg-emerald-600`.

### `ui-layers.spec.ts` (e2e)

Valores esperados = los que declara el kit, computados: input `padding-left 14px`, `padding-top 10px`,
`border-top-left-radius 14px`, `border-top-color rgb(130, 153, 141)` (`#82998d`); invalido `rgb(142, 42, 42)`
(`#8e2a2a`); `Button` secundario `border-top-width 1px` y `font-weight 700`; `Button` primario
`background-color rgb(23, 101, 72)` (`#176548`).

1. **Backoffice (harness):** `support/ui-layers-entry.tsx` renderiza dentro de
   `<div className="backoffice-layout"><div className="backoffice-content">` un `TextField` («Campo valido»), un
   `TextField` con `isInvalid` y `errorMessage` («Campo invalido»), un `Button variant="secondary"` y uno primario.
   Se sirve con `startCatalogHarness`. Asevera los valores de arriba.
2. **Onboarding real (Next dev, `:3001/es/business/onboarding`):** mismos `page.route` que
   `onboarding-google-places.spec.ts:10-50` hasta elegir el lugar; asevera el `TextField` «Nombre del negocio»
   (padding, radio, borde `#82998d` — hoy `#9eafa3` por `onboarding.css`) y el boton «Continuar» con fondo `#176548`
   (hoy `#1d332c`). Es el oraculo de que el orden de capas sobrevive al pipeline de Next/Turbopack con el chunk de
   `onboarding.css` separado.

Los dos casos tienen que estar **rojos sobre `origin/main`** (se corre una vez antes de tocar el CSS y se transcribe el
rojo: padding 13, radio 11, `#cbd7ce` / `#9eafa3` / `#1d332c`).

### Capturas (decision 5 del owner)

`tests/e2e/ui-captures.spec.ts`: `test.skip(!process.env.UI_CAPTURES_DIR)` (no es un oraculo: no corre en `verify`).
Para cada superficie × ancho {390, 1280}, `colorScheme: "light"`, `reducedMotion: "reduce"`, `fullPage`, guarda
`<dir>/<superficie>-<ancho>.png`. Superficies (todas con fixture existente): onboarding real (paso 1 y paso 1 con lugar
elegido, rutas de `onboarding-google-places.spec.ts`), mostrador (`counter-harness.tsx`, fixture de
`counter-mobile.spec.ts`), programa (`loyaltyHarness` + `loyaltyFixture`), marca, catalogo, staff y locales
(`loyalty-regression-entry.tsx?surface=…` + sus fixtures en `loyalty-regression.spec.ts`).

Orden: (1) escribir el spec de capturas y correrlo sobre el arbol SIN tocar el CSS → `antes/`; (2) el cambio;
(3) correrlo → `despues/`. Se publica un Artifact privado con las 16 parejas lado a lado (antes | despues, por
superficie y ancho), y el link va a esta spec y al estado. Las PNG no se commitean.

Fuera de las capturas, **declarado**: inicio del backoffice, clientes, marketing (6 rutas), suscripcion, kit de marca,
landing: son server components que leen la base, sin harness; el owner las ve en el preview de Vercel y la Fase 1 las
captura pantalla por pantalla con este mismo spec (anotado en la Fase 1 del ADR 0123: es su uso, no andamiaje).

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/app/globals.css` | editar (declaracion de capas + `@layer legacy`) |
| `apps/merchant/src/app/[locale]/(merchant)/business/onboarding/onboarding.css` | editar |
| `apps/merchant/src/ui/tokens.css` | editar |
| `apps/merchant/src/ui/tokens.test.ts` | crear |
| `apps/merchant/src/app/layout.tsx` | editar (`data-theme="light"`) |
| `apps/merchant/scripts/check-design-contrast.mjs` | borrar |
| `apps/merchant/package.json` | editar (borrar `check:design-contrast`) |
| `tests/e2e/ui-layers.spec.ts`, `tests/e2e/support/ui-layers-entry.tsx` | crear |
| `tests/e2e/ui-captures.spec.ts` | crear |
| `tests/e2e/support/catalog-harness-server.ts` | editar (resolucion de postcss) |
| `tests/e2e/brand-lifecycle.spec.ts`, `tests/e2e/loyalty-regression.spec.ts` | editar (`dataset.theme`) |
| `docs/design-system.md`, `docs/ui-handoff.md` | editar (contraste = `tokens.test.ts`) |

**Disjunta?** No: `globals.css` y `layout.tsx` son de toda pantalla. GPT no tiene que tocar `globals.css` ni
`onboarding.css` entre el commit de esta spec y su push; si `origin/main` los cambio, se rebasea y se re-envuelve.

## Definition of Done

- [ ] Rojo de `ui-layers.spec.ts` sobre el CSS de `origin/main`, transcripto (los valores viejos), ANTES del cambio.
- [ ] `pnpm exec playwright test tests/e2e/ui-layers.spec.ts` verde despues.
- [ ] `pnpm vitest run apps/merchant/src/ui/tokens.test.ts` verde (contraste 38 pares, capas, paleta).
- [ ] `rg -c '@layer' apps/merchant/src --glob '*.css'` → `globals.css` 2, `onboarding.css` 1.
- [ ] `rg -n 'prefers-color-scheme' apps/merchant/src --glob '*.css'` → vacio.
- [ ] `rg -n -- '^\s*--' 'apps/merchant/src/app/[locale]/(merchant)/business/onboarding/onboarding.css'` → vacio
      (hoy 39: el onboarding no declara tokens).
- [ ] `rg -n 'light-dark' apps/merchant/src` → vacio.
- [ ] `rg -n 'check-design-contrast|check:design-contrast' apps docs/design-system.md docs/ui-handoff.md` → vacio.
- [ ] Build real: tras el `build` de `verify`,
      `rg -c '@layer theme, ?base, ?legacy, ?components, ?utilities' apps/merchant/.next/static --glob '*.css'` → ≥ 1.
- [ ] Capturas `antes/` y `despues/` tomadas segun el orden de arriba; Artifact publicado; link en esta spec.
- [ ] `pnpm verify` en verde con Node 24, **una sola vez al final** (ADR 0113), con su tabla final transcripta.
- [ ] `rg -n MUTATION apps tools tests` → vacio.

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `globals.css`: sacar el `@layer legacy {` y su `}` de cierre (CSS viejo sin capa otra vez) | `ui-layers` caso backoffice (padding 13) **y** `tokens.test.ts` (b). Guard hermano: ninguno; los dos oraculos son independientes, se transcriben los dos |
| M2 | `tokens.css`: borrar `@theme { --color-*: initial; }` | `tokens.test.ts` paleta (`.bg-white` presente) |
| M3 | `onboarding.css`: reponer `--ui-border-strong: #9eafa3;` en `.merchant-onboarding` | `ui-layers` caso onboarding (borde). `tokens.test.ts` (c) NO lo ve (sigue en una capa): por eso existe el caso real |
| M4 | `tokens.css`: `--ui-text-muted` claro → `#8a9a91` | `tokens.test.ts` contraste claro `ui-text-muted/ui-canvas` |

**Protocolo:** skill `protocolo-de-verificacion` §2 (shasum limpio → fila de bitacora → etiqueta `MUTATION` en un
comentario CSS `/* MUTATION */` → medir y transcribir → revertir con `diff`). De a una. Leer la asercion del rojo.

**Condicion de corte:** dos vueltas seguidas de «el fix abrio la siguiente» → al owner. Lo que queda afuera se declara.

## Declarado AFUERA (sin oraculo, a proposito)

- Que ninguna pantalla cambie de aspecto mas alla de los controles del kit: es justamente lo que muestran las
  capturas; el juez es el owner (ADR 0123, riesgo 2). Sin `toHaveScreenshot` (Fase 0b).
- Los 31 `!important` de `globals.css` siguen ganandole a toda utilidad (dentro de una capa, un `!important` le gana a
  cualquier declaracion normal): igual que hoy.
- `driver.css` sin capa: solo afecta `.driver-*` (tours).
- Pantallas server-side sin harness (lista arriba): QA del owner en el preview.
- El oscuro: no hay oraculo nuevo; los e2e que lo fuerzan por `data-theme` siguen corriendo.

## Handoff

N1: sin subagentes (CLAUDE.md §Niveles). Implementa la sesion principal; `pnpm verify` una vez al final; commit;
el owner recibe el link del Artifact para decidir la decision 5 y GPT el sha antes de su proxima pantalla.

## Abierto

Nada que bloquee. La decision 5 se toma DESPUES, con las capturas; no cambia esta spec.
