---
spec: 0159
fecha: 2026-10-05
estado: implementada
resumen: Fase 0b del ADR 0123, rebanada 1 de 3. El kit suma `Heading`, `Text`, `Card`, `PageHeader`, `Form`, `FormSection` y `FormActions` con la medida del wizard; se borra `BrandTheme` (sin uso); nace el harness del kit (`ui-kit-entry.tsx`) con oraculo de estilos computados (corre en todos lados) y capturas `toHaveScreenshot` de Mac en Chromium y WebKit (claro/oscuro × 390/1280), que corren en `pnpm verify` y se saltean en la CI.
disjunta: si
archivos: apps/merchant/src/ui/heading.tsx, apps/merchant/src/ui/text.tsx, apps/merchant/src/ui/card.tsx, apps/merchant/src/ui/page-header.tsx, apps/merchant/src/ui/form.tsx, apps/merchant/src/ui/index.ts, apps/merchant/src/ui/brand-theme.tsx, apps/merchant/src/ui/brand-contrast.ts, apps/merchant/src/ui/brand-contrast.test.ts, tests/e2e/support/ui-kit-entry.tsx, tests/e2e/support/ui-kit-checks.ts, tests/e2e/ui-kit.spec.ts, tests/e2e/ui-kit.webkit.spec.ts, docs/design-system.md, docs/adr/0123-un-solo-sistema-de-ui-en-el-merchant.md
---

# 0159 — Kit: tipografia, superficies y formularios (Fase 0b, rebanada 1)

> N1 (componentes de UI + e2e de soporte, sin datos ni auth). Zona Claude (`apps/merchant/src/ui/**`, ADR 0123
> decision 3). Aplica la decision 5 del owner: **la medida es la del kit**, y la referencia del kit es el wizard.

## Particion de la Fase 0b (CLAUDE.md: una feature grande se parte en rebanadas N1 pusheables solas)

| Spec | Piezas | Depende de |
|---|---|---|
| **0159** (esta) | `Heading`, `Text`, `Card`, `PageHeader`, `Form`/`FormSection`/`FormActions`; borrar `BrandTheme`; harness + oraculos del kit | — |
| 0160 | `Dialog`/`ConfirmDialog`, `Combobox` + migrar `places-search.tsx`, `Tabs`, `SegmentedControl`, `Switch`, `ProgressBar`, `Link` | harness de la 0159 |
| 0161 | campos `file`, `color`, `time`/`datetime-local`, `range` (`Slider`), `search` | harness de la 0159 |

Cada una suma sus piezas al mismo harness y a los mismos dos specs de e2e. GPT puede empezar la Fase 1 con lo que
cada rebanada deja en `origin/main`. Las specs 0160/0161 se escriben al empezar cada una (no antes: se escriben sobre
el kit que dejo la anterior).

## Problema

Medido sobre `ui-sistema` `78d1829` (= `origin/main` `b1ab123` + un commit de docs), 2026-10-05:

- **Tipografia sin pieza del kit.** `ui/index.ts` no exporta `Heading` ni `Text`. Hay 66 `<h1|h2|h3>` en
  `apps/merchant/src/app`; 39 sin `className` (toman `h1 { font-size: 30px }`, `h2 { margin: 0 0 8px }` y
  `p { color: #5e6c63; line-height: 1.45 }` de `globals.css:241-252`, hoy en `@layer legacy`) y el resto con
  utilidades sueltas que no coinciden entre si: el titulo de pagina es `text-2xl` (`account-step.tsx:42`),
  `text-2xl sm:text-3xl leading-tight` (`wizard-shared.tsx:46-50`), `clamp(29px, 8vw, 42px)`
  (`globals.css` `.dashboard-header h1`) o `30px` (`.owner-header h1`). En `.tsx` hay 7 tamaños distintos
  (`text-xs`…`text-3xl`); en `globals.css`, 15 valores de `font-size` en px.
