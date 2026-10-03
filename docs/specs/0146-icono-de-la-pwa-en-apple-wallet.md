---
spec: 0146
fecha: 2026-10-03
estado: cerrada
resumen: El `icon` del pase de Apple Wallet (el que iOS muestra en las notificaciones del pase) sale del PNG v2 de la PWA (`checkpass-icon-192-v2.png`) en vez del logo Trama viva; logo, strip, QR, identidad y contenido no cambian, y `PASS_BRAND_UPDATED_AT` sube para que los pases guardados puedan recibirlo. Google Wallet no se toca.
disjunta: si
archivos: packages/domain/scripts/generate-apple-art.mjs, packages/domain/src/server/wallet/{apple-art,pass-version}.ts, apps/merchant/src/server/wallet.test.ts, docs/wallet/apple-wallet-design-and-release.md
---

# 0146 — El icono de la PWA en las notificaciones de Apple Wallet

## Problema

- `packages/domain/scripts/generate-apple-art.mjs:26-28` genera `icon` (38×38 pt) y `logo` (50×50 pt) desde la misma
  fuente, `apps/consumer/public/wallet-logo-trama-v1.png` (660×660). iOS usa el `icon` del pase en sus notificaciones, asi
  que el aviso de Wallet no se parece al de la PWA instalada, que usa `apps/consumer/public/checkpass-icon-192-v2.png`
  (192×192, RGBA; medido con la cabecera PNG).
- `PASS_BRAND_UPDATED_AT` (`packages/domain/src/server/wallet/pass-version.ts:2`) vale `2026-10-02T14:00:00Z`: sin
  subirlo, un pase guardado recibe `304` y conserva el icono viejo (`docs/wallet/apple-wallet-update-existing-passes.md`).

## Decisiones del owner (2026-10-03, textual en el pedido)

«Quiero que Apple Wallet use en sus notificaciones el mismo icono que la PWA instalada:
apps/consumer/public/checkpass-icon-192-v2.png. Conservá el logo Trama viva y el strip actuales del pase. Google Wallet no
se cambia.» Cambiar **unicamente** la fuente de `icon`, con las dimensiones Apple existentes (38/76/114 px); regenerar
`apple-art.ts`; mantener logo, strip, QR, identidad y contenido; elevar la revision visual en `pass-version.ts`. No cambiar
la clase ni el logo de Google Wallet.

## Alcance

**Entra:** la fuente de `icon` en el generador (y su comentario de cabecera generado); `apple-art.ts` regenerado;
`PASS_BRAND_UPDATED_AT` a `2026-10-03T22:00:00Z`; oraculos en `wallet.test.ts`; una linea en
`docs/wallet/apple-wallet-design-and-release.md` con la fuente nueva del icono.

**No entra:** `logo`, `strip` y sus fuentes; `apple.ts` (constructor, `pass.json`, QR, serial, token); Google Wallet
(`google*.ts`, clase, logo); editar `apps/consumer/public/**` (zona de GPT: solo se LEE el PNG); el lote `pass_refresh`
a produccion (paso operativo del owner, abajo); QA en iPhone.

## Diseño

- `formats` pasa a `["icon", 38, 38, source.icon]` con `source.icon = readFile(apps/consumer/public/checkpass-icon-192-v2.png)`;
  `logo` y `strip` siguen igual. Mismo `sharp(...).resize(w*s, h*s).png({ compressionLevel: 9 })`. La cabecera generada
  nombra las tres fuentes.
- Se corre `node scripts/generate-apple-art.mjs` desde `packages/domain/` y Prettier sobre `apple-art.ts`. **Solo cambian
  las tres entradas `icon*`**: las seis de `logo*`/`strip*` quedan byte a byte (se comprueba con un diff de las entradas).
- `PASS_BRAND_UPDATED_AT = new Date("2026-10-03T22:00:00Z")`: posterior a la revision anterior y anterior al deploy.

## Archivos

| Archivo | Accion |
|---|---|
| `packages/domain/scripts/generate-apple-art.mjs` | editar (fuente de `icon`) |
| `packages/domain/src/server/wallet/apple-art.ts` | regenerar |
| `packages/domain/src/server/wallet/pass-version.ts` | editar (fecha) |
| `apps/merchant/src/server/wallet.test.ts` | editar (oraculos) |
| `docs/wallet/apple-wallet-design-and-release.md` | editar (fuente del icono) |

**Disjunta: si.** Zona de Claude (paquetes y servidor); la 0142 de GPT toca `sw.js`, no esto.

## Definition of Done

- [ ] `wallet.test.ts`: el paquete firmado trae los nueve PNG con sus dimensiones, manifiesto con el sha1 de cada archivo,
      firma PKCS#7, QR/serial/enlace/contacto como hoy, **y** `icon*.png` = los bytes que da `sharp` del PNG v2 de la PWA
      a 38/76/114, mientras `logo*`/`strip*` siguen saliendo de Trama viva y del strip v1.
- [ ] Un test pinnea `PASS_BRAND_UPDATED_AT` = `2026-10-03T22:00:00Z` y que `passVersionUpdatedAt` de un pase sin mensaje
      nuevo devuelve esa fecha (la que decide `200` vs `304` y la lista de seriales).
- [ ] La ruta de actualizacion de un pase existente: las suites de PassKit que usan la revision
      (`apps/consumer/src/server/wallet-pass-locations-wiring.test.ts`, `apps/merchant/src/server/wallet-push.neon.integration.test.ts`
      con `tools/neon-test.sh`) en verde con la fecha nueva.
- [ ] `git diff --stat` sin archivos `google*` ni `apps/consumer/public/**`; las entradas `logo*`/`strip*` de `apple-art.ts`
      identicas a `origin/main`.
- [ ] `pnpm verify` en verde con Node 24, con su tabla final.
- [ ] `rg -n MUTATION apps packages tools` → vacio.

## Mutaciones — presupuesto: 2. Clase: los plausibles

| # | Mutacion | Oraculo que tiene que ponerse ROJO |
|---|---|---|
| 1 | `apple-art.ts`: las tres entradas `icon*` vuelven a los bytes de `origin/main` (icono Trama) | `wallet.test.ts`: el caso del icono de la PWA |
| 2 | `pass-version.ts`: la fecha vuelve a `2026-10-02T14:00:00Z` | el test que pinnea la revision |

Guard hermano: para M1, el chequeo de dimensiones da verde con cualquier fuente cuadrada (por eso el oraculo compara
bytes); para M2, las suites de PassKit importan la constante simbolicamente y siguen verdes (por eso el literal).

**Protocolo:** el de `protocolo-de-verificacion`. **Corte:** dos vueltas de «el fix abrio la siguiente» → al owner.

## Declarado AFUERA (sin oraculo, a proposito)

- **QA en iPhone (owner):** con un pase de QA firmado con el certificado real, ver que la notificacion del pase muestra el
  icono de la PWA y que logo, strip, nombre y QR siguen iguales; anotar la version de iOS.
- **Actualizar los pases de produccion (owner aprueba):** despues del deploy y del QA, encolar `pass_refresh` para los
  consumidores Apple con dispositivo registrado (muestra primero, despues el lote, una sola vez), excluyendo los pases
  historicos con solo `auth_token_hash`, y con las variables APNs comprobadas en el proyecto del worker — procedimiento de
  `docs/wallet/apple-wallet-design-and-release.md` §«Pasar a vivo» y `apple-wallet-update-existing-passes.md`. El worker
  corre de 7 a 18 (ADR 0118).

## Handoff

Un implementador, un revisor independiente con PASS antes de `implementada`.

## Abierto

Nada.
