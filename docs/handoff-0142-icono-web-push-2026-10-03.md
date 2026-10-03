# Handoff — Spec 0142: icono de la PWA en Web Push

Estado: Web Push implementado y verificado; QA visual en dispositivos pendiente.

## Cambio

`apps/consumer/public/sw.js` pasa a usar `/checkpass-icon-192-v2.png` como `icon` de `showNotification`, la misma imagen de 192 px del manifest de la PWA y de `layout.tsx`. El `badge` monocromo de Android sigue en `/checkpass-badge-96.png`. No cambian payload, entrega, texto, destino ni reporte del click.

## Verificación

`nvm use` seleccionó Node 24.20.0. `pnpm verify` terminó `verify: ok`:

| Gate | Resultado | Segundos |
|---|---|---:|
| typecheck | ok | 2.1 |
| lint | ok | 6.5 |
| format:check | ok | 6.7 |
| test | ok | 37.0 |
| build | ok | 5.6 |
| test:e2e | ok, 110 pasaron y 5 se omitieron | 36.1 |
| neon related merchant | salteado: no se tocó servidor | — |
| neon related consumer | salteado: no se tocó servidor | — |

## Revisión de Wallet

- **Apple Wallet:** la notificación usa el `icon.png` del pase. Hoy `packages/domain/scripts/generate-apple-art.mjs` genera tanto `icon.png` como `logo.png` desde `/wallet-logo-trama-v1.png`, que no es el PNG v2 del icono de la PWA. Para alinear solo el icono, Claude tendría que generar `icon` a 38/76/114 px desde `/checkpass-icon-192-v2.png`, conservar `logo` y `strip`, regenerar `apple-art.ts`, elevar la revisión visual y probar emisión/actualización de un pase viejo. Es zona de paquetes/servidor; GPT no la editó. Apple documenta que el icono del pase aparece en avisos de pantalla bloqueada.
- **Google Wallet:** la clase real apunta a `/wallet-logo-trama-v1.png` como `programLogo` desde `scripts/google-wallet/provision-class.mjs`. Google controla la apariencia del aviso en pantalla bloqueada y la API no expone un campo de icono propio por mensaje. Cambiar `programLogo` alteraría la tarjeta de todos los miembros, incluidos pases existentes; no se hizo. Cualquier cambio global necesita decisión de producto, clase QA y revisión del pase real.

Fuentes oficiales: [Web Push: opciones `icon` y `badge`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification), [Apple Wallet: icono del pase](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer), [Google Wallet: control de sus notificaciones](https://developers.google.com/wallet/retail/loyalty-cards/use-cases/trigger-push-notifications).

## Pendiente

- Enviar una notificación real en Android y iPhone con la PWA instalada y comprobar el icono observado. Los navegadores y sistemas operativos pueden recortarlo o sustituirlo.
- PASS independiente antes de marcar la spec `implementada`.