- **Formularios sin pieza del kit.** 7 `<form>`/`<Form>` en `app/`: `account-step.tsx:5`, `program-closing.tsx:2` y
  `program-editor.tsx:3` importan `Form` de `react-aria-components` directo (la 0c lo va a prohibir fuera de
  `ui/`); el wizard arma su grilla a mano (`className="grid gap-5"`, `business-step.tsx:91`,
  `onboarding-wizard.tsx:188`). No hay seccion ni fila de acciones del kit.
- **Superficies sin pieza del kit.** La tarjeta del wizard es `rounded-lg bg-surface p-6 shadow-sm sm:p-8`
  (`account-step.tsx:80`); el backoffice usa `.panel` (`border-radius: 22px; padding: 24px; box-shadow: 0 12px 32px …`,
  `globals.css:235-239`) y cabeceras propias por pantalla (`.dashboard-header`, `.owner-header`,
  `.customers-list-header`, `.locations-section-title`).
- **Andamiaje.** `ui/brand-theme.tsx` (`BrandTheme`) no se usa en ningun `.tsx` fuera de `ui/`
  (`rg -l 'BrandTheme' apps/merchant/src --glob '!ui/*'` → vacio); `resolveBrandTheme` (`brand-contrast.ts:99`)
  solo lo usa `BrandTheme` y su test. El ADR 0123 dice «se usa o se borra».
- **Nada protege el aspecto del kit.** No hay `toHaveScreenshot` en `tests/` (`rg -n toHaveScreenshot tests` →
  vacio); `ui-layers.spec.ts` mide 4 controles.

**Medido para el diseño:**

- La CI corre Playwright en Ubuntu solo con Chromium (`.github/workflows/ci.yml:70`); esta Mac no tiene Docker,
  asi que no puede generar referencias de Linux. **Owner (2026-10-05): «no me interesa linux, me interesa que se vean
  en windows y mac, ningun usuario mio usara linux».** → las capturas son de Mac y la CI las saltea.
- WebKit esta instalado localmente (`~/Library/Caches/ms-playwright/webkit-2359`); la CI no lo instala.
- `pnpm verify` corre e2e cuando el diff toca `tests/e2e/` o pantallas (`tools/verify.ts:62-70`): las capturas
  quedan como gate local del pre-push.
- La fuente del sistema es `Arial, Helvetica, sans-serif` (`tokens.css:64`): Arial existe en Windows y en Mac.

## Alcance

**Entra:**

1. `ui/heading.tsx`, `ui/text.tsx`, `ui/card.tsx`, `ui/page-header.tsx`, `ui/form.tsx` (abajo), exportados desde
   `ui/index.ts`.
2. Borrar `ui/brand-theme.tsx`, su export, `resolveBrandTheme` y los tipos que solo el usa (`BrandPalette`,
   `BrandThemeProperties` si quedan sin uso) en `brand-contrast.ts`, el `describe("resolveBrandTheme")` de
   `brand-contrast.test.ts` (prueba codigo borrado; `relativeLuminance`/`contrastRatio` y sus tests quedan) y las
   secciones `### Marca en runtime` y `### BrandTheme` de `docs/design-system.md`.
3. Harness del kit y sus dos specs de e2e (abajo).
4. `docs/design-system.md`: una seccion por pieza nueva (API + ejemplo), con el mismo formato que `TextField`.
5. ADR 0123: enmienda con la particion y la decision de capturas del owner.

**No entra:** migrar pantallas (Fase 1, GPT: incluido el wizard, que sigue con sus utilidades sueltas); refactorizar
los componentes existentes del kit para que usen `Text` adentro; las piezas de 0160/0161; `eyebrow` (el del wizard
usa `#a55a43`, que no es token: se decide en la Fase 1 del onboarding); tokens de tipografia propios (Tailwind
alcanza, ADR 0123 capa 2 «si hace falta»); guardias (0c); capturas en Windows (no hay maquina: abajo).

## Diseño

