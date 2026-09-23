# Handoff — UI de Marca y Brand Kit

Fecha: 2026-09-21  
Estado: arco cerrado y verificado

## Marca

`/backoffice/brand` fue rediseñada con el lenguaje visual de Staff y Locales:

- vista previa viva de nombre, logo y paleta;
- editor dividido en Identidad, Logo, Paleta y Configuración regional;
- `TextField` y `SelectField` compartidos con el wizard;
- selector de archivo oculto detrás de acciones claras para elegir, fotografiar o quitar el logo;
- configuración regional apilada verticalmente para evitar desbordes;
- barra final de guardado;
- layout mobile-first y preview fija en escritorio;
- soporte correcto para temas claro y oscuro.

Se añadió skeleton tanto para la espera del segmento de Next como para la carga client-side de `/api/brand`.

## Locales

Se añadió un `loading.tsx` con skeleton completo para la carga de sesión, plan y listado de `/backoffice/locations`.

## Brand Kit

`/backoffice/brand/kit` fue rediseñada con las mismas superficies, controles y tokens semánticos:

- progreso mediante `ProgressIndicator` compartido;
- plantillas presentadas como tarjetas responsive;
- selectores de alcance, estilo QR y papel accesibles;
- campos de texto y selector de local del sistema de diseño;
- controles de impresión con iconografía;
- preview apilada en móvil y fija en escritorio;
- navegación inferior persistente;
- skeleton propio para la carga server-side.

El flujo quedó simplificado de tres a dos pasos:

1. Plantilla y alcance del QR.
2. Personalización, vista previa e impresión.

Se eliminó el paso bloqueante de revisión de Marca. No tener logo ya no impide crear un afiche. La vista previa explica qué datos se están usando y enlaza a Marca para modificarlos.

Las cinco plantillas muestran siempre el nombre del negocio cuando no existe logo. Hay una prueba parametrizada que protege este comportamiento.

## Archivos principales

- `apps/merchant/src/app/backoffice/brand/brand-page.tsx`
- `apps/merchant/src/app/backoffice/brand/regional-fields.tsx`
- `apps/merchant/src/app/backoffice/brand/loading.tsx`
- `apps/merchant/src/app/backoffice/brand/kit/brand-kit-wizard.tsx`
- `apps/merchant/src/app/backoffice/brand/kit/brand-kit-skeleton.tsx`
- `apps/merchant/src/app/backoffice/brand/kit/loading.tsx`
- `apps/merchant/src/app/backoffice/brand/kit/steps/step-template.tsx`
- `apps/merchant/src/app/backoffice/brand/kit/steps/step-preview.tsx`
- `apps/merchant/src/app/backoffice/brand/kit/poster-preview.test.ts`
- `apps/merchant/src/app/backoffice/locations/locations-skeleton.tsx`
- `apps/merchant/src/app/backoffice/locations/loading.tsx`
- `apps/merchant/src/ui/progress-indicator.tsx`
- `apps/merchant/src/app/globals.css`

`step-brand-check.tsx` fue eliminado porque su paso dejó de existir.

## Verificación

Último cierre de Brand Kit:

- TypeScript aprobado;
- ESLint aprobado;
- contraste claro y oscuro aprobado;
- 23 pruebas de Brand Kit aprobadas;
- `git diff --check` aprobado.

El worktree continúa sin commit y contiene también el arco anterior de Locales y cambios preexistentes del usuario. Preservar todo lo que no pertenezca explícitamente a la próxima pantalla.
