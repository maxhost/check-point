# Sistema de diseño de CheckPass Club

Estado: Fase 2. Este catálogo cubre los componentes base necesarios para construir el wizard. Antes de añadir otro componente se debe revisar `apps/merchant/src/ui/index.ts` y extender uno existente cuando la diferencia pueda expresarse con props.

## Arquitectura

- `apps/merchant/src/ui/tokens.css`: única fuente de colores del sistema nuevo, configuración `@theme` de Tailwind, geometría y movimiento.
- `apps/merchant/src/ui/*.tsx`: componentes reutilizables. Todo comportamiento interactivo está delegado a React Aria Components.
- `apps/merchant/src/ui/index.ts`: API pública del catálogo.
- `apps/merchant/src/ui/tokens.test.ts` (corre en `pnpm test`): pares de contraste claros y oscuros, orden de capas de CSS y paleta cruda de Tailwind apagada (spec 0158).
- Iconoir es el único set de iconos.

Los estilos heredados de `/backoffice` permanecen en `globals.css` dentro de `@layer legacy`, debajo de las utilidades de Tailwind (spec 0158), hasta que esa UI se elimine. La paleta cruda de Tailwind (`bg-white`, `bg-emerald-600`…) no compila. Ningún componente nuevo debe agregar un color literal: usa exclusivamente nombres semánticos de Tailwind como `bg-surface`, `text-content` o `border-border`.

## Tokens

### Claro y oscuro

Claro forzado (ADR 0123, decisión 2): `<html data-theme="light">` y no se sigue `prefers-color-scheme`. El oscuro vive en un solo bloque, `:root[data-theme="dark"]`, que usan los e2e que lo fuerzan y el cierre del ADR 0123. Los componentes usan los mismos roles semánticos en ambos modos; no duplican clases.

### Contraste

Ejecutar:

```sh
pnpm vitest run apps/merchant/src/ui/tokens.test.ts
pnpm --filter @mi-pasaporte/merchant typecheck:ui
```

El complementario original no alcanza AA con texto blanco normal. Por eso permanece como valor de marca, pero el rol interactivo `--brand-complement-action` usa un tono más oscuro en claro. El acento tampoco admite texto blanco: `--brand-on-accent` usa texto oscuro. El test exige 4.5:1 para texto y 3:1 para foco y bordes esenciales.

## Catálogo

Los estados enumerados son los que aplican a cada pieza. “Vacío” pertenece a campos y listas; “loading” a acciones asíncronas; “error” a campos, alertas y resultados. No se fabrican variantes sin significado —por ejemplo, un indicador de progreso no tiene hover ni loading—.

### `Button`

Propósito: acciones primarias, secundarias, discretas y destructivas.

Props propias: `variant` (`primary | secondary | quiet | danger`), `isLoading` y `fullWidth`. También acepta props de React Aria como `isDisabled`, `onPress` y `type`.

Estados: default, hovered, pressed, focus-visible, disabled y loading. El área mínima es 44 px.

```tsx
<Button type="submit" isLoading={saving} fullWidth>
  Continuar
</Button>
```

### `TextField`

Propósito: texto, email y otros valores de una línea con relación accesible entre etiqueta, ayuda y error.

Props propias: `label`, `description`, `errorMessage`, `placeholder`, `className`. Acepta `name`, `type`, `autoComplete`, `isRequired`, `isDisabled` e `isInvalid` de React Aria.

Estados: vacío/default, con valor, hover, focus-visible, disabled e invalid/error. El error se renderiza mediante `FieldError` y nunca solo con color.

```tsx
<TextField
  label="Email"
  name="email"
  type="email"
  autoComplete="email"
  isRequired
  errorMessage={errors.email}
/>
```

### Formularios en modales y wizards

Los formularios nuevos —incluidos los que viven en un modal del backoffice— deben usar los componentes de `apps/merchant/src/ui`; el wizard y los formularios de alta/edición de Staff son la referencia ejecutable. No se deben construir campos nuevos con `<label><input /></label>` ni asignarles colores en `globals.css`.

Reglas obligatorias:

