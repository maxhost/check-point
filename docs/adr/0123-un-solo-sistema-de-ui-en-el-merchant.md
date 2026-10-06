---
adr: 0123
fecha: 2026-10-05
estado: aceptada
resumen: La UI del merchant se unifica en Tailwind v4 + React Aria por cuatro capas (tokens → tema de Tailwind → kit `ui/` → pantallas), con modelo hibrido (pantallas = layout + roles de color de tokens; controles, formularios, tipografia y superficies solo del kit), una sola paleta (la del panel), modo claro forzado hasta el cierre, el kit/tokens/guard en zona de Claude, y guardias en `verify` sin archivo de baseline (trinquete contra el merge-base). Plan en fases 0a (capas) → 0b (kit) → 0c (guardias) → 1 (pantalla por pantalla, GPT).
---

# 0123 — Un solo sistema de UI en el merchant: Tailwind + React Aria por capas

## Contexto

Pedido del owner (2026-10-05): «pasemos todo a tailwind css + aria, que quede super organizado [...] si mañana queremos
cambiar estilos sepamos como hacerlo si quiero cambiar colores por ejemplo o modo claro/oscuro. No quiero tener que tocar
un lugar y romper todo ni tocar mil lugares para una sola pantalla. [...] quiero un estilo consistente, que respete lo que
ya creamos [...]. cada vez que gpt crea un formulario, se sale de lo que ya definimos en wizard [...] tamaños y estilos del
form, label, input, placeholder, textos, colores, tamaños».

El plan paso por una revision adversarial (2026-10-05) que encontro que el borrador no cumplia el objetivo; sus
hallazgos estan abajo, reproducidos por el orquestador donde dice ✔.

## Hallazgos de base (revision adversarial 2026-10-05; reproducidos por el orquestador los marcados ✔)

- ✔ **`globals.css` no tiene NINGUN `@layer`** (`rg -c @layer` vacio): sus reglas propias le ganan a toda utilidad de
  Tailwind (que vive en `@layer utilities`). ✔ `input:where(...)` (`globals.css:264`) y `label:where(...)` (`:247`)
  pisan al kit. Medido por el revisor en Chromium con el CSS compilado: el mismo `TextField` mide padding 13 / radio 11 /
  borde `#cbd7ce` en wizard y catalogo y 10/14 / radio 14 en loyalty; **el estado invalido no pinta rojo** fuera de
  loyalty/marketing; el `Button` secundario sale sin borde y con peso 400. Envolviendo el CSS viejo en `@layer legacy`
  las tres pantallas quedan iguales a lo que declara el kit.
- ✔ `onboarding.css` tiene 43 hex y redefine tokens (primario `#1d332c` vs `#176548` del backoffice): «el estilo del
  wizard» hoy = tokens + `onboarding.css` + el `input` viejo de `globals.css`.
- ✔ `tokens.css`: el bloque oscuro de la media query (79–119) y el de `[data-theme="dark"]` (123–163) son identicos
  (duplicados); `scripts/check-design-contrast.mjs` solo lee uno y no esta en `verify` (no medido por el orquestador).
- ✔ `app/components/places-search.tsx` (UI 0157, ya en `main`) arma su campo a mano (3 controles nativos): el kit no
  tiene Combobox. Es la regresion que describe el owner, en vivo.
- La paleta cruda de Tailwind (`bg-emerald-600`, `bg-white`, `text-[15px]`, `bg-(--x)`) compila hoy; uso actual en
  `.tsx`: 0 (revisor). `@theme { --color-*: initial; }` la elimina si va ANTES de los roles semanticos.
- El modo oscuro del backoffice hoy esta mezclado: cientos de `color`/`background` en hex en `globals.css` no se
  invierten (revisor; `globals.css:139-156` documenta texto blanco sobre blanco).
- `ui/brand-theme.tsx` no se usa en `app/` (revisor): andamiaje.
- Los e2e no comparan capturas (`toHaveScreenshot` ausente); `loyalty-design-system.spec.ts:178-219` compara
  `getComputedStyle` solo de font/color/bg.

