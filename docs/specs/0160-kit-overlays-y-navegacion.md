---
spec: 0160
fecha: 2026-10-05
estado: implementada
resumen: Fase 0b del ADR 0123, rebanada 2 de 3. El kit suma `Dialog`/`ConfirmDialog`, `Combobox`, `Tabs`, `SegmentedControl`, `Switch`, `ProgressBar` y `Link`; `places-search.tsx` pasa a usar `Combobox` (y se borra su CSS de `globals.css`); el harness del kit suma las piezas al final y un caso `?case=dialog`, con oraculo de estilos y comportamiento en Chromium/WebKit y capturas de Mac regeneradas.
disjunta: no (toca `places-search.tsx`, `globals.css` y dos e2e de Places)
archivos: apps/merchant/src/ui/dialog.tsx, apps/merchant/src/ui/combobox.tsx, apps/merchant/src/ui/tabs.tsx, apps/merchant/src/ui/segmented-control.tsx, apps/merchant/src/ui/switch.tsx, apps/merchant/src/ui/progress-bar.tsx, apps/merchant/src/ui/link.tsx, apps/merchant/src/ui/index.ts, apps/merchant/src/app/components/places-search.tsx, apps/merchant/src/app/globals.css, docs/PARQUEADO.md, tests/e2e/support/ui-kit-entry.tsx, tests/e2e/support/ui-kit-checks.ts, tests/e2e/onboarding-google-places.spec.ts, tests/e2e/support/onboarding-places-fixture.ts, tests/e2e/ui-kit.spec.ts-snapshots/, tests/e2e/ui-kit.webkit.spec.ts-snapshots/, docs/design-system.md
---

# 0160 — Kit: overlays y navegacion (Fase 0b, rebanada 2)

> N1 (componentes de UI + e2e, sin datos ni auth). Zona Claude (`ui/**`, ADR 0123 decision 3; la migracion de
> `places-search.tsx` la asigna el ADR 0123 a la Fase 0b). Medida: la del kit (decision 5 del owner).

## Problema

Medido sobre `motor` `e9e41b0` (= `origin/main` `3177450` + un commit de docs), 2026-10-05:

- **Modales sin pieza del kit, tres implementaciones.** `app/components/confirm-dialog.tsx` arma su trampa de foco
  a mano (`role="alertdialog"`, `onKeyDown` propio) y la usan 6 pantallas (locales, staff, catalogo, suscripcion,
  loyalty); `loyalty-confirm-dialog.tsx` y `marketing-ui.tsx` (`MarketingConfirm`) importan
  `ModalOverlay`/`Modal`/`Dialog` de `react-aria-components` directo, con clases parecidas pero no iguales
  (`p-6` vs `p-5 sm:p-6`, acciones `loyalty-actions` vs `flex-col-reverse`). `staff-form-modal.tsx` arma un
  `role="dialog"` propio. La 0c va a prohibir `react-aria-components` fuera de `ui/`.
- **Combobox: no existe.** `app/components/places-search.tsx` (lo usan `business-step.tsx` del alta y
  `location-form.tsx` de locales) es un `<input type="search">` + `<ul>` de `<button>` con `aria-expanded` a mano y
  sin navegacion por flechas; su aspecto vive en 11 reglas `.places-search*` de `globals.css:312-372`. Es la
  regresion que el ADR 0123 cita en vivo.
- **Tabs a mano:** `catalog-page.tsx:173-190` y `counter/stages.tsx:140-146` (`role="tablist"`/`"tab"` y
  `aria-selected` sin flechas).
- **Control segmentado a mano:** `aria-pressed` en `customers-page.tsx:164-171` (nombre/telefono) y
  `upgrade-card.tsx:60-68` (mes/año).
- **Switch:** `template-row.tsx` usa `Switch` de RAC directo con el dibujo inline; `permission-picker.tsx:40` arma
  un `role="switch"` propio.
