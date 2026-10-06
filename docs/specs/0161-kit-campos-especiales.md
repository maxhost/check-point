---
spec: 0161
fecha: 2026-10-05
estado: cerrada
resumen: Fase 0b del ADR 0123, rebanada 3 de 3. El kit suma `TimeField`, `DateTimeField` (segmentos de React Aria + calendario), `SearchField` (lupa + borrar), `ColorField` (muestra + hex editable), `Slider` y `FileButton`, con valores de texto iguales a los de los inputs nativos que reemplazan; harness con oraculo de estilos/comportamiento en Chromium/WebKit y capturas de Mac regeneradas. Las pantallas no se migran (Fase 1, GPT).
disjunta: si (solo `ui/`, el harness del kit, `docs/design-system.md` y la dependencia `@internationalized/date`)
archivos: apps/merchant/src/ui/time-field.tsx, apps/merchant/src/ui/date-time-field.tsx, apps/merchant/src/ui/search-field.tsx, apps/merchant/src/ui/color-field.tsx, apps/merchant/src/ui/slider.tsx, apps/merchant/src/ui/file-button.tsx, apps/merchant/src/ui/index.ts, apps/merchant/package.json, pnpm-lock.yaml, tests/e2e/support/ui-kit-entry.tsx, tests/e2e/support/ui-kit-checks.ts, tests/e2e/ui-kit.spec.ts-snapshots/, tests/e2e/ui-kit.webkit.spec.ts-snapshots/, docs/design-system.md
---

# 0161 — Kit: campos especiales (Fase 0b, rebanada 3)

> N1 (componentes de UI + e2e, sin datos ni auth). Zona Claude (`ui/**`, ADR 0123 decision 3). Decisiones del owner
> tomadas ANTES de escribirla (2026-10-05, enmienda del ADR 0123): fecha/hora con **segmentos de React Aria** y
> **boton de calendario**; color con **muestra + hex editable**; busqueda con **lupa + boton borrar**.

## Problema

Medido sobre `motor` `be5323a` (= `origin/main`), 2026-10-05. 28 controles nativos de estos tipos en 13 archivos,
ninguno del kit:

- **`datetime-local` (9):** `marketing/{welcome,custom,cross,template}-fields.tsx` (8, `TextField type="datetime-local"`)
  y `loyalty/closing-date-field.tsx:29` (input a mano con `min`, ayuda y error propios + `.loyalty-date
  { appearance: auto }` en `globals.css:7357`). El aspecto y el formato dependen del navegador y del idioma del
  sistema (12 h y mm/dd en un Chrome en ingles).
- **`time` (2):** `components/weekly-schedule.tsx:118,131`, etiquetas `sr-only` («Inicio del horario de Lunes»),
  aspecto en `.time-range input` (`globals.css:104`).
- **`color` (5):** `loyalty/card-design-fields.tsx:32` (`ColorField` local: muestra + hex de solo lectura, CSS
  `.loyalty-color`), `brand/kit/steps/step-preview.tsx:139,147,157` (solo muestra, `.brand-kit-field
  input[type="color"]`), `brand/brand-page.tsx:171` (muestra + hex editable con `aria-label` propios y `data-tour`
  en el `label`, `.brand-color-field`).
- **`search` (3):** `counter/sale-forms.tsx:183` (`.counter-search`), `customers/customers-page.tsx:182`
  (`.customers-name-search`), `catalog/products-tab.tsx:84` (lupa de iconoir a mano en `.catalog-search`).
- **`range` (1):** `components/image-cropper.tsx:101` (zoom 1–4, paso 0.01, `.image-cropper-zoom`).
- **`file` (8 inputs, 4 pantallas):** `catalog/product-image-field.tsx:50,71`, `catalog/catalog-ai-import-picker.tsx:
  95,107`, `loyalty/steps/step-card-design.tsx:54,74`, `brand/brand-identity.tsx:132,143`. Siempre el mismo patron:
  input `sr-only` + `ref` + boton que hace `ref.current.click()`, y un segundo input con `capture="environment"`
  para «Tomar foto» en touch.

**Medido para el diseño:**