Regla comun: cada pieza fija **todas** las propiedades que `@layer legacy` toca en ese elemento (`margin`, `color`,
`font-size`, `line-height`, `font-weight`), para no heredar nada de `globals.css`. Ninguna pieza acepta props de
color ni de tipografia; `className` se acepta para LAYOUT (margenes, grid, ancho) y se concatena al final con `cx`.

### `Heading`

```tsx
<Heading level={1 | 2 | 3} id? tabIndex? className?>{children}</Heading>
```

Renderiza `h1`/`h2`/`h3`. Clases base: `m-0 font-bold text-content`. Por nivel (la medida del wizard):

| level | clases | 390 px | 1280 px |
|---|---|---|---|
| 1 | `text-2xl leading-tight sm:text-3xl` | 24 / 30 | 30 / 37.5 |
| 2 | `text-xl leading-7` | 20 / 28 | 20 / 28 |
| 3 | `text-lg leading-7` | 18 / 28 | 18 / 28 |

(`font-size` / `line-height` en px; `font-weight` 700 en los tres). `tabIndex` existe para el foco del wizard
(`wizard-shared.tsx:47`); con `tabIndex` se agrega `outline-none`.

### `Text`

```tsx
<Text variant?="body" | "muted" | "small" | "label" as?="p" | "span" id? className?>{children}</Text>
```

Default `variant="body"`, `as="p"`. Clases: base `m-0`, mas

| variant | clases | medida |
|---|---|---|
| body | `text-base leading-6 text-content` | 16 / 24, `#10251d` |
| muted | `text-base leading-6 text-content-muted` | 16 / 24, `#52645b` (descripcion del wizard) |
| small | `text-sm leading-5 text-content-muted` | 14 / 20, `#52645b` (descripcion de campo del kit) |
| label | `text-base font-bold leading-5 text-content` | 16 / 20, 700 (label de campo del kit) |

### `Card`

```tsx
<Card as?="section" | "div" | "article" aria-labelledby? className?>{children}</Card>
```

Default `as="section"`. Clases: `rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8` (tarjeta del
wizard + borde `--ui-border`, porque sobre `bg-canvas` del backoffice la sombra sola no separa). Medida: radio 20 px,
padding 24 (390) / 32 (1280), borde 1 px `#cbd8d1`, fondo `#ffffff`.

### `PageHeader`

```tsx
<PageHeader title="…" description?="…" actions?={<Button …/>} headingId? />
```

`<header className="grid gap-4 sm:flex sm:items-start sm:justify-between">`; adentro un `<div className="grid gap-2">`
con `<Heading level={1} id={headingId}>` y, si hay, `<Text variant="muted">`; `actions` en
`<div className="flex flex-wrap gap-3">`. En 390 las acciones van debajo del titulo; en 1280, a la derecha.

### `Form`, `FormSection`, `FormActions` (`ui/form.tsx`)

```tsx
<Form onSubmit validationErrors? className?>…</Form>
<FormSection title="…" description?="…">…campos…</FormSection>
<FormActions>…Buttons…</FormActions>
```

- `Form`: envuelve `Form` de `react-aria-components` (re-exporta sus props salvo `children`/`className` de render),
  con `validationBehavior="aria"` por defecto (el mismo default que los campos del kit) y `className="grid gap-5"`.
  `validationErrors` (errores del servidor por `name`) pasa tal cual: es la via para los errores de API por campo.
- `FormSection`: `<fieldset className="m-0 grid min-w-0 gap-5 border-0 p-0">` con
  `<legend className="mb-4 p-0">` que contiene `<Heading level={2}>` y, si hay, `<Text variant="small">`. El `fieldset`
  da el nombre accesible del grupo (`getByRole("group", { name })`).
- `FormActions`: `<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">`: en 390 la accion
  principal (ultima en el JSX) queda arriba y los botones a todo el ancho (`flex-direction: column-reverse`); en 1280,
  en fila a la derecha.