- **Barra de progreso:** `onboarding-checklist.tsx:153-156` (`role="progressbar"` + `style={{ width }}` a mano). El
  ADR 0123 §2 solo permite `style` dinamico via una pieza del kit (`ProgressBar`).
- **Links:** 13 archivos importan `next/link`; el aspecto sale de `.marketing-link`, `underline underline-offset-2`
  o clases propias por pantalla. No hay link con aspecto de boton («Ir a mi panel», «Ver campaña»).

**Medido para el diseño:**

- `react-aria-components` 1.21.1: `ToggleButtonGroup` con `selectionMode="single"` expone `role="radiogroup"` y cada
  boton `role="radio"` + `aria-checked` (`react-aria/dist/private/button/useToggleButtonGroup.mjs:22`).
- Los dos e2e de Places ubican el campo con `getByRole("searchbox", …)` y la sugerencia con
  `getByRole("button", { name: /…/ })` (`onboarding-google-places.spec.ts:72,74,156,158`,
  `support/onboarding-places-fixture.ts:52,54`); con `Combobox` pasan a `combobox` y `option`. El oraculo de la
  sesion de Places (`tokens` toHaveLength(2) e iguales, cuerpos de `signup`) no cambia.
- Tour de locales, paso `address` (`[data-tour="location-address"]`): hoy la lista queda dentro del elemento
  activo (`.driver-active-element .places-search-results { position: static }`). Con `Combobox` la lista va en un
  `Popover` (portal a `body`), fuera del elemento activo: queda debajo del overlay de driver.js salvo una excepcion
  como la del catalogo (`globals.css:6848-6858`). No hay e2e del tour de locales.

## Alcance

**Entra:**

1. Piezas nuevas en `ui/`, exportadas desde `ui/index.ts` (diseño abajo): `Dialog`, `ConfirmDialog`, `Combobox`,
   `Tabs`/`TabList`/`Tab`/`TabPanel`, `SegmentedControl`, `Switch`, `ProgressBar`, `Link`.
2. `places-search.tsx` sobre `Combobox` (misma API publica: `label`, `onSelect`); borrar `.places-search*` de
   `globals.css` (queda `.places-selected`); excepcion de pointer-events para el listbox durante el tour de locales.
3. Migrar los localizadores de los dos e2e de Places (`searchbox`→`combobox`, `button`→`option`) en el mismo
   commit: es el cambio de rol que pide la pieza, no un test editado para pasar; las aserciones no cambian.
4. Harness: piezas al final de la pagina por defecto + caso `?case=dialog`; oraculos en `ui-kit-checks.ts`;
   capturas regeneradas mirandolas (Artifact privado).
5. `docs/design-system.md`: una seccion por pieza.

**No entra:** migrar las pantallas que hoy usan modales, tabs, switches, segmentados, progreso o links (Fase 1,
GPT); borrar `app/components/confirm-dialog.tsx` (lo borra la ultima pantalla que lo deje); campos de la 0161;
`Popover`/`Menu`/`Toast`/`Table` sueltos (no estan en la particion de la 0b; se piden por spec cuando una pantalla
los necesite).

## Diseño

Regla comun (la de la 0159): sin props de color ni de tipografia; `className` solo para LAYOUT, al final con `cx`;
toda pieza que un tour puede señalar acepta `tourAnchor` y lo pone como `data-tour` en el elemento visible.

### `Dialog` y `ConfirmDialog` (`ui/dialog.tsx`)

```tsx
<Dialog isOpen onOpenChange title description? role?="dialog" | "alertdialog" isDismissable?=true tourAnchor? >
  {children}
</Dialog>
<ConfirmDialog isOpen title description confirmLabel cancelLabel?="Cancelar" intent?="primary" | "danger"
  isBusy? confirmDisabled? tourAnchor? confirmTourAnchor? onCancel onConfirm />
```