- `react-aria-components` 1.21.1 trae `TimeField`, `DateField`, `DatePicker`/`Calendar`, `SearchField`, `Slider` y
  `FileTrigger`. `FileTrigger` (`dist/private/FileTrigger.mjs`) renderiza el `input type="file"` con
  `display: none`, vacia `value` antes de cada clic (re-elegir el mismo archivo dispara `onSelect`), mapea
  `acceptedFileTypes`→`accept`, `allowsMultiple`→`multiple`, `defaultCamera`→`capture` y pasa `filterDOMProps(rest,
  { global: true })` al input.
- `@internationalized/date` 3.12.4 esta en el store (dependencia de React Aria) pero no es dependencia directa de
  `apps/merchant`: hay que agregarla para `parseTime`/`parseDateTime`.
- Sin `I18nProvider`, React Aria toma el idioma de `navigator.language`; Playwright corre en `en-US`. El layout dice
  `<html lang="es">`.
- `Time.toString()` da `"09:30:00"` y `CalendarDateTime.toString()` da `"2026-10-15T09:30:00"`: con segundos, distinto
  del valor de un input nativo (`"09:30"`, `"2026-10-15T09:30"`), que es lo que guardan y mandan las pantallas.
- e2e que dependen de estos controles (los migra la Fase 1 junto con su pantalla, no esta spec):
  `setInputFiles` sobre `#brand-logo-file` (`brand-logo*.spec.ts`), `getByLabel("Archivo del sello")`
  (`loyalty-image.spec.ts`), `input[type="file"]` (`catalog-tour-import.spec.ts`); `slider` «Zoom»
  (`brand-logo.spec.ts:126`); `searchbox` «Buscar producto» (`catalog-tour-filters.spec.ts:14`); `textbox`
  «Código hexadecimal acento» (`brand-tours.spec.ts:61`).

## Alcance

**Entra:**

1. Piezas nuevas en `ui/`, exportadas desde `ui/index.ts`: `TimeField`, `DateTimeField`, `SearchField`,
   `ColorField`, `Slider`, `FileButton` (diseño abajo).
2. `@internationalized/date` como dependencia directa de `apps/merchant` (version del store, 3.12.4).
3. Harness: las piezas al final de la pagina por defecto + caso `?case=calendar`; oraculos en `ui-kit-checks.ts`;
   capturas regeneradas mirandolas (Artifact privado).
4. `docs/design-system.md`: una seccion por pieza.

**No entra:** migrar pantallas (Fase 1, GPT), ni sus e2e, ni borrar el CSS viejo de esos controles (lo borra cada
pantalla al migrar); restringir el `type` de `TextField` (hoy 8 usos de `datetime-local`: lo cierra la ultima
pantalla de marketing o la guardia de la 0c); `DateField` sin hora, `DateRangePicker`, `ColorPicker` propio
(rueda/area): sin uso medido.

## Diseño

Regla comun (0159/0160): sin props de color ni de tipografia; `className` solo para LAYOUT, al final con `cx`; toda
pieza acepta `tourAnchor` → `data-tour` en el contenedor del campo. Label, descripcion y error con **las mismas
clases que `TextField`**; el «input» (grupo de segmentos, campo de busqueda, hex) con las mismas que su `Input`
(`min-h-12 … rounded-md border px-3.5 py-2.5`, `border-border-strong` / invalido `border-danger`, foco visible
`outline-2 outline-offset-2 outline-focus`, deshabilitado `bg-disabled`). `validationBehavior="aria"` y
`isInvalid` derivado de `errorMessage` como `TextField` (0162: los `validationErrors` del `Form` se ven).

### Idioma y formato de fecha/hora

`TimeField` y `DateTimeField` envuelven su contenido en `I18nProvider locale="es-419"` y fijan `hourCycle={24}`:
orden dia/mes/año y 24 h sin depender del navegador. `granularity="minute"`. **Valores de texto, iguales a los
nativos:** entrada `"HH:mm"` / `"YYYY-MM-DDTHH:mm"` (`""` = vacio), salida igual (`toString().slice(0, 5)` /
`.slice(0, 16)`; vacio o incompleto → `""`). Hora de pared sin zona: las pantallas siguen convirtiendo con la zona
del comercio como hoy.

