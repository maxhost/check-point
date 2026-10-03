# Diseño y publicación de pases en Apple Wallet

Estado 2026-10-02: la [spec 0123](../specs/0123-pase-apple-wallet-trama-viva.md)
fija «iPhone · strip visible» como dirección aprobada. El commit `0790956` está en
`origin/main` y el constructor genera el `.pkpass` con Trama viva. El despliegue y
la visualización en iPhone no están verificados. **No declarar el diseño live antes
del QA del `strip` en la versión de iOS objetivo.**

Esta página resume el flujo. Para futuras revisiones, usar las guías específicas:
[qué permite el diseño de Apple Wallet](apple-wallet-design-rules.md) y
[cómo actualizar pases ya instalados](apple-wallet-update-existing-passes.md).

## Qué cambia a quién

Apple Wallet no comparte una clase visual como Google. Cada `.pkpass` contiene sus
propios `pass.json`, PNG, `manifest.json` y firma. El constructor
`packages/domain/src/server/wallet/apple.ts` se usa tanto para emisiones nuevas como
para la respuesta PassKit que descarga un pase instalado. Al actualizar el arte:

- Los **pases nuevos** reciben el paquete nuevo después de desplegar el código.
- Los **pases ya guardados** conservan su paquete anterior hasta que Wallet descarga
  uno nuevo con el mismo Pass Type ID y número de serie. La revisión de marca en
  `pass-version.ts` evita un `304` antiguo; un aviso APNs vacío despierta la descarga.
- Apple dibuja y coloca el nombre, los avisos y el QR. El arte del `strip` no contiene
  texto ni código. La [guía visual de Apple](https://developer.apple.com/design/human-interface-guidelines/wallet)
  y la [página de store card](https://developer.apple.com/documentation/walletpasses/creating-a-store-card-pass)
  admiten el `strip`, pero la [tabla de Pass Designer](https://developer.apple.com/documentation/walletpasses/creating-a-pass-with-pass-designer)
  restringe su compatibilidad en iOS reciente. Resolver esta diferencia con un pase
  firmado en iPhone real.

## Actualizar el estilo

1. Editar el vector fuente `docs/design-explorations/apple-wallet-trama-strip-v1.svg`
   y, si corresponde, el logo compartido
   `apps/consumer/public/wallet-logo-trama-v1.png`. Para una revisión nueva, crear
   fuentes con sufijo `v2` y actualizar las rutas del generador; conservar las fuentes
   previas para poder reproducir pases antiguos. El `icon` (el que iOS muestra en las
   notificaciones del pase) sale del icono de la PWA instalada,
   `apps/consumer/public/checkpass-icon-192-v2.png` (spec 0146); el `logo` sigue en Trama viva.
2. Desde `packages/domain/`, ejecutar `node scripts/generate-apple-art.mjs`. El
   generador produce nueve PNG embebidos en `src/server/wallet/apple-art.ts`:
   `icon`, `logo` y `strip`, cada uno a 1x, 2x y 3x. Se embeben para que el bundle del
   servidor que firma el pase siempre tenga exactamente esos bytes. Correr Prettier
   sobre el archivo generado.
3. Revisar el arte a escala de teléfono y el paquete final. Los tamaños son icono
   38 × 38 pt, logo 50 × 50 pt y `strip` 375 × 144 pt; @2x y @3x multiplican ambas
   dimensiones. El nombre se dibuja sobre la izquierda del `strip`, así que esa zona
   debe quedar despejada. El QR debe seguir nativo.
4. Incrementar `PASS_BRAND_UPDATED_AT` en `pass-version.ts` a un instante UTC
   posterior a la revisión anterior. Mantener `passTypeIdentifier` y `serialNumber`.
5. Verificar `pnpm exec vitest run apps/merchant/src/server/wallet.test.ts`,
   `pnpm run typecheck`, `pnpm run lint` y `pnpm run build`. La prueba abre el ZIP,
   comprueba dimensiones PNG, hashes del manifiesto y estructura de firma. También
   comprueba QR, enlace y contacto.

## Pasar a vivo

1. Generar un pase **de QA firmado con el certificado real** y abrirlo en iPhone. No
   compartir el QR real ni el token de autenticación. Revisar lista, pase abierto,
   reverso, nombre largo, QR y la presencia del `strip`; anotar versión de iOS y
   comparar con otra versión disponible. Si el `strip` no aparece, volver a la
   decisión de diseño antes de desplegar.
2. Desplegar el código del consumidor que emite y sirve `.pkpass`. Confirmar con
   un pase **nuevo** que el ZIP recibido contiene los nueve PNG y que Wallet muestra
   el diseño; escanear el QR y abrir «Ver mis programas».
3. Para un pase **anterior**, comprobar que está registrado en PassKit. Tras el
   despliegue, enviar el aviso APNs vacío mediante la cola `pass_refresh` existente.
   Esa clase despierta Apple y también actualiza silenciosamente el objeto Google
   del mismo miembro, si lo tiene. Consultar cuántos consumidores Apple tienen
   dispositivos registrados antes de encolar; procesar una muestra primero. La
   operación de lote se realiza **una vez** por revisión de arte, después del QA.
   Seguir las consultas, exclusión de pases históricos solo hash y comprobaciones
   de credenciales de la [guía operativa](apple-wallet-update-existing-passes.md).
4. Abrir el pase anterior: debe conservar serial y QR, recibir el diseño y responder
   `200` desde el servicio PassKit en lugar de `304` con una fecha anterior a la
   revisión. Registrar fecha y resultado, sin tokens ni datos del miembro.

La cola ya usa `consumer.wallet_push_queue` con `class='pass_refresh'`, título y cuerpo
vacíos. Para una muestra aprobada, encolar con el `consumer_id` de QA mediante la
operación existente. Para la comunidad, el operador debe consultar las filas de
`consumer.wallet_pass` de proveedor `apple` unidas a
`consumer.wallet_push_device`, omitir consumidores que ya tengan un `pass_refresh`
`pending` o `sending`, y registrar el número encolado. El worker de
`apps/merchant` envía APNs; el endpoint PassKit de `apps/consumer` sirve el pase
nuevo. No cambiar seriales, QR ni borrar pases instalados para forzar el diseño.

### Reversión

Revertir el arte y el constructor, fijar una **nueva** revisión de marca posterior a
la anterior, desplegar y repetir el aviso vacío. No usar una fecha de revisión vieja:
Wallet puede responder `304` y mantener el paquete que se quería revertir.

## Variantes patrocinadas futuras

El paquete de Apple es individual. Para poner arte distinto a ciertos miembros se
necesita selección de variante en emisión **y** en la respuesta PassKit, persistencia
de la elección, vigencia y regreso a Trama viva. Cambiar `apple-art.ts` afecta a todos
los pases que se emitan o refresquen. Una campaña, patrocinio o pase de evento debe
tener su propia spec con audiencia, consentimiento, derechos de imagen, calendario,
experiencia sin `strip` y QA en iOS; no vender el `strip` como superficie garantizada
hasta verificar la compatibilidad en los sistemas objetivo.