- `Dialog`: `ModalOverlay` (`fixed inset-0 z-50 grid place-items-center bg-overlay p-4`) → `Modal`
  (`w-full max-w-lg rounded-lg border border-border bg-surface-raised p-6 text-content shadow-lg`) → `Dialog` de RAC
  (`outline-none`, `data-tour`). Titulo: `Heading` de RAC con `slot="title"` y las clases del `Heading` nivel 2 del
  kit (`m-0 text-xl font-bold leading-7 text-content`); descripcion: `Text` de RAC `slot="description"` con las de
  `Text muted` (`m-0 mt-2 text-base font-normal leading-6 text-content-muted whitespace-pre-line`), enlazada por
  `aria-describedby`. `description` acepta `ReactNode` (la baja de suscripcion lleva un link). Hijos debajo, con
  `mt-5`. Escape y clic afuera cierran si `isDismissable`.
- `ConfirmDialog`: `Dialog role="alertdialog"` con `FormActions` (`flex-col-reverse … sm:flex-row sm:justify-end`):
  `Button secondary` «Cancelar» con `autoFocus` y `Button` `primary`/`danger` de confirmar (`isLoading={isBusy}`,
  `isDisabled={confirmDisabled}`, `data-tour={confirmTourAnchor}`). Con `isBusy`, ni Escape ni clic afuera cierran
  y «Cancelar» queda deshabilitado. Cubre los tres usos medidos (`ConfirmDialog` de `app/components`,
  `LoyaltyConfirmDialog`, `MarketingConfirm`).

### `Combobox` (`ui/combobox.tsx`)

```tsx
<Combobox label items={[{ id, label, description? }]} inputValue onInputChange onSelectionChange
  placeholder? description? status? errorMessage? isDisabled? type?="search" name? tourAnchor? />
```

- `ComboBox` de RAC, `menuTrigger="input"`, sin filtro propio (`items` controlados: el filtrado o la busqueda los
  hace quien lo usa). Label, input, descripcion y error con **las mismas clases que `TextField`** (input
  `min-h-12 … rounded-md border border-border-strong px-3.5 py-2.5`, invalido `border-danger`).
- Lista: `Popover` `w-[var(--trigger-width)]` + `ListBox`/`ListBoxItem` con las clases del `SelectField`
  (`min-h-11`, enfocada `bg-primary-soft`, `label` en negrita y `description` en `text-sm text-content-muted`).
- `status` (texto como «Buscando…» o «No encontramos resultados…») va en un `<p role="status">` siempre montado
  (`text-sm leading-5 text-content-muted`): se anuncia al cambiar. `errorMessage` marca el campo invalido y se
  muestra dentro de un `<div role="alert">` siempre montado (los errores de un combobox asincrono vienen de la red,
  no de una validacion: se anuncian, como hoy en `places-search.tsx`).

### `places-search.tsx` sobre `Combobox`

Misma API y misma logica de sesion (token por busqueda, debounce 300 ms, version de pedido). Cambia solo el render:
`Combobox` con `items` = sugerencias (`label` = `mainText`, `description` = `secondaryText`), `status` =
«Buscando…» / «No encontramos resultados. Prueba otra búsqueda.», `errorMessage` = el error, placeholder igual.
`onSelectionChange(id)` → busca la sugerencia y llama a `choose`. **Riesgo medido al implementar:** al elegir, RAC
escribe el texto de la opcion en el input (`onInputChange`); si eso dispara otra busqueda, se manda un
`autocomplete` extra y se rompe la sesion de Places. El oraculo es el de hoy: `tokens` (los del `autocomplete` y el
`details`) `toHaveLength(2)` e iguales en `onboarding-google-places.spec.ts`. Si hace falta un guardia, lleva su
mutacion (M3).

**Tour de locales:** se agrega en `globals.css` (capa `legacy`, junto al bloque del catalogo) la excepcion
`.driver-active [data-rac][data-placement]:has([role="listbox"])` (y `*`) con `pointer-events: auto` y el `z-index`
del catalogo, acotada al paso de la direccion por `:has([data-tour="location-address"].driver-active-element)`. Sin
oraculo automatico (no hay e2e del tour de locales): **va al QA del owner** y se declara abajo.

