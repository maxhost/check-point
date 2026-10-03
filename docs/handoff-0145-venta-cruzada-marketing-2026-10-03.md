# Handoff 0145 — Venta cruzada por compra en Marketing

## Cambio

La pantalla de Venta cruzada exige fecha de fin antes de activar y describe la entrega automática del cupón tras una compra. El consumidor mantiene su lista común de beneficios, que ya incluye `origin: "cross"`.

## Bitácora de mutación

Archivo limpio `template-draft.ts`: SHA-1 `842408fd920b589bd46e20dfca2f8f72785bf9ac`.

| Mutación | Oráculo | Resultado | Restauración |
|---|---|---|---|
| M1: quitar el error por `endsAt` vacío en `template-draft.ts` | `cross-ui.test.ts` debe fallar en «exige premio, vigencia, cupo y fin de campaña válidos» | ROJO: `expected {} to have property "endsAt"`; 1 failed / 3 passed | SHA-1 restaurado `842408fd920b589bd46e20dfca2f8f72785bf9ac`; 4/4 passed |

## Verificación final

Pendiente de `pnpm verify` con Node 24 y e2e.