### Harness: `tests/e2e/support/ui-kit-entry.tsx`

Una pagina con TODAS las piezas del kit (las existentes y las de esta spec), dentro de
`<div className="backoffice-layout"><div className="backoffice-content">` (donde vive `globals.css`), servida con
`startCatalogHarness`. Lee `?theme=light|dark` y pone `document.documentElement.dataset.theme` antes de renderizar.
Contenido fijo (sin fechas ni aleatorios), en este orden:

1. `PageHeader` «Kit de CheckPass» con descripcion y una accion `Button` «Accion».
2. `Heading` 1/2/3 («Titulo 1/2/3»), `Text` en las cuatro variantes («Texto body/muted/small/label»).
3. `Card` (`aria-labelledby` de un `Heading level={2}` «Tarjeta») con un `Form` que tiene un `FormSection`
   «Datos del negocio» (descripcion «Lo que ven tus clientes») con `TextField` «Nombre», `TextField` invalido
   «Email» con error, `SelectField` «Rubro», `NumberField` «Sellos», `TextAreaField` «Notas», `CheckboxField`
   «Acepto», `ChoiceGroup` «Plan» (2 opciones); y `FormActions` con `Button variant="secondary"` «Cancelar» y
   `Button type="submit"` «Guardar».
4. `Alert` de los cuatro tipos, `ProgressIndicator` paso 2 de 4, `Button` en las cuatro variantes + `isLoading` +
   `isDisabled`.

Las 0160/0161 agregan sus piezas al final. `ui-layers-entry.tsx` queda (es el oraculo de capas de la 0158).

### Oraculo 1 — estilos computados: `tests/e2e/ui-kit.spec.ts` (corre en todos lados, CI incluida)

Las aserciones viven en `tests/e2e/support/ui-kit-checks.ts` (las importan los dos specs). Por ancho {390, 1280},
tema claro, con `toHaveCSS`:

- `Heading` 1/2/3: `font-size`, `line-height`, `font-weight` 700, `margin-top`/`margin-bottom` `0px`, `color`
  `rgb(16, 37, 29)` (tabla de arriba; el nivel 1 cambia entre anchos).
- `Text`: las cuatro variantes con `font-size`, `line-height`, `color` (`muted`/`small` = `rgb(82, 100, 91)`; en
  dark, `rgb(182, 200, 190)` = `#b6c8be`) y `margin` `0px`. Un caso en `?theme=dark` para `muted`.
- `Card` («Tarjeta» por `getByRole("region")`): `border-top-left-radius` 20px, `padding-top` 24px/32px,
  `border-top-color` `rgb(203, 216, 209)`, `background-color` `rgb(255, 255, 255)`.
- `PageHeader`: en 390, la caja de «Accion» queda debajo del `h1` (`boundingBox().y` mayor que el `y + height` del
  titulo); en 1280, a la derecha (misma banda vertical, `x` mayor).
- `FormSection`: `getByRole("group", { name: /Datos del negocio/ })` existe; su `legend` → `margin-bottom` 16px.
- `FormActions`: `flex-direction` `column-reverse` (390) / `row` (1280); «Guardar» por encima de «Cancelar» en 390
  y ancho de «Guardar» = ancho del contenedor de acciones (± 1 px).
- `Form`: enviar sin «Nombre» (`isRequired`) no navega y el campo queda `aria-invalid="true"` (prueba que el default
  `validationBehavior="aria"` llega; con `native` el navegador muestra su globo y no pinta el estado del kit).

### Oraculo 2 — capturas (Mac; `pnpm verify` las corre, la CI no)

- `ui-kit.spec.ts` (Chromium) y `ui-kit.webkit.spec.ts` (`test.use({ browserName: "webkit" })` en el nivel
  superior del archivo: Playwright no permite cambiar de navegador dentro de un `describe`).