### `Tabs`, `TabList`, `Tab`, `TabPanel` (`ui/tabs.tsx`)

Envoltorios de RAC con clases fijas. `TabList`: `flex gap-1 border-b border-border` (`aria-label` obligatorio).
`Tab`: `min-h-11 px-4 py-2.5 text-base font-bold text-content-muted border-b-2 border-transparent -mb-px`;
seleccionado `text-content border-primary`; foco visible `outline-2 outline-focus`. `TabPanel`: `pt-5 outline-none`.
Flechas izquierda/derecha cambian de pestaña (RAC).

### `SegmentedControl` (`ui/segmented-control.tsx`)

```tsx
<SegmentedControl aria-label options={[{ id, label }]} selectedKey onSelectionChange isDisabled? />
```

`ToggleButtonGroup selectionMode="single" disallowEmptySelection` (`inline-flex rounded-md border
border-border-strong bg-surface p-1 gap-1`); cada `ToggleButton`: `min-h-10 rounded-sm px-4 text-base font-bold
text-content`; seleccionado `bg-primary text-on-primary`. Roles: `radiogroup`/`radio` + `aria-checked`.

### `Switch` (`ui/switch.tsx`)

```tsx
<Switch isSelected onChange isDisabled? aria-label? tourAnchor?>{label?}</Switch>
```

El dibujo de `template-row.tsx` pasado al kit: pista `h-7 w-12 rounded-full border border-border-strong p-0.5`,
`bg-primary` encendido / `bg-disabled` apagado; perilla `size-5 rounded-full bg-surface shadow-sm`, `translate-x-5`
encendido. Contenedor `inline-flex min-h-11 items-center gap-3`; `children` es el texto visible (`text-base
text-content`); sin `children`, `aria-label` es obligatorio (tipo). `aria-busy` pasa tal cual.

### `ProgressBar` (`ui/progress-bar.tsx`)

```tsx
<ProgressBar label value maxValue?=100 valueLabel? />
```

`ProgressBar` de RAC: label (`text-sm font-bold leading-5 text-content`) y `valueText` a la derecha
(`text-sm text-content-muted`); pista `h-2 rounded-full bg-disabled`; relleno `h-full rounded-full bg-primary` con
`style={{ width: \`${percentage}%\` }}` (la excepcion de `style` del ADR 0123 §2).

### `Link` (`ui/link.tsx`)

```tsx
<Link href variant?="inline" | "primary" | "secondary" prefetch? tourAnchor? className?>{children}</Link>
```

Envuelve `next/link` (navegacion del cliente y prefetch se mantienen). `inline`: `font-bold text-primary underline
underline-offset-2 hover:text-primary-hover`; `primary`/`secondary`: las clases base y de variante del `Button`
(`min-h-11 rounded-md px-4 py-2.5 font-bold`…), con `hover:`/`active:` en vez de los `data-*` de RAC (un `<a>` de Next
no los tiene). Foco visible igual que `Button`. **A medir al implementar:** que `next/link` renderice fuera del App
Router (el harness es esbuild sin Next); si no, el harness lo resuelve con un alias de esbuild a un `<a>`, y se
declara.

### Harness (`tests/e2e/support/ui-kit-entry.tsx`)

Al final de la pagina por defecto, en este orden y con contenido fijo:

1. `Tabs` «Secciones» con «Productos» (panel «Panel productos») y «Categorias» (panel «Panel categorias»).
2. `SegmentedControl` «Buscar por» con «Nombre» (seleccionado) y «Telefono».
3. `Switch` «Notificaciones» encendido y `Switch` «Modo prueba» apagado.
4. `ProgressBar` «Configuracion» `value={40}` (`valueLabel` «2 de 5»).
5. `Link` inline «Ver ayuda» y `Link secondary` «Ir al panel» (`href="#panel"`).
6. `Combobox` «Ciudad» con 4 ciudades fijas (Quito, Cuenca, Guayaquil, Loja), filtradas en el harness por el texto;
   muestra «Elegida: <ciudad>» al elegir.
