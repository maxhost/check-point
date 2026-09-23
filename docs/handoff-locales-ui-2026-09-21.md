# Handoff — UI de Locales

Fecha: 2026-09-21  
Estado: arco cerrado y verificado

## Resultado

`/backoffice/locations` quedó alineada visualmente con Staff y con el sistema de diseño del wizard, mobile-first y abierta al owner o al integrante con permiso `locations`.

La pantalla permite:

- crear y editar locales en un modal tipo bottom sheet;
- elegir una dirección de Geoapify o escribirla manualmente;
- archivar con confirmación y reactivar locales;
- mostrar un toast informativo persistente mientras el servidor procesa cada acción;
- mostrar toasts de éxito y errores de API en un modal accesible;
- separar locales activos y archivados y comunicar el límite efectivo del plan;
- ejecutar el onboarding de Locales y cuatro ayudas operativas.

## Tours

El onboarding de Locales tiene seis pasos:

1. cantidad de locales admitidos por el plan;
2. botón para añadir local;
3. nombre del local;
4. búsqueda y selección de dirección;
5. dirección manual como alternativa;
6. creación del local.

Las ayudas disponibles son:

- por qué no se pueden añadir más locales;
- añadir un local;
- editar un local;
- archivar un local.

Las ayudas de alta y edición incluyen cinco pasos: abrir acción, nombre, buscador, dirección manual y confirmar. Los botones de acción avanzan automáticamente. Las ayudas no persisten progreso del onboarding.

Durante el paso del buscador, el listado de Geoapify pasa a formar parte del área resaltada. El buscador emite eventos internos para recalcular el recorte de Driver.js y avanzar después de seleccionar una sugerencia.

## Sistema de diseño

Los inputs de nombre y dirección manual usan el `TextField` compartido, igual que Staff. Buscador, opciones, labels, valores, placeholders y ayuda usan tokens semánticos compatibles con tema claro y oscuro.

El patrón obligatorio para futuros formularios quedó documentado en `docs/design-system.md`, sección «Formularios en modales y wizards».

## Archivos principales

- `apps/merchant/src/app/backoffice/locations/locations-console.tsx`
- `apps/merchant/src/app/backoffice/locations/location-form.tsx`
- `apps/merchant/src/app/backoffice/locations/location-error-dialog.tsx`
- `apps/merchant/src/app/backoffice/locations/locations-tour-controller.tsx`
- `apps/merchant/src/app/backoffice/locations/locations-tour-definitions.ts`
- `apps/merchant/src/app/backoffice/locations/locations-tour-definitions.test.ts`
- `apps/merchant/src/app/components/tour-events.ts`
- `apps/merchant/src/app/components/address-autofill-geoapify.tsx`
- `apps/merchant/src/app/backoffice/onboarding/onboarding-tour.ts`
- `apps/merchant/src/app/globals.css`
- `docs/design-system.md`

## Estado externo de prueba

Mediante Neon MCP se cambió únicamente la suscripción de `Cafe Milca` (`b60a21ed-181c-4f46-a9df-456e8905827a`) a:

- plan: `plus`;
- estado: `active`;
- sin plan pendiente.

Esto deja un límite efectivo de tres locales activos. También se eliminó su fila de progreso `locations` en `core.business_onboarding_tour`, para que el checklist vuelva a ofrecer el onboarding.

## Verificación final

Ejecutado satisfactoriamente:

```sh
cd apps/merchant
npm run typecheck
pnpm exec eslint src/app/backoffice/locations src/app/backoffice/onboarding/onboarding-tour.ts src/app/components/address-autofill-geoapify.tsx src/app/components/tour-events.ts
pnpm exec vitest run src/app/backoffice/locations/locations-tour-definitions.test.ts src/app/backoffice/locations/page-guard.test.ts src/app/backoffice/onboarding/onboarding-tour.test.ts src/app/backoffice/onboarding/onboarding-view.test.ts src/lib/location-address.test.ts
npm run check:design-contrast
git diff --check
```

Resultado final: 24 pruebas relacionadas aprobadas, TypeScript y ESLint sin errores, contraste claro/oscuro aprobado.

## Worktree

El arco no fue committeado. El worktree también contiene cambios preexistentes ajenos a esta implementación en `.claude/skills/protocolo-de-verificacion/SKILL.md`, `CLAUDE.md`, `docs/LECCIONES.md` y `docs/TASKS.md`; deben preservarse y no atribuirse al arco de Locales.
