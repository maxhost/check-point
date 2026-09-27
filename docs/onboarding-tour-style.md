# Estilo visual de los tours de onboarding

**Referencia canónica: onboarding de Staff**, en `/backoffice/staff`. Las próximas
orientaciones y ayudas de onboarding deben conservar el mismo tratamiento del
popover, texto, controles y colores. Los ajustes de una pantalla pueden resolver
posición, scroll o diálogos; no deben redefinir tipografía, color o aspecto de los
botones.

## Fuente de verdad

- `apps/merchant/src/app/backoffice/staff/staff-tour-definitions.ts` define los
  pasos del tour que sirve de referencia.
- `apps/merchant/src/app/backoffice/onboarding/onboarding-tour.ts` configura el
  motor compartido, el progreso, los botones y «Saltar» en el primer paso.
- `apps/merchant/src/app/globals.css` define el estilo visual común en las reglas
  `.driver-popover`, `.driver-popover-title`, `.driver-popover-description`,
  `.driver-popover button` y `.driver-popover-has-skip`.
- `apps/merchant/src/app/backoffice/loyalty/loyalty-tour-step.ts` conserva una
  etiqueta textual accesible para salir de las ayudas operativas. Su tamaño y
  color siguen la etiqueta «Saltar» de la referencia.

## Contrato visual

- Superficie del popover `--ui-surface`, texto `--ui-text` y descripción
  `--ui-text-muted`, compatibles con el tema claro y oscuro.
- Ancho máximo `min(340px, calc(100vw - 24px))`.
- Título de 18 px, peso 700 y línea 1.25; descripción de 14 px y línea 1.45.
- Controles de navegación de al menos 44 px de alto, padding de 9 por 13 px y
  esquinas de 10 px.
- «Saltar» aparece en el primer paso del onboarding, mide 13 px y usa
  `--ui-text-muted`. El motor compartido controla su texto y su decisión de
  progreso; cada pantalla no debe recrearlo con un botón propio.

Las declaraciones existentes en `.driver-popover*` son el contrato común. Una
clase local como `.loyalty-tour-popover` puede ajustar tamaño disponible o
posición, pero no debe reemplazar esos colores, fuentes o medidas de controles.