## Medido antes (rama `onboarding-google`, `apps/merchant/src`) — RE-MEDIR sobre `origin/main` al escribir el ADR

- Tailwind `^4.2.1` (`@tailwindcss/postcss`, sin `tailwind.config`), `react-aria-components ^1.12.3`, `iconoir-react`,
  `driver.js`.
- `ui/tokens.css` (213 lineas): variables `--brand-*` y `--ui-*`, bloque `@media (prefers-color-scheme: dark)`, y
  `@theme inline` que expone `bg-surface`, `text-content`, `bg-primary`, `text-danger`, `rounded-md`, etc.
- Kit `ui/` (11 componentes; 7 sobre React Aria: Button, TextField, SelectField, CheckboxField, ChoiceGroup,
  NumberField, TextAreaField). `TextField` fija label/input/placeholder/ayuda/error del wizard.
- Onboarding (`app/[locale]/(merchant)/business/onboarding`): 8/10 `.tsx` usan el kit; 2 `<button>` nativos; 0 inline
  styles; 0 hex; `onboarding.css` 177 lineas.
- Backoffice (`app/backoffice`): 52/123 `.tsx` usan el kit; 6 importan `react-aria-components` directo; 126 `<button>`
  nativos en 40 archivos; 37 `<input|select|textarea>` nativos; 365 de 803 `className="..."` literales empiezan con una
  clase propia.
- `app/globals.css`: 7.721 lineas, 1.462 reglas de clase, 427 hex, 532 `var(--`. Bloques mas grandes: `brand-kit` (161),
  `loyalty-page` (54), `catalog-ai` (44), `driver-active` (32, tours), `tpl-*` (plantillas de marca).
- `app/components/` (7 `.tsx`): 9 `<button>`, 5 inputs nativos, 0 imports del kit.
- `eslint.config.mjs` en la raiz: solo `js.recommended` + `typescript-eslint recommended`. Sin plugin de React/JSX.

## Decisiones del owner (2026-10-05)

1. **Paleta:** una sola, la del panel (`#176548` y los tokens actuales). El onboarding la adopta; `onboarding.css`
   pierde sus colores propios.
2. **Modo oscuro:** forzado en claro (`<html data-theme="light">`) durante la migracion; oscuro se habilita al cierre
   con una pasada de capturas en oscuro.
3. **Zonas (enmienda ADR 0114):** `apps/merchant/src/ui/**`, `ui/tokens.css`, `eslint.config.mjs` y `tools/ui-guard*`
   son de Claude. GPT pide piezas del kit por spec. Tocarlos nunca es «arreglo mecanico».
4. **Modelo hibrido** de pantallas (ver capa 4), recomendado y aceptado («vamos con lo hibrido»).
5. **La medida canonica de los controles es la del KIT** (owner, 2026-10-05, con las capturas antes/despues de la 0158:
   «usemos las del kit»). No se ajusta el kit a la medida vieja del CSS de `globals.css`.

## Decision

### 1. Cuatro capas, cada decision en un solo lugar

1. **Tokens** — `apps/merchant/src/ui/tokens.css`: el UNICO lugar con valores de color (y radios, sombras, tipografia,
   duraciones). Dos niveles: paleta primitiva → roles semanticos (`--ui-surface`, `--ui-text`, `--brand-primary-action`…).
   Claro y oscuro se definen aca, **una vez por color con `light-dark()`**, y `color-scheme` se gobierna con `:root` /
   `[data-theme]` (ya existe `[data-theme]`). Se borran las copias de oscuro de `tokens.css` y de `onboarding.css`.
   `@theme { --color-*: initial; }` va ANTES de los roles: la paleta cruda de Tailwind deja de existir.
   `scripts/check-design-contrast.mjs` lee el formato nuevo y entra a `pnpm verify`.