1. Usar `TextField`, `SelectField` o `NumberField` desde el barrel `src/ui`. Estos componentes ya resuelven label, valor, placeholder, descripción, error, foco y estados claro/oscuro.
2. Pasar la ayuda con `description` y los errores con `errorMessage`; no recrearlos con `span`, `small` o reglas CSS locales.
3. No sobrescribir `color`, `background`, `border` ni `::placeholder` de un componente del catálogo. Sus tokens son `text-content`, `text-content-muted`, `bg-surface`, `border-border-strong` y `outline-focus`.
4. Un control compuesto que todavía no esté en el catálogo debe usar los mismos roles semánticos: label `--ui-text`, valor `--ui-text`, placeholder/ayuda `--ui-text-muted`, superficie `--ui-surface`, borde `--ui-border-strong` y foco `--ui-focus`. Nunca colores hexadecimales.
5. En modales, usar la misma separación vertical de Staff (`staff-name-field`) hasta que exista un layout de formulario compartido; una clase de pantalla puede definir geometría, pero no colores de campos.
6. Verificar siempre tema claro y oscuro, valores escritos y placeholders, además de ejecutar `tokens.test.ts` y `typecheck:ui`.

Ejemplo para un modal:

```tsx
<TextField
  className="staff-name-field"
  label="Nombre del local"
  description="Así lo reconocerá tu equipo."
  placeholder="Ej. Sucursal Centro"
  value={name}
  onChange={setName}
  isRequired
/>
```

### `SelectField`

Propósito: elegir una opción conocida, como país o categoría. Usa `Select`, `Popover` y `ListBox` de React Aria para teclado, typeahead, foco y selección.

Props propias: `label`, `options`, `description`, `errorMessage`, `placeholder`, `className`. Cada opción tiene `id`, `label` y descripción opcional.

Estados: cerrado/default, hover, focus-visible, abierto, opción enfocada, seleccionada, disabled, invalid/error y lista vacía.

```tsx
<SelectField
  label="País"
  name="countryCode"
  options={countries.map((country) => ({
    id: country.code,
    label: country.name,
  }))}
/>
```

### `NumberField`

Propósito: números acotados con entrada directa y botones de incremento; se usará para la meta de sellos.

Props propias: `label`, `description`, `errorMessage`, `className`. Acepta `minValue`, `maxValue`, `step`, `value`, `defaultValue`, `onChange`, `isDisabled` e `isInvalid`.

Estados: default, focus-within, mínimo/máximo, disabled e invalid/error. Ambos botones tienen 48 px y nombre accesible.

```tsx
<NumberField
  label="¿Cada cuántos sellos obtiene el premio?"
  minValue={2}
  maxValue={50}
  defaultValue={8}
/>
```

### `Alert`

Propósito: estado contextual persistente. No reemplaza el error inline de un campo.

Props: `kind` (`info | success | warning | error`), `title`, `children`, `className`.

Estados: informativo, éxito, advertencia y error. Error usa `role="alert"`; los demás `role="status"`. Un icono Iconoir refuerza el texto sin ser la única señal.

```tsx
<Alert kind="error" title="No pudimos guardar el negocio">
  Revisá tu conexión y volvé a intentar.
</Alert>
```

### `ProgressIndicator`

Propósito: comunicar posición en un flujo lineal fijo. No es navegación.

Props: `currentStep` —base uno— y `steps`, una lista de etiquetas.

Estados: completado, actual y pendiente. Expone el actual con `aria-current="step"`; la barra visual está oculta a lectores y cada estado tiene texto oculto. En móvil muestra contador y barras; desde `sm` agrega etiquetas.

```tsx
<ProgressIndicator
  currentStep={2}
  steps={[{ label: "Cuenta" }, { label: "Negocio" }, { label: "Programa" }]}
/>
```

### `ApiError`

Propósito: traducir en un solo lugar los cinco códigos transversales del gate del owner. Nunca muestra directamente la copia `error` que llega del servidor.

Props: `code`, `suspensionReason` y callbacks opcionales `onLogin`, `onBack`, `onContact`, `onHome` y `onEmailVerified`. Cada pantalla debe entregar el callback correspondiente a su navegación; así el componente no inventa rutas ni datos de contacto.