### `TimeField` (`ui/time-field.tsx`)

```tsx
<TimeField label value onChange hideLabel? description? errorMessage? isDisabled? isRequired? name? tourAnchor? />
```

`TimeField` de RAC: `Label` (con `hideLabel` → `sr-only`, como `SelectField`), `DateInput` como grupo con las clases
del input (`flex items-center`), cada `DateSegment` `rounded-sm px-0.5 tabular-nums`, enfocado `bg-primary
text-on-primary`, placeholder `text-content-muted`.

### `DateTimeField` (`ui/date-time-field.tsx`)

```tsx
<DateTimeField label value onChange min? description? errorMessage? isDisabled? isRequired? name? tourAnchor? />
```

`DatePicker` de RAC con `granularity="minute"`: grupo con las clases del input = `DateInput` (segmentos como
`TimeField`) + `Button` de icono (`Calendar` de iconoir, `aria-label` «Abrir calendario», `size-9 rounded-sm`,
hover `bg-primary-soft`). `min` (texto) → `minValue`. El boton abre un `Popover` (`rounded-lg border border-border
bg-surface-raised p-4 shadow-lg`) con `Dialog` + `Calendar`: encabezado con `Heading` del mes (`text-base font-bold`,
«octubre de 2026») y botones «Mes anterior»/«Mes siguiente» (`NavArrowLeft`/`NavArrowRight`, `size-11`);
`CalendarGrid` con dias `size-11 rounded-md text-base`, seleccionado `bg-primary text-on-primary`, hoy con borde
`border-primary`, fuera de rango/deshabilitado `text-on-disabled`. Elegir un dia cierra el popover y conserva la hora
ya escrita (si no habia, React Aria pone `00:00`). El `Calendar` es interno: no se exporta.

### `SearchField` (`ui/search-field.tsx`)

```tsx
<SearchField label value onChange hideLabel? placeholder? description? errorMessage? onSubmit? autoFocus?
  maxLength? isDisabled? tourAnchor? />
```

`SearchField` de RAC (`role="searchbox"`; Escape vacia). Contenedor `relative`; lupa (`Search` de iconoir,
`aria-hidden`, `absolute left-3.5 size-5 text-content-muted`); `Input` con las clases del input + `pl-11 pr-11` y
sin la «×» nativa de WebKit (`[&::-webkit-search-cancel-button]:appearance-none`); `Button` «Borrar búsqueda»
(`Xmark`, `absolute right-1 size-10 rounded-sm`), **oculto cuando el campo esta vacio** (`data-empty` del
`SearchField` → `hidden`).

### `ColorField` (`ui/color-field.tsx`)

```tsx
<ColorField label value onChange description? errorMessage? isDisabled? tourAnchor? />
```

Un `TextField` de RAC para el hex (`Label` = `label`, `maxLength={7}`, `font-mono uppercase`, `aria-label` no: la
etiqueta visible lo nombra) y, a la izquierda dentro del mismo borde, la muestra: `<input type="color">` nativo
(`size-9 rounded-sm border-0 p-0 cursor-pointer`, `aria-label` «Elegir color {label en minusculas}») que abre el
selector del sistema. El texto es libre (la pantalla valida, como hoy en `brand-page.tsx`): `onChange` recibe lo
escrito tal cual; la muestra muestra `value` si es `#RRGGBB` valido y `#000000` si no; elegir en la muestra llama
`onChange` con el hex **en mayusculas**.

### `Slider` (`ui/slider.tsx`)

```tsx
<Slider label value onChange minValue maxValue step? isDisabled? tourAnchor? />
```

`Slider` de RAC: `Label` (`text-base font-bold`), `SliderTrack` `relative h-11 w-full` con la pista dibujada en un
hijo (`absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-disabled`) y el tramo lleno `bg-primary`
(ancho por `state.getThumbPercent(0)`: excepcion de `style` del ADR 0123 §2, como `ProgressBar`); `SliderThumb`
`size-6 rounded-full border-2 border-primary bg-surface shadow-sm`, foco visible `outline-2 outline-focus`. Sin
salida numerica (sin uso).