2. **Tema de Tailwind** — el `@theme inline` del mismo archivo: traduce roles a utilidades. Escala tipografica y de
   espaciado de formularios tambien como tokens (`--text-field`, `--field-height`…) si hace falta mas de lo que da
   Tailwind por defecto.
3. **Kit** — `apps/merchant/src/ui/`: todo control interactivo y toda pieza repetida, sobre React Aria + utilidades de
   Tailwind: Button, campos, Form/FormSection, Dialog/Modal, Popover, Menu, Tabs, Table, Switch, Card, Badge, Toast,
   PageHeader, EmptyState, **Heading, Text**. Variantes (tamaño, intencion) dentro del componente; las pantallas no pasan colores.
4. **Pantallas (modelo hibrido, decision 4 del owner)** — componen piezas del kit; usan Tailwind para LAYOUT (grid,
   flex, gap, padding, ancho, responsive) y pueden usar **roles de color de tokens** (`text-content-muted`,
   `border-border`, `bg-surface-subtle`) para acentos sueltos. **Controles y formularios: solo kit. Tipografia (tamaño,
   peso, interlineado): solo kit** (`Heading` niveles 1–3, `Text` variantes `body`/`muted`/`small`/`label`).
   **Superficies repetidas: kit** (`Card`, `PageHeader`). El guard prohibe en pantallas las utilidades `text-{xs..9xl}`,
   `font-{weight}` y `leading-*`.

### 2. Excepciones declaradas

- **Por ruta, no por prefijo de clase:** `app/backoffice/brand/kit/templates/**`, `poster-preview.tsx` y el CSS de
  impresion (pintan los colores DEL COMERCIO). `brand/kit/steps/*` (formularios) ENTRA al sistema.
- `style` dinamico solo via componente del kit (`ProgressBar`, `Swatch`, `Skeleton`) o `style` con custom properties
  `--*` exclusivamente.
- Tours (`driver.js`): su CSS de override queda en un archivo propio de tours, con tokens.
- Wallet / pases / imagenes generadas en el servidor: fuera (no son UI del navegador).

### 3. Alcance

`apps/merchant` entero: onboarding, backoffice (incluidos `subscription`, `onboarding` del backoffice,
`backoffice-navigation.tsx`), `app/components`, `app/page.tsx`, `not-found.tsx`, `global-error.tsx`, `layout.tsx`. `apps/consumer`, `apps/public` y `apps/platform` fuera
(no comparten kit, tokens ni RAC con el merchant — revisor; mismo patron si el owner lo pide).

## Plan de migracion (v2)

- **Fase 0a — capas (Claude, N1):** envolver el CSS propio de `globals.css` (y `onboarding.css`) en `@layer legacy`
  con `@layer theme, base, legacy, components, utilities;`; `--color-*: initial` antes de los roles; `light-dark()` y
  borrar duplicados; contraste en `verify`. **Capturas antes/despues de cada pantalla** (claro; 390 y 1280) para la
  decision 5 del owner. Si la decision 5 es «la de hoy», se ajusta el KIT a esa medida (no se vuelve atras la capa).
- **Fase 0b — kit completo (Claude):** `Form`, `FormSection`, `FormActions`, `Dialog`/`Modal`, `Combobox` (y migrar
  `places-search.tsx` a el), `SegmentedControl`, `Switch`, `Tabs`, `ProgressBar`, `Heading`, `Text`, `Card`, `PageHeader`; campos `file`/`color`/`time`/`range`/`search` donde hay uso. Todo componente reenvia `data-tour` al elemento
  que lo necesita. **Harness de muestra en `tests/e2e/support/`** (no `/backoffice/_ui`: en Next una carpeta `_x` no se
  rutea) con `toHaveScreenshot` en claro y oscuro, 390 y 1280. `brand-theme.tsx` se usa o se borra.