7. Botones «Abrir dialogo» y «Abrir confirmacion» que abren un `Dialog` «Editar nombre» (con un `TextField`) y un
   `ConfirmDialog` «¿Archivar el local?» `intent="danger"` `tourAnchor="kit-confirm"`.

`?case=dialog` renderiza el `ConfirmDialog` ya abierto (solo para las capturas).

### Oraculo 1 — estilos y comportamiento (`ui-kit-checks.ts`, corre en todos lados)

- **Dialog/ConfirmDialog:** «Abrir confirmacion» → `getByRole("alertdialog", { name: "¿Archivar el local?" })`
  visible, con `data-tour="kit-confirm"`; el foco esta en «Cancelar»; titulo `font-size` 20px / `font-weight` 700;
  caja `border-top-left-radius` 20px; «Archivar» con `background-color` = el de `Button danger`; Escape cierra y el
  foco vuelve a «Abrir confirmacion». «Abrir dialogo» → `getByRole("dialog", { name: "Editar nombre" })`.
- **Combobox:** `getByRole("combobox", { name: "Ciudad" })` mide como el input de `TextField` (padding, radio,
  borde); escribir «cu» → una sola `option` «Cuenca»; ancho de la `listbox` = ancho del input (± 1 px); flecha
  abajo + Enter → «Elegida: Cuenca».
- **Tabs:** foco en «Productos» + flecha derecha → «Categorias» `aria-selected="true"` y se ve «Panel categorias»;
  la pestaña seleccionada con `border-bottom-color` = primario (`rgb(23, 101, 72)`).
- **SegmentedControl:** `getByRole("radiogroup", { name: "Buscar por" })`; clic en «Telefono» →
  `aria-checked="true"` y `background-color` primario; «Nombre» → `aria-checked="false"`.
- **Switch:** `getByRole("switch", { name: "Modo prueba" })` no marcado; clic → marcado.
- **ProgressBar:** `getByRole("progressbar", { name: "Configuracion" })` con `aria-valuenow="40"`; el ancho del
  relleno = 40 % de la pista (± 1 px).
- **Link:** «Ver ayuda» `color` primario y `text-decoration-line` `underline`; «Ir al panel» con `min-height` 44px,
  borde de 1px y `href` `#panel`.

Corren en 390 y 1280 donde la medida cambia (dialog y combobox); el resto en 1280.

### Oraculo 2 — capturas (Mac; `pnpm verify` las corre, la CI no)