Estados: error inicial, acción disponible, verificación de email cargando, enlace enviado, email ya verificado y fallo recuperable. `email_not_verified` ejecuta directamente el `POST /api/merchant/auth/verify-email`; los otros códigos delegan navegación o contacto mediante callbacks.

Mapeo único:

| Código               | Presentación                          | Acción                        |
| -------------------- | ------------------------------------- | ----------------------------- |
| `unauthorized`       | sesión terminada                      | volver a ingresar             |
| `not_owner`          | acción exclusiva del propietario      | volver                        |
| `email_not_verified` | email pendiente                       | enviar enlace de verificación |
| `business_suspended` | cuenta suspendida y motivo, si existe | contactar a CheckPass         |
| `business_closed`    | negocio cerrado                       | ir al inicio                  |

```tsx
<ApiError
  code={error.code}
  suspensionReason={error.suspensionReason}
  onLogin={() => router.push("/login")}
  onContact={openSupport}
/>
```

### `Heading` y `Text`

Propósito: la tipografía del kit, con la medida del wizard (ADR 0123, decisión 5). Fijan `margin`, `color`, tamaño, interlineado y peso, así que no heredan los `h1`/`h2`/`p` de `globals.css`. No aceptan props de color ni de tipografía; `className` es solo para layout.

Props de `Heading`: `level` (`1 | 2 | 3`), `id`, `tabIndex` (para mover el foco al título; agrega `outline-none`), `className`.

| `level` | 390 px | desde `sm` |
| ------- | ------ | ---------- |
| 1       | 24/30  | 30/37.5    |
| 2       | 20/28  | 20/28      |
| 3       | 18/28  | 18/28      |

Props de `Text`: `variant` (`body | muted | small | label`, por defecto `body`), `as` (`p | span`, por defecto `p`), `id`, `className`. `body` 16/24 `text-content`; `muted` 16/24 `text-content-muted` (descripción de pantalla); `small` 14/20 `text-content-muted` (descripción de campo); `label` 16/20 en negrita.

```tsx
<Heading level={2} id="programa-titulo">Tu programa</Heading>
<Text variant="muted">Elegí cómo suman puntos tus clientes.</Text>
```

### `Card`

Propósito: superficie de contenido (la tarjeta del wizard, con borde para separarse del fondo del backoffice). Radio 20 px, padding 24 px y 32 px desde `sm`, borde `border`, fondo `surface`, `shadow-sm`.

Props: `as` (`section | div | article`, por defecto `section`), `aria-labelledby`, `className`. Con `section` y `aria-labelledby` es una región con nombre.

```tsx
<Card aria-labelledby="datos-titulo">
  <Heading level={2} id="datos-titulo">Datos del negocio</Heading>
  …
</Card>
```

### `PageHeader`

Propósito: el título de una pantalla, con descripción y acciones opcionales. En móvil las acciones van debajo del título; desde `sm`, a la derecha.

Props: `title`, `description`, `actions` (nodos, normalmente `Button`), `headingId`.

```tsx
<PageHeader
  title="Clientes"
  description="Quiénes tienen tu tarjeta."
  actions={<Button onPress={exportar}>Exportar</Button>}
/>
```

### `Form`, `FormSection` y `FormActions`

Propósito: la estructura de un formulario. `Form` envuelve el `Form` de React Aria con `validationBehavior="aria"` por defecto (el mismo que los campos del kit: el envío no se frena en el navegador, se valida en el código) y una grilla de 20 px entre bloques. `FormSection` es un `fieldset` con `legend` (título `Heading level={2}` y descripción `Text variant="small"`): da el nombre accesible del grupo. `FormActions` pone los botones en fila a la derecha desde `sm`; en móvil los apila a todo el ancho con la acción principal (la última del JSX) arriba.

Props de `Form`: las del `Form` de React Aria (`onSubmit`, `validationBehavior`, `validationErrors`…) más `className`. Props de `FormSection`: `title`, `description`, `children`. `FormActions`: `children`.