- **Fase 0c — guardias (Claude):** `tools/ui-guard.ts` en `pnpm verify`, **sin archivo de baseline**: ESLint por
  Linter API (`noInlineConfig: true`) + postcss. Para cada archivo de
  `git diff -M --name-status $(git merge-base HEAD origin/main)` bajo `apps/merchant/src`: conteo actual ≤ conteo en la
  base (rename → ruta vieja; nuevo → 0); y total por categoria ≤ base. Reglas:
  - JSX: lista BLANCA de elementos nativos (div, span, p, h1–h6, ul/ol/li, section, article, header, footer, main, nav,
    aside, strong, em, small, img, svg y sus hijos…); sin handlers `on[A-Z]` en nativos; sin `style`,
    `dangerouslySetInnerHTML` ni spread de props en nativos; sin `createElement`/`jsx`/`jsxs`; sin variables cuyo valor
    sea un nombre de tag (`const Tag = "button"`); imports de `react-aria-components|react-aria|react-stately|@react-aria/*|@react-stately/*`
    por `patterns` solo dentro de `ui/`; sin `import "*.css"` en `app/**`.
  - Clases: en cualquier literal o template (no solo `className`): sin paleta cruda (`-(slate|gray|…|white|black)`), sin
    valores arbitrarios `-[`/`-(` de color o tamaño.
  - CSS: lista CERRADA de `.css` permitidos en `apps/merchant/src`; selectores medidos con postcss por archivo; sin
    `@apply`/`@layer`/`@theme`/`*.module.css` fuera de `ui/`; sin colores (hex, `rgb`, `hsl`, `oklch`, `color-mix`,
    nombres) fuera de `tokens.css` y de las excepciones por ruta; sin selectores sobre piezas del kit (`.cp-*`,
    `[data-variant]`, `[data-rac]`, `.react-aria-*`) fuera de `ui/`.
  - **Que NO se puede impedir tecnicamente:** que alguien edite el guard, `eslint.config.mjs`, `ui/**` o `tokens.css`.
    Se cubre con la decision 3 (zonas) + un chequeo al arrancar la sesion de Claude que lista commits de `origin/main`
    sobre esos globs sin el trailer `Co-Authored-By: Claude` y avisa al owner. **Detecta, no impide.**
- **Fase 1 — pantalla por pantalla (GPT):** cada spec deja sus archivos en 0, borra su bloque de `@layer legacy` y suma
  su pantalla al **e2e de paridad** (por cada `input`/`label`/`button`: padding, `border-*`, radio, `font-size`,
  `font-weight` y borde invalido contra el harness; extiende `loyalty-design-system.spec.ts:178-219`). Los `data-tour`
  y los `locator(".clase")` de e2e se migran en el mismo commit. Orden: mostrador → catalogo → clientes → staff →
  locales → marketing → programa → marca (`steps/*`) → subscription → onboarding del backoffice → shell (navegacion,
  landing, 404, error).
- **Cierre:** `@layer legacy` vacio y borrado; las reglas quedan absolutas; modo oscuro habilitado tras una pasada de
  capturas en oscuro.

## Riesgos que ya veo

- Regresiones visuales al migrar: hoy no hay tests visuales; el QA es del owner pantalla por pantalla.
- `@layer legacy` cambia a la vez el aspecto de todo campo y boton del kit (incluido el wizard): se aprueba por
  capturas, no a ciegas.
- Los 82 `data-tour` y los 86 `locator(".clase")` de e2e se rompen si se quitan atributos o clases sin migrar tour y
  test en el mismo commit.
- No medido: el efecto de `@layer legacy` en pantallas completas (solo campos aislados) y el orden de CSS del build de
  Next/Turbopack frente a una compilacion postcss suelta. Se mide en la Fase 0a con las capturas.

## Consecuencias

- `docs/TRABAJO-EN-PARALELO.md` §5/§6 y las instrucciones de GPT (`AGENTS.md`) se enmiendan con la decision 3 en la
  Fase 0c.