### `FileButton` (`ui/file-button.tsx`)

```tsx
<FileButton onSelect accept? multiple? camera? inputLabel? isDisabled? variant?="secondary" icon? tourAnchor?>
  {label}
</FileButton>
```

`FileTrigger` de RAC con un `Button` del kit adentro (mismas variantes; `icon` va antes del texto con
`aria-hidden`). `accept` → `acceptedFileTypes` (texto separado por comas, partido); `multiple` → `allowsMultiple`;
`camera` → `defaultCamera="environment"`. `onSelect(files: File[])` recibe un array y **no se llama** con la lista
vacia (cancelar el dialogo). `inputLabel` → `aria-label` del input oculto: es el gancho de los e2e que hoy usan
`setInputFiles` por etiqueta. **A medir al implementar:** que `FileTrigger` lleve `aria-label` al input
(`filterDOMProps` con `global: true`) y que `getByLabel(…).setInputFiles` lo encuentre con `display: none`; si no,
`FileButton` arma su input propio con el mismo comportamiento (vaciar antes del clic) y se declara el desvio.

### Harness (`tests/e2e/support/ui-kit-entry.tsx`)

Al final de la pagina por defecto, con contenido fijo y una linea «Valor: …» debajo de cada pieza que muestra lo
ultimo que emitio `onChange`/`onSelect`:

1. `TimeField` «Apertura» `value="09:00"`.
2. `DateTimeField` «Inicio de la campaña» `value="2026-10-15T09:30"` `min="2026-10-05T00:00"`.
3. `SearchField` «Buscar producto» vacio, placeholder «Buscar producto…».
4. `ColorField` «Color primario» `value="#176548"` `tourAnchor="kit-color"`.
5. `Slider` «Zoom» `minValue={1}` `maxValue={4}` `step={0.5}` `value={1}`.
6. `FileButton` «Subir imagen» (`icon` `Upload`, `accept="image/png,image/jpeg"`, `inputLabel="Archivo de
   prueba"`, muestra «Valor: <nombres>») y `FileButton` «Tomar foto» (`camera`, `inputLabel="Foto de prueba"`).

`?case=calendar` renderiza solo el `DateTimeField` con el calendario abierto (`defaultOpen`), para las capturas.

### Oraculo 1 — estilos y comportamiento (`ui-kit-checks.ts`, corre en todos lados)

- **Formato:** el grupo de «Inicio de la campaña» lee `15/10/2026, 09:30` (orden y 24 h fijos con Playwright en
  `en-US`); `TimeField` lee `09:00`.
- **TimeField:** foco en el segmento de hora, escribir `14` → «Valor: 14:00» (sin segundos).
- **DateTimeField:** segmento de minutos, flecha arriba → «Valor: 2026-10-15T09:31»; «Abrir calendario» →
  `dialog` visible con el mes «octubre de 2026»; clic en el dia 20 → el dialogo se cierra y «Valor:
  2026-10-20T09:31»; el dia 3 (antes de `min`) no es elegible (`aria-disabled="true"`). El grupo mide
  como el input de `TextField` (alto, radio, borde).
- **SearchField:** `getByRole("searchbox", { name: "Buscar producto" })`; vacio → sin boton «Borrar búsqueda»
  visible; escribir «pan» → boton visible; clic → campo vacio y «Valor: » vacio; escribir de nuevo + Escape → vacio.
  La lupa queda a la izquierda del texto (x del texto > borde derecho del icono).
- **ColorField:** `getByRole("textbox", { name: "Color primario" })` con `#176548`; `fill` de la muestra
  («Elegir color color primario») con `#1a2b3c` → «Valor: #1A2B3C»; escribir `#12` en el hex → «Valor: #12» y la
  muestra en `#000000`; `data-tour="kit-color"` en el contenedor.
- **Slider:** `getByRole("slider", { name: "Zoom" })` con `aria-valuenow="1"`; foco + flecha derecha → `1.5` y
  «Valor: 1.5»; el tramo lleno mide 1/6 de la pista (± 1 px).
