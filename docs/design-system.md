# Sistema de diseño de CheckPass Club

Estado: Fase 2. Este catálogo cubre los componentes base necesarios para construir el wizard. Antes de añadir otro componente se debe revisar `apps/merchant/src/ui/index.ts` y extender uno existente cuando la diferencia pueda expresarse con props.

## Arquitectura

- `apps/merchant/src/ui/tokens.css`: única fuente de colores del sistema nuevo, configuración `@theme` de Tailwind, geometría y movimiento.
- `apps/merchant/src/ui/*.tsx`: componentes reutilizables. Todo comportamiento interactivo está delegado a React Aria Components.
- `apps/merchant/src/ui/index.ts`: API pública del catálogo.
- `apps/merchant/scripts/check-design-contrast.mjs`: validación reproducible de pares de contraste claros y oscuros.
- Iconoir es el único set de iconos.

Los estilos heredados de `/backoffice` permanecen aislados en `globals.css` hasta que esa UI se elimine. Ningún componente nuevo debe agregar un color literal: usa exclusivamente nombres semánticos de Tailwind como `bg-surface`, `text-content` o `border-border`.

## Tokens

### Marca en runtime

Los valores persistidos del comercio entran como `BrandPalette` en `BrandTheme`. El componente asigna las tres variables de marca a un subtree; no recompila Tailwind ni acopla el consumidor al merchant.

`resolveBrandTheme` analiza la luminancia de cada color en runtime, elige texto claro u oscuro según cuál produzca mayor contraste y deriva hover/pressed hacia el extremo que incrementa ese contraste. Cada estado de acción mantiene al menos 4.5:1. Un valor que no tenga el formato de color persistido esperado se ignora individualmente y conserva el fallback validado de `tokens.css`.

La marca no controla errores, foco ni campos del sistema: esos roles siguen siendo propiedad de CheckPass para que una edición de marca no degrade información crítica.

### Claro y oscuro

El modo sigue `prefers-color-scheme` por defecto. `data-theme="light"` o `data-theme="dark"` en `<html>` permite una elección explícita. Los componentes usan los mismos roles semánticos en ambos modos; no duplican clases.

### Contraste

Ejecutar:

```sh
pnpm --filter @mi-pasaporte/merchant check:design-contrast
pnpm --filter @mi-pasaporte/merchant typecheck:ui
```

El complementario original no alcanza AA con texto blanco normal. Por eso permanece como valor de marca, pero el rol interactivo `--brand-complement-action` usa un tono más oscuro en claro. El acento tampoco admite texto blanco: `--brand-on-accent` usa texto oscuro. La herramienta exige 4.5:1 para texto y 3:1 para foco y bordes esenciales.

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

### `BrandTheme`

Propósito: inyectar la marca de un comercio en runtime y limitarla a un subtree.

Props: `palette` con `primary`, `complement` y `accent`; `children`.

Estados: depende de la paleta activa y del modo claro/oscuro. No es interactivo.

```tsx
<BrandTheme palette={business.brandPalette}>{children}</BrandTheme>
```

### `ApiError`

Propósito: traducir en un solo lugar los cinco códigos transversales del gate del owner. Nunca muestra directamente la copia `error` que llega del servidor.

Props: `code`, `suspensionReason` y callbacks opcionales `onLogin`, `onBack`, `onContact`, `onHome` y `onEmailVerified`. Cada pantalla debe entregar el callback correspondiente a su navegación; así el componente no inventa rutas ni datos de contacto.

Estados: error inicial, acción disponible, verificación de email cargando, enlace enviado, email ya verificado y fallo recuperable. `email_not_verified` ejecuta directamente el `POST /api/merchant/auth/verify-email`; los otros códigos delegan navegación o contacto mediante callbacks.

Mapeo único:

| Código | Presentación | Acción |
| --- | --- | --- |
| `unauthorized` | sesión terminada | volver a ingresar |
| `not_owner` | acción exclusiva del propietario | volver |
| `email_not_verified` | email pendiente | enviar enlace de verificación |
| `business_suspended` | cuenta suspendida y motivo, si existe | contactar a CheckPass |
| `business_closed` | negocio cerrado | ir al inicio |

```tsx
<ApiError
  code={error.code}
  suspensionReason={error.suspensionReason}
  onLogin={() => router.push("/login")}
  onContact={openSupport}
/>
```

## Convenciones para componentes nuevos

1. Buscar primero en el barrel `src/ui/index.ts` y en este catálogo.
2. Preferir una prop o variante antes que otro componente casi igual.
3. Delegar foco, teclado, overlay, selección y ARIA a React Aria Components.
4. Usar solo Iconoir y ocultar iconos decorativos con `aria-hidden`.
5. Mantener 44 px de objetivo mínimo y foco visible de dos píxeles.
6. Documentar propósito, props, estados y ejemplo antes de exportarlo.
7. Añadir a la comprobación cualquier nuevo par texto/fondo o borde/fondo.