Pendiente (hallazgo de la spec 0159): `validationErrors` del `Form` hoy no llega a `TextField` (medido) ni, por el mismo patrón `isInvalid={props.isInvalid ?? Boolean(errorMessage)}`, a `SelectField`, `NumberField`, `TextAreaField` y `ChoiceGroup`: sin `errorMessage` fuerzan `isInvalid={false}`, que pisa el error del servidor. Hasta arreglarlo, el error de API por campo se pasa con `errorMessage`.

```tsx
<Form onSubmit={guardar}>
  <FormSection title="Datos del negocio" description="Lo que ven tus clientes">
    <TextField label="Nombre" name="name" isRequired errorMessage={errors.name} />
  </FormSection>
  <FormActions>
    <Button variant="secondary" onPress={cancelar}>Cancelar</Button>
    <Button type="submit" isLoading={saving}>Guardar</Button>
  </FormActions>
</Form>
```

### `Dialog` y `ConfirmDialog`

Propósito: todo modal. `Dialog` es el modal del kit sobre React Aria (foco atrapado, Escape y clic afuera cierran si `isDismissable`, el foco vuelve al disparador): título con la medida de `Heading level={2}`, `description` (acepta `ReactNode`, p. ej. un link) enlazada por `aria-describedby`, y el contenido debajo. `ConfirmDialog` es un `Dialog role="alertdialog"` con «Cancelar» (enfocado al abrir) y la acción `primary` o `danger` en un `FormActions`; con `isBusy` no se puede cerrar y la acción muestra carga.

Props de `Dialog`: `isOpen`, `onOpenChange`, `title`, `description?`, `role?` (`dialog`/`alertdialog`), `isDismissable?` (default `true`), `tourAnchor?`, `children`. Props de `ConfirmDialog`: `isOpen`, `title`, `description`, `confirmLabel`, `cancelLabel?`, `intent?` (`primary`/`danger`), `isBusy?`, `confirmDisabled?`, `tourAnchor?`, `confirmTourAnchor?`, `onCancel`, `onConfirm`.

```tsx
<ConfirmDialog
  isOpen={archiving !== null}
  title="¿Archivar el local?"
  description="Deja de aparecer en el mostrador."
  confirmLabel="Archivar"
  intent="danger"
  isBusy={saving}
  onCancel={() => setArchiving(null)}
  onConfirm={archivar}
/>
```

### `Combobox`

Propósito: un campo de texto con lista de opciones (búsqueda de lugares, autocompletar). Mide como `TextField`; la lista es la del `SelectField`, del ancho del campo. Los `items` son controlados: el filtrado o la búsqueda remota los hace quien lo usa. La lista se abre al escribir y también cuando llegan opciones nuevas con el foco en el campo (búsqueda asíncrona). `status` («Buscando…», «Sin resultados») y `errorMessage` se anuncian. Ejemplo real: `app/components/places-search.tsx`.

Props: `label`, `items` (`{ id, label, description? }[]`), `inputValue`, `onInputChange`, `onSelectionChange(id)`, `placeholder?`, `description?`, `status?`, `errorMessage?`, `isDisabled?`, `name?`, `tourAnchor?`, `className?`.

Cuidado: al elegir, React Aria escribe el texto de la opción en el campo (llama a `onInputChange`). Si eso dispara una búsqueda remota, ignorarlo mientras se procesa la elección (ver `places-search.tsx`).

### `Tabs`, `TabList`, `Tab` y `TabPanel`

Propósito: pestañas (catálogo, mostrador). Envoltorios de React Aria con clases fijas; las flechas cambian de pestaña. `TabList` exige `aria-label`; cada `Tab` y su `TabPanel` comparten `id`. `Tab` acepta `tourAnchor`.

```tsx
<Tabs selectedKey={tab} onSelectionChange={setTab}>
  <TabList aria-label="Catálogo">
    <Tab id="products">Productos</Tab>
    <Tab id="categories">Categorías</Tab>
  </TabList>
  <TabPanel id="products">…</TabPanel>
  <TabPanel id="categories">…</TabPanel>
</Tabs>
```

### `SegmentedControl`

