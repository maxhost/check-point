# 0209 — Revisión del sistema existente

Extensión acotada del POS. Se conserva `docs/design-system.md` y el kit de Merchant; no se crea `DESIGN.md`, sidecar ni identidad visual nueva. La disposición de la revisión independiente recibida es **ship** para este alcance.

## Evidencia revisada

- Código final: `pos-editor.tsx` y `pos-console.tsx`, dentro de `apps/merchant/src/app/backoffice/pos/`.
- Sistema: `docs/design-system.md`; kit: `tokens.css`, `button.tsx`, `dialog.tsx`, `text-area-field.tsx`, `text.tsx` y `field-classes.ts`.
- Capturas vistas: `/private/tmp/0209-note-390.png` y `/private/tmp/0209-note-1280.png`.
- Contrato de alcance: `docs/specs/0209-pos-nota-orden.md`.

El botón de nota reutiliza el botón circular de impresora: 48 px, icono Iconoir de 24 px y roles semánticos del kit. La nota presente usa los roles `primary` y `on-primary`. La acción principal del pedido mantiene su jerarquía; el modal usa `Dialog`, `TextAreaField` y `Button`, sin campos ni colores locales nuevos. La lectura usa `Heading` y `Text`, conserva saltos y permite partir cadenas largas; queda oculta en impresión.

Las capturas muestran título, explicación del guardado posterior, campo multilínea, contador y dos acciones completos a 390 y 1280 px. Los bordes, radios, overlay, foco y superficies provienen de las piezas existentes. Esta revisión visual no sustituye las pruebas funcionales ni el gate de la spec.

## Resumen del sistema observado

1. Paleta: verde de acción y neutros semánticos; ninguna paleta propia para la nota.
2. Tipografía: título del diálogo 20/28 px en negrita, cuerpo 16/24 px y ayuda 14/20 px, definidos por el kit.
3. Geometría: diálogo con radio grande, campo y acciones con radio medio, disparador circular de 48 px.
4. Regla existente: formularios modales con piezas del kit y ayuda/error mediante sus props accesibles.
5. Regla existente: Iconoir, colores semánticos y tipografía del kit; las clases de pantalla resuelven disposición.

## Deriva preexistente preservada

El kit declara Arial/Helvetica como fuente del sistema; el fondo de escritorio contiene el rótulo superior «ADMINISTRACIÓN». Son decisiones heredadas, no novedades de la nota. No se convierten en reglas de un nuevo `DESIGN.md` ni se reparan en esta extensión. El catálogo conserva además una advertencia histórica sobre `isInvalid` de `TextAreaField` cuyo patrón ya no coincide con el componente leído; no se actualiza documentación global fuera de este alcance.
