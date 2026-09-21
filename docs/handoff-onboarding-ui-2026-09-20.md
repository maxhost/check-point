# Handoff — UI del onboarding posterior al wizard

Actualizado: 2026-09-20. Estado: implementado en el worktree, sin commit ni push.

Este es el punto de continuacion de la UI del onboarding. Para el contrato HTTP siguen siendo
normativos `docs/specs/0083-contratos-de-api.md` y
`docs/specs/0084-contratos-de-api.md`; para decisiones visuales, `docs/onboarding-ui.md`.

## Resultado actual

- El owner ve un widget persistente de onboarding en todo `/backoffice/*`.
- En movil queda fijo encima de la navegacion inferior; en escritorio flota abajo a la derecha.
- El header muestra `N de 5`, progreso real y permite expandir/colapsar.
- La lista usa cuatro estados puros: `done`, `current`, `blocked`, `upcoming`.
- Cada item usa `[indicador][texto]` en la primera fila y `[CTA a ancho completo]` en la segunda.
  El boton no participa como tercera columna.
- Solo `verify-email` tiene UI publicada. `staff`, `catalog`, `program` y `brand` se muestran
  bloqueados mientras falta el email y como `Proximamente` despues; no arrancan tours falsos.
- El CTA de email consume `POST /api/merchant/auth/verify-email`, con loading, envio, reenvio,
  email ya verificado y error recuperable.
- Un fallo de `GET /api/onboarding/checklist` se muestra con reintento; no se interpreta como un
  checklist vacio.
- `driver.js` esta integrado mediante `startOnboardingTour`: terminar persiste `completed` y
  cerrar persiste `skipped`.

## Archivos de esta entrega

Modificados:

- `apps/merchant/src/app/backoffice/layout.tsx`
- `apps/merchant/src/app/globals.css`
- `apps/merchant/src/app/layout.tsx`
- `docs/TASKS.md`

Nuevos:

- `apps/merchant/src/app/backoffice/onboarding/onboarding-api.ts`
- `apps/merchant/src/app/backoffice/onboarding/onboarding-api.test.ts`
- `apps/merchant/src/app/backoffice/onboarding/onboarding-checklist.tsx`
- `apps/merchant/src/app/backoffice/onboarding/onboarding-tour.ts`
- `apps/merchant/src/app/backoffice/onboarding/onboarding-tour.test.ts`
- `apps/merchant/src/app/backoffice/onboarding/onboarding-view.ts`
- `apps/merchant/src/app/backoffice/onboarding/onboarding-view.test.ts`
- `docs/onboarding-ui.md`
- este handoff

No descartar ni resetear el worktree. Los cambios no estan committeados.

## Base de datos y QA

Proyecto Neon: `red-violet-38772073`.

- Rama `main`: `br-curly-silence-ax8acywm`.
- Base: `neondb`.
- La migracion `0040` se aplico a `main` mediante el flujo administrado de migraciones de Neon.
- Verificacion posterior: `core.business_onboarding_tour` existe, hay 41 migraciones y el ultimo
  hash es `5585a9febeab4816ac1700aabdfd9098ab9673eb12eee8a98077f1f0b37710f8`.
- La rama temporal `br-twilight-hall-axmr3344` fue eliminada.
- Por pedido del owner, el usuario `gjlccghplujnhlkqpk@kjkpc.net` (id
  `29918f4b-09ad-4dfa-b8e8-df528e967740`) se actualizo en `main` de
  `email_verified = false` a `true` mediante MCP. `UPDATE … RETURNING` confirmo el valor `true`.

Al recargar `/backoffice`, el checklist debe mostrar email completado y los cuatro tours como
`Proximamente`. Si una sesion conservara una vista vieja, cerrar/abrir sesion fuerza una nueva
resolucion; el hecho persistido en DB ya es `true`.

## Verificacion ejecutada

Con Node 24.20.0:

- `pnpm --filter @mi-pasaporte/merchant typecheck` — verde.
- `pnpm lint` — verde.
- `pnpm format:check` — verde.
- Tests especificos: 3 archivos / 10 tests — verdes.
- Suite completa: 141 archivos / 1352 tests — verdes; 94 archivos Neon / 510 tests omitidos
  porque la rama de integracion no estaba activa.
- Build merchant de produccion con webpack — verde.
- `pnpm test:e2e` se intento despues de tocar `.tsx`, pero el sandbox rechazo
  `listen 0.0.0.0:3000` con `EPERM`; Playwright no alcanzo a ejecutar aserciones.

## Como publicar el siguiente tour

No agregar selectores ni pasos al API. Para cada tour:

1. Construir o confirmar la pantalla destino.
2. Poner selectores estables locales en sus elementos.
3. Declarar sus `DriveStep[]` junto a la pantalla.
4. Agregar el `anchor` a `AVAILABLE_ONBOARDING_ANCHORS` en `onboarding-view.ts`.
5. Desde la accion del item, navegar a la pantalla e iniciar `startOnboardingTour` cuando el DOM
   destino este listo.
6. Verificar los dos desenlaces: final → `completed`; cierre → `skipped`.

El siguiente candidato natural es `catalog`, porque la pantalla ya existe. `staff` no debe
publicarse: su entrada sigue marcada `Proximamente` y no tiene pantalla.

## Decisiones que no se deben revertir accidentalmente

- `anchor` es una clave estable, nunca un selector recibido por HTTP.
- `required` pendiente bloquea visualmente todo item posterior, igual que el gate del API.
- Los pasos del tour viven en cliente; no existe endpoint de pasos.
- El widget se monta en el layout solo para `membership.role === "owner"`.
- No volver a colocar el checklist dentro del flujo del dashboard.
- No volver a una grilla `[indicador][texto][boton]`: en el widget angosto comprime la copia.