- **FileButton:** `getByLabel("Archivo de prueba").setInputFiles(png)` → «Valor: prueba.png»; clic en «Subir
  imagen» dispara `filechooser` con `isMultiple()` falso; el input de «Foto de prueba» tiene `capture="environment"`
  y el de «Archivo de prueba» `accept="image/png,image/jpeg"`; el boton mide como `Button secondary` (min-height
  44px, borde 1px).

Corren en 390 y 1280 donde la medida cambia (grupo de fecha, calendario, buscador); el resto en 1280.

### Oraculo 2 — capturas (Mac; `pnpm verify` las corre, la CI no)

Las 4 + 4 capturas de la pagina por defecto **se regeneran** (la pagina crece) y se suman
`kit-calendar-<tema>-<ancho>.png` (4 + 4) del caso `?case=calendar`. `threshold: 0`, mirandolas en un Artifact
privado antes de commitear.

## Archivos

| Archivo | Accion |
|---|---|
| `apps/merchant/src/ui/{time-field,date-time-field,search-field,color-field,slider,file-button}.tsx` | crear |
| `apps/merchant/src/ui/index.ts` | editar (exports) |
| `apps/merchant/package.json`, `pnpm-lock.yaml` | editar (`@internationalized/date`) |
| `tests/e2e/support/ui-kit-entry.tsx`, `tests/e2e/support/ui-kit-checks.ts` + `-snapshots/` | editar / regenerar |
| `docs/design-system.md` | editar |

**Disjunta?** Si: no toca pantallas ni `globals.css`. `package.json`/lock: avisar a GPT el sha.

## Definition of Done

- [ ] Rojo antes: harness con las piezas y sin crearlas → `No matching export in "apps/merchant/src/ui/index.ts"
      for import "…"` por cada pieza.
- [ ] `pnpm exec playwright test tests/e2e/ui-kit.spec.ts tests/e2e/ui-kit.webkit.spec.ts` (Node 24) → todo verde,
      con la cuenta transcripta.
- [ ] `CI=1 …` mismo comando → verde, capturas salteadas, cuenta transcripta.
- [ ] `rg -n '"@internationalized/date"' apps/merchant/package.json` → una linea.
- [ ] Artifact privado con las capturas nuevas y regeneradas.
- [ ] `pnpm verify` con Node 24, una vez al final, tabla transcripta.
- [ ] `rg -nw MUTATION apps tools tests` (sin `.next`) → solo `E2E_LOYALTY_MUTATION_TEST` preexistente.

## Mutaciones — presupuesto: 4. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| M1 | `date-time-field.tsx`: emitir `value.toString()` sin `.slice(0, 16)` | «Valor: 2026-10-15T09:31» tras flecha arriba |
| M2 | `search-field.tsx`: boton borrar sin ocultarse con el campo vacio | sin «Borrar búsqueda» visible con el campo vacio |
| M3 | `color-field.tsx`: la muestra emite sin `toUpperCase()` | «Valor: #1A2B3C» |
| M4 | `file-button.tsx`: `camera` sin mapear a `defaultCamera` | `capture="environment"` en «Foto de prueba» |

**Protocolo:** skill `protocolo-de-verificacion` (shasum → bitacora → etiqueta `MUTATION` → medir → revertir con
`diff`). De a una. **Corte:** dos vueltas seguidas de «el fix abrio la siguiente» → al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- **Teclado numerico y selector del sistema en celulares** (segmentos en iPhone/Android, la muestra de color en iOS):
  QA del owner cuando una pantalla migre; WebKit de escritorio no los reproduce.
- **El calendario dentro de un tour:** ningun paso de tour apunta hoy a un campo de fecha.
- Lo mismo que la 0159/0160: Windows pixel a pixel, Linux, Firefox.

## Handoff

N1: sin subagentes. Implementa la sesion principal en `motor`; `pnpm verify` una vez al final; commit del codigo y
commit de docs con el sha. Push a pedido del owner. Despues: la Fase 0c.

## Abierto

Nada que bloquee.