- Cada fase lleva su spec; la 0a es N1 (CSS + tooling, sin datos), la 0b y la 0c tambien; las de Fase 1 son de GPT.

## Enmienda 2026-10-05 (spec 0158, Fase 0a)

- **Sin `light-dark()` hasta el cierre.** Medido compilando con `@tailwindcss/postcss` 4.3.3 del repo: `light-dark()`
  dentro de custom properties sale tal cual, tambien con `optimize` (Lightning CSS no lo transpila ahi). En Safari < 17.5
  / Chrome < 123 la variable queda invalida al usarse y todo color cae a `unset`; el piso de Tailwind v4 es Safari 16.4.
  Con claro forzado no aporta nada: «una vez por color» se cumple borrando la copia de `prefers-color-scheme` y dejando
  un solo bloque `:root[data-theme="dark"]`. Como seguir la preferencia del sistema se decide al cierre, con el dato de
  navegadores de ese momento.
- **El onboarding adopta la paleta del panel (decision 1) en la 0a**, no en la Fase 1: las capturas de la decision 5
  tienen que mostrar la paleta que queda.
- **Capturas por pantalla:** `tests/e2e/ui-captures.spec.ts` (se activa con `UI_CAPTURES_DIR`) es la herramienta de
  antes/despues que cada spec de Fase 1 extiende con su pantalla.
- **CSS de terceros en una capa, no sin capa** (medido en la implementacion de la 0158): `driver.css` sin capa rompia los
  tours, porque su `.driver-active * { pointer-events: none }` (sin capa) le gana a las excepciones de `legacy` y la
  listbox de un Select quedaba debajo del overlay (5 e2e de tours rojos). Va con `@import "driver.js/dist/driver.css"
  layer(base)` en `globals.css`. Regla: todo CSS de terceros entra en `base`, nunca sin capa.


## Enmienda 2026-10-05 (spec 0159, Fase 0b)

- **La Fase 0b se parte en tres rebanadas N1 pusheables solas:** 0159 (tipografia, superficies, formularios y el
  harness del kit), 0160 (overlays y navegacion: `Dialog`, `Combobox` + `places-search.tsx`, `Tabs`,
  `SegmentedControl`, `Switch`, `ProgressBar`, `Link`) y 0161 (campos `file`/`color`/`time`/`datetime-local`/`range`/
  `search`). GPT usa en la Fase 1 lo que cada una deja en `origin/main`.
- **Capturas del kit solo en Mac** (owner, 2026-10-05: «no me interesa linux, me interesa que se vean en windows y
  mac, ningun usuario mio usara linux»). La CI corre en Ubuntu y esta Mac no puede generar referencias de Linux: los
  `toHaveScreenshot` (Chromium y WebKit, claro/oscuro, 390/1280) corren en `pnpm verify`/pre-push y se saltean con
  `CI`. Lo que corre en todos lados es un oraculo de estilos computados (Chromium = motor de Chrome/Edge en Windows,
  con Arial en los dos sistemas). El pixel de Windows queda en el QA del owner.
- **`BrandTheme` se borra** (sin uso en `app/`): el «se usa o se borra» de la 0b.

## Enmienda 2026-10-05 (spec 0161, Fase 0b rebanada 3) — decisiones del owner

- **Fecha y hora con segmentos de React Aria, no con el control nativo** (owner, 2026-10-05, eligio «React Aria
  (segmentos)» frente a «nativo con estilo del kit»), **con boton de calendario** en fecha+hora (eligio «Si, boton con
  calendario»). El kit fija idioma `es-419` y 24 h, y conserva los valores de texto del input nativo (`HH:mm`,
  `YYYY-MM-DDTHH:mm`) para que las pantallas no cambien su logica ni su manejo de zona horaria.
- **Color = muestra (selector del sistema) + codigo hex editable, una sola variante** (owner, 2026-10-05).
- **Busqueda = lupa + boton borrar** (`SearchField` de React Aria; Escape vacia) (owner, 2026-10-05).