Las 4 + 4 capturas de la pagina por defecto **se regeneran** (la pagina crece: es el cambio a proposito que la 0159
preveia) y se suman `kit-dialog-<tema>-<ancho>.png` (4 + 4) del caso `?case=dialog`. Todas con `threshold: 0`,
mirandolas en un Artifact privado antes de commitear.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/ui/{dialog,combobox,tabs,segmented-control,switch,progress-bar,link}.tsx` | crear |
| `apps/merchant/src/ui/index.ts` | editar (exports) |
| `apps/merchant/src/app/components/places-search.tsx` | editar (render sobre `Combobox`) |
| `apps/merchant/src/app/globals.css` | editar (borrar `.places-search*`; excepcion del tour de locales) |
| `tests/e2e/onboarding-google-places.spec.ts`, `tests/e2e/support/onboarding-places-fixture.ts` | editar (roles) |
| `tests/e2e/support/ui-kit-entry.tsx`, `tests/e2e/support/ui-kit-checks.ts` + `-snapshots/` | editar / regenerar |
| `docs/design-system.md` | editar |

**Disjunta?** No: `places-search.tsx` y `globals.css` son de pantallas (asignado por el ADR 0123); avisar a GPT el
sha antes de que toque alta o locales.

## Definition of Done

- [x] Rojo antes: (a) harness con las piezas y sin crearlas → `ERROR: No matching export in
      "apps/merchant/src/ui/index.ts" for import "Combobox"` (idem `ConfirmDialog`, `Dialog`, `Link`, `ProgressBar`,
      `SegmentedControl`, `Switch`, `Tab`, `TabList`, `TabPanel`, `Tabs`); (b) los e2e de Places con los roles nuevos
      contra el `places-search.tsx` viejo → 2 rojos, `waiting for getByRole('combobox', { name: 'Busca tu negocio o
      dirección' })` / `'Busca la dirección'` (`locator.fill: Test timeout of 30000ms exceeded`).
- [x] `pnpm exec playwright test tests/e2e/ui-kit.spec.ts tests/e2e/ui-kit.webkit.spec.ts` (Node 24) → `40 passed`.
- [x] `CI=1 …` mismo comando → `12 passed`, `28 skipped` (capturas de Chromium + todo WebKit).
- [x] `pnpm exec playwright test tests/e2e/onboarding-google-places.spec.ts tests/e2e/ui-layers.spec.ts
      tests/e2e/ui-captures.spec.ts` → `4 passed`, `16 skipped` (`ui-captures` solo corre con `UI_CAPTURES_DIR`);
      con el test nuevo de Places (desvio 3), `onboarding-google-places.spec.ts` → `3 passed`.
- [x] `rg -n 'places-search' apps/merchant/src/app/globals.css` → vacio (exit 1).
- [x] `rg -n 'react-aria-components' apps/merchant/src/app/components/places-search.tsx` → vacio.
- [x] Artifact privado con las 16 capturas: https://claude.ai/artifact/BxFSXFFqCUUd3e8YHxUmy4
- [x] `pnpm verify` con Node 24. Primera corrida ROJA: `format:check` (3 archivos de esta spec sin Prettier) y
      `test:e2e` 1 rojo ajeno (`loyalty-states.spec.ts:228`, «Tearing down "loyaltyHarness" exceeded the test timeout
      of 30000ms»; suelto 15/15; PARQUEADO #78). Con Prettier aplicado, segunda corrida:

      ```
      typecheck             | corrio                      | ok      | 3.1
      lint                  | corrio                      | ok      | 6.1
      format:check          | corrio                      | ok      | 6.7
      test                  | corrio                      | ok      | 42.7
      build                 | corrio                      | ok      | 11.0
      test:e2e              | corrio                      | ok      | 51.1   (160 passed)
      neon related merchant | corrio                      | ok      | 23.4
      neon related consumer | salteado (nada de consumer) | -       | -
      verify: ok
      ```
- [x] `rg -nw MUTATION apps tools tests` (sin `.next`) → solo `E2E_LOYALTY_MUTATION_TEST` preexistente.

## Implementacion (2026-10-05)

**Desvios medidos (el diseño de arriba queda como se cerro; esto manda):**

1. **`Combobox` abre la lista cuando llegan opciones.** React Aria solo abre el menu cuando cambia el texto
   (`useComboBoxState.mjs:185`, `inputValue !== lastValue`); con Places las sugerencias llegan 300 ms despues y la
   lista no se abria (medido: los 3 e2e de Places rojos esperando la `option`). `ComboBox` no acepta `isOpen`
   (`isOpen: undefined` fijo, `:120`). Pieza interna `OpenWhenItemsArrive` (lee `ComboBoxStateContext`): abre con
   `state.open(null, "input")` cuando cambian los ids de las opciones y el campo tiene el foco; con las mismas
   opciones (p. ej. tras Escape) no reabre.
2. **`Combobox` sin prop `type`** (la spec decia `type?="search"`): con `combobox` el rol no depende del `type`; no
   tenia uso.
3. **Guardia en `places-search.tsx` + test nuevo** «elegir una sugerencia no dispara otra busqueda»
   (`details` con 1 s de demora): el oraculo previsto (`tokens` del alta) no lo ve porque `details` responde al
   instante y el componente se desmonta antes del debounce. Medido sin guardia: `+ "Café Plátano"` (un
   `autocomplete` extra con el texto de la opcion). Guardia: `onInputChange` ignora cambios con
   `status === "selecting"`.
4. **El kit usa `onChange` del `ComboBox`** (en RAC 1.21 `onSelectionChange` esta deprecado); la API del kit
   conserva el nombre `onSelectionChange`.
5. **Oraculo del Combobox: scroll antes de escribir.** React Aria cierra la lista ante un scroll y repone el texto;
   el scroll de `fill`/`click` llega despues de la primera tecla (medido: «cu» quedaba «u» en Chromium y WebKit).
   El test hace `scrollIntoViewIfNeeded` + dos `requestAnimationFrame` y despues clic + teclado. El ancho se mide en
   el `Popover` (la `listbox` interna mide 10 px menos por padding y borde).
6. **`ProgressBar`**: el oraculo ubica el relleno por `[style*="width"]` (unico elemento con `style`) en vez de
   atributos de test en el kit.
7. **`next/link` renderiza fuera del App Router** (harness esbuild sin Next): sin alias.
8. **CSS borrado:** 9 reglas `.places-search*` (la spec decia 11: conto selectores).
9. Regiones vivas del `Combobox` con `empty:sr-only`: siempre montadas, sin ocupar lugar vacias.

**Bitacora de mutaciones** (de a una, `shasum` antes y despues identico, revertidas copiando el original + `diff`):

| # | shasum | Oraculo | Resultado |
|---|---|---|---|
| M1 | `eb632752983b` | foco en «Cancelar» (390) | ROJO: `toBeFocused` `Received: inactive` |
| M2 | `70e5222fdd42` | ancho del popover (1280) | ROJO: `Expected <= 1 / Received 876.203125` |
| M3 | `be103dcb94ce` | test nuevo de Places (desvio 3), sin el `return` del guardia | ROJO: `+ "Café Plátano"` |
| M4 | `a771e2a79668` | fondo del segmento elegido | ROJO: `Expected "rgb(23, 101, 72)" / Received "rgb(232, 244, 238)"` |

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `dialog.tsx`: sacar `autoFocus` de «Cancelar» | foco inicial en «Cancelar» |
| M2 | `combobox.tsx`: `Popover` sin `w-[var(--trigger-width)]` | ancho de la listbox = ancho del input |
| M3 | `places-search.tsx`: sacar el guardia contra la busqueda al elegir (si hace falta uno; si no, se muta el `++request.current` de `choose`) | sesion de Places: `tokens` / cuerpos en `onboarding-google-places.spec.ts` (implementado: test nuevo, desvio 3) |
| M4 | `segmented-control.tsx`: seleccionado `bg-primary-soft` en vez de `bg-primary` | `background-color` del segmento elegido |

**Protocolo:** skill `protocolo-de-verificacion` (shasum → bitacora → etiqueta `MUTATION` → medir → revertir con
`diff`). De a una. **Corte:** dos vueltas seguidas de «el fix abrio la siguiente» → al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- **Tour de locales con el listbox en popover:** sin e2e del tour; la excepcion de CSS se prueba en el QA del owner
  (alta de local con `?tour=` del onboarding, escribir y elegir una direccion durante el paso de la direccion).
- **Aspecto nuevo del buscador de lugares** en el alta y en locales: cambia a la medida del kit (decision 5); lo
  muestran `ui-captures.spec.ts` y el QA del owner, no una referencia commiteada.
- Lo mismo que la 0159: Windows pixel a pixel, Linux, Firefox.

## Handoff

N1: sin subagentes. Implementa la sesion principal en `motor`; `pnpm verify` una vez al final; commit del codigo y
commit de docs con el sha. Push a pedido del owner. Despues: la 0161.

## Abierto

Nada que bloquee.
