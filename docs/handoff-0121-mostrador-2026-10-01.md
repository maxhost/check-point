# Handoff — Spec 0121

Estado: implementada, publicada en `main` y aprobada por el owner en live. Trabajo de rediseño cerrado.

Archivos tocados/revisados: `apps/merchant/src/app/backoffice/counter/*`,
`apps/merchant/src/server/counter/*`, `apps/merchant/src/app/api/counter/resolve/route.ts`,
`apps/merchant/src/app/backoffice/onboarding/onboarding-checklist.tsx`,
`apps/merchant/src/app/globals.css`, `docs/specs/0121-mostrador-rapido-con-catalogo.md` y `docs/INDEX.md`.

## Entrega

- `c2374a9`: categorías, productos habituales del cliente por negocio y local, carga de la última compra, controles de cantidad, resumen fijo y acreditación de un toque. El servidor filtra y valida la disponibilidad de productos por local.
- `2a6a190`: contraste de nombre, cantidades, controles, resumen, detalle y pantalla «¡Listo!» en modo oscuro.
- `1bd196b`: spec 0121 e índice marcados `implementada`; QA del owner registrada. Referencia: [spec 0121](specs/0121-mostrador-rapido-con-catalogo.md).

## Verificación

- `pnpm run typecheck` — 6 paquetes verdes.
- `pnpm run lint` — verde.
- `pnpm run build` — 4 apps verdes.
- `pnpm run test` — 2247 tests pasaron; las suites Neon se omiten sin su entorno.
- `tools/neon-test.sh src/server/counter/catalog-shortcuts.neon.integration.test.ts` — 1 prueba pasó contra la rama aislada; validó catálogo por local y hábitos aislados entre clientes y locales.
- QA manual del owner en live tras corregir contraste: «perfecto, funcionando».

## Límites y siguiente contexto

- La medición de tiempo, p90, exactitud de artículos y diferencias de precio frente a Loyverse quedó como seguimiento tras uso real en Café Plátano. No existe línea base ni resultado de velocidad todavía.
- La matriz automatizada de 320/375/430 px y texto al 200 % no se ejecutó: faltó Chromium compatible en este entorno. No hubo PASS de revisor independiente para la 0121; el owner pidió cerrarla con su QA en live. Esto está registrado en la spec.
- No hay tarea activa de Mostrador. El próximo trabajo del owner puede empezar después de `/clear`. El punto de retorno general es [TASKS.md](TASKS.md); este archivo conserva la evidencia de la 0121.