Propósito: elegir una opción entre pocas que cambian una vista (buscar por nombre/teléfono, mes/año). Roles `radiogroup`/`radio`. Props: `aria-label`, `options` (`{ id, label }[]`), `selectedKey`, `onSelectionChange`, `isDisabled?`, `tourAnchor?`.

### `Switch`

Propósito: prender o apagar algo con efecto inmediato. Props: las del `Switch` de React Aria (`isSelected`, `onChange`, `isDisabled`, `aria-busy`…) más `tourAnchor?`; el texto visible va como `children`, y sin texto `aria-label` es obligatorio.

### `ProgressBar`

Propósito: avance de una tarea (checklist de configuración). Props: `label`, `value`, `maxValue?` (100), `valueLabel?` («2 de 5»; por defecto el porcentaje), `className?`. Es la única pieza con `style` dinámico (el ancho del relleno, ADR 0123 §2).

### `Link`

Propósito: navegar. Envuelve `next/link` (navegación del cliente y prefetch intactos). `variant="inline"` (default) es un link de texto; `primary` y `secondary` tienen el aspecto de `Button` para links que son acciones («Ir a mi panel», «Ver campaña»). Props: las de `next/link` más `variant?`, `tourAnchor?`, `className?` (layout).

### Oráculos del kit

`tests/e2e/support/ui-kit-entry.tsx` muestra todas las piezas dentro del layout del backoffice. `tests/e2e/ui-kit.spec.ts` (Chromium) y `ui-kit.webkit.spec.ts` miden estilos computados (corren también en la CI) y comparan capturas de Mac, claro/oscuro × 390/1280, con `threshold: 0` (no corren en la CI). Una pieza nueva se agrega al final del harness; quien cambia una pieza a propósito regenera las referencias con `--update-snapshots` mirándolas.

## Convenciones para componentes nuevos

1. Buscar primero en el barrel `src/ui/index.ts` y en este catálogo.
2. Preferir una prop o variante antes que otro componente casi igual.
3. Delegar foco, teclado, overlay, selección y ARIA a React Aria Components.
4. Usar solo Iconoir y ocultar iconos decorativos con `aria-hidden`.
5. Mantener 44 px de objetivo mínimo y foco visible de dos píxeles.
6. Documentar propósito, props, estados y ejemplo antes de exportarlo.
7. Añadir a la comprobación cualquier nuevo par texto/fondo o borde/fondo.

### `TextAreaField`, `ChoiceGroup` y `CheckboxField`

Documentadas para la 0098. `TextAreaField` acepta la API de `TextField`, más `autoGrow`:
label, description, errorMessage, placeholder, value/onChange, required/disabled/invalid
se asocian con React Aria. Autoaltura mínima 160 px. Estados vacío, valor, error y foco.
`ChoiceGroup` acepta label, description, errorMessage, options `{value,label,description?}`,
value/onChange, isRequired/isDisabled/isInvalid y variante `cards | compact`. Radios con
teclado, seleccionado, error y foco; área mínima 48 px. `CheckboxField` acepta label,
description, isSelected/onChange, isDisabled y className; área mínima 44 px, descripción
incluida en su nombre accesible. Piezas neutrales, sin requests ni reglas del programa.

```tsx
<TextAreaField label="Descripción" value={text} onChange={setText} autoGrow />
<ChoiceGroup label="Modo" options={[{value: "one", label: "Uno"}]} value={mode} onChange={setMode} />
<CheckboxField label="Habilitar" description="Permite esta opción." isSelected={enabled} onChange={setEnabled} />
```

`ProgressIndicator` agrega `ariaLabel` opcional; por defecto conserva «Progreso del alta».
Loyalty usa «Progreso del programa». El adaptador local `ClosingDateField` conserva input
`datetime-local` como string en zona del negocio; label de 16 px, control de 48 px y
ayuda/error asociados por id. Es una excepción especializada, sin casts ni datepicker.

`NumberField` mantiene el clamp nativo por defecto. `clampOnBlur={false}` permite
validar un entero escrito fuera del rango sin corregirlo silenciosamente al salir:
los botones siguen deshabilitados en los límites. Loyalty captura el borrador al escribir
para validar el valor visible en el mismo submit; vacío permanece NaN hasta corregirse.
