# Handoff — Spec 0140: avisos de mostrador en Actividad

Estado: UI implementada y verificada; revisión independiente y QA manual pendientes.

## Archivos

- `apps/consumer/src/app/(consumer)/wallet/page.tsx`: lee `listConsumerNotices(account.id)` en el `Promise.all` existente.
- `apps/consumer/src/app/(consumer)/wallet/wallet-shell.tsx`: pasa `NoticeDTO[]` a Actividad.
- `apps/consumer/src/app/(consumer)/wallet/activity-view.tsx`: mezcla avisos, cupones válidos y programas por fecha; abre «Mis programas» al tocar un aviso.
- `apps/consumer/src/app/(consumer)/wallet/activity-view.test.ts`: verifica texto, fecha, orden y estado vacío.
- `docs/specs/0140-avisos-de-mostrador-en-actividad.md`: registra el test agregado.

El ajuste mecánico del mock en `apps/consumer/src/server/wallet-account-opened.test.ts` fue hecho y pusheado por Claude (`0a66bc8`), dueño de esa zona. Esta entrega no modifica `src/server`, `app/api`, `packages` ni migraciones.

## Verificación

`nvm use` seleccionó Node 24.20.0. `pnpm verify` terminó `verify: ok` sobre `main` con el mock de Claude:

| Gate | Resultado | Segundos |
|---|---|---:|
| typecheck | ok | 5.1 |
| lint | ok | 15.1 |
| format:check | ok | 22.4 |
| test | ok | 37.8 |
| build | ok | 6.8 |
| test:e2e | ok | 36.3 |
| neon related merchant | salteado: no hay cambios de merchant | — |
| neon related consumer | ok | 3.5 |

La suite relacionada del consumidor terminó con 4 archivos y 17 tests verdes; incluye las 2 pruebas nuevas de Actividad y el test que fallaba sin el mock. `git diff --check` sin errores. El hook `pre-push` local quedó ejecutable (`-rwxr-xr-x`) y repetirá `pnpm verify` al pushear.

## Pendiente

- QA manual en `my.checkpass.club` con un cliente que haya sumado un sello en el mostrador: confirmar fila con nombre del comercio, «+1 sello» y fecha en Actividad, incluso sin notificaciones.
- PASS independiente del revisor antes de marcar la spec `implementada`.
