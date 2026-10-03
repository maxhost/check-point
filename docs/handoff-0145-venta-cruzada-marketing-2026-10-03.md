# Handoff 0145 — Venta cruzada por compra en Marketing

## Cambio

La pantalla de Venta cruzada exige fecha de fin antes de activar y describe la entrega automática del cupón tras una compra. El consumidor mantiene su lista común de beneficios, que ya incluye `origin: "cross"`.

## Bitácora de mutación

Archivo limpio `template-draft.ts`: SHA-1 `842408fd920b589bd46e20dfca2f8f72785bf9ac`.

| Mutación | Oráculo | Resultado | Restauración |
|---|---|---|---|
| M1: quitar el error por `endsAt` vacío en `template-draft.ts` | `cross-ui.test.ts` debe fallar en «exige premio, vigencia, cupo y fin de campaña válidos» | ROJO: `expected {} to have property "endsAt"`; 1 failed / 3 passed | SHA-1 restaurado `842408fd920b589bd46e20dfca2f8f72785bf9ac`; 4/4 passed |

## Verificación final

`pnpm verify` con Node 24.20.0 se corrió dos veces. Los gates funcionales pasaron, pero el build de Merchant con Turbopack no pudo abrir un puerto interno del procesador CSS (`Operation not permitted`), incluso fuera del sandbox. Es el fallo de entorno documentado antes en este checkout; el build de Merchant con Webpack terminó verde.

| Gate | Resultado | Tiempo de la segunda corrida |
|---|---|---:|
| typecheck | ok | 18,9 s |
| lint | ok | 9,3 s |
| format:check | ok | 7,8 s |
| test | ok | 39,6 s |
| build | ROJO: puerto interno de Turbopack | 2,5 s |
| test:e2e | ok | 35,9 s |
| Neon related merchant | ok, 30 tests relacionados | 4,8 s |
| Neon related consumer | salteado: sin cambios de consumer | — |

`pnpm --filter @mi-pasaporte/merchant exec next build --webpack` terminó verde. La spec permanece `cerrada` y no se considera satisfecha la DoD de `pnpm verify` hasta que el gate de build pase.