- Cada uno: `test.skip(Boolean(process.env.CI), "capturas de Mac: la CI corre en Linux (owner, 2026-10-05)")` en los
  tests de captura. El de WebKit entero se saltea en CI (la CI no instala WebKit).
- Por {claro, oscuro} × {390, 1280}: `await expect(page).toHaveScreenshot("kit-<tema>-<ancho>.png",
  { fullPage: true, animations: "disabled" })`, con `reducedMotion: "reduce"` y `colorScheme` acorde. Tolerancia: la
  de Playwright por defecto (sin `maxDiffPixels`): son capturas de la misma maquina.
- Las referencias (`*-darwin.png`, 8 por navegador) se commitean en `tests/e2e/ui-kit.spec.ts-snapshots/` y
  `tests/e2e/ui-kit.webkit.spec.ts-snapshots/`. Se generan con `--update-snapshots` UNA vez, **mirandolas** (se
  publican en un Artifact privado para el owner, como en la 0158) antes de commitear.
- Al cambiar una pieza del kit a proposito, la spec que lo cambia regenera las referencias y lo dice en su DoD.

**Windows:** el oraculo 1 corre en Chromium, el motor de Chrome y Edge en Windows, con Arial en los dos sistemas: los
tamaños, paddings, radios y colores medidos son los que ve un usuario de Windows. El suavizado de fuente de Windows no
se puede capturar desde esta Mac: queda declarado afuera y va al QA del owner.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/ui/heading.tsx`, `text.tsx`, `card.tsx`, `page-header.tsx`, `form.tsx` | crear |
| `apps/merchant/src/ui/index.ts` | editar (exports; sin `brand-theme`) |
| `apps/merchant/src/ui/brand-theme.tsx` | borrar |
| `apps/merchant/src/ui/brand-contrast.ts`, `brand-contrast.test.ts` | editar (sin `resolveBrandTheme`) |
| `tests/e2e/support/ui-kit-entry.tsx`, `tests/e2e/support/ui-kit-checks.ts` | crear |
| `tests/e2e/ui-kit.spec.ts`, `tests/e2e/ui-kit.webkit.spec.ts` + sus `-snapshots/` | crear |
| `docs/design-system.md` | editar |
| `docs/adr/0123-un-solo-sistema-de-ui-en-el-merchant.md` | editar (enmienda) |

**Disjunta?** Si: solo archivos nuevos o de `ui/` (zona Claude) y e2e nuevos. Ninguna pantalla cambia.

## Definition of Done

Barridos corridos contra el arbol al cerrar la spec (2026-10-05): `rg -l 'BrandTheme' apps/merchant/src --glob '!ui/*'`
→ vacio; `rg -n toHaveScreenshot tests` → vacio; `ls apps/merchant/src/ui/{heading,text,card,page-header,form}.tsx` →
no existen.

- [x] Rojo antes: con `ui-kit-entry.tsx` y `ui-kit.spec.ts` escritos y las piezas SIN crear, el spec no compila el
      harness (import inexistente); se transcribe el error. (No hay valor viejo que medir: las piezas son nuevas.)
      → `✘ [ERROR] No matching export in "apps/merchant/src/ui/index.ts" for import "Card"` (idem `Form`,
      `FormActions`, `FormSection`, `Heading`, `PageHeader`, `Text`).
- [x] `pnpm exec playwright test tests/e2e/ui-kit.spec.ts tests/e2e/ui-kit.webkit.spec.ts` verde (Node 24) → `16 passed`.
- [ ] `CI=1 pnpm exec playwright test tests/e2e/ui-kit.spec.ts tests/e2e/ui-kit.webkit.spec.ts` → el oraculo 1 corre
      y pasa; las capturas y el archivo de WebKit salen `skipped` (se transcribe el conteo). → `4 passed`, `12 skipped`
      (4 capturas de Chromium + los 8 tests de WebKit).
- [x] `ls tests/e2e/ui-kit.spec.ts-snapshots/ tests/e2e/ui-kit.webkit.spec.ts-snapshots/` → ~~8 + 8~~ **4 + 4**
      `*-darwin.png` (error de cuenta de la spec: {claro, oscuro} × {390, 1280} = 4 por navegador).
- [x] Artifact privado con las ~~16~~ 8 capturas: https://claude.ai/artifact/L9rd4vPQoGuNNMTkkYSeZ3
- [x] `rg -n 'BrandTheme|resolveBrandTheme' apps docs/design-system.md` → vacio (exit 1).
- [x] `rg -n 'react-aria-components' apps/merchant/src/ui/{heading,text,card,page-header}.tsx` → vacio (no lo
      necesitan); `form.tsx` si lo importa (1).
- [x] `pnpm verify` con Node 24, una sola vez al final (ADR 0113). Tabla:

      ```
      typecheck             | corrio                      | ROJO    | 10.9
      lint                  | corrio                      | ok      | 6.2
      format:check          | corrio                      | ok      | 6.6
      test                  | corrio                      | ok      | 43.7
      build                 | corrio                      | ok      | 21.3
      test:e2e              | corrio                      | ok      | 50.1   (135 passed)
      neon related merchant | corrio                      | ok      | 33.3
      neon related consumer | salteado (nada de consumer) | -       | -
      ```

      El ROJO de `typecheck` es cache: `apps/merchant/.next/types/validator.ts` de un build anterior nombraba
      `api/merchant/auth/start/route` y `api/onboarding/business/route`, borradas en `07e345e` (0155). El `build` del
      mismo `verify` regenero el archivo (ya no las nombra: `grep -c` → 0) y `pnpm typecheck` despues → `6 successful,
      6 total`. No se repitio el `verify` entero.
- [x] `rg -n MUTATION apps tools tests` → solo `tests/e2e/loyalty-real.spec.ts:6` (`E2E_LOYALTY_MUTATION_TEST`,
      preexistente, no es una etiqueta): ninguna etiqueta de esta spec quedo.

## Implementacion (2026-10-05)

**Desvios medidos (el diseño de arriba queda como se cerro; esto manda):**

1. **Oraculo de `Form`.** El escrito («enviar sin Nombre requerido lo deja `aria-invalid`») es imposible: con
   `validationBehavior="aria"` React Aria no frena el envio ni marca un `isRequired` vacio (eso lo hace `native`).
   Medido: `Expected "true"`, sin `aria-invalid`. Ademas `TextField` fija su propio `"aria"`, asi que el default del
   `Form` solo llega a los campos que lo heredan. Oraculo nuevo: «Acepto» (`CheckboxField isRequired`) sin marcar y
   «Guardar» → el envio llega a `onSubmit` (`data-submitted` en el `form`). Muerde: con default `native` →
   `Expected "true" / Received ""` (sonda M5, fuera del presupuesto, revertida con shasum identico).
2. **Hallazgo #76 (PARQUEADO):** `validationErrors` del `Form` no llega a `TextField` (sonda: sin `aria-invalid` ni
   texto) ni, por el mismo patron, a `SelectField`/`NumberField`/`TextAreaField`/`ChoiceGroup`. Arreglarlo cambia
   campos en uso: fuera del alcance; `design-system.md` lo declara.
3. **Capturas con `threshold: 0`** (no la tolerancia por defecto): con el 0.2 de Playwright **M4 sobrevivio** (8/8
   verdes con `shadow-md`). Con 0: sin mutar, 2 corridas seguidas 8/8 verdes; con M4, 8/8 rojas.
4. **Layout del harness con estilos inline:** Tailwind solo genera clases que aparecen en `apps/merchant`; `gap-8`
   del harness no existia (medido: `row-gap: normal`). Se agrega `<aside className="backoffice-sidebar">` vacio: en
   escritorio `.backoffice-layout` es una grilla de `264px 1fr` y sin barra el contenido caia en la columna de 264 px.
5. **`brand-contrast.test.ts` borrado entero:** su unico `describe` era `resolveBrandTheme`; los tests de
   `contrastRatio` viven en `tokens.test.ts`. `brand-contrast.ts` queda con `relativeLuminance` y `contrastRatio`.
6. `Text` agrega `font-normal` en `body`/`muted`/`small` (fija el peso; dentro de un `legend` o `label` heredaria).
7. **Hallazgo #77 (PARQUEADO):** en WebKit a 390 px el `ChoiceGroup` recorta «Gratis»/«Pro» (pieza preexistente).

**Bitacora de mutaciones** (de a una, `shasum` antes y despues identico, revertidas copiando el original + `diff`):

| # | shasum | Oraculo | Resultado |
|---|---|---|---|
| M1 | `1f08b568a45d` | estilos 1280 | ROJO: `font-size` `Expected "30px" / Received "24px"` |
| M2 | `1f08b568a45d` | estilos 390 | ROJO: `margin-bottom` `Expected "0px" / Received "8px"` |
| M3 | `13ba592ac5b1` | estilos 390 | ROJO: `Expected "column-reverse" / Received "column"` |
| M4 | `1dae40d06fd5` | capturas | con tolerancia por defecto: VERDE (sobrevivio) → `threshold: 0` → ROJO 8/8 (9137–16818 px distintos) |

Las corridas de las mutaciones usaron una config de Playwright sin `webServer` (el puerto 3001 lo ocupaba otro
proyecto); los specs del kit no usan los servidores.

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `heading.tsx`: nivel 1 sin `sm:text-3xl` | oraculo 1, `Heading` 1 en 1280 (`font-size` 24px ≠ 30px) |
| M2 | `heading.tsx`: sacar `m-0` | oraculo 1, `margin-bottom` del nivel 2 = 8px (`globals.css` `h2`): prueba que `legacy` sigue debajo y que el kit lo pisa |
| M3 | `form.tsx`: `FormActions` con `flex-col` en vez de `flex-col-reverse` | oraculo 1, `flex-direction` y orden «Guardar»/«Cancelar» en 390 |
| M4 | `card.tsx`: `shadow-sm` → `shadow-md` | oraculo 2 (captura) en Chromium y WebKit. El oraculo 1 NO mide sombras, a proposito: esta mutacion prueba que la captura muerde donde el oraculo 1 no mira |

**Protocolo:** skill `protocolo-de-verificacion` (shasum limpio → fila de bitacora → etiqueta `MUTATION` en un
comentario → medir y transcribir la asercion roja → revertir con `diff`). De a una.

**Condicion de corte:** dos vueltas seguidas de «el fix abrio la siguiente» → al owner. Lo que queda afuera se declara.

## Declarado AFUERA (sin oraculo, a proposito)

- **Windows pixel a pixel** (suavizado de fuente, ClearType): sin maquina Windows. Lo cubren el oraculo 1 (mismo
  motor, misma fuente) y el QA del owner.
- **Linux**: decision del owner. La CI solo corre el oraculo 1.
- **Firefox**: no lo pidio el owner y no esta instalado.
- **El aspecto de las pantallas**: no cambia ninguna (no se migra nada). Cuando la Fase 1 adopte `Heading`, los
  titulos de pagina del backoffice pasan de 30 px (`globals.css` `h1`) a 24/30 px: es la decision 5 (medida del kit),
  y lo muestran las capturas de esa spec.
- **Referencias de captura desactualizadas por cambio de version de Chromium/WebKit**: al subir Playwright se
  regeneran mirandolas; no hay oraculo que lo distinga de una regresion.

## Handoff

N1: sin subagentes. Implementa la sesion principal en `motor`; `pnpm verify` una vez al final; commit (codigo) y
commit de docs con el sha. Push a pedido del owner (memoria: no pushear por commit). Despues: GPT recibe el sha para
usar estas piezas en la Fase 1; sigue la 0160.

## Abierto

Nada que bloquee.
